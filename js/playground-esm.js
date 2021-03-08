/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, DOMplusUltra, BeeFX, createSpectrumVisualizer} from './improxy-esm.js'

const {s_a} = Corelib
const {wassert} = Corelib.Debug
//const {$} = DOMplusUltra            //: from jQuery

const createPlayground = root => {
  const {waCtx, mediaElement, ui} = root
  const {newFx, namesDb} = BeeFX(waCtx)
  ui.konfigNames(namesDb)
  
  const beeFxAA = []
  const dummyFx = waCtx.createGain()
  const input = waCtx.createGain()
  const output = waCtx.createGain()
  const stages = []
  
  const dis = {
    graphMode: 'parallel', //sequential or parallel (default)
    beeFxAA
  }
  
  const decompose = _ => {
    input.disconnect()
    for (const {fxArr, stage} of beeFxAA) {
      for (const fx of fxArr) {
        fx.disconnect()
      }
      stage.stEnd.disconnect()
    }
  }
  const connectArray = (array, dest) => {
    for (let ix = 0; ix < array.length; ix++) {
      array[ix].connect(array[ix + 1] || dest)
    }
  }
  const compose_OLD = _ => {
    let unconnected = null
    
    for (const {fxArr} of beeFxAA) {
      if (fxArr[0]) {
        if (dis.graphMode === 'parallel') { //: parallel can handle empty stages
          input.connect(fxArr[0])
          connectArray(fxArr, output)
        } else {                             //:sequential is a bit more tricky
          ;(unconnected || input).connect(fxArr[0])
          const trimmedFxArr = [...fxArr]
          const lastFx = trimmedFxArr.pop()
          connectArray(trimmedFxArr, lastFx)
          unconnected = lastFx
        }
      }
    }
    wassert(unconnected || dis.graphMode === 'parallel')
    void unconnected?.connect(output)
  }  
  const compose = _ => {
    let unconnected = null
    
    for (const {fxArr, stage} of beeFxAA) {
      if (fxArr[0]) {
        if (dis.graphMode === 'parallel') { //: parallel can handle empty stages
          input.connect(fxArr[0])
          connectArray(fxArr, stage.stEnd)
          stage.stEnd.connect(stage.stAnalyzer)
          stage.stEnd.connect(output)
        } else {                             //:sequential is a bit more tricky
          //+ TODO
          ;(unconnected || input).connect(fxArr[0])
          const trimmedFxArr = [...fxArr]
          const lastFx = trimmedFxArr.pop()
          connectArray(trimmedFxArr, lastFx)
          unconnected = lastFx
        }
      }
    }
    wassert(unconnected || dis.graphMode === 'parallel')
    void unconnected?.connect(output)
  }
    
  dis.changeFx = (stage, ix, name) => {
    console.log(`playground.changeFx(${stage}, ${ix}, ${name})`)
    const {fxArr} = beeFxAA[stage]
    wassert(ix < fxArr.length)
    decompose()
    fxArr[ix] = newFx(name)
    ui.rebuildFxPanel(stage, ix, fxArr[ix], dis)
    compose()
  }
  
  dis.changeSource = mediaElement => {
    dis.source = waCtx.createMediaElementSource(mediaElement)
    dis.source.connect(input)
  }
  
  dis.addStage = _ => {
    const nuIx = beeFxAA.length
    const uiStage = ui.addStage(nuIx)
    const stAnalyzer = waCtx.createAnalyser()
    const vis = createSpectrumVisualizer(stAnalyzer, uiStage.spectcanv$, uiStage.levelMeter$, nuIx)
    
    stages[nuIx] = {
      uiStage,
      stEnd: waCtx.createGain(),
      stAnalyzer,
      vis
    }
    beeFxAA.push({fxArr: [], stage: stages[nuIx]})
    
    return nuIx
  }
  
  const init = _ => {
    dis.changeSource(mediaElement)
    input.disconnect()
    input.connect(output)
    output.connect(waCtx.destination)
    //set$(document.body, {on: {mousemove: e => output.gain.value = e.pageY / window.innerHeight}})
  }
  
  dis.setGraphMode = val => {
    decompose()
    dis.graphMode = val
    compose()
  }
  
  dis.addFx = (stage, name) => {
    const {fxArr} = beeFxAA[stage]
    fxArr.push(dummyFx)
    dis.changeFx(stage, fxArr.length - 1, name)
  }
  dis.getFx = (stage, ix) => beeFxAA[stage].fxArr[ix]
  
  dis.setOutputVolume = vol => {
  }
  dis.setStageRatio = (a, b = 1 - a) => {//: deprecated
    if (dis.graphMode === 'parallel') { //: only valid in parallel mode
      //: needs 2 extra gain nodes after/before the arrays
    }
  }
  
  init()
  
  return dis
}

export const runPlayground = root => {
  const {ui, waCtx} = root
  const playground = createPlayground(root)
  // valasztani h random preset vagy clean
  const setupPresetA = [
    s_a('ratio,blank') ,
    s_a('ratio,blank,biquad'),
    s_a('ratio,delay,blank,biquad'),
    s_a('ratio,biquad,biquad')
  ]
  const setupPresetZero = [
    s_a('ratio,blank') ,
    s_a('ratio,blank'),
    s_a('ratio,blank'),
    s_a('ratio,blank')
  ]
  const setupYoutube = [
    s_a('ratio,blank,blank,blank') ,
    s_a('ratio,blank,blank,blank'),
    s_a('ratio,blank,blank,blank'),
    s_a('ratio,blank,blank,blank')
  ]
  const setup = root.onYoutube ? setupYoutube : setupPresetZero
  playground.setGraphMode('parallel')
  for (const arr of setup) {
    const st = playground.addStage()
    for (const fx of arr) {
      playground.addFx(st, 'fx_' + fx)
    }
  }
  const ratioA = playground.getFx(0, 0)
  const ratioB = playground.getFx(1, 0)
  const ratioC = playground.getFx(2, 0)
  const ratioD = playground.getFx(3, 0)
  ratioA.chain(ratioB, ratioC, ratioD)
  //playground.changeFx(2, 1, 'fx_biquad')
}
