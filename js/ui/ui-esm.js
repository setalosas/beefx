/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import * as Im from '../improxy-esm.js'

const {Corelib, DOMplusUltra, StagesUi, FxUi, PlayersUi, SourcesUi, MixerUi, StatesUi} = Im
const {Ø, undef, yes, no, isNum, isFun, nop, clamp} = Corelib // eslint-disable-line
const {wassert, brexru} = Corelib.Debug
const {schedule} = Corelib.Tardis
const {div$, leaf$, set$, setClass$, q$$, canvas$} = DOMplusUltra
  
export const createUI = (root, exroot) => {
  const {body} = document
  
  const earlyCall = doStop => _ => console.warn('Too early call to ui.', doStop && brexru())
  
  const ui = {
    root,
    flags: {
      isGrabOn: false,
      isListActive: false,
      isStagePresetListActive: false,
      isAutoplayOn: false,
      isAutostopOn: false,
      isMixerOn: false,
      isSyncOn: false
    },
    refreshPlayerControl: earlyCall(false),
    refreshSourcesUi: earlyCall(false)
  }
  
  //8#79c Utilities, primitives, config
  
  ui.configNames = namesDb => ui.namesDb = namesDb   //: only used for select fx names now

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
  
  //8#393 DOM framework building (cold init)
  
  const init = _ => {  
    if (root.killEmAll) {
      set$(body, {html: ``})
      for (const node of [...q$$('script[nonce]'), ...q$$('dom-module')]) {
        node.remove()
      }
      //: more things could be eliminated from head
    }
    const extracc = (root.onYoutube ? ' u2' : '') + (root.killEmAll ? ' nu2' : '')
    ui.frame$ = div$(body, {class: 'beebody' + extracc}, [
      ui.top$ = div$({class: 'bfx-top'}),
      ui.bigmid$ = div$({class: 'bfx-bigmid off'}, [
        ui.mainmenu$ = div$({class: 'bfx-horbar bfx-mainmenu'}),
        ui.sourceStrip$ = div$(), //: for SourcesUi
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
    ui.videoGrabCanvas$ = canvas$(body, {class: 'videograb'})
  }
  
  //8#37c Warm init: we have playground now
  
  ui.start = playground => {
    ui.pg = playground
    populateMainMenu()
    populateMixerMenu()
    
    StagesUi.extendUi(ui)
    FxUi.extendUi(ui)
    PlayersUi.extendUi(ui)
    SourcesUi.extendUi(ui)
    MixerUi.extendUi(ui)
    StatesUi.extendUi(ui)
    //ui.startMixer()
    initCommandHandlers()
    ui.toggleAutoplay()
    ui.toggleAutostop()
  }
  
  ui.finalize = _ => {
    wassert(ui.pg)
    ui.finalizeMixer()
    ui.finalizeSources() //: stages - de ezt az ui-sources hivja meg
  }
  
  const populateMainMenu = _ => {
    const {pg} = ui
    const mItems = []
    //mItems.push(div$({class: 'mitem', text: 'Equalize ratios', click: pg.equalRatios}))
    //mItems.push(div$({class: 'mitem', text: 'Reset', click: pg.equalRatios}))
    //mItems.push(div$({class: 'mitem', text: 'Sample', click: pg.equalRatios}))
    //mItems.push(div$({class: 'mitem', text: 'Random', click: pg.equalRatios}))
    //mItems.push(div$({class: 'mitem', text: 'Save to video', click: pg.equalRatios}))
    //mItems.push(div$({class: 'mitem', text: 'Presets', click: pg.equalRatios}))
    //mItems.push(div$({class: 'mitem', text: '1 (led)... etc.', click: pg.equalRatios}))
    mItems.push(div$({class: 'mitem', text: 'Master', click: _ => pg.setSenderStage()}))
    /*
    mItems.push(div$({class: 'mitem rt', text: 'BPM/Speed...', 
      click: _ => toggleClass$(ui.bpmbar$, 'off')}))
    mItems.push(div$({class: 'mitem rt', text: 'Sync...', 
      click: _ => toggleClass$(ui.syncbar$, 'off')}))      */
    mItems.push(ui.grabCmd$ = div$({class: 'mitem rt', text: 'Grab!', click: _ => ui.toggleGrab()}))
    mItems.push(ui.listCmd$ = 
      div$({class: 'mitem rt', text: 'Sources...', click: _ => ui.toggleList()}))
    mItems.push(ui.stagePresetCmd$ = 
      div$({class: 'mitem rt', text: 'Stage slots...', click: _ => ui.toggleStagePresets()}))
    mItems.push(ui.mixerCmd$ = 
      div$({class: 'mitem rt', text: 'Mixer...', click: _ => ui.toggleMixer()}))
    mItems.push(ui.syncCmd$ = 
      div$({class: 'mitem rt', text: 'Sync...', click: _ => ui.toggleSync()}))
    mItems.push(ui.autoplayCmd$ = 
      div$({class: 'mitem rt', text: 'Autoplay', click: _ => ui.toggleAutoplay()}))
    mItems.push(ui.autostopCmd$ = 
      div$({class: 'mitem rt', text: 'Autostop', click: _ => ui.toggleAutostop()}))

    set$(ui.bigmid$, {declass: 'off'})
    set$(ui.mainmenu$, {}, mItems) 
  }
  
  const populateMixerMenu = _ => {
    const {pg} = ui
    const mItems = []
    mItems.push(div$({class: 'mitem', text: 'Master', click: _ => pg.setSenderStage()}))
    set$(ui.mixermenu$, {}, mItems) 
  }
  
  //+ uistate kene mixer helyett v barmi
  
  const initCommandHandlers = _ => {
    ui.toggleAutoplay = ui.toggleCmd(ui.flags, ui.autoplayCmd$, 'isAutoplayOn')
    ui.toggleAutostop = ui.toggleCmd(ui.flags, ui.autostopCmd$, 'isAutostopOn')
    ui.toggleList = ui.toggleCmd(ui.flags, ui.listCmd$, 'isListActive', ui.onVideoListToggled)
    ui.toggleStagePresets = 
      ui.toggleCmd(ui.flags, ui.stagePresetCmd$, 'areStagePresetsActive', ui.onStagePresetsToggled)
    
    ui.toggleGrab = ui.toggleCmd(ui.flags, ui.grabCmd$, 'isGrabOn', ui.onGrabToggled)
    ui.toggleMixer = ui.toggleCmd(ui.flags, ui.mixerCmd$, 'isMixerOn', on => {
      setClass$(ui.mixermenu$, !on, 'off')
    })
    ui.toggleSync = ui.toggleCmd(ui.flags, ui.syncCmd$, 'isSyncOn', 
      on => setClass$(ui.syncFrame$, !on, 'off'))
  }

  ui.createSideList = cclass => {
    const frame$ = div$(body, {class: 'side-frame ' + cclass})
    
    const refresh = itemArr => {
      set$(frame$, {declass: 'hidden'})
      set$(frame$, {html: ''}, itemArr.map(html => div$({class: 'item', html})))
      schedule('2s').then(_ => set$(frame$, {class: 'hidden'}))
    }
    return {frame$, refresh}
  }

  init()
  
  return ui
}
