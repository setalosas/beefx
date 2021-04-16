/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {nop, isArr, getRnd, getRndFloat} = Corelib
const {wassert} = Corelib.Debug
const {round} = Math

onWaapiReady.then(waCtx => {
  const {registerFxType, newFx, connectArr} = BeeFX(waCtx)

  const noiseConvolverFx = { //8#978 ------- noiseConvolver (Noise Hacker) -------
    def: {}
  }
  noiseConvolverFx.construct = (fx, pars, {int} = fx) => {
    int.convolver = waCtx.createConvolver()
    int.noiseBuffer = waCtx.createBuffer(2, 0.5 * waCtx.sampleRate, waCtx.sampleRate)
    int.left = int.noiseBuffer.getChannelData(0)
    int.right = int.noiseBuffer.getChannelData(1)
    for (let i = 0; i < int.noiseBuffer.length; i++) {
      int.left[i] = Math.random() * 2 - 1
      int.right[i] = Math.random() * 2 - 1
    }
    int.convolver.buffer = int.noiseBuffer
    connectArr(fx.start, int.convolver, fx.output)
    //+ needs a gain
  }
  registerFxType('fx_noiseConvolver', noiseConvolverFx)
  
  const pinkingFx = { //8#e88 -------pinking  (Noise Hacker) -------
    def: {}
  }
  pinkingFx.construct = (fx, pars, {int} = fx) => {
    const bufferSize = 8192
    let [b0, b1, b2, b3, b4, b5, b6] = [.0, .0, .0, .0, .0, .0, .0]
    int.pinking = waCtx.createScriptProcessor(bufferSize, 1, 1)
    int.pinking.onaudioprocess = e => {
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
    connectArr(fx.start, int.pinking, fx.output)
  }
  registerFxType('fx_pinking', pinkingFx)
  
  const bitcrusherFx = { //8#0a4 -------bitcrusher (Tuna) -------
    def: {
      bits: {defVal: 8, min: 1, max: 16, subType: 'int'},
      freqStep: {defVal: .01, min: .001, max: 1, subType: 'exp'}
    },
    midi: {pars: ['bits,freqStep']}
  }

  bitcrusherFx.setValue = (fx, key, value, {int} = fx) => ({
    bits: nop,
    freqStep: nop
  }[key])

  bitcrusherFx.construct = (fx, {initial}, {int, atm} = fx) => {
    int.bufferSize = 4096
    int.processor = waCtx.createScriptProcessor(int.bufferSize, 1, 1)
    
    let phaser = 0
    let last
        
    int.processor.onaudioprocess = e => {
      const input = e.inputBuffer.getChannelData(0)
      const output = e.outputBuffer.getChannelData(0)
      const step = Math.pow(1 / 2, atm.bits)
      const length = input.length
      for (let i = 0; i < length; i++) {
        phaser += atm.freqStep
        if (phaser >= 1.0) {
          phaser -= 1.0
          last = step * Math.floor(input[i] / step + 0.5)
        }
        output[i] = last
      }
    }
    connectArr(fx.start, int.processor, fx.output)
  }
  registerFxType('fx_bitCrusher', bitcrusherFx)

  const noiseGateFx = { //8#599 ------- Noise Gate (cwilso) -------
    def: {
      followerFreq: {defVal: 10, min: .25, max: 20, unit: 'Hz'},
      floor: {defVal: .01, min: 0.001, max: 1, subType: 'exp'}
    },
    midi: {pars: ['followerFreq,floor']}
  }

  noiseGateFx.setValue = (fx, key, value, {int} = fx) => ({
    followerFreq: nop,
    floor: _ => fx.regenNoiseFloorCurve(value)
  }[key])

  noiseGateFx.construct = (fx, {initial}, {int, atm} = fx) => {
    const curve = new Float32Array(65536)
    for (let i = -32768; i < 32768; i++) {
      curve[i + 32768] = ((i > 0) ? i  : -i) / 32768
    }
    int.rectifier = waCtx.createWaveShaper()
    int.rectifier.curve = curve
    
    int.ngFollower = waCtx.createBiquadFilter()
    int.ngFollower.type = 'lowpass'
    int.ngFollower.frequency.value = 10.0

    fx.regenNoiseFloorCurve = floor => {
      const curve = new Float32Array(65536)
      const mappedFloor = floor * 32768

      for (let i = 0; i < 32768; i++) {
        var value = i < mappedFloor ? 0 : 1
        curve[32768 - i] = -value
        curve[32768 + i] = value
      }
      curve[0] = curve[1] // fixing up the end.

      int.ngGate.curve = curve
    }
    int.ngGate = waCtx.createWaveShaper()
    
    int.gateGain = waCtx.createGain()
    int.gateGain.gain.value = 0.0

    connectArr(fx.start, int.rectifier, int.ngFollower, int.ngGate, int.gateGain.gain)
    int.gateGain.connect(fx.output)
    fx.start.connect(int.gateGain)
  }
  registerFxType('fx_noiseGate', noiseGateFx)
})
