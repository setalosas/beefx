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
  //const wlog = (...args) => logSources && console.warn(...args)
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
  
  const maxSources = 5 //: 0 = main, 1 2 3 4 = aux elements
  
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
  
  const createSource = (sourceIx, mediaElement, destStageIxArr) => {
    const mediaSourceNode = waCtx.createMediaElementSource(mediaElement)
    const sourceNode = waCtx.createGain()
    mediaSourceNode.connect(mutedNode)
    mediaSourceNode.connect(sourceNode)

    return sourceArr[sourceIx] = {
      mediaElement,
      mediaSourceNode, //: not needed any more, just for debug
      sourceIx,
      sourceNode,
      destStageIxArr   //: saved from previous source in this slot
    }
  }
  
  //:8#856 --------------- playground extension methods ---------------
  
  playground.changeSource = (sourceIx, mediaElement) => {
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
    const newSource = createSource(sourceIx, mediaElement, destStageIxArr)
    
    if (!sourceIx) { //: local main media, we will listen its state changes
      slog('sources calling initlocalmedialisteners')
      playground.players.initLocalMediaListeners(mediaElement)
    }
    dbgMarkNode(newSource, {sourceIx}, `chgSrc (re)created`)

    if (destStageIxArr.length) {
      autoPlayMedia(sourceIx)
    }
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
    sourceArr.map(({destStageIxArr}, sourceIx) => sourceIx && 
      ui.setVideoTargetInfo(sourceIx, destStageIxArr.map(a => 'ABCD'[a]).join(', ') || 'Mute'))
    iterateStages(stage => { 
      slog(`setting input selectors: stage[${stage.ix}] = ${stage.stSource}`)
      ui.setStageInputState(stage.ix, stage.stSource)
    })
    tlog(sourceArr.map(src => ({...src, stages: src.destStageIxArr.join(', ')})))
  }
  
  return sources  
}
