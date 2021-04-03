/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, DOMplusUltra, onWaapiReady, Playground, createUI} from '../improxy-esm.js'

const {onDomReady, div$, leaf$, set$} = DOMplusUltra 

const adelay = delay  => new Promise(resolve => setTimeout(resolve, delay))

const config = {
  platform: 'standalone', // extension
  mediaType: 'audioboth', // video
  useVideo: true,
  useAudio: false
}

onDomReady(async _ => {
  console.log('beeFx/youtube main started')
  
  const root = {
    config,
    waCtx: await onWaapiReady,
    mediaElement: null,
    onYoutube: true
  }
  await adelay(10) //: it basically skips the loop so all Fx extensions can register
  
  window.addEventListener('transitionend', _ => _) //+ csekk!
  
  const trigger$ = div$(document.body, {class: 'beetrigger', text: 'BeeeFX!'})

  const tick = _ => {
    const video = document.getElementsByTagName('video')[0]
    console.log('found video', video)
    if (video) {
      set$(trigger$, {class: 'hasvideo', click: event => {
        root.mediaElement = video
        root.killEmAll = event.shiftKey
        root.ui = createUI(root)
        Playground.runPlayground(root)
      }})
    } else {
      setTimeout(tick, 1000)
      console.log('video not found, will retry in 1s')
    }
  }
  tick()
})
