/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, Visualizer} from './improxy-esm.js'

const {s_a, undef, isFun, isNum, isStr, getRnd} = Corelib
const {wassert, weject} = Corelib.Debug
const {schedule, adelay, startEndThrottle} = Corelib.Tardis
  /*
  StageManager can have many stages of different types (normal, mixer, internal, invisible, etc).
  A Stage is a sequential chain of beeFxs (or beeExts) + scaffolding.
  Scaffolding has fixed (input, source, mayday) and optional (endRatio, vis) parts.
  A stage doesn't know anything about it's source, whether it's media or not.
  Stages with endRatio forms a group and these stages are linked (and can be requested as a list).
  This is stageGroup.
  Stages can have ui assigned to them (uiStage), but they work without ui too.
  Activating/deactivating a stage means deactivating all fxs in it (+ endRatio if there is one).
  Stages have indexes (auto or manual). 
  These cannot be freely mixed - no empty slots. (Allocating 0 3 1 2 is ok, but 0 3 2 is not.)
  Stages have letters assigned to them.
  Access is possible by both (indexes and letters).
  Most methods can recognize both type of inputs (see stageId as param name).
  */
export const createStageManager = root => {
  const {waCtx} = root
  const {newFx, connectArr} = BeeFX(waCtx)
  
  //8#c89 -------- Helpers --------
  
  const connectArrayDest = (array, dest) => {
    for (let ix = 0; ix < array.length; ix++) {
      array[ix].connect(array[ix + 1] || dest)
    }
  }
  
  //8#c84 -------- StageMan start --------
  
  //8#c84   + scaffolding (start, input, source, end, ratio, vis, mayday)
  //8#900 must be used in playground, in patashnik for tracks, in playground mixer, etc
  //8#da6 stage metods:
  //8#dca - create + init  
  //8#cb9 - scaffolding  
  //8#ba8 --- mayday
  
  const stages = []
  const stageLetterHash = {}
    
  window.stages = stages //+ debug only
  
  const iterateStages = callback => {
    for (const stage of stages) {
      stage && callback(stage)
    }
  }
  const getStageArr = _ => stages.filter(stage => stage)
  
  const getFilteredStages = filter => getStageArr().filter(stage => filter(stage))
  
  const getStageByIx = stageIx => wassert(stages[stageIx])
  
  const getStageByLetter = letter => wassert(stageLetterHash[letter])
  
  const getStageById = stageId => isStr(stageId) ? getStageByLetter(stageId) : getStageByIx(stageId)
  
  const getStageGroup = _ => stages.filter(stage => stage.endRatio)
  
  const getEndRatios = _ => getStageGroup().map(stage => stage.endRatio)
  
  const equalRatios = _ => void getStageGroup()[0]?.endRatio.chain(...getEndRatios())

  const stageMan = {
    iterateStages, 
    getStage: getStageById,
    getStageGroup,
    getEndRatios,
    equalRatios,
    getFilteredStages,
    graphMode: 'parallel', //sequential or parallel (default)
    bpmAuditor: undef,
    bpmTransformer: newFx('fx_bpmTransformer'),
    bpm: 0,
    stages,
    lastSentAt: 0,
    lastReceivedAt: 0,
    senderStage: -1,
    listenerStage: -1,
    meState: {},
    meStateHash: '',
    fingerPrint: getRnd(100000, 999999)
  }

  stageMan.changeFx = ({stageId, ix, name}) => {
    const stage = getStageById(stageId)
    if (stage) {
      stage.changeFx({ix, name})
    } else {
      console.warn(`stageMan.changeFx: no stage (${stage.stageIx})`, {ix, name, stages})
      debugger
    }
  }
  
  stageMan.addFx = (stageId, name) => getStageById(stageId).changeFx({name})

  //stageMan.addFxByLetter = (letter, name) =>  getStageByLetter(letter).changeFx({name})

  stageMan.getFxById = (stageId, ix) => getStageById(stageId).fxArr[ix]

  //8#76e -------- Stage factory --------
  
  stageMan.createStage = ({letter, nuIx = stages.length}, params) => {
    const defaultParams = {
      hasEndSpectrum: false,
      hasEndRatio: false
    }
    const stageParams = {
      ...defaultParams,
      ...params
    }
    //8#b58  -------- Init of one stage --------
    
    const stageIx = nuIx
    const fxArr = []
    const endRatio = stageParams.hasEndRatio ? newFx('fx_ratio') : undef //: cannot be false (?.)
    const output = endRatio || waCtx.createGain()
    void endRatio?.chain(...getEndRatios()) //: only the other chain elements' stage is needed
    
    const stage = {
      nuIx,
      ix: nuIx,
      stageIx,
      letter,
      input: waCtx.createGain(), //: this is fix
      endRatio,
      output,
      sourceIx: -1,              //: Sources module reads/writes this directly
      analyser: undef,
      vis: undef,
      fxArr,
      uiStage: undef //+ ha van ui
    }
    
    if (stageParams.hasEndSpectrum) {
      stage.analyzer = waCtx.createAnalyser()
      stage.output.connect(stage.analyzer)
    }
        
    stages.push(stage)
    weject(stageLetterHash[letter])
    stageLetterHash[letter] = stage
    
    stage.assignUi = ({uiStage}) => {
      stage.uiStage = uiStage
      
      if (stage.analyzer) {
        const {spectcanv$, levelMeter$} = uiStage
        stage.vis = Visualizer
          .createSpectrumVisualizer(stage.analyzer, spectcanv$, levelMeter$, nuIx, stage.mayday)
      }
      stage.fpo = root.ui.rebuildStageEndPanel(stage, endRatio) //+pfuj
    }
  
    stage.mayday = data => { //: spectrum visualizer will call this if thew sound is BAD
      stage.deactivate()
      for (const fx of fxArr) {
        fx.mayday && fx.mayday(data)
      }
      console.warn(`❗️❗️❗️ Overload in stage ${stageIx}, turning off. ❗️❗️❗️`)
    }
    
    stage.activate = (on = true) => { //: ertelmetlen, az endratiot kapcsolgatja
      endRatio.activate(on)
      stage.fpo && root.ui.refreshFxPanelActiveState(stage.fpo) //+ this is bad
      void stage.vis?.setActive(on)
      
      for (const fx of fxArr) {
        fx.activate(on) //: ezeknek az uijat is kene basztatni
      }
    }
    
    stage.deactivate = _ => stage.activate(false)
    
    stage.setSolo = _ => {
      const stageGroupArr = getStageGroup()
      for (const groupStage of stageGroupArr) {
        groupStage.activate(groupStage === stage)
      }
    }
    
    stage.decompose = _ => { //+a nullas basz nem stage par, hanem fxarr[0], amit a playgrnd rak oda
      stage.input.disconnect()
      for (const fx of fxArr) {
        fx.disconnect()
      }
    }
    
    stage.compose = _ => {
      stage.input.connect(fxArr[0] || stage.output)
      if (fxArr[0]) {
        connectArrayDest(fxArr, stage.output)
      }
    }
    
    stage.changeFx = ({ix = fxArr.length, name}) => {
      //console.log(`playground.changeFxLow(${stage.ix}, ${ix}, ${name})`)
      wassert(ix <= fxArr.length) //: the array can't have a gap
      stage.decompose()

      void fxArr[ix]?.deactivate()
      fxArr[ix] = newFx(name)
      
      if (fxArr[ix]) {
        const isFixed = name === 'fx_gain' && !ix //: the first fx in every stage is a fix gain
        //+ fx build ?????
        root.ui.rebuildStageFxPanel(stage.ix, ix, fxArr[ix], {isFixed, hasStageMark: isFixed})
      } else {
        console.error(`Bad Fx type:`, name)
      }
      stage.compose()
      return fxArr[ix]
    }
    
    stage.saveState = _ => fxArr.map(fx => fx.getFullState())
    
    stage.loadState = fxStates => {
      //: delete first
      //: check for state vs actual stage length mismatch
      for (let ix = 0; ix < fxStates.length; ix++) {
        const fxState = fxStates[ix]
        void stage.changeFx({ix, name: wassert(fxState.fxName)})?.restoreFullState(fxState)
      }
      //+ ki kell tolteni az ures helyet, ha van, ha hosszabb lett, az nem baj, csak ha rovidult
    }
    stage.rebuild = _ => {
      const state = stage.saveState()
      console.log(JSON.stringify(state))
      stage.deactivate()
      stage.decompose()
      stage.reset()
      //:ui.resetStage(stageIx)
      stage.loadState(state)
      stage.activate() //: nem kell ez, mert aktivan szuletnek a loadStateben
      stage.compse()
    }
    
    /* 
    //+ valahogy meg kene tudni adnia hogy E D A C B stage az amit most krealunk
    stage.init = (letter, uiStage) => { //: stage & ui exists, endRatio & others will be created
      const {spectcanv$, levelMeter$} = uiStage //+ nem igy kene osszekotni
      //+nuIxet mindenhonnan kiirtani */
  
  //8#a6c Compose & decompose - they won't touch sources, starting from stInput of stages

    return stage 
  }
  return stageMan
}
