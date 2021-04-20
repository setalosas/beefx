/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {nop, clamp} = Corelib
const {weject} = Corelib.Debug

onWaapiReady.then(waCtx => {
  const {connectArr, registerFxType, newFx} = BeeFX(waCtx)

  const envelopeFollowerFx = { //8#04c ------- envelopeFollower (Tuna) -------
    def: {
      attackTime: {defVal: 3, min: 0, max: 5000}, // /1000
      releaseTime: {defVal: 500, min: 0, max: 500}, // /1000
      masterFx: {defVal: {}},
      target: {defVal: {}, subType: 'skipui'},
      callback: {defVal: nop, subType: 'skipui'}
    },
    uiSelectDisabled: true
  }
  
  envelopeFollowerFx.setValue = ({int}, key, value) => ({
    attackTime: _ => {
      int._attackTime = value / 1000
      int._attackC = Math.exp(-1 / int._attackTime * int.sampleRate / int.buffersize)
      weject(Number.isNaN(int._attackC))
    },
    releaseTime: _ => {
      int._releaseTime = value / 1000
      int._releaseC = Math.exp(-1 / int._releaseTime * int.sampleRate / int.buffersize)
      weject(Number.isNaN(int._releaseC))
    },
    masterFx: _ => int.masterState = value.int.state,
    target: _ => int._target = value,
    callback: _ => int._callback = value // int.lfo.onaudioprocess = int.getCallbackPass(value)
  }[key])
  
  envelopeFollowerFx.construct = (fx, {initial}) => {
    const {int} = fx
    
    int.buffersize = 256    //: 256 is .005s, 512 is .012s, 16384 is .37s
    int.envelope = 0
    int._envelope = 0
    int.sampleRate = 44100
    
    int.jsNode = fx.output = waCtx.createScriptProcessor(int.buffersize, 1, 1)
    fx.input.connect(fx.output)

    /* int.getCallbackPass = callback => _ => {
      wassert(int.masterState.thisIsState)
      if (int.masterState.on) {
        int._phase += int._phaseInc
        int._phase %= PI2
        callback(int._target, int._offset + int._oscillation * Math.sin(int._phase))
      }
    } */
    
    int.compute = event => {
      const count = event.inputBuffer.getChannelData(0).length
      const channels = event.inputBuffer.numberOfChannels
      
      let current
      let chan = 0
      let rms = 0
      
      if (channels > 1) { //need to mixdown
        for (let i = 0; i < count; ++i) {
          for (; chan < channels; ++chan) {
            current = event.inputBuffer.getChannelData(chan)[i]
            rms += (current * current) / channels
          }
        }
      } else {
        for (let i = 0; i < count; ++i) {
          current = event.inputBuffer.getChannelData(0)[i]
          rms += (current * current)
        }
      }
      rms = Math.sqrt(rms)

      if (int._envelope < rms) {
        int._envelope *= int._attackC
        int._envelope += (1 - int._attackC) * rms
      } else {
        int._envelope *= int._releaseC
        int._envelope += (1 - int._releaseC) * rms
      }
      int._callback(int._envelope)
    }
  }
  envelopeFollowerFx.activate = ({int}, on) => {
    if (on) {
      int.jsNode.connect(waCtx.destination)
      int.jsNode.onaudioprocess = int.compute // int.returnCompute(this)
    } else {
      int.jsNode.disconnect()
      int.jsNode.onaudioprocess = null
    }
  }
  registerFxType('fx_envelopeFollower', envelopeFollowerFx)
  
  const wahWahEFFx = { //8#a6e ---------- wahWahEF (Tuna) ----------
    def: {
      automode: {defVal: true, type: 'boolean'},
      baseFrequency: {defVal: .5, min: 0, max: 1},
      excursionOctaves: {defVal: 2, min: 1, max: 6},
      sweep: {defVal: .2, min: 0, max: 10},
      resonance: {defVal: 10, min: 1, max: 100},
      sensitivity: {defVal: .5, min: -1, max: 1}
    },
    midi: {pars: ['baseFrequency,excursionOctaves', 'sweep,resonance,sensitivity']},
    name: 'Wah-Wah (EF)'
  }
  
  wahWahEFFx.setValue = (fx, key, value, {int} = fx) => ({
    automode: _ => {
      int._automode = value
      if (value) {
        fx.start.connect(int.envelopeFollower.input)
        int.envelopeFollower.activate(true)
      } else {
        int.envelopeFollower.activate(false)
        fx.start.disconnect()
        fx.start.connect(int.filterBp)
      }
    },
    baseFrequency: _ => {
      int._baseFreq = 50 * Math.pow(10, value * 2)
      int._excursionFreq = Math.min(int.sampleRate / 2, int._baseFreq * Math.pow(2, int._excursionOctaves))
      weject(Number.isNaN(int._excursionFreq))
      int.setFilterFreq()
    },
    excursionOctaves: _ => {
      int._excursionOctaves = value
      int._excursionFreq = Math.min(int.sampleRate / 2, int._baseFreq * Math.pow(2, int._excursionOctaves))
      weject(Number.isNaN(int._excursionFreq))
      int.setFilterFreq()
    },
    sweep: _ => {
      int._sweep = Math.pow(clamp(value, 0, 1), int._sensitivity)
      //window.envdebug.push({at: window.performance.now(), msg: 'sweep: ' + int._sweep})
      int.setFilterFreq()
    },
    resonance: _ => {
      int.filterPeaking.Q.value = int._resonance = value
    },
    sensitivity: _ => {
      int._sensitivity = Math.pow(10, value)
    }
  }[key])

  wahWahEFFx.onActivated = (fx, on) => fx.int.state.on = on
  
  wahWahEFFx.construct = (fx, {initial}) => {
    const {int} = fx
    
    int.state = {thisIsState: true}
    int.filterFreqTimeout = 0
    int.sampleRate = 44100
    int._excursionOctaves = initial.excursionOctaves
    int._baseFreq = initial.baseFrequency
    int._sensitivity = initial.sensitivity
    int._sweep = initial.sweep
    
    int.setFilterFreq = _ => {
      let freq
      try {
        freq = Math.min(22050, int._baseFreq + int._excursionFreq * int._sweep)
        weject(Number.isNaN(freq))
        int.filterBp.frequency.value = freq
        int.filterPeaking.frequency.value = freq
      } catch (err) {
        console.err('setfiltfreq', err)
        clearTimeout(int.filterFreqTimeout)
        //put on the next cycle to let all init properties be set
        int.filterFreqTimeout = setTimeout(int.setFilterFeq, 0)
      }
      //window.envdebug.push({at: window.performance.now(), msg: 'freq: ' + freq})
    }
    
    int.envelopeFollower = newFx('fx_envelopeFollower', {initial: {
      masterFx: fx,
      target: int,
      callback: (value) => fx.setValueIf('sweep', value)
    }})
    
    int.filterBp = waCtx.createBiquadFilter()
    int.filterBp.type = 'bandpass'
    int.filterBp.frequency.value = 100
    int.filterBp.Q.value = 1
    
    int.filterPeaking = waCtx.createBiquadFilter()
    int.filterPeaking.type = 'peaking'
    int.filterPeaking.frequency.value = 100
    int.filterPeaking.gain.value = 20
    int.filterPeaking.Q.value = 5
    
    connectArr(fx.start, int.filterBp, int.filterPeaking, fx.output)

    fx.output.gain.value = 1
    fx.start.gain.value = 2
    int.envelopeFollower.activate(true)
  }
  registerFxType('fx_wahWahEF', wahWahEFFx)
})
