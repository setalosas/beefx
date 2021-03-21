/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */

import {Corelib} from '../improxy-esm.js'

const {Ø, undef, isFun, isArr, getRnd, nop, s_a} = Corelib
const {wassert, weject, brexru} = Corelib.Debug

const toExp = val => Math.pow(Math.E, val)
const fromExp = val => Math.log(val)

const shortenProps = {
  followerFilterType: 'followerFilter',
  followerFrequency: 'followerFreq',
  baseModulationFrequency: 'baseModFreq',
  feedbackRight: 'fbackRight',
  baseFrequency: 'baseFreq',
  excursionOctaves: 'excursionOct',
  pitchCorrection: 'autoTune'
}

const fxNames = []

const createBeeFX = waCtx => {
  const fxHash = {}
  const beeFx = {
    fxHash,
    namesDb: {
      fxNames
    },
    logConnects: false,
    logDisconnects: false,
    logSetValue: true,
    logSetValueAlt: true
  }
    
  const pepper = 'zholger'
  let uid = 1

  const newFxBase = type => {
    const fx = {
      [pepper]: uid++ + '.' + type,
      input: waCtx.createGain(),
      start: waCtx.createGain(),
      output: waCtx.createGain(),
      isRelaxed: false,
      isActive: false,
      //bypass: false,
      listenersByKey: {},
      exo: {}, //fxHash[type]
      ext: {}, //instance's filters are here
      live: {} //actual param values, accessed only from the base
    }
    
    fx.connect = dest => fx.output.connect(dest[pepper] ? dest.input : dest)
    
    fx.disconnect = dest => {
      dest
        ? fx.output.disconnect(dest[pepper] ? dest.input : dest)
        : fx.output.disconnect()
    }
    
    fx.activate = (on = true) => {
      if (fx.isActive !== on) {
        fx.isActive = on
        
        if (fx.exo.activate) {
          fx.exo.activate(fx, on)
        } else {
          fx.input.disconnect()
          if (on) {
            fx.input.connect(fx.start)
          } else {
            fx.input.connect(fx.output)
          }
          // activate: input -> start (same as tuna - start = activateNode)
          // deactivate: input -> output (same as tuna)
        }
        fx.exo.onActivated && fx.exo.onActivated(fx, on)
      }
    }
    fx.deactivate = _ => fx.activate(false)
    
    fx.relax = _ => fx.isRelaxed = true
    fx.revive = _ => fx.isRelaxed = false
    
    fx.setAt = (node, key, value, par) =>
      fx.ext[node][key].setTargetAtTime(value, waCtx.currentTime, .01)
    
    fx.onValueChange = (key, callback) => {
      fx.listenersByKey[key] || (fx.listenersByKey[key] = [])
      fx.listenersByKey[key].push(callback)
    }
    const callListenerArray = (cbarr, key, value) => {
      if (cbarr) {
        for (const callback of cbarr) {
          wassert(isFun(callback))
          callback(key, value)
        }
      }
    }
    fx.valueChanged = (key, value) => {
      fx.live[key] = value
      callListenerArray(fx.listenersByKey[key])
      callListenerArray(fx.listenersByKey.all)
    }
    fx.setValue = (key, value) => {
      beeFx.logSetValue && 
        console.log(`➔fx.setvalue ${fx.exo.fxName}.${key}`, {value, type: typeof value})
      const fun = fx.exo.setValue(fx, key, value)
      if (fun) {
        fun()
        fx.valueChanged(key, value)
      } else {
        console.warn(`${fx.exo.name}: bad pars`, {key, value})
      }
    }
    fx.setValueIf = (key, value) => fx.live[key] !== value && fx.setValue(key, value)

    fx.setValueAlt = (key, value) => {
      beeFx.logSetValueAlt &&
        console.log('⇨fx.setaltvalue', {key, value})
      const fun = fx.exo.setValueAlt && fx.exo.setValueAlt(fx, key, value)
      if (fun) {
        fun()
        fx.valueChanged(key, value)
      } else {
        console.error(`setValueAlt: ${fx.exo.name}: bad pars`, {key, value})
        debugger
      }
    }
    
    fx.setLinearValue = (key, val) => {
      const parO = fx.exo.def[key]
      if (parO.isExp) {
        fx.setValue(key, toExp(val))
      } else {
        fx.setValue(key, val)
      }
    }
    fx.getLinearValues = key => {
      const parO = fx.exo.def[key]
      if (parO.isExp) {
        const {linMin: min, linMax: max, linDefVal: defVal} = parO //: defVal?
        const val = fromExp(fx.getValue(key))
        return {min, max, defVal, val}
      } else {
        const {min, max, defVal} = parO
        return {min, max, defVal, val: fx.getValue(key)}
      }
    }
    
    fx.getValue = key => fx.live[key]
    
    fx.getName = _ => fx.exo.name
    fx.getShortName = _ => fx.exo.name.substr(3)
    
    fx.getPepper = _ => fx[pepper]
    
    fx.initPars = pars => {
      const {exo} = fx
      const {initial = {}, options = {}} = pars
      fx.live = {}
      for (const key in exo.def) {
        const {defVal = 0} = exo.def[key]
        initial[key] = merge(defVal, initial[key])
        //initial[key] = typeof initial[key] !== 'undefined' ? initial[key] : defVal
      }
      pars.initial = initial
    }
    
    fx.setWithPars = pars => {
      for (const key in pars) {
        fx.setValue(key, pars[key])
      }
    }
    
    fx.getFullState = _ => {
      const {ext, exo, live, isActive} = fx
      const state = {
        fxName: exo.fxName,
        isActive,
        live
      }
      return state
    }
    
    fx.restoreFullState = state => {
      const {isActive, live} = state
      fx.setWithPars(live) //: only the externally observable state can be restored, not the internal
      fx.activate(isActive)
    }
    
    return fx
  }
  
  beeFx.connectArr = (...arr) => { //: array item in arr: node + in/out index
    const arrarr = arr.map(item => isArr(item) ? item : [item])
    
    for (let ix = 0; ix < arrarr.length - 1; ix++) {
      //console.log(`connectArr calls connect()`, arrarr[ix + 1])
      arrarr[ix][0].connect(...arrarr[ix + 1])
    }
  }
  
  const merge = (f, a = f) => a
  
  const mergetest = _ => {
    const [a, b, c, d, e, f] = 'abcd'.split('')
    console.log('merge test a, b', {a, b, x: merge(a, b)})
    console.log('merge test b, a', {b, a, x: merge(b, a)})
    console.log('merge test a, e', {a, e, x: merge(a, e)})
    console.log('merge test e, b', {e, b, x: merge(e, b)})
    console.log('merge test e, f', {e, f, x: merge(e, f)})
    console.log('merge test f, a', {f, a, x: merge(f, a)})
  }
  //mergetest()
  
  beeFx.newFx = (type, pars = {}) => {
    if (!fxHash[type]) {
      console.warn(`newFx: no fx with name [${type}]`)
      debugger
      return null
    }
    const fx = newFxBase(type)
    fx.exo = fxHash[type] //: exo = {..., def, construct, ...}
    fx.initPars(pars)        //: changes or creates pars.initial
    fx.exo.construct(fx, pars) //: not using return value
    fx.setWithPars(pars.initial)
    fx.activate()
    
    //+randomize! reset!
    
    return fx  
  }
  
  beeFx.registerFxType = (fxName, fxObj) => {
    if (fxHash[fxName]) {
      console.warn(`registerFx: ${fxName} has been already registered, will skip.`)
      debugger
      return
    }
    fxObj.fxName = fxName
    fxObj.def = fxObj.def || {}
    fxObj.name = fxObj.name || fxName[3].toUpperCase() + fxName.substr(4)
    if (fxObj.fxNamesDb) {
      for (const db in fxObj.fxNamesDb) {
        beeFx.namesDb[db] = fxObj.fxNamesDb[db]
      }
    }
    for (const key in fxObj.def) {
      const par = fxObj.def[key]
      par.type = par.type || 'float'
      par.name = par.name || key
      par.short = shortenProps[par.name] || par.name
      if (par.subType === 'exp') {
        par.isExp = true
        par.linMin = fromExp(par.min)
        par.linMax = fromExp(par.max)
        par.linDefVal = fromExp(par.defVal)
      }
    }
    fxHash[fxName] = fxObj
    if (!fxObj.uiSelectDisabled) {
      fxNames.push([fxName, fxObj.name])
      fxNames.sort((a, b) => a[1] > b[1] ? 1 : -1)
      //fxNames.sort()
    }
  }
  const addConnectionToStats = (src, dest) => {
    //ha nincs pepper, de igazi node, adjon hozza egyet!
  }
  const addDisconnectionToStats = (src, dst) => {
    // elvileg mindenhol kell peppernek lenni, de adjon hozza egyet (ha elobb hivtak disconnectet mint connectet, lehet)
  }
  
  void (_ => { //: init only Once In A Lifetime
    const gain = waCtx.createGain()
    const proto = Object.getPrototypeOf(Object.getPrototypeOf(gain))
    const wauConnect = proto.connect
    const wauDisconnect = proto.disconnect
    proto.connect = shimConnect
    proto.disconnect = shimDisconnect
    let cc = 0
    let dc = 0

    function shimConnect () {
      const node = arguments[0]
      arguments[0] = node?.[pepper] ? node.input : node
      cc++
      beeFx.logConnects && console.log(`shimConnect`, {cc, from: this, to: arguments[0]})
      wauConnect.apply(this, arguments)
      addConnectionToStats(this, arguments[0])
      return node
    }

    function shimDisconnect () {
      const node = arguments[0]
      arguments[0] = node?.[pepper] ? node.input : node
      dc++
      beeFx.logDisconnects && console.log(`shimDisconnect`, {dc, from: this, to: arguments[0]})
      wauDisconnect.apply(this, arguments)
      addDisconnectionToStats(this, arguments[0])
    }
  })()
  
  return beeFx
}

let beeFx

export const BeeFX = waCtx => beeFx || (beeFx = createBeeFX(waCtx))

/*
beefx-basic
  - blank
  - gain
  - delay
  - biquad (kimehetne egy filtersbe)
beefx-ratio
  - ratio
beefxs-amp
  - amp
  - ampEx  
beefxs-delays
  - sima delay tunabol es ha van, wilsobol
  - pingPongDelayA /cw
  - pingPongDelayB /Tuna
beefxs-noise
  - noiseConvolver /nh
  - pinking /nh
  - bitcrusher /Tuna (script)
beefxs-reverb
  - ures, ide jonnek a convoluciok
beefxs-lfo
  - LFO /Tuna (script)
  - tremoloLFO /Tuna
  - phaserLFO /Tuna
beefxs-chorus
  - chorusLFO /Tuna
  - chorusOsc /cw
beefxs-osc
  - pitchShifter /cw
  - moog2 /cw
  - vibrato /cw
  - autoWah /cw
  - wahBass /cw // nem igazan mukodik
beefxs-bpmtrans
  - bpmtransformer  
beefxs-env
  - enveloperFollower /Tuna (script)
  - wahWahEF /Tuna
  - gain
beefxs-reverb
  - convolver /Tuna  
  - convolverGen /cw
  - reverb /cw
  - cabinet /Tuna
beefxs-compressor
  - compressor /Tuna  
tunx (mind OK)
  - FixGain
  - Blank
  - PitchShifter
  - NoiseConvolver
  - Pinking
  - Moog2
  - Vibrato
  - AutoWah 
  - PingPongDelayCW 
  - WahBass
  - MyPanner
tuna (missing)
  - Delay
  - MoogFilter  
  - Overdrive
cw
  - Delay
  - Distortion
  - Telephone
  - LFO
  - Chorus (mono & stereo?)
  - Flanger (mono & stereo?)
  - RingModulator
  - DelayChorus?
  - NoiseGate
  - Apollo
*/
