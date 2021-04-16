/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

onWaapiReady.then(waCtx => {
  const {connectArr, registerFxType, newFx} = BeeFX(waCtx)

  const createChorusFxTypes = _ => {
    //: fx dependencies: LFO  
    
    const chorusLFOFx = { //8#a6e ---------- chorusLFO (Tuna) ----------
      def: {
        feedback: {defVal: .4, min: 0, max: .95},
        delay: {defVal: 4.5, min: 0.01, max: 1000, subType: 'exp', unit: 'ms'}, // 1000
        depth: {defVal: .7, min: 0, max: 1},
        rate: {defVal: 1.5, min: 0, max: 8}
      },
      midi: {pars: ['feedback,delay,depth', 'rate']},
      name: 'Chorus (LFO)'
    }
    
    chorusLFOFx.setValue = (fx, key, value) => ({//+ebbol lehetne ketcsatorenas verzio is...
      delay: _ => {
        fx.int._delay = 0.0002 * (Math.pow(10, value / 1000) * 2)
        fx.int.lfoL.setValue('offset', fx.int._delay)
        fx.int.lfoR.setValue('offset',  fx.int._delay)
      },
      depth: _ => {
        fx.int._depth = value
        fx.int.lfoL.setValue('oscillation', fx.int._depth * fx.int._delay)
        fx.int.lfoR.setValue('oscillation', fx.int._depth * fx.int._delay)
      },
      feedback: _ => {
        fx.int._feedback = value
        fx.setAt('feedbackLR', 'gain', fx.int._feedback)
        fx.setAt('feedbackRL', 'gain', fx.int._feedback)
      },
      rate: _ => {
        fx.int._rate = value
        fx.int.lfoL.setValue('frequency', fx.int._rate)
        fx.int.lfoR.setValue('frequency', fx.int._rate)
      }
    }[key])

    chorusLFOFx.onActivated = (fx, on) => fx.int.state.on = on
    
    chorusLFOFx.construct = (fx, {initial}) => {
      const {int} = fx
      
      int.state = {thisIsState: true}
      
      int.attenuator = waCtx.createGain()
      int.attenuator.gain.value = 0.6934 // 1 / (10 ^ (((20 * log10(3)) / 3) / 20))
      fx.start = int.attenuator
      
      int.splitter = waCtx.createChannelSplitter(2)
      int.delayL = waCtx.createDelay(2)
      int.delayR = waCtx.createDelay(2)
      int.feedbackLR = waCtx.createGain()
      int.feedbackRL = waCtx.createGain()
      int.merger = waCtx.createChannelMerger(2)

      int.lfoL = newFx('fx_LFO', {initial: {
        masterFx: fx,
        target: int.delayL.delayTime,
        callback: (par, val) => par.value = val || 0 //: protects against NaNs
      }})
      int.lfoR = newFx('fx_LFO', {initial: {
        masterFx: fx,
        target: int.delayR.delayTime,
        callback: (par, val) => par.value = val || 0
      }})

      int.attenuator.connect(fx.output)
      int.attenuator.connect(int.splitter)
      connectArr(int.splitter, [int.delayL, 0], int.feedbackLR, int.delayR, [int.merger, 0, 1])
      connectArr(int.splitter, [int.delayR, 1], int.feedbackRL, int.delayL, [int.merger, 0, 0])
      int.merger.connect(fx.output)

      int.lfoR.setValue('phase', Math.PI / 2)
      int.lfoL.activate(true)
      int.lfoR.activate(true)
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
      const {int} = fx
      
      int.delayNode = waCtx.createDelay(2)

      int.osc = waCtx.createOscillator()
      int.osc.type = 'sine'

      int.gain = waCtx.createGain()

      connectArr(int.osc, int.gain, int.delayNode.delayTime)
      connectArr(fx.start, int.delayNode, fx.output)
      fx.start.connect(fx.output)

      int.osc.start(0)
    }
    chorusOscFx.setValue = (fx, key, value) => ({
      delay: _ => fx.setDelayTime('delayNode', value / 1000),
      depth: _ => fx.setAt('gain', 'gain', value / 1000),
      speed: _ => fx.setAt('osc', 'frequency', value)
    }[key])

    registerFxType('fx_chorusOsc', chorusOscFx)
  }
  
  createChorusFxTypes()
})
