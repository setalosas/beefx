/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {nop} = Corelib
const {schedule, startEndThrottle} = Corelib.Tardis
void startEndThrottle
void schedule

onWaapiReady.then(waCtx => {
  const {registerFxType, connectArr} = BeeFX(waCtx)
  
  const biquadOptions = [
    ['lowpass', 'lowpass [no gain]'],
    ['highpass', 'highpass [no gain]'],
    ['bandpass', 'bandpass [no gain]'],
    ['lowshelf', 'lowshelf, [no Q]'],
    ['highshelf', 'highshelf [no Q]'],
    ['allpass', 'allpass [no gain]'],
    ['notch', 'notch [no gain]'],
    ['peaking', 'peaking']
  ]

  const wobbleFx = { //8#b4f ------- wobble -------
    def: {
      // beat / 2
      // beat
      // beat * 2
      // beat *4
      // reserve flag (gain negative)
      //box beat
      // akkor on, ha van bpm
      // no phase
      bpmDisp: {defVal: '50#set', type: 'box', width: 24},
      toBeatH: {defVal: 'off', type: 'cmd', name: 'Beat/2'},
      toBeat1: {defVal: 'off', type: 'cmd', name: 'Beat'},
      toBeat2: {defVal: 'off', type: 'cmd', name: 'Beat 2'},
      toBeat4: {defVal: 'off', type: 'cmd', name: 'Beat 4'},
      reverse: {defVal: 'off', type: 'cmd', subType: 'led', name: 'Reverse'},
      bpm: {skipUi: true}, //listener mint az oscilloscopenal
      filterType: {defVal: 'lowpass', type: 'strings', subType: biquadOptions},
      lfoFreq: {defVal: .5, min: .25, max: 100, subType: 'exp', unit: 'Hz', name: 'LFO freq'},
      excursion: {defVal: 600, min: 0, max: 2400, subType: 'int', unit: 'cent'},
      filterGain: {defVal: 0, min: -40, max: 40, unit: 'dB'},
      filterQ: {defVal: 15, min: 0.001, max: 50, subType: 'exp'},
      cutoffFreq: {defVal: 500, min: 50, max: 5000, subType: 'exp', unit: 'Hz'},
      filterGraph: {type: 'graph'}
    },
    midi: {pars: ['lfoFreq,excursion', 'cutoffFreq,filterQ']}
  }
  const graphCommon = {
    graphType: 'freq',
    triggerKeys: ['filterGraph'],
    minDb: -27,
    maxDb: 33,
    diynamic: .8
  }
  wobbleFx.graphs = {
    filterGraph: [{
      ...graphCommon,
      filter: 'filter',
      customRenderer: {
        pre: ({fx, cc, ccext, freq}) => {
          const lfoX = freq.freq2X[Math.round(fx.atm.lfoFreq)] || 0
          cc.lineWidth = 5
          cc.strokeStyle = `hsl(150, 99%, 55%)`
          ccext.drawLine(lfoX, 0, lfoX, ccext.height)
        }
      },
      phaseCurveColor: `hsla(330, 99%, 75%, .5)`,
      magCurveColor: `hsl(330, 99%, 75%)`
    }, {
      ...graphCommon,
      filter: 'minModFilter',
      renderSet: {doClear: false, doGrid: false, doGraph: true},
      phaseCurveColor: `hsla(240, 99%, 75%, .5)`,
      magCurveColor: `hsl(240, 99%, 75%)`
    }, {
      ...graphCommon,
      filter: 'maxModFilter',
      renderSet: {doClear: false, doGrid: false, doGraph: true},
      phaseCurveColor: `hsla(40, 99%, 75%, .5)`,
      magCurveColor: `hsl(74, 99%, 75%)`
    }]
  }

  wobbleFx.setValue = (fx, key, value) => ({
    bpmDisp: nop,
    toBeatH: nop,
    toBeat1: nop,
    toBeat2: nop,
    toBeat4: nop,
    bpm: nop,
    reverse: nop,
    filterType: _ => {
      fx.int.filter.type = value
      fx.int.minModFilter.type = value
      fx.int.maxModFilter.type = value
      fx.valueChanged('filterGraph')
    },
    lfoFreq: _ => {
      fx.setAt('lfo', 'frequency', value)
      fx.valueChanged('filterGraph')
    },
    excursion: _ => {
      fx.setAt('lfoGain', 'gain', value)
      fx.setAt('minModFilter', 'detune', -value)
      fx.setAt('maxModFilter', 'detune', value)
      fx.valueChanged('filterGraph')
    },
    filterGain: _ => {
      fx.setAt('filter', 'gain', value)
      fx.setAt('minModFilter', 'gain', value)
      fx.setAt('maxModFilter', 'gain', value)
      fx.valueChanged('filterGraph')
    },
    filterQ: _ => {
      fx.setAt('filter', 'Q', value)
      fx.setAt('minModFilter', 'Q', value)
      fx.setAt('maxModFilter', 'Q', value)
      fx.valueChanged('filterGraph')
    },
    cutoffFreq: _ => {
      fx.setAt('filter', 'frequency', value)
      fx.setAt('minModFilter', 'frequency', value)
      fx.setAt('maxModFilter', 'frequency', value)
      fx.valueChanged('filterGraph')
    }
  }[key])
  
  wobbleFx.construct = (fx, {initial}, {int} = fx) => {
    int.lfo = waCtx.createOscillator()
    int.lfo.type = 'sine'
    int.lfo.start()
    int.lfoGain = waCtx.createGain()
    int.filter = waCtx.createBiquadFilter()
    int.filter.type = 'lowpass'
    int.minModFilter = waCtx.createBiquadFilter()
    int.minModFilter.type = 'lowpass'
    int.maxModFilter = waCtx.createBiquadFilter()
    int.maxModFilter.type = 'lowpass'
    int.dummyGain = waCtx.createGain()
    int.dummyGain.gain.value = 0
    int.lfo.connect(int.lfoGain)
    int.lfoGain.connect(int.filter.detune)
    connectArr(fx.start, int.filter, fx.output)
    connectArr(fx.start, int.minModFilter, int.maxModFilter, int.dummyGain, fx.output)
  }
  
  registerFxType('fx_wobble', wobbleFx)
})
