/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
/* eslint-disable no-unused-vars */   
   
import {Corelib, DOMplusUltra} from '../improxy-esm.js'

const {undef, hashOfString, getRndDig, no} = Corelib
const {wassert, weject, wejectNaN} = Corelib.Debug
const {post, startEndThrottle, schedule, adelay} = Corelib.Tardis
const {secToString} = Corelib.DateHumanizer
const {div$, set$, q$} = DOMplusUltra
const {round, abs} = Math

//8#49f -------------------------- Players ui --------------------------

export const extendUi = ui => { //: Extends the sourceUi object with player functionality
  const {pg} = ui
  const {sources, stageMan, beeFx} = pg // eslint-disable-line no-unused-vars
  
  const logOn = false
  const logScrapingOn = false
  const logMediaStateOn = false
  const clog = (...args) => logOn && console.log(...args) // eslint-disable-line
  const slog = (...args) => logScrapingOn && console.log(...args) // eslint-disable-line
  
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
      slog(`🟦 ${real.videoTitle = h1Mini}`)
      const wcEndPoints = [...miniplayer.querySelectorAll('a#wc-endpoint')]
      for (const wcEndPoint of wcEndPoints) {
        const videoId = wcEndPoint.getAttribute('href')?.split('?v=')[1]?.substr(0, 11)
        const title = wcEndPoint.querySelector('#video-title')?.getAttribute('title')
        title === h1Mini && (real.videoId = videoId)
      }
       slog(`🔷${real.videoId}`)
    } else {
      real.videoTitle = h1Big
      real.videoId = q$('.ytd-page-manager[video-id]')?.getAttribute('video-id')
      slog(`🟥${real.videoTitle}`)
      slog(`🔶 ${real.videoId}`)
    }
    return real
  }
  
  const createMediaObserver = (sourceUi) => {
    const observer = {
      sourceUi, //: for debug only
      videoState: undef,
      audioState: undef,
      iframeState: undef,
      lastState: {},
      currState: {},
      videoHash: '',
      audioHash: '',
      iframeHash: ''
    }
    const observerTickPeriod = 500 // 1000
    
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
      return observer.iframeState = {
        paused: playerState !== 1, playerState, currentTime, duration, playbackRate,
        title, videoId, volume, muted, isIframeState: true
      }
    }
    
    const getVideoElementState = _ => { //: youtube.com video
      const {paused, volume, title, muted, currentTime, duration, playbackRate} = sourceUi.video$
      const {videoTitle, videoId} = scrapingYoutubeForVideoInfo()
      return observer.videoState = {
        paused, currentTime, duration, playbackRate,
        title, videoTitle, videoId, volume: volume * 100, muted, isVideoState: true
      }
    }
    
    const getAudioElementState = _ => {
      const {paused, volume, title, muted, currentTime, duration, playbackRate} = sourceUi.audio$
      return observer.audioState = {
        paused, currentTime, duration, playbackRate,
        title, videoTitle: '', videoId: '', volume: volume * 100, muted, isAudioState: true
      }  
    }
    const logState = type => {
      const state = observer[type + 'State']
      if (state) {
        const {paused, currentTime = 0.1, duration: d, playbackRate} = state
        const {title = '', videoTitle = '', videoId, volume, muted} = state
        const duration = d || 0.1 //Number.isNaN(d) ? 1 : d
        const info = `paused=${paused} curr=${currentTime.toFixed(2)}  dur=${duration.toFixed(2)} pbRate=${playbackRate} vol=${volume} muted=${muted} title=${title.substr(0, 40)} videoId=${videoId} videoTitle=${videoTitle.substr(0, 30)}`
        slog(type, info)
      }
    }

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
      if (sourceUi.iframe$) {
        getYtPlayerState() //: no need to store in currState, the video / audio will overwrite it
      }
      if (sourceUi.video$) {
        getVideoElementState()
        observer.currState = {...observer.videoState}
      } else if (sourceUi.audio$) {
        getAudioElementState()
        observer.currState = {...observer.audioState}

        if (sourceUi.isMocked) {   //: this is the syncing point as it's a quite low level
          if (sourceUi.iframe$) {
            syncMocked()
          } else {
            console.warn(`getMediaElementState(): no iframe in mocked mode!`, observer)
          }
        }
      }
      const {currState, iframeState} = observer
      if (currState.videoId?.length !== 11) {
        currState.videoId = iframeState?.videoId
      }
      currState.title = currState.title || iframeState?.title || ''
      if (Number.isNaN(currState.duration)) {
        currState.duration = iframeState?.duration
      }
      
      observer.currStateReduced = {...observer.currState, currentTime: 0}

      const stateHashReduced = hashOfString(JSON.stringify(observer.currStateReduced))
      const hasTimeChanged = observer.lastState.currentTime !== observer.currState.currentTime
      const hasAllChanged = observer.mediaStateHashReduced !== stateHashReduced
      if (hasTimeChanged || hasAllChanged) {
        if (logMediaStateOn && hasAllChanged) {
          const tab = []
          observer.currState && tab.push(observer.currState)
          observer.audioState && tab.push(observer.audioState)
          observer.videoState && tab.push(observer.videoState)
          observer.iframeState && tab.push(observer.iframeState)
          console.table(tab)
        }
        hasAllChanged && sourceUi.onStateChanged()
        hasTimeChanged && sourceUi.onTimeChanged()
        observer.mediaStateHashReduced = stateHashReduced
        observer.lastState = observer.currState
        
        //if (playground.isSlave) { //: multi-window sync, disabled
          //sendGeneral('state', state)
          //console.log(`🚀state sent from slave`)
        //
      }
      if (logOn) {
        logState('last')
        const fps = fp === observer.fp ? `${fp}✔️` : `${fp}❌ (${observer.fp})`
        clog(`------${sourceUi.sourceIx}--${fps}----${observer.lastState.title}`)
      }
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
          slog('ONLOADEDMETADATA', event)
          getMediaElementState(fp)
        })
        mediaElement.addEventListener('play', event => getMediaElementState(fp))
        mediaElement.addEventListener('pause', event => getMediaElementState(fp))
        mediaElement.addEventListener('seeked', event => getMediaElementState(fp))
        mediaElement.addEventListener('timeupdate', event => lazyGetMediaElementState(fp))
        slog(`mediaObserver started listening to `, fp, mediaElement.title, mediaElement)
        observer.fp = fp
        tick(fp)
      })
    }
    init()
    
    observer.destroy = _ => observer.fp = 0
    
    return observer
  }
  
  ui.recreateSourcePlayer = sourceUi => {
    const {sourceIx} = sourceUi
    const source = sources.getSource(sourceIx)
    sourceUi.bpmFx = sources.getSourceStage(sourceIx).bpmFx
    
    //: Build/destroy helpers for recall (source change)

    const createBpmDetector = _ => {
      weject(sourceUi.bpmDetector)
      sourceUi.bpmInput = sources.getSourceNode(sourceIx)
      sourceUi.bpmDetector = beeFx.newFx('fx_bpm')
      sourceUi.bpmInput.connect(sourceUi.bpmDetector)
    }
    const destroyBpmDetector = _ => {
      if (sourceUi.bpmDetector) {
        sourceUi.bpmDetector.deactivate()
        delete sourceUi.bpmDetector
        sourceUi.inBpm = false
      }
    }
    destroyBpmDetector()

    void sourceUi.mediaObserver?.destroy()
    const observer = sourceUi.mediaObserver = createMediaObserver(sourceUi)
    
    const getState = _ => observer.getState()

    sourceUi.master = undef //: sync - not used
    sourceUi.slave = undef
    
    //8#3ae Low level (unsynced) control methods
    
    sourceUi._pause = _ => {
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
    sourceUi._setPitchToBpm = bpm => sourceUi.bpmFx.setPitchToBpm(bpm)
    sourceUi.hasControls = true
    
    const forcedSyncedControl = (funKey, ...args) =>
      ui.iterateSourceUis(sourceUi => sourceUi[funKey]?.(...args)) 
      
    const syncedControl = (funKey, ...args) => ui.getFlag('syncSources')
      ? forcedSyncedControl(funKey, ...args)
      : sourceUi[funKey](...args)
      
    //8#67f High level (synced) control methods
    
    sourceUi.stop = _ => syncedControl('_pause')
    sourceUi.pause = _ => syncedControl('_pause')
    sourceUi.play = _ => syncedControl('_play')
    sourceUi.seek = sec => syncedControl('_seek', sec)
    sourceUi.speed = pbr => syncedControl('_setPlaybackRate', wejectNaN(pbr))
    sourceUi.seekRel = sec => syncedControl('_seekRel', sec)
    sourceUi.toggleMute = _ => syncedControl('_toggleMute')
    
    sourceUi.seekPt = pt => {
      const duration = getState().duration //: this could be slow with youtube master video...
      if (!duration) {
        return console.warn('sourceUi.seekPt failure: no duration', {pt, sourceUi})
      }
      sourceUi.seek(duration * pt / 100)
    }
    
    sourceUi.doBpm = async (calcSec = 15) => {
      if (sourceUi.inBpm) {
        return
      }
      sourceUi.inBpm = true
      const nodeKey = 'bpm' + calcSec
      setUi(nodeKey, {attr: {state: 'calc'}})
      sourceUi.bpmFx.setValue('pitch', 100)  //: set standard speed for detection
      calcSec = [0, 10, 20][calcSec] || calcSec
      if (getState().paused) {
        const sec = (getState().duration || 100) / 3
        sourceUi.seek(sec)
        sourceUi.play()
        await adelay(100)
      }
      createBpmDetector()
      sourceUi.bpmDetector.startPrivilegedBpmRequest(calcSec)
        .then(bpm => {
          sources.bpmInChanged(sourceIx, bpm)
          setUi(nodeKey, {css: {__bt: 30 / bpm + 's'}})
          setUi('bpmX', {text: 'syncBPM', attr: {state: 'on'}}) //: syncBpm
        })
        .catch(msg => {
          console.warn(`Player BPM detection failed:`, msg)
          setUi('bpmX', {text: '-Error-', attr: {state: 'err'}})
        })
        .finally(_ => {
          destroyBpmDetector()
          setUi(nodeKey, {attr: {state: 'done'}})
        })
    }
    sourceUi.syncBpm = _ => {
      forcedSyncedControl('_setPitchToBpm', sourceUi.bpmFx.int.bpmOut)
    }

    const setUi = ui.setHost(sourceUi)
    const lastDOM = {}
    
    sourceUi.onStateChanged = state => {
      const {title, duration, muted, paused, videoId} = observer.currState
      title && setUi('info', {text: title})
      setUi('duration', {text: secToString(duration)})
      setUi('muted', {attr: {state: muted ? 'alert' : 'off'}})
      setUi('play', {attr: {state: paused ? 'on' : 'off'}})
      setUi('stop', {attr: {state: paused ? 'off' : 'on'}})
      
      if (videoId !== lastDOM.videoId && videoId?.length === 11 && sourceUi.masterThumb$) {
        lastDOM.videoId = videoId
        const backgroundImage = `url('//img.youtube.com/vi/${videoId}/mqdefault.jpg')`
        setUi('masterThumb', {css: {backgroundImage}})
      }
      sourceUi.onTimeChanged()
    }
    
    sourceUi.onTimeChanged = _ => {
      const {currentTime, duration} = observer.currState
      if (currentTime !== lastDOM.currentTime || duration !== lastDOM.duration) {
        lastDOM.capture({currentTime, duration})
        setUi('dragBar', {css: {__prog: 100 * currentTime / (duration || 1) + '%'}})
        setUi('current', {text: secToString(currentTime)})
      }
    }

    const buildUi = _ => {
      const dragBar = event => (event.type === 'click' || event.buttons & 1) &&
        sourceUi.seekPt(round(1000 * event.offsetX / event.target.clientWidth) / 10)
        
      const absSeekS = sec => _ => sourceUi.seek(sec)
      const relSeekS = sec => _ => sourceUi.seekRel(sec)
      const relSeekB = bt => _ => source.beatTimeIn && sourceUi.seekRel(bt * source.beatTimeIn)  
          
      set$(sourceUi.ctrl$, {html: ``}, [
        sourceUi.navNoneed$ = div$({class: 'src-above'}, [
          div$({class: 'bee-cmd n-start', text: 'Start', click: absSeekS(0)}),
          div$({class: 'bee-cmd n-m30s', text: '-30s', click: relSeekS(-30)}),
          div$({class: 'bee-cmd n-m10s', text: '-10s', click: relSeekS(-10)}),
          div$({class: 'bee-cmd n-m2b', text: '-2b', click: relSeekB(-2)}),
          div$({class: 'bee-cmd n-m1b', text: '-1b', click: relSeekB(-1)}),
          div$({class: 'bee-cmd n-p1b', text: '+1b', click: relSeekB(1)}),
          div$({class: 'bee-cmd n-p2b', text: '+2b', click: relSeekB(2)}),
          div$({class: 'bee-cmd n-p10s', text: '+10s', click: relSeekS(10)}),
          div$({class: 'bee-cmd n-p30s', text: '+30s', click: relSeekS(30)})
        ]),
        div$({class: 'src-navtop'}, [
          sourceUi.bpm1$ = 
            div$({class: 'bee-cmd bpm-cmd bpm1', text: 'BPM', click: _ => sourceUi.doBpm(1)}),
          sourceUi.bpm2$ = 
            div$({class: 'bee-cmd bpm-cmd bpm2', text: 'BPM.X', click: _ => sourceUi.doBpm(2)}),
          sourceUi.bpmX$ = div$({class: 'bee-cmd', text: 'syncBPM', click: sourceUi.syncBpm}),
          sourceUi.play$ = div$({class: 'bee-cmd cc-play', text: 'Play', click: sourceUi.play}),
          sourceUi.stop$ = div$({class: 'bee-cmd cc-stop', text: 'Stop', click: sourceUi.stop}),
          sourceUi.muted$ = 
            div$({class: 'bee-cmd cc-mute', text: 'Mute', click: sourceUi.toggleMute}),
          div$({class: 'bee-cmd cc-flood', text: 'Flood', click: _ => sources.floodStages(sourceUi)})
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
