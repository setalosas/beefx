/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, space-unary-ops,
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, no-unused-vars, object-curly-newline */

import {Corelib, DOMplusUltra} from '../improxy-esm.js'

const {Ø, undef, getRnd, isArr, nop, s_a} = Corelib
const {wassert, weject, brexru} = Corelib.Debug
const {post, schedule, adelay, pNow} = Corelib.Tardis
const {_$, $, fix$, haltEvent, set$, div$} = DOMplusUltra
const {max} = Math
const {requestAnimationFrame} = window

const visualizerState = {
  hasStarted: false,
  isActive: true,       //:debuglike big OFF switch
  isSpectrumOn: true,   //:can be turned off
  isLevelMeterOn: false, //:always on
  lowFreq: false,
  rejSp: undef,
  visHash: {},
  pending: []
}

const initVisualizerState = _ => {
  if (!visualizerState.hasStarted) {
    visualizerState.hasStarted = true
    visualizerTick()  
  }
}

const addVisualizer = vis => {
  weject(typeof vis.ix === Ø)
  visualizerState.visHash[vis.ix] = vis
}

const visualizerTick = async _ => {
  if (visualizerState.isActive) {
    for (const visix in visualizerState.visHash) {
      const vis = visualizerState.visHash[visix]
      wassert(vis)
      vis.drawSpectrum()
    }
  }
  requestAnimationFrame(visualizerTick)
}

export const createSpectrumVisualizer = (analyserNode, canvas$, levelMeter$, ix) => {
  wassert(canvas$)
  
  initVisualizerState()

  const WIDTH = 128
  const HEIGHT = 128 // was 256x 256
  const SMOOTHING = 0
  const FFT_SIZE = 64 // 64 //28 // 2048
  
  const vis = {
    analyser: analyserNode,
    prevFreqs: [],
    freqs: undef,
    visualizerState,
    ix
  }

  const autoExec = _ => {
    vis.analyser = analyserNode
    vis.analyser.minDecibels = -140
    vis.analyser.maxDecibels = 0
    vis.analyser.smoothingTimeConstant = SMOOTHING
    vis.analyser.fftSize = FFT_SIZE
    vis.len = vis.analyser.frequencyBinCount
    vis.freqs = new Uint8Array(vis.len)

    addVisualizer(vis)
  }

  vis.drawSpectrum = async _ => {
    vis.analyser.getByteFrequencyData(vis.freqs)

    const drawContext = canvas$.getContext('2d')
    canvas$.width = WIDTH
    canvas$.height = HEIGHT
    const barWidth = WIDTH / vis.len
    
    let peak = 0
    let avg = 0
    
    for (let i = 0; i < vis.len; i++) {//:Draw the frequency domain chart.
      const newValue = vis.freqs[i]
      const oldValue = vis.prevFreqs[i] || 0
      const value = max(newValue, (newValue + oldValue * 2) / 3)
      vis.prevFreqs[i] = value
      peak = max(peak, value)
      avg += value
      if (visualizerState.isSpectrumOn) {
        const percent = value / 256
        const height = HEIGHT * percent
        const offset = HEIGHT - height - 1
        const procPerc = i / vis.len * 100
        const sat = procPerc * .6 + 40
        const lit = procPerc * .6 + 40
        drawContext.fillStyle = `hsl(0, ${sat}%, ${lit}%)`      
        drawContext.fillRect(i * barWidth, offset, barWidth - 1, height)
      }
    }
    if (visualizerState.isLevelMeterOn) {
      avg /= vis.len
      avg /= 2.56
      peak /= 2.56
      set$(levelMeter$, {css: {
        '--peak': peak + '%',
        '--avg': avg + '%'
      }})
    }
  }
  
  autoExec()
  
  return vis
}
