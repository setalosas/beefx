/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, Visualizer, createBPMAuditor, Players, Sources} from './improxy-esm.js'

const {s_a, undef, isFun, isNum, getRnd, hashOfString} = Corelib
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
  
  const dis = {
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
  
  const getEndRatios = exc => stages.map(stage => stage.stEndRatio).filter(fx => fx !== exc)
  
  //8#a6c Compose & decompose - they won't touch sources, starting from stInput of stages
  
  const decompose = _ => {
    for (const {fxArr, stInput, stEndRatio} of stages) {
      stInput.disconnect()
      for (const fx of fxArr) {
        fx.disconnect()
      }
      stEndRatio.disconnect()
    }
  }
  const connectArrayDest = (array, dest) => {
    for (let ix = 0; ix < array.length; ix++) {
      array[ix].connect(array[ix + 1] || dest)
    }
  }
  const compose = _ => {
    let unconnected = null
    
    for (const {fxArr, stInput, stEndRatio, stSource, stAnalyzer, ix} of stages) {
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
    }
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
    console.log(`playground.changeFxLow(${stage.ix}, ${ix}, ${name})`)
    const {fxArr} = stage
    wassert(ix <= fxArr.length) //: the array can't have a gap
    fxArr[ix] = newFx(name)
    const isFixed = name === 'fx_gain' && !ix //: the first fx in every stage is a fix gain
    ui.rebuildStageFxPanel(stage.ix, ix, fxArr[ix], {isFixed})
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
      if (!stEndRatio.ext.shared.lastFixedFx) {
        return //console.warn('no lastFixedFx', stEndRatio, stEndRatio.ext.shared)
      }
      if (stage === dis.senderStage && stEndRatio.isActive && stEndRatio.ext.shared.lastFixedFx === stEndRatio) {
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
  
  const initStage = (nuIx, uiStage) => { // stage & ui exists, endRatio & analyser will be created
    const mayday = data => { //: spectrum visualizer will call this if thew sound is BAD
      dis.activateStage(nuIx, false)
      for (const fx of stages[nuIx].fxArr) {
        fx.mayday && fx.mayday(data)
      }
      console.warn(`❗️❗️❗️ Overload in stage ${nuIx}, turning off. ❗️❗️❗️`)
    }
    const {spectcanv$, levelMeter$} = uiStage
    const stAnalyzer = waCtx.createAnalyser()
    const vis = createSpectrumVisualizer(stAnalyzer, spectcanv$, levelMeter$, nuIx, mayday)
    const stEndRatio = newFx('fx_ratio')
    const stInput = waCtx.createGain()
    const stSource = 0
    const fxArr = []
    const fpo = ui.rebuildStageEndPanel(nuIx, stEndRatio, dis, {hasStageMark: true})
    stages[nuIx] = {uiStage, fxArr, stEndRatio, stAnalyzer, vis, ix: nuIx, stInput, stSource, fpo}
    changeFxLow(stages[nuIx], 0, 'fx_gain')
    stEndRatio.chain(...getEndRatios())
    dis.changeStageSourceIndex(nuIx, 0, {isFirst: true}) //: 
    initStageSender(nuIx)
    return stages[nuIx]
  }
  
  dis.addStage = _ => {
    decompose()
    const nuIx = stages.length
    const uiStage = ui.addStage(nuIx)//:only once, restore will call ui.resetState()
    const stage = initStage(nuIx, uiStage)
    compose()
    return nuIx
  }
  
  //+ ezek itt teljesen rosszak :-(
  
  const saveStageState = stageIx => {
    const {fxArr, stEndRatio} = stages[stageIx]
    const state = {
      fxStates: [],
      stEndRatioState: stEndRatio.getFullState()
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
    stage.stEndRatio = newFx('fx_ratio')
    stage.stEndRatio.restoreFullState(stEndRatioState)
    let ix = 0
    for (const fxState of fxStates) {
      //dis.changeFx(st, ix, wassert(fxState.fxName))
      dis.addFx(stageIx, wassert(fxState.fxName))
      stage.fxArr[ix++].restoreFullState(fxState)
    }
  }
  
  dis.rebuildStage = stageIx => { //: re ui regen click
    const state = saveStageState(stageIx)
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
    compose()
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
    for (const stage of stages) {
      const {stEndRatio, vis, ix, fpo} = stage //+ tulzas ez ketszzer
      stEndRatio.activate(st === ix)
        ui.refreshFxPanelActiveState(fpo)
      vis.setActive(st === ix)
    }
    compose()
  }
  
  dis.equalRatios = _ => void stages[0]?.stEndRatio.chain(...getEndRatios())
  
  //8#c78 --------- Entry point / init --------- 
  
  const init = _ => {
    dis.changePrimarySource(mediaElement)
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
    dis.bpmAuditor = dis.bpmAuditor || createBPMAuditor(waCtx)
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
    for (const {fxArr} of stages) {
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

export const runPlayground = root => {
  const {ui, waCtx} = root
  const playground = createPlayground(root)
  ui.start(playground) //+ debug: miert nem lehet az initbe rakni
  const sx = str => str.split(',').map(a => ({
    g: 'gain', 
    a: 'amp',
    ax: 'ampext',
    b: 'blank', 
    bi: 'biquad',
    cheb: 'chebyshevIIR'
  }[a]) || a)
  
  const setupPresetA = [
    sx('g,b') ,
    sx('g,b'),
    sx('g,a'),
    sx('g,ax')
  ]
  const setupPreset4x4 = [
    s_a('gain,blank,blank,blank') ,
    s_a('gain,blank,blank,blank'),
    s_a('gain,blank,blank,blank'),
    s_a('gain,blank,blank,blank')
  ]
  const setupPresetZero = [
    s_a('blank') ,
    s_a('blank'),
    s_a('blank'),
    s_a('blank')
  ]
  const setupPresetDebug = [
    s_a('') ,
    s_a('amp'),
    s_a('biquad'),
    s_a('compressor')
  ]
  const setupPresetBigBlank = [
    s_a('gain,biquad,blank,blank,blank,blank') ,
    s_a('gain,biquad,blank,blank,blank,blank'),
    s_a('gain,biquad,blank,blank,blank,blank'),
    s_a('gain,biquad,blank,blank,blank,blank')
  ]
  const setupPresetFull = [
    s_a('gain,biquad,vibrato,blank,blank') ,
    s_a('gain,biquad,pitchShifter,blank,blank'),
    s_a('gain,biquad,biquad,blank,blank'),
    s_a('gain,biquad,moog2,blank,blank')
  ]
  const setupYoutube = [
    s_a('gain,biquad,blank,blank,blank'),
    s_a('gain,biquad,blank,blank,blank'),
    s_a('gain,biquad,blank,blank,blank'),
    s_a('gain,biquad,blank,blank,blank')
  ]
  const setupTest = [
    sx('g,bi,b'),
    sx('g,bi,b'),
    sx('g,a,b'),
    sx('g,ax,b')
  ]
  const setup = root.onYoutube ? setupPresetZero : setupPresetA
  playground.setGraphMode('parallel')
  
  for (const arr of setup) {
    const st = playground.addStage()
    for (const fx of arr) {
      playground.addFx(st, 'fx_' + fx)
    }
  }
  ui.finalize()
}
