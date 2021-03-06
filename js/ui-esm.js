/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, DOMplusUltra, createBiquadGrapher} from './improxy-esm.js'

const {isNum} = Corelib
const {div$, leaf$, set$, canvas$} = DOMplusUltra
  
export const createUI = (config, root) => {
  const {body} = document
  
  const biquadGraph = createBiquadGrapher(root.waCtx)
  const CANVAS_SIZE = 200
  
  const leftStage = {
    frame$: null,
    fxarr: []
  }
  const rightStage = {
    frame$: null,
    fxarr: []
  }
  const ui = {leftStage, rightStage}
  
  if (config.platform === 'standalone') {  
    ui.frame$ = div$(body, {class: 'beebody'}, [
      ui.top$ = div$({class: 'bfx-top'}),
      ui.bottom$ = div$({class: 'bfx-bottom'}, [
        leftStage.frame$ = div$({class: 'bfx-stage bfx-left'}),  
        rightStage.frame$ = div$({class: 'bfx-stage bfx-right'})
      ])
    ])
  } else { //: ext
    ui.frame$ = div$(body, {class: 'beebody'}, [
      ui.top$ = div$({class: 'bfx-top'}),
      ui.bottom$ = div$({class: 'bfx-bottom'}, [
        leftStage.frame$ = div$({class: 'bfx-stage bfx-left'}),  
        rightStage.frame$ = div$({class: 'bfx-stage bfx-right'})
      ])
    ])
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
  
  const createParameterPanel = fx => {
    const pars = {}
    const panel = {
      frame$: div$({class: 'fxr-pars'}),
      scene: null
    }
        
    const addRange = (name, callback, value, min, max, step = .001) => 
      div$({class: 'ranger'}, 
        leaf$('input', {attr: {type: 'range', min, max, step, value}, on: {
          input: event => callback(event.target.value)}}))
    
    const addListSelector = (name, act, list, callback) =>
      div$({class: 'fxr-optselector'}, 
        leaf$('select', {id: 'opt_', on: {change: event => callback(event.target.value)}},
          list.map(([value, name]) => 
            leaf$('option', {text: name, attr: {value, ...(value === act ? {selected: ''} : {})}}))))

    const refreshDispVal = key => {
      const dispVal = fx.getValue(key) //: minmaxnak is lehet dispvalja
      isNum(dispVal) && set$(pars[key].key$, {attr: {val: '"' + dispVal.toFixed(3) + '"'}})
      isNum(dispVal) && set$(pars[key].control$, {attr: {val: dispVal}})
      panel.scene && biquadGraph.render(panel.scene)
    }        
    const onValChanged = key => val => {
      fx.setLinearValue(key, val)
      refreshDispVal(key)
    }        
    const {exo} = fx
    for (const key in exo.def) {
      const {defVal, type, name, subType} = exo.def[key]
      //const dispVal = fx.getValue(key)
      console.log(`building controls with val`, {defVal, type, name})
      const parO = pars[key] = {
        isExp: false
      }
      if (type === 'float') {
        const {val, min, max} = fx.getLinearValues(key)
        parO.control$ = addRange(name, onValChanged(key), val, min, max)
      } else {
        console.log({type, subType})
        if (type === 'string' && subType === 'biquad') {
          const val = fx.getValue(key)
          parO.control$ = addListSelector(name, val, biquadOptions, onValChanged(key))
        }
      }
      div$(panel.frame$, {class: 'fxr-par'}, [
        parO.key$ = div$({class: 'fxr-parkey', text: name + ':'}),
        div$({class: 'fxr-parval'}, parO.control$)
      ])
      refreshDispVal(key) //: initial display
    }
    if (fx.ext.biquad) { //: all fxs that have a biquad
      set$(panel.frame$, {class: 'extgraph'})
      panel.scene = {
        canvas$: canvas$(panel.frame$, {class: 'biquad-canvas'}), 
        width: CANVAS_SIZE, height: CANVAS_SIZE, 
        filter: fx.ext.biquad
      }
      biquadGraph.render(panel.scene)
    }
    return panel
  }
  
  const fxNames = [
    ['fx_blank', 'Blank'],
    ['fx_gain', 'Gain'],
    ['fx_delay', 'Delay'],
    ['fx_biquad', 'Biquad Filter'],
    
    ['fx_dev', 'Distortion'],
    ['fx_dev', 'Reverb'],
    ['fx_dev', 'Telephone'],
    ['fx_dev', 'Gain LFO'],
    ['fx_dev', 'Chorus'],
    ['fx_dev', 'Flange'],
    ['fx_dev', 'Ring mod'],
    ['fx_dev', 'Stereo Chorus'],
    ['fx_dev', 'Stereo Flange'],
    ['fx_dev', 'Pitch Shifter'],
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
  ]
  
  const buildSelektor = (act, id, fxChanged) =>
    div$({class: 'fxr-selector'}, 
      leaf$('select', {id: 'effect_' + id, on: {change: event => fxChanged(event.target.value)}},
        fxNames.map(([value, name]) => 
          leaf$('option', {text: name, attr: {value, ...(value === act ? {selected: ''} : {})}}))))
  
  const checkInput = (stage, ix) => {
    const stageObj = stage === 1 ? leftStage : rightStage
    return {stageObj, fxitem: stageObj.fxarr[ix] || (stageObj.fxarr[ix] = {
      fxrama$: div$(stageObj.frame$, {class: 'bfx-rama'})
    })}
  }

  ui.rebuildFxPanel = (stage, ix, fx, host) => {
    const {stageObj, fxitem} = checkInput(stage, ix)
    const {fxrama$} = fxitem
    const fxname = fx.getName()
    fxitem.fx = fx
    set$(fxrama$, {attr: {fxname}, html: ''}, [
      buildSelektor(fxname, stage + '.' + ix, nume => host.changeFx(stage, ix, nume)),
      div$({class: 'fxr-title'}),
      createParameterPanel(fx, fxrama$).frame$
    ])
  }
  
  return ui
}
