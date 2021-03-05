/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
 import * as Corelib from '../res/esm/stdlib/corelib-esm.js'
 import * as DOMplusUltra from '../res/esm/dom/dom-plus-ultra-esm.js'

const {div$, leaf$, set$} = DOMplusUltra
  
export const createUI = _ => {
  const ui = {}
  const {body} = document
    
  ui.frame$ = div$(body, {class: 'beebody'}, [
    ui.top$ = div$({class: 'bfx-top'}),
    ui.bottom$ = div$({class: 'bfx-bottom'}, [
      ui.left$ = div$({class: 'bfx-stage bfx-left'}),  
      ui.right$ = div$({class: 'bfx-stage bfx-right'})
    ])
  ])  
  
  ui.insertAudioPlayer = url => {
    void ui.player?.remove()
    
    set$(ui.top$, {}, 
      ui.player$ = leaf$('audio', {class: 'odijo', attr: {src: url, controls: ''}}))  
      
    return ui.player$
  }
  
  ui.insertVideoPlayer = src => { //+repalce is kell!!
    void ui.player?.remove()
    
    set$(ui.top$, {}, 
      ui.player$ = leaf$('video', {
        id: 'player',
        class: 'vidijo', 
        attr: {width: '640', height: '360', preload: 'auto', controls: '', playsinline: ''}
      }, leaf$('source', {attr: {src, type: 'video/youtube'}})))  
      
    return ui.player$
  }
  
  ui.insertFxSelector = (parent$, stage = 1) => {
    const fxNames = [
    'Delay',
    'Reverb',
    'Distortion',
    'Telephone',
    'Gain LFO',
    'Chorus',
    'Flange',
    'Ring mod',
    'Stereo Chorus',
    'Stereo Flange',
    'Pitch Shifter',
    'Mod Delay',
    'Ping-pong delay',
    'LFO Filter',
    'Envelope Follower (testing only)',
    'Autowah',
    'Noise Gate',
    'Wah Bass',
    'Distorted Wah Chorus',
    'Vibrato',
    'BitCrusher',
    'Apollo Quindar Tones'
    ]
    
    div$(parent$, {class: 'fxselector'}, leaf$('select', {id: 'effect' + stage}, 
      fxNames.map(name => leaf$('option', {text: name}))))
  }
  
  ui.insertFxSelectors = _ => {
    ui.insertFxSelector(ui.left$, 1)
    ui.insertFxSelector(ui.right$, 2)
  }
  
  return ui
}
