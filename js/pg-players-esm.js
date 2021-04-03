/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, DOMplusUltra} from './improxy-esm.js'

const {Ø, s_a, undef, clamp, nop, isNum, getRnd, hashOfString} = Corelib
const {wassert} = Corelib.Debug
const {schedule, adelay, NoW, since, startEndThrottle} = Corelib.Tardis
const {q$} = DOMplusUltra
const {BroadcastChannel} = window

export const createRadio = _ => {
  const broadcastChannel = new BroadcastChannel('beeFx')
  const radio = {
    broadcastChannel
  }
  radio.postMessage = data => broadcastChannel.postMessage(data)
  radio.listenMessage = listener => broadcastChannel.addEventListener('message', listener)
  return radio
}

export const extendWithPlayers = (playground, root) => {
  const {waCtx, ui} = root
  
  const radio = createRadio()

  const localPlayer = {
    mediaElement: undef,
    mediaState: {},
    mediaStateHash: ''
  }
  const remotePlayer = {
    mediaState: {}
  }
  
  const players = {
    radio,
    localPlayer,
    remotePlayer
  }

  //8#a48 ------------ Communication primitives ------------
      
  const sendGeneral = (cmd, data = {}) => ((playground.isSlave && cmd === 'state') ||
    playground.isMaster > -1) && radio.postMessage({cmd, data})
  
  const sendToSlave = (cmd, data = {}) => playground.isMaster 
    ? radio.postMessage({cmd, data})
    : console.warn(`Must be master!`, {cmd, data})
   
  const sendState = _ => {
    const state = {//+ ez disben kene legyen
      title: 'asdsadasd',
      bpm: 133
    }
    sendGeneral('state', state)
  }  
  
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
      //console.log(`🟦 ${real.videoTitle = h1Mini}`)
      const wcEndPoints = [...miniplayer.querySelectorAll('a#wc-endpoint')]
      for (const wcEndPoint of wcEndPoints) {
        const videoId = wcEndPoint.getAttribute('href')?.split('?v=')[1]?.substr(0, 11)
        const title = wcEndPoint.querySelector('#video-title')?.getAttribute('title')
        title === h1Mini && (real.videoId = videoId)
      }
       //console.log(`🔷${real.videoId}`)
    } else {
      real.videoTitle = h1Big
      real.videoId = q$('.ytd-page-manager[video-id]')?.getAttribute('video-id')
      //console.log(`🟥${real.videoTitle}`)
      //console.log(`🔶 ${real.videoId}`)
    }
    return real
  }

  //8#497 ------------ Listening ot local player ------------
  
  const getLocalMediaElementState = _ => {
    const {mediaElement} = localPlayer

    if (mediaElement) {
      const {paused, currentTime, src, volume, title, duration, playbackRate} = mediaElement
      const state = {paused, currentTime, src, volume, title, duration, playbackRate}
      
      const {videoTitle, videoId} = root.onYoutube ? scrapingYoutubeForVideoInfo() : {}
  
      state.videoTitle = videoTitle || mediaElement.title || '-'
      state.videoId = videoId || root.localAudio?.videoId || ''

      if (mediaElement.src !== mediaElement.currentSrc) {
        state.currentSrc = mediaElement.currentSrc
      }
      const stateHash = hashOfString(JSON.stringify(state))
      if (localPlayer.mediaStateHash !== stateHash) {
        localPlayer.mediaStateHash = stateHash
        localPlayer.mediaState = state
        
        if (playground.isSlave) {
          sendGeneral('state', state)
          console.log(`🚀state sent from slave`)
        }
        //dis.remoteState = state
        ui.refreshPlayerControl(0, state)
        //console.log(`local state updated`, state)
      }
      if (root.onYoutube) {
        const canvas = ui.videoGrabCanvas$
        const ctx = canvas.getContext('2d')
        const video = mediaElement

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      }
      return state
    } else {
      console.warn(`no MediaElement`)
    }
  }
  const lazyGetLocalMediaElementState = startEndThrottle(getLocalMediaElementState, 1000)
  
  window.addEventListener('transitionend', _ => lazyGetLocalMediaElementState())

  const tick = _ => {
    lazyGetLocalMediaElementState()
    schedule(5000).then(tick)
  }
  //tick()
    
  players.initLocalMediaListeners = mediaElement => { //: this works for both video and audio
    localPlayer.mediaElement = wassert(mediaElement)
    mediaElement.addEventListener('onloadedmetadata', event => {
      console.log('ONLOADEDMETADATA', event)
      getLocalMediaElementState(true)
    })
    mediaElement.addEventListener('play', event => getLocalMediaElementState(true))
    mediaElement.addEventListener('pause', event => getLocalMediaElementState(true))
    mediaElement.addEventListener('seeked', event => getLocalMediaElementState(true))
    mediaElement.addEventListener('timeupdate', event => lazyGetLocalMediaElementState())
    //getLocalMediaElementState()
    tick()
  }
  
  //8#95c ----------------- Local + remote player control ---------------- 
  
  const createPlayerObj = isLocal => {
    const player = isLocal ? localPlayer : remotePlayer
    
    const playerObj = { //+ mi a retkes uristen budos redvas fasza ez????????
      //mediaElement: undef,
      mediaState: {}
    }
    
    const getMediaProp = (prop, src) => {
      const state = player.mediaState
      if (!state) {
        return console.warn('getMediaProp failure: no state', {prop, isLocal, players})
      }
      const val = state[prop]
      if (typeof val === Ø || !isNum(val)) {
        return console.warn(`getMediaPropt failure:`, {isLocal, prop, src, val})
      }
      return val
    }
    
    const lazySendSeekToSlave = startEndThrottle(sendToSlave, 50)
    
    playerObj.seekAbsSec = sec => {
      sec = clamp(sec, 0, player.mediaState.duration)
      wassert(isNum(sec))
      isLocal
        ? (player.mediaElement.currentTime = sec)
        : lazySendSeekToSlave('seek', {sec})
      }

    playerObj.seekPt = pt => {
      const duration = getMediaProp('duration', 'seekPt')
      if (!duration) {
        return console.warn('players.seekPt failure: no duration', {pt, isLocal, players})
      }
      playerObj.seekAbsSec(duration * pt / 100)
    }
    
    playerObj.seekRelSec = relsec => {
      const currentTime = getMediaProp('currentTime', 'seekRelSec')
      playerObj.seekAbsSec(currentTime + relsec)
    }
    
    playerObj.play = _ => isLocal ? player.mediaElement.play() : sendToSlave('play')
    playerObj.pause = _ => isLocal ? player.mediaElement.pause() : sendToSlave('pause')
    
    return playerObj
  }
  const localPlayerObj = createPlayerObj(true)
  const remotePlayerObj = createPlayerObj(false)
  
  players.control = (cmd, par, isLocal) => {
    wassert(isLocal || !playground.isSlave)
    
    const playerObj = isLocal ? localPlayerObj : remotePlayerObj
    
    const action = playerObj[{
      seekpt: 'seekPt',
      relseeks: 'seekRelSec',
      relseekb: 'noooooono',
      absseeks: 'seekAbsSec',
      play: 'play',
      pause: 'pause'
    }[cmd]]
    if (action) {
      action(par)
    } else {
      console.warn(`player.control unknown cmd:`, {cmd, par, isLocal})
    }
  }
  
  players.init = _ => {
    //ui.refreshPlayerControl(0, localPlayer.mediaState)
    //ui.refreshPlayerControl(1, remotePlayer.mediaState)
  }
  
  //8#769 -------------- Radio listeners --------------
  
  players.initRadioListeners = _ => radio.listenMessage(event => {
    //
    const ratio = ({gain}) => playground.incomingRatio(gain)

    const play = _ => localPlayer.mediaElement.play()
    const pause = _ => localPlayer.mediaElement.play()
    const seek = data => localPlayer.mediaElement.currentTime = data.sec
    const speed = data => localPlayer.mediaElement.playbackRate = data.speed //+ nincs meg send parja
    const bpm = data => { //: got a bpm change request
    }
    const state = (data, stEndRatio) => { //: got a state
      //console.log(data)
      remotePlayer.mediaState = data
      ui.refreshPlayerControl(1, data)//: must be master -> 1
    }
    
    const {cmd, data, fp} = event.data
    
    if (playground.fingerPrint !== fp) {
      if (playground.isSlave) {
        const action = {ratio, play, pause, speed, seek, bpm}[cmd]
        if (action) {
          action(data)
        } else {
          console.error('Ill communication (cmd)', {cmd, data, fp, event})
          debugger
        }
      } else if (playground.isMaster) {
        const action = {state}[cmd]
        if (action) {
          action(data)
        } else {
          console.error('Ill communication (cmd)', {cmd, data, fp, event})
          debugger
        }
      }
    }
  })
  
  return players  
}
