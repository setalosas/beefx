/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, WaapiWrap} from '../improxy-esm.js'

const {Ø, nop, isArr, getRnd, getRndFloat, clamp} = Corelib
const {wassert} = Corelib.Debug
const {createPerfTimer, startEndThrottle} = Corelib.Tardis
const {round} = Math
const {fetch} = window

WaapiWrap.onRun(waCtx => {
  const {registerFxType, newFx, connectArr} = BeeFX(waCtx)

  const createIIRFxTypes = _ => {
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
      freqGraph: 'IIR'
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
        console.log('********regenerated******', {ff: ext.feedforward, fb: ext.feedback, a: [ext.a0, ext.a1, ext.a2], b: [ext.b0, ext.b1, ext.b2]})
        //fx.setValue('reGenerate', false)
        console.log('preview spent', timer.summary())
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
//        const [type, ix] = key.split('')
        const type = key[0]
        const ix = parseInt(key[1])
        console.log({key, type, ix, val})
        type === 'a'
          ? ext.feedback[ix] = val
          : ext.feedforward[ix] = val
          
        //ext.feedforward = [ext.b0, ext.b1, ext.b2]
        //ext.feedback = [ext.a0, ext.a1, ext.a2]
        //fx.setValue('reGenerate', true)
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
    
    //8#289 ----- IIR (Coefficienst for Chebyshev filters (cutOffFreq, poles, ripplePt, lo/hi) -----
    
    const {sin, cos, tan, pow, sqrt, log, exp, PI} = Math

    const chebyDsp = (cutOffFreq, type, ripplePt, poles = 4) => {   //poles: 2..20
      ripplePt = clamp(ripplePt, .1, 29)
      cutOffFreq = clamp(cutOffFreq, 0, .5)
      const isHp = type === 'highpass'
      
      const a = Array(22).fill(0)
      const b = Array(22).fill(0)
      a[2] = 1
      b[2] = 1
      const ta = []
      const tb = []
      
      for (let pole = 1; pole <= poles / 2; pole++)  {
        // Calculate the pole location on the unit circle
        const fi = PI / (poles * 2) + (pole - 1) * PI / poles
        let rp = -cos(fi)
        let ip = sin(fi)
        // Warp from a circle to an ellipse
        const es = sqrt(pow((100 / (100 - ripplePt)), 2) - 1)
        const vx = (1 / poles) * log((1 / es) + sqrt(pow((1 / es), 2) + 1))
        let kx = (1 / poles) * log((1 / es) + sqrt(pow((1 / es), 2) - 1))
        kx = (exp(kx) + exp(-kx)) / 2
        rp = rp * ((exp(vx) - exp(-vx)) / 2) / kx
        ip = ip * ((exp(vx) + exp(-vx)) / 2) / kx
        console.log({rp, ip, es, vx, kx})
        // s-domain to z-domain conversion
        const t = 2 * tan(.5)
        const w = 2 * PI * cutOffFreq
        const m = rp * rp + ip * ip
        const d = 4 - 4 * rp * t + m * t * t
        const x0 = t * t / d
        const x1 = 2 * t * t / d
        const x2 = t * t / d
        const y1 = (8 - 2 * m * t * t) / d
        const y2 = (-4 - 4 * rp * t - m * t * t) / d
        console.log({t, w, m, d, x0, x1, x2, y1, y2})

        const k = isHp ? -cos(w / 2 + .5) / cos(w / 2 - .5) : sin(.5 - w / 2) / sin(.5 + w / 2)
        const kk = k * k
        const e = 1 + y1 * k - y2 * kk
        const a0 = (x0 - x1 * k  + x2 * kk) / e
        let a1 = (-2 * x0 * k + x1 + x1 * kk - 2 * x2 * k) / e
        const a2 = (x0 * kk - x1 * k + x2) / e
        let b1 = (2 * k + y1 + y1 * kk - 2 * y2 * k) / e
        const b2 = (-kk - y1 * k + y2) / e
        isHp && (a1 = -a1)
        isHp && (b1 = -b1)
        console.log({e, kk, a0, a1, a2, b1, b2})
        
        for (let i = 0; i < 22; i++) { // Add coefficients to the cascade
          ta[i] = a[i]
          tb[i] = b[i]
        }
        for (let i = 2; i < 22; i++) {
          a[i] = a0 * ta[i] + a1 * ta[i - 1] + a2 * ta[i - 2]
          b[i] = tb[i] - b1 * tb[i - 1] - b2 * tb[i - 2]
        }
      }
      b[2] = 0  // Finish combining coefficients
        
      for (let i = 0; i < 20; i++) {
        a[i] = a[i + 2]
        b[i] = -b[i + 2]
      }
      let [sa, sb] = [0, 0] // NORMALIZE THE GAIN
      let signedOne = -1
      for (let i = 0; i < 20; i++) {
        signedOne = isHp ? signedOne * -1 : 1
        sa += a[i] * signedOne
        sb += b[i] * signedOne
      }
      const gain = sa / (1 - sb)
      
      for (let i = 0; i < 20; i++) {
        a[i] /= gain // The final recursion coefficients are in A[ ] and B[ ]
      }
      a[0] = 1
      console.log({sa, sb, gain}, a, b)
      return {a, b}
    }
    //chebyDsp(.15, 'highpass', 10, 4) // test
    
    const filterTypeNames = [
      ['lowpass', 'lowpass'],
      ['highpass', 'highpass']
    ]

    const chebysevIIRFx = { // user can set lo/hi, cutOffFreq, ripple % and mods for coeffs
      def: {
        filterType: {defVal: 'lowpass', type: 'strings', subType: filterTypeNames},
        cutOffFreq: {defVal: .25, min: 0, max: .5},
        ripplePt: {defVal: 5, min: .1, max: 29},
        a0mod: {defVal: 100, min: 1, max: 200},
        a1mod: {defVal: 100, min: 1, max: 200},
        a2mod: {defVal: 100, min: 1, max: 200},
        b0mod: {defVal: 100, min: 1, max: 200},
        b1mod: {defVal: 100, min: 1, max: 200},
        b2mod: {defVal: 100, min: 1, max: 200},
        reGenerate: {defVal: false, type: 'boolean'}, // go live!
        exTerminate: {defVal: false, type: 'boolean'} // omg, kill it fast!
      },
      name: 'Chebyshev IIR',
      freqGraph: 'IIR'
    }
    
    chebysevIIRFx.setValue = (fx, key, value, {ext} = fx) => ({
      filterType: _ => ext.changePar(key, value),
      cutOffFreq: _ => ext.changePar(key, value),
      ripplePt: _ => ext.changePar(key, value),
      a0mod: _ => ext.changeCoeff(key, value),
      a1mod: _ => ext.changeCoeff(key, value),
      a2mod: _ => ext.changeCoeff(key, value),
      b0mod: _ => ext.changeCoeff(key, value),
      b1mod: _ => ext.changeCoeff(key, value),
      b2mod: _ => ext.changeCoeff(key, value),
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
    }[key])
    
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
      const {ext} = fx
      
      ext.feedforward = []
      ext.feedback = []
      ext.moda = []
      ext.modb = []
      
      ext.regenerateChebyshevBase = _ => {
        console.log('regenChebyBase', ext.cutOffFreq, ext.filterType, ext.ripplePt)
        if (ext.cutOffFreq && ext.filterType && ext.ripplePt) {
          const {a, b} = chebyDsp(ext.cutOffFreq, ext.filterType, ext.ripplePt)
          ext.feedforward = b.filter(b => b)
          ext.feedback = a.filter(a => a)
        }
      }
      
      ext.regeneratePreview = startEndThrottle(_ => {
        const timer = createPerfTimer()
        ext.feedforwardMod = mergeModsWithChebyshev(ext.feedforward, ext.modb)
        ext.feedbackMod = mergeModsWithChebyshev(ext.feedback, ext.moda)
        if (ext.feedforward.length) {
          try { 
            ext.IIR = waCtx.createIIRFilter(ext.feedforwardMod, ext.feedbackMod)
          } catch (err) { console.warn(err) }
          console.log('**PREVIEW created**', {ff: ext.feedforwardMod, fb: ext.feedbackMod}, ext)
          fx.setValue('reGenerate', true) //:dirty bit
          console.log('**PREVIEW spent:', timer.summary())
        }
      }, 100)
      
      ext.regenerateLive = _ => {
        ext.terminateLive()
        try { 
          ext.IIRLive = waCtx.createIIRFilter(ext.feedforwardMod, ext.feedbackMod)
        } catch (err) { console.warn(err) }
        fx.start.connect(ext.IIR)
        ext.IIR.connect(fx.output)
      }
      
      ext.terminateLive = _ => {
        fx.start.disconnect()
        void ext.IIRLive?.disconnect()
      }
      
      ext.changeCoeff = (key, value = 100) => {
        ext[key] = value
        const type = key[0]
        const ix = parseInt(key[1])
        console.log({key, type, ix, value})
        ext['mod' + type][ix] = value
        ext.regeneratePreview()
      }
      ext.changePar = (key, value) => {
        ext[key] = value
        ext.regenerateChebyshevBase()
        ext.regeneratePreview()
      }  
    }
    
    registerFxType('fx_chebyshevIIR', chebysevIIRFx)
  }
  
  createIIRFxTypes()
})

/* Original Chebyshev algorithm from dspguide.com:

100 'CHEBYSHEV FILTER- RECURSION COEFFICIENT CALCULATION
110 '
120 'INITIALIZE VARIABLES
130 DIM A[22] 'holds the "a" coefficients upon program completion
140 DIM B[22] 'holds the "b" coefficients upon program completion
150 DIM TA[22] 'internal use for combining stages
160 DIM TB[22] 'internal use for combining stages
170 '
180 FOR I% = 0 TO 22
190 A[I%] = 0
200 B[I%] = 0
210 NEXT I%
220 '
230 A[2] = 1
240 B[2] = 1
250 PI = 3.14159265
260 'ENTER THE FOUR FILTER PARAMETERS
270 INPUT "Enter cutoff frequency (0 to .5): ", FC
280 INPUT "Enter 0 for LP, 1 for HP filter: ", LH
290 INPUT "Enter percent ripple (0 to 29): ", PR
300 INPUT "Enter number of poles (2,4,...20): ", NP
310 '
320 FOR P% = 1 TO NP/2 'LOOP FOR EACH POLE-PAIR
330 '
  340 GOSUB 1000 'The subroutine in TABLE 20-5
  350 '
  360 FOR I% = 0 TO 22 'Add coefficients to the cascade
  370 TA[I%] = A[I%]
  380 TB[I%] = B[I%]
  390 NEXT I%
  400 '
  410 FOR I% = 2 TO 22
  420 A[I%] = A0*TA[I%] + A1*TA[I%-1] + A2*TA[I%-2]
  430 B[I%] = TB[I%] - B1*TB[I%-1] - B2*TB[I%-2]
  440 NEXT I%
450 '
460 NEXT P%
470 '
480 B[2] = 0 'Finish combining coefficients
490 FOR I% = 0 TO 20
500 A[I%] = A[I%+2]
510 B[I%] = -B[I%+2]
520 NEXT I%
530 '
540 SA = 0 'NORMALIZE THE GAIN
550 SB = 0
560 FOR I% = 0 TO 20
570 IF LH = 0 THEN SA = SA + A[I%]
580 IF LH = 0 THEN SB = SB + B[I%]
590 IF LH = 1 THEN SA = SA + A[I%] * (-1)^I%
600 IF LH = 1 THEN SB = SB + B[I%] * (-1)^I%
610 NEXT I%
620 '
630 GAIN = SA / (1 - SB)
640 '
650 FOR I% = 0 TO 20
660 A[I%] = A[I%] / GAIN
670 NEXT I%
680 ' 'The final recursion coefficients are in A[ ] and B[ ]
690 END

1000 'THIS SUBROUTINE IS CALLED FROM TABLE 20-4, LINE 340
1010 '
1020 ' Variables entering subroutine: PI, FC, LH, PR, HP, P%
1030 ' Variables exiting subroutine: A0, A1, A2, B1, B2
1040 ' Variables used internally: RP, IP, ES, VX, KX, T, W, M, D, K,
1050 ' X0, X1, X2, Y1, Y2
1060 '
1070 ' 'Calculate the pole location on the unit circle
1080 RP = -COS(PI/(NP*2) + (P%-1) * PI/NP)
1090 IP = SIN(PI/(NP*2) + (P%-1) * PI/NP)
1100 '
1110 ' 'Warp from a circle to an ellipse
1120 IF PR = 0 THEN GOTO 1210
1130 ES = SQR( (100 / (100-PR))^2 -1 )
1140 VX = (1/NP) * LOG( (1/ES) + SQR( (1/ES^2) + 1) )
1150 KX = (1/NP) * LOG( (1/ES) + SQR( (1/ES^2) - 1) )
1160 KX = (EXP(KX) + EXP(-KX))/2
1170 RP = RP * ( (EXP(VX) - EXP(-VX) ) /2 ) / KX
1180 IP = IP * ( (EXP(VX) + EXP(-VX) ) /2 ) / KX
1190 '
1200 ' 's-domain to z-domain conversion
1210 T = 2 * TAN(1/2)
1220 W = 2*PI*FC
1230 M = RP^2 + IP^2
1240 D = 4 - 4*RP*T + M*T^2
1250 X0 = T^2/D
1260 X1 = 2*T^2/D
1270 X2 = T^2/D
1280 Y1 = (8 - 2*M*T^2)/D
1290 Y2 = (-4 - 4*RP*T - M*T^2)/D
1300 '
1310 ' 'LP TO LP, or LP TO HP transform
1320 IF LH = 1 THEN K = -COS(W/2 + 1/2) / COS(W/2 - 1/2)
1330 IF LH = 0 THEN K = SIN(1/2 - W/2) / SIN(1/2 + W/2)
1340 D = 1 + Y1*K - Y2*K^2
1350 A0 = (X0 - X1*K + X2*K^2)/D
1360 A1 = (-2*X0*K + X1 + X1*K^2 - 2*X2*K)/D
1370 A2 = (X0*K^2 - X1*K + X2)/D
1380 B1 = (2*K + Y1 + Y1*K^2 - 2*Y2*K)/D
1390 B2 = (-(K^2) - Y1*K + Y2)/D
1400 IF LH = 1 THEN A1 = -A1
1410 IF LH = 1 THEN B1 = -B1
1420 '
1430 RETURN
*/
