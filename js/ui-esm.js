/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, DOMplusUltra, createBiquadGrapher} from './improxy-esm.js'

const {isNum, isFun, clamp} = Corelib
const {wassert} = Corelib.Debug
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
  
  const createStageObj = stage => {
    const stageObj = {
      frame$: div$({class: 'bfx-stage bfx-st' + (stage + 1)}),
      spectrama$: div$({class: 'bfx-spectrum bfx-sp' + (stage + 1)}),
      spectcanv$: canvas$({class: 'sp-canvas'}),
      fxarr: []
    }
    stageArr.push(stageObj)
    return stageObj
  }
  
  if (config.platform === 'standalone') {  
    ui.frame$ = div$(body, {class: 'beebody' + (root.onYoutube ? ' u2' : '')}, [
      ui.top$ = div$({class: 'bfx-top'}),
      ui.mid$ = div$({class: 'bfx-mid'}),
      ui.bottom$ = div$({class: 'bfx-bottom'})
    ])
  } else { //: ext
  }
  
  ui.addStage = stage => {
    const stageObj = createStageObj(stage)
    set$(ui.mid$, {}, stageObj.frame$)
      setTimeout(_ => {
        set$(stageObj.frame$, {}, stageObj.spectrama$)
          set$(stageObj.spectrama$, {}, stageObj.spectcanv$)
            }, 2000)
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
        //id: 'player',
        attr: {width: '640', height: '360', preload: 'auto', controls: '', playsinline: ''}
      }, leaf$('source', {attr: {src, type: 'video/youtube'}})))  
      
    return ui.player$
  }

  ui.konfigNames = namesDb => ui.namesDb = namesDb  
  
  const checkInput = (stage, ix) => {
    const stageObj = stageArr[stage] //+ nem kene ez a -1
    return {stageObj, fxitem: stageObj.fxarr[ix] || (stageObj.fxarr[ix] = {
      fxrama$: div$(stageObj.frame$, {class: 'bfx-rama'})
    })}
  }

  ui.rebuildFxPanel = (stage, ix, fx, host) => {
    const {stageObj, fxitem} = checkInput(stage, ix)
    const {fxrama$} = fxitem // = stageObj.fxarr[ix]
    const fxname = fx.getName()
    fxitem.fx = fx

    const pars = {}
    const panel = {
      frame$: div$({class: 'fxr-pars'}),
      scene: null
    }
        
    const addRange = (name, callback, value, min, max, step = .001) => 
      div$({class: 'beectrl ranger', attr: {name}}, 
        leaf$('input', {attr: {type: 'range', min, max, step, value}, on: {
          input: event => callback(parseFloat(event.target.value))}}))
    
    const addListSelector = (name, act, list, callback) =>
      div$({class: 'beectrl selektor sel-' + name, attr: {name}}, 
        leaf$('select', {id: 'opt_', on: {change: event => callback(event.target.value)}},
          list.map(([value, name]) => 
            leaf$('option', {text: name, attr: {value, ...(value === act ? {selected: ''} : {})}}))))
            
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
      }
      panel.scene && biquadGraph.render(panel.scene)
    }        
    const onValChanged = key => val => {
      //console.log('onValChanged', {key, val, type: typeof val})
      fx.setLinearValue(key, val)
      //refreshDispVal(key)
    }        
    const {exo} = fx
    
    for (const key in exo.def) {
      const {defVal, type, name, short, subType} = exo.def[key]
      const parO = pars[key] = {
        type, subType,
        isExp: false
      }
      if (type === 'float') {//8#97e -------- float -> input range --------
        const dispName = short + (subType === 'decibel' ? ' (dB)' : '')
        const {val, min, max} = fx.getLinearValues(key)
        parO.control$ = addRange(dispName, onValChanged(key), val, min, max)
        parO.input$ = parO.control$.children[0] //+brrrrr
      } else {
        console.log({type, subType})
        if (type === 'string' && subType === 'biquad') {//8#ea7 --- biquad string -> select box ---
          const val = fx.getValue(key)
          parO.control$ = addListSelector(short, val, ui.namesDb.biquadOptions, onValChanged(key))
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
    
    set$(fxrama$, {attr: {fxname}, html: ''}, [
      addListSelector('selfx', fxname, ui.namesDb.fxNames, nufx => host.changeFx(stage, ix, nufx)),
      //div$({class: 'fxr-title'}),
      panel.frame$
    ])

    return panel
  }
  
  return ui
}
