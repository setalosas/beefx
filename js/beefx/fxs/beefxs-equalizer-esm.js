/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {nop, getIncArray, getHsp} = Corelib

onWaapiReady.then(waCtx => {
  const {registerFxType, connectArr} = BeeFX(waCtx)
  
  const eqPresetNames = [['flat', 'flat']] //: not yet
  
  const createEqualizer = ({name, variant, bands}) => { //8#482 ---- equalizer type factory ----
    const gain = {defVal: 0, min: -24, max: 24, arrayIx: [0, bands - 1], unit: 'dB'}
    const preset = {defVal: eqPresetNames[0][1], type: 'strings', subType: eqPresetNames}
    const detune = {defVal: 0, min: -1200, max: 1200, arrayIx: [0, bands - 1], unit: 'cent', color: 120}
    const Q = {defVal: 1, min: .01, max: 100, arrayIx: [0, bands - 1], subType: 'exp'}
    
    const eqFx = {
      def: {
        ...(variant === 'classic' ? {preset, gain} : {gain, detune, Q}),
        multiGraph: {type: 'graph'}
      },
      midi: {arrays: variant === 'classic' ? 'gain' : 'gain,detune,Q'},
      name,
      graphs: {
        multiGraph: getIncArray(0, bands - 1).map(ix => ({
          graphType: 'freq',
          filter: 'bandNode' + ix, // fx => fx.int.bandNodes[ix]
          minDb: -26,
          maxDb: 28,
          diynamic: .8,
          renderSet: {doClear: ix === 0, doGrid: ix === 0, doGraph: true},
          phaseCurveColor: `hsla(${getHsp(ix / bands, 99, 75)}, .5)`,
          magCurveColor: `hsl(${getHsp(ix / bands, 90, 55)})`
        }))
      }
    }
    //: That array extraction is confusing.
    
    eqFx.setValue = (fx, key, varr, {int} = fx, [ix = -1, value] = varr.map ? varr : []) => ({
      preset: nop, //: fx.setValueArray!
      gain: _ => ix !== -1 && fx.setAt(int.bandNodes[ix], 'gain', value),
      detune: _ => ix !== -1 && fx.setAt(int.bandNodes[ix], 'detune', value),
      Q: _ => ix !== -1 && (int.bandNodes[ix].Q.value = value)
    }[key]) //isArr(key] ? key[0] : key
    
    const bandTable = {
      british4: {Q: 1, freqs: [80, 640, 2560, 8192]}, // 5120
      classic4: {Q: .5, freqs: [30, 240, 1920, 15360]},
      classic6: {Q: 1.2, freqs: [20, 80, 320, 1280, 5120, 15360]},
      classic10: {Q: 2.5, freqs: [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]}
    }
    eqFx.construct = (fx, pars, {int} = fx) => {
      int.bandNodes = []
      for (let i = 0; i < bands; i++) {
        const bandNode = waCtx.createBiquadFilter()
        bandNode.frequency.value = bandTable[variant + bands].freqs[i] 
        bandNode.type = 'peaking'
        bandNode.Q.value = bandTable[variant + bands].Q
        int['bandNode' + i] = int.bandNodes[i] = bandNode
      }
      connectArr(fx.start, ...int.bandNodes, fx.output)
    }
    return eqFx
  }
  registerFxType('fx_eq4',
    createEqualizer({name: 'Equalizer (classic 4-band)', variant: 'classic', bands: 4}))
  registerFxType('fx_eq6',
    createEqualizer({name: 'Equalizer (classic 6-band)', variant: 'classic', bands: 6}))
  registerFxType('fx_eq10',
    createEqualizer({name: 'Equalizer (classic 10-band)', variant: 'classic', bands: 10}))
  registerFxType('fx_eqb4',
    createEqualizer({name: 'Equalizer (British 4-band)', variant: 'british', bands: 4}))
})

/*
LF - Low fr, (20-500Hz) --- 20 40 80 (160) 320 640 *** 20 40 (80) 160 320
LMF - Low mid fr, (200 Hz - 3 kHz) --- 200 400 800 1600 3200 *** 160 320 (640) 1280 2560
HMF - high mid fr, (700 Hz - 12 kHz) --- 700 1400 2800 5600 11200 *** 640 1280 (2560) 5120 10k
HF - high fr ( 1.5 kHz - 20 kHz) --- 1500 3000 6000 12000 24000 *** 1280 2560 (5120) 10240 20480 
*/
