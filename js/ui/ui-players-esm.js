/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
/* eslint-disable no-unused-vars */   
   
import {Corelib, DOMplusUltra} from '../improxy-esm.js'

const {Ø, undef, isNum, isFun, nop, clamp, s_a, hashOfString} = Corelib
const {wassert, weject, brexru} = Corelib.Debug
const {post, startEndThrottle, schedule} = Corelib.Tardis
const {secToString} = Corelib.DateHumanizer
const {div$, leaf$, set$, setClass$, q$, q$$, haltEvent} = DOMplusUltra
const {round, abs} = Math

//8#49f --------------------------Players ui --------------------------

export const extendUi = ui => {
  const {root, pg} = ui
  //const {stageMan, players, sources} = pg
  
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
      videoState: {},
      audioState: {},
      iframeState: {},
      videoHash: '',
      audioHash: '',
      iframeHash: ''
    }
    const observerTickPeriod = 1000
    
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
        src: '', title, videoId, volume, muted
      }
      return observer.iframeState
    }
    
    const getVideoElementState = _ => { //: youtube.com video
      const {paused, src, volume, title,  muted} = sourceUi.video$
      const {currentTime, duration, playbackRate} = sourceUi.video$
      const {videoTitle, videoId} = scrapingYoutubeForVideoInfo()
      return observer.videoState = {
        paused, currentTime, duration, playbackRate,
        src, title, videoTitle, videoId, volume: volume * 100, muted
      }
    }
    
    const getAudioElementState = _ => {
      const {paused, src, volume, title, muted} = sourceUi.audio$
      const {currentTime, duration, playbackRate} = sourceUi.audio$
      const videoId = ''
      return observer.audioState = {
        paused, currentTime, duration, playbackRate,
        src, title, videoTitle: '', videoId: '', volume: volume * 100, muted
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
    const syncMocked = _ => { // startEndThrottle(_ => {
      const {iframeState: slave, audioState: master} = observer
      const {ytPlayer} = sourceUi
      const diffToMaster = slave.currentTime - master.currentTime
      if (abs(diffToMaster) > .06) {
        const newSlaveTime = master.currentTime + .05
        const inf = `⚡️⚡️sync(${diffToMaster.toFixed(3)})-> slave:${slave.currentTime.toFixed(3)} master:${master.currentTime.toFixed(3)} new slave: ${newSlaveTime.toFixed(3)}`
        ytPlayer.seekTo(newSlaveTime, true)
        console.log(inf)
      }
      if (master.paused !== slave.paused) {
        if (master.paused && slave.playerState === 1) { //: 1=playing
          ytPlayer.pauseVideo()
          console.log('⚡️⚡️sync pause!')
        } else if (!master.paused && [2, 5].includes(slave.playerState)) {
          ytPlayer.playVideo()
          console.log('⚡️⚡️sync play!')
        }
      }
      if (!slave.muted) {
        console.log('⚡️⚡️sync mute!')
        ytPlayer.mute()
      }
    }//, observerTickPeriod)
      
    const getMediaElementState = _ => {
      sourceUi.video$ && getVideoElementState()
      sourceUi.audio$ && getAudioElementState()
      sourceUi.iframe$ && getYtPlayerState()
      
      //+ syncing here, mute also, playstate also!
      
      if (sourceUi.isMocked) {
        syncMocked()
      }

      sourceUi.video$ && logState('video')
      sourceUi.audio$ && logState('audio')
      sourceUi.iframe$ && logState('iframe')
      console.log('--------')

      /*
    
      state.videoTitle = videoTitle || '-'
      state.videoId = videoId // || root.localAudio?.videoId || ''

      if (mediaElement.src !== mediaElement.currentSrc) {
        state.currentSrc = mediaElement.currentSrc
      }
      const stateHash = hashOfString(JSON.stringify(state))
      if (observer.mediaStateHash !== stateHash) {
        observer.mediaStateHash = stateHash
        observer.mediaState = state
        
        if (playground.isSlave) {
          sendGeneral('state', state)
          console.log(`🚀state sent from slave`)
        }
        //dis.remoteState = state
        sourceUi.refreshPlayerControl(state)
        //console.log(`local state updated`, state)
      }
      if (root.onYoutube) { //: cue pont!
        const canvas = ui.videoGrabCanvas$
        const ctx = canvas.getContext('2d')
        const video = mediaElement

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      }
      */
      //return state
    }
    const lazyGetMediaElementState = startEndThrottle(getMediaElementState, observerTickPeriod)
    
    const tick = _ => {
      lazyGetMediaElementState()
      schedule(2000).then(tick)
    }
      
    const init = _ => { //: this works for both video and audio
      const mediaElement = sourceUi.audio$ || sourceUi.video$
      if (mediaElement) {
        mediaElement.addEventListener('onloadedmetadata', event => {
          console.log('ONLOADEDMETADATA', event)
          getMediaElementState()
        })
        mediaElement.addEventListener('play', event => getMediaElementState())
        mediaElement.addEventListener('pause', event => getMediaElementState())
        mediaElement.addEventListener('seeked', event => getMediaElementState())
        mediaElement.addEventListener('timeupdate', event => lazyGetMediaElementState())
        console.log(`mediaObserver started listening to `, mediaElement)
      }
      tick()
    }
    init()
    
    return observer
  }
  
  ui.recreateSourcePlayer = sourceUi => {
    const player = {}
    
    sourceUi.stop = _ => {
      void sourceUi.ytPlayer?.pauseVideo()
      void sourceUi.audio$?.pause()
      void sourceUi.video$?.pause()
    }
    sourceUi.play = _ => {
      void sourceUi.ytPlayer?.playVideo()
      sourceUi.isMocked && void sourceUi.ytPlayer?.mute()
      void sourceUi.audio$?.play()
      void sourceUi.video$?.play()
    }
    
    sourceUi.refreshPlayerControl = data => {
      const {paused, currentTime = 0, volume, duration: d, playbackRate, videoId, videoTitle} = data
      const duration = Number.isNaN(d) ? 1 : d
      //set$(sourceUi.info$, {text: videoId + ': ' + videoTitle})
      const info = `paused=${paused} curr=${currentTime.toFixed(1)} vol=${volume} dur=${duration} pbRate=${playbackRate} videoId=${videoId} tit=${videoTitle}`
      set$(sourceUi.info$, {text: info})
      
      /* const player = players[ix]
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
      } */
    }
    sourceUi.mediaObserver = createMediaObserver(sourceUi)
    /* 
    if (sourceUi.isMocked) { //: ez bonyi, 2 observert kell osszehangolni 1 sourceUiba es playerbe!
      sourceUi.mockObserver = createMediaObserver(sourceUi, {isVideo: false})
      sourceUi.mediaObserver = createMediaObserver(sourceUi, {isVideo: false})
      
      // iframe + audio$
    } else if (sourceUi.video$) { //: youtube
      sourceUi.mediaObserver = createMediaObserver(sourceUi, {isVideo: true})
    } else if (sourceUi.audio$) { //: audio without videoId
      sourceUi.mediaObserver = createMediaObserver(sourceUi, {isVideo: false})
    } */
  }
}

/* 
const create = _ => {
  const audio = {}
    audiorama$ = div$({class: '', attr: {id: 'audio-player-container'}},
      leaf$('audio', {attr: {src:''}}),
      div$({class: 'play'})
      div$({class: 'play'})

  <button id="play-icon"></button>
  <span id="current-time" class="time">0:00</span>
  <input type="range" id="seek-slider" max="100" value="0">
  <span id="duration" class="time">0:00</span>
  <output id="volume-output">100</output>
  <input type="range" id="volume-slider" max="100" value="100">
  <button id="mute-icon"></button>
</div>
const playIconContainer = document.getElementById('play-icon');
const audioPlayerContainer = document.getElementById('audio-player-container');
const seekSlider = document.getElementById('seek-slider');
const volumeSlider = document.getElementById('volume-slider');
const muteIconContainer = document.getElementById('mute-icon');
let playState = 'play';
let muteState = 'unmute'

playIconContainer.addEventListener('click', () => {
    if(playState === 'play') {
        audio.play();
        playState = 'pause';
    } else {
        audio.pause();
        playState = 'play';
    }
});

muteIconContainer.addEventListener('click', () => {
    if(muteState === 'unmute') {
        audio.muted = true;
        muteState = 'mute';
    } else {
        audio.muted = false;
        muteState = 'unmute';
    }
});

const showRangeProgress = (rangeInput) => {
    if(rangeInput === seekSlider) audioPlayerContainer.style.setProperty('--seek-before-width', rangeInput.value / rangeInput.max * 100 + '%');
    else audioPlayerContainer.style.setProperty('--volume-before-width', rangeInput.value / rangeInput.max * 100 + '%');
}

seekSlider.addEventListener('input', (e) => {
    showRangeProgress(e.target);
});
volumeSlider.addEventListener('input', (e) => {
    showRangeProgress(e.target);
});

const audio = document.querySelector('audio');
const durationContainer = document.getElementById('duration');
const currentTimeContainer = document.getElementById('current-time');
const outputContainer = document.getElementById('volume-output');
let raf = null;

const calculateTime = (secs) => {
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    const returnedSeconds = seconds < 10 ? `0${seconds}` : `${seconds}`;
    return `${minutes}:${returnedSeconds}`;
}

const displayDuration = () => {
    durationContainer.textContent = calculateTime(audio.duration);
}

const setSliderMax = () => {
    seekSlider.max = Math.floor(audio.duration);
}

const displayBufferedAmount = () => {
    const bufferedAmount = Math.floor(audio.buffered.end(audio.buffered.length - 1));
    audioPlayerContainer.style.setProperty('--buffered-width', `${(bufferedAmount / seekSlider.max) * 100}%`);
}

const whilePlaying = () => {
    seekSlider.value = Math.floor(audio.currentTime);
    currentTimeContainer.textContent = calculateTime(seekSlider.value);
    audioPlayerContainer.style.setProperty('--seek-before-width', `${seekSlider.value / seekSlider.max * 100}%`);
    raf = requestAnimationFrame(whilePlaying);
}

if (audio.readyState > 0) {
    displayDuration();
    setSliderMax();
    displayBufferedAmount();
} else {
    audio.addEventListener('loadedmetadata', () => {
        displayDuration();
        setSliderMax();
        displayBufferedAmount();
    });
}

audio.addEventListener('progress', displayBufferedAmount);

seekSlider.addEventListener('input', () => {
    currentTimeContainer.textContent = calculateTime(seekSlider.value);
    if(!audio.paused) {
        cancelAnimationFrame(raf);
    }
});

seekSlider.addEventListener('change', () => {
    audio.currentTime = seekSlider.value;
    if(!audio.paused) {
        requestAnimationFrame(whilePlaying);
    }
});

volumeSlider.addEventListener('input', (e) => {
    const value = e.target.value;

    outputContainer.textContent = value;
    audio.volume = value / 100;
}); */
