/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib} from './improxy-esm.js'

const { undef, getIncArray} = Corelib
const {wassert, weject, brexru} = Corelib.Debug
const {startEndThrottle} = Corelib.Tardis
const {AudioNode, MediaElementAudioSourceNode} = window
  /*
  Sources management - each Stage in the playground can have different sources.
  The source manager keeps track of each source and manages their connections into stages.
  Sources can have different "sources" (ie types):
  - MediaElement (AUDIO or VIDEO)
  - AudioBuffer (ASBN) - this needs a player, but it's not yet implemented. (SUPER EASY! :D)
  - Any AudioNode (DAN) - or in a special case: a lots of audiobuffers (output from 
    a multi-channel sequencer for example. 
    
  Sometimes we need to keep the sources in sync, that means simultaneous play/pause/speed
  control of the tracks. There are two cases for this:
  - A sequencer feeds us with AudioNodes as input (DAN). In this case the sequencer 
    will take care of the sync.
  - We loaded a series of audios (STEMs) as tracks of the same song. This is the case
    we have to address (this is done in ui-players and it's a border-line use case).
    
  Any source mediaElement will be disconnected (we don't want to hear their original sound),
  but also will be immediately connected to a dummy mute AudioNode. The reason for this is that
  MediaElements behave badly if disconnected, they can stop or reconnect to the WAU destination.
  
  Player interface
  - Adapter to play / control the different sources.
  - One of the main tasks: generating events on playback. (Can be synced with a remote player.)
  - It's in a separate module, but referred from here. Responsibilities are not quite clear yet.
  - Any source can (will) have a Player interface (except the direct AudioNodes).
  - If a source has a Player interface, it also has a special Player stage (but we call this a
    source stage, sources and players are way too interconnected).
  - Player/source stage consists of controls like speed, bpmDetector, play, stop, flood, etc.
  - A Player can be remote (two browser windows side by side). The good news is that this makes lots of issues more complex. So currently this is disabled.
  - Question: all non DAN sources will automatically get a Player interface? (Yes.)
  
  There are many special cases (like a Youtube video in an iframe to which we have audio access 
  or not) (not if it's not on the youtube.com site). In the latter case there can be a mock audio
  element replacing it. (This makes testing easier as we don't have to run in the Youtube chrome
  extension every time.)
  
  Sources are displayed in a separate strip on the top, but it's in a separate module (sources-ui).
  Again, responsibility division between sources and sources-ui is not clear yet.
  
  Main methods: 
  - changeSource: adds a new source.
  - changeStageSourceIndex: change a stage-source connection
  
  Rules of thumb:
  - Any source can be connected to many (or zero) stages.
  - Any stage can have one source only. (This can or cannot be zero, we will see it.)
  - There cannot be no sources for a stage. As a fallback it's muted (connected to the dummy one).
  
  Sources are numbered from 1 to maxSource (from config).
  There is also a dummy source 0 for muting.
  Starting source indexes for every stage are -1. (Maybe 0 would be better).
  (Until recently the (now deprecated) primary source had index 0, hopefully it's cleaned up now.)
  At this point, most of this module is debug check or log.
  */

export const createSources = (playground, root) => {
  const {waCtx, ui, beeFx} = root
  const {iterateStandardStages, getStage, createStage} = playground.stageMan
  
  //8#a48 ------------ Debug primitives ------------
  
  const crumb = 'aschne'  //: V-2
  
  const logSources = false
  
  const slog = (...args) => logSources && console.log(...args)
  const wlog = (...args) => logSources && console.warn(...args)
  const tlog = (...args) => logSources && console.table(...args)
  
  const dbgLog = (main, msg, crumb, ixObj, node) => {
    const msgSt = 'font-weight: 700;'
    const mainSt = 'font-weight: 400;'
    const crumbSt = 'color:#c00;'
    console.log(`%c${msg} %c${main} %c${crumb}`, msgSt, mainSt, crumbSt, ixObj, {node})
  }
  
  const dbgMarkNode = (source, {sourceIx = brexru(), stageIx = brexru()}, msg) => {
    const {sourceNode: node} = source
    if (node[crumb]) {
      dbgLog(`☂️☂️Node already marked`, msg, node[crumb], {sourceIx, stageIx}, node)
    } else {
      node[crumb] = `src:${sourceIx} st#${stageIx} msg:${msg}`
      dbgLog(`🌞🌞Node marked:`, msg, node[crumb], {sourceIx, stageIx}, node)
    }
  }
  const dbgCheckNode = (source, {sourceIx = brexru(), stageIx = brexru()}, msg) => {
    const {sourceNode: node} = source
    if (node[crumb]) {
      dbgLog(`🌞Marked node found:`, msg, node[crumb], {sourceIx, stageIx}, node)
    } else {
      dbgLog(`☂️Unmarked node found`, msg, node[crumb], {sourceIx, stageIx}, node)
    }
  }
  const dbgCheckConsistency = _ => {
    const mediaElements = [] //: are there two sources for the same mediaElement? (impossible)
    for (let sourceIx = 1; sourceIx <= maxSources; sourceIx++) {
      if (sourceArr[sourceIx]?.mediaElement) {
        weject(mediaElements.includes(sourceArr[sourceIx].mediaElement))
        mediaElements.push(sourceArr[sourceIx].mediaElement)
      }
    }
  }
  const dbgCheckIx = sourceIx => wassert(sourceIx > -1 && sourceIx <= maxSources)
  
  const dbgDump = startEndThrottle(_ => console.table(sourceArr), 500)
  
  const dummyInput = waCtx.createGain()
    
  const {maxSources = 8} = root.config
  const sourceIxArr = getIncArray(1, maxSources)
  
  const source_interface = { // eslint-disable-line no-unused-vars
    sourceIx: 0,
    mediaElement: undef,
    sourceNode: undef,
    destStageIxArr: []
  }
  const sourceArr = []
  const sources = {
    autoFloodOnFirst: true, //: first added source will flood every stage
    sourceArr,
    dbgDump,
    dbgMarkNode,
    dbgCheckNode,
    slog, tlog, wlog
  }
  const mutedNode = waCtx.createGain()
  mutedNode.gain.value = 0
  mutedNode.connect(waCtx.destination)
  beeFx.debug.markNode(mutedNode, `sources.mutedNode`)
  
  sources.getValidSourcesCnt = _ => sourceIxArr.filter(ix => sourceArr[ix]).length
  
  sources.getSource = ix => sourceArr[ix]
  
  sources.getSourceNode = ix => sourceArr[ix]?.sourceNode //: player needs this for bpm detection
  
  //8#a6a Source stages. Maybe not the final resting place for them.
  
  const sourceStageArr = []

  const createSourceStage = sourceIx => { //: destroy and recreate if exists
    if (!sourceStageArr[sourceIx]) {
      const sourceStageParams = {isSourceStage: true, hasUi: true, sourceStageIx: sourceIx}
      const stage = createStage({letter: 'S' + sourceIx}, sourceStageParams)
      stage.changeFx({ix: 0, type: 'fx_bpmTransformer', params: {isFixed: true}})
      
      sourceStageArr[sourceIx] = {
        stage,
        bpmFx: stage.fxArr[0]
      }
    } else {
      sourceStageArr[sourceIx].stage.output.disconnect()
    }
    return sourceStageArr[sourceIx]
  }
  
  sources.getSourceStage = ix => sourceStageArr[ix]

  //8#c39 In the beginning, there was Jack, and Jack had a source.
  
  const createSource = (sourceIx, paramExternalSource, destStageIxArr) => {
    dbgCheckIx(sourceIx)
    const newSource = {
      isMediaElement: false,
      mediaElement: undef,
      paramExternalSourceNode: undef,  //: not needed any more, just for debug
      sourceNode: waCtx.createGain(),
      destStageIxArr,                  //: saved from previous source in this slot
      sourceIx
    }
    if (paramExternalSource instanceof AudioNode) {
      newSource.externalSourceNode = paramExternalSource
      newSource.isAudioNode = true
    } else if (paramExternalSource.node instanceof AudioNode) { //: patashnik-specific, not nice
      newSource.externalSourceNode = paramExternalSource.node
      newSource.isAudioNode = true
    } else {
      newSource.isAudio = paramExternalSource.tagName === 'AUDIO'
      newSource.isVideo = paramExternalSource.tagName === 'VIDEO'
      
      if (newSource.isAudio || newSource.isVideo) {
        newSource.isMediaElement = true
        const mediaElement = newSource.mediaElement = paramExternalSource
        newSource.externalSourceNode = new MediaElementAudioSourceNode(waCtx, {mediaElement})
        newSource.externalSourceNode.connect(mutedNode)
      } else {
        console.error(`💦💦Invalid external source`)
        newSource.isInvalid = true
      }
    }
    beeFx.debug.markNode(newSource.sourceNode, `source[${sourceIx}].sourceNode`)
    beeFx.debug.markNode(newSource.externalSourceNode, `source[${sourceIx}].mediaEASN`)
    
    const {stage: sourceStage, bpmFx} = createSourceStage(sourceIx)
    
    if (!newSource.isInvalid) {
      newSource.externalSourceNode.connect(sourceStage.input)
      sourceStage.output.connect(newSource.sourceNode)
    }
    newSource.mediaElement && bpmFx.setValue('controller', ui.getSourceUi(sourceIx))

    return sourceArr[sourceIx] = newSource
  }
  
  //8#49e -------------------- Interface -----------------
  
  sources.changeSource = (sourceIx, {audio, video, audioNode, audioBuffer}) => {
    dbgCheckIx(sourceIx)
    
    const sourceIn = video || audio || audioNode || audioBuffer
    
    if (!sourceIn) { //: This is really bad. But never happens.
      debugger
      return wlog(`💦changeSource: no source/mediaElement to connect [${sourceIx}]!`)
    }
    let destStageIxArr = []
    const sourcesCnt = sources.getValidSourcesCnt()
    
    if (sourceArr[sourceIx]) {
      const currSource = sourceArr[sourceIx]
      dbgCheckNode(currSource, {sourceIx, stageIx: 'N/A'}, `chgSrc disconnect+delete`)
      currSource.sourceNode.disconnect()
      destStageIxArr = currSource.destStageIxArr
      delete sourceArr[sourceIx]
    }
    const newSource = createSource(sourceIx, sourceIn, destStageIxArr)
    
    if (newSource.isInvalid) {
      return
    }
    
    if (newSource.isMediaElement) {
      if (!sourceIx) { //: local main media, we will listen its state changes
        slog('💦sources calling initlocalmedialisteners')
        //: This is disabled for now. We don't sync with remote window bee.
        //playground.players.initLocalMediaListeners(newSource.mediaElement)
      }
    }
    if (destStageIxArr.length) {
      ui.autoPlaySource(sourceIx) //: There were living connections. Redoing the things they had.
    }
    dbgMarkNode(newSource, {sourceIx, stageIx: 'N/A'}, `chgSrc (re)created`)
    
    if (!sourcesCnt) { //: this is the very first source, so we connect every stage here by default
      //: temporary debug tests:
      weject(destStageIxArr.length)
      iterateStandardStages(stage => wassert(stage.sourceIx === -1))
      
      sources.autoFloodOnFirst && sources.floodStages({sourceIx})
    } else {
      for (const stageIx of destStageIxArr) {
        const stage = getStage(stageIx)
        newSource.sourceNode.connect(stage.input)
        slog(`💦reconnecting source[${sourceIx}] -> stage#${stageIx}`)
      }
    }
    dbgCheckConsistency()
    ui.refreshSourcesUi()
  }
  
  //: Flood = connect the source's output into EVERY stage. There's a button for that!

  sources.floodStages = ({sourceIx}) => 
    iterateStandardStages(stage => sources.changeStageSourceIndex(stage.stageIx, sourceIx))
  
  sources.changeStageSourceIndex = (stageId, newSourceIx, {isFirst} = {}) => {
    dbgCheckIx(newSourceIx)
    const stage = getStage(stageId)
    const {sourceIx: oldSourceIx} = stage
    
    if (newSourceIx > 0 && !sourceArr[newSourceIx]) {
      return console.warn(`There is no source[${newSourceIx}] for stage ${stageId}`)
    }
    const isAlreadyConnected = !isFirst && oldSourceIx !== -1 //: it should be the same
    
    if (isAlreadyConnected) { //:there must be a current source (debug only, kill it later)
      if (oldSourceIx === newSourceIx) {
        return console.warn(`chgStageSrc: same old & new! stage[${stageId}] srcIx=${newSourceIx}`)
      }
      slog(`💦playground.chgStageSrc st: [${stageId}] sourceIx: ${oldSourceIx} -> ${newSourceIx}`)
      
      disconnectSource(oldSourceIx, stage)//: starting a volatile state until connectSrc
    }
    //: evth is ok now, old (if there was one) has been disconnected, and there IS a new one
    slog(`💦hgStageSrcIx: connecting source ${newSourceIx} to stage ${stageId}`)
    connectSource(newSourceIx, stage) //: state is stable again
    dbgCheckConsistency()
    sources.stateChanged(oldSourceIx, {reset: true})
    sources.stateChanged(newSourceIx, {reset: true})
    ui.refreshSourcesUi()
    logSources && playground.stageMan.dump() //: log if trouble comes up
  }
  
  //: Solution: sources stores (bpm, beatTime or RESET state)
  //: source - stage conn changes -> the data of the new source will be set to the stage
  //: new media: players calls this and we set sources state to reset
  //: bpm: player sends bpm data here and we set sources state
  //: but now we havge 5 layers of storage holding the bpm data :-((((
  
  sources.stateChanged = (sourceIx, {reset = false, bpm = 0, beatTime = 0}) => {
    iterateStandardStages(stage => {
      if (stage.sourceIx === sourceIx) {
        slog('MATCHING stages', {sourceIx, stage})
        stage.onGlobalChange('source.reset', reset)
        stage.onGlobalChange('source.beatTime', beatTime)
        stage.onGlobalChange('source.bpm', bpm)
        slog(`SOURCES CHANGED`, {sourceIx, letter: stage.letter, reset, bpm, beatTime})
      }
    })
  }
  
  //:8#2b3 --------------- sources' main methods for connect / disconnect ---------------
  
  const connectSource = (sourceIx, stage) => {
    if (!sourceIx) {
      dummyInput.connect(stage.input) //:  muting
      stage.sourceIx = 0
      return
    }
    dbgCheckIx(sourceIx)
    const currSource = sourceArr[sourceIx]
    const {stageIx, input} = stage
    wassert(!currSource.destStageIxArr.includes(stageIx)) //: can't be already there
    
    currSource.sourceNode.connect(input)
    stage.sourceIx = sourceIx
    currSource.destStageIxArr.push(stageIx)
    ui.autoPlaySource(sourceIx) //: when changing source, it will autoplay (if autoplay is on)
    
    slog(`💦➕source[${sourceIx}] connected to stage#${stageIx}`, currSource)
  }
  
  const disconnectSource = (sourceIx, stage) => {
    if (!sourceIx) {
      dummyInput.disconnect(stage.input) //: was muted
      return
    }
    dbgCheckIx(sourceIx)
    const currSource = sourceArr[sourceIx]
    const {stageIx, input} = stage
    wassert(currSource.destStageIxArr.includes(stageIx)) //: must be there
    
    currSource.destStageIxArr = currSource.destStageIxArr.filter(ix => ix !== stageIx)
    currSource.sourceNode.disconnect(input)
    currSource.destStageIxArr.length || ui.autoStopSource(sourceIx)
    
    slog(`💦➖source[${sourceIx}] disconnected from stage#${stageIx}`, currSource)
  }

  return sources  
}
