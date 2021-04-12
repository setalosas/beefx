/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, DOMplusUltra} from '../improxy-esm.js'

const {Ø, undef, isNum, isFun, nop, clamp, s_a} = Corelib
const {wassert, weject, brexru} = Corelib.Debug
const {post, startEndThrottle} = Corelib.Tardis
const {secToString} = Corelib.DateHumanizer
const {div$, leaf$, set$, setClass$, q$$, haltEvent} = DOMplusUltra
const {round} = Math

export const extendUi = ui => {
  const {root, pg} = ui
  const {sources} = pg
  
  //8#b79 Mixer / player / fader DOM, nothing to do with stages etc
  
  const createFader = rama$ => {
    const fader = {
      rama$
    }
    fader.set = ui.setHost(fader)
    const playCtrl = (cmd, par) => pg.players.control(cmd, par/*, isLocal*/)
    
    const dragBar = event => { 
      const pt = round(1000 * event.offsetX / event.target.clientWidth) / 10
      event.buttons & 1 && playCtrl('seekpt', pt)
      //console.log(pt, event.buttons)
    }
    
    set$(rama$, {}, [
      fader.navFrame$ = div$({class: 'relinblk'}, [  
        fader.bpmDisplay$ = div$({class: 'bpm-display'}, [
          fader.bpmOrig$ = div$({class: 'mframe'}),
          fader.bpmAct$ = div$({class: 'mframe'}),
          fader.bpmMod$ = div$({class: 'mframe'})
        ]),
        fader.stageFrame$ = div$({class: 'fader-stframe stage-frame stage-narrowframe'})
      ])
    ])
    return fader
  }  
  const createPlayer = (rama$, {isLocal}) => {
    const player = {
      rama$,
      isLocal
    }
    player.set = ui.setHost(player)
    
    const playCtrl = (cmd, par) => pg.players.control(cmd, par, isLocal)

    const dragBar = event => (event.type === 'click' || event.buttons & 1) &&
      playCtrl('seekpt', round(1000 * event.offsetX / event.target.clientWidth) / 10)
        
    const dragBar_Debug = event => { 
      const pt = round(1000 * event.offsetX / event.target.clientWidth) / 10
      if (event.type === 'click' || event.buttons & 1) {
        playCtrl('seekpt', pt)
        console.log(pt, event.buttons)
      }
    }
    
    set$(rama$, {class: isLocal ? 'local-player' : 'remote-player'}, [
      player.bpmFrame$ = div$({class: 'relinblk'}, [
        player.bpmButtons$ = div$({class: 'bpm-buttons'}, [
          div$({class: 'mitem', text: 'Fast BPM (15s)', click: _ => pg.recalcBpm(15)}),
          div$({class: 'mitem', text: 'Slow BPM (25s)', click: _ => pg.recalcBpm(25)}),
          player.bpmpp$ = isLocal && 
            div$({class: 'mitem off', text: 'BPM PingPongs!', click: pg.bpmDelays})
        ])
      ]),
      player.navFrame$ = div$({class: 'relinblk'}, [  
        player.bpmDisplay$ = div$({class: 'bpm-display'}, [
          player.bpmOrig$ = div$({class: 'mframe'}),
          player.bpmAct$ = div$({class: 'mframe'}),
          player.bpmMod$ = div$({class: 'mframe'})
        ]),
        player.stageFrame$ = div$({class: 'player-stframe stage-frame'}),
        //player.bpmCtrl$ = div$({class: 'bfx-rama off'}),
        player.navRama$ = div$({class: 'player-navframe'}, [
          player.thumb$ = div$({class: 'nav-thumb'}, [
            player.title$ = div$({class: 'media-title'}),
            player.playCmd$ = 
              div$({class: 'nav-abscmd nav-play', text: 'play', click: _ => playCtrl('play')}),
            player.pauseCmd$ = 
              div$({class: 'nav-abscmd nav-pause', text: 'pause', click: _ => playCtrl('pause')}),
            player.dragBar$ = div$({class: 'drag-bar', on: {mousemove: dragBar, click: dragBar}}, [
              player.current$ = div$({class: 'curr time'}),
              player.duration$ = div$({class: 'dur time'})
            ]),
            player.navNoneed$ = div$({class: 'player-nav'}, [
              div$({class: 'nav-cmd n-start', text: 'Start', click: _ => playCtrl('absseeks', 0)}),
              div$({class: 'nav-cmd n-m10s', text: '-10s', click: _ => playCtrl('relseeks', -10)}),
              div$({class: 'nav-cmd n-m2b', text: '-2b', click: _ => playCtrl('relseekb', -2)}),
              div$({class: 'nav-cmd n-m1b', text: '-1b', click: _ => playCtrl('relseekb', -1)}),
              div$({class: 'nav-cmd n-p1b', text: '+1b', click: _ => playCtrl('relseekb', 1)}),
              div$({class: 'nav-cmd n-p2b', text: '+2b', click: _ => playCtrl('relseekb', 2)}),
              div$({class: 'nav-cmd n-p10s', text: '+10s', click: _ => playCtrl('relseeks', 10)}),
              div$({class: 'nav-cmd n-p30s', text: '+30s', click: _ => playCtrl('relseeks', 30)})
            ])
          ])
        ])
      ])
    ])
    return player
  }
  
  ui.refreshPlayerControl = (ix, data) => {
    const {paused, currentTime = 0, volume, duration: d, playbackRate, videoId, videoTitle} = data
    const duration = Number.isNaN(d) ? 1 : d
    const player = players[ix]
    if (player) {
      const bpmOrig = 125
      const bpmAct = 131
      const bpmMod = '+6'
      
      player.set('bpmOrig', {text: 'origBPM: ' + bpmOrig})
      player.set('bpmAct', {text: 'actBPM: ' + bpmAct})
      player.set('bpmMod', {text: 'BPM mod: ' + bpmMod})
      if (videoId?.length === 11) {
        const backgroundImage = `url('//img.youtube.com/vi/${videoId}/mqdefault.jpg')`
        player.set('thumb', {css: {backgroundImage}})
      }
      player.set('title', {text: videoTitle})
      player.set('dragBar', {css: {__prog: 100 * currentTime / (duration || 1) + '%'}})
      player.set('current', {text: secToString(currentTime)})
      player.set('duration', {text: secToString(duration)})
    }
  }
  
  const importedFromPlayground = {
    localStageIx: 100,
    localStageLetter: 'LOC',
    localStage: undef,
    remoteStageIx: 101,
    remoteStageLetter: 'REM',
    remoteStage: undef,
    faderStageIx: 102,
    faderStageLetter: 'FAD',
    faderStage: undef
  }
  const players = []
  
  const mixer = ui.mixer = {

    localPlayer: undef,
    remotePlayer: undef,
    fader: undef,
    players
  }
  
  const rebuildMixerFader = (stage, parent$, fx) => {
    const {stageIx} = stage
    const fader = createFader(parent$)
    ui.addStage(stage, fader.stageFrame$, {hasNoBottom: true}) 
    fader.fxPanelObj = ui.rebuildStageFxPanel(stageIx, 0, fx, {isFixed: true, isOnOff: false})
    return fader
  }
  const rebuildMixerPlayer = (stage, parent$, isLocal, fx) => {
    const {stageIx} = stage
    const player = createPlayer(parent$, {isLocal})
    ui.addStage(stage, player.stageFrame$, {hasNoBottom: true}) 
    player.fxPanelObj = ui.rebuildStageFxPanel(stageIx, 0, fx, {isFixed: true, isOnOff: false})
    return player
  }
  ui.startMixer = _ => {
  }
  ui.finalizeMixer = _ => {
    pg.initMixerStages()
    const localFx = pg.bpmTransformer
    const remoteFx = pg.bpmTransformer
    const ratio4Fx = ui.getStageObj(0)?.fxPanelObjArr[-1].fx //: stage 0 is the master ATM!!
    wassert(ratio4Fx)
    
    mixer.localPlayer = rebuildMixerPlayer(pg.localStage, ui.playerLeft$, true, localFx)
    mixer.remotePlayer = rebuildMixerPlayer(pg.remoteStage, ui.playerRight$, false, remoteFx)
    mixer.fader = rebuildMixerFader(pg.faderStage, ui.fader$, ratio4Fx)
    players.push(mixer.localPlayer, mixer.remotePlayer) //+ ez nem kell semmire
    ui.refreshPlayerControl(0, {})
    ui.refreshPlayerControl(1, {})
  }
  
  ui.rebuildBpmPanel = _ => { //: only called on expansion
    /* const {pg} = ui
    const fx = pg.bpmTransformer

    const bpmItems = []
    bpmItems.push(div$({class: 'mitem', text: 'Fast BPM (15s)', click: _ => pg.recalcBpm(15)}))
    bpmItems.push(div$({class: 'mitem', text: 'Slow BPM (25s)', click: _ => pg.recalcBpm(25)}))
    bpmItems.push(ui.bpm$ = div$({class: 'mframe'}))
    bpmItems.push(ui.bpmpp$ = div$({class: 'mitem off', text: 'BPM PingPongs!', click: pg.bpmDelays}))
    
    const fxPanelObj = getFxPanelObj(100, 0)
    
    const fxPanelObj = rebuildFxPanel(fx, pg) //+BAAAAAAAD
    bpmItems.push(ui.bpmMod$ = div$({class: 'bfx-rama'}, fxPanelObj.panel.parsFrame$))
    set$(ui.bpmbar$, {}, bpmItems)        */
  }
  
  ui.rebuildSyncPanel = _ => { //: only called on expansion
    /* const fx = pg.bpmTransformer

    const bpmItems = []
    bpmItems.push(div$({class: 'mframe', text: 'Synced player: Dj Sensei - The Synphony'}))
    //+ on video source changed eventre kuldje el stateben az uj video nevet
    //bpmItems.push(div$({class: 'mitem', text: 'Play', click: _ => pg.sendGeneral('play')}))
    //bpmItems.push(div$({class: 'mitem', text: 'Pause', click: _ => pg.sendGeneral('pause')}))
    
    const fxPanelObj = rebuildFxPanel(fx) //+BAAAAA
    bpmItems.push(ui.syncSpeedMod$ = div$({class: 'bfx-rama'}, fxPanelObj.panel.parsFrame$))
    set$(ui.syncbar$, {}, bpmItems)        */
  }
}
