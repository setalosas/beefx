/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, Visualizer, BPM, Players, Sources, StateManager} from './improxy-esm.js'

const {s_a, undef, isFun, isNum, getRnd, hashOfString, ascii} = Corelib
const {wassert, weject} = Corelib.Debug
const {schedule, adelay, NoW, since, startEndThrottle} = Corelib.Tardis
const {createSpectrumVisualizer} = Visualizer
const {BroadcastChannel} = window

const createPlayground = root => {
  const {waCtx, mediaElement, ui} = root
  const {newFx, namesDb, connectArr} = BeeFX(waCtx)
  ui.konfigNames(namesDb)
  
  const dummyFx = waCtx.createGain()
  const output = waCtx.createGain()
  const stages = []
  
  const iterateStages = callback => {
    for (const stage of stages) {
      stage && callback(stage)
    }
  }
  
  const getStageArr = _ => stages.filter(stage => stage)
  
  const getFilteredStages = filter => getStageArr().filter(stage => filter(stage))
  
  const getStage = stageIx => stages[stageIx] || console.warn(`No stage[${stageIx}]`) || undef

  const dis = {
    iterateStages, 
    getStage,
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
  
  const sources = dis.sources = Sources.extendWithSources(dis, root)
  const players = dis.players = Players.extendWithPlayers(dis, root)
  const {radio} = players
  
  const getEndRatios = _ => getStageArr().map(stage => stage.stEndRatio)
  
  //8#a6c Compose & decompose - they won't touch sources, starting from stInput of stages
  
  const decompose = _ => {
    iterateStages(({fxArr, stInput, stEndRatio}) => {
      stInput.disconnect()
      for (const fx of fxArr) {
        fx.disconnect()
      }
      stEndRatio.disconnect()
    })
  }
  const connectArrayDest = (array, dest) => {
    for (let ix = 0; ix < array.length; ix++) {
      array[ix].connect(array[ix + 1] || dest)
    }
  }
  const compose = _ => {
    let unconnected = null
    
    iterateStages(({fxArr, stInput, stEndRatio, stSource, stAnalyzer, ix}) => {
      if (fxArr[0]) {
        if (dis.graphMode === 'parallel') { //: parallel can handle empty stages
          if (stEndRatio.isActive) {
            stInput.connect(fxArr[0])
            connectArrayDest(fxArr, stEndRatio)
            stEndRatio.connect(stAnalyzer)
            stEndRatio.connect(output)
          } else {
            //: no connection to output at all if inActive
          }
        } else {                             //:sequential is a bit more tricky
          ;(unconnected || stInput).connect(fxArr[0])  //+ TODO
          const trimmedFxArr = [...fxArr]
          const lastFx = trimmedFxArr.pop()
          connectArrayDest(trimmedFxArr, lastFx)
          unconnected = lastFx
        }
      }
    })
    wassert(unconnected || dis.graphMode === 'parallel')
    void unconnected?.connect(output)
  }
  const decomposeStage = stageIx => {
    const {fxArr, stInput, stEndRatio} = stages[stageIx]
    stInput.disconnect()
    for (const fx of fxArr) {
      fx.disconnect()
    }
    stEndRatio.disconnect()
  }
  const composeStage = stageIx => {
    const {fxArr, stInput, stEndRatio, stAnalyzer} = stages[stageIx]
    stInput.connect(fxArr[0])
    connectArrayDest(fxArr, stEndRatio)
    stEndRatio.connect(stAnalyzer)
    stEndRatio.connect(output)
  }
  
  //8#a66 ----------- Change core playground Fxs -----------
  
  const changeFxLow = (stage, ix, name) => {
    weject(isNum(stage))
    //console.log(`playground.changeFxLow(${stage.ix}, ${ix}, ${name})`)
    const {fxArr} = stage
    wassert(ix <= fxArr.length) //: the array can't have a gap
    void fxArr[ix]?.deactivate(false)
    fxArr[ix] = newFx(name)
    
    if (fxArr[ix]) {
      const isFixed = name === 'fx_gain' && !ix //: the first fx in every stage is a fix gain
      ui.rebuildStageFxPanel(stage.ix, ix, fxArr[ix], {isFixed, hasStageMark: isFixed})
    } else {
      console.error(`Bad Fx type:`, name)
    }
  }
    
  dis.changeFx = (stageIx, ix, name) => {
    decomposeStage(stageIx)
    changeFxLow(stages[stageIx], ix, name)
    composeStage(stageIx)
  }
  
  //8#46f ------------- Sync control: Master/slave stage settings -------------
  
  const activateMaster = stageIx => {
    dis.senderStage = stageIx
    dis.isMaster = true
    const stage = stages[dis.senderStage]
    stage.fpo.panel.set('send', {class: 'active'}) 
  }
  const activateSlave = stageIx => {
    dis.listenerStage = stageIx
    dis.isSlave = true
    const stage = stages[dis.listenerStage]
    stage.fpo.panel.set('listen', {class: 'active'}) 
  }
  const inactivateMaster = _ => {
    const oldStage = stages[dis.senderStage]
    oldStage.fpo.panel.set('send', {declass: 'active'}) 
    dis.senderStage = -1
    dis.isMaster = false
  }
  const inactivateSlave = _ => {
    const oldStage = stages[dis.listenerStage]
    oldStage.fpo.panel.set('listen', {declass: 'active'}) 
    dis.listenerStage = -1
    dis.isSlave = false
  }
  
  const clearSendersListeners = _ => {
    if (dis.senderStage > -1) {
      inactivateMaster()
    }
    if (dis.listenerStage > -1) {
      inactivateSlave()
    }
  }
  dis.setSenderStage = (stageIx = stages.length - 1) => {
    const oldSenderStage = dis.senderStage
    clearSendersListeners()
    if (stageIx !== oldSenderStage) {
      activateMaster(stageIx)
    }
  }
  dis.setListenerStage = stageIx => {
    const oldListenerStage = dis.listenerStage
    clearSendersListeners()
    if (stageIx !== oldListenerStage) {
      activateSlave(stageIx)
      dis.soloStage(stageIx)
    }
  }
    
  const initStageSender = stage => {//+ ez atlog a playersbe (amit at kene nevezni)
    const lazySend = startEndThrottle(stobj => {
      radio.postMessage(stobj)
      dis.lastSentAt = NoW()
      console.log('🏹sent', stobj)
    }, 50)
    
    const {stEndRatio} = stages[stage]
    
    stEndRatio.onValueChange('gain', _ => {
      if (!stEndRatio.int.shared.lastFixedFx) {
        return //console.warn('no lastFixedFx', stEndRatio, stEndRatio.int.shared)
      }
      const isThisLastFixed = true // stEndRatio.int.shared.lastFixedFx === stEndRatio
      if (stage === dis.senderStage && stEndRatio.isActive && isThisLastFixed) {
        lazySend({cmd: 'ratio', data: {gain: stEndRatio.getValue('gain')}, fp: dis.fingerPrint})
      }
    })
    // on bpm speed change
  }
  
  dis.incomingRatio = gain => {
    const {stEndRatio} = wassert(stages[dis.listenerStage])
    if (stEndRatio.isActive) {
      console.log('🎯received', {gain, willgain: 1 - gain})
      stEndRatio.setValue('gain', 1 - gain)
    }
  }
  
  //8#59c  ---------------- Stage init / change ----------------
  
  const initStage = (nuIx, uiStage) => { //: stage & ui exists, endRatio & others will be created
    const {spectcanv$, levelMeter$} = uiStage
    
    const mayday = data => { //: spectrum visualizer will call this if thew sound is BAD
      dis.activateStage(nuIx, false)
      for (const fx of stages[nuIx].fxArr) {
        fx.mayday && fx.mayday(data)
      }
      console.warn(`❗️❗️❗️ Overload in stage ${nuIx}, turning off. ❗️❗️❗️`)
    }
    const stAnalyzer = waCtx.createAnalyser()
    const vis = createSpectrumVisualizer(stAnalyzer, spectcanv$, levelMeter$, nuIx, mayday)
    const stEndRatio = newFx('fx_ratio')
    const stInput = waCtx.createGain()
    const stSource = 0
    const fxArr = []
    const fpo = ui.rebuildStageEndPanel(nuIx, stEndRatio)
    stages[nuIx] = {uiStage, fxArr, stEndRatio, stAnalyzer, vis, ix: nuIx, stInput, stSource, fpo}
    changeFxLow(stages[nuIx], 0, 'fx_gain')
    stEndRatio.chain(...getEndRatios())
    dis.changeStageSourceIndex(nuIx, 0, {isFirst: true}) //: 
    initStageSender(nuIx)
    return stages[nuIx]
  }
  
  dis.addStage = ch => {
    decompose()
    const nuIx = ascii(ch) - ascii('A')
    const uiStage = ui.addStage(nuIx)//:only once, restore will call ui.resetState()
    const stage = initStage(nuIx, uiStage)
    compose()
    return nuIx
  }
  
  //+ ezek itt teljesen rosszak :-(
  
  const saveStageState = stageIx => {
    const {fxArr, stEndRatio} = stages[stageIx]
    const state = {
      fxStates: []
      //stEndRatioState: stEndRatio.getFullState() //: dont save stInput, it's not real, no state
    }
    for (const fx of fxArr) {
      state.fxStates.push(fx.getFullState())
    }
      
    console.log(state)
    return state
    // van setallpars es livebol lehet kivenni
  }
  
  const loadStageState = (stageIx, state) => {
    //: delete first
    //: check for state vs actual stage length mismatch
    const stage = stages[stageIx]
    const {fxStates, stEndRatioState} = state
    //stage.stEndRatio = newFx('fx_ratio')
    //stage.stEndRatio.restoreFullState(stEndRatioState)
    let ix = 0
    for (const fxState of fxStates) {
      changeFxLow(getStage(stageIx), ix, wassert(fxState.fxName)) //+ miondenhol getStage!
      //dis.addFx(stageIx, wassert(fxState.fxName))
      stage.fxArr[ix++].restoreFullState(fxState)
    }
  }
  
  dis.rebuildStage = stageIx => { //: re ui regen click
    const state = saveStageState(stageIx)
    decomposeStage(0)
    loadStageState(0, state)
    composeStage(0)
    console.log(JSON.stringify(state))
    /*
    const {fxArr} = stages[stageIx]
    for (const fx of fxArr) {
      fx.activate(false) //: vagy ideiglenesen blankra cserelni
    }
    const {stEndRatio, uiStage, vis} = stages[stageIx]
    decompose()
    const stage = initStage(stageIx, uiStage) //+ ez teljesen rossz
    stages[stageIx] = stage
    ui.resetStage(stageIx)
    loadStageState(stageIx, state)
    compose()*/
  }
  
  dis.activateStage = (st, on) => {
    const {stEndRatio, vis, fpo} = stages[st]
    decompose()
    stEndRatio.activate(on)
    ui.refreshFxPanelActiveState(fpo)
    vis.setActive(on)
    compose()
  }
  
  dis.soloStage = st => {
    decompose()
    iterateStages(stage => {
      const {stEndRatio, vis, ix, fpo} = stage //+ tulzas ez ketszzer
      stEndRatio.activate(st === ix)
        ui.refreshFxPanelActiveState(fpo)
      vis.setActive(st === ix)
    })
    compose()
  }
  
  dis.equalRatios = _ => void stages[0]?.stEndRatio.chain(...getEndRatios())
  
  //8#c78 --------- Entry point / init --------- 
  
  const init = _ => {
    console.log(BeeFX(waCtx).fxHash)
    dis.changePrimarySource(mediaElement) //+ ha van! youtubeon lehet nincs! de a source is nezheti
    //input.disconnect()
    //input.connect(output)
    output.connect(waCtx.destination)
    players.init()
    players.initRadioListeners()
  }
  
  dis.insertBpmManipulator = _ => {
    /*
    dis.bpmSource!!!
    dis.source.disconnect()
    dis.bpmTransformer.setValue('media', mediaElement)

    dis.bpmTransformer.setValue('bpmOriginal', dis.bpm)
    ui.set('bpmMod', {declass: 'off'})
    connectArr(dis.source, dis.bpmTransformer, input)
    */
  }
  
  //8#ca0 ---------BPM detect / adjust  --------- 
  
  dis.recalcBpm = async (calcSec = 15) => {
    dis.bpmAuditor = dis.bpmAuditor || BPM.createBPMAuditor(waCtx)
    dis.bpmAuditor.start(dis.source)
    
    for (let elapsed = 0; elapsed < calcSec; elapsed++) { 
      ui.set('bpm', {text: `Listening for BPM (${calcSec - elapsed}s)...`})
      await adelay(1000)
    }
    const {bpm, candidates, error} = await dis.bpmAuditor.stop()
    if  (bpm > 55 && bpm < 200) {
      dis.bpm = bpm
      dis.insertBpmManipulator()
      ui.set('bpmpp', {declass: 'off'})
    } else {
      ui.set('bpmpp', {class: 'off'})
    }
    ui.set('bpm', {text: `BPM:` + bpm})
  }
  
  dis.bpmDelays = _ => {
    for (const {fxArr} of stages) { //+ BAD! stage can be undefined
      for (const fx of fxArr) {
        if (fx.getName().includes('Pong')) {
          fx.setValue('delayLeft', 240000 / dis.bpm)
          fx.setValue('delayRight', 120000 / dis.bpm)
        }
      }
    }
  }
  
  dis.setGraphMode = val => {
    decompose()
    dis.graphMode = val
    compose()
  }
  
  dis.addFx = (stageIx, name) => {
    const {fxArr} = stages[stageIx]
    dis.changeFx(stageIx, fxArr.length, name)
  }
  dis.getFx = (stageIx, ix) => stages[stageIx].fxArr[ix]
  
  init()
  
  return dis
}

export const runPlayground = async root => {
  const {ui, waCtx} = root
  const playground = createPlayground(root)
  ui.start(playground) //+ debug: miert nem lehet az initbe rakni
  
  const setupName = root.onYoutube 
    ? root.killEmAll
      ? 'youtubeFull'
      : 'youtubeMinimal'
    : 'last' // 'scopeChain' //Golem // setupPresetDebug
  
  const parent$ = document.body 
  
  StateManager.getActualPreset({name: setupName, parent$})
    .then(setup => {
      playground.setGraphMode('parallel')
      
      for (const key in setup) {
        const arr = setup[key]
        const st = playground.addStage(key)
        for (const fx of arr) {
          fx && playground.addFx(st, 'fx_' + fx)
        }
      }
      ui.finalize()
      if (setupName === 'scopeChain') {
        const DELAY = .368
        for (let i = 0; i < 12; i++) {
          const fx = playground.stages[i].fxArr[1]
          if (fx) {
            fx.setValue('delayTime', (11 - i) * DELAY)
          }
          const gx = playground.stages[i].fxArr[2]
          if (gx) {
            gx.setValue('fullZoom', 'fire')
          }
          console.log(fx.zholger)
        }
        void playground.stages[3]?.stEndRatio.setValue('gain', 1)
      }
    })
}
