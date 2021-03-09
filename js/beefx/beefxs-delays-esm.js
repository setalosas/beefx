/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, WaapiWrap} from '../improxy-esm.js'

const {nop, isArr, getRnd, getRndFloat} = Corelib
const {wassert} = Corelib.Debug
const {round} = Math

WaapiWrap.onRun(waCtx => {
  const {connectArr, registerFxType, newFx} = BeeFX(waCtx)

  const createDelayFxTypes = _ => {
    //: no beeFx dependencies
    
    const pingPongDelayAFx = { //8#0ac -------pingPongDelayA (Chris Wilson) -------
      def: {
        delayLeft: {defVal: 200, min: 0, max: 4000},
        delayRight: {defVal: 400, min: 0, max: 4000},
        feedbackLeft: {defVal: .5, min: .01, max: 1.0},
        feedbackRight: {defVal: .5, min: .01, max: 1.0}
      },
      name: 'Ping Pong Delay A'
    }
    pingPongDelayAFx.setValue = (fx, key, value) => ({
      delayLeft: _ => fx.ext.leftDelay.delayTime.value = value / 1000, //: setAt makes this worse
      delayRight: _ => fx.ext.rightDelay.delayTime.value = value / 1000,
      feedbackLeft: _ => fx.setAt('leftFeedback', 'gain', value),
      feedbackRight: _ => fx.setAt('rightFeedback', 'gain', value)
    }[key])
    
    pingPongDelayAFx.construct = (fx, {initial}) => {
      const {ext} = fx
      
      ext.merger = waCtx.createChannelMerger(2)
      ext.leftDelay = waCtx.createDelay()
      ext.rightDelay = waCtx.createDelay()
      ext.leftFeedback = waCtx.createGain()
      ext.rightFeedback = waCtx.createGain()
      ext.splitter = waCtx.createChannelSplitter(2)

      ext.splitter.connect(ext.leftDelay, 0)
      ext.splitter.connect(ext.rightDelay, 1)
      connectArr(ext.leftDelay, ext.leftFeedback, ext.rightDelay, ext.rightFeedback, ext.leftDelay)
      ext.leftFeedback.connect(ext.merger, 0, 0)
      ext.rightFeedback.connect(ext.merger, 0, 1)
      fx.start.connect(ext.splitter)
      ext.merger.connect(fx.output)
    }

    registerFxType('fx_pingPongDelayA', pingPongDelayAFx)
    
    const pingPongDelayBFx = { //8#0ac -------pingPongDelayB (Tuna) -------
      def: {
        delayLeft: {defVal: 200, min: 0, max: 4000},
        delayRight: {defVal: 400, min: 0, max: 4000},
        feedback: {defVal: .5, min: .01, max: 1.0},
        wetLevel: {defVal: .5, min: .01, max: 1.0}
      },
      name: 'Ping Pong Delay B'
    }
    
    pingPongDelayBFx.setValue = (fx, key, value) => ({
      delayLeft: _ => fx.ext.leftDelay.delayTime.value = value / 1000,
      delayRight: _ => fx.ext.rightDelay.delayTime.value = value / 1000,
      feedback: _ => fx.setAt('feedbackLevel', 'gain', value),
      wetLevel: _ => fx.setAt('wet', 'gain', value)
    }[key])

    pingPongDelayBFx.construct = (fx, {initial}) => {
      const {ext} = fx
      
      ext.wet = waCtx.createGain()
      ext.stereoToMonoMix = waCtx.createGain()
      ext.stereoToMonoMix.gain.value = .5
      ext.feedbackLevel = waCtx.createGain()
      ext.leftDelay = waCtx.createDelay(10)
      ext.rightDelay = waCtx.createDelay(10)
      ext.splitter = waCtx.createChannelSplitter(2)
      ext.merger = waCtx.createChannelMerger(2)

      fx.start.connect(ext.splitter)
      ext.splitter.connect(ext.stereoToMonoMix, 0, 0)
      ext.splitter.connect(ext.stereoToMonoMix, 1, 0)
      connectArr(ext.stereoToMonoMix, ext.wet, ext.leftDelay, ext.rightDelay, ext.feedbackLevel)
      ext.feedbackLevel.connect(ext.wet)
      ext.leftDelay.connect(ext.merger, 0, 0)
      ext.rightDelay.connect(ext.merger, 0, 1)
      ext.merger.connect(fx.output)
      fx.start.connect(fx.output) //:dry
    }
    
    registerFxType('fx_pingPongDelayB', pingPongDelayBFx)
  }
  createDelayFxTypes()
})
