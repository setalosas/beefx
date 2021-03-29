/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, DOMplusUltra, createStore} from './improxy-esm.js'

const {s_a, undef, isFun, isNum, getRnd, hashOfString, ascii} = Corelib
const {wassert, weject} = Corelib.Debug
const {schedule, adelay, NoW, since, startEndThrottle} = Corelib.Tardis
const {div$, set$} = DOMplusUltra

const store = createStore('beeFX')

//: name->ret, parent$->menu
export const getActualPreset = async ({name, parent$}) => new Promise(resolve => {
  const sx = str => str.split(',').map(a => ({
    g: 'gain', 
    a: 'amp',
    ax: 'ampExt',
    b: 'blank', 
    bi: 'biquad',
    waveGen: 'waveGenerator',
    cheb: 'chebyshevIIR',
    scope: 'oscilloscope',
    spect: 'spectrum',
    osc: 'oscillator',
    pwmOsc: 'pwmOscillator',
    pitch: 'pitchShifter',
    conv: 'convolver',
    convGen: 'convolverGen',
    phaser: 'phaserLFO',
    comp: 'compressor',
    od: 'overdrive',
    odwac: 'overdriveWAC'
  }[a]) || a)
  
  const compile = obj => {
    const pg = {}
    for (const key in obj) {
      if (key.includes('X')) {
      } else {
        const fxs = sx(obj[key])
        key.split('').map(st => pg[st] = fxs)
      }
    }
    const ret = {}
    pg.propertiesToArr().sort().map(stage => ret[stage] = pg[stage])
    console.log(ret)
    return ret
  }
  const setups = { //: I know these compressed defs are ugly, but we can overview them on 1 page
    presetA: {
      A: 'g,comp,b',
      B: 'g,bi,b',
      C: 'g,ax,b',
      D: 'g,od,b'},
    preset4xb: {ABCD: 'b,b,b,b'},
    presetZero: {ABCD: 'b'},
    presetDebug: {
      A: 'osc,scope,od,scope',
      B: 'osc,scope,odwac,scope',
      C: 'delayWA',
      D: 'delayExt,scope'},
    youtubeFull: {
      A: 'scope,bi,od,scope',
      B: 'scope,ax,odwac,b,scope',
      C: 'scope,ax,comp,b,scope',
      D: 'scope,bi,b,b,scope'},
    youtubeMinimal: {ABCD: 'g,b,b'},
    presetBigBlank: {ABCD: 'g,bi,b,b,b,b'},
    presetFull: {
      A: 'g,biquad,vibrato,b,b',
      B: 'g,biquad,pitch,b,b',
      C: 'g,biquad,biquad,b,b',
      D: 'g,biquad,moog2,b,b'},
    test: {
      A: 'b,b,b,b,b,b',
      B: 'spect,convGen,scope,pitch,scope,g',
      C: 'spect,convGen,scope,pitch,scope,spect',
      D: 'spect,conv,reverb,spect,b'},
    pwm: {
      A: 'pwmOsc,scope,spect',
      B: 'osc,scope,spect',
      C: 'waveGen,scope,spect',
      D: 'waveTables,scope,pitch,spect'},
    scopeChain: {ABCDEFGHIJKL: 'delayWA,scope,b', E: 'delayWA,scope,spect'},
    cheb: {
      A: 'IIRcheb2,b,scope',
      B: 'IIRcheb4,b,scope',
      C: 'IIRcheb6,b,scope',
      D: 'IIRcheb8,scope'},
    graph: {
      A: 'IIRcheb4,od,scope',
      B: 'IIRmanual4,odwac,scope',
      C: 'eq6,eqb4,bi,scope',
      D: 'comp,delayExt,ax,scope'},
    golem: {
      A: 'IIRcheb4,bi,scope',
      B: 'IIRmanual4,ax,scope',
      C: 'scope,eqb4,vibrato,phaserLFO,bitCrusher,pinking,noiseConvolver,scope',
      D: 'eq10,delayExt,comp,scope',
      E: 'conv,eq6,tremoloLFO,od,scope',
      F: 'scope,autoWah,pingPongDelayA,pingPongDelayB,odwac,scope',
      G: 'chorusOsc,pitch,scope,bi,comp,reverb,scope',
      H: 'chorusLFO,od,ax,,jungle,pitch,scope',
      I: 'waveGen,bi,eq4,scope',
      J: 'IIRcheb8,cabinet,scope',
      K: 'waveGen,scope,convGen,scope,g',
      L: 'IIRmanual8,b,scope'},
    eq: { //+ check performance here
      AE: 'scope,eq4,scope',
      BF: 'scope,eq6,scope',
      CG: 'scope,eq10,scope',
      DH: 'scope,eqb4,scope'}
  }
  const setupHash = {}
  setups.propertiesToArr().map(name => setupHash[name] = compile(setups[name]))
  
  if (parent$) {
    const presets$ = div$(parent$, {class: 'preset-menu'}, 
      setupHash.propertiesToArr().map(presetName => {
        const setupObj = setupHash[presetName]
        const stages = setupObj.propertiesToArr()
        const html = stages.map(stage => stage + ': ' + setupObj[stage].join(' / ')).join('<br>')
        return div$({class: 'preset-item', text: presetName, click: _ => {
          store.save('actPreset', presetName)
          resolve(setupObj)
        }}, div$({class: 'preset-preview', html}))
    }))
    schedule('2s').then(_ => set$(presets$, {class: 'hidden'}))
  }
  if (name) {
    if (name === 'last') {
      const lastStored = store.load('actPreset')
      lastStored && resolve(setupHash[lastStored])
    } else {
      resolve(wassert(setupHash[name]))
    }
  }
})
