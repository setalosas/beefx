/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib} from './improxy-esm.js'

const {Ø, s_a, yes, no, undef, clamp, nop, isNum, getRnd, hashOfString} = Corelib
const {wassert, weject} = Corelib.Debug
const {schedule, adelay, NoW, since, startEndThrottle, post} = Corelib.Tardis

export const extendWithSources = (playground, root) => {
  const {waCtx, ui} = root
  const {iterateStages, getStage} = playground
  
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
  
  const dbgMarkNode = (source, {sourceIx = 999, stageIx = 999}, msg) => {
    const {sourceNode: node} = source
    if (node[crumb]) {
      dbgLog(`☂️☂️Node already marked`, msg, node[crumb], {sourceIx, stageIx}, node)
    } else {
      node[crumb] = `src:${sourceIx} st:${stageIx} msg:${msg}`
      dbgLog(`🌞🌞Node marked:`, msg, node[crumb], {sourceIx, stageIx}, node)
    }
  }
  const dbgCheckNode = (source, {sourceIx = 999, stageIx = 999}, msg) => {
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
      dbgCheckNode(currSource, {sourceIx}, `chgSrc disconnect+delete`)
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
        autoPlayMedia(sourceIx) //: ellenorizni ott a tuiloldalon, h mediaelement e
      }
    }
    dbgMarkNode(newSource, {sourceIx}, `chgSrc (re)created`)
    for (const stageIx of destStageIxArr) {
      const stage = getStage(stageIx)
      newSource.sourceNode.connect(stage.stInput)
      slog(`💦reconnecting source[${sourceIx}] -> stage[${stage.ix}]`)
    }
    dbgCheckConsistency()
    sources.refreshUiAfterChange()
  }

  playground.changePrimarySource = mediaElement => playground.changeSource(0, mediaElement)
  
  playground.changeStageSourceIndex = (stageIx, newSourceIx, {isFirst} = {}) => {
    stageIx = parseInt(stageIx)
    wassert(stageIx >= 0 && stageIx < 64)  //: stageIx 0..63, sourceIx 0..4
    const stage = getStage(stageIx)
    
    if (!sourceArr[newSourceIx]) { //: no such valid source
      return console.warn(`There is no source[${newSourceIx}] for stage ${stageIx}`)
    }
    
    if (!isFirst) { //:there must be a current source
      const oldSourceIx = stage.stSource
      if (oldSourceIx === newSourceIx) {
        return console.warn(`chgStageSrc: same old & new! stage[${stageIx}] srcIx=${newSourceIx}`)
      }
      slog(`playground.chgStageSrc [${stageIx}] sourceIx: ${oldSourceIx} -> ${newSourceIx}`)
      
      disconnectSource(oldSourceIx, stageIx) //: this is a volatile state until connectSrc
    }
    //: evth is ok now, old (if there was one) has been disconnected, and there IS a new one
    slog(`chgStageSrcIx: connecting source ${newSourceIx} to stage ${stageIx}`)
    connectSource(newSourceIx, stageIx)
    dbgCheckConsistency()
    sources.refreshUiAfterChange()
  }
  
  //:8#597 --------------- sources methods ---------------
  
  const connectSource = (sourceIx, stageIx) => {
    const currSource = sourceArr[sourceIx]
    const stage = getStage(stageIx)
    wassert(!currSource.destStageIxArr.includes(stageIx)) //: can't be already there
    
    currSource.sourceNode.connect(stage.stInput)
    stage.stSource = sourceIx
    currSource.destStageIxArr.push(stageIx)
    autoPlayMedia(sourceIx)
    
    slog(`💦➕source[${sourceIx}] connected to stage[${stageIx}]`, currSource)
  }
  
  const disconnectSource = (sourceIx, stageIx) => {
    const currSource = sourceArr[sourceIx]
    const stage = getStage(stageIx)
    wassert(currSource.destStageIxArr.includes(stageIx)) //: must be there
    
    currSource.destStageIxArr = currSource.destStageIxArr.filter(ix => ix !== stageIx)
    currSource.sourceNode.disconnect(stage.stInput)
    
    slog(`💦➖source[${sourceIx}] disconnected from stage[${stageIx}]`, currSource)
  }
  
  sources.refreshUiAfterChange = _ => {//post(_ => {
    //+ jaj de csunya ez
    sourceArr.map(({destStageIxArr}, sourceIx) => sourceIx && sourceArr[sourceIx].isMediaElement &&
    ////+ reverse ascii kell
    //+ vagy egy stagearr.maptoch()
      ui.setVideoTargetInfo(sourceIx, destStageIxArr.map(a => 'ABCDEFGHIJKL'[a]).join(', ') || 'Mute'))
    iterateStages(stage => { 
      slog(`setting input selectors: stage[${stage.ix}] = ${stage.stSource}`)
      ui.setStageInputState(stage.ix, stage.stSource)
    })
    tlog(sourceArr.map(src => ({...src, stages: src.destStageIxArr.join(', ')})))
  }
  
  return sources  
}
