/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, DOMplusUltra} from '../improxy-esm.js'

const {Ø, undef, isNum, isFun, nop, clamp, s_a, getIncArray} = Corelib
const {wassert, weject, brexru} = Corelib.Debug
const {post, startEndThrottle} = Corelib.Tardis
const {secToString} = Corelib.DateHumanizer
const {div$, leaf$, set$, setClass$, q$$, haltEvent} = DOMplusUltra
const {round} = Math

//8#c00 -------------------------- Youtube Interface --------------------------

window.onYouTubeIframeAPIReady = _ => ytApi.resolve()

const ytApi = {players: []}
  
ytApi.isReady = new Promise(resolve => ytApi.resolve = resolve)

void (_ => { //: init the Youtube iframe api asap
  const script = document.createElement('script')
  script.src = 'https://www.youtube.com/iframe_api'
  document.head.insertAdjacentElement('afterbegin', script)
  
  void (async _ => { //: youtube iframe api ready state test
    await ytApi.isReady
    console.log('🔴Youtube API is ready.')
  })()
})()

//8#49f -------------------------- Sources ui --------------------------

export const extendUi = ui => { //: input: ui.sourceStrip$ (empty)
  const {root, pg} = ui
  const {stageMan, players, sources} = pg
  const {getStage, iterateStages, iterateStandardStages} = stageMan
  
  const {maxSources = 8} = root.config
  const sourceIxArr = getIncArray(1, maxSources)
  
  const uiSources = [{}, ...sourceIxArr.map(ix => ({
    ix,
    frame$: undef,
    media$: undef,
    ctrl$: undef,
    info$: undef,
    ui$: undef,
    mock$: undef,
    ytPlayer: undef,
    isMocked: false
  }))]
  
  const sourcesUi = {
    uiSources
  }
  
  const init = _ => {
    set$(ui.sourceStrip$, {class: 'bfx-horbar source-strip'}, sourceIxArr.map(ix => 
      uiSources[ix].frame$ = div$({class: 'source-frame source-' + ix, attr: {ix}}, [ 
        uiSources[ix].media$ = div$({class: 'src-media'}),
        uiSources[ix].ctrl$ = div$({class: 'src-ctrl'})
    ])))
  }
  
  init()
  
  ui.finalizeSources = _ => {
    ui.createInputDispatchers(sourceIxArr)
  }
  
  //+ kulon nogit file,  a normalban csak upload
  
  //8#595 Mp3 menu  for testing (not on production site of course)
  
  root.videoIds = [
  ].join(',').split(',')
  
  root.mp3s = [
    [`Cascandy - Take Me Baby Reeemix SNOE`,'9PCz1KPAJ0c'],
    [`Astrud Gilberto - Agua de Beber`, 'qZx-Z3_n4t8'], 
    [`Nightmares on Wax - Jorge`, 'uFpwKExK9Uw'], 
    [`The Herbaliser - The Sensual Woman`, 'UPVbcXiK4y8'], 
    [`DJ Sensei - The Sinphony`, '94fQIqRCi4o'], 
    [`Montefiori Cocktail - Sunny`, 'pNmX9MgM2vc'], 
    [`Devendra Banhart - Never Seen Such Good Things - Unplugged`, '-Au0r91kCpg'], 
    [`The Shadows - Apache (1960)`, 'EzgbcyfJgfQ'], 
    [`Bob Azzam - Happy Birthday Cha Cha Cha`, 'DO0rbS0z09g'], 
    [`James Brown - I Feel Good (guitar)`], 
    [`Somerset - Мой Манекен (My Mannequin)`, 'kbkEA1sWBRI'],
    [`Iggy Pop - Do Not Go Gentle Into That Good Night`, '5g28sOx4Gr4'], 
    [`Demuja - Loose Legs`, 'MfN57sFEcyc'],
    [`This Charming Man (Stars Cover)`, 'A9WEeKYID4I'],
    [`Portishead - SOS`, 'WVe-9VWIcCo'],
    [`Jon Hopkins - Singularity (Official Video)`, 'lkvnpHFajt0'],
    [`The Chemical Brothers - Escape Velocity (Official Music Video)`, 'sXMhGADyMxE'],
    [`Demuja - Loose Legs`, 'MfN57sFEcyc'],
    [`Kollektiv Turmstrasse - Tristesse HD`, 'tyVnJjE9sDo'],
    [`Ame - Rej (Original) [Full Length] 2006`, 'VkWg1xOQwTI'],
    [`La Bien Querida - Muero De Amor (33)`, 'u5jP4uCHcWs'],
    [`PAUZA - Bésame Mucho`, 'j_nuN_fN7s8'],
    [`Fatboy Slim, Riva Starr & Beardyman - Eat Sleep Rave Repeat (Calvin Harris Remix)`, 'NIcW36J-h7Q'],
    [`Peter Schilling - Major Tom (Coming Home)`, 'OMDbX1zksgI'],
    [`Aly Us - Follow Me (Acapella)`, 'HU--xJbkemM'],
    [`Victor Ruiz - Interstellar (Original Mix)`, 'TA7CKxMCR00'],
    [`Jon Hopkins - Wintergreen`, '4_HiNxEvKTY'],
    [`Jamie xx - Gosh`, 'hTGJfRPLe08'],
    [`Wink - Higher State Of Consciousness (Official Video)`, 'M1ajSxBiMCY'],
    [`Claude VonStroke - Who's Afraid of Detroit`, 'hS1pHfUP5WQ'],
    [`Dapayk & Vars - Fire (Dirty Doering Remix)`, 'nCv9X0h1-wQ'],
    [`Incredible Bongo Band - Apache`, 'WY-Z6wm6TMQ'],
    [`Josh Wink vs. Public Enemy - Higher State Of Bring Da Noise`, '0fkLgZCMrK8'],
    [`Latmun - Everybody's Dancin'`, 'TG7QwJoXeDY'],
    [`Milk & Sugar - Let The Sun Shine 2012 (Tocadisco Remix)`, '7adlXT_AFCQ'],
    [`Ryan Murgatroyd - Is That You (Cioz Remix)`, '92tqYOYycoE'],
    [`Riva Starr feat. Gavin Holligan - If I Could Only Be Sure (Danny Krivit Edit)`, '7isWbvWX7Dc'],
    [`Lycoriscoris - Shizumu (Extended Mix)`, 'o-5DftpafnE'],
    [`Whilk & Misky - Clap Your Hands (Solomun Remix)`, '4hjOQ6_R8Fs'],
    [`For Those I Love - I Have a Love (Overmono Remix)`, 'nJkDcmOqYWY'],
    [`For Those I Love - I Have a Love`, 'iTz3QZNORg4'],
    [`ОКЕАН ЕЛЬЗИ - Я ТАК ХОЧУ (TAPOLSKY & SUNCHASE REMIX)`, '7n9kIm1bBFk'],
    [`Green Velvet - La la land`, 'NMD_cv4fM4s'],
    [`Undercatt - Futura (Original Mix)`, 'LGvIdBzVmnY'],
    [`Schneider TM - The Light 3000`, 'fGNH3vNl3h4'],
    [`Jefferson Airplane - White Rabbit Ft. Wu-Tang Clan (PINEO & LOEB Remix)`, '9Vzit3fiKYY'],
    [`STEREO TOTAL - HEROES (David Bowie Cover)`, 'R6FXRysYG1g'],
    [`David Bowie - Heroes (PINEO & LOEB Remix)`, 'A0PlqQ6NWrM'],
    [`Jürgen Paape - So Weit Wie Noch Nie`, '8BaY3_112yQ'],
    [`Baxendale - I Buit This City (Michael Mayer Mix)`, 'fdfDt7mPixA'],
    [`Claude Vonstroke - Who's Afraid Of Detroit (MockBeat Remix)`, 'dGClgGcF0KU'],
    [`JEAN-JACQUES PERREY & AIR 'COSMIC BIRD'`, 'Nj_APKH9qg0'],
    [`Mama Oliver - Eastwest (stoned together)`, 'R2lr8_URqeI'],
    [`Josh Rouse - Straight To Hell (The Clash cover)`, '79PffDsRp88']
  ].map(a => ({
    title: a[0],
    src: `/au/${a[0]}.mp3`,
    videoId: a[1] || ''
  }))
    
  //8#c95 Youtube mock stuff - if we are not on Youtube, so we have to replace videos with audio
  
  //: If we are on Youtube as an extension, root.onYoutube is true.
  //: .source-strip
  //:   .source-frame
  //:     .src-media
  //:       iframe (<- div) youtube destroys this target div replacing it with its iframe
  //:     .src-ctrl
  //:     .src-info
  //:     .src-mock-holder
  //:   .source-frame::after  
  //: If we are not on youtube, have to mock the videos as we can't access their sound :-(
  
  const searchMockAudioForVideoId = videoId => {
    for (const mp3 of root.mp3s) {
      if (mp3.videoId === videoId) {
        return mp3
      }
    }
    return root.mp3s[0] //: the first one is the fallback
  }
  
  const mockVideoInStripWithAudio = (media$, videoId) => {
    const mockMp3 = searchMockAudioForVideoId(videoId)
    console.log(`Mock mp3 will be used instead of ${videoId}:`, mockMp3)
    return ui.insertAudioPlayerInto(media$, mockMp3.src, mockMp3.title)
  }
  
  const prepareSourceChange = sourceIx => {
    const uiSource = uiSources[sourceIx]
    uiSource.ytPlayer = undef
    uiSource.isMaster = false
    uiSource.isMocked = false
    uiSource.isAudio = false
    uiSource.isVideo = false
    uiSource.isBuffer = false
    uiSource.iframe$ = undef
    uiSource.video$ = undef
    uiSource.audio$ = undef
    set$(uiSource.frame$, {deattr: {type: ''}})
    set$(uiSource.media$, {html: ''},
      uiSource.info$ = div$({class: 'src-info'}))
      
    return uiSource
  }
    
  const finalizeSourceChange = sourceIx => {
    const uiSource = uiSources[sourceIx]
    set$(uiSource.ctrl$, {html: ``}, [
      div$({class: 'ctrl-cmd cc-play', text: 'Play', click: _ => ui.playSource(sourceIx)}),
      div$({class: 'ctrl-cmd cc-stop', text: 'Stop', click: _ => ui.stopSource(sourceIx)}),
      div$({class: 'ctrl-cmd cc-flood', text: 'Flood', click: _ => sources.floodStages(sourceIx)})
    ])
  }
  
  ui.stopSource = sourceIx => {
    const uiSource = uiSources[sourceIx]
    if (uiSource.isMocked) {
      uiSource.audio$.pause()
      uiSource.ytPlayer.pauseVideo()
    } else {
      void uiSource.audio$?.pause()
      void uiSource.video$?.pause()
    }
  }
  ui.playSource = sourceIx => {
    const uiSource = uiSources[sourceIx]
    if (uiSource.isMocked) {
      uiSource.audio$.play()
      uiSource.ytPlayer.mute()
      uiSource.ytPlayer.playVideo()
    } else {
      void uiSource.audio$?.play()
      void uiSource.video$?.play()
    }
  }
  ui.autoPlaySource = sourceIx => ui.flags.isAutoplayOn && ui.playSource(sourceIx)
  ui.autoStopSource = sourceIx => ui.flags.isAutostopOn && ui.stopSource(sourceIx)
  
  //+ ezt a source hivja, biztos szar es nemidevalo es nemodavalo hanem a playerbe
  
  /* ui.mediaPlay = (sourceIx, mediaElement) => { //: plays native audio/video and embed iframes too
    //+NOT USED
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
  } */
    
  const insertYoutubeIframe = (node$, ix, videoId)  => new Promise(resolve => {
    const YT = wassert(window.YT)
    uiSources[ix].ytPlayer = new YT.Player(node$, {
      width: '320', height: '180', videoId, events: {onReady: resolve}
    })
  })
  
  //8#7a7 All possible cases from here (audio, mock, video, buffer, master)
  
  const changeSourcesWithSTEM = _ => {
  }
  
  ui.changeAudioSource = (sourceIx, {src, title, videoId}) => {//8#2b2 [audio]
    const uiSource = prepareSourceChange(sourceIx)
    const audio = ui.insertAudioPlayerInto(uiSource.media$, src, title)
    uiSource.audio$ = audio
    uiSource.isAudio = true
    set$(uiSource.frame$, {attr: {type: 'audio'}})
    set$(uiSource.info$, {text: title})
    sources.changeSource(sourceIx, {audio})
    finalizeSourceChange(sourceIx)
  }
  ui.changeVideoElementSource = (sourceIx, video$) => {//8#2b2 [master]
    const uiSource = prepareSourceChange(sourceIx)
    uiSource.video$ = video$
    uiSource.isMaster = true
    set$(uiSource.frame$, {attr: {type: 'master'}})
    set$(uiSource.info$, {text: 'Master video'})
    sources.changeSource(sourceIx, {video: video$})
    finalizeSourceChange(sourceIx)
  }
  ui.changeVideoSource = (sourceIx, {videoId, title, src}) => {//8#2b2 [mock / video]
    const uiSource = prepareSourceChange(sourceIx)
    const mediaHolder$ = uiSource.media$
    set$(mediaHolder$, {html: ''}, div$({}))
      
    insertYoutubeIframe(mediaHolder$.children[0], sourceIx, videoId)
      .then(_ => {
        console.log(`ChangeVideoSource: Youtube iframe created and loaded.`, mediaHolder$)
        const iframe$ = mediaHolder$.children[0]
        if (iframe$?.tagName === 'IFRAME') {
          uiSource.iframe$ = iframe$
          try {
            const idoc = iframe$.contentWindow.document
            const video = idoc.querySelector('video')
            if (video) {
              uiSource.isVideo = true
              set$(uiSource.frame$, {attr: {type: 'video'}})
              sources.changeSource(sourceIx, {video})
              finalizeSourceChange(sourceIx)
            } else {
              console.warn(`ChangeVideoSource: cannot find video in iframe.`)
            }
          } catch (err) {
            console.log(`ChangeVideoSource: error accessing video tag:`, err)
            if (!root.onYoutube) {
              console.log(`ChangeVideoSource: mocking failed video with audio`)
              const audio = mockVideoInStripWithAudio(uiSource.media$, videoId)
              uiSource.isMocked = true
              set$(uiSource.frame$, {attr: {type: 'mock'}})
              uiSource.audio$ = audio
              sources.changeSource(sourceIx, {audio})
              finalizeSourceChange(sourceIx)
            }
          }
        } else {
          console.warn(`ChangeVideoSource: cannot access iframe.contentWindow.document`)
        }
      })
      .catch(err => brexru(console.error(err)))
  }
  
  const changeSourceFromGrab = async event => {
    const thumb = event.target.parentElement
    const videoId = thumb.getAttribute('videoId')
    const src = thumb.getAttribute('src')
    const title = thumb.getAttribute('title')
    const sourceIx = parseInt(event.target.className.split('grab-to-')[1])
    haltEvent(event)
    
    if (videoId?.length === 11 && sourceIx) {
      ui.changeVideoSource(sourceIx, {videoId, title, src})
    } else if (src && sourceIx) {
      ui.changeAudioSource(sourceIx, {src, title})
    } else {
      console.warn(`ChangeVideoFromGrab error:`, {videoId, sourceIx})
    }
  }
  
  const buildVideoList = on => { //: the videolist works both on Youtube and on the demo site
    void ui.u2list$?.remove()
    
    //+ localstorage!!!!!!
    
    if (on) {
      ui.u2list$ = div$(ui.frame$, {class: 'emu-frame'})
      for (const videoId of root.videoIds) {
        if (videoId?.length === 11) {
          const backgroundImage = `url('//img.youtube.com/vi/${videoId}/mqdefault.jpg')`
          div$(ui.u2list$, {
            class: 'emulated', 
            attr: {id: 'thumbnail', videoId}, 
            css: {backgroundImage}
          })
        }
      }
      set$(ui.u2list$, {}, root.mp3s.map(({src, title, videoId}) => {
        const [art, tit] = title.split(' - ') 
        const html = `<em>${art}</em> - ${tit}`
        const backgroundImage = videoId?.length === 11 ? `url('//img.youtube.com/vi/${videoId}/mqdefault.jpg')` : undef
        return div$({
          class: 'emulated au', 
          attr: {id: 'thumbnail', videoId, src, title},
          css: {backgroundImage}
        }, div$({class: 'audiv', html}))
      }))
    }
  }
  
  ui.onVideoListToggled = on => {
    buildVideoList(on)
    on && ui.toggleGrab(on) //: this will call ui.ongrabToggled() (after changing the cmd state)
  }
  
  ui.onGrabToggled = on => {
    if (on) {
      root.onYoutube || ui.toggleList(true)
      const thumbs = []
      if (root.onYoutube) {
        for (const thumb of q$$('a#thumbnail')) {
          const href = thumb.getAttribute('href')
          if (!href?.length) {
            console.log(`onGrabToggled: no href in youtube thumb`, thumb)
            continue
          }
          const videoId = href.split('?v=')[1].split('&')[0]
          thumbs.push({thumb, videoId})
        }
      }
      for (const thumb of q$$('div#thumbnail.emulated')) {
        const videoId = thumb.getAttribute('videoId')
        const src = thumb.getAttribute('src')
        const title = thumb.getAttribute('title')
        if (!videoId?.length && !src?.length) {
          console.log(`onGrabToggled: no src in emu thumb`, thumb)
          continue
        }
        thumbs.push({thumb, src, videoId, title})
      }
      console.table(thumbs)
      for (const {thumb, videoId, src = '', title = ''} of thumbs) {
        if (videoId?.length === 11 || src) {
          div$(thumb, {class: 'bfx-grab-frame', attr: {videoId, title, src}},
            '1234'.split('').map(text =>
              div$({class: 'grabber grab-to-' + text, click: changeSourceFromGrab}, div$({text}))))
        }
      }
    } else {
      for (const grab of q$$('a#thumbnail > .bfx-grab-frame')) {
        grab.remove()
      }
    }
  }
  
  ui.setSourceInUseInfo = (ix, info) => set$(uiSources[ix].frame$, {attr: {info}})
  
  const destStr = source => source.destStageIxArr.map(a => getStage(a).letter).join(', ') || 'Mute'
  
  ui.refreshSourcesUi = _ => {
    const {sourceArr, slog, tlog} = sources
    
    sourceArr.map(({destStageIxArr}, sourceIx) => sourceIx && sourceArr[sourceIx].isMediaElement &&
      ui.setSourceInUseInfo(sourceIx, destStr({destStageIxArr})))
      
    iterateStages(({stageIx, sourceIx}) => { 
      slog(`setting input selectors: stage#${stageIx}] = ${sourceIx}`)
      ui.setStageInputState(stageIx, sourceIx)
    })
    
    tlog(sourceArr.map(src => ({...src, stages: src.destStageIxArr.join(', ')})))
    
    //+sidebar will be eliminated
    void sources.listUi?.refresh(sourceArr.map((src, ix) => `<em>sourceIx[${ix}]</em> stages: ${destStr(src)} player: [][][]`))
      //debugger
    console.table(sourceArr)  
    for (const source of sourceArr) {
      //console.log(source)
    }  
  }
}
