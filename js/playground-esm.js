/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, DOMplusUltra, WaapiWrap, BeeFX, createUI} from './improxy-esm.js'

const {wassert} = Corelib.Debug
const {$} = DOMplusUltra            //: from jQuery
const {MediaElementPlayer} = window //: from MediaElementJs
//playground -> playground-esm.js

const createPlayground = root => {
  const {waCtx, mediaElement, ui} = root
  const {newFx} = BeeFX(waCtx)
  
  const beeFxArr = []
  const beeFxBrr = []
  const dummyFx = waCtx.createGain()
  const input = waCtx.createGain()
  const output = waCtx.createGain()
  
  const dis = {
    graphMode: 'sequential', //sequential
    beeFxArr,
    beeFxBrr
  }
  
  const decompose = _ => {
    input.disconnect()
    for (const fx of [...beeFxArr, ...beeFxBrr]) {
      fx.disconnect()
    }
  }
  const connectArray = (array, dest) => {
    for (let ix = 0; ix < array.length; ix++) {
      array[ix].connect(array[ix + 1] || dest)
    }
  }
  const compose = _ => {
    if (beeFxArr[0] && beeFxBrr[0]) {
      if (dis.graphMode === 'parallel') {
        input.connect(beeFxArr[0])
        input.connect(beeFxBrr[0])
        connectArray(beeFxArr, output)
        connectArray(beeFxBrr, output)
      } else {
        input.connect(beeFxArr[0])
        connectArray(beeFxArr, beeFxBrr[0])
        connectArray(dis.beeFxBrr, output)
      }
    }
  }
    
  dis.changeFx = (stage, ix, name) => {
    console.log(`playground.changeFx(${stage}, ${ix}, ${name})`)
    const array = stage === 1 ? beeFxArr : beeFxBrr
    wassert(ix < array.length)
    decompose()
    array[ix] = newFx(name)
    ui.rebuildFxPanel(stage, ix, array[ix], dis)
    compose()
  }
  
  dis.changeSource = mediaElement => {
    //decompose()
    dis.source = waCtx.createMediaElementSource(mediaElement)
    dis.source.connect(input)
    //compose()
  }
  
  const init = _ => {
    dis.changeSource(mediaElement)
    //dis.source = waCtx.createMediaElementSource(mediaElement)
    //dis.source.connect(dis.input)
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
    const array = stage === 1 ? beeFxArr : beeFxBrr
    array.push(dummyFx)
    dis.changeFx(stage, array.length - 1, name)
  }
  
  dis.setOutputVolume = vol => {
  }
  dis.setStageRatio = (a, b = 1 - a) => {
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
  playground.setGraphMode('parallel')
  playground.addFx(1, 'fx_blank')
  playground.addFx(1, 'fx_blank')
  playground.addFx(2, 'fx_blank')
  playground.addFx(2, 'fx_blank')
  playground.addFx(2, 'fx_blank')
  //playground.changeFx(2, 1, 'fx_biquad')
}
