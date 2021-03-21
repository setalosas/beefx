/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, DOMplusUltra} from './improxy-esm.js'

const {Ø, undef, isNum, isFun, nop, clamp, s_a} = Corelib
const {wassert, weject, brexru} = Corelib.Debug
const {post, startEndThrottle} = Corelib.Tardis
const {secToString} = Corelib.DateHumanizer
const {div$, leaf$, set$, setClass$, haltEvent, onReadyStateComplete} = DOMplusUltra
const {round} = Math

window.onYouTubeIframeAPIReady = _ => ytApi.resolve()

const ytApi = {players: []}
  
ytApi.isReady = new Promise(resolve => ytApi.resolve = resolve)

void (_ => { //: we init the Youtube iframe api asap
  console.log('🔴u2api init')
  const script = document.createElement('script')
  script.src = 'https://www.youtube.com/iframe_api'
  document.head.insertAdjacentElement('afterbegin', script)
})()

/*void (async _ => { //: youtube iframe api ready state test
  await ytApi.isReady
  console.log('🔴u2api async waiting ready')
})()*/

export const extendUi = ui => {
  //
  //8#c95 Youtube mock stuff - if we are not on Youtube, so we have to replace videos with audio
  
  //: If we are on Youtube as an extension, root.onYoutube is true.
  /*
  .video-in-strip   (videoStripArr$)
      .media-holder   (videoStripHolderArr$)
        iframe (<- div) youtube destroys this target div replacing it with its iframe
      .mock-holder    (videoStripMockArr$)
      .video-in-strip::after  
  */
  //: If we are not on youtube, have to mock the videos as we can't access their sound :-(
  
  const searchMockAudioForVideoId = videoId => {
    for (const mp3 of ui.root.mp3s) {
      if (mp3[2] === videoId) {
        return mp3
      }
    }
    return ui.root.mp3s[0]
  }
  
  const mockVideoInStripWithAudio = (playerId, videoId) => {
    const mockHolder$ = ui.videoStripMockArr$[playerId - 1]
    const mockMp3 = searchMockAudioForVideoId(videoId)
    
    set$(mockHolder$, {html: ''})
    const player$ = ui.insertAudioPlayerInto(mockHolder$, mockMp3[0], mockMp3[1])
    console.log(`Mock mp3 will be used instead of ${videoId}:`, mockMp3)
    ui.pg.changeSource(playerId, player$)
  }
  
  //8#c55 Youtube stuff - we insert youtube iframe into youtube as aux source
  
  const buildVideoList = on => { //: the videolist works both on Youtube and on the demo site
    void ui.u2list$?.remove()
    
    if (on) {
      const videoIds = [
        '9PCz1KPAJ0c,qZx-Z3_n4t8,uFpwKExK9Uw,UPVbcXiK4y8,94fQIqRCi4o',
        'A9WEeKYID4I,kbkEA1sWBRI,WVe-9VWIcCo,MfN57sFEcyc,hS1pHfUP5WQ,lkvnpHFajt0,saZVNLMMmmo',
        'tyVnJjE9sDo,VkWg1xOQwTI,u5jP4uCHcWs,d3hAnAnJwyU,NIcW36J-h7Q,j_nuN_fN7s8,OMDbX1zksgI',
        'hYVlS6FW4Kk,TA7CKxMCR00,Q04ILDXe3QE,hTGJfRPLe08'
      ].join(',').split(',')
      
      ui.u2list$ = div$(ui.frame$, {class: 'emu-frame'})
      for (const videoId of videoIds) {
        if (videoId?.length === 11) {
          const backgroundImage = `url('//img.youtube.com/vi/${videoId}/mqdefault.jpg')`
          leaf$('a', ui.u2list$, {
            class: 'emulated', 
            attr: {id: 'thumbnail', href: `'//youtube.com/watch?v=${videoId}`}, 
            css: {backgroundImage}
          })
        }
      }
    }
  }
  
  ui.mediaPlay = (sourceIx, mediaElement) => { //: plays native audio/video and embed iframes too
    if (mediaElement.tagName === 'VIDEO') {
      if (sourceIx > 0) { //: aux players 1 2 3 4 -> 0 1 2 3
        const player = ytApi.players[sourceIx - 1]
        if (player) {
          player.playVideo() //: youtube video in an iframe (we created it)
        } else {
          console.warn(`no such player to play`, sourceIx, mediaElement)
        }
      } else {
        mediaElement.play() //: youtube normal video (not in an iframe)
      }
    } else if (mediaElement.tagName === 'AUDIO') {
      mediaElement.play() //: mediaElement.js 'normal' audio
    } else {
      console.warn(`ui.mediaPlay: bad media`, sourceIx, mediaElement)
    }
  }
    
  const insertYoutubeIframe = (node$, ix, videoId)  => new Promise(resolve => {
    const YT = wassert(window.YT)
    ytApi.players[ix] = new YT.Player(node$, {
      width: '320', height: '180', videoId, events: {onReady: resolve}
    })
  })
  
  const changeVideoInStrip = async event => {
    const videoId = event.target.parentElement.getAttribute('videoId')
    wassert(isFun(event.target.className.split))
    const playerId = parseInt(event.target.className.split('grab-to-')[1])
    haltEvent(event)
    
    if (videoId?.length === 11 && playerId) {
      const mediaHolder$ = ui.videoStripHolderArr$[playerId - 1] // mediaholder
      set$(mediaHolder$, {html: ''}, div$({}))
      insertYoutubeIframe(mediaHolder$.children[0], playerId - 1, videoId)
        .then(_ => {
          console.log('Youtube iframe created and loaded.', mediaHolder$)
          const iframe$ = mediaHolder$.children[0]
          if (iframe$?.tagName === 'IFRAME') {
            try {
              const idoc = iframe$.contentWindow.document
              const video = idoc.getElementsByTagName('video')[0]
              if (video) {
                ui.pg.changeSource(playerId, video)
              } else {
                console.warn(`Cannot find video in iframe`)
              }
            } catch (err) {
              console.log(`Error accessing video tag, will try to mock it:`, err)
              if (!ui.root.onYoutube) {
                mockVideoInStripWithAudio(playerId, videoId)
              }
            }
          } else {
            console.warn(`Cannot get iframe.contentWindow.document`)
          }
        })
        .catch(err => {
          console.error(err)
          debugger
        })
    } else {
      console.warn('failure', {videoId, playerId})
    }
  }
  
  ui.setVideoTargetInfo = (ix, vidinfo) => set$(ui.videoStripArr$[ix - 1], {attr: {vidinfo}})
  
  const initMixerCommandHandlers = _ => {
    ui.toggleAutoplay = ui.toggleCmd(mixer, ui.autoplayCmd$, 'isAutoplayOn')
    ui.toggleList = ui.toggleCmd(mixer, ui.listCmd$, 'isListActive', on => {
      buildVideoList(on)
      on && ui.toggleGrab(on)
    })
    ui.toggleGrab = ui.toggleCmd(mixer, ui.grabCmd$, 'isGrabOn', on => {
      if (on) {
        ui.root.onYoutube || ui.toggleList(true)
        const thumbs = [...document.querySelectorAll('a#thumbnail')]
        for (const thumb of thumbs) {
          const href = thumb.getAttribute('href')
          if (!href?.length) {
            console.log('no href')
            continue
          }
          const videoId = thumb.getAttribute('href').split('?v=')[1].split('&')[0]
          if (videoId?.length === 11) {
            div$(thumb, {class: 'bfx-grab-frame', attr: {videoId}}, '1234'.split('').map(text =>
              div$({class: 'grabber grab-to-' + text, click: changeVideoInStrip}, div$({text}))))
          }
        }
      } else {
        const grabs = [...document.querySelectorAll('a#thumbnail > .bfx-grab-frame')]
        for (const grab of grabs) {
          grab.remove()
        }
      }
    })
    ui.toggleMixer = ui.toggleCmd(mixer, ui.mixerCmd$, 'isMixerOn', on => {
      setClass$(ui.mixerFrame$, !on, 'off')
      setClass$(ui.videoStrip$, !on, 'off')
      setClass$(ui.mixermenu$, !on, 'off')
    })
  }
    
  //8#b79 Mixer / player / fader DOM, nothing to do with stages etc
  
  const createInputDispatchers = _ => {
    for (const stageIx in ui.stageArr) {
      if (stageIx < 100) {
        const stageObj = ui.stageArr[stageIx]
        //console.log('found a stage to dispatch to', stageIx, stageObj)
        const chg = sourceIx => _ => ui.pg.changeStageSourceIndex(stageIx, sourceIx)
        stageObj.inputCmd$ = []
        set$(stageObj.inputSelector$, {class: 'blue'}, [
          div$({class: 'input-label', text: 'Input:'}),
          stageObj.inputCmd$[0] = div$({class: 'input-cmd act', text: 'Primary', click: chg(0)}),
          stageObj.inputCmd$[1] = div$({class: 'input-cmd', text: 'Input 1', click: chg(1)}),
          stageObj.inputCmd$[2] = div$({class: 'input-cmd', text: 'Input 2', click: chg(2)}),
          stageObj.inputCmd$[3] = div$({class: 'input-cmd', text: 'Input 3', click: chg(3)}),
          stageObj.inputCmd$[4] = div$({class: 'input-cmd', text: 'Input 4', click: chg(4)})
        ])
      }
    }
  }
  
  ui.setStageInputState = (stageIx, sourceIx) => {
    const stageObj = ui.stageArr[stageIx]
    if (stageObj?.inputCmd$?.length) {
      for (let ix = 0; ix < stageObj.inputCmd$.length; ix++) {
        setClass$(stageObj.inputCmd$[ix], sourceIx === ix, 'act')
      }
    } else {
      //console.warn(`ui.setStageInputState called too early`)
    }
  }

  const createFader = rama$ => {
    const {pg} = ui
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
    const {pg} = ui
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
  
  const players = []
  
  const mixer = ui.mixer = {
    isGrabActive: false,
    isListActive: false,
    localPlayer: undef,
    remotePlayer: undef,
    fader: undef,
    localStageIx: 100,
    remoteStageIx: 101,
    faderStageIx: 102,
    players
  }
  
  const rebuildMixerFader = (stageIx, parent$, fx) => {
    const fader = createFader(parent$)
    ui.addStage(stageIx, fader.stageFrame$, {hasNoBottom: true}) 
    fader.fxPanelObj = ui.rebuildStageFxPanel(stageIx, 0, fx, {isFixed: true, isOnOff: false})
    return fader
  }
  const rebuildMixerPlayer = (stageIx, parent$, isLocal, fx) => {
    const player = createPlayer(parent$, {isLocal})
    ui.addStage(stageIx, player.stageFrame$, {hasNoBottom: true}) 
    player.fxPanelObj = ui.rebuildStageFxPanel(stageIx, 0, fx, {isFixed: true, isOnOff: false})
    return player
  }
  ui.startMixer = _ => {
  }
  ui.finalizeMixer = _ => {
    const localFx = ui.pg.bpmTransformer
    const remoteFx = ui.pg.bpmTransformer
    const ratio4Fx = ui.stageArr[3].fxPanelObjArr[-1].fx
    wassert(ratio4Fx)
    
    mixer.localPlayer = rebuildMixerPlayer(mixer.localStageIx, ui.playerLeft$, true, localFx)
    mixer.remotePlayer = rebuildMixerPlayer(mixer.remoteStageIx, ui.playerRight$, false, remoteFx)
    mixer.fader = rebuildMixerFader(mixer.faderStageIx, ui.fader$, ratio4Fx)
    players.push(mixer.localPlayer, mixer.remotePlayer) //+ ez nem kell semmire
    ui.refreshPlayerControl(0, {})
    ui.refreshPlayerControl(1, {})
    createInputDispatchers()
    initMixerCommandHandlers()
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
    /* const fx = ui.pg.bpmTransformer

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
