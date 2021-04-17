/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, DOMplusUltra, Store} from './improxy-esm.js'

const {s_a, undef, isFun, isNum, getRnd, hashOfString, ascii} = Corelib
const {wassert, weject} = Corelib.Debug
const {schedule, adelay, NoW, since, startEndThrottle} = Corelib.Tardis
const {div$, set$} = DOMplusUltra

const store = Store.createStore('beeFX')

const fxMap = {
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
  sampler: 'sampler',
  od: 'overdrive',
  odwac: 'overdriveWAC'
}

const stagePresets = { //: These compressed defs are ugly, but it's easier to overview
  preset1xb: {A: 'b'},
  preset2xb: {AB: 'b'},
  preset3xb: {ABC: 'b'},
  preset4xb: {ABCD: 'b'},
  preset2sampler: {AB: 'b,sampler,scope'},
  preset3rec: {A: 'osc,sampler,scope', B: 'osc,recorder,scope', C: 'osc,sampler,scope'},
  preset2xpitch: {AB: 'b,pitchShifterNote,scope'},
  prTakeFive: {
    A: 'g,comp,b',
    B: 'g,bi,b',
    E: 'g,ax,b',
    F: 'g,od,b',
    I: 'g,b,b'},
  presetA: {
    A: 'g,comp,b',
    B: 'g,bi,b',
    C: 'g,ax,b',
    D: 'g,od,b'},
  preset4x4b: {ABCD: 'b,b,b,b'},
  presetZero: {ABCD: 'b'},
  presetDebug: {
    A: 'osc,scope,od,scope',
    B: 'osc,scope,odwac,scope',
    C: 'delayWA,sampler,scope',
    D: 'delayExt,scope'},
  youtubeFull: {
    A: 'scope,bi,od,scope',
    B: 'scope,ax,odwac,b,scope',
    C: 'scope,ax,comp,b,scope',
    D: 'scope,bi,b,b,scope'},
  youtubeDefault: {
    A: 'pitchShifterNote,odwac,scope',
    B: 'conv,bi,scope',
    C: 'dattoroReverb,comp,scope',
    D: 'sampler,ax,scope'},
  youtubeMinimal: {ABCD: 'g,b,b'},
  presetBigBlank: {ABCD: 'g,bi,b,b,b,b'},
  presetFull: {
    A: 'g,bi,vibrato,b,b',
    B: 'g,bi,pitch,b,b',
    C: 'g,bi,bi,b,b',
    D: 'g,bi,moog,b,b'},
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

export const create = root => {
  const {ui, pg} = root
  const {stageMan} = pg
    
  const stateManager = {
    stagePresets,
    slots: [{}]
  }
  const maxSlots = 40

//: name->ret, parent$->menu
  stateManager.getActualPreset = async ({name, parent$}) => new Promise(resolve => {
    const sx = str => str.split(',').map(a => (fxMap[a]) || a)
    
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
      return ret
    }
    const setupHash = {}
    stagePresets.propertiesToArr().map(name => setupHash[name] = compile(stagePresets[name]))
    
    if (parent$) {
      const presets$ = div$(parent$, {class: 'preset-menu'}, 
        setupHash.propertiesToArr().map(presetName => {
          const setupObj = setupHash[presetName]
          const stages = setupObj.propertiesToArr()
          const html = stages.map(stage => stage + ': ' + setupObj[stage].join(' / ')).join('<br>')
          return div$({class: 'preset-item', text: presetName, click: event => {
            store.save('actPreset', presetName)
            set$(presets$, {css: {__reload: '" (reload needed!)"'}})
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
  
  const fixSlots = slots => {
    while (slots.length < 5 || (slots.length < maxSlots && slots.slice(-1)[0].fxarr.length)) {
      slots.push({fxarr: []})
    }
    return slots
  }
  
  const loadSlots = _ => stateManager.slots = fixSlots(store.load('slots') || [])
  
  stateManager.onStageToSlotDrop = ({dstSlot, letter}) => {
    const state = stageMan.getStage(letter).saveState()
    console.log({state})
    stateManager.slots[dstSlot] = {fxarr: state}
    fixSlots(stateManager.slots)
    store.save('slots', stateManager.slots)
  }
  stateManager.onSlotToSlotDrop = ({dstSlot, srcSlot}) => {
    const slotState = stateManager.slots[srcSlot]
    stateManager.slots[dstSlot] = slotState
    fixSlots(stateManager.slots)
    store.save('slots', stateManager.slots)
  }

  stateManager.onSlotToStageDrop = ({dstLetter, slot}) => {
    stageMan.getStage(dstLetter).loadState(stateManager.slots[slot].fxarr)
  }
  stateManager.onStageToStageDrop = ({dstLetter, srcLetter}) => {
    const state = stageMan.getStage(srcLetter).saveState()
    stageMan.getStage(dstLetter).loadState(state)
  }
  
  loadSlots()
  
  return stateManager
}
