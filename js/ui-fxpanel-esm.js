/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, DOMplusUltra, createBiquadGrapher, createCompressorGrapher} from './improxy-esm.js'

const {Ø, undef, isNum, isFun, nop, clamp} = Corelib
const {wassert} = Corelib.Debug
const {post, startEndThrottle} = Corelib.Tardis
const {secToString} = Corelib.DateHumanizer
const {div$, leaf$, set$, toggleClass$, canvas$, haltEvent} = DOMplusUltra
const {round} = Math
  
export const extendUi = ui => {
  const {body} = document
  
  const biquadGraph = createBiquadGrapher(ui.root.waCtx)
  const compressorGraph = createCompressorGrapher(ui.root.waCtx)
  const CANVAS_SIZE = 300
    
  //8#79c Utilities, primitives, konfig
  
  const addRange = (parO, name, callback, value, min, max, step = .001) => 
    parO.control$ = div$({class: 'beectrl ranger', attr: {name}}, 
      parO.input$ = leaf$('input', {attr: {type: 'range', min, max, step, value}, on: {
        input: event => callback(parseFloat(event.target.value))}}))

  const addCheckbox = (parO, name, callback) => 
    parO.control$ = div$({class: 'beectrl checker', attr: {name}}, 
      parO.input$ = leaf$('input', {attr: {type: 'checkbox'}, on: {
        change: event => callback(event.target.checked)}}))   
        
  const addListSelector = (parO, name, act, list, callback) =>
    parO.control$ = div$({class: 'beectrl selektor sel-' + name, attr: {name}}, 
      parO.input$ = leaf$('select', {on: {change: event => callback(event.target.value)}},
        list.map(([value, name]) => 
          leaf$('option', {text: name, attr: {value, ...(name === act ? {selected: ''} : {})}}))))
       
  const num2str = (num, maxwi = 4) => {
    maxwi = clamp(maxwi, 2, 4) // 2 3 4 maxwi is valis
    const absval = Math.abs(num)
    wassert(typeof num !== Ø)
    wassert(isFun(num.toFixed))
    const str = absval >= 100 // 309 11000
      ? num.toFixed(0) : absval >= 10 // 99.78 (2)
        ? num.toFixed(maxwi - 2) : absval >= 1 // 5.437 0.939 (3)
          ? num.toFixed(maxwi - 1) : num.toFixed(maxwi - 1)
          
    return str
  }

  //8#c47 fxPanelObj management
  
  const createFxPanelObj = (stageObj, ix, par = {}, {stageIx} = stageObj) => ({
    stageObj,                                        //: base object of the stage, if there is one
    stageIx: stageIx,
    ix,                                               //:vertical index        
    fxrama$: ix === -1 ? stageObj.endRatio$ : div$(stageObj.ramas$),
                         //: fxrama$ is the most external div of the fx panel
    panel: undef,        //: panel is the pars frame inside fxrama$ (also: del, chgfx, led)
    fx: undef,           //: the linked beeFx fx object (mutable)
    fxname: '',         //: name (type) of fx (mutable)
    isEndRatio: ix === -1,
    isOnOff: true,       //: flag for the bypass led
    isFixed: false,      //: flag for fx selector and close icon
    //isFixed: ix < 0 || stageIx > 99,
    ...par
  })

  const getFxPanelObj = (stageIx, ix, par) => {
    const stageObj = ui.stageArr[stageIx]
    return stageObj.fxPanelObjArr[ix] = 
      stageObj.fxPanelObjArr[ix] || createFxPanelObj(stageObj, ix, par)
  }
  
  const reassignFxPanelObjFx = (fxPanelObj, newFx) => {
    fxPanelObj.fx = newFx   //: the assignment of the CURRENT fx to the STATIC fxPanelObj
    fxPanelObj.fxname = newFx.getName()
    set$(fxPanelObj.fxrama$, {attr: {pepper: newFx.getPepper()}}) //: internal fx id display
  }
  
  //8#2aa Parameter-specific helpers
  
  const refreshDisplay = (fxPanelObj, key) => {
    const {pars, fx} = fxPanelObj
    const parO = pars[key]
    const dispVal = fx.getValue(key) //: minmaxnak is lehet dispvalja
    if (parO.type === 'float') {
      const {val} = fx.getLinearValues(key)
      if (val !== parseFloat(parO.input$.value)) {
        parO.input$.value = val
      }
      //console.log('refreshDisplay', {key, dispVal, type: typeof dispVal})
      set$(parO.control$, {attr: {val: num2str(dispVal)}})
    } else if (parO.type === 'boolean') {
      const val = fx.getValue(key)
      const checked = ''
      set$(parO.input$, val ? {attr: {checked}} : {deattr: {checked}})//:no val at creating
      parO.input$.checked = val
    } else if (parO.type === 'strings') {
      for (const child$ of parO.input$.children) {
        child$.selected = child$.value === dispVal
      }
    }
    renderPanelScene(fxPanelObj)
  }     
  
  const renderPanelScene = fxPanelObj => {
    const {panel, fx} = fxPanelObj
    if (panel.scene) {
      const {graphs} = panel.scene
      for (const graph of graphs) {
        if (graph.custom === 'compressor') {
          compressorGraph.render(panel.scene, fx, graph)
        } else {
          const filter = fx.ext[graph.filter]
          if (graph.getCurveBaseColor) {
            graph.curveBaseColor = graph.getCurveBaseColor(fx)
          }
          filter && biquadGraph.render(panel.scene, filter, graph)
        }
      }
    }
  }
  
  const addPanelScene = (fxPanelObj, graphs) => {
    const {panel} = fxPanelObj
    set$(panel.parsFrame$, {class: 'extgraph'})
    const width = CANVAS_SIZE * 2
    const height = CANVAS_SIZE
    panel.scene = {
      canvas$: canvas$(panel.parsFrame$, {class: 'graph-canvas', attr: {width, height}}), 
      width, height,
      graphs,
      filterNo: graphs.length
    }
    renderPanelScene(fxPanelObj)
  }
  
  //8#9c0 Rebuilding the parameter-specific parts of the fx panel

  const createParsInPanel = (fxPanelObj) => {
    const {fx, pars, panel} = fxPanelObj
    wassert(fx)
    const {exo} = fx
    
    const onValChanged = key => val => {
      //const parO = pars[key]
      fx.setLinearValue(key, val)
    }
    
    for (const key in exo.def) {
      const {defVal, type, name, short, subType} = exo.def[key]
      if (subType === 'skipui') {
        continue
      }
      const parO = pars[key] = {type, subType}
      
      if (type === 'float') {//8#97e -------- float --> input range --------
        const dispName = short + (subType === 'decibel' ? ' (dB)' : '')
        const {val, min, max} = fx.getLinearValues(key)
        addRange(parO, dispName, startEndThrottle(onValChanged(key), 30), val, min, max)
      } else if (type === 'boolean') {//8#9c7 -------- boolean --> input checkbox --------
        addCheckbox(parO, short, onValChanged(key))
      } else {
        if (type === 'strings') {//8#ea7 --- biquad string --> select box ---
          addListSelector(parO, short, '', subType, onValChanged(key))
        } else if (type === 'html') {//8#7ae --- html --> html ---
          parO.control$ = div$({class: 'html', html: fx.getValue(key)})  
        } else {
          console.log({type, subType})
        }
      }
      //div$(panel.parsFrame$, {class: 'fxr-par'}, div$({class: 'fxr-parval'}, parO.control$))
      div$(panel.parsFrame$, {class: 'fxr-parval'}, parO.control$)
      //pars[key].parFrame$ = div$(panel.parsFrame$, div$({class: 'fxr-parval'}, parO.control$))
      refreshDisplay(fxPanelObj, key) //: initial display
      fx.onValueChange(key, _ => refreshDisplay(fxPanelObj, key))
    }
    exo.freqGraph && addPanelScene(fxPanelObj, exo.freqGraph)
    exo.customGraph && addPanelScene(fxPanelObj, exo.customGraph)
  }
  
  const rebuildFxPanel = fxPanelObj => {
    const pars = {}
    const panel = {
      parsFrame$: div$({class: 'fxr-pars'}), //: internal frame of fx panel for parameters only
      scene: null
    }
    panel.set = ui.setHost(panel)
    fxPanelObj.capture({panel, pars, isActive: true}) //: always active after creation
    createParsInPanel(fxPanelObj)
  }
  
  //+fxPanelObj legyen egy closure metodokkal!!!! ui-fxpanel-esm.js fob a dis helyett v fxob v fxo

  ui.refreshFxPanelActiveState = fxPanelObj => {
    set$(fxPanelObj.fxrama$, fxPanelObj.isActive ? {declass: 'bypass'} : {class: 'bypass'})
  }
  ui.toggleFxPanelActiveState = fxPanelObj => {
    fxPanelObj.isActive = !fxPanelObj.isActive
    fxPanelObj.isEndRatio 
      ? ui.pg.activateStage(fxPanelObj.stageIx, fxPanelObj.isActive)
      : fxPanelObj.fx.activate(fxPanelObj.isActive)
    ui.refreshFxPanelActiveState(fxPanelObj)  
  }
  
  ui.rebuildStageFxPanel = (stageIx, ix, fx, par = {}) => {
    //: creates fxPanelObj on 1st callonly -> reuse on later calls (like changeFx())
    const fxPanelObj = getFxPanelObj(stageIx, ix, par)
    const {stageObj, hasStageMark, isEndRatio, isFixed, fxrama$, isOnOff} = fxPanelObj
    reassignFxPanelObjFx(fxPanelObj, fx)  //: puts fx, fxname into fxPanelObj
    rebuildFxPanel(fxPanelObj)            //: puts panel into fxPanelObj
    const {fxname, panel} = fxPanelObj     //:fxname is in the 'Blank' format (not fx_blank!)
    const {pg} = ui
    
    const isBlank = fxname === 'Blank'
    const isGain = fxname === 'Gain'
    const isRemoveable = !isFixed && !isBlank
    const isAlterable = !isFixed
    const isFoldable = isRemoveable //: for now, but it can differ

    const truePropsToArr = obj => obj.propertiesToArr().filter(key => obj[key])

    const auxClass = truePropsToArr({isBlank, isGain, isOnOff, isFixed, isRemoveable, isAlterable, isFoldable, hasStageMark}).join(' ')
    
    const fxSelector$ = isAlterable &&
      addListSelector({}, 'selfx', fxname, ui.namesDb.fxNames, nfx => pg.changeFx(stageIx, ix, nfx))
      
    const foldIcon$ = isFoldable &&
      div$({class: 'bfx-foldicon', click: _ => toggleClass$(fxrama$, 'folded')})
      
    const remove$ = isRemoveable && 
      div$({class: 'bfx-delete', click: _ => pg.changeFx(stageIx, ix, 'fx_blank')})
      
    const bypassLed$ = isOnOff && 
      div$({class: 'led-fx bfxact fix-on', click: _ => ui.toggleFxPanelActiveState(fxPanelObj, pg)})
    
    const topmenu$ = isEndRatio ? div$({class: 'bfx-topmenu'}, [
      div$({class: 'bfx-mitem', text: 'Solo', click: _ => pg.soloStage(stageIx)}),
      div$({class: 'bfx-mitem', text: 'Regen', click: _ => pg.rebuildStage(stageIx)}),
      div$({class: 'bfx-mitem', text: '===', click: pg.equalRatios}),
      div$({class: 'bfx-mitem', text: 'Save', click: nop}),
      panel.send$ = div$({click: _ => pg.setSenderStage(stageIx), 
        class: 'bfx-mitem wled send', text: 'Master'}, div$({class: 'led-fx'})),
      panel.listen$ = div$({class: 'bfx-mitem wled listen', text: 'Slave', 
        click: _ => pg.setListenerStage(stageIx)}, div$({class: 'led-fx'}))
    ]) : null
    
    fxrama$.className = 'bfx-rama'
    
    set$(fxrama$, {class: auxClass, attr: {fxname, isFixed, isAlterable, isBlank}, html: ''}, [
      bypassLed$,
      fxSelector$,
      topmenu$,
      foldIcon$,
      remove$,
      panel.parsFrame$
    ])
      
    return fxPanelObj
  }
  
  ui.rebuildStageEndPanel = (stageIx, ratioFx) => 
    ui.rebuildStageFxPanel(stageIx, -1, ratioFx, {isFixed: true})
}
