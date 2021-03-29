/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {nop, isArr, getRnd, getRndFloat} = Corelib
const {wassert, weject} = Corelib.Debug
const {round, PI} = Math
const PI2 = 2 * PI

onWaapiReady.then(waCtx => {
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
    
    LFOFx.setValue = ({int}, key, value) => ({
      frequency: _ => {
        int._frequency = value
        int._phaseInc = PI2 * int._frequency * int.bufferSize / int.sampleRate
      },
      offset: _ => int._offset = value,
      oscillation: _ => {
        weject(Number.isNaN(value))
        int._oscillation = value
      },
      phase: _ => int._phase = value,
      masterFx: _ => int.masterState = value.int.state,
      target: _ => int._target = value,
      callback: _ => int.lfo.onaudioprocess = int.getCallbackPass(value)
    }[key])
    
    LFOFx.construct = (fx, {initial}) => {
      const {int} = fx
      
      int.bufferSize = 256    //: 256 is .005s, 512 is .012s, 16384 is .37s
      int.sampleRate = 44100
      
      int.lfo = waCtx.createScriptProcessor(256, 1, 1)
      
      int.getCallbackPass = callback => _ => {
        wassert(int.masterState.thisIsState)
        if (int.masterState.on) {
          int._phase += int._phaseInc
          int._phase %= PI2
          callback(int._target, int._offset + int._oscillation * Math.sin(int._phase))
        }
      }
    }
    //: chorusLFO doens't need this, but tremolo yes
    LFOFx.activate = ({int}, on) => on ? int.lfo.connect(waCtx.destination) : int.lfo.disconnect()
    //LFOFx.activate = (fx, on) => on ? fx.int.lfo.connect(fx.output) : fx.int.lfo.disconnect()

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
    
    tremoloLFOFx.setValue = ({int}, key, value) => ({
      intensity: _ => {
        int._intensity = value
        int.lfoL.setValue('offset', 1 - int._intensity / 2)
        int.lfoR.setValue('offset', 1 - int._intensity / 2)
        int.lfoL.setValue('oscillation', int._intensity)
        int.lfoR.setValue('oscillation', int._intensity)
      },
      stereoPhase: _ => {
        int._stereoPhase = value
        int.lfoR.setValue('phase', fmod(int.lfoL.int._phase + int._stereoPhase * PI / 180, PI2))
      },
      rate: _ => {
        int._rate = value
        int.lfoL.setValue('frequency', int._rate)
        int.lfoR.setValue('frequency', int._rate)
      }
    }[key])

    tremoloLFOFx.onActivated = (fx, on) => fx.int.state.on = on
    
    tremoloLFOFx.construct = (fx, {initial}) => {
      const {int} = fx
      
      int.state = {thisIsState: true}
      
      int.splitter = fx.start = waCtx.createChannelSplitter(2)
      int.amplitudeL = waCtx.createGain()
      int.amplitudeR = waCtx.createGain()
      int.merger = waCtx.createChannelMerger(2)
      int.lfoL = newFx('fx_LFO', {initial: {
        masterFx: fx,
        target: int.amplitudeL.gain,
        callback: (par, val) => par.value = val
      }})
      int.lfoR = newFx('fx_LFO', {initial: {
        masterFx: fx,
        target: int.amplitudeR.gain,
        callback: (par, val) => par.value = val
      }})

      connectArr(int.splitter, [int.amplitudeL, 0], [int.merger, 0, 0])
      connectArr(int.splitter, [int.amplitudeR, 1], [int.merger, 0, 1])
      int.merger.connect(fx.output)

      int.lfoL.setValue('offset', 1 - (initial.intensity / 2))
      int.lfoR.setValue('offset', 1 - (initial.intensity / 2))
      int.lfoL.setValue('phase', initial.stereoPhase * PI / 180)

      int.lfoL.activate(true)
      int.lfoR.activate(true)
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
    
    phaserLFOFx.setValue = (fx, key, value, {int} = fx) => ({
      rate: _ => {
        int._rate = value
        int.lfoL.setValue('frequency', int._rate)
        int.lfoR.setValue('frequency', int._rate)
      },
      depth: _ => {
        int._depth = value
        int.lfoL.setValue('oscillation', int._baseModulationFrequency * int._depth)
        int.lfoR.setValue('oscillation', int._baseModulationFrequency * int._depth)
      },
      feedback: _ => {
        int._feedback = value
        fx.setAt('feedbackL', 'gain', int._feedback)
        fx.setAt('feedbackR', 'gain', int._feedback)
      },
      baseModulationFrequency: _ => {
        int._baseModulationFrequency = value
        int.lfoL.setValue('offset', value)
        int.lfoR.setValue('offset', value)
        int.lfoL.setValue('oscillation', int._baseModulationFrequency * int._depth)
        int.lfoR.setValue('oscillation', int._baseModulationFrequency * int._depth)
      },
      stereoPhase: _ => {
        int._stereoPhase = value
        int.lfoR.setValue('phase', fmod(int.lfoL.int._phase + int._stereoPhase * PI / 180, PI2))
      }
    }[key])

    phaserLFOFx.onActivated = (fx, on) => fx.int.state.on = on
    
    phaserLFOFx.construct = (fx, {initial}) => {
      const {int} = fx
      
      int.state = {thisIsState: true}
      int.stage = 4
      int._depth = initial.depth
      int._baseModulationFrequency = initial.baseModulationFrequency
      
      int.splitter = fx.start = waCtx.createChannelSplitter(2)
      int.filtersL = []
      int.filtersR = []
      int.feedbackL = waCtx.createGain()
      int.feedbackR = waCtx.createGain()
      int.merger = waCtx.createChannelMerger(2)
      int.filteredSignal = waCtx.createGain()
      
      const callback = (filters, value) => {
        for (var stage = 0; stage < 4; stage++) {
          filters[stage].frequency.value = value
        }
      }
      int.lfoL = newFx('fx_LFO', {initial: {
        masterFx: fx,
        target: int.filtersL,
        callback
      }})
      int.lfoR = newFx('fx_LFO', {initial: {
        masterFx: fx,
        target: int.filtersR,
        callback
      }})
      
      for (let i = 0; i < int.stage; i++) {
        int.filtersL[i] = waCtx.createBiquadFilter()
        int.filtersR[i] = waCtx.createBiquadFilter()
        int.filtersL[i].type = 'allpass'
        int.filtersR[i].type = 'allpass'
      }
      fx.input.connect(int.splitter)
      fx.input.connect(fx.output)
      int.splitter.connect(int.filtersL[0], 0, 0)
      int.splitter.connect(int.filtersR[0], 1, 0)
      connectArr(...int.filtersL)
      connectArr(...int.filtersR)
      int.filtersL[int.stage - 1].connect(int.feedbackL)
      int.filtersL[int.stage - 1].connect(int.merger, 0, 0)
      int.filtersR[int.stage - 1].connect(int.feedbackR)
      int.filtersR[int.stage - 1].connect(int.merger, 0, 1)
      int.feedbackL.connect(int.filtersL[0])
      int.feedbackR.connect(int.filtersR[0])
      int.merger.connect(fx.output)

      int.lfoL.activate(true)
      int.lfoR.activate(true)
    }
    registerFxType('fx_phaserLFO', phaserLFOFx)
  }
  window.lfodebug = []
  window.lfostart = window.performance.now()
  
  createOscFxTypes()
})
