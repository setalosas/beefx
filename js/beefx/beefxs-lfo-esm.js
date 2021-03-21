/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, WaapiWrap} from '../improxy-esm.js'

const {nop, isArr, getRnd, getRndFloat} = Corelib
const {wassert, weject} = Corelib.Debug
const {round, PI} = Math
const PI2 = 2 * PI

WaapiWrap.onRun(waCtx => {
  const {connectArr, registerFxType, newFx} = BeeFX(waCtx)

  const createOscFxTypes = _ => {
    //: no Fx dependencies
    
    const LFOFx = { //8#04c ------- LFO (Tuna) -------
      def: {
        frequency: {defVal: 1, min: 0.1, max: 20, subType: 'exp'},
        offset: {defVal: .85, min: 0, max: 22049, subType: 'exp'},
        oscillation: {defVal: .3, min: -22050, max: 22050},
        phase: {defVal: 0, min: 0, max: PI2},
        masterFx: {defVal: {}},
        target: {defVal: {}, subType: 'skipui'},
        callback: {defVal: nop, subType: 'skipui'}
      },
      uiSelectDisabled: true
    }
    
    LFOFx.setValue = ({ext}, key, value) => ({
      frequency: _ => {
        ext._frequency = value
        ext._phaseInc = PI2 * ext._frequency * ext.bufferSize / ext.sampleRate
      },
      offset: _ => ext._offset = value,
      oscillation: _ => {
        weject(Number.isNaN(value))
        ext._oscillation = value
      },
      phase: _ => ext._phase = value,
      masterFx: _ => ext.masterState = value.ext.state,
      target: _ => ext._target = value,
      callback: _ => ext.lfo.onaudioprocess = ext.getCallbackPass(value)
    }[key])
    
    LFOFx.construct = (fx, {initial}) => {
      const {ext} = fx
      
      ext.bufferSize = 256    //: 256 is .005s, 512 is .012s, 16384 is .37s
      ext.sampleRate = 44100
      
      ext.lfo = waCtx.createScriptProcessor(256, 1, 1)
      
      ext.getCallbackPass = callback => _ => {
        wassert(ext.masterState.thisIsState)
        if (ext.masterState.on) {
          ext._phase += ext._phaseInc
          ext._phase %= PI2
          callback(ext._target, ext._offset + ext._oscillation * Math.sin(ext._phase))
        }
      }
    }
    //: chorusLFO doens't need this, but tremolo yes
    LFOFx.activate = ({ext}, on) => on ? ext.lfo.connect(waCtx.destination) : ext.lfo.disconnect()
    //LFOFx.activate = (fx, on) => on ? fx.ext.lfo.connect(fx.output) : fx.ext.lfo.disconnect()

    registerFxType('fx_LFO', LFOFx)
    
    const fmod = (x, y) => {
      // http://kevin.vanzonneveld.net
      // *     example 1: fmod(5.7, 1.3);
      // *     returns 1: 0.5
      const tmpa = x.toExponential().match(/^.\.?(.*)e(.+)$/)
      const pa = parseInt(tmpa[2], 10) - (tmpa[1] + "").length
      const tmpb = y.toExponential().match(/^.\.?(.*)e(.+)$/)
      const pb = parseInt(tmpb[2], 10) - (tmpb[1] + "").length
      const p = Math.min(pa, pb)
      const mod = (x % y)

      if (p < -100 || p > 20) {
        // toFixed will give an out of bound error so we fix it like this:
        const l = Math.round(Math.log(mod) / Math.log(10))
        const l2 = Math.pow(10, l)
        return (mod / l2).toFixed(l - p) * l2
      } else {
        return parseFloat(mod.toFixed(-p))
      }
    }
    const tremoloLFOFx = { //8#a6e ---------- tremoloLFO (Tuna) ----------
      def: {
        intensity: {defVal: .3, min: 0, max: 1},
        stereoPhase: {defVal: 0, min: 0, max: 180},
        rate: {defVal: 5, min: 0.1, max: 11}
      },
      name: 'Tremolo (LFO)'
    }
    
    tremoloLFOFx.setValue = ({ext}, key, value) => ({
      intensity: _ => {
        ext._intensity = value
        ext.lfoL.setValue('offset', 1 - ext._intensity / 2)
        ext.lfoR.setValue('offset', 1 - ext._intensity / 2)
        ext.lfoL.setValue('oscillation', ext._intensity)
        ext.lfoR.setValue('oscillation', ext._intensity)
      },
      stereoPhase: _ => {
        ext._stereoPhase = value
        ext.lfoR.setValue('phase', fmod(ext.lfoL.ext._phase + ext._stereoPhase * PI / 180, PI2))
      },
      rate: _ => {
        ext._rate = value
        ext.lfoL.setValue('frequency', ext._rate)
        ext.lfoR.setValue('frequency', ext._rate)
      }
    }[key])

    tremoloLFOFx.onActivated = (fx, on) => fx.ext.state.on = on
    
    tremoloLFOFx.construct = (fx, {initial}) => {
      const {ext} = fx
      
      ext.state = {thisIsState: true}
      
      ext.splitter = fx.start = waCtx.createChannelSplitter(2)
      ext.amplitudeL = waCtx.createGain()
      ext.amplitudeR = waCtx.createGain()
      ext.merger = waCtx.createChannelMerger(2)
      ext.lfoL = newFx('fx_LFO', {initial: {
        masterFx: fx,
        target: ext.amplitudeL.gain,
        callback: (par, val) => par.value = val
      }})
      ext.lfoR = newFx('fx_LFO', {initial: {
        masterFx: fx,
        target: ext.amplitudeR.gain,
        callback: (par, val) => par.value = val
      }})

      connectArr(ext.splitter, [ext.amplitudeL, 0], [ext.merger, 0, 0])
      connectArr(ext.splitter, [ext.amplitudeR, 1], [ext.merger, 0, 1])
      ext.merger.connect(fx.output)

      ext.lfoL.setValue('offset', 1 - (initial.intensity / 2))
      ext.lfoR.setValue('offset', 1 - (initial.intensity / 2))
      ext.lfoL.setValue('phase', initial.stereoPhase * PI / 180)

      ext.lfoL.activate(true)
      ext.lfoR.activate(true)
    }
    registerFxType('fx_tremoloLFO', tremoloLFOFx)
    
    const phaserLFOFx = { //8#a77 ---------- phaserLFO (Tuna) ----------
      def: {
        rate: {defVal: .1, min: 0, max: 8},
        depth: {defVal: .6, min: 0, max: 1},
        feedback: {defVal: .6, min: 0, max: 1},
        baseModulationFrequency: {defVal: 700, min: 500, max: 1500},
        stereoPhase: {defVal: 40, min: 0, max: 180}
      },
      name: 'Phaser (LFO)'
    }
    
    phaserLFOFx.setValue = (fx, key, value, {ext} = fx) => ({
      rate: _ => {
        ext._rate = value
        ext.lfoL.setValue('frequency', ext._rate)
        ext.lfoR.setValue('frequency', ext._rate)
      },
      depth: _ => {
        ext._depth = value
        ext.lfoL.setValue('oscillation', ext._baseModulationFrequency * ext._depth)
        ext.lfoR.setValue('oscillation', ext._baseModulationFrequency * ext._depth)
      },
      feedback: _ => {
        ext._feedback = value
        fx.setAt('feedbackL', 'gain', ext._feedback)
        fx.setAt('feedbackR', 'gain', ext._feedback)
      },
      baseModulationFrequency: _ => {
        ext._baseModulationFrequency = value
        ext.lfoL.setValue('offset', value)
        ext.lfoR.setValue('offset', value)
        ext.lfoL.setValue('oscillation', ext._baseModulationFrequency * ext._depth)
        ext.lfoR.setValue('oscillation', ext._baseModulationFrequency * ext._depth)
      },
      stereoPhase: _ => {
        ext._stereoPhase = value
        ext.lfoR.setValue('phase', fmod(ext.lfoL.ext._phase + ext._stereoPhase * PI / 180, PI2))
      }
    }[key])

    phaserLFOFx.onActivated = (fx, on) => fx.ext.state.on = on
    
    phaserLFOFx.construct = (fx, {initial}) => {
      const {ext} = fx
      
      ext.state = {thisIsState: true}
      ext.stage = 4
      ext._depth = initial.depth
      ext._baseModulationFrequency = initial.baseModulationFrequency
      
      ext.splitter = fx.start = waCtx.createChannelSplitter(2)
      ext.filtersL = []
      ext.filtersR = []
      ext.feedbackL = waCtx.createGain()
      ext.feedbackR = waCtx.createGain()
      ext.merger = waCtx.createChannelMerger(2)
      ext.filteredSignal = waCtx.createGain()
      
      const callback = (filters, value) => {
        for (var stage = 0; stage < 4; stage++) {
          filters[stage].frequency.value = value
        }
      }
      ext.lfoL = newFx('fx_LFO', {initial: {
        masterFx: fx,
        target: ext.filtersL,
        callback
      }})
      ext.lfoR = newFx('fx_LFO', {initial: {
        masterFx: fx,
        target: ext.filtersR,
        callback
      }})
      
      for (let i = 0; i < ext.stage; i++) {
        ext.filtersL[i] = waCtx.createBiquadFilter()
        ext.filtersR[i] = waCtx.createBiquadFilter()
        ext.filtersL[i].type = 'allpass'
        ext.filtersR[i].type = 'allpass'
      }
      fx.input.connect(ext.splitter)
      fx.input.connect(fx.output)
      ext.splitter.connect(ext.filtersL[0], 0, 0)
      ext.splitter.connect(ext.filtersR[0], 1, 0)
      connectArr(...ext.filtersL)
      connectArr(...ext.filtersR)
      ext.filtersL[ext.stage - 1].connect(ext.feedbackL)
      ext.filtersL[ext.stage - 1].connect(ext.merger, 0, 0)
      ext.filtersR[ext.stage - 1].connect(ext.feedbackR)
      ext.filtersR[ext.stage - 1].connect(ext.merger, 0, 1)
      ext.feedbackL.connect(ext.filtersL[0])
      ext.feedbackR.connect(ext.filtersR[0])
      ext.merger.connect(fx.output)

      ext.lfoL.activate(true)
      ext.lfoR.activate(true)
    }
    registerFxType('fx_phaserLFO', phaserLFOFx)
  }
  window.lfodebug = []
  window.lfostart = window.performance.now()
  
  createOscFxTypes()
})
