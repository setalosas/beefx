/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, WaapiWrap} from '../improxy-esm.js'

const {nop, isArr, getRnd, getRndFloat} = Corelib
const {wassert} = Corelib.Debug
const {round} = Math

WaapiWrap.onRun(waCtx => {
  const {registerFxType, newFx} = BeeFX(waCtx)

  const createNoiseFxTypes = _ => {
    const noiseConvolverFx = { //8#978 ------- noiseConvolver (Noise Hacker) -------
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
    
    const pinkingFx = { //8#e88 -------pinking  (Noise Hacker) -------
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
    
    const bitcrusherFx = { //8#0a4 -------bitcrusher (Tuna) -------
      def: {
        bits: {defVal: 8, min: 1, max: 16}, //+type === int
        normfreq: {defVal: 100, min: .1, max: 1000}
      }
    }
    bitcrusherFx.construct = (fx, {initial}) => {
      const {ext} = fx
      
      ext.bufferSize = initial.bufferSize

      ext.processor = waCtx.createScriptProcessor(ext.bufferSize, 1, 1)

      fx.start.connect(ext.processor)
      ext.processor.connect(fx.output)
      
      const dis = this

      let phaser = 0 //+ check h ketto megy e eghyszerre
          
      ext.processor.onaudioprocess = e => {
       //if (dis.isRelaxed) {
         //return
       //}
        const input = e.inputBuffer.getChannelData(0)
        const output = e.outputBuffer.getChannelData(0)
        const step = Math.pow(1 / 2, ext.bits)
        const length = input.length
        let last
        for (let i = 0; i < length; i++) {
          phaser += ext.normfreq
          if (phaser >= 1.0) {
            phaser -= 1.0
            last = step * Math.floor(input[i] / step + 0.5)
          }
          output[i] = last
        }
      }
      
      ext.bits = initial.bits
      ext.normfreq = initial.normfreq
    }
    bitcrusherFx.setValue = (fx, key, value) => ({
      bits: _ => fx.ext.bits = round(value), //+round????
      normfreq: _ => fx.ext.processor.normfreq = value / 1000
    }[key])
    
    registerFxType('fx_bitcrusher', bitcrusherFx)
  }
  
  createNoiseFxTypes()
})
