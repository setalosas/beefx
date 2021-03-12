/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, WaapiWrap} from '../improxy-esm.js'

const {nop, isArr, getRnd, getRndFloat} = Corelib
const {wassert} = Corelib.Debug
const {round} = Math
const {fetch} = window

WaapiWrap.onRun(waCtx => {
  const {registerFxType, newFx, connectArr} = BeeFX(waCtx)

  const createReverbFxTypes = _ => {
    const convPresets = [
      ['tuna/impulse_guitar', '1. Default'],
      ['tuna/impulse_rev', '2. Default reverse'],
      ['cw/cardiod-rear-levelled', '3. Cardiod Rear Levelled'],
      'Vocal Duo',
      'Trig Room',
      'St Nicolaes Church',
      'Small Drum Room',
      'Small Prehistoric Cave',
      'Scala Milan Opera Hall',
      'Ruby Room',
      'Right Glass Triangle',
      'Rays',
      'Parking Garage',
      'On a Star',
      'Nice Drum Room',
      'Narrow Bumpy Space',
      'Musikvereinsaal',
      'Masonic Lodge',
      'Large Wide Echo Hall',
      'Large Long Echo Hall',
      'Large Bottle Hall',
      ['Highly Damped Large Room', 'Highly Damped Lrg Rm'],
      'In The Silo',
      'Greek 7 Echo Hall',
      'Going Home',
      'Five Columns',
      'Five Columns Long',
      ['French 18th Century Salon', 'French 18th Cent. Salon'],
      'Direct Cabinet N4',
      'Direct Cabinet N3',
      'Direct Cabinet N2',
      'Direct Cabinet N1',
      'Bottle Hall',
      'Derlon Sanctuary',
      'Deep Space',
      'Conic Long Echo Hall',
      ['Chateau de Logne, Outside', 'Chateau de Logne, Out.'],
      'Block Inside',
      'Cement Blocks 1',
      'Cement Blocks 2',
      'In The Silo Revised'
    ].map(a => a.map ? a : [a, a]).sort((a, b) => a[1] > b[1])
    
    const convPrefix = '//beefx.mork.work/pres/impulses/imodeler/' //+kurva youtube
    
    const getFullConvImpulsePath = conv => convPrefix + conv + '.wav'
    //
    const convolverFx = { //8#289 --------- Convolver (Tuna) ----------
      def: {
        buffer: {defVal: convPresets[0][0], type: 'strings', subType: convPresets},
        highCut: {defVal: 22050, min: 20, max: 22050, subType: 'exp'},
        lowCut: {defVal: 20, min: 20, max: 22050, subType: 'exp'},
        dryLevel: {defVal: 1, min: 0, max: 1},
        wetLevel: {defVal: 1, min: 0, max: 1},
        level: {defVal: 1, min: 0, max: 1}
      },
      fxNamesDb: {convPresets}
    }
    
    convolverFx.setValue = (fx, key, value) => ({
      buffer: _ => loadBuffer(fx.ext.convolver, value),
      highCut: _ => fx.setAt('filterHigh', 'frequency', value),
      lowCut: _ => fx.setAt('filterLow', 'frequency', value),
      dryLevel: _ => fx.setAt('dry', 'gain', value),
      wetLevel: _ => fx.setAt('wet', 'gain', value),
      level: _ => fx.setAt('output', 'gain', value)
    }[key])
    
    convolverFx.construct = (fx, {initial}) => {
      const {ext} = fx
      
      ext.convolver = waCtx.createConvolver()
      ext.dry = waCtx.createGain()
      ext.filterLow = waCtx.createBiquadFilter()
      ext.filterLow.type = 'highpass'
      ext.filterHigh = waCtx.createBiquadFilter()
      ext.filterHigh.type = 'lowpass'
      ext.wet = waCtx.createGain()

      fx.start.connect(ext.filterLow)
      fx.start.connect(ext.dry)
      
      ext.filterLow.connect(ext.filterHigh)
      ext.filterHigh.connect(ext.convolver)
      ext.convolver.connect(ext.wet)
      ext.wet.connect(fx.output)
      ext.dry.connect(fx.output)
      ext.output = fx.output //: for setValue
    }
    
    const createImpulseResponse = (duration, decay = 2, reverse = false) => {
      const sampleRate = waCtx.sampleRate
      const length = sampleRate * duration
      const impulse = waCtx.createBuffer(2, length, sampleRate)
      const impulseL = impulse.getChannelData(0)
      const impulseR = impulse.getChannelData(1)

      for (let i = 0; i < length; i++) {
        const n = reverse ? length - i : i
        impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay)
        impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay)
      }
      return impulse
    }
    
    const loadBuffer = (convolver, value) => fetch(getFullConvImpulsePath(value))
      .then(response => {
         if (!response.ok) {
           throw new Error("HTTP error, status = " + response.status)
         }
         return response.arrayBuffer()
       })
       .then(buffer => {
         waCtx.decodeAudioData(buffer, decodedData => {
           convolver.buffer = decodedData
         })
       })

    registerFxType('fx_convolver', convolverFx)
    
    /*const convolverGenFx = {
      def: {...convolverFx.def, buffer: undef},
      buffer: undef
    */
    const reverbFx = { //8#289 --------- Convolver (CW) ----------
      def: {
        buffer: {defVal: 'cardiod-rear-levelled', type: 'strings', subType: convPresets}
      },
      fxNamesDb: {convPresets}
    }
    
    reverbFx.setValue = (fx, key, value) => ({
      buffer: _ => loadBuffer(fx.ext.reverb, value)
    }[key])
    
    reverbFx.construct = (fx, {initial}) => {
      const {ext} = fx
      
      ext.reverb = waCtx.createConvolver()
      connectArr(fx.start, ext.reverb, fx.output)
    }
    
    registerFxType('fx_reverb', reverbFx)
  }
  
  createReverbFxTypes()
})
