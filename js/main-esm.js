/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, DOMplusUltra, onWaapiReady, Playground, createUI} from './improxy-esm.js'

//const {adelay} = Corelib.Tardis
const {$, div$, leaf$, set$} = DOMplusUltra            //: from jQuery
const {runPlayground} = Playground
const {MediaElementPlayer} = window //: from MediaElementJs

const onDomReady = new Promise(resolve => $(resolve))

const adelay = delay  => new Promise(resolve => setTimeout(resolve, delay))

const config = {
  platform: 'standalone', // extension
  mediaType: 'audioboth', // video
  useVideo: true,
  useAudio: false
}

const mp3s = [
  ['/au/cascandy.mp3', 'Cascandy - Take Me Baby Reeemix SNOE (audio)','9PCz1KPAJ0c'],
  ['/au/astrud.mp3', 'Astrud Gilberto - Agua de Beber (audio)', 'qZx-Z3_n4t8'], 
  ['/au/jorge.mp3', 'Nightmares on Wax - Jorge (audio)', 'uFpwKExK9Uw'], 
  ['/au/sensual.mp3', 'The Herbaliser - The Sensual Woman (audio)', 'UPVbcXiK4y8'], 
  ['/au/djsensei.mp3', 'DJ Sensei - The Sinphony (audio)', '94fQIqRCi4o'], 
  ['/au/sunny.mp3', 'Montefiori Cocktail - Sunny (audio)', 'pNmX9MgM2vc'], 
  ['/au/devendra.mp3', 'Devendra Barnhardt - Angelica (audio)'], 
  ['/au/telstar.mp3', 'Tornadoes - Telstar (audio)'], 
  ['/au/chachacha.mp3', 'Bob Azzam - Happy Birthday Cha Cha Cha (audio)'], 
  ['/au/guitar.mp3', 'I Feel Good / guitar (audio)'], 
  ['/au/iggy.mp3', 'Iggy Pop - Do Not Go Gentle Into That Good Night (audio)'], 
  ['//youtube.com/watch?v=_8SBdkru4IY', 'Future Sound Of London - Essential Mix (youtube)'],
  `Claude VonStroke - Who's Afraid of Detroit`,
  `Fire (Dirty Doering Remix)`,
  `Incredible Bongo Band - Apache`,
  `Josh Wink vs. Public Enemy - Higher State Of Bring Da Noise.wmv`,
  `Latmun - Everybody's Dancin'`,
  `Milk & Sugar - Let The Sun Shine 2012 (Tocadisco Remix)`,
  `Premiere Ryan Murgatroyd - Is That You (Cioz Remix) [Swoon Recordings]`,
  `Riva Starr feat. Gavin Holligan - If I Could Only Be Sure (Danny Krivit Edit)`,
  `Shizumu (Extended Mix)`,
  `Whilk & Misky - Clap Your Hands ( Solomun Remix) [Island Records]`,
  `For Those I Love - I Have a Love (Overmono Remix)`,
  `For Those I Love - I Have a Love`,
  `ОКЕАН ЕЛЬЗИ - Я ТАК ХОЧУ (TAPOLSKY & SUNCHASE REMIX) Vj mix LeoMicron`,
  `Green Velvet - La la land`,
  `Undercatt - Futura (Original Mix)`,
  `The Light 3000`
  ].map(a => a.map ? a : [`/au/${a}.mp3`, a])

void (async _ => {
  await onDomReady
  await adelay(1000)// = await onBeeFxExtReady()
  
  const root = {
    mp3s,
    waCtx: await onWaapiReady,
    mediaElement: null
  }
  root.ui = createUI(config, root)
  
  if (config.platform === 'standalone') {
    root.mmenu$ = div$(root.ui.top$, {class: 'mediamenu'}, [
      ...mp3s.map(([src, text, videoId]) => 
        div$({class: 'mm-item', text, click: _ => loadAudio(src, text, videoId)})),
      leaf$('input', {attr: {type: 'file', accept: 'audio/*'}, on: {
        change: event => {
          const file = event.target.files[0]
          const fileUrl = window.URL.createObjectURL(file)
          loadAudio(fileUrl)
        }
      }})
    ])
    
    const loadVideo = (url, title) => {
      root.mmenu$.remove()
      set$(root.ui.top$, {class: 'video-source'})
      waitForMediaElement(root.ui.insertVideoPlayer(url, title))
    }
    const loadAudio = (url, title, videoId) => {
      root.mmenu$.remove()
      root.localAudio = {url, title, videoId}
      waitForMediaElement(root.ui.insertAudioPlayer(url, title, videoId))
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
