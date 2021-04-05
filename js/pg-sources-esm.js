/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib} from './improxy-esm.js'

const {Ø, s_a, yes, no, undef, clamp, nop, isNum, getRnd, hashOfString} = Corelib
const {wassert, weject, brexru} = Corelib.Debug
const {schedule, adelay, NoW, since, startEndThrottle, post} = Corelib.Tardis

export const extendWithSources = (playground, root) => {
  const {waCtx, ui} = root
  const {iterateStages, getStage} = playground.stageMan //+ ORIASI PFUJ
  
  //8#a48 ------------ Debug primitives ------------
  
  const crumb = 'aschne'
  
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
    for (let sourceIx = 0; sourceIx < maxSources; sourceIx++) {
      if (sourceArr[sourceIx]?.mediaElement) {
        weject(mediaElements.includes(sourceArr[sourceIx].mediaElement))
        mediaElements.push(sourceArr[sourceIx].mediaElement)
      }
    }
  }
  
  const maxSources = 33 //: 0 = main, 1 2 3 4 .. 32 = aux elements
  
  const source_interface = {
    sourceIx: 0,
    mediaElement: undef,
    sourceNode: undef,
    destStageIxArr: []
  }
  const sourceArr = []
  const sources = {
    dbgMarkNode,
    dbgCheckNode
  }
  const mutedNode = waCtx.createGain()
  mutedNode.gain.value = 0
  mutedNode.connect(waCtx.destination)
  
  if (root.config.sourceListDisplayOn) {
    sources.listUi = ui.createSourcesList(sources)
  }
  
  const playMedia = sourceIx => {
    const source = sourceArr[sourceIx]
    //console.log('PLAY', source)
    const {mediaElement} = source
    ui.mediaPlay(sourceIx, mediaElement)
  }
  
  const autoPlayMedia = sourceIx => ui.mixer.isAutoplayOn && playMedia(sourceIx)
  
  //8#c39 In the beginning, there was Jack, and Jack had a source.
  
  const createSource = (sourceIx, externalSource, destStageIxArr) => {
    const newSource = {
      isMediaElement: false,
      mediaElement: undef,
      externalSourceNode: undef,  //: not needed any more, just for debug
      sourceNode: waCtx.createGain(),
      destStageIxArr,   //: saved from previous source in this slot
      sourceIx
    }
    if (externalSource.filterType === 'volume') { //: it's a gain!
      newSource.externalSourceNode = externalSource
    } else if (externalSource.tagName === 'AUDIO' || externalSource.tagName === 'VIDEO') {
      newSource.isMediaElement = true
      newSource.mediaElement = externalSource
      newSource.externalSourceNode = waCtx.createMediaElementSource(newSource.mediaElement)
    } else {
      console.error(`Invalid external source`)
    }
    
    newSource.isMediaElement && newSource.externalSourceNode.connect(mutedNode)
    newSource.externalSourceNode.connect(newSource.sourceNode)

    return sourceArr[sourceIx] = newSource
  }
  
  //:8#856 --------------- playground extension methods ---------------
  
  playground.changeSource = (sourceIx, sourceIn) => {
    if (!sourceIn) {
      return wlog(`changeSource: no source/mediaElement to connect [${sourceIx}]!`)
    }
    wassert(sourceIx >= 0 && sourceIx < maxSources) //: valid sources are 0 1 2 3 4
    let destStageIxArr = []
    
    if (sourceArr[sourceIx]) {
      wassert(sourceIx) //: we cannot change the primary source
      const currSource = sourceArr[sourceIx]
      dbgCheckNode(currSource, {sourceIx, stageIx: 'N/A'}, `chgSrc disconnect+delete`)
      currSource.sourceNode.disconnect()
      destStageIxArr = currSource.destStageIxArr
      delete sourceArr[sourceIx]
    }
    const newSource = createSource(sourceIx, sourceIn, destStageIxArr)
    
    if (newSource.isMediaElement) {
      if (!sourceIx) { //: local main media, we will listen its state changes
        slog('sources calling initlocalmedialisteners')
        playground.players.initLocalMediaListeners(newSource.mediaElement)
      }
      if (destStageIxArr.length) {
        autoPlayMedia(sourceIx) //: we must check there whether it's a mediaElement
      }
    }
    dbgMarkNode(newSource, {sourceIx, stageIx: 'N/A'}, `chgSrc (re)created`)
    for (const stageIx of destStageIxArr) {
      const stage = getStage(stageIx)
      newSource.sourceNode.connect(stage.input)
      slog(`💦reconnecting source[${sourceIx}] -> stage#${stageIx}`)
    }
    dbgCheckConsistency()
    sources.refreshUiAfterChange()
  }

  playground.changePrimarySource = mediaElement => playground.changeSource(0, mediaElement)
  
  playground.changeStageSourceIndex = (stageId, newSourceIx, {isFirst} = {}) => {
    const stage = getStage(stageId)
    const {stageIx, sourceIx: oldSourceIx} = stage
    
    if (!sourceArr[newSourceIx]) { //: no such valid source
      return console.warn(`There is no source[${newSourceIx}] for stage ${stageId}`)
    }
    
    if (!isFirst) { //:there must be a current source (debug only, kill it later)
      if (oldSourceIx === newSourceIx) {
        return console.warn(`chgStageSrc: same old & new! stage[${stageId}] srcIx=${newSourceIx}`)
      }
      slog(`playground.chgStageSrc st: [${stageId}] sourceIx: ${oldSourceIx} -> ${newSourceIx}`)
      
      disconnectSource(oldSourceIx, stage) //: starting a volatile state until connectSrc
    }
    //: evth is ok now, old (if there was one) has been disconnected, and there IS a new one
    slog(`chgStageSrcIx: connecting source ${newSourceIx} to stage ${stageId}`)
    connectSource(newSourceIx, stage) //: stable again
    dbgCheckConsistency()
    sources.refreshUiAfterChange()
  }
  
  //:8#597 --------------- sources methods ---------------
  
  const connectSource = (sourceIx, stage) => {
    const currSource = sourceArr[sourceIx]
    const {stageIx, input} = stage
    wassert(!currSource.destStageIxArr.includes(stageIx)) //: can't be already there
    
    currSource.sourceNode.connect(input)
    stage.sourceIx = sourceIx
    currSource.destStageIxArr.push(stageIx)
    autoPlayMedia(sourceIx)
    
    slog(`💦➕source[${sourceIx}] connected to stage#${stageIx}`, currSource)
  }
  
  const disconnectSource = (sourceIx, stage) => {
    const currSource = sourceArr[sourceIx]
    const {stageIx, input} = stage
    wassert(currSource.destStageIxArr.includes(stageIx)) //: must be there
    
    currSource.destStageIxArr = currSource.destStageIxArr.filter(ix => ix !== stageIx)
    currSource.sourceNode.disconnect(input)
    
    slog(`💦➖source[${sourceIx}] disconnected from stage#${stageIx}`, currSource)
  }
  
  const destStr = source => source.destStageIxArr.map(a => getStage(a).letter).join(', ') || 'Mute'
  
  sources.refreshUiAfterChange = _ => {
    sourceArr.map(({destStageIxArr}, sourceIx) => sourceIx && sourceArr[sourceIx].isMediaElement &&
      ui.setVideoTargetInfo(sourceIx, destStr({destStageIxArr})))
    iterateStages(({stageIx, sourceIx}) => { 
      slog(`setting input selectors: stage#${stageIx}] = ${sourceIx}`)
      ui.setStageInputState(stageIx, sourceIx)
    })
    tlog(sourceArr.map(src => ({...src, stages: src.destStageIxArr.join(', ')})))
    
    if (sources.listUi) {
      sources.listUi.refresh(sourceArr.map((src, ix) => `sourceIx[${ix}] stages: ${destStr(src)} player: [][][]`))
      //debugger
    }
  }
  
  return sources  
}
