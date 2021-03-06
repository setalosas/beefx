/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, WaapiWrap} from '../improxy-esm.js'

const {nop, getRnd, getRndFloat} = Corelib

WaapiWrap.onRun(waCtx => {
  const {registerFxType} = BeeFX(waCtx)

  const createBasicFxTypes = _ => {
    const blankFx = { //8#79c ------- blank -------
      def: {}
    }
    blankFx.construct = (fx, pars) => {//: gainFx egy van, fx az instancia
      fx.start.connect(fx.output)
    }
    registerFxType('fx_blank', blankFx)
    
    const gainFx = { //8#79c ------- gain -------
      def: {
        gain: {defVal: 1, min: 0, max: 3, name: 'gain'}
      }
    }
    gainFx.construct = (fx, pars) => {//: gainFx egy van, fx az instancia
      const {ext} = fx
      ext.gain = waCtx.createGain()
      fx.start.connect(ext.gain)
      ext.gain.connect(fx.output)
    }
    gainFx.setValue = (fx, key, value) => ({
      gain: _ => fx.setAt('gain', 'gain', value)
    }[key])
    registerFxType('fx_gain', gainFx)

    const delayFx = { //8#79c ------- delay -------
      def: {
        delayTime: {defVal: 0, min: 0, max: 1}
      }
    }
    delayFx.construct = (fx, pars) => {//: delayFx egy van, fx az instancia
      const {ext} = fx
      ext.delay = waCtx.createDelay()
      fx.start.connect(ext.delay)
      ext.delay.connect(fx.output)
    }
    delayFx.setValue = (fx, key, value) => ({
      delayTime: _ => fx.setAt('delay', 'delayTime', value) //fx.ext.delay.delayTime.value = value
    }[key])
    registerFxType('fx_delay', delayFx)

    const biquadFx = { //8#79c ------- biquadFilter -------
      def: {
        filterType: {defVal: 'peaking', type: 'string', subType: 'biquad'},
        frequency: {defVal: 800, min: 50, max: 22050, subType: 'exp'},
        detune: {defVal: 100, min: 1, max: 10000, subType: 'exp'},
        gain: {defVal: 0, min: -40, max: 40, subType: 'decibel'},
        Q: {defVal: 1, min: .0001, max: 100, subType: 'exp'}
      }
    }
    biquadFx.construct = (fx, pars) => {
      const {ext} = fx
      ext.biquad = waCtx.createBiquadFilter()
      fx.start.connect(ext.biquad)
      ext.biquad.connect(fx.output)
    }
    biquadFx.setValue = (fx, key, value) => ({
      filterType: _ => fx.ext.biquad.type = value,
      frequency: _ => fx.setAt('biquad', 'frequency', value),
      detune: _ => fx.setAt('biquad', 'detune', value),
      gain: _ => fx.setAt('biquad', 'gain', value),
      Q: _ => fx.ext.biquad.Q.value = value
    }[key])
    
    registerFxType('fx_biquad', biquadFx)
  }
  
  createBasicFxTypes()
})
