/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {nop, no, yes, isArr, getRnd, getRndFloat} = Corelib

onWaapiReady.then(waCtx => {
  const {connectArr, registerFxType, dB2Gain} = BeeFX(waCtx)
  
  const createAmpControl = ({subType = 'exp', name}) => { //8#48d ------- ampControl -------
    const ampFx = {
      def: {
        hi: {defVal: 0, min: -25, max: 25, unit: 'dB'},
        hiCutOffFreq: {defVal: 2400, min: 800, max: 4800, unit: 'Hz', subType}, //:exp/skipui
        lo: {defVal: 0, min: -25, max: 25, unit: 'dB'},
        loCutOffFreq: {defVal: 600, min: 200, max: 1200, unit: 'Hz', subType}, //:exp/skipui
        pan: {defVal: 0, min: -.5, max: .5},
        vol: {defVal: 0, min: -24, max: 6, unit: 'dB'},
        multiGraph: {type: 'graph', subType: 'multi'}
      },
      name,
      graphs: {}
    }

    const transExp = xpt => (1 - Math.pow(1 * xpt, 3)).toFixed(2)
    
    ampFx.graphs.multiGraph = [{
      graphType: 'freq',
      filter: 'loNode',
      minDb: -27,
      maxDb: 33,
      diynamic: .8,
      phaseCurveColor: `hsla(120, 99%, 80%, .5)`,
      curveColor: ({xpt}) => `hsla(120, 90%, 55%, ${transExp(xpt)})`
    }, {
      graphType: 'freq',
      filter: 'hiNode',
      renderSet: {doClear: false, doGrid: false, doGraph: true},
      minDb: -27,
      maxDb: 33,
      diynamic: .8,
      phaseCurveColor: `hsla(20, 99%, 80%, .5)`,
      curveColor: ({xpt}) => `hsla(20, 99%, 65%, ${transExp(1 - xpt)})`
    }]
    ampFx.setValue = (fx, key, value) => ({
      pan: _ => fx.setAt('panNode', 'pan', value),
      hi: _ => fx.setAt('hiNode', 'gain', value),
      lo: _ => fx.setAt('loNode', 'gain', value),
      hiCutOffFreq: _ => fx.setAt('hiNode', 'frequency', value),
      loCutOffFreq: _ => fx.setAt('loNode', 'frequency', value),
      vol: _ => fx.setAt('volNode', 'gain', dB2Gain(value))
    }[key])
    
    ampFx.construct = (fx, pars, {int} = fx) => {
      int.loNode = waCtx.createBiquadFilter()
      int.loNode.type = 'lowshelf'
      int.hiNode = waCtx.createBiquadFilter()
      int.hiNode.type = 'highshelf'
      int.panNode = waCtx.createStereoPanner()
      int.volNode = waCtx.createGain()
      connectArr(fx.start, int.volNode, int.panNode, int.hiNode, int.loNode, fx.output)
    }
    return ampFx
  }
  registerFxType('fx_amp', createAmpControl({name: 'Amp controls', subType: 'skipui'}))
  registerFxType('fx_ampExt', createAmpControl({name: 'Amp controls (extended)'}))
})
