/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import * as pgIm from './improxy-esm.js'

const {Corelib, Visualizer} = pgIm

const {s_a, undef, isFun, isNum, getRnd, hashOfString, ascii} = Corelib
const {wassert, weject} = Corelib.Debug
const {schedule, adelay, NoW, since, startEndThrottle, post} = Corelib.Tardis
const {createSpectrumVisualizer} = Visualizer
const {BroadcastChannel} = window

const {BeeFX, BPM, Players, Sources, StateManager, StageManager, createUI} = pgIm

const createPlayground = async root => {
  const {waCtx, ui} = root
  const {newFx, namesDb, connectArr, onReady: onBeeReady} = BeeFX(waCtx)
  await onBeeReady()
  
  ui.configNames(namesDb)
  
  //const dummyFx = waCtx.createGain()
  const output = waCtx.createGain()
  const stageMan = StageManager.createStageManager(root)
  const {getEndRatios, iterateStages, getFilteredStages, getStage} = stageMan

  const pg = {
    stageMan, //+ PFUJ de sourcesnek kell es fxpaneluinak is
    bpmAuditor: undef,
    bpmTransformer: newFx('fx_bpmTransformer'),
    bpm: 0,
    lastSentAt: 0,
    lastReceivedAt: 0,
    senderStage: undef,   //: the stage object
    listenerStage: undef, //: the stage object
    meState: {},
    meStateHash: '',
    fingerPrint: getRnd(100000, 999999)
  }
  
  const sources = pg.sources = Sources.createSources(pg, root)
  const players = pg.players = Players.extendWithPlayers(pg, root)
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
    wassert(unconnected || pg.graphMode === 'parallel')
    void unconnected?.connect(output)
  } */

  //8#a66 ----------- Change core playground Fxs -----------
    
  pg.changeFx = (stageId, ix, type) => stageMan.changeFx({stageId, ix, type})
  //+ ezt csak az uibol hivja a selektorfx ugye?
  
  //8#46f ------------- Sync control: Master/slave stage settings -------------
  
  const activateMaster = stageId => {
    pg.senderStage = getStage(stageId)
    pg.isMaster = true
    pg.senderStage.fpo.panel.set('send', {class: 'active'}) 
  }
  const activateSlave = stageId => {
    pg.listenerStage = getStage(stageId)
    pg.isSlave = true
    pg.listenerStage.fpo.panel.set('listen', {class: 'active'}) 
  }
  const inactivateMaster = _ => {
    void pg.senderStage?.fpo.panel.set('send', {declass: 'active'}) 
    delete pg.senderStage
    pg.isMaster = false
  }
  const inactivateSlave = _ => {
    void pg.listenerStage?.fpo.panel.set('listen', {declass: 'active'}) 
    delete pg.listenerStage
    pg.isSlave = false
  }
  const clearSendersListeners = _ => {
    inactivateMaster()
    inactivateSlave()
  }
  pg.setSenderStage = (stageId = -1) => {
    stageId === -1 && (stageId = 0) //: or getStageGroup's last Index
    const newSenderStage = getStage(stageId)
    clearSendersListeners()
    activateMaster(newSenderStage)
  }
  pg.setListenerStage = stageId => {
    const newListenerStage = getStage(stageId)
    clearSendersListeners()
    activateSlave(newListenerStage)
  } 
  const initStageSender = stageId => {//+ ez atlog a playersbe (amit at kene nevezni)
    const lazySend = startEndThrottle(stobj => {
      radio.postMessage(stobj)
      pg.lastSentAt = NoW()
      console.log('🏹sent', stobj)
    }, 50)
    
    const stage = getStage(stageId)
    const {endRatio} = stage
    
    void endRatio?.onValueChange('gain', _ => {
      if (!endRatio.int.shared.lastFixedFx) {
        return //console.warn('no lastFixedFx', endRatio, endRatio.int.shared)
      }
      const isThisLastFixed = endRatio.int.shared.lastFixedFx === endRatio //+ was true
      if (stage === pg.senderStage && endRatio.isActive && isThisLastFixed) {
        lazySend({cmd: 'ratio', data: {gain: endRatio.getValue('gain')}, fp: pg.fingerPrint})
      }
    })
    // on bpm speed change
  }
  
  pg.incomingRatio = gain => { //: called from pg-players
    const endRatio = pg.listenerStage?.endRatio 
    if (endRatio?.isActive) {
      console.log('🎯received', {gain, willgain: 1 - gain})
      endRatio.setValue('gain', 1 - gain)
    }
  }
  
  //8#59c  ---------------- Stage init / change ----------------
  
  pg.addStage = letter => {
    //const nuIx = ascii(letter) - ascii('A')
    const stage = stageMan.createStage({letter}, {hasEndSpectrum: true, hasEndRatio: true})
    const {stageIx} = stage
    const uiStage = ui.addStage(stage)//:only once, restore will call ui.resetState()
    stage.assignUi({uiStage})
    stage.changeFx({ix: 0, type: 'fx_gain', params: {isFixed: true, hasStageMark: true}})
    stage.output.connect(output)
    //pg.sources.changeStageSourceIndex(stageIx, 1, {isFirst: true}) //: 
    //initStageSender(nuIx)
    return stageIx
  }
  
  pg.rebuildStage = stageId => getStage(stageId)?.rebuild() //: re ui regen click

  pg.activateStage = (stageId, on) => getStage(stageId)?.activate(on)
  
  //8#c78 --------- Entry point / init --------- 
  
  const init = _ => {
    console.log(BeeFX(waCtx).fxHash)
    output.connect(waCtx.destination)
    players.init()
    players.initRadioListeners()
  }
  
  pg.initMixerStages = _ => {
    pg.localStage = stageMan.createStage({letter: pg.localStageLetter = 'LOC'})
    pg.localStageIx = pg.localStage.stageIx
    pg.remoteStage = stageMan.createStage({letter: pg.remoteStageLetter = 'REM'})
    pg.remoteStageIx = pg.remoteStage.stageIx
    pg.faderStage = stageMan.createStage({letter: pg.faderStageLetter = 'FAD'})
    pg.faderStageIx = pg.faderStage.stageIx
    
    /* stage.assignUi({uiStage})
    stage.changeFx({type: 'fx_gain'})
    stage.output.connect(output)
    pg.sources.changeStageSourceIndex(nuIx, 0, {isFirst: true}) // */
  }
  
  pg.changeDestination = newDestination => { //: not used
    output.disconnect()
    output.connect(newDestination)
  }
  
  pg.insertBpmManipulator = _ => {
    /*
    pg.bpmSource!!!
    pg.source.disconnect()
    pg.bpmTransformer.setValue('media', mediaElement)

    pg.bpmTransformer.setValue('bpmOriginal', pg.bpm)
    ui.set('bpmMod', {declass: 'off'})
    connectArr(pg.source, pg.bpmTransformer, input)
    */
  }
  
  //8#ca0 ---------BPM detect / adjust  --------- 
  /* 
  pg.recalcBpm = async (calcSec = 15) => {
    pg.bpmAuditor = playground.bpmAuditor || BPM.createBPMAuditor(waCtx)
    pg.bpmAuditor.start(playground.source)
    
    for (let elapsed = 0; elapsed < calcSec; elapsed++) { 
      ui.set('bpm', {text: `Listening for BPM (${calcSec - elapsed}s)...`})
      await adelay(1000)
    }
    const {bpm, candidates, error} = await playground.bpmAuditor.stop()
    if  (bpm > 55 && bpm < 200) {
      pg.bpm = bpm
      pg.insertBpmManipulator()
      ui.set('bpmpp', {declass: 'off'})
    } else {
      ui.set('bpmpp', {class: 'off'})
    }
    ui.set('bpm', {text: `BPM:` + bpm})
  }
  
  pg.bpmDelays = _ => {
    for (const {fxArr} of stages) { //+ BAD! stage can be undefined
      for (const fx of fxArr) {
        if (fx.getName().includes('Pong')) {
          fx.setValue('delayLeft', 240000 / pg.bpm)
          fx.setValue('delayRight', 120000 / pg.bpm)
        }
      }
    }
  } */
  
  pg.addFx = (stageId, name) => stageMan.addFx(stageId, name)
  
  pg.setPreset = (setup, setupName) => {
    const stageNames = []
    
    for (const key in setup) {
      stageNames.includes(key) || stageNames.push(key)
    }
    stageNames.sort()
    console.log({stageNames})
    for (const stageName of stageNames) {
      pg.addStage(stageName)
    }      
    for (const key in setup) {
      const arr = setup[key]
      for (const fx of arr) {
        fx && pg.addFx(key, fx[2] === '_' ? fx : ('fx_' + fx)) 
      }
    }
    ui.finalize()
    
    if (setupName === 'scopeChain') { //: special case -> save full stage instead
      const DELAY = .368
      for (let i = 0; i < 12; i++) {
        const fx = pg.stages[i].fxArr[1]
        if (fx) {
          fx.setValue('delayTime', (11 - i) * DELAY)
        }
        const gx = pg.stages[i].fxArr[2]
        if (gx) {
          gx.setValue('fullZoom', 'fire')
        }
        console.log(fx.zholger)
      }
      void pg.stages[3]?.stEndRatio.setValue('gain', 1)
    }
  }

  init()
  
  return pg
}

//8#b39 All entry points are here (beeFxPlayground site, CromBee, Patashnik)

export const runPlaygroundWithin = async (waCtx, options) => { //: no mediaE, ABSNs will be added
  const config = {
    maxSources: 8,
    ...options
  }
  const root = {
    config,
    waCtx,
    mediaElement: null,
    ...options
  }
  root.ui = createUI(root)
  const playground = await createPlayground(root)
  root.ui.start(playground) //+ csekk disz
  return {root, playground}
}

export const runPlayground = async root => { //: we may have a mediaElement in root
  const ui = root.ui = createUI(root)
  root.midi = pgIm.TestMidi?.createTestMidi(ui) //: MIDI test, can be deleted
  const playground = await createPlayground(root)
  ui.start(playground)

  const setupName = root.onYoutube 
    ? root.killEmAll ? 'youtubeFull' : 'youtubeDefault'
    : 'last'
  
  const parent$ = root.config.presetDisplayOn ? document.body : undef
  
  StateManager.getActualPreset({name: setupName, parent$})
    .then(setup => {
      playground.setPreset(setup, setupName)
      
      root.onYoutube
        ? root.mediaElement && ui.changeVideoElementSource(1, root.mediaElement)
        : playground.sources.getValidSourcesCnt() || ui.toggleList() //: only if no sources
    })
}
