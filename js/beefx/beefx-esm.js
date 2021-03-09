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

const biquadOptions = [
  ['lowpass', 'lowpass [no gain]'],
  ['highpass', 'highpass [no gain]'],
  ['bandpass', 'bandpass [no gain]'],
  ['lowshelf', 'lowshelf, [no Q]'],
  ['highshelf', 'highshelf [no Q]'],
  ['allpass', 'allpass [no gain]'],
  ['notch', 'notch [no gain]'],
  ['peaking', 'peaking']
]

const shortenProps = {
  followerFilterType: 'followerFilter',
  followerFrequency: 'followerFreq',
  baseModulationFrequency: 'baseModFreq',
  feedbackRight: 'fbackRight',
  baseFrequency: 'baseFreq',
  excursionOctave: 'excursionOct.'
}

const fxNames = [ //+ ennek ursen kene kezdenie! es register addol
/*
  ['fx_blank', 'Blank'],
  ['fx_gain', 'Gain'],
  ['fx_ratio', 'Ratio'], //+ez nem valaszthato
  ['fx_delay', 'Delay'],
  ['fx_biquad', 'Biquad Filter'],
  ['fx_pitchShifter', 'Pitch Shifter'],
  ['fx_noiseConvolver', 'Noise Convolver'],
  
  ['fx_dev', 'Distortion'],
  ['fx_dev', 'Reverb'],
  ['fx_dev', 'Telephone'],
  ['fx_dev', 'Gain LFO'],
  ['fx_dev', 'Chorus'],
  ['fx_dev', 'Flange'],
  ['fx_dev', 'Ring mod'],
  ['fx_dev', 'Stereo Chorus'],
  ['fx_dev', 'Stereo Flange'],
  ['fx_dev', 'Mod Delay'],
  ['fx_dev', 'Ping-pong delay'],
  ['fx_dev', 'LFO Filter'],
  ['fx_dev', 'Envelope Follower (testing only)'],
  ['fx_dev', 'Autowah'],
  ['fx_dev', 'Noise Gate'],
  ['fx_dev', 'Wah Bass'],
  ['fx_dev', 'Distorted Wah Chorus'],
  ['fx_dev', 'Vibrato'],
  ['fx_dev', 'BitCrusher'],
  ['fx_dev', 'Apollo Quindar Tones']
  */
]

const createBeeFX = waCtx => {
  const fxHash = {}
  const beeFx = {
    fxHash,
    namesDb: {
      biquadOptions,
      fxNames
    }
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
      bypass: false,
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
      console.log('fx.setvalue', {key, value, type: typeof value})
      const fun = fx.exo.setValue(fx, key, value)
      if (fun) {
        fun()
        fx.valueChanged(key, value)
      } else {
        console.warn(`${fx.exo.name}: bad pars`, {key, value})
      }
    }
    fx.setValueAlt = (key, value) => {
      console.log('fx.setaltvalue', {key, value})
      const fun = fx.exo.setValueAlt && fx.exo.setValueAlt(fx, key, value)
      if (fun) {
        fun()
        fx.valueChanged(key, value)
      } else {
        console.warn(`setValueAlt: ${fx.exo.name}: bad pars`, {key, value})
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
    
    return fx
  }
  
  beeFx.connectArr = (...arr) => {
    const arrarr = arr.map(item => isArr(item) ? item : [item])
    
    for (let ix = 0; ix < arrarr.length - 1; ix++) {
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

    fxObj.def = fxObj.def || {}
    fxObj.name = fxObj.name || fxName[3].toUpperCase() + fxName.substr(4)
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
    fxNames.push([fxName, fxObj.name])
    fxNames.sort((a, b) => a[1] > b[1] ? 1 : -1)
    //fxNames.sort()
  }
  
  void (_ => { //: init only Once In A Lifetime
    const gain = waCtx.createGain()
    const proto = Object.getPrototypeOf(Object.getPrototypeOf(gain))
    const wauConnect = proto.connect
    const wauDisconnect = proto.disconnect
    proto.connect = shimConnect
    proto.disconnect = shimDisconnect

    function shimConnect () {
      const node = arguments[0]
      arguments[0] = node?.[pepper] ? node.input : node
      //console.log(`shimConnect`, {dis: this, arg: arguments[0]})
      wauConnect.apply(this, arguments)
      return node
    }

    function shimDisconnect () {
      const node = arguments[0]
      arguments[0] = node?.[pepper] ? node.input : node
      //console.log(`shimDisconnect`, {dis: this, arg: arguments[0]})
      wauDisconnect.apply(this, arguments)
    }
  })()
  
  return beeFx
}

let beeFx

export const BeeFX = waCtx => beeFx || (beeFx = createBeeFX(waCtx))
