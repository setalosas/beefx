/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, WaapiWrap} from '../improxy-esm.js'

const {nop, getRnd, getRndFloat} = Corelib
const {wassert} = Corelib.Debug

WaapiWrap.onRun(waCtx => {
  const {registerFxType, newFx} = BeeFX(waCtx)

  const createBasicFxTypes = _ => {
    const blankFx = { //8#bbb ------- blank -------
      def: {}
    }
    blankFx.construct = (fx, pars) => {//: gainFx egy van, fx az instancia
      fx.start.connect(fx.output)
    }
    registerFxType('fx_blank', blankFx)
    
    const gainFx = { //8#a00 ------- gain -------
      def: {
        gain: {defVal: 1, min: 0, max: 4, name: 'gain'}
      }
    }
    gainFx.construct = (fx, pars) => {//: gainFx egy van, fx az instancia
      const {ext} = fx
      ext.gain = waCtx.createGain()
      fx.start.connect(ext.gain)
      ext.gain.connect(fx.output)
    }
    gainFx.setValue = (fx, key, value) => ({
      gain: _ => fx.setAt('gain', 'gain', value)
    }[key])
    registerFxType('fx_gain', gainFx)

    const delayFx = { //8#a0a ------- delay -------
      def: {
        delayTime: {defVal: 0, min: 0, max: 1}
      }
    }
    delayFx.construct = (fx, pars) => {//: delayFx egy van, fx az instancia
      const {ext} = fx
      ext.delay = waCtx.createDelay()
      fx.start.connect(ext.delay)
      ext.delay.connect(fx.output)
    }
    delayFx.setValue = (fx, key, value) => ({
      delayTime: _ => fx.setAt('delay', 'delayTime', value) //fx.ext.delay.delayTime.value = value
    }[key])
    registerFxType('fx_delay', delayFx)
    
    const ratioFx = { //8#666 ------- ratio -------
      def: {
        gain: {defVal: .5, min: 0.01, max: 3.97, name: 'gain'}
      }
    }
    ratioFx.construct = (fx, pars) => {//: ratioFx egy van, fx az instancia
      const {ext} = fx
      ext.gain = waCtx.createGain()
      fx.start.connect(ext.gain)
      ext.gain.connect(fx.output)
      ext.syncArr = []
      fx.chain = (...arr) => {
        const fullArr = [fx, ...arr]
        const SUM_GAIN = fullArr.length * .51 //: it's ok for 4 if max: 4 (4.04)
        for (const chainedFx of fullArr) {
          chainedFx.ext.syncArr = fullArr
          chainedFx.ext.sumGain = SUM_GAIN
        }
        fx.setValue('gain', fx.live.gain)
      }
    }
    ratioFx.normalize = masterFx => {
      const {ext, exo} = masterFx
      let aggregated = 0
      for (const syncFx of ext.syncArr) {
        aggregated += syncFx.live.gain
      }
      const othersAggregated = aggregated - masterFx.live.gain // 4.1 - .5 = 3.6
      const remaining = ext.sumGain - masterFx.live.gain // 3.5
      const factor = remaining / Math.max(othersAggregated, .005)
      for (const syncFx of ext.syncArr) {
        if (masterFx !== syncFx) {
          const oldVal = syncFx.live.gain
          const newVal = oldVal * factor
          syncFx.setValueAlt('gain', Math.max(newVal, exo.def.gain.min))
        }
      }
    }
    ratioFx.setValue = (fx, key, value) => ({
      gain: _ => {
        fx.setAt('gain', 'gain', value)
        ratioFx.normalize(fx)
      }
    }[key])
    ratioFx.setValueAlt = (fx, key, value) => ({
      gain: _ => {
        fx.setAt('gain', 'gain', value)
      }
    }[key])
    registerFxType('fx_ratio', ratioFx)

    const biquadFx = { //8#48d ------- biquadFilter -------
      def: {
        filterType: {defVal: 'peaking', type: 'string', subType: 'biquad'},
        frequency: {defVal: 800, min: 50, max: 22050, subType: 'exp'},
        detune: {defVal: 100, min: 1, max: 10000, subType: 'exp'},
        gain: {defVal: 0, min: -40, max: 40, subType: 'decibel'},
        Q: {defVal: 1, min: .0001, max: 100, subType: 'exp'}
      }
    }
    biquadFx.construct = (fx, pars) => {
      const {ext} = fx
      ext.biquad = waCtx.createBiquadFilter()
      fx.start.connect(ext.biquad)
      ext.biquad.connect(fx.output)
    }
    biquadFx.setValue = (fx, key, value) => ({
      filterType: _ => fx.ext.biquad.type = value,
      frequency: _ => fx.setAt('biquad', 'frequency', value),
      detune: _ => fx.setAt('biquad', 'detune', value),
      gain: _ => fx.setAt('biquad', 'gain', value),
      Q: _ => fx.ext.biquad.Q.value = value
    }[key])
    
    registerFxType('fx_biquad', biquadFx)
    
    const pitchShifterFx = { //8#e74 ------- pitchShifter -------
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
    
    const noiseConvolverFx = { //8#978 ------- noiseConvolver -------
      def: {}
    }
    noiseConvolverFx.construct = (fx, pars) => {
      const {ext} = fx
      
      ext.convolver = waCtx.createConvolver()
      ext.noiseBuffer = waCtx.createBuffer(2, 0.5 * waCtx.sampleRate, waCtx.sampleRate)
      ext.left = ext.noiseBuffer.getChannelData(0)
      ext.right = ext.noiseBuffer.getChannelData(1)
      for (let i = 0; i < ext.noiseBuffer.length; i++) {
        ext.left[i] = Math.random() * 2 - 1
        ext.right[i] = Math.random() * 2 - 1
      }
      ext.convolver.buffer = ext.noiseBuffer
      fx.start.connect(ext.convolver)
      ext.convolver.connect(fx.output) //+ ez biztos?
    }
    
    registerFxType('fx_noiseConvolver', noiseConvolverFx)
    
    const pinkingFx = { //8#e88 -------pinking -------
      def: {}
    }
    pinkingFx.construct = (fx, pars) => {
      const {ext} = fx
      
      const bufferSize = 16384
      let [b0, b1, b2, b3, b4, b5, b6] = [.0, .0, .0, .0, .0, .0, .0]
      ext.pinking = waCtx.createScriptProcessor(bufferSize, 1, 1)
      ext.pinking.onaudioprocess = e => {
        const input = e.inputBuffer.getChannelData(0)
        const output = e.outputBuffer.getChannelData(0)
        for (let i = 0; i < bufferSize; i++) {
          b0 = 0.99886 * b0 + input[i] * 0.0555179
          b1 = 0.99332 * b1 + input[i] * 0.0750759
          b2 = 0.96900 * b2 + input[i] * 0.1538520
          b3 = 0.86650 * b3 + input[i] * 0.3104856
          b4 = 0.55000 * b4 + input[i] * 0.5329522
          b5 = -0.7616 * b5 - input[i] * 0.0168980
          output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + input[i] * 0.5362
          output[i] *= 0.11 // (roughly) compensate for gain
          b6 = input[i] * 0.115926
        }
      }

      fx.start.connect(ext.pinking)
      ext.pinking.connect(fx.output)
    }
    
    registerFxType('fx_pinking', pinkingFx)
    
    const moog2Fx = { //8#c6c -------moog2 -------
      def: {
        cutoff: {defVal: .065, min: 0, max: 1},
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

    const vibratoFx = { //8#6b6 -------vibrato -------
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

    const autoWahFx = { //8#04c -------autoWah -------
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
    
    const pingPongDelayFx = { //8#0ac -------pingPongDelayCW -------
      def: {
        delayLeft: {defVal: .5, min: .01, max: 2.0},
        delayRight: {defVal: .5, min: .01, max: 2.0},
        feedbackLeft: {defVal: .5, min: .01, max: 1.0},
        feedbackRight: {defVal: .5, min: .01, max: 1.0}
      }
    }
    pingPongDelayFx.construct = (fx, {initial}) => {
      const {ext} = fx
      
      const context = waCtx
      ext.merger = context.createChannelMerger(2)
      ext.leftDelay = context.createDelay()
      ext.rightDelay = context.createDelay()
      ext.leftFeedback = waCtx.createGain()
      ext.rightFeedback = waCtx.createGain()
      ext.splitter = context.createChannelSplitter(2)

      // Split the stereo signal.
      ext.splitter.connect(ext.leftDelay, 0)
      // If the signal is dual copies of a mono signal, we don't want the right channel - 
      // it will just sound like a mono delay.  If it was a real stereo signal, we do want
      // it to just mirror the channels.
      const isTrueStereo = true
      if (isTrueStereo) {
        ext.splitter.connect(ext.rightDelay, 1)
      }
      ext.leftDelay.delayTime.value = initial.delayLeft
      ext.rightDelay.delayTime.value = initial.delayRight
      
      ext.leftFeedback.gain.value = initial.feedbackLeft
      ext.rightFeedback.gain.value = initial.feedbackRight

      // Connect the routing - left bounces to right, right bounces to left.
      ext.leftDelay.connect(ext.leftFeedback)
      ext.leftFeedback.connect(ext.rightDelay)
      
      ext.rightDelay.connect(ext.rightFeedback)
      ext.rightFeedback.connect(ext.leftDelay)
      
      // Re-merge the two delay channels into stereo L/R
      ext.leftFeedback.connect(ext.merger, 0, 0)
      ext.rightFeedback.connect(ext.merger, 0, 1)
      
      fx.start.connect(ext.splitter)
      ext.merger.connect(fx.output)
    }
    pingPongDelayFx.setValue = (fx, key, value) => ({
      delayLeft: _ => fx.ext.leftDelay.delayTime.value = value,
      delayRight: _ => fx.ext.rightDelay.delayTime.value = value,
      feedbackLeft: _ => fx.setAt('leftFeedback', 'gain', value),
      feedbackRight: _ => fx.setAt('rightFeedback', 'gain', value)
    }[key])
    
    registerFxType('fx_pingPongDelay', pingPongDelayFx)
        
    const wahBassFx = { //8#0a7 -------wahBassCW -------
      def: {}
    }
    wahBassFx.construct = (fx, {initial}) => {
      const {ext} = fx
      
      ext.pingPong = newFx('fx_pingPongDelay')
      ext.pingPong.connect(fx.output) //: a pingpongdelay a legutolso
      
      ext.pingPong.input.connect(fx.start)//was wetgain???????????
      
      ext.autoWah = newFx('fx_autoWah')
      ext.autoWah.connect(ext.pingPong)
      
      ext.pitchShifter = newFx('fx_pitchShifter', {initial: {offset: -1}})
      ext.pitchShifter.connect(ext.autoWah)
      
      fx.start.connect(ext.pitchShifter)
    }

    registerFxType('fx_wahBass', wahBassFx)
  }
  
  createBasicFxTypes()
})
