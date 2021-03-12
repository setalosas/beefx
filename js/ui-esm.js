/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, DOMplusUltra, createBiquadGrapher} from './improxy-esm.js'

const {isNum, isFun, clamp} = Corelib
const {wassert} = Corelib.Debug
const {post, startEndThrottle} = Corelib.Tardis
const {div$, leaf$, set$, canvas$} = DOMplusUltra
  
export const createUI = (config, root) => {
  const {body} = document
  
  const biquadGraph = createBiquadGrapher(root.waCtx)
  const CANVAS_SIZE = 300
  
  const aStage = {
    frame$: null,
    fxarr: []
  }

  const stageArr = []
  const ui = {stageArr}
  
  const init = _ => {  
    ui.frame$ = div$(body, {class: 'beebody' + (root.onYoutube ? ' u2' : '')}, [
      ui.top$ = div$({class: 'bfx-top'}),
      ui.bigmid$ = div$({class: 'bfx-bigmid'}, [
        ui.mainmenu$ = div$({class: 'bfx-menu'}),
        ui.mid$ = div$({class: 'bfx-mid'})
      ]),
      ui.bottom$ = div$({class: 'bfx-bottom'})//+no bottom
    ])
  }
  
  ui.addStage = stage => {
    const stageObj = {
      fxarr: []
    }
    set$(ui.mid$, {}, 
      stageObj.frame$ = div$({class: 'bfx-stage bfx-st' + (stage + 1)}, [
        stageObj.ramas$ = div$({class: 'bfx-ramas'}),
        stageObj.bottomFrame$ = div$({class: 'st-bottomframe'}, [
          stageObj.endRatio$ = div$({class: 'bfx-rama st-endratio'}),
          stageObj.spectrama$ = div$({class: 'st-spectrum'},
            stageObj.spectcanv$ = canvas$())
        ])   
      ]))

    stageArr.push(stageObj)
    return stageObj
  }
  
  ui.insertAudioPlayer = url => {
    void ui.player?.remove()
    
    set$(ui.top$, {}, 
      ui.player$ = leaf$('audio', {attr: {src: url, startVolume: .2, controls: ''}}))  
      
    return ui.player$
  }
  
  ui.insertVideoPlayer = src => { //+repalce is kell!!
    void ui.player?.remove()
    
    set$(ui.top$, {}, 
      ui.player$ = leaf$('video', {
        attr: {width: '640', height: '360', preload: 'auto', controls: '', playsinline: ''}
      }, leaf$('source', {attr: {src, type: 'video/youtube'}})))  
      
    return ui.player$
  }

  ui.konfigNames = namesDb => ui.namesDb = namesDb  
  
  ui.populateMainMenu = (pg, conf = {}) => {
    const mItems = []
    mItems.push(div$({class: 'mitem', text: 'Equalize ratios', click: pg.equalRatios}))
    mItems.push(div$({class: 'mitem', text: 'Reset', click: pg.equalRatios}))
    mItems.push(div$({class: 'mitem', text: 'Sample', click: pg.equalRatios}))
    mItems.push(div$({class: 'mitem', text: 'Random', click: pg.equalRatios}))
    mItems.push(div$({class: 'mitem', text: 'Presets', click: pg.equalRatios}))
    mItems.push(div$({class: 'mitem', text: '1 (led)... etc.', click: pg.equalRatios}))
    mItems.push(div$({class: 'mitem', text: 'Bypass beeFX', click: pg.equalRatios}))
    mItems.push(div$({class: 'mitem', text: 'Fast BeePM', click: _ => pg.recalcBpm()}))
    mItems.push(div$({class: 'mitem', text: 'Slow BPM', click: _ => pg.recalcBpm(25)}))
    mItems.push(ui.bpm$ = div$({class: 'mframe'}))
    mItems.push(ui.bpmpp$ = div$({class: 'mitem off', text: 'BPM PingPongs!', click: pg.bpmDelays}))

    set$(ui.mainmenu$, {}, mItems) 
  }
  ui.set = (key, params) => {
    const node$ = ui[key + '$']
    wassert(node$ && node$.nodeType)
    set$(node$, params)
  }
  
  const checkInput = (stage, ix) => {
    const stageObj = stageArr[stage]
    return {stageObj, fxitem: ix === -1 ? {} : stageObj.fxarr[ix] || (stageObj.fxarr[ix] = {
      fxrama$: div$(stageObj.ramas$, {class: 'bfx-rama'})
    })}
  }
  
  ui.rebuildStageEndPanel = (stage, ratioFx, pg) => {
    ui.rebuildFxPanel(stage, -1, ratioFx, pg)
  }

  ui.rebuildFxPanel = (stage, ix, fx, pg) => {
    const isEndRatio = ix === -1
    const {stageObj, fxitem} = checkInput(stage, ix)
    const fxrama$ = isEndRatio ? stageObj.endRatio$ : fxitem.fxrama$  // = stageObj.fxarr[ix]
    const fxname = fx.getName()
    fxitem.fx = fx

    const pars = {}
    const panel = {
      frame$: div$({class: 'fxr-pars'}),
      scene: null,
      isActive: true
    }
    
    const toggleActiveState = _ => {
      panel.isActive = !panel.isActive
      fxname === 'Ratio' 
        ? pg.activateStage(stage, panel.isActive)
        : fx.activate(panel.isActive)
      set$(fxrama$, panel.isActive ? {declass: 'off'} : {class: 'off'})
    }

    const addRange = (parO, name, callback, value, min, max, step = .001) => 
      parO.control$ = div$({class: 'beectrl ranger', attr: {name}}, 
        parO.input$ = leaf$('input', {attr: {type: 'range', min, max, step, value}, on: {
          input: event => callback(parseFloat(event.target.value))}}))
        
    const addCheckbox = (name, callback) => 
      div$({class: 'beectrl checker', attr: {name}}, 
        leaf$('input', {attr: {type: 'checkbox'}, on: {
          change: event => callback(event.target.value)}}))
          
    const addListSelector = (name, act, list, callback) =>
      div$({class: 'beectrl selektor sel-' + name, attr: {name}}, 
        leaf$('select', {id: 'opt_', on: {change: event => callback(event.target.value)}},
          list.map(([value, name]) => 
            leaf$('option', {text: name, attr: {value, ...(name === act ? {selected: ''} : {})}}))))
            
    const num2str = (num, maxwi = 4) => {
      /*if (type === int) {
        return round(num)
      }*/
      maxwi = clamp(maxwi, 2, 4) // 2 3 4 maxwi is valis
      const absval = Math.abs(num)
      wassert(isFun(num.toFixed))
      const str = absval >= 100 // 309 11000
        ? num.toFixed(0) : absval >= 10 // 99.78 (2)
          ? num.toFixed(maxwi - 2) : absval >= 1 // 5.437 0.939 (3)
            ? num.toFixed(maxwi - 1) : num.toFixed(maxwi - 1)
            
      return str
    }        

    const refreshDispVal = key => {
      const parO = pars[key]
      const dispVal = fx.getValue(key) //: minmaxnak is lehet dispvalja
      if (parO.type === 'float') {
        const {val} = fx.getLinearValues(key)
        if (val !== parseFloat(parO.input$.value)) {
          parO.input$.value = val
        }
        //console.log('refreshDispVal', {key, dispVal, type: typeof dispVal})
        set$(pars[key].control$, {attr: {val: num2str(dispVal)}})
      } else if (parO.type === 'boolean') {
        const val = fx.getValue(key)
        const checked = ''
        set$(parO.input$, val ? {attr: {checked}} : {deattr: {checked}})//:no val at creating
      }
      panel.scene && biquadGraph.render(panel.scene)
    }        
    const onValChanged = key => val => {
      const parO = pars[key]
      if (parO.type === 'boolean') {
        fx.setValue(key, val === 'on')
      } else {
        //console.log('onValChanged', {key, val, type: typeof val})
        fx.setLinearValue(key, val)
        //refreshDispVal(key)
      }        
    }
    const {exo} = fx
    
    for (const key in exo.def) {
      const {defVal, type, name, short, subType} = exo.def[key]
      if (type === 'skipui') {
        continue
      }
      const parO = pars[key] = {
        type, subType
      }
      if (type === 'float') {//8#97e -------- float -> input range --------
        const dispName = short + (subType === 'decibel' ? ' (dB)' : '')
        const {val, min, max} = fx.getLinearValues(key)
        addRange(parO, dispName, startEndThrottle(onValChanged(key), 30), val, min, max)
        //parO.input$ = parO.control$.children[0] //+brrrrr
      } else if (type === 'boolean') {//8#9c7 -------- boolean -> input checkbox --------
        parO.control$ = addCheckbox(short, onValChanged(key))
        parO.input$ = parO.control$.children[0] //+brrrrr
      } else {
        if (type === 'strings') {//8#ea7 --- biquad string -> select box ---
          parO.control$ = addListSelector(short, '', subType, onValChanged(key))
        } else {
          console.log({type, subType})
        }
      }
      div$(panel.frame$, {class: 'fxr-par'}, div$({class: 'fxr-parval'}, parO.control$))
      refreshDispVal(key) //: initial display
      fx.onValueChange(key, _ => refreshDispVal(key))
    }
    if (fx.ext.biquad) { //: all fxs that have a biquad
      set$(panel.frame$, {class: 'extgraph'})
      panel.scene = {
        canvas$: canvas$(panel.frame$, {class: 'biquad-canvas'}), 
        width: CANVAS_SIZE, height: CANVAS_SIZE / 2, 
        filter: fx.ext.biquad
      }
      biquadGraph.render(panel.scene)
    }
    const isRemoveable = fxname !== 'Blank' && !isEndRatio 
    set$(fxrama$, {attr: {fxname}, html: ''}, [
        !isEndRatio && addListSelector('selfx', fxname, ui.namesDb.fxNames, nfx => pg.changeFx(stage, ix, nfx)),
        panel.frame$,
        div$({class: 'led-fx fix-on', click: toggleActiveState}),
        isRemoveable && div$({class: 'bfx-delete', click: _ => pg.changeFx(stage, ix, 'fx_blank')})
      ])
    return panel
  }
  
  init()
  
  return ui
}
