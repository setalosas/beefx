/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, DOMplusUltra, createGraphBase} from '../improxy-esm.js'

const {Ø, undef, isNum, isFun, nop, clamp} = Corelib
const {wassert} = Corelib.Debug
const {post, startEndThrottle, schedule, createPerfTimer} = Corelib.Tardis
const {secToString} = Corelib.DateHumanizer
const {div$, leaf$, set$, setClass$, toggleClass$, canvas$, haltEvent} = DOMplusUltra
const {round} = Math
  
export const extendUi = ui => {
  const {body} = document
  
  const graphBase = createGraphBase(ui.root.waCtx)
  const CANVAS_SIZE = 300
    
  //8#79c Utilities, primitives, config
  
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
          
  const addCmd = (parO, name, callback) => 
    parO.control$ = div$({class: 'bee-cmd', text: name, click: event => callback('fire')})
                     
  const num2str = (num, maxwi = 4) => {
    if (!maxwi) {
      return round(num) + ''
    }
    maxwi = clamp(maxwi, 2, 4) // 2 3 4 maxwi is valid
    const absval = Math.abs(num)
    wassert(typeof num !== Ø)
    wassert(isFun(num.toFixed))
    return absval >= 100 // 309 11000
      ? num.toFixed(0) : absval >= 10 // 99.78 (2)
        ? num.toFixed(maxwi - 2) : absval >= 1 // 5.437 0.939 (3)
          ? num.toFixed(maxwi - 1) : num.toFixed(maxwi - 1)
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
    fxname: '',          //: name (type) of fx (mutable)
    isEndRatio: ix === -1,
    isOnOff: true,       //: flag for the bypass led
    isFixed: false,      //: flag for fx selector and close icon
    ...par
  })
  
  const iterateAllFxPanelObjs = callback => {
    ui.iterateStages(stageObj => {
      for (const fxPanelObj of stageObj.fxPanelObjArr) {
        fxPanelObj && callback(fxPanelObj)
      }
    })
  }

  const getFxPanelObj = (stageIx, ix, par) => {
    const stageObj = wassert(ui.getStageObj(stageIx))
    return stageObj.fxPanelObjArr[ix] = 
      stageObj.fxPanelObjArr[ix] || createFxPanelObj(stageObj, ix, par)
  }
  
  const reassignFxPanelObjFx = (fxPanelObj, nuFx) => {
    fxPanelObj.fx = nuFx   //: the assignment of the CURRENT fx to the STATIC fxPanelObj
    fxPanelObj.fxname = nuFx.getName()
    set$(fxPanelObj.fxrama$, {attr: {pepper: nuFx.getPepper()}}) //: internal fx id display
  }
  
  //8#2aa Parameter-specific helpers
  
  const refreshDisplay = (fxPanelObj, key) => {
    const {pars, fx} = fxPanelObj
    const parO = pars[key]
    const {parDef} = parO
    const {type, subType} = parDef
    const dispVal = fx.getValue(key) //: minmaxnak is lehet dispvalja
    
    const updaters = {
      float: _ => {
        const isInt = subType === 'int'
        const {prec = 4} = parDef
        const {val} = fx.getLinearValues(key)
        if (val !== parseFloat(parO.input$.value)) {
          parO.input$.value = val
        }
        //console.log('refreshDisplay', {key, dispVal, type: typeof dispVal})
        set$(parO.control$, {attr: {val: num2str(dispVal, isInt ? 0 : prec)}})
      },
      boolean: _ => {
        const checked = ''
        set$(parO.input$, dispVal ? {attr: {checked}} : {deattr: {checked}})//:no val at creating
        parO.input$.checked = dispVal
      },
      cmd: _ => dispVal !== 'fire' && set$(parO.control$, {attr: {state: dispVal}}),
      strings: _ => { 
        for (const child$ of parO.input$.children) {
          child$.selected = child$.value === dispVal
        } 
      },
      graph: _ => {},
      html: _ => set$(parO.control$, {html: dispVal}),
      info: _ => set$(parO.control$, {html: dispVal})
    }
    const paramUpdater = updaters[type]
    paramUpdater
      ? paramUpdater()
      : console.warn('no paramUpdater for', {type, parO})
      
    renderPanelGraphs(fxPanelObj, key)
  } 
  
  const renderPanelGraphs = (fxPanelObj, triggerKey) => schedule(20).then(_ => {
    for (const graphName in fxPanelObj.panel.graphs) {
      renderPanelGraph(fxPanelObj, graphName, triggerKey) //: delayed as filters can have a 10ms lag
    }
  })
  
  const renderPanelGraph = (fxPanelObj, graphName, key) => {
    const {panel, fx} = fxPanelObj
    const panelGraph = wassert(panel.graphs[graphName])
    const {graph} = panelGraph
    if (!graph.triggerKeys || !key || graph.triggerKeys.includes(key)) { //: optimize redraw
      panelGraph.graphInstance.render()
    } else {
      console.log('graph wont redraw', key)
    }
  }
  
  const addPanelGraph = (fxPanelObj, graphName) => {
    const {panel, fx} = fxPanelObj
    const width = CANVAS_SIZE * 2
    const height = CANVAS_SIZE
    const cclass = 'graph-canvas gr-' + graphName
    const canv$ = canvas$(panel.parsFrame$, {class: cclass, attr: {width, height}})
    const graphObj = wassert(fx.exo.graphs[graphName])
    const graphArr = graphObj.map ? graphObj : [graphObj]

    const timer = createPerfTimer()
    for (let ix = 0; ix < graphArr.length; ix++) {
      const graph = graphArr[ix]
      const panelGraph = {canvas$: canv$, width, height, graph, fx}
      panelGraph.graphInstance = graphBase.createGraph(graph, panelGraph)
      panel.graphs[graphName + ix] = panelGraph
      renderPanelGraph(fxPanelObj, graphName + ix)
    }
    set$(panel.parsFrame$, {class: 'graph gt-' + fx.exo.fxName})
    console.log(`📈Graph added for ${fx.zholger} with ${graphArr.length} items.`, timer.summary())
  }
  
  //8#9c0 Rebuilding the parameter-specific parts of the fx panel

  const createParsInPanel = (fxPanelObj) => {
    const {fx, pars, panel} = fxPanelObj
    wassert(fx)
    const {exo} = fx
    
    const onValChanged = key => val => {
      fx.setLinearValue(key, val)
    }
    
    for (const key in exo.def) {
      const {defVal, type, name, size, short, subType, unit, readOnly} = exo.def[key]
      if (subType === 'skipui') {
        continue
      }
      const parO = pars[key] = {type, parDef: exo.def[key]}
      const constructors = {
        float: _ => {   //8#88e ------- float --> input range -------
          const dispName = short
          const {val, min, max} = fx.getLinearValues(key)
          const step = subType === 'int' ? 1 : .001
          addRange(parO, dispName, startEndThrottle(onValChanged(key), 30), val, min, max, step)
          unit && set$(parO.input$, {attr: {unit}})
        },
        boolean: _ => { //8#9c7 ------- boolean --> input checkbox -------
          addCheckbox(parO, short, onValChanged(key))
        },
        cmd: _ => {    //8#b8c7 ------- cmd --> non-input, plain div cmd -------
          addCmd(parO, short, onValChanged(key))
        },
        strings: _ => { //8#ea7 ------- strings --> select box -------
          addListSelector(parO, short, '', subType, onValChanged(key))
          size && set$(parO.input$, {attr: {size}})
        },
        graph: _ => {   //8#3ca ------- graph -> addscene -------
          addPanelGraph(fxPanelObj, key)
        },
        html: _ => {    //8#7ae ------- html --> html -------
          parO.control$ = div$({class: 'html', html: fx.getValue(key)})  
        },
        info: _ => {    //8#8be ------- info --> html -------
          parO.control$ = div$({class: 'info', html: fx.getValue(key)})  
        }
      }
      const paramConstructor = constructors[type]
      if (paramConstructor) {
        paramConstructor()
      } else { 
        console.warn('no paramConstructor for', {type, subType})
        continue
      }
      readOnly && set$(parO.input$, {attr: {disabled: ''}})
      div$(panel.parsFrame$, {class: 'fxr-parval fxt-' + type}, parO.control$)
      refreshDisplay(fxPanelObj, key) //: initial display
      fx.onValueChange(key, _ => refreshDisplay(fxPanelObj, key))
    }
  }
  
  const rebuildFxPanel = fxPanelObj => {
    const pars = {}
    const panel = {
      parsFrame$: div$({class: 'fxr-pars'}), //: internal frame of fx panel for parameters only
      scenes: [],
      graphs: {}
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
    fxPanelObj.capture({isBlank, isGain, isRemoveable, isAlterable, isFoldable})

    const truePropsToArr = obj => obj.propertiesToArr().filter(key => obj[key])

    const auxClass = truePropsToArr({isBlank, isGain, isOnOff, isFixed, isRemoveable, isAlterable, isFoldable, hasStageMark}).join(' ')
    
    const fxSelector$ = isAlterable &&
      addListSelector({}, 'selfx', fxname, ui.namesDb.fxNames, nfx => pg.changeFx(stageIx, ix, nfx))
      
    const foldIcon$ = isFoldable &&
      div$({class: 'bfx-foldicon', click: event => {
        const isFolded = toggleClass$(fxrama$, 'folded')
        if (event.altKey) { //: do the same with all fxpanels of the same type
          iterateAllFxPanelObjs(fpo => (event.ctrlKey || fpo.fxname === fxname) && 
            fpo.isRemoveable && setClass$(fpo.fxrama$, isFolded, 'folded', console.log(fpo)))
          //: maybe this should be filtered to normal stages and not fixed fxs
        }
      }})
      
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
        class: 'bfx-mitem wled send', text: 'Master'}, div$({class: 'led-fx fix-on'})),
      panel.listen$ = div$({class: 'bfx-mitem wled listen', text: 'Slave', 
        click: _ => pg.setListenerStage(stageIx)}, div$({class: 'led-fx fix-on'}))
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
