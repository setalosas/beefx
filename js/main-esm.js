/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, DOMplusUltra, WaapiWrap, Playground, createUI} from './improxy-esm.js'

//const {adelay} = Corelib.Tardis
const {$, div$, leaf$, set$} = DOMplusUltra            //: from jQuery
const {runPlayground} = Playground
const {MediaElementPlayer} = window //: from MediaElementJs

const onDomReady = new Promise(resolve => $(resolve))

const onWaapiReady = new Promise(resolve => WaapiWrap.onRun(resolve))

const adelay = delay  => new Promise(resolve => setTimeout(resolve, delay))

const config = {
  platform: 'standalone', // extension
  mediaType: 'audioboth', // video
  useVideo: true,
  useAudio: false
}

void (async _ => {
  await onDomReady
  await adelay(1000)// = await onBeeFxExtReady()
  
  const root = {
    waCtx: await onWaapiReady,
    mediaElement: null
  }
  root.ui = createUI(config, root)
  
  if (config.platform === 'standalone') {
    root.mmenu$ = div$(root.ui.top$, {class: 'mediamenu'}, [
      div$({class: 'mm-item', text: 'Cascandy - Take Me Baby Reeemix SNOE (audio)', 
        click: _ => loadAudio('/au/cascandy.mp3')}),
      div$({class: 'mm-item', text: 'Astrud Gilberto - Agua de Beber (audio)', 
        click: _ => loadAudio('/au/astrud.mp3')}),
      div$({class: 'mm-item', text: 'Devendra Barnhardt - Angelica (audio)', 
        click: _ => loadAudio('/au/devendra.mp3')}),
      div$({class: 'mm-item', text: 'Tornadoes - Telstar (audio)', 
        click: _ => loadAudio('/au/telstar.mp3')}),
      div$({class: 'mm-item', text: 'Bob Azzam - Happy Birthday Cha Cha Cha (audio)', 
        click: _ => loadAudio('/au/chachacha.mp3')}),
      div$({class: 'mm-item', text: 'Iggy Pop - Do Not Go Gentle Into That Good Night (audio)', 
        click: _ => loadAudio('/au/iggy.mp3')}),
      div$({class: 'mm-item yt', text: 'Future Sound Of London - Essential Mix (youtube)', 
        click: _ => loadVideo('//youtube.com/watch?v=_8SBdkru4IY')}),
      leaf$('input', {attr: {type: 'file', accept: 'audio/*'}, on: {
        change: event => {
          const file = event.target.files[0]
          const fileUrl = window.URL.createObjectURL(file)
          loadAudio(fileUrl)
        }
      }}) 
    ])
    
    const loadVideo = url => {
      root.mmenu$.remove()
      set$(root.ui.top$, {class: 'video-source'})
      waitForMediaElement(root.ui.insertVideoPlayer(url))
    }
    const loadAudio = url => {
      root.mmenu$.remove()
      waitForMediaElement(root.ui.insertAudioPlayer(url))
    }
    const waitForMediaElement = tmpMediaElement => new MediaElementPlayer(tmpMediaElement, {
      stretching: 'none',
      features: ['playpause', 'current', 'progress', 'duration', 'tracks', 'volume', 'fullscreen'],
      success: (fullMediaElement, domObject) => {
        fullMediaElement.load()
        //: not working if volume ctrl is set above: fullMediaElement.setVolume(.2)
        console.log({fullMediaElement, domObject})
        root.mediaElement = domObject
        runPlayground(root)
      }
    })
  } else { //: youtube chrome extension
    //:TBD
  }
})()
