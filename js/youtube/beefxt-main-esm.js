/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, space-unary-ops, valid-typeof,
   object-curly-spacing, object-curly-newline, object-property-newline, no-floating-decimal,
   handle-callback-err, quotes, yoda, no-void, import/first, standard/no-callback-literal */

import {Corelib, DOMplusUltra, onWaapiReady, Playground, createUI} from '../improxy-esm.js'

const {onDomReady, div$, q$, set$} = DOMplusUltra
const {adelay} = Corelib.Tardis

//const adelay = delay  => new Promise(resolve => setTimeout(resolve, delay))

onDomReady(async _ => {
  console.log('CromBee beeFx/Youtube main started.')

  const config = {
    showEndSpectrums: true, //+ youtube kiakad, ha ez itt nem true! check!
    maxSources: 6
  }
  const root = {
    config,
    waCtx: await onWaapiReady,
    mediaElement: null,
    onYoutube: true,
    killEmAll: false
  }
  await adelay(10) //: it basically skips a few frames so all beeFx extensions can register

  const trigger$ = div$(document.body, {class: 'beetrigger', text: 'BeeeFX!'})

  const videoTagWaitingTick = _ => {
    const video = q$('video')
    if (video) {
      set$(trigger$, {class: 'hasvideo', click: event => {
        root.mediaElement = video
        root.killEmAll = event.shiftKey //: we'll remove most of Youtube if shift was pressed
        root.ui = createUI(root)
        Playground.runPlayground(root)
      }})
      console.log('CromBee found video tag:', video)
    } else {
      adelay(1000).then(videoTagWaitingTick)
      console.log(`CromBee didn't found video tag, will retry in 1s`)
    }
  }
  videoTagWaitingTick()
})
