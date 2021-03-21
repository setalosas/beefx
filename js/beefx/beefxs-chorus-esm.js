/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, WaapiWrap} from '../improxy-esm.js'

WaapiWrap.onRun(waCtx => {
  const {connectArr, registerFxType, newFx} = BeeFX(waCtx)

  const createChorusFxTypes = _ => {
    //: fx dependencies: LFO  
    
    const chorusLFOFx = { //8#a6e ---------- chorusLFO (Tuna) ----------
      def: {
        feedback: {defVal: .4, min: 0, max: .95},
        delay: {defVal: 4.5, min: 0, max: 1000, subType: 'exp'}, // 1000
        depth: {defVal: .7, min: 0, max: 1},
        rate: {defVal: 1.5, min: 0, max: 8}
      },
      name: 'Chorus (LFO)'
    }
    
    chorusLFOFx.setValue = (fx, key, value) => ({//+ebbol lehetne ketcsatorenas verzio is...
      delay: _ => {
        fx.ext._delay = 0.0002 * (Math.pow(10, value / 1000) * 2)
        fx.ext.lfoL.setValue('offset', fx.ext._delay)
        fx.ext.lfoR.setValue('offset',  fx.ext._delay)
      },
      depth: _ => {
        fx.ext._depth = value
        fx.ext.lfoL.setValue('oscillation', fx.ext._depth * fx.ext._delay)
        fx.ext.lfoR.setValue('oscillation', fx.ext._depth * fx.ext._delay)
      },
      feedback: _ => {
        fx.ext._feedback = value
        fx.setAt('feedbackLR', 'gain', fx.ext._feedback)
        fx.setAt('feedbackRL', 'gain', fx.ext._feedback)
      },
      rate: _ => {
        fx.ext._rate = value
        fx.ext.lfoL.setValue('frequency', fx.ext._rate)
        fx.ext.lfoR.setValue('frequency', fx.ext._rate)
      }
    }[key])

    chorusLFOFx.onActivated = (fx, on) => fx.ext.state.on = on
    
    chorusLFOFx.construct = (fx, {initial}) => {
      const {ext} = fx
      
      ext.state = {thisIsState: true}
      
      ext.attenuator = waCtx.createGain()
      ext.attenuator.gain.value = 0.6934 // 1 / (10 ^ (((20 * log10(3)) / 3) / 20))
      fx.start = ext.attenuator
      
      ext.splitter = waCtx.createChannelSplitter(2)
      ext.delayL = waCtx.createDelay()
      ext.delayR = waCtx.createDelay()
      ext.feedbackLR = waCtx.createGain()
      ext.feedbackRL = waCtx.createGain()
      ext.merger = waCtx.createChannelMerger(2)

      ext.lfoL = newFx('fx_LFO', {initial: {
        masterFx: fx,
        target: ext.delayL.delayTime,
        callback: (par, val) => par.value = val
      }})
      ext.lfoR = newFx('fx_LFO', {initial: {
        masterFx: fx,
        target: ext.delayR.delayTime,
        callback: (par, val) => par.value = val
      }})

      ext.attenuator.connect(fx.output)
      ext.attenuator.connect(ext.splitter)
      connectArr(ext.splitter, [ext.delayL, 0], ext.feedbackLR, ext.delayR, [ext.merger, 0, 1])
      connectArr(ext.splitter, [ext.delayR, 1], ext.feedbackRL, ext.delayL, [ext.merger, 0, 0])
      ext.merger.connect(fx.output)

      ext.lfoR.setValue('phase', Math.PI / 2)
      ext.lfoL.activate(true)
      ext.lfoR.activate(true)
    }
    registerFxType('fx_chorusLFO', chorusLFOFx)
    
    const chorusOscFx = { //8#b6b ---------- chorusOsc (Chris Wilson) ----------
      def: {
        delay: {defVal: 30, min: 5, max: 55},
        depth: {defVal: 2, min: .5, max: 4.0},
        speed: {defVal: 3.5, min: .5, max: 15}
      },
      name: 'Chorus (oscillator)'
    }
    chorusOscFx.construct = (fx, {initial}) => {
      const {ext} = fx
      
      ext.delayNode = waCtx.createDelay()

      ext.osc = waCtx.createOscillator()
      ext.osc.type = 'sine'

      ext.gain = waCtx.createGain()

      connectArr(ext.osc, ext.gain, ext.delayNode.delayTime)
      connectArr(fx.start, ext.delayNode, fx.output)
      fx.start.connect(fx.output)

      ext.osc.start(0)
    }
    chorusOscFx.setValue = (fx, key, value) => ({
      delay: _ => fx.setAt('delayNode', 'delayTime', value / 1000),
      depth: _ => fx.setAt('gain', 'gain', value / 1000),
      speed: _ => fx.setAt('osc', 'frequency', value)
    }[key])

    registerFxType('fx_chorusOsc', chorusOscFx)
  }
  
  createChorusFxTypes()
})
