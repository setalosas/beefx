/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, WaapiWrap} from '../improxy-esm.js'

const {nop, isArr, getRnd, getRndFloat} = Corelib
const {wassert} = Corelib.Debug
const {round, PI} = Math
const PI2 = 2 * PI

WaapiWrap.onRun(waCtx => {
  const {registerFxType, newFx} = BeeFX(waCtx)

  const createOscFxTypes = _ => {
    const pitchShifterFx = { //8#e74 ------- pitchShifter (Chris Wilson) -------
      def: {
        offset: {defVal: 0, min: -1, max: 1}
      }
    }
    pitchShifterFx.construct = (fx, pars) => {
      const {ext} = fx
      wassert(window.Jungle)
      ext.jungle = new window.Jungle(waCtx)
      fx.start.connect(ext.jungle.input)
      ext.jungle.output.connect(fx.output)
      ext.jungle.setPitchOffset(0)
    }
    pitchShifterFx.setValue = (fx, key, value) => ({
      offset: _ => fx.ext.jungle.setPitchOffset(value)
    }[key])
    
    registerFxType('fx_pitchShifter', pitchShifterFx)
      
    const moog2Fx = { //8#c6c ------- moog2 (Chris Wilson) -------
      def: {
        cutoff: {defVal: .065, min: 0.001, max: 1, subType: 'exp'},
        resonance: {defVal: 3.99, min: 0, max: 4}
      }
    }
    moog2Fx.construct = (fx, {initial}) => {
      const {ext} = fx
      
      const bufferSize = 16384 // 4096 // 16384
      const moog2 = waCtx.createScriptProcessor(bufferSize, 1, 1)
      let in1, in2, in3, in4, out1, out2, out3, out4
      in1 = in2 = in3 = in4 = out1 = out2 = out3 = out4 = 0.0
      console.log('moog2 construct', ext)
      ext.cutoff = initial.cutoff // 0.065 // between 0.0 and 1.0
      ext.resonance = initial.resonance // 3.99 // between 0.0 and 4.0
      moog2.onaudioprocess = e => {
        const input = e.inputBuffer.getChannelData(0)
        const output = e.outputBuffer.getChannelData(0)
        const f = ext.cutoff * 1.16
        const fb = ext.resonance * (1.0 - 0.15 * f * f)
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
      ext.moog2 = moog2

      fx.start.connect(ext.moog2)
      ext.moog2.connect(fx.output)
    }
    moog2Fx.setValue = (fx, key, value) => ({
      cutoff: _ => fx.ext.cutoff = value,
      resonance: _ => fx.ext.resonance = value
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
      const {ext} = fx
      
      ext.delayNode = waCtx.createDelay()
      ext.delayNode.delayTime.value = initial.delay / 1000

      ext.osc = waCtx.createOscillator()
      ext.gain = waCtx.createGain()

      ext.gain.gain.value = initial.depth / 1000
      ext.osc.type = 'sine' //+ ezt parameterbe
      ext.osc.frequency.value = initial.speed
      ext.osc.connect(ext.gain)
      ext.gain.connect(ext.delayNode.delayTime)
      
      fx.start.connect(ext.delayNode)
      ext.delayNode.connect(fx.output)
      ext.osc.start(0)
    }
    vibratoFx.setValue = (fx, key, value) => ({
      speed: _ => fx.setAt('osc', 'frequency', value),
      delay: _ => fx.setAt('delayNode', 'delayTime', value / 1000),
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
      const {ext} = fx
      
      ext.waveshaper = waCtx.createWaveShaper()
      ext.awFollower = waCtx.createBiquadFilter()//+ ket biquad, paros graph?
      ext.awFollower.type = initial.followerFilterType
      ext.awFollower.frequency.value = initial.followerFrequency

      const curve = new Float32Array(65536)
      for (let i = -32768; i < 32768; i++) {
        curve[i + 32768] = ((i > 0) ? i : -i) / 32768
      }
      ext.waveshaper.curve = curve
      ext.waveshaper.connect(ext.awFollower)

      ext.awDepth = waCtx.createGain()
      ext.awDepth.gain.value = initial.depth
      ext.awFollower.connect(ext.awDepth)

      ext.awFilter = waCtx.createBiquadFilter()
      ext.awFilter.type = initial.filterType
      ext.awFilter.Q.value =  initial.Q
      ext.awFilter.frequency.value = initial.frequency
      ext.awDepth.connect(ext.awFilter.frequency)
      ext.awFilter.connect(fx.output)

      fx.start.connect(ext.waveshaper)
      fx.start.connect(ext.awFilter)
    }
    autoWahFx.setValue = (fx, key, value) => ({
      followerFilterType: _ => fx.ext.awFollower.type = value,
      followerFrequency: _ => fx.setAt('awFollower', 'frequency', value),
      depth: _ => fx.setAt('awDepth', 'gain', value),
      filterType: _ => fx.ext.awFilter.type = value,
      Q: _ => fx.setAt('awFilter', 'Q', value),
      frequency: _ => fx.setAt('awFilter', 'frequency', value)
    }[key])
    
    registerFxType('fx_autoWah', autoWahFx)
    
    const wahBassFx = { //8#0a7 ------- wahBass (Chris Wilson) -------
      def: {}
    }
    wahBassFx.construct = (fx, {initial}) => {
      const {ext} = fx
      
      ext.pingPong = newFx('fx_pingPongDelay')
      ext.pingPong.connect(fx.output) //: a pingpongdelay a legutolso
      
      //ext.pingPong.input.connect(fx.start)//+was wetgain??????????? inkabb fx,.output az
      ext.pingPong.input.connect(fx.output)
      
      ext.autoWah = newFx('fx_autoWah')
      ext.autoWah.connect(ext.pingPong)
      
      ext.pitchShifter = newFx('fx_pitchShifter', {initial: {offset: -1}})
      ext.pitchShifter.connect(ext.autoWah)
      
      fx.start.connect(ext.pitchShifter)
    }

    registerFxType('fx_wahBass', wahBassFx)
  }
  
  createOscFxTypes()
})
