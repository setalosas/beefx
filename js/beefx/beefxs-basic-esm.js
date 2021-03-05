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
    const gainFx = { //8#79c ------- gain -------
      def: {
        gain: {defVal: 1, min: 0, max: 10, name: 'gain'}
      }
    }
    gainFx.construct = (fx, pars) => {//: gainFx egy van, fx az instancia
      const {ext} = fx
      ext.gain = waCtx.createDelay()
      const ft = getRnd(0, 1)
      console.log(ft)
      ext.gain.delayTime.value = ft
      fx.start.connect(ext.gain)
      ext.gain.connect(fx.output)
    }
    registerFxType('fx_gain', gainFx)

    const biquadFx = { //8#79c ------- biquadFilter -------
      def: {
        filterType: {defVal: 'peaking', type: 'string', subtype: 'biquad'},
        frequency: {defVal: 800, min: 50, max: 22050},
        gain: {defVal: 0, min: -40, max: 40, subtype: 'decibel'},
        Q: {defVal: 1, min: .0001, max: 100}
      }
    }
    biquadFx.construct = (fx, pars) => {//: gainFx egy van, fx az instancia
      const {ext} = fx
      ext.biquad = waCtx.createBiquadFilter()
      fx.start.connect(ext.biquad)
      ext.biquad.connect(fx.output)
    }
    biquadFx.setValue = (fx, key, value) => {
      const fun = {
        filterType: _ => fx.ext.biquad.type = value,
        fequency: _ => fx.setAt('biquad', 'frequency', value),
        gain: _ => fx.setAt('biquad', 'gain', value),
        Q: _ => fx.ext.biquad.Q = value
      }[key] || console.warn(`biquad: bad pars`, {key, value}) || nop //| ez kozponti!
      fun()
    }
    registerFxType('fx_biquad', biquadFx)
        
    /*const biquadFx = {
      def: {
      }
    }
    registerFxType('fx_biquad', biquadFx)

    const constructBiquadFilter = (fx, pars) => {
      fx.ext.gain = waCtx.createGain()
      fx.start.connect(gainFx.gain)
      gainFx.gain.connect(fx.output)
    }
    registerFxType('fx_biquad', constructBiquadFilter)*/
  }
  
  createBasicFxTypes()
})
