/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {nop, isArr, getRnd, getRndFloat} = Corelib
const {wassert} = Corelib.Debug
const {round, PI} = Math
const PI2 = 2 * PI

onWaapiReady.then(waCtx => {
  const {registerFxType, newFx} = BeeFX(waCtx)

  const createOscFxTypes = _ => {
    const moog2Fx = { //8#c6c ------- moog2 (Chris Wilson) -------
      def: {
        cutoff: {defVal: .065, min: 0.001, max: 1, subType: 'exp'},
        resonance: {defVal: 3.99, min: 0, max: 4}
      }
    }
    moog2Fx.construct = (fx, {initial}) => {
      const {int} = fx
      
      const bufferSize = 16384 // 4096 // 16384
      const moog2 = waCtx.createScriptProcessor(bufferSize, 1, 1)
      let in1, in2, in3, in4, out1, out2, out3, out4
      in1 = in2 = in3 = in4 = out1 = out2 = out3 = out4 = 0.0
      console.log('moog2 construct', int)
      int.cutoff = initial.cutoff // 0.065 // between 0.0 and 1.0
      int.resonance = initial.resonance // 3.99 // between 0.0 and 4.0
      moog2.onaudioprocess = e => {
        const input = e.inputBuffer.getChannelData(0)
        const output = e.outputBuffer.getChannelData(0)
        const f = int.cutoff * 1.16
        const fb = int.resonance * (1.0 - 0.15 * f * f)
        for (let i = 0; i < bufferSize; i++) {
          input[i] -= out4 * fb
          input[i] *= 0.35013 * (f * f) * (f * f)
          out1 = input[i] + 0.3 * in1 + (1 - f) * out1 // Pole 1
          in1 = input[i]
          out2 = out1 + 0.3 * in2 + (1 - f) * out2 // Pole 2
          in2 = out1
          out3 = out2 + 0.3 * in3 + (1 - f) * out3 // Pole 3
          in3 = out2
          out4 = out3 + 0.3 * in4 + (1 - f) * out4 // Pole 4
          in4 = out3
          output[i] = out4
        }
      }
      int.moog2 = moog2

      fx.start.connect(int.moog2)
      int.moog2.connect(fx.output)
    }
    moog2Fx.setValue = (fx, key, value) => ({
      cutoff: _ => fx.int.cutoff = value,
      resonance: _ => fx.int.resonance = value
    }[key])
    
    registerFxType('fx_moog2', moog2Fx)

    const vibratoFx = { //8#6b6 ------- vibrato (Chris Wilson?) -------
      def: {
        speed: {defVal: 3.5, min: .5, max: 15},
        delay: {defVal: 30, min: 5, max: 55},
        depth: {defVal: 2, min: .5, max: 4}
      }
    }
    vibratoFx.construct = (fx, {initial}) => {
      const {int} = fx
      
      int.delayNode = waCtx.createDelay(1)
      int.delayNode.delayTime.value = initial.delay / 1000

      int.osc = waCtx.createOscillator()
      int.gain = waCtx.createGain()

      int.gain.gain.value = initial.depth / 1000
      int.osc.type = 'sine' //+ ezt parameterbe
      int.osc.frequency.value = initial.speed
      int.osc.connect(int.gain)
      int.gain.connect(int.delayNode.delayTime)
      
      fx.start.connect(int.delayNode)
      int.delayNode.connect(fx.output)
      int.osc.start(0)
    }
    vibratoFx.setValue = (fx, key, value) => ({
      speed: _ => fx.setAt('osc', 'frequency', value),
      delay: _ => fx.setDelayTime('delayNode', value / 1000),
      depth: _ => fx.setAt('gain', 'gain', value / 1000)
    }[key])
    
    registerFxType('fx_vibrato', vibratoFx)

    const autoWahFx = { //8#04c ------- autoWah (Chris Wilson) -------
      def: {
        followerFilterType: {defVal: 'lowpass', type: 'string', subType: 'biquad'},
        followerFrequency: {defVal: 10, min: 5, max: 100},
        depth: {defVal: 11585, min: 500, max: 20000},
        filterType: {defVal: 'lowpass', type: 'string', subType: 'biquad'},
        Q: {defVal: 15, min: 0, max: 30},
        frequency: {defVal: 50, min: 10, max: 100}
      }
    }
    autoWahFx.construct = (fx, {initial}) => {
      const {int} = fx
      
      int.waveshaper = waCtx.createWaveShaper()
      int.awFollower = waCtx.createBiquadFilter()//+ ket biquad, paros graph?
      int.awFollower.type = initial.followerFilterType
      int.awFollower.frequency.value = initial.followerFrequency

      const curve = new Float32Array(65536)
      for (let i = -32768; i < 32768; i++) {
        curve[i + 32768] = ((i > 0) ? i : -i) / 32768
      }
      int.waveshaper.curve = curve
      int.waveshaper.connect(int.awFollower)

      int.awDepth = waCtx.createGain()
      int.awDepth.gain.value = initial.depth
      int.awFollower.connect(int.awDepth)

      int.awFilter = waCtx.createBiquadFilter()
      int.awFilter.type = initial.filterType
      int.awFilter.Q.value =  initial.Q
      int.awFilter.frequency.value = initial.frequency
      int.awDepth.connect(int.awFilter.frequency)
      int.awFilter.connect(fx.output)

      fx.start.connect(int.waveshaper)
      fx.start.connect(int.awFilter)
    }
    autoWahFx.setValue = (fx, key, value) => ({
      followerFilterType: _ => fx.int.awFollower.type = value,
      followerFrequency: _ => fx.setAt('awFollower', 'frequency', value),
      depth: _ => fx.setAt('awDepth', 'gain', value),
      filterType: _ => fx.int.awFilter.type = value,
      Q: _ => fx.setAt('awFilter', 'Q', value),
      frequency: _ => fx.setAt('awFilter', 'frequency', value)
    }[key])
    
    registerFxType('fx_autoWah', autoWahFx)
    
    const wahBassFx = { //8#0a7 ------- wahBass (Chris Wilson) -------
      def: {}
    }
    wahBassFx.construct = (fx, {initial}) => {
      const {int} = fx
      
      int.pingPong = newFx('fx_pingPongDelay')
      int.pingPong.connect(fx.output) //: a pingpongdelay a legutolso
      
      //int.pingPong.input.connect(fx.start)//+was wetgain??????????? inkabb fx,.output az
      int.pingPong.input.connect(fx.output)
      
      int.autoWah = newFx('fx_autoWah')
      int.autoWah.connect(int.pingPong)
      
      int.pitchShifter = newFx('fx_pitchShifter', {initial: {offset: -1}})
      int.pitchShifter.connect(int.autoWah)
      
      fx.start.connect(int.pitchShifter)
    }

    registerFxType('fx_wahBass', wahBassFx)
  }
  
  createOscFxTypes()
})
