/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import * as pgIm from './improxy-esm.js'

const {Corelib, Visualizer} = pgIm

const {s_a, undef, isFun, isNum, getRnd, hashOfString, ascii} = Corelib
const {wassert, weject} = Corelib.Debug
const {schedule, adelay, NoW, since, startEndThrottle} = Corelib.Tardis
const {createSpectrumVisualizer} = Visualizer
const {BroadcastChannel} = window

const {BeeFX, BPM, Players, Sources, StateManager, StageManager, createUI} = pgIm

const createPlayground = root => {
  const {waCtx, ui} = root
  const {newFx, namesDb, connectArr} = BeeFX(waCtx)
  ui.configNames(namesDb)
  
  const dummyFx = waCtx.createGain()
  const output = waCtx.createGain()
  
  const stageMan = StageManager.createStageManager(root)
  
  const {getEndRatios, iterateStages, getFilteredStages, getStage} = stageMan

  const dis = {
    stageMan, //+ PFUJ de sourcesnek kell es fxpaneluinak is
    graphMode: 'parallel', //sequential or parallel (default)
    bpmAuditor: undef,
    bpmTransformer: newFx('fx_bpmTransformer'),
    bpm: 0,
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
  
  //8#a6c Compose & decompose - they won't touch sources, starting from stInput of stages
  
  /* const decompose = _ => {
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
  } */

  //8#a66 ----------- Change core playground Fxs -----------
    
  dis.changeFx = (stageId, ix, name) => stageMan.changeFx({stageId, ix, name})
  //+ ezt csak az uibol hivja a selektorfx ugye?
  
  //8#46f ------------- Sync control: Master/slave stage settings -------------
  
  const activateMaster = stageId => {
    dis.senderStage = getStage(stageId)
    dis.isMaster = true
    dis.senderStage.fpo.panel.set('send', {class: 'active'}) 
  }
  const activateSlave = stageId => {
    dis.listenerStage = getStage(stageId)
    dis.isSlave = true
    dis.listenerStage.fpo.panel.set('listen', {class: 'active'}) 
  }
  const inactivateMaster = _ => {
    void dis.senderStage?.fpo.panel.set('send', {declass: 'active'}) 
    delete dis.senderStage
    dis.isMaster = false
  }
  const inactivateSlave = _ => {
    void dis.listenerStage?.fpo.panel.set('listen', {declass: 'active'}) 
    delete dis.listenerStage
    dis.isSlave = false
  }
  const clearSendersListeners = _ => {
    inactivateMaster()
    inactivateSlave()
  }
  dis.setSenderStage = (stageId = -1) => {
    stageId === -1 && (stageId = 0) //: or getStageGroup's last Index
    const newSenderStage = getStage(stageId)
    clearSendersListeners()
    activateMaster(newSenderStage)
  }
  dis.setListenerStage = stageId => {
    const newListenerStage = getStage(stageId)
    clearSendersListeners()
    activateSlave(newListenerStage)
  } 
  const initStageSender = stageId => {//+ ez atlog a playersbe (amit at kene nevezni)
    const lazySend = startEndThrottle(stobj => {
      radio.postMessage(stobj)
      dis.lastSentAt = NoW()
      console.log('🏹sent', stobj)
    }, 50)
    
    const stage = getStage(stageId)
    const {endRatio} = stage
    
    void endRatio?.onValueChange('gain', _ => {
      if (!endRatio.int.shared.lastFixedFx) {
        return //console.warn('no lastFixedFx', endRatio, endRatio.int.shared)
      }
      const isThisLastFixed = endRatio.int.shared.lastFixedFx === endRatio //+ was true
      if (stage === dis.senderStage && endRatio.isActive && isThisLastFixed) {
        lazySend({cmd: 'ratio', data: {gain: endRatio.getValue('gain')}, fp: dis.fingerPrint})
      }
    })
    // on bpm speed change
  }
  
  dis.incomingRatio = gain => { //: called from pg-players
    const endRatio = dis.listenerStage?.endRatio 
    if (endRatio?.isActive) {
      console.log('🎯received', {gain, willgain: 1 - gain})
      endRatio.setValue('gain', 1 - gain)
    }
  }
  
  //8#59c  ---------------- Stage init / change ----------------
  
  dis.addStage = letter => {
    const nuIx = ascii(letter) - ascii('A')
    const stage = stageMan.createStage({letter, nuIx}, {hasEndSpectrum: true, hasEndRatio: true})
    const uiStage = ui.addStage(stage)//:only once, restore will call ui.resetState()
    stage.assignUi({uiStage})
    stage.changeFx({name: 'fx_gain'})
    stage.output.connect(output)
    dis.changeStageSourceIndex(nuIx, 0, {isFirst: true}) //: 
    //initStageSender(nuIx)
    return nuIx
  }
  
  dis.rebuildStage = stageId => getStage(stageId)?.rebuild() //: re ui regen click

  dis.activateStage = (stageId, on) => getStage(stageId)?.activate(on)
  
  //8#c78 --------- Entry point / init --------- 
  
  const init = _ => {
    console.log(BeeFX(waCtx).fxHash)
    output.connect(waCtx.destination)
    players.init()
    players.initRadioListeners()
  }
  
  dis.initMixerStages = _ => {
    dis.localStage = stageMan.createStage({letter: dis.localStageLetter = 'LOC',
    nuIx: 100}) //+SZAR
    dis.localStageIx = dis.localStage.stageIx
    dis.remoteStage = stageMan.createStage({letter: dis.remoteStageLetter = 'REM', nuIx: 101})
    dis.remoteStageIx = dis.remoteStage.stageIx
    dis.faderStage = stageMan.createStage({letter: dis.faderStageLetter = 'FAD', nuIx: 102})
    dis.faderStageIx = dis.faderStage.stageIx
    
    /* stage.assignUi({uiStage})
    stage.changeFx({name: 'fx_gain'})
    stage.output.connect(output)
    dis.changeStageSourceIndex(nuIx, 0, {isFirst: true}) // */
  }
  
  dis.changeDestination = newDestination => { //: not used
    output.disconnect()
    output.connect(newDestination)
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
  /* 
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
  } */
  
  dis.setGraphMode = val => {
    //+decompose()
    dis.graphMode = val
    //+compose()
  }
  
  dis.addFx = (stageId, name) => stageMan.addFx(stageId, name)
  
  init()
  
  return dis
}

export const runPlaygroundWithin = (waCtx, options) => { //: no mediaElement, ABSNs will be added
  const config = {
    sourceListDisplayOn: true,
    ...options
    //platform: 'standalone', // extension
    //mediaType: 'audioboth', // video
    //useVideo: true,
    //useAudio: false
  }
  const root = {
    config,
    mp3s: [],
    waCtx,
    mediaElement: null,
    ...options
  }
  root.ui = createUI(root)
  const playground = createPlayground(root)
  return {root, playground}
}

export const runPlayground = async root => { //: we may have a mediaElement in root
  const {ui, waCtx} = root
  const playground = createPlayground(root)
  root.mediaElement && playground.changePrimarySource(root.mediaElement)
  
  ui.start(playground) //+ debug: miert nem lehet az initbe rakni
  
  const setupName = root.onYoutube 
    ? root.killEmAll
      ? 'youtubeFull'
      : 'youtubeMinimal'
    : 'last' // 'scopeChain' //Golem // setupPresetDebug
  
  const parent$ = root.config.presetDisplayOn ? document.body : undef
  
  StateManager.getActualPreset({name: setupName, parent$})
    .then(setup => {
      playground.setGraphMode('parallel')
      
      for (const key in setup) {
        const arr = setup[key]
        playground.addStage(key)
        for (const fx of arr) {
          fx && playground.addFx(key, 'fx_' + fx)
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
