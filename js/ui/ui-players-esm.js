/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
/* eslint-disable no-unused-vars */   
   
import {Corelib, DOMplusUltra} from '../improxy-esm.js'

const {Ø, undef, isNum, isFun, nop, clamp, s_a, hashOfString, getRndDig} = Corelib
const {wassert, weject, brexru} = Corelib.Debug
const {post, startEndThrottle, schedule, adelay} = Corelib.Tardis
const {secToString} = Corelib.DateHumanizer
const {div$, leaf$, set$, setClass$, q$, q$$, haltEvent} = DOMplusUltra
const {round, abs} = Math

//8#49f --------------------------Players ui --------------------------

export const extendUi = ui => {
  const {root, pg} = ui
  const {sources} = pg
  
  const logOn = false
  const clog = (...args) => logOn && console.log(...args)
  
  //8#49cScraping the youtube DOM for video data
  /* 
  Oddly it's not trivial to find out the currently played video id and title on Youtube.
  If we first load Youtube, we can get them from meta tags of the head, but if we navigate
  inside Youtube, the head won't exactly follow which video is played.
  There is always exactly one video tag (even it's invisible) and this element is persistent
  through the session (even if the video in it or the page changes) but it won't give away
  directly the title and the id. 
  So first we have to find out whether the played video is in the normal or mini player.
  Then we can choose the h1 element containing the title (as both player has one).
  If the video is played in the mini player, there is no direct way to find out the video id.
  We have to iterate through the mini player's playlist and find the item containing the already
  found title and extract the id with the href associated to the playlist item.
  This method can fail if there are two videos in that playlist (~queue) with the very same title.
  However, as Google changes the inner structure of the Youtube DOM quite regularly,
  it's not worth it to make bigger efforts here - these infos are not _that_ important.
  This method works now (03/2021) but there's no guarantee that it will work in the future.
  */  
  const scrapingYoutubeForVideoInfo = _ => {
    const real = {}
    const h1Big = q$('h1 .ytd-video-primary-info-renderer')?.textContent
    const h1Mini = q$('h1 .miniplayer-title')?.textContent
    const miniplayer = q$('ytd-miniplayer')
    const videoInMiniplayer = miniplayer?.querySelector('ytd-player')

    if (videoInMiniplayer) {
      real.videoTitle = h1Mini
      //clog(`🟦 ${real.videoTitle = h1Mini}`)
      const wcEndPoints = [...miniplayer.querySelectorAll('a#wc-endpoint')]
      for (const wcEndPoint of wcEndPoints) {
        const videoId = wcEndPoint.getAttribute('href')?.split('?v=')[1]?.substr(0, 11)
        const title = wcEndPoint.querySelector('#video-title')?.getAttribute('title')
        title === h1Mini && (real.videoId = videoId)
      }
       //clog(`🔷${real.videoId}`)
    } else {
      real.videoTitle = h1Big
      real.videoId = q$('.ytd-page-manager[video-id]')?.getAttribute('video-id')
      //clog(`🟥${real.videoTitle}`)
      //clog(`🔶 ${real.videoId}`)
    }
    return real
  }
  
  const createMediaObserver = (sourceUi) => {
    const observer = {
      sourceUi, //: for debug only
      videoState: {},
      audioState: {},
      iframeState: {},
      lastState: {},
      currState: {},
      videoHash: '',
      audioHash: '',
      iframeHash: ''
    }
    const observerTickPeriod = 1000
    
    const logSyncOn = false
    const slog = (...args) => logSyncOn && console.log(...args)
    
    const getYtPlayerState = _ => {
      const ytp = sourceUi.ytPlayer
      const currentTime = ytp.getCurrentTime()
      const duration = ytp.getDuration()
      const {title, video_id: videoId} = ytp.getVideoData()
      const volume = ytp.getVolume()
      const playbackRate = ytp.getPlaybackRate()
      const muted = ytp.isMuted()
      const playerState = ytp.getPlayerState()
      // -1: unstarted // 0: ended // 1: playing // 2: paused // 3: buffering // 5: video cued
      observer.iframeState = {
        paused: playerState !== 1, playerState, currentTime, duration, playbackRate,
        src: '', title, videoId, volume, muted, isIframeState: true
      }
      return observer.iframeState
    }
    
    const getVideoElementState = _ => { //: youtube.com video
      const {paused, src, volume, title,  muted} = sourceUi.video$
      const {currentTime, duration, playbackRate} = sourceUi.video$
      const {videoTitle, videoId} = scrapingYoutubeForVideoInfo()
      return observer.videoState = {
        paused, currentTime, duration, playbackRate,
        src, title, videoTitle, videoId, volume: volume * 100, muted, isVideoState: true
      }
    }
    
    const getAudioElementState = _ => {
      const {paused, src, volume, title, muted} = sourceUi.audio$
      const {currentTime, duration, playbackRate} = sourceUi.audio$
      const videoId = ''
      return observer.audioState = {
        paused, currentTime, duration, playbackRate,
        src, title, videoTitle: '', videoId: '', volume: volume * 100, muted, isAudioState: true
      }  
    }
    const logState = type => {
      const state = observer[type + 'State']
      if (state) {
        const {paused, currentTime = 0.1, duration: d, playbackRate} = state
        const {src, title = '', videoTitle = '', videoId, volume, muted} = state
        const duration = d || 0.1 //Number.isNaN(d) ? 1 : d
        const info = `paused=${paused} curr=${currentTime.toFixed(2)}  dur=${duration.toFixed(2)} pbRate=${playbackRate} vol=${volume} muted=${muted} title=${title.substr(0, 40)} videoId=${videoId} videoTitle=${videoTitle.substr(0, 30)}`
        console.log(type, info)
      }
    }
    /*
    paused playerState
    curr dur
    volume muted
    pbRate
    title
    videoTitle
    videoId
    src
    
    paused ikon    - muted/volume
    videoId
    title / videoTitle
    ...
    slider curr dur 
    
    */
    observer.getState = _ => sourceUi.video$ 
      ? observer.videoState 
      : sourceUi.audio$ 
        ? observer.audioState
        : sourceUi.iframe$
          ? observer.iframeState : {}

    const syncMocked = _ => {
      const {iframeState: slave, audioState: master} = observer
      const {ytPlayer} = sourceUi
      const diffToMaster = slave.currentTime - master.currentTime
      
      if (abs(diffToMaster) > .06) {
        const newSlaveTime = master.currentTime + .05
        ytPlayer.seekTo(newSlaveTime, true)
        
        const diff = diffToMaster.toFixed(3)
        const masterAt = master.currentTime.toFixed(3)
        const slaveAt = slave.currentTime.toFixed(3)
        const targetAt = newSlaveTime.toFixed(3)
        const inf = `⚡️⚡️sync(${diff})-> slave:${slaveAt} master:${masterAt} new slave:${targetAt}`
        slog(inf)
      }
      if (master.paused !== slave.paused) {
        if (master.paused && slave.playerState === 1) { //: 1=playing
          ytPlayer.pauseVideo()
          slog('⚡️⚡️sync pause!')
        } else if (!master.paused && [2, 5].includes(slave.playerState)) {
          ytPlayer.playVideo()
          slog('⚡️⚡️sync play!')
        }
      }
      if (abs(master.playbackRate - slave.playbackRate) > .01) {
        slog('⚡️⚡️sync speed!', master.playbackRate.toFixed(3), slave.playbackRate.toFixed(3))
        ytPlayer.setPlaybackRate(master.playbackRate)
      }
      if (!slave.muted) {
        slog('⚡️⚡️sync mute!')
        ytPlayer.mute()
      }
    }
      
    const getMediaElementState = (fp = 0) => {
      if (!fp) {
        return console.error(`getMediaElement: dead observer?`, observer)
      }
      if (sourceUi.video$) {
        getVideoElementState()
        observer.currState = observer.videoState
      } else if (sourceUi.audio$) {
        getAudioElementState()
        observer.currState = observer.audioState

        if (sourceUi.isMocked) {   //: this is the syncing point as it's a quite low level
          if (sourceUi.iframe$) {
            getYtPlayerState()
            observer.currState.videoId = observer.iframeState.videoId
            syncMocked()
          } else {
            console.warn(`getMediaElementState(): no iframe in mocked mode!`, observer)
          }
        }
      }
      observer.currStateReduced = {...observer.currState, currentTime: 0}

      const stateHashReduced = hashOfString(JSON.stringify(observer.currStateReduced))
      const hasTimeChanged = observer.lastState.currentTime !== observer.currState.currentTime
      const hasAllChanged = observer.mediaStateHashReduced !== stateHashReduced
      if (hasTimeChanged || hasAllChanged) {
        //hasAllChanged && console.log(`OBSERVER: ALL CHANGED`)
        hasAllChanged && sourceUi.onStateChanged()
        hasTimeChanged && sourceUi.onTimeChanged()
        observer.mediaStateHashReduced = stateHashReduced
        observer.lastState = observer.currState
        /*if (playground.isSlave) {
          sendGeneral('state', state)
          console.log(`🚀state sent from slave`)
        }
        if (root.onYoutube) { //: cue pont!
          const canvas = ui.videoGrabCanvas$
          const ctx = canvas.getContext('2d')
          const video = mediaElement
  
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        }*/
      }
      //logState('last')
      
      //const fps = fp === observer.fp ? `${fp}✔️` : `${fp}❌ (${observer.fp})`
      //console.log(`------${sourceUi.sourceIx}--${fps}----${observer.lastState.title}`)
    }
    const lazyGetMediaElementState = startEndThrottle(getMediaElementState, observerTickPeriod)
    
    const tick = fp => {
      if (observer.fp === fp) {
        lazyGetMediaElementState(fp)
        schedule(2000).then(_ => tick(fp))
      } else {
        console.warn('observer tick aborted', fp, observer.fp)
      }
    }
      
    const init = _ => { //: this works for both video and audio
      const mediaElement = sourceUi.audio$ || sourceUi.video$
      observer.mediaElement = mediaElement
      const fp = 1 + getRndDig(6)
      mediaElement && post(_ => {
        mediaElement.addEventListener('onloadedmetadata', event => {
          console.log('ONLOADEDMETADATA', event)
          getMediaElementState(fp)
        })
        mediaElement.addEventListener('play', event => getMediaElementState(fp))
        mediaElement.addEventListener('pause', event => getMediaElementState(fp))
        mediaElement.addEventListener('seeked', event => getMediaElementState(fp))
        mediaElement.addEventListener('timeupdate', event => lazyGetMediaElementState(fp))
        console.log(`mediaObserver started listening to `, mediaElement)
        console.log(`observer started:`, fp, mediaElement.title)
        observer.fp = fp
        tick(fp)
      })
    }
    init()
    
    observer.destroy = _ => observer.fp = 0
    
    return observer
  }
  
  ui.recreateSourcePlayer = sourceUi => {
    const player = {}
      
    void sourceUi.mediaObserver?.destroy()
      
    const observer = sourceUi.mediaObserver = createMediaObserver(sourceUi)
    
    sourceUi.master = undef
    sourceUi.slave = undef
    sourceUi.beatTime = 0
    sourceUi.bpm = 0
    sourceUi.beatTime = .5
    sourceUi.bpm = 120
    
    const getState = _ => observer.getState()
    
    //8#3ae Core (unsynced) control methods
    
    sourceUi._stop = _ => {
      void sourceUi.ytPlayer?.pauseVideo?.()
      void sourceUi.audio$?.pause()
      void sourceUi.video$?.pause()
    }
    sourceUi._play = _ => {
      sourceUi.isMocked && void sourceUi.ytPlayer?.mute?.()
      
      void sourceUi.ytPlayer?.playVideo?.() //: playVideo is not valid if pressed too early
      void sourceUi.audio$?.play()
      void sourceUi.video$?.play()
    }
    sourceUi._seek = sec => {
      void sourceUi.ytPlayer?.seekTo?.(sec, true) //: on youtube this will be doubled with video$
      sourceUi.audio$ && (sourceUi.audio$.currentTime = sec)
      sourceUi.video$ && (sourceUi.video$.currentTime = sec)
    }
    sourceUi._seekRel = relSec => sourceUi._seek(observer.currState.currentTime + relSec)

    sourceUi._setPlaybackRate = pbr => {//+ check this out
      void sourceUi.ytPlayer?.setPlaybackRate?.(pbr)
      sourceUi.audio$ && (sourceUi.audio$.playbackRate = pbr)
      sourceUi.video$ && (sourceUi.video$.playbackRate = pbr)
    }
    sourceUi._toggleMute = _ => {
      sourceUi.audio$ && (sourceUi.audio$.muted = !sourceUi.audio$.muted)
      sourceUi.video$ && (sourceUi.video$.muted = !sourceUi.video$.muted)
    }
    sourceUi.hasControls = true
    
    const syncedControl = (funKey, ...args) => ui.getFlag('syncSources')
      ? ui.iterateSourceUis(sourceUi => sourceUi[funKey]?.(...args)) 
      : sourceUi[funKey](...args)
      
    //8#67f High level (synced) control methods
    
    sourceUi.stop = _ => syncedControl('_stop')
    sourceUi.play = _ => syncedControl('_play')
    sourceUi.seek = sec => syncedControl('_seek', sec)
    sourceUi.speed = pbr => syncedControl('_setPlaybackRate', pbr)
    sourceUi.seekRel = sec => syncedControl('_seekRel', sec)
    sourceUi.toggleMute = _ => syncedControl('_toggleMute')
    
    sourceUi.seekPt = pt => {
      const duration = getState().duration //: this could be slow with youtube master video...
      if (!duration) {
        return console.warn('sourceUi.seekPt failure: no duration', {pt, sourceUi})
      }
      sourceUi.seek(duration * pt / 100)
    }
    //+ needs revamp
    sourceUi.doBpm = async (calcSec = 15) => {
      set$(sourceUi.bpm1$, {attr: {state: 'calc'}})
      set$(sourceUi.bpm2$, {attr: {state: 'calc'}})
      calcSec = [0, 10, 20][calcSec] || calcSec
      if (getState().paused) {
        const sec = (getState().duration || 100) / 3
        console.log(`Force start for bpm at sec`, sec)
        sourceUi.seek(sec)
        sourceUi.play()
        await adelay(100)
      }
      const input = sources.getSourceNode(sourceUi.sourceIx)
      const bpmDetector = pg.beeFx.newFx('fx_bpm')
      input.connect(bpmDetector)
      bpmDetector.startPrivilegedBpmRequest(calcSec)
        .then(bpm => {
          setUi('bpm', {text: bpm, attr: {state: 'set'}})
          const {bpmFx} = sources.getSourceStage(sourceUi.sourceIx) || {}
            wassert(bpmFx)
            bpmFx.setValue('bpmOriginal', bpm + '#set')
        })
        .catch(msg => {
          console.warn(`Player BPM detection failed:`, msg)
          setUi('bpm', {text: '-Error-', attr: {state: 'err'}})
        })
        .finally(_ => {
          input.disconnect(bpmDetector)
          console.log(bpmDetector.int)
          set$(sourceUi.bpm1$, {attr: {state: ''}})
          set$(sourceUi.bpm2$, {attr: {state: ''}})
        })
    }

    const setUi = ui.setHost(sourceUi)
    
    sourceUi.onStateChanged = state => {
      const {title, duration, muted, paused, videoId} = observer.currState
      //sourceUi.setUi('title', {text: title})
      setUi('duration', {text: secToString(duration)})
      setUi('muted', {attr: {state: muted ? 'alert' : 'off'}})
      setUi('play', {attr: {state: paused ? 'on' : 'off'}})
      setUi('stop', {attr: {state: paused ? 'off' : 'on'}})
      
      //:  todo: not on every call!
      if (videoId?.length === 11 && sourceUi.masterThumb$) {
        const backgroundImage = `url('//img.youtube.com/vi/${videoId}/mqdefault.jpg')`
        sourceUi.setUi('masterThumb', {css: {backgroundImage}})
      }
      
      sourceUi.onTimeChanged() //: yack!
    }
    sourceUi.onTimeChanged = _ => {
      const {currentTime, duration} = observer.currState
      setUi('dragBar', {css: {__prog: 100 * currentTime / (duration || 1) + '%'}})
      setUi('current', {text: secToString(currentTime)})
    }

    sourceUi.refreshPlayerControl = data => {
      const {paused, currentTime = 0, volume, duration: d, playbackRate, videoId, videoTitle} = data
      const duration = Number.isNaN(d) ? 1 : d
      //set$(sourceUi.info$, {text: videoId + ': ' + videoTitle})
      const info = `paused=${paused} curr=${currentTime.toFixed(1)} vol=${volume} dur=${duration} pbRate=${playbackRate} videoId=${videoId} tit=${videoTitle}`
      setUi('info', {text: info})
    }
    
    const buildStage = _ => {
    }
  
    const buildUi = _ => {
      const dragBar = event => (event.type === 'click' || event.buttons & 1) &&
        sourceUi.seekPt(round(1000 * event.offsetX / event.target.clientWidth) / 10)
        
      const absSeekS = sec => _ => sourceUi.seel(sec)
      const relSeekS = sec => _ => sourceUi.seekRel(sec)
      const relSeekB = bt => _ => sourceUi.beatTime && sourceUi.seekRel(bt * sourceUi.beatTime)  
          
      set$(sourceUi.ctrl$, {html: ``}, [
        sourceUi.navNoneed$ = div$({class: 'src-above'}, [
          div$({class: 'bee-cmd n-start', text: 'Start', click: _ => absSeekS(0)}),
          div$({class: 'bee-cmd n-m30s', text: '-30s', click: relSeekS(-30)}),
          div$({class: 'bee-cmd n-m10s', text: '-10s', click: relSeekS(-10)}),
          div$({class: 'bee-cmd n-m2b', text: '-2b', click: _ => relSeekB(-2)}),
          div$({class: 'bee-cmd n-m1b', text: '-1b', click: _ => relSeekB(-1)}),
          div$({class: 'bee-cmd n-p1b', text: '+1b', click: _ => relSeekB(1)}),
          div$({class: 'bee-cmd n-p2b', text: '+2b', click: _ => relSeekB(2)}),
          div$({class: 'bee-cmd n-p10s', text: '+10s', click: relSeekS(10)}),
          div$({class: 'bee-cmd n-p30s', text: '+30s', click: relSeekS(30)})
        ]),
        div$({class: 'src-navtop'}, [
          sourceUi.bpm1$ = div$({class: 'bee-cmd', text: 'BPM', click: _ => sourceUi.doBpm(1)}),
          sourceUi.bpm2$ = div$({class: 'bee-cmd', text: 'BPM.X', click: _ => sourceUi.doBpm(2)}),
          sourceUi.bpm$ = div$({class: 'bee-box', text: '--?--'}),
          //bpm display
          sourceUi.play$ = div$({class: 'bee-cmd cc-play', text: 'Play', click: sourceUi.play}),
          sourceUi.stop$ = div$({class: 'bee-cmd cc-stop', text: 'Stop', click: sourceUi.stop}),
          div$({class: 'bee-cmd cc-flood', text: 'Flood', click: _ => sources.floodStages(sourceUi)}),
          sourceUi.muted$ = div$({class: 'bee-cmd cc-mute', text: 'Mute', click: sourceUi.toggleMute})
        ]),
        sourceUi.thumb$ = div$({class: 'nav-thumb'}, [
          sourceUi.dragBar$ = div$({class: 'drag-bar', on: {mousemove: dragBar, click: dragBar}}, [
            sourceUi.current$ = div$({class: 'curr time'}),
            sourceUi.duration$ = div$({class: 'dur time'})
          ])
        ])
      ])
    }
    buildUi()
  }
}
