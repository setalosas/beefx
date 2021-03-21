/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, WaapiWrap} from '../improxy-esm.js'

const {nop, isArr, getRnd, getRndFloat} = Corelib
const {wassert} = Corelib.Debug
const {createPerfTimer, startEndThrottle, post} = Corelib.Tardis
const {max, pow, round} = Math

WaapiWrap.onRun(waCtx => {
  const {registerFxType, newFx, connectArr} = BeeFX(waCtx)

  const compressorFx = {//8#9a4 ----- Compressor (Tuna) -----
    def: {
      threshold: {defVal: -20, min: -60, max: 0}, //, subType: 'decibel'}, //decibel
      knee: {defVal: 5, min: 0, max: 40}, //, subType: 'decibel'}, //decibel
      attack: {defVal: 10, min: 0, max: 1000},
      release: {defVal: 250, min: 10, max: 1000},
      ratio: {defVal: 4, min: 1, max: 20, subType: 'exp'},
      makeupGain: {defVal: 1, min: 1, max: 10},//, subType: 'decibel'},
      autoMakeup: {defVal: false, type: 'boolean'}
    },
    customGraph: [{
      custom: 'compressor'
    }]
  }
  
  const dbToWAVolume = db => max(0, round(100 * pow(2, db / 6)) / 100)

  compressorFx.setValue = (fx, key, value, {ext} = fx) => ({
    threshold: _ => {
      ext.compNode.threshold.value = value
      ext.computeMakeupGain()
    },
    knee: _ => {
      ext.compNode.knee.value = value
      ext.computeMakeupGain()
    },
    attack: _ => ext.compNode.attack.value = value / 1000,
    release: _ => ext.compNode.release.value = value / 1000,
    ratio: _ => {
      ext.compNode.ratio.value = value
      ext.computeMakeupGain()
    },
    makeupGain: _ => {
      fx.setAt('makeupNode', 'gain', dbToWAVolume(value))
      ext.computingOn || fx.setValue('autoMakeup', false)
    },
    autoMakeup: _ => {
      //fx.setValue(key, value)
      //ext.autoMakeup = value
      post(_ => ext.computeMakeupGain())
    }
  }[key])
  
  compressorFx.construct = (fx, {initial}, {ext} = fx) => {
    ext.compNode = fx.start = waCtx.createDynamicsCompressor()
    ext.makeupNode = waCtx.createGain()

    ext.compNode.connect(ext.makeupNode)
    ext.makeupNode.connect(fx.output)
    
    ext.computeMakeupGain = _ => {
      wassert(!ext.computingOn)
      console.log(`attack=${round(fx.live.attack)}ms release = ${fx.live.release}ms threshold = ${round(fx.live.threshold)}dB knee=${round(fx.live.knee)}dB ratio=1:${round(fx.live.ratio)} makeupGain=${fx.live.makeupGain}dB`)
      const {threshold, autoMakeup, ratio} = fx.live
      if (autoMakeup) {
        const magicCoeff = 4 //: raise if the output is too hot
        ext.computingOn = true
        fx.setValue('makeupGain', -(threshold - threshold / ratio) / magicCoeff)
        ext.computingOn = false
      }
    }

    //don't use makeupGain setter at initialization to avoid smoothing
    /*if (initial.this.automakeup) {
        this.makeupNode.gain.value = dbToWAVolume(this.computeMakeup());
    } else {
        this.makeupNode.gain.value = dbToWAVolume(initValue(properties.makeupGain, this.defaults.makeupGain.value));
    }*/
  }

  registerFxType('fx_compressor', compressorFx)
})
