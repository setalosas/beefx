/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, DOMplusUltra, WaapiWrap, BeeFX, createUI} from './improxy-esm.js'

const {$} = DOMplusUltra
//playground -> playground-esm.js

const initPlayground = (waCtx, media$) => {
  const dis = {
    graphMode: 'sequential' //sequential
  }
  const {newFx} = BeeFX(waCtx)
  
  dis.decompose = _ => {
    dis.source.disconnect()
    dis.beeFx1.disconnect()
    dis.beeFx2.disconnect()
    //dis.dest.disconnect()
  }
  
  dis.compose = _ => {
    if (dis.graphMode === 'parallel') {
      dis.source.connect(dis.beeFx1)
      dis.source.connect(dis.beeFx2)
      dis.beeFx1.connect(dis.dest)
      dis.beeFx2.connect(dis.dest)
    } else {
      dis.source.connect(dis.beeFx1)
      dis.beeFx1.connect(dis.beeFx2)
      dis.beeFx2.connect(dis.dest)
    }
  }
    
  dis.changeStage = (stage, name) => {
    dis.decompose()
    if (stage === 1) {
      dis.beeFx1 = newFx(name)
    } else if (stage === 2) {
      dis.beeFx2 = newFx(name)
    }
    dis.compose()
  }
  
  dis.changeSource = media$ => {
    dis.decompose()
    dis.source = waCtx.createMediaElementSource(media$)
    dis.compose()
  }
  
  const init = _ => {
    dis.source = waCtx.createMediaElementSource(media$)
    dis.source.disconnect()
    
    dis.beeFx1 = newFx('fx_gain')
    dis.beeFx2 = newFx('fx_gain')
    dis.dest = waCtx.createGain()
    dis.dest.gain.value = -10
    
    dis.source.connect(dis.beeFx1)
    dis.beeFx1.connect(dis.beeFx2)
    dis.beeFx2.connect(dis.dest)
    dis.dest.connect(waCtx.destination)
    
     // Create variables to store mouse pointer Y coordinate
     // and HEIGHT of screen
     let CurY
     const HEIGHT = window.innerHeight

     // Get new mouse pointer coordinates when mouse is moved
     // then set new gain value

     document.onmousemove = updatePage

     function updatePage (e) {
       CurY = (window.Event) ? e.pageY : e.clientY + (document.documentElement.scrollTop ? document.documentElement.scrollTop : document.body.scrollTop)

       dis.dest.gain.value = CurY / HEIGHT
     }
  }
  
  dis.setGraphMode = val => {
    dis.decompose()
    dis.graphMode = val
    dis.compose()
  }
  
  init()
  
  return dis
}

$(_ => {
  const ui = createUI()
  //const audio$ = ui.insertAudioPlayer('https://ork.tork.work/beefx/au/chachacha.mp3')
  const mediaElement = ui.insertVideoPlayer('https://www.youtube.com/watch?v=_8SBdkru4IY')
  // devendra telstar shinehead
  
  //const mediaElement = document.getElementById('player')

  const mediaE = new window.MediaElementPlayer(mediaElement, {
   stretching: 'auto',
    features: ['playpause', 'current', 'progress', 'duration', 'tracks', 'volume', 'fullscreen'],
    success: (mediaElement, domObject) => {
      mediaElement.load()
      console.log({mediaElement, domObject})
      //debugger
      //mediaElement.play()
      setTimeout(_ => { //+promise
        WaapiWrap.onRun(waCtx => {
          const playground = initPlayground(waCtx, domObject)
          playground.setGraphMode('parallel')
          ui.insertFxSelectors()
        })}, 1000)
   }})
})
