/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, Visualizer} from './improxy-esm.js'

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
  !!!! Letters only!!!! Indexes are assigned internally as allocating slots in the array.
  Stages have letters assigned to them. This is main identifier for a stage.
  - A-P are normal (standard) stages (ABCD EFGH IJKL [MNOP]).
  - S1..S8.. are player/source control stages for sources.
  - LOC, REM, FAD, MIX are reserved for special stage types.
  Access is possible by both (indexes and letters).
  Most methods can recognize both type of reference (see stageId as param name).
  */
export const createStageManager = root => {
  const {waCtx, beeFx} = root
  const {newFx, connectArr} = beeFx 
  
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
  const iterateStandardStages = callback => {
    for (const stage of stages) {
      stage?.isStandardStage && callback(stage)
    }
  }
  const getStageArr = _ => stages.filter(stage => stage)
  
  const getFilteredStages = filter => getStageArr().filter(stage => filter(stage))
  
  const getStageByIx = stageIx => wassert(stages[stageIx])
  
  const getStageByLetter = letter => wassert(stageLetterHash[letter])
  
  const getStageById = stageId => isStr(stageId) ? getStageByLetter(stageId) : getStageByIx(stageId)

  const checkStageByLetter = letter => stageLetterHash[letter]
  
  const getStageGroup = _ => stages.filter(stage => stage.endRatio)
  
  const getEndRatios = _ => getStageGroup().map(stage => stage.endRatio)
  
  const stageMan = {
    iterateStages, 
    iterateStandardStages,
    getStage: getStageById,
    checkStageByLetter,
    getStageGroup,
    getEndRatios,
    getFilteredStages,
    stages
  }
  
  stageMan.dump = startEndThrottle(_ => {
    console.table(stages)
  }, 500)

  stageMan.changeFx = ({stageId, ix, type}) => {
    const stage = getStageById(stageId)
    if (stage) {
      stage.changeFx({ix, type})
    } else {
      console.warn(`stageMan.changeFx: no stage (${stage.stageIx})`, {ix, type, stages})
      debugger
    }
  }
  
  stageMan.addFx = (stageId, type) => getStageById(stageId).changeFx({type})

  stageMan.getFxById = (stageId, ix) => getStageById(stageId).fxArr[ix]

  //8#76e -------- Stage factory --------
  
  stageMan.createStage = ({letter, nuIx = stages.length}, params) => {
    const defaultParams = {
      hasStageMarks: true, //+tmp
      hasEndSpectrum: false,
      hasEndRatio: false,
      hasUi: true,
      isSourceStage: false,
      sourceStageIx: 0 //: not 0 if sourceStage
    }
    const stageParams = {
      ...defaultParams,
      ...params
    }
    //8#b58  -------- Init of one stage --------
    
    const stageIx = nuIx
    const fxArr = []
    const endRatio = stageParams.hasEndRatio ? newFx('fx_ratio') : undef //: cannot be false (?.)
    endRatio && beeFx.debug.addStage(endRatio, letter + ':')

    const output = endRatio || waCtx.createGain()
    void endRatio?.chain(...getEndRatios()) //: only the other chain elements' stage is needed
    
    const stage = {
      nuIx,
      ix: nuIx, //+killem all
      stageIx,
      letter,
      isStandardStage: letter.length === 1, //: very rudimental
      input: waCtx.createGain(), //: this is fix
      endRatio,
      output,
      sourceIx: -1,              //: Sources module reads/writes this directly
      analyser: undef,
      vis: undef,
      fxArr,
      uiStage: undef,            //: If the stage has an ui, also it's a flag for this
      ...stageParams
    }
    beeFx.debug.markNode(stage.input, `stages[${nuIx}].input`)
    
    if (stage.hasEndSpectrum) {
      stage.analyser = waCtx.createAnalyser()
      stage.output.connect(stage.analyser)
    }
        
    stages.push(stage)
    weject(stageLetterHash[letter])
    stageLetterHash[letter] = stage
    
    if (stage.hasUi) {
      const parent$ = stage.isSourceStage ? undef : undef
      stage.uiStage = root.ui.addStage(stage, parent$)
      
      if (stage.analyser) {
        const {spectcanv$, levelMeter$} = stage.uiStage
        stage.vis = spectcanv$ && Visualizer
          .createSpectrumVisualizer(stage.analyser, spectcanv$, levelMeter$, nuIx, stage.mayday)
      }
      stage.fpo = endRatio && root.ui.rebuildStageEndPanel(stage, endRatio) //+pfuj
    }
  
    stage.mayday = data => { //: spectrum visualizer will call this if thew sound is BAD
      stage.deactivate()
      for (const fx of fxArr) {
        void fx.mayday?.(data)
      }
      console.warn(`❗️❗️❗️ Overload in stage ${stageIx}, turning off. ❗️❗️❗️`)
    }
    
    stage.activate = (on = true) => { //: only the endRatio will be changed!
      endRatio.activate(on)
      stage.fpo && root.ui.refreshFxPanelActiveState(stage.fpo) //+ this is bad
      void stage.vis?.setActive(on) //: just for performance gain
    }
    
    stage.deactivate = _ => stage.activate(false)
    
    stage.decompose = _ => { //: no endRatio!
      stage.input.disconnect()
      for (const fx of fxArr) {
        void fx?.disconnect()
      }
    }
    
    stage.compose = _ => {
      stage.input.connect(fxArr[0] || stage.output)
      if (fxArr[0]) {
        connectArrayDest(fxArr, stage.output)
      }
    }
    
    const changeFxLow = ({ix = fxArr.length, type, params = {}}) => {
      void fxArr[ix]?.deactivate()
      
      fxArr[ix] = newFx(type)
      beeFx.debug.addStage(fxArr[ix], letter + ix)
      
      if (fxArr[ix]) { //: create ui for the fx if the stage has one
        stage.uiStage && root.ui.rebuildStageFxPanel(stage.ix, ix, fxArr[ix], params)
      } else {
        console.error(`Bad Fx type:`, type)
      }
      return fxArr[ix]
    }

    stage.changeFx = ({ix = fxArr.length, type, params = {}}) => {
      wassert(ix <= fxArr.length) //: the array can't have a gap
      stage.decompose()
      const fx = changeFxLow({ix, type, params})
      stage.compose()
      return fx
    }
    
    stage.saveState = _ => fxArr.map(fx => fx.getFullState())
    
    /* stage.reset = _ => { //+ should be const reset, not stage.reset to avoid call from outside
      for (let ix = 0; ix < fxArr.length; ix++) { //: delete all non fixed fxs
        if (fxArr[ix] && !fxArr[ix].isFixed) {
          stage.changeFx({ix, type: 'fx_blank'})
          //fxArr[ix].deactivate()
          //fxArr[ix] = undef
        }
      }
      while (fxArr[fxArr.length - 1]?.getName() === 'Blank') {
        const fx = fxArr.pop() //: we need a destroy ui fpo here
        stage.uiStage && root.ui.destroyStageLastFxPanel(stage.uiStage, fx)
      } 
      //:ui.resetStage(stageIx)
      beeFx.debug.dump('(resetted)')
    } */

    const destroyLastFx = _ => {
      wassert(fxArr.length)
      const fx = fxArr.pop() //: we need a destroy ui fpo here
      stage.uiStage && root.ui.destroyStageLastFxPanel(stage.uiStage, fx)
    }

    const destroyLastFxsAfter = newLen => {
      while (newLen < fxArr.length) {
        destroyLastFx()
      }
    }
    
    stage.destroyLastBlanks = _ => {
      while (fxArr.length > 1) {
        const lastIx = fxArr.length - 1
        if (fxArr[lastIx].getName() === 'Blank') {
          destroyLastFx()
          continue
        }
        break
      }
    }
    
    stage.loadState = async fxStates => {
      //: was: deactivate stage
      stage.decompose()
      destroyLastFxsAfter(fxStates.length)
      
      for (let ix = 0; ix < fxStates.length; ix++) {
        const fxState = fxStates[ix]
        fxArr[ix]?.isFixed ||
          void changeFxLow({ix, type: wassert(fxState.fxName)})?.restoreFullState(fxState)
          stage.uiStage.fxPanelObjArr[ix].isActive = fxArr[ix].isActive
          root.ui.refreshFxPanelActiveStateByStageIx(nuIx, ix)
          //+THIS IS BAD.
      }
      stage.compose()
      //: was: activate stage
    }
    
    stage.rebuild = _ => {
      const state = stage.saveState()
      iterateStages(istage => {
        if (istage !== stage) {
          istage.loadState(state)
        }
      })
    }
        
    stage.clone = _ => {
      const state = stage.saveState()
      console.log('this state will be cloned:', state)
      iterateStandardStages(istage => {
        if (istage !== stage) {
          istage.loadState(state)
        }
      })
    }
    
    stageMan.dump()
    
    return stage 
  }
  return stageMan
}
