/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, WaapiWrap} from '../improxy-esm.js'

const {nop, isArr, getRnd, getRndFloat, clamp} = Corelib
const {wassert, weject} = Corelib.Debug
const {round, PI} = Math
const PI2 = 2 * PI

WaapiWrap.onRun(waCtx => {
  const {connectArr, registerFxType, newFx} = BeeFX(waCtx)

  const createEnvelopeFollowerFxTypes = _ => {
    //: no Fx dependencies
    
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
    
    envelopeFollowerFx.setValue = ({ext}, key, value) => ({
      attackTime: _ => {
        ext._attackTime = value / 1000
        ext._attackC = Math.exp(-1 / ext._attackTime * ext.sampleRate / ext.buffersize)
        weject(Number.isNaN(ext._attackC))
      },
      releaseTime: _ => {
        ext._releaseTime = value / 1000
        ext._releaseC = Math.exp(-1 / ext._releaseTime * ext.sampleRate / ext.buffersize)
        weject(Number.isNaN(ext._releaseC))
      },
      masterFx: _ => ext.masterState = value.ext.state,
      target: _ => ext._target = value,
      callback: _ => ext._callback = value // ext.lfo.onaudioprocess = ext.getCallbackPass(value)
    }[key])
    
    envelopeFollowerFx.construct = (fx, {initial}) => {
      const {ext} = fx
      
      ext.buffersize = 256    //: 256 is .005s, 512 is .012s, 16384 is .37s
      ext.envelope = 0
      ext._envelope = 0
      ext.sampleRate = 44100
      
      ext.jsNode = fx.output = waCtx.createScriptProcessor(ext.buffersize, 1, 1)
      fx.input.connect(fx.output)

      /* ext.getCallbackPass = callback => _ => {
        wassert(ext.masterState.thisIsState)
        if (ext.masterState.on) {
          ext._phase += ext._phaseInc
          ext._phase %= PI2
          callback(ext._target, ext._offset + ext._oscillation * Math.sin(ext._phase))
        }
      } */
      
      ext.compute = event => {
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

        if (ext._envelope < rms) {
          ext._envelope *= ext._attackC
          ext._envelope += (1 - ext._attackC) * rms
        } else {
          ext._envelope *= ext._releaseC
          ext._envelope += (1 - ext._releaseC) * rms
        }
        ext._callback(ext._envelope)
      }
    }
    envelopeFollowerFx.activate = ({ext}, on) => {
      if (on) {
        ext.jsNode.connect(waCtx.destination)
        ext.jsNode.onaudioprocess = ext.compute // ext.returnCompute(this)
      } else {
        ext.jsNode.disconnect()
        ext.jsNode.onaudioprocess = null
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
      name: 'Wah-Wah (EF)'
    }
    
    wahWahEFFx.setValue = (fx, key, value, {ext} = fx) => ({
      automode: _ => {
        ext._automode = value
        if (value) {
          fx.start.connect(ext.envelopeFollower.input)
          ext.envelopeFollower.activate(true)
        } else {
          ext.envelopeFollower.activate(false)
          fx.start.disconnect()
          fx.start.connect(ext.filterBp)
        }
      },
      baseFrequency: _ => {
        ext._baseFreq = 50 * Math.pow(10, value * 2)
        ext._excursionFreq = Math.min(ext.sampleRate / 2, ext._baseFreq * Math.pow(2, ext._excursionOctaves))
        weject(Number.isNaN(ext._excursionFreq))
        ext.setFilterFreq()
      },
      excursionOctaves: _ => {
        ext._excursionOctaves = value
        ext._excursionFreq = Math.min(ext.sampleRate / 2, ext._baseFreq * Math.pow(2, ext._excursionOctaves))
        weject(Number.isNaN(ext._excursionFreq))
        ext.setFilterFreq()
      },
      sweep: _ => {
        ext._sweep = Math.pow(clamp(value, 0, 1), ext._sensitivity)
        window.envdebug.push({at: window.performance.now(), msg: 'sweep: ' + ext._sweep})
        ext.setFilterFreq()
      },
      resonance: _ => {
        ext.filterPeaking.Q.value = ext._resonance = value
      },
      sensitivity: _ => {
        ext._sensitivity = Math.pow(10, value)
      }
    }[key])

    wahWahEFFx.onActivated = (fx, on) => fx.ext.state.on = on
    
    wahWahEFFx.construct = (fx, {initial}) => {
      const {ext} = fx
      
      ext.state = {thisIsState: true}
      ext.filterFreqTimeout = 0
      ext.sampleRate = 44100
      ext._excursionOctaves = initial.excursionOctaves
      ext._baseFreq = initial.baseFrequency
      ext._sensitivity = initial.sensitivity
      ext._sweep = initial.sweep
      
      ext.setFilterFreq = _ => {
        let freq
        try {
          freq = Math.min(22050, ext._baseFreq + ext._excursionFreq * ext._sweep)
          weject(Number.isNaN(freq))
          ext.filterBp.frequency.value = freq
          ext.filterPeaking.frequency.value = freq
        } catch (err) {
          console.err('setfiltfreq', err)
          clearTimeout(ext.filterFreqTimeout)
          //put on the next cycle to let all init properties be set
          ext.filterFreqTimeout = setTimeout(ext.setFilterFeq, 0)
        }
        window.envdebug.push({at: window.performance.now(), msg: 'freq: ' + freq})
      }
      
      ext.envelopeFollower = newFx('fx_envelopeFollower', {initial: {
        masterFx: fx,
        target: ext,
        callback: (value) => fx.setValueIf('sweep', value)
      }})
      
      ext.filterBp = waCtx.createBiquadFilter()
      ext.filterBp.type = 'bandpass'
      ext.filterBp.frequency.value = 100
      ext.filterBp.Q.value = 1
      
      ext.filterPeaking = waCtx.createBiquadFilter()
      ext.filterPeaking.type = 'peaking'
      ext.filterPeaking.frequency.value = 100
      ext.filterPeaking.gain.value = 20
      ext.filterPeaking.Q.value = 5
      
      //Connect AudioNodes
      connectArr(fx.start, ext.filterBp, ext.filterPeaking, fx.output)

      //Set Properties
      fx.output.gain.value = 1
      fx.start.gain.value = 2
      ext.envelopeFollower.activate(true)
    }

    registerFxType('fx_wahWahEF', wahWahEFFx)
  }
  window.envdebug = []
  window.lfostart = window.performance.now()
  
  createEnvelopeFollowerFxTypes()
})
