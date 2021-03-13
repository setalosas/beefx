/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, WaapiWrap} from '../improxy-esm.js'

const {nop, isArr, getRnd, getRndFloat} = Corelib
const {wassert} = Corelib.Debug
const {createPerfTimer, startEndThrottle} = Corelib.Tardis
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
    ].map(a => a.map ? a : [a, a]).sort((a, b) => a[1] > b[1] ? 1 : -1)
    
    const convPrefix = '//beefx.mork.work/pres/impulses/imodeler/' //+kurva youtube
    
    const getFullConvImpulsePath = conv => convPrefix + conv + '.wav'
    
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
    
    const convolverCommonDef = {
      highCut: {defVal: 22050, min: 20, max: 22050, subType: 'exp'},
      lowCut: {defVal: 20, min: 20, max: 22050, subType: 'exp'},
      dryLevel: {defVal: .5, min: 0, max: 1},
      wetLevel: {defVal: 1, min: 0, max: 1},
      level: {defVal: 1, min: 0, max: 1}
    }

    const convolverFx = { //8#289 --------- Convolver (Tuna) ----------
      def: {
        buffer: {defVal: convPresets[0][0], type: 'strings', subType: convPresets},
        ...convolverCommonDef
      },
      name: 'Convolver (from sample)',
      fxNamesDb: {convPresets}
    }
    
    convolverFx.setValue = (fx, key, value, {ext} = fx) => ({
      buffer: _ => loadBuffer(fx.ext.convolver, value),
      impDuration: _ => {
        ext.impDuration = value
        ext.convolver.buffer = ext.regenerateImpulseBuffer()
      },
      impDecay: _ => {
        ext.impDecay = value
        ext.impDuration += .0001
        ext.convolver.buffer = ext.regenerateImpulseBuffer()
      },
      impReverse: _ => {
        ext.impReverse = value
        const curDur = ext.impDuration //: sometimes it won't work without duration regen :-(
        setTimeout(_ => fx.setValue('impDuration', curDur - .001), 50)//: so we get around it
        setTimeout(_ => fx.setValue('impDuration', curDur), 100)
      },
      highCut: _ => fx.setAt('filterHigh', 'frequency', value),
      lowCut: _ => fx.setAt('filterLow', 'frequency', value),
      dryLevel: _ => fx.setAt('dry', 'gain', value),
      wetLevel: _ => fx.setAt('wet', 'gain', value),
      level: _ => fx.setAt('output', 'gain', value)
    }[key])
    
    convolverFx.construct = (fx, {initial}) => {
      const {ext} = fx
      
      ext.impDuration = initial.impDuration
      ext.impDecay = initial.impDecay
      ext.impReverse = initial.impReverse
      
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
      
      ext.regenerateImpulseBuffer = startEndThrottle(_ => createImpulseResponse(ext), 400)
    }
    
    const createImpulseResponse = ({convolver, impDuration, impDecay, impReverse}) => {
      const timer = createPerfTimer()
      
      const {sampleRate} = waCtx
      const length = sampleRate * impDuration
      const impulse = waCtx.createBuffer(2, length, sampleRate)
      const impulseL = impulse.getChannelData(0)
      const impulseR = impulse.getChannelData(1)

      for (let i = 0; i < length; i++) {
        const n = impReverse ? length - i : i
        impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, impDecay)
        impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, impDecay)
      }
      convolver.buffer = impulse
      
      console.log(`createImpResponse spent`, timer.sum().summary, {impDuration, impDecay, impReverse})
      const tab = []
      for (let i = 0; i < 10; i++) {
        tab.push({L: impulseL[i * 1000] * 1000, R: impulseR[i * 1000] * 1000})
      }
      console.table(tab)
    }

    registerFxType('fx_convolver', convolverFx)
    
    const convolverGenFx = { //8#298 --------- Convolver with generated impulse (Tuna+CW) ----------
      ...convolverFx,
      def: {
        impDuration: {defVal: 2.5, min: .1, max: 6, subType: 'exp'},
        impDecay: {defVal: 2., min: 1, max: 3},
        impReverse: {defVal: false, type: 'boolean'},
        ...convolverCommonDef
      },
      name: 'Convolver (generated impulse)'
    } //:haromszor fogja meghivni a generatort (mindharom ertek setValue-janal)
    
    registerFxType('fx_convolverGen', convolverGenFx)
    
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
