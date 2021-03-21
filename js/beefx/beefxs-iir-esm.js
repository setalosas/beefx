/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, WaapiWrap, Chebyshev} from '../improxy-esm.js'

const {Ø, nop, isArr, getRnd, getRndFloat, clamp} = Corelib
const {wassert} = Corelib.Debug
const {createPerfTimer, startEndThrottle} = Corelib.Tardis
const {chebyDsp, isFilterStable} = Chebyshev

WaapiWrap.onRun(waCtx => {
  const {registerFxType, newFx, connectArr} = BeeFX(waCtx)

  const iirPresets = [
    ['MDN_200Hz', {
      frequency: 200,
      feedforward: [0.00020298, 0.0004059599, 0.00020298],
      feedback: [1.0126964558, -1.9991880801, 0.9873035442]
    }],
    ['MDN_500Hz', {
      frequency: 500,
      feedforward: [0.0012681742, 0.0025363483, 0.0012681742],
      feedback: [1.0317185917, -1.9949273033, 0.9682814083]
    }],
    ['MDN_1kHz', {
      frequency: 1000,
      feedforward: [0.0050662636, 0.0101325272, 0.0050662636],
      feedback: [1.0632762845, -1.9797349456, 0.9367237155]
    }],
    ['MDN_5kHz', {
      frequency: 5000,
      feedforward: [0.1215955842, 0.2431911684, 0.1215955842],
      feedback: [1.2912769759, -1.5136176632, 0.7087230241]
    }],
    ['ChebyshevLow015', {
      frequency: 1000,
      feedforward: [8.070778E-01, -3.087918E-01],
      feedback: [1.254285E-01, 2.508570E-01, 1.254285E-01]
    }],
    ['BlumishevLow025', {
      frequency: 1000,
      feedforward: [-0, -1.796421256907539, -2.8279936073965226, -2.7817789336544676, -2.062039021733585, -1.0223969430939144, -0.313152942379077],
      feedback: [0.009415444341457245, -0.05649266604874347, 0.14123166512185867, -0.1883088868291449, 0.14123166512185867, -0.05649266604874347, 0.009415444341457245]
    }],
    ['Camel', {
      frequency: 1000,
      feedforward: [0.00685858, 0.00424427, 0.01363637, 0.00939893, 0.01363637, 0.00424427,  0.00685858],
      feedback: [1 , -3.6133816 ,  6.29949582, -6.44744259,  4.04658649, -1.4649745 ,  0.23927553]
    }],
    ['rtoy440-880', {
      frequency: 440,
      feedforward: [0.015258276134058446,0.015258276134058446],
      feedback: [1,-0.9694834477318831]
    }],
    ['rtoy-peaking', {
      frequency: 440,
      feedforward: [1, -1.987759247748441, 0.989847231541518],
      feedback: [1.0013144048769818, -1.987759247748441, 0.9885328266645363]
    }],
    ['etc', {
      frequency: 440,
      feedforward: [0.015258276134058446,0.015258276134058446],
      feedback: [1,-0.9694834477318831]
    }]
  ]
  const iirPresetNames = iirPresets.map(a => [a[0], a[0]])
  const iirPresetHash = {}
  iirPresets.map(a => iirPresetHash[a[0]] = a)
  
  const [coeffMinA, coeffMaxA] = [-1, 1]
  const [coeffMinB, coeffMaxB] = [-1, 1]
      
  const IIRFx = { //8#289 --------- IIR ----------
    def: {
      preset: {defVal: iirPresetNames[0][1], type: 'strings', subType: iirPresetNames},
      a0: {defVal: 1.03, min: coeffMinA, max: coeffMaxA, subType: ''},
      a1: {defVal: -1.99, min: coeffMinA, max: coeffMaxA, subType: ''},
      a2: {defVal: .93, min: coeffMinA, max: coeffMaxA, subType: ''},
      b0: {defVal: .01, min: coeffMinB, max: coeffMaxB, subType: ''},
      b1: {defVal: .01, min: coeffMinB, max: coeffMaxB, subType: ''},
      b2: {defVal: .01, min: coeffMinB, max: coeffMaxB, subType: ''},
      reGenerate: {defVal: false, type: 'boolean'}
    },
    name: 'IIR',
    freqGraph: [
      {filter: 'IIR'}
    ]
  }
  
  IIRFx.setValue = (fx, key, value, {ext} = fx) => ({
    preset: _ => ext.loadFromPreset(value),
    a0: _ => ext.changeCoeff(key, value),
    a1: _ => ext.changeCoeff(key, value),
    a2: _ => ext.changeCoeff(key, value),
    b0: _ => ext.changeCoeff(key, value),
    b1: _ => ext.changeCoeff(key, value),
    b2: _ => ext.changeCoeff(key, value),
    reGenerate: _ => {
      console.log(`reGenerate set to`, value)
      ext.reGenerate = value
      value && ext.regenerateLive()
    }
  }[key])
  
  IIRFx.construct = (fx, {initial}) => {
    const {ext} = fx
    
    ext.a0 = 0
    ext.a1 = 0
    ext.a2 = 0
    ext.a3 = 0
    ext.b0 = 0
    ext.b1 = 0
    ext.b2 = 0
    ext.b3 = 0
    ext.feedforward = []
    ext.feedback = []
    
    ext.regeneratePreview = startEndThrottle(_ => {
      for (const coeff of [...ext.feedback, ...ext.feedforward]) {
        if (typeof coeff === Ø) {
          return console.log('INVALID PARS', ext)
        }
      }
      const timer = createPerfTimer()
      console.owarn = console.warn
      console.warn = (...args) => {
        console.log('------warn!-----')
        console.log(...args)
        console.log('------warn!-----')
      }
      try {
        ext.IIR = waCtx.createIIRFilter(ext.feedforward, ext.feedback)
      } catch (err) {
        console.warn(err)
      }
      //fx.setValue('reGenerate', false)
      console.log('********regenerated******', ext)
      console.log('********preview spent', timer.summary())
    }, 100)
    
    ext.regenerateLive = _ => {
      fx.start.disconnect()
      void ext.IIRLive?.disconnect()
      ext.IIRLive = waCtx.createIIRFilter(ext.feedforward, ext.feedback)    
      fx.start.connect(ext.IIR)
      ext.IIR.connect(fx.output)
    }
    ext.changeCoeff = (key, val = 0) => {
      ext[key] = val
      const type = key[0]
      const ix = parseInt(key[1])
      console.log({key, type, ix, val})
      type === 'a'
        ? ext.feedback[ix] = val
        : ext.feedforward[ix] = val
      ext.regeneratePreview()
    }
    
    ext.loadFromPreset = name => {
      const iirPreset = wassert(iirPresetHash[name])
      const {frequency, feedforward, feedback} = iirPreset[1]
      console.log(`IIR loading`, {frequency, feedforward, feedback})
      fx.setValue('a0', feedback[0] || 0)
      fx.setValue('a1', feedback[1] || 0)
      fx.setValue('a2', feedback[2] || 0)
      fx.setValue('b0', feedforward[0] || 0) //+ nem forditva?
      fx.setValue('b1', feedforward[1] || 0)
      fx.setValue('b2', feedforward[2] || 0)
      ext.capture({frequency, feedforward, feedback})
      //ext.regenerate()
      console.log('load sets reGen to false')
      //fx.setValue('reGenerate', false)
    }
    ext.loadFromPreset(initial.preset)
  }
  
  registerFxType('fx_IIR', IIRFx)
    
  const filterTypeNames = [
    ['lowpass', 'lowpass'],
    ['highpass', 'highpass']
  ]
  
   //8#649 --------- Chebyshev IIR ----------
  
  const chebyWarn = `☠️Warning!☢️ This is an experimental filter.<br>It can harm your audio and your ear.<br> Turn down your volume before tweaking it!`

  const chebysevIIRFx = { // user can set lo/hi, cutOffFreq, ripple % and mods for coeffs
    def: {
      warning: {defVal: chebyWarn, type: 'html'},
      filterType: {defVal: 'lowpass', type: 'strings', subType: filterTypeNames},
      cutOffFreq: {defVal: .025, min: 0, max: .5}, //.025 -> 500hz
      ripplePt: {defVal: 5, min: .1, max: 49},
      a0mod: {defVal: 100, min: 1, max: 200},
      a1mod: {defVal: 100, min: 1, max: 200},
      a2mod: {defVal: 100, min: 1, max: 200},
      a3mod: {defVal: 100, min: 1, max: 200},
      b0mod: {defVal: 100, min: 1, max: 200},
      b1mod: {defVal: 100, min: 1, max: 200},
      b2mod: {defVal: 100, min: 1, max: 200},
      b3mod: {defVal: 100, min: 1, max: 200},
      //isStable: {defVal: true, type: 'boolean', subType: 'skipui'},
      reGenerate: {defVal: false, type: 'boolean'}, // go live!
      exTerminate: {defVal: false, type: 'boolean'} // omg, kill it fast!
    },
    name: 'Chebyshev IIR',
    freqGraph: [
      {filter: 'IIR', getCurveBaseColor: fx => fx.internal.isStable ? '#4e4' : fx.internal.isDead ? '#e44' : '#e92'}
    ]
  }
  
  chebysevIIRFx.setValue = (fx, key, value, {ext} = fx) => ({
    warning: nop,
    filterType: _ => ext.changePar(key, value),
    cutOffFreq: _ => ext.changePar(key, value),
    ripplePt: _ => ext.changePar(key, value),
    reGenerate: _ => {
      console.log(`reGenerate set to`, value)
      ext.reGenerate = value
      value && ext.regenerateLive() //: if switched off (can be only manual)
    },
    exTerminate: _ => {
      console.log(`exTerminate set to`, value)
      ext.exTerminate = true
      ext.terminateLive() //: if switched off (can be only manual)
    }
  }[key] || (key.substr(2) === 'mod' ? _ => ext.changeCoeff(key, value) : null))
  
  const mergeModsWithChebyshev = (baseArr, modArr) => {
    const retArr = []
    for (let ix = 0; ix < baseArr.length; ix++) {
      const base = baseArr[ix] || 0
      const mod = modArr[ix] || 100
      retArr.push(base * mod / 100)
    }
    return retArr
  }
  
  chebysevIIRFx.construct = (fx, {initial}) => {
    fx.internal = {
      isStable: true,
      isDead: false,
      lastCheby: {}
    }
    const {ext, internal} = fx
    
    ext.feedforward = []
    ext.feedback = []
    ext.moda = []
    ext.modb = []
    
    ext.regenerateChebyshevBase = _ => {
      if (ext.cutOffFreq && ext.filterType && ext.ripplePt) {
        const {a: b, b: a} = chebyDsp(ext.cutOffFreq, ext.filterType, ext.ripplePt)
        ext.feedforward = b.filter(b => b)
        ext.feedback = a.slice(1).filter(a => a)
        internal.lastCheby.a = ext.feedback.map(x => x.toFixed(3))
        internal.lastCheby.b = ext.feedforward.map(x => x.toFixed(3))
        console.log('regenChebyBase', ext.cutOffFreq, ext.filterType, ext.ripplePt, {a, b})
        console.log('cheb a[]', internal.lastCheby.a.join(' / '))
        console.log('cheb b[]', internal.lastCheby.b.join(' / '))
      }
    }
    
    ext.regeneratePreview = startEndThrottle(_ => {
      const timer = createPerfTimer()
      ext.feedforwardMod = mergeModsWithChebyshev(ext.feedforward, ext.modb)
      ext.feedbackMod = mergeModsWithChebyshev(ext.feedback, ext.moda)
      if (ext.feedforward.length) {
        internal.isStable = isFilterStable(ext.feedbackMod)
        
        try { 
          ext.IIR = waCtx.createIIRFilter(ext.feedforwardMod, ext.feedbackMod)
        } catch (err) { console.warn(err) }
        
        fx.setValue('reGenerate', true) //:dirty bit
        console.log(`**PREVIEW ${internal.isStable ? '✔️' : '⚠️'} created**`, timer.summary(), ext)
      }
    }, 100)
    
    ext.regenerateLive = _ => {
      if (internal.isStable) {
        if (!ext.feedforwardMod.length) {
          return console.warn(`IIR cannot regenerate with empty coeff arrays`)
        }
        console.log('⚡️ IIR going live! ⚡️')
        ext.terminateLive()
        try { 
          ext.IIRLive = waCtx.createIIRFilter(ext.feedforwardMod, ext.feedbackMod)
        } catch (err) { 
          console.warn(err)
          debugger
        }
        connectArr(fx.start, ext.IIRLive, fx.output)
      }
    }
    
    ext.terminateLive = _ => {
      fx.start.disconnect()
      void ext.IIRLive?.disconnect()
    }
    
    fx.mayday = data => {
      internal.isStable = false
      internal.isDead = true
      fx.setValue('exTerminate', false)
      console.log('IIR mayday')
    }
    
    ext.changeCoeff = (key, value = 100) => {
      //ext[key] = value
      const type = key[0]
      const ix = parseInt(key[1])
      ext['mod' + type][ix] = value
      ext.regeneratePreview()
    }
    ext.changePar = (key, value) => {
      ext[key] = value
      ext.regenerateChebyshevBase()
      ext.regeneratePreview()
    }  
  }
  
  //: create 4-pole 6-pole 8-pole
  
  registerFxType('fx_chebyshevIIR', chebysevIIRFx)
})
