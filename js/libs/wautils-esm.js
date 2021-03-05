/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, object-curly-spacing, 
   no-trailing-spaces, indent, quotes, no-void, no-return-assign, 
   object-property-newline, object-curly-newline */

import {Corelib, DOMplusUltra} from '../improxy-esm.js'

const {undef} = Corelib
const {$, div$} = DOMplusUltra
const {AudioContext} = window

const debug = {
  verboseLogInit: true,
  logInit: true
}

const ilog = (...args) => debug.verboseLogInit && console.log(...args)
const log = (...args) => debug.logInit && console.log(...args)
const wlog = (...args) => console.warn(...args)
const elog = (...args) => console.error(...args)

const onError = err => {
  wau.ctxError = err
  elog(`Error, AudioContext:`, err, window.AudioContext)
  const {body} = document
  $(_ => body.setAttribute('error', (body.getAttribute('error') || '') + err))
}

export const wau = {
  waCtx: undef,
  callbacksOnStart: [],
  ctxError: '',
  ctxOk: false,
  ctxStateOk: false,
  checkState: _ => wau.ctxOk && (wau.ctxStateOk = wau.waCtx.state === 'running') 
}

export const onRun = cb => { 
  const currState = wau.waCtx?.state
  log(`🔈 🔉 🔊 callback is set, immed callback if ${currState} === running`)
  currState === 'running' ? cb(wau.waCtx) : wau.callbacksOnStart.push(cb)
}

setTimeout(_ => {
  AudioContext
    ? wau.waCtx = new AudioContext({sampleRate: 44100})
    : onError('Web Audio API is not supported by current browser.')

  if (wau.waCtx && typeof wau.waCtx.currentTime === 'number') {
    wau.createTime = wau.waCtx.currentTime
    wau.ctxOk = true
    ilog(`🔈 🔉 🔊 waCtx created as early as possible, state:`, wau.waCtx.state, wau.waCtx)
    
    if (wau.waCtx.state !== 'running') {
      wau.clicker$ = div$(document.body, {class: 'clicker', click: _ => letsGo()})
    }
    
    wau.waCtx.onstatechange = nst => {
      wau.ctxState = nst.currentTarget.state
      log(`🔈 🔉 🔊 waCtx state change:`, wau.waCtx.state, nst, nst.currentTarget)
      wau.checkState()
      if (nst.currentTarget.state === 'running') {
        ilog(`🔈 🔉 🔊 audio context is in 'running' state now.`)
        letsGo()
        
        if (wau.callbacksOnStart.length) {
          ilog(`🔈 🔉 🔊 callback will be called now`)
          setTimeout(_ => { 
            for (const cb of wau.callbacksOnStart) {
              cb(wau.waCtx)
            }
          }, 10)
        //: no early call if not suspended on the start! 
        //: UI may have a timeout of 1-2 ms, so this is longer
        } else {
          ilog(`🔈 🔉 🔊 callback won't be called as it's not set yet.`)
        }
      } else {
        wlog(`🔈 🔉 🔊 state is not running!`, nst)
      }
    }
  }        
}, 0)
/*
export const resurrect = _ => {
  wau.waCtx && wau.waCtx.resume().then(_ => log('🔈 🔉 🔊 Playback resumed successfully'))
}

export const heyHo = _ => {
  if (typeof wau.waCtx === 'object') { 
    const {waCtx, createTime} = wau    
    const {sampleRate, state, baseLatency} = waCtx
    
    log(`🔈 🔉 🔊 waCtx was created at ${createTime}`, {sampleRate, state, baseLatency})
  } else {
    ilog('🔈 🔉 🔊 No AudioContext.')
  }
}
*/
export const letsGo = _ => {
  if (!wau.ctxOk) {
    onError('???')
  } else {
    wau.waCtx.resume()
    wau.checkState()
    void wau.clicker$?.remove()
    wau.clicker$ = null
  }
}
