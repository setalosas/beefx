/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, DOMplusUltra, FxUi, MixerUi} from '../improxy-esm.js'

const {Ø, undef, yes, no, isNum, isFun, nop, clamp} = Corelib
const {wassert, brexru} = Corelib.Debug
const {post, startEndThrottle} = Corelib.Tardis
const {secToString} = Corelib.DateHumanizer
const {div$, leaf$, set$, toggleClass$, setClass$, q$$, canvas$, haltEvent} = DOMplusUltra
const {round} = Math
  
export const createUI = (config, root) => {
  const {body} = document
  
  const stageArr = []
  const ui = {
    root,
    stageArr,
    videoStripHolderArr$: [],
    videoStripMockArr$: []
  }
  
  //8#79c Utilities, primitives, konfig
  
  ui.konfigNames = namesDb => ui.namesDb = namesDb   //: only used for select fx names now
  
  ui.setHost = host => (key, params) => {
    const node$ = host[key + '$']
    wassert(node$ && node$.nodeType)
    set$(node$, params)
  }
  ui.set = ui.setHost(ui)
  
  ui.toggleCmd = (host, node$ = brexru(), key, onChange = nop) => (on = !host[key]) => {
    if (on !== host[key]) {
      host[key] = on
      setClass$(node$, host[key], 'act')
      onChange(on)
    }
  }
  
  ui.insertAudioPlayerInto = (node$, url, title = 'no title') => 
    leaf$('audio', node$, {attr: {src: url, controls: '', title}}) 
  
  ui.insertAudioPlayer = (url, title = 'no title') => {
    void ui.player?.remove()
    
    set$(ui.top$, {css: {__title: '"' + title + '"'}}, 
      ui.player$ = leaf$('audio', {attr: {src: url, startVolume: .2, controls: '', title}}))  
      
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
  
  //8#393 DOM framework building
  
  const init = _ => {  
    if (root.killEmAll) {
      set$(body, {html: ``})
      for (const node of [...q$$('script[nonce]'), ...q$$('dom-module')]) {
        node.remove()
      }
    }
    const extracc = (root.onYoutube ? ' u2' : '') + (root.killEmAll ? ' nu2' : '')
    ui.frame$ = div$(body, {class: 'beebody' + extracc}, [
      ui.top$ = div$({class: 'bfx-top'}),
      ui.bigmid$ = div$({class: 'bfx-bigmid off'}, [
        ui.mainmenu$ = div$({class: 'bfx-horbar bfx-mainmenu'}),
        ui.videoStrip$ = div$({class: 'bfx-horbar video-strip off'}, 
          ui.videoStripArr$ = '1234'.split('').map(numch => parseInt(numch)).map(num => 
            div$({class: 'video-in-strip vid' + num}, [ 
              ui.videoStripHolderArr$[num - 1] = div$({class: 'media-holder'}),
              ui.videoStripMockArr$[num - 1] = !root.onYoutube && div$({class: 'mock-holder'})
            ]))),
        ui.mixermenu$ = div$({class: 'bfx-horbar bfx-mixermenu off'}),
        ui.auxmenu$ = no && div$({class: 'bfx-horbar mixer-frame'}, [
          ui.bpmbar$ = div$({class: 'bfx-bpmbar mbar'}),
          ui.syncbar$ = div$({class: 'bfx-syncbar mbar'})
        ]),
        ui.syncFrame$ = div$({class: 'bfx-horbar sync-frame off'}, [
          ui.syncBar$ = div$({class: 'bfx-syncbar'}, [
            ui.playerLeft$ = div$({class: 'player-frame left-player mixer-inframe'}),
            ui.fader$ = div$({class: 'fader-frame mixer-inframe'}),
            ui.playerRight$ = div$({class: 'player-frame right-player mixer-inframe'})
          ]),
          no && div$({class: 'dispatcher-frame'})
        ]),
        ui.mid$ = div$({class: 'bfx-mid'})
      ])
    ])
    FxUi.extendUi(ui)
    MixerUi.extendUi(ui)
  }
  /* mainmenu 
  A videostrip
  A mixerbar
  sycnframe */
  
  ui.start = playground => {
    ui.pg = playground
    populateMainMenu()
    populateMixerMenu()
    //ui.startMixer()
  }
  
  ui.finalize = _ => {
    wassert(ui.pg)
    ui.finalizeMixer()
  }
  
  const populateMainMenu = _ => {
    const {pg} = ui
    const mItems = []
    mItems.push(div$({class: 'mitem', text: 'Equalize ratios', click: pg.equalRatios}))
    mItems.push(div$({class: 'mitem', text: 'Reset', click: pg.equalRatios}))
    mItems.push(div$({class: 'mitem', text: 'Sample', click: pg.equalRatios}))
    mItems.push(div$({class: 'mitem', text: 'Random', click: pg.equalRatios}))
    mItems.push(div$({class: 'mitem', text: 'Save to video', click: pg.equalRatios}))
    mItems.push(div$({class: 'mitem', text: 'Presets', click: pg.equalRatios}))
    mItems.push(div$({class: 'mitem', text: '1 (led)... etc.', click: pg.equalRatios}))
    mItems.push(div$({class: 'mitem', text: 'Master', click: _ => pg.setSenderStage()}))
    /*
    mItems.push(div$({class: 'mitem rt', text: 'BPM/Speed...', 
      click: _ => toggleClass$(ui.bpmbar$, 'off')}))
    mItems.push(div$({class: 'mitem rt', text: 'Sync...', 
      click: _ => toggleClass$(ui.syncbar$, 'off')}))      */
    mItems.push(ui.mixerCmd$ = 
      div$({class: 'mitem rt', text: 'Mixer...', click: _ => ui.toggleMixer()}))
    mItems.push(ui.syncCmd$ = 
      div$({class: 'mitem rt', text: 'Sync...', click: _ => ui.toggleSync()}))

    set$(ui.bigmid$, {declass: 'off'})
    set$(ui.mainmenu$, {}, mItems) 
  }
  const populateMixerMenu = _ => {
    const {pg} = ui
    const mItems = []
    mItems.push(div$({class: 'mitem', text: 'Master', click: _ => pg.setSenderStage()}))
    mItems.push(ui.grabCmd$ = div$({class: 'mitem rt', text: 'Grab!', click: _ => ui.toggleGrab()}))
    mItems.push(ui.listCmd$ = div$({class: 'mitem rt', text: 'List', click: _ => ui.toggleList()}))
    mItems.push(ui.autoplayCmd$ = 
      div$({class: 'mitem rt', text: 'Autoplay', click: _ => ui.toggleAutoplay()}))
    set$(ui.mixermenu$, {}, mItems) 
  }
  //8#c7f Stages. - stageObj (in stageArr) creation.
    
  ui.addStage = (stageIx, parent$ = ui.mid$, pars = {}) => {
    const stageObj = {
      stageIx,             //: stage index
      fxPanelObjArr: [],    //:fx panel objects in the stage
      ...pars
    }        
    set$(parent$, {}, 
      stageObj.frame$ = div$({class: 'bfx-stage bfx-st' + (stageIx + 1)}, [
        stageObj.inputSelector$ = stageIx < 100 && div$({class: 'input-selector huerot'}),
        stageObj.ramas$ = div$({class: 'bfx-ramas'}),
        stageObj.bottomFrame$ = !stageObj.hasNoBottom && div$({class: 'st-bottomframe'}, [
          stageObj.endRatio$ = div$({class: 'bfx-rama isEndRatio'}),
          stageObj.spectrama$ = div$({class: 'st-spectrum huerot'},
            stageObj.spectcanv$ = canvas$())
        ])   
      ]))
    return stageArr[stageIx] = stageObj //eslint-disable-line no-return-assign
  }
  
  ui.resetStage = stageIx => { //:nothing to do? NOT USED
    // endratioba az ujat kell befuzni, pl volume? led!
  }
  
  init()
  
  return ui
}
