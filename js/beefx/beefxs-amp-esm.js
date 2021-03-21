/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, WaapiWrap} from '../improxy-esm.js'

const {nop, no, yes, isArr, getRnd, getRndFloat} = Corelib
const {wassert} = Corelib.Debug

WaapiWrap.onRun(waCtx => {
  const {connectArr, registerFxType, newFx} = BeeFX(waCtx)
  
  const createAmpFilter = ({subType = 'skipui', name}) => {
    //
    const ampFx = { //8#48d ------- ampFilter -------
      def: {
        hi: {defVal: 0, min: -25, max: 25},
        hiCutOffFreq: {defVal: 2400, min: 800, max: 4800, subType}, //:exp/skipui
        lo: {defVal: 0, min: -25, max: 25},
        loCutOffFreq: {defVal: 600, min: 200, max: 1200, subType}, //:exp/skipui
        pan: {defVal: 0, min: -.5, max: .5},
        vol: {defVal: 1, min: 0, max: 1.2}
      },
      name,
      freqGraph: [
        {filter: 'loNode', ix: 0, dbScaleFactor: 2},
        {filter: 'hiNode', ix: 1, dbScaleFactor: 2}
      ]
    }
    ampFx.setValue = (fx, key, value, {ext} = fx) => ({
      pan: _ => fx.setAt('panNode', 'pan', value),
      hi: _ => fx.setAt('hiNode', 'gain', value),
      lo: _ => fx.setAt('loNode', 'gain', value),
      hiCutOffFreq: _ => fx.setAt('hiNode', 'frequency', value),
      loCutOffFreq: _ => fx.setAt('loNode', 'frequency', value),
      vol: _ => fx.setAt('volNode', 'gain', value)
    }[key])
    
      ampFx.construct = (fx, pars, {ext} = fx) => {
      ext.loNode = waCtx.createBiquadFilter()
      //ext.loNode.Q.value = 2 //initial.q NOT USED in lowshelf
      ext.loNode.type = 'lowshelf'
      
      ext.hiNode = waCtx.createBiquadFilter()
      //ext.hiNode.Q.value = 2 // initial.q NOT USED in highshelf
      ext.hiNode.type = 'highshelf'
      
      ext.panNode = waCtx.createStereoPanner()
      ext.volNode = waCtx.createGain()
      connectArr(fx.start, ext.volNode, ext.panNode, ext.hiNode, ext.loNode, fx.output)
    }
    
    return ampFx
  }
  const ampFx = createAmpFilter({name: 'Amp controls'})
  registerFxType('fx_amp', ampFx)
  const ampExtFx = createAmpFilter({name: 'Amp controls extended', subType: 'ext'})
  registerFxType('fx_ampext', ampExtFx)

  const timerFx = {
     // : startmuting mutinglength / decay decaylen
     //play stop mute (with length)
  }
})
