/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */

import {Corelib, createBeeDebug} from './beeproxy-esm.js'

const {isFun, isArr, clamp, merge} = Corelib
const {wassert} = Corelib.Debug
const {round, pow, max} = Math

const toExp = val => pow(Math.E, val)
const fromExp = val => Math.log(val)

const createBeeFX = waCtx => {
  const debug = createBeeDebug(waCtx)
  
  const nowa = (add = 0) => waCtx.currentTime + add
  
  const config = {
    useSetTargetForDelayTime: true //: this is not evident (linearRamp should be included too)
  }
  const fxNames = []
  const fxHash = {}
  const beeFx = {
    fxHash,
    namesDb: {
      fxNames
    },
    nowa,
    readyPromises: [],  //: promises registered by Fxs, we have to wait for them at start
    logConnects: false,
    logDisconnects: false,
    logSetValue: false,
    debug
  }
  
  window.beedump = debug.dump
  
  const pepper = 'zholger'
  let pepuid = 1

  const newFxBase = (type, exo) => {
    const fx = {
      [pepper]: pepuid++ + '.' + type,
      input: waCtx.createGain(),
      start: waCtx.createGain(),
      output: waCtx.createGain(),
      isRelaxed: false,
      isActive: false,
      listenersByKey: {},
      exo,     //: fxHash[type] - 'class' of the fx, the fx type definition object
      int: {}, //: the fx instance's internal data, e.g. the nodes & internal vars are here
      atm: {}, //: actual param values, externally accessible part of the fx state
               //: normally accessed through get/setValue
      past: {} //: previous values of atm (not used ATM)    
    }
    const {def} = exo //: shortcut
      
    debug.addFx(fx)
    
    fx.connect = dest => fx.output.connect(dest[pepper] ? dest.input : dest)
    
    fx.disconnect = dest => fx.output.disconnect(dest?.[pepper] ? dest.input : dest)
      
    fx.activate = (on = true) => {
      if (fx.isActive !== on) {
        fx.isActive = on
        
        if (exo.activate) { //: eg LFO and EnvFollower have their own
          exo.activate(fx, on)
        } else {
          fx.input.disconnect()
          fx.input.connect(on ? fx.start : fx.output)
          //: activate: input -> start
          //: deactivate: input -> output (don't break the audio chain)
        }
        void exo.onActivated?.(fx, on)
      }
    }
    fx.deactivate = _ => fx.activate(false)
    
    fx.relax = _ => fx.isRelaxed = true //: not used, but will be (performance!)
    fx.revive = _ => fx.isRelaxed = false
    
    fx.setAt = (node, key, value) => fx.int[node][key].setTargetAtTime(value, nowa(), .01)
    
    if (debug.checkSetAt) { //: override if testing
      fx.setAt = (node, key, value) => {
        wassert(fx?.int?.[node]?.[key])
        fx.int[node][key].setTargetAtTime(value, nowa(), .01)
      }
    }
    
    //: Have to find out the optimal way of setting delayTime (probably it depends on use case)
      
    fx.setDelayTime = (node, sec) => config.useSetTargetForDelayTime
      ? fx.setAt(node, 'delayTime', sec)
      : fx.int[node].delayTime.value = sec
      
    fx.setDelayTime = (node, sec) => fx.int[node].delayTime.linearRampToValueAtTime(sec, nowa(.2))  

    //8#34c------ Parameter change listeneres --------
    
    fx.onValueChange = (key, callback) => {
      fx.listenersByKey[key] || (fx.listenersByKey[key] = [])
      fx.listenersByKey[key].push(callback)
    }
    const callListenerArray = (cbarr = [], key, value) => {
      for (const callback of cbarr) {
        wassert(isFun(callback))
        callback(key, value)
      }
    }
    fx.valueChanged = (key, value = fx.atm[key]) => {
      callListenerArray(fx.listenersByKey[key])
      callListenerArray(fx.listenersByKey.all)
    }
    
    //8#368------- Basic parameter access (set/get) --------
    
    fx.setValue = (key, value) => {
      beeFx.logSetValue && console.log(`➔fx.setvalue ${exo.fxName}.${key}`, {value})
        
      fx.past[key] = fx.atm[key]
      fx.atm[key] = value
      
      //: This is way too concise and unreadable. Refakt: separate the array branch.
      
      const {arrayKey = key, ix = -1, type} = def[key]
      if (type !== 'graph') {
        const fun = exo.setValue(fx, arrayKey, arrayKey === key ? value : [ix, value])
        if (fun) {
          fun()
          fx.valueChanged(key, value)
        } else {
          console.warn(`${exo.name}: bad pars`, {key, value})
        }
      }
    }
    fx.setValueIf = (key, value) => fx.atm[key] !== value && fx.setValue(key, value)

    fx.getValue = key => fx.atm[key]
    
    //8#c88------- Linear-exponential conversion (set/get) --------
    
    fx.setLinearValue = (key, val) => fx.setValue(key, def[key].isExp ? toExp(val) : val)

    fx.getLinearValues = key => {
      const parO = def[key]
      if (parO.isExp) {
        const {linMin: min, linMax: max, linDefVal: defVal} = parO
        const val = fromExp(fx.getValue(key))
        return {min, max, defVal, val}
      } else {
        const {min, max, defVal} = parO
        return {min, max, defVal, val: fx.getValue(key)}
      }
    }
    
    //8#1a6------- Arrays (set/get) --------
    
    fx.setValueArray = (key, srcArr) => {
      const par = def[key]

      wassert(par.arrayIx && !par.arrayKey)
      
      const [amin, amax] = par.arrayIx
      for (let ix = amin; ix <= amax; ix++) {
        fx.setValue(key + `[${ix}]`, srcArr[ix] || 0)
      }
    }
    
    fx.getValueArray = key => {
      const par = def[key]
      const ret = []
      
      wassert(par.arrayIx && !par.arrayKey)

      const [amin, amax] = par.arrayIx
      for (let ix = amin; ix <= amax; ix++) {
        ret[ix] = fx.atm[key + `[${ix}]`]
      }
      return ret
    }
    
    //8#892------- Getter helpers --------
    
    fx.getName = _ => exo.name
    fx.getShortName = _ => exo.name.substr(3) //+ this is bugged, check who calls this!
    fx.getPepper = _ => fx[pepper]
    fx.getPepperDebug = _ => 
      fx[pepper] + ` ${fx.input.__resource_id__}->${fx.output.__resource_id__}`
    
    //8#a72------- Fx initialization --------    
    
    fx.initPars = pars => {
      const {initial = {}} = pars
      for (const key in def) {
        const {defVal = 0} = def[key]
        initial[key] = merge(defVal, initial[key])
      }
      fx.atm = {}
      fx.preloadPars(initial)
      pars.initial = initial
    }
    
    fx.preloadPars = pars => {
      for (const key in pars) {
        fx.atm[key] = pars[key]
      }
    }
    
    fx.setWithPars = pars => {
      for (const key in pars) {
        fx.setValue(key, pars[key])
      }
    }
    
    //8#879-------Fx state (get/set) --------
    
    //: There is no way to avoid Fx-level definition of which state vars should be saved.
    //: This is a rough try to make it automatic, with half-success.
    //: Two methods to consider: (or four)
    //: 1. Save nothing. Fx defs can whitelist what they need to save.
    //: 2. Save everything available. Fx defs can blacklist what they don't want.
    //: 3. Set a default behaviour by type, that can be modified (black & white) by the Fx defs.
    //:    Actually this last one is what we are doing now - except the B&W part.
    //:    First we have to figure out what is the optimal default behaviour by type.
    //:    E.g. for cmds: they control and display complext internal fx states - save or not?
    //:    (Oscilloscope cmds must be saved - IIR autoGen cmd state cannot be saved.)
    //:    (So we try this now: save all cmds, but IIR explicite disables autoGen save.)
    
    fx.getFullState = _ => { //: except: info boxes, graphs
      const {atm, isActive} = fx
      const atmState = {}
      for (const key in def) {
        const {type, dontSave = false} = def[key]
        if (!['graph', 'html', 'info', 'box'].includes(type) && !dontSave) {
          atmState[key] = atm[key]
        }
      }
      const state = {
        fxName: exo.fxName,
        isActive,
        atmState
      }
      return state
    }
    
    fx.restoreFullState = state => {
      const {isActive, atmState} = state
      fx.setWithPars(atmState) //: restore only (subset of) the externally observable state
      fx.activate(isActive)
    }
    
    return fx  //: created!
  }
  
  //8#c69 -------- BeeFX interface --------
  
  beeFx.concatAudioBuffers = (buf1, buf2) => {
    if (!buf1) {
      return buf2 
    }
    wassert(buf2)
    const {numberOfChannels} = buf1
    const tmp = waCtx.createBuffer(numberOfChannels, buf1.length + buf2.length, buf1.sampleRate)
  
    for (let i = 0; i < numberOfChannels; i++) {
      const data = tmp.getChannelData(i)
      data.set(buf1.getChannelData(i))
      data.set(buf2.getChannelData(i), buf1.length)
    }
    return tmp
  }
  
  //: This is messy yet (the second url should be /)
  
  beeFx.getRootPath = _ => //: full url 'cause of youtube
    window.location.host === 'www.youtube.com' ? '//beefx.mork.work/' : '//beefx.mork.work/' //  '/'
  
  beeFx.getPresetPath = sub => beeFx.getRootPath() + 'pres/' + sub 
  beeFx.getJsPath = sub => beeFx.getRootPath() + 'js/' + sub
  
  beeFx.dB2Gain = db => max(0, round(1000 * pow(2, db / 6)) / 1000)
  
  beeFx.gain2dB = gain => clamp(round(Math.log2(gain) * 6 * 1000) / 1000, -60, 60)
  
  beeFx.connectArr = (...arr) => { //: array item in arr: node + in/out index
    const arrarr = arr.map(item => isArr(item) ? item : [item])
    
    for (let ix = 0; ix < arrarr.length - 1; ix++) {
      arrarr[ix][0].connect(...arrarr[ix + 1])
    }
  }

  beeFx.newFx = (type, pars = {}) => { //: pars: {initial, optional} -> change this to one object!
    if (!fxHash[type]) {
      console.warn(`newFx: no fx with name [${type}]`)
      debugger
      return
    }
    const fx = newFxBase(type, fxHash[type]) //: par2: exo = {..., def, construct, ...}
    const {optional = {activate: true}} = pars
    fx.initPars(pars)            //: changes/creates pars.initial, loads atm (but won't call set!)
    fx.exo.construct(fx, pars)   //: not using return value
    fx.setWithPars(pars.initial) //: this will call setValue methods
    fx.activate(optional.activate) //: we will activate the new fx (unless disabled in pars)
    
    //:TODO: reset, optional TODO: randomize
    
    return fx  
  }
  
  beeFx.getFxType = fxname => fxHash[fxname]
  
  beeFx.onReady = _ => Promise.all(beeFx.readyPromises)

  beeFx.registerFxType = (fxName, fxObj) => {
    if (fxHash[fxName]) {
      console.warn(`registerFx: ${fxName} has been already registered, will skip.`)
      debugger
      return
    }
    fxObj.fxName = fxName
    wassert(fxObj.def)
    fxObj.def = fxObj.def || {}
    fxObj.promises && beeFx.readyPromises.push(...fxObj.promises)
    fxObj.name = fxObj.name || fxName[3].toUpperCase() + fxName.substr(4)
    if (fxObj.fxNamesDb) {
      for (const db in fxObj.fxNamesDb) {       //: this is for the ui only
        beeFx.namesDb[db] = fxObj.fxNamesDb[db] //: other fxs cannot use this (no init order)
      }
    }
    let hasArray = false //: reorder the parameter definition object - shaky
    for (const key in fxObj.def) {
      const par = fxObj.def[key]
      if (par.arrayIx) {
        hasArray = true
        const [amin, amax] = par.arrayIx
        for (let ix = amin; ix <= amax; ix++) {
          const newDef = {...par, arrayKey: key, ix}
          fxObj.def[key + `[${ix}]`] = newDef
        }
        par.skipUi = true
      } else if (hasArray) {
        delete fxObj.def[key]
        fxObj.def[key] = par
      }
    }
    for (const key in fxObj.def) {
      const par = fxObj.def[key]
      par.type = par.type || 'float'
      par.name = par.name || key
      par.short = par.uiLabel || par.name
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
      fxNames.sort((a, b) => a[1] > b[1] ? 1 : -1) //: [1] for the Human name (0 is fx_...)
    }
  }
  
  //8#e92------- Connect/disconnect override --------
    
  void (_ => { //: init only Once In A Lifetime
    const gain = waCtx.createGain()
    const proto = Object.getPrototypeOf(Object.getPrototypeOf(gain)) //: From Tuna. I don't get it.
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
      try {
        wauConnect.apply(this, arguments)
      } catch (err) {
        console.log(node, arguments)
        console.error(err)
        debugger
      }
      debug.addCon(this, arguments[0])
      return node
    }

    function shimDisconnect () {
      const node = arguments[0]
      arguments[0] = node?.[pepper] ? node.input : node
      dc++
      beeFx.logDisconnects && console.log(`shimDisconnect`, {dc, from: this, to: arguments[0]})
      try {
        wauDisconnect.apply(this, arguments)
      } catch (err) {
        console.log(node, arguments)
        console.error(err)
        debugger
      }
      debug.addDisco(this, arguments[0])
    }
  })()
  
  return beeFx
}

let beeFx

export const BeeFX = waCtx => beeFx || (beeFx = createBeeFX(waCtx))
