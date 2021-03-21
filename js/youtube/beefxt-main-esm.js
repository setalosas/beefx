/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, DOMplusUltra, WaapiWrap, Playground, createUI} from '../improxy-esm.js'

const {onReadyState: onDomReady, div$, leaf$, set$} = DOMplusUltra 
const {runPlayground} = Playground
const {MediaElementPlayer} = window //: from MediaElementJs

//const onDomReady = new Promise(resolve => $(resolve))

const onWaapiReady = new Promise(resolve => WaapiWrap.onRun(resolve))

const adelay = delay  => new Promise(resolve => setTimeout(resolve, delay))

const config = {
  platform: 'standalone', // extension
  mediaType: 'audioboth', // video
  useVideo: true,
  useAudio: false
}

void (async _ => {
  console.log('maiiiin')
  await onDomReady
  await adelay(1000)// = await onBeeFxExtReady()
  
  const root = {
    waCtx: await onWaapiReady,
    mediaElement: null,
    onYoutube: true
  }
  
  window.addEventListener('transitionend', _ => _) //+ csekk!
  
  const tick = _ => {
    const video = document.getElementsByTagName('video')[0]
    console.log('found video', video)
    if (video) {
      div$(document.body, {class: 'beetrigger', text: 'BeeeFX!', click: _ => {
        root.mediaElement = video
        root.ui = createUI(config, root)
        runPlayground(root)
      }})
    } else {
      setTimeout(tick, 1000)
      console.log('ticked')
    }
  }
  tick()
})()
