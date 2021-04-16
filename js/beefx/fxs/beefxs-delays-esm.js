/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {nop, isArr, getRnd, getRndFloat} = Corelib
const {wassert} = Corelib.Debug
const {round} = Math

onWaapiReady.then(waCtx => {
  const {connectArr, registerFxType, newFx} = BeeFX(waCtx)

  const delayExFx = { //8#05e -------Delay (Tuna) -------
    def: {
      delayTime: {defVal: 100, min: 20, max: 1000, unit: 'ms'},
      feedback: {defVal: .45, min: .0, max: .99},
      cutOff: {defVal: 20000, min: 20, max: 20000, unit: 'Hz', subType: 'exp'},
      wetLevel: {defVal: .5, min: 0, max: 1},
      dryLevel: {defVal: 1, min: 0, max: 1},
      freqGraph: {type: 'graph'}
    },
    midi: {pars: ['delayTime,feedback,cutOff', 'wetLevel,dryLevel']},
    name: 'Delay (extended)',
    graphs: {}
  }
  delayExFx.graphs.freqGraph = {
    graphType: 'freq',
    filter: 'filter',
    minDb: -43,
    maxDb: 10,
    diynamic: .5
  }
  delayExFx.setValue = (fx, key, value, {int, atm} = fx) => ({
    delayTime: _ => fx.setDelayTime('delay', value / 1000),
    feedback: _ => fx.setAt('feedback', 'gain', value),
    cutOff: _ => fx.setAt('filter', 'frequency', value),
    wetLevel: _ => fx.setAt('wet', 'gain', value),
    dryLevel: _ => fx.setAt('dry', 'gain', value)
  }[key])
  
  delayExFx.construct = (fx, {initial}, {int} = fx) => {
    int.dry = waCtx.createGain()
    int.wet = waCtx.createGain()
    int.filter = waCtx.createBiquadFilter()
    int.filter.type = 'lowpass'
    int.delay = waCtx.createDelay(10)
    int.feedback = waCtx.createGain()

    connectArr(fx.start, int.delay, int.filter, int.feedback, int.wet, fx.output)
    int.feedback.connect(int.delay)
    connectArr(fx.start, int.dry, fx.output)
  }

  registerFxType('fx_delayExt', delayExFx)
  
  const pingPongDelayAFx = { //8#0ac -------pingPongDelayA (Chris Wilson) -------
    def: {
      delayLeft: {defVal: 200, min: 0, max: 4000, unit: 'ms'},
      delayRight: {defVal: 400, min: 0, max: 4000, unit: 'ms'},
      feedbackLeft: {defVal: .5, min: .01, max: 1.0},
      feedbackRight: {defVal: .5, min: .01, max: 1.0}
    },
    midi: {pars: ['delayLeft,feedbackLeft', 'delayRight,feedbackRight']},
    name: 'Ping Pong Delay A'
  }
  pingPongDelayAFx.setValue = (fx, key, value) => ({
    delayLeft: _ => fx.int.leftDelay.delayTime.value = value / 1000, //: setAt makes this worse
    delayRight: _ => fx.setDelayTime('rightDelay', value / 1000),    //: that's 100%
    feedbackLeft: _ => fx.setAt('leftFeedback', 'gain', value),
    feedbackRight: _ => fx.setAt('rightFeedback', 'gain', value)
  }[key])
  
  pingPongDelayAFx.construct = (fx, {initial}, {int} = fx) => {
    int.merger = waCtx.createChannelMerger(2)
    int.leftDelay = waCtx.createDelay(10)
    int.rightDelay = waCtx.createDelay(10)
    int.leftFeedback = waCtx.createGain()
    int.rightFeedback = waCtx.createGain()
    int.splitter = waCtx.createChannelSplitter(2)

    int.splitter.connect(int.leftDelay, 0)
    int.splitter.connect(int.rightDelay, 1)//+ ez itt rosszul nez ki
    connectArr(int.leftDelay, int.leftFeedback, int.rightDelay, int.rightFeedback, int.leftDelay)
    int.leftFeedback.connect(int.merger, 0, 0)
    int.rightFeedback.connect(int.merger, 0, 1)
    fx.start.connect(int.splitter)
    int.merger.connect(fx.output)
  }

  registerFxType('fx_pingPongDelayA', pingPongDelayAFx)
  
  const pingPongDelayBFx = { //8#0b8 -------pingPongDelayB (Tuna) -------
    def: {
      delayLeft: {defVal: 200, min: 0, max: 4000, unit: 'ms'},
      delayRight: {defVal: 400, min: 0, max: 4000, unit: 'ms'},
      feedback: {defVal: .5, min: .01, max: 1.0},
      wetLevel: {defVal: .5, min: .01, max: 1.0}
    },
    midi: {pars: ['delayLeft,feedback', 'delayRight,wetLevel']},
    name: 'Ping Pong Delay B'
  }
  
  pingPongDelayBFx.setValue = (fx, key, value) => ({
    delayLeft: _ => fx.int.leftDelay.delayTime.value = value / 1000, //: no setAt, this is better
    delayRight: _ => fx.int.rightDelay.delayTime.value = value / 1000,
    feedback: _ => fx.setAt('feedbackLevel', 'gain', value),
    wetLevel: _ => fx.setAt('wet', 'gain', value)
  }[key])

  pingPongDelayBFx.construct = (fx, {initial}) => {
    const {int} = fx
    
    int.wet = waCtx.createGain()
    int.stereoToMonoMix = waCtx.createGain()
    int.stereoToMonoMix.gain.value = .5
    int.feedbackLevel = waCtx.createGain()
    int.leftDelay = waCtx.createDelay(10)
    int.rightDelay = waCtx.createDelay(10)
    int.splitter = waCtx.createChannelSplitter(2)
    int.merger = waCtx.createChannelMerger(2)

    fx.start.connect(int.splitter)
    int.splitter.connect(int.stereoToMonoMix, 0, 0)
    int.splitter.connect(int.stereoToMonoMix, 1, 0)
    connectArr(int.stereoToMonoMix, int.wet, int.leftDelay, int.rightDelay, int.feedbackLevel)
    int.feedbackLevel.connect(int.wet)
    int.leftDelay.connect(int.merger, 0, 0)
    int.rightDelay.connect(int.merger, 0, 1)
    int.merger.connect(fx.output)
    fx.start.connect(fx.output) //:dry
  }
  
  registerFxType('fx_pingPongDelayB', pingPongDelayBFx)
})
