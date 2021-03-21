/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {BeeFX, WaapiWrap} from '../improxy-esm.js'

WaapiWrap.onRun(waCtx => {
  const {connectArr, registerFxType} = BeeFX(waCtx)
  
  const blankFx = { //8#bbb ------- blank -------
    def: {}
  }
  blankFx.construct = (fx, pars) => {
    fx.start.connect(fx.output)
  }
  registerFxType('fx_blank', blankFx)
  
  const gainFx = { //8#a00 ------- gain -------
    def: {
      gain: {defVal: 1, min: 0, max: 4, name: 'gain'}
    }
  }
  gainFx.setValue = (fx, key, value) => ({
    gain: _ => fx.setAt('gain', 'gain', value)
  }[key])
  
  gainFx.construct = (fx, pars, {ext} = fx) => {
    ext.gain = waCtx.createGain()
    connectArr(fx.start, ext.gain, fx.output)
  }
  registerFxType('fx_gain', gainFx)

  const delayFx = { //8#a0a ------- delay -------
    def: {
      delayTime: {defVal: 0, min: 0, max: 1}
    }
  }
  delayFx.setValue = (fx, key, value) => ({
    delayTime: _ => fx.setAt('delay', 'delayTime', value)
  }[key])

  delayFx.construct = (fx, pars, {ext} = fx) => {
    ext.delay = waCtx.createDelay()
    connectArr(fx.start, ext.delay, fx.output)
  }
  registerFxType('fx_delay', delayFx)
  
  const biquadOptions = [ //8#48d ------- biquadFilter (WA) -------
    ['lowpass', 'lowpass [no gain]'],
    ['highpass', 'highpass [no gain]'],
    ['bandpass', 'bandpass [no gain]'],
    ['lowshelf', 'lowshelf, [no Q]'],
    ['highshelf', 'highshelf [no Q]'],
    ['allpass', 'allpass [no gain]'],
    ['notch', 'notch [no gain]'],
    ['peaking', 'peaking']
  ]
  const biquadFx = {
    def: {
      filterType: {defVal: 'peaking', type: 'strings', subType: biquadOptions},
      frequency: {defVal: 800, min: 50, max: 22050, subType: 'exp'},
      detune: {defVal: 0, min: -2400, max: 2400},
      gain: {defVal: 0, min: -40, max: 40, subType: 'decibel'},
      Q: {defVal: 1, min: .0001, max: 100, subType: 'exp'}
    },
    name: 'BiquadFilter',
    freqGraph: [
      {filter: 'biquad'}
    ]
  }
  const detuneFactor = Math.log(2) / 1200
  //: const hz = Math.pow2(detune / 1200)
  //: const detune = Math.log(hz) / Math.log(2) * 1200
  //: const detune = Math.log(hz) / detuneFactor
  
  biquadFx.setValue = (fx, key, value) => ({
    filterType: _ => fx.ext.biquad.type = value,
    frequency: _ => fx.setAt('biquad', 'frequency', value),
    detune: _ => fx.setAt('biquad', 'detune', value),
    gain: _ => fx.setAt('biquad', 'gain', value),
    Q: _ => fx.ext.biquad.Q.value = value
  }[key])
    
  biquadFx.construct = (fx, pars, {ext} = fx) => {
    ext.biquad = waCtx.createBiquadFilter()
    connectArr(fx.start, ext.biquad, fx.output)
  }

  registerFxType('fx_biquad', biquadFx)
})
