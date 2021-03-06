/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */

import {Corelib} from '../improxy-esm.js'

//8#a48 Patashnik Tuna Experiment

const {Ø, undef, getRnd, nop, s_a} = Corelib
const {wassert, weject, brexru} = Corelib.Debug

const toExp = val => Math.pow(Math.E, val)
const fromExp = val => Math.log(val)

const createBeeFX = waCtx => {
  const fxHash = {}
  const beeFx = {
    fxHash
  }
    
  const pepper = 'zholger'

  const newFxBase = host => {
    const fx = {
      [pepper]: true,
      input: waCtx.createGain(),
      start: waCtx.createGain(),
      output: waCtx.createGain(),
      isRelaxed: false,
      bypass: false,
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
    }
    fx.deactivate = _ => fx.activate(false)
    
    fx.relax = _ => fx.isRelaxed = true
    fx.revive = _ => fx.isRelaxed = false
    
    fx.setAt = (node, key, value, par) =>
      fx.ext[node][key].setTargetAtTime(value, waCtx.currentTime, .01)
    
    fx.setValue = (key, value) => {
      const fun = fx.exo.setValue(fx, key, value)
      if (fun) {
        fun()
        fx.live[key] = value
      } else {
        console.warn(`${fx.exo.name}: bad pars`, {key, value})
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
    
    return fx
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
  
  const initPars = (fx, pars) => {
    const {exo} = fx
    const {initial = {}, options = {}} = pars
    fx.live = {}
    for (const key in exo.def) {
      const {defVal = 0} = exo.def[key]
      initial[key] = merge(defVal, initial[key])
      //fx.setValue(key, merge(defVal, initial[key]))
      //fx.live[key] = typeof initial[key] !== 'undefined' ? initial[key] : defVal
    }
    pars.initial = initial
  }

  beeFx.newFx = (type, pars = {}) => {
    if (!fxHash[type]) {
      console.warn(`newFx: no fx with name [${type}]`)
      debugger
      return null
    }
    const fx = newFxBase()
    fx.exo = fxHash[type] //: exo = {..., def, construct, ...}
    initPars(fx, pars)        //: changes or creates pars.initial
    fx.exo.construct(fx, pars) //: not using return value
    fx.input.connect(fx.start)
    
    //+randomize! reset!
    
    return fx  
  }
  
  beeFx.registerFxType = (fxName, fxObj) => {
    if (fxHash[fxName]) {
      console.warn(`registerFx: ${fxName} has been already registered, will skip.`)
      debugger
      return
    }
    fxHash[fxName] = fxObj
    fxObj.def = fxObj.def || {}
    fxObj.name = fxName
    for (const key in fxObj.def) {
      const par = fxObj.def[key]
      par.type = par.type || 'float'
      par.name = par.name || key
      if (par.subType === 'exp') {
        par.isExp = true
        par.linMin = fromExp(par.min)
        par.linMax = fromExp(par.max)
        par.linDefVal = fromExp(par.defVal)
      }
    }
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
      console.log(`shimDisconnect`, {dis: this, arg: arguments[0]})
      wauDisconnect.apply(this, arguments)
    }
  })()
  
  return beeFx
}

let beeFx

export const BeeFX = waCtx => beeFx || (beeFx = createBeeFX(waCtx))
