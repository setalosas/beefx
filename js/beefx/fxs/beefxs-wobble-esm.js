/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {nop} = Corelib
const {wassert} = Corelib.Debug
const {schedule, startEndThrottle} = Corelib.Tardis
void startEndThrottle
void schedule
void wassert
void nop
const {round, abs} = Math

onWaapiReady.then(waCtx => {
  const {registerFxType, connectArr, createRadioCmds} = BeeFX(waCtx)
  
  //: WobbleFx is a multifunctional interactive wobble effect.
  //: It can manipulate the detune of a biquad filter of any type in the range of 3 octaves.
  //: (Not every biquad filter type is meaningful here though.)
  //: The LFO freq can go up to 100Hz (vrooming), but the really useful interval is 0-5 Hz.
  //: The user can select a waveform.
  //: (Later this needs to be connectable to an external source - like wavetable generator output.)
  //: Also the LFO freq can be set from the source BPM for the effect being in sync with the tempo.
  //: Sadly this is imperfect as WA won't support the phase control of an LFO (yet). 
  //: So there is a reverse flag for a very rudimental setting.
  //: Still, we won't get reproducable effect with this.
  //: Possible solutions for the phase problem:
  //: - https://github.com/Flarp/better-oscillator/blob/master/worklet.js
  //:   (an oscillator with phase, but it uses CPU)
  //: - a controllable delay after the lfoGain (with a slider between 0 and beatTime (0-360deg))
  //: We implemented this second one. 
  //: The effect is still varies (no perfect sync), but can be tweaked (you can hear it).
  //: (Sidenote: BPM should have a phase too. And we have the peaks, so it's not 100% impossible.)
  //: (The lesson learned here: we need an internal signal patch system apart from the stages.
  //: E.g. the output of the generator effects should be labelled (or fix signal channels).
  //: These signals must be accessible from any other Fx.)

  const beatCmdsDef = {
    beat1: {defVal: 'off', type: 'cmd', name: 'Beat', refVal: 1},
    beat2: {defVal: 'off', type: 'cmd', name: 'Bt 2', refVal: 2},
    beat4: {defVal: 'off', type: 'cmd', name: 'Bt 4', refVal: 4},
    beatH: {defVal: 'off', type: 'cmd', name: 'Bt /2', refVal: 1 / 2},
    beatQ: {defVal: 'off', type: 'cmd', name: 'Bt /4', refVal: 1 / 4},
    beatM: {defVal: 'active', type: 'cmd', name: 'Manual', refVal: 0}
  }
  const lfoTypeCmdsDef = {
    lfoSine: {defVal: 'active', type: 'cmd', name: 'Sine', refVal: 'sine'},
    lfoSquare: {defVal: 'off', type: 'cmd', name: 'Square', refVal: 'square'},
    lfoSaw: {defVal: 'off', type: 'cmd', name: 'Sawtooth', refVal: 'sawtooth'},
    lfoTri: {defVal: 'off', type: 'cmd', name: 'Triangle', refVal: 'triangle'},
    lfoExt: {defVal: 'off', type: 'cmd', name: 'Ext', refVal: 'ext'}
  }
  const biquadTypeCmdsDef = {
    filtLowpass: {defVal: 'active', type: 'cmd', name: 'loPass', refVal: 'lowpass'},
    filtHighpass: {defVal: 'off', type: 'cmd', name: 'hiPass', refVal: 'highpass'},
    filtLowshelf: {defVal: 'off', type: 'cmd', name: 'loShelf', refVal: 'lowshelf'},
    filtHishelf: {defVal: 'off', type: 'cmd', name: 'hiShelf', refVal: 'highshelf'},
    filtBandpass: {defVal: 'off', type: 'cmd', name: 'bndPass', refVal: 'bandpass'},
    filtPeaking: {defVal: 'off', type: 'cmd', name: 'peak', refVal: 'peaking'}
  }
  const wobbleFx = { //8#b4f ------- wobble -------
    def: {
      bpm: {defVal: 333, skipUi: true}, //: internal, from listening to the source
      beatTime: {defVal: 60 / 333, skipUi: true}, //: internal, from bpm
      bpmDisp: {defVal: '333#def', type: 'box', width: 24},
      ...beatCmdsDef,
      lfoType: {defVal: 'LFO:#label.ledon#0,0.5s', type: 'box', subType: 'led', width: 24},
      //lfoType: {defVal: 'off', type: 'cmd', subType: 'led', readOnly: true, name: ''},
      ...lfoTypeCmdsDef,
      lfoFreq: {defVal: .5, min: .25, max: 100, subType: 'exp', unit: 'Hz', name: 'LFO freq'},
      phaseDeg: {defVal: 0, min: 0, max: 360, unit: 'deg', name: 'LFO phase'},
      phaseDelay: {defVal: 0, skipUi: true},
      phaseLabel: {defVal: 'Phase delay:#label', type: 'box', width: 62},
      phaseDisp: {defVal: '0 / 180ms#def', type: 'box', width: 80},
      reverse: {defVal: 'off', type: 'cmd', subType: 'led', name: 'Reverse'}, //: -> int.sign
      excursion: {defVal: 600, min: 0, max: 3600, subType: 'int', unit: 'cent'},
      ...biquadTypeCmdsDef,
      filterGain: {defVal: 0, min: -40, max: 40, unit: 'dB'},
      filterQ: {defVal: 5, min: 0.001, max: 50, subType: 'exp'},
      filterFreq: {defVal: 500, min: 50, max: 5000, subType: 'exp', unit: 'Hz'},
      filterType: {defVal: 'lowpass', skipUi: true},
      filterGraph: {type: 'graph'}
    },
    midi: {pars: ['lfoFreq,phaseDeg', 'excursion,filterGain', 'filterFreq,filterQ']},
    listen: ['source.bpm:bpm']
  }
  const graphCommon = {
    graphType: 'freq',
    triggerKeys: ['filterGraph'],
    minDb: -27,
    maxDb: 33,
    freqMarginLeft: -10,
    diynamic: .8
  }
  wobbleFx.graphs = {
    filterGraph: [{
      ...graphCommon,
      filter: 'filter',
      customRenderer: {
        pre: ({fx, cc, ccext, freq}) => {
          const lfoX = freq.freq2X[round(fx.atm.lfoFreq)] || 0
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

  wobbleFx.setValue = (fx, key, value, {atm, int} = fx) => ({
    bpm: _ => {
      fx.setValue('bpmDisp', value + (value === fx.exo.def.bpm.defVal ? '#def' : '#set'))
      fx.setValue('beatTime', 60 / (value || 333))
    },
    beatTime: _ => fx.recalcLFOFreq(),
    phaseDelay: _ => {
      fx.setDelayTime('phaseDelay', atm.phaseDelay)
      const str = `${round(atm.phaseDelay * 1000)} / ${round(int.period * 1000)}ms`
      const mod = atm.bpm === fx.exo.def.bpm.defVal ? '#set' : '#mod'
      fx.setValue('phaseDisp', str + mod)
    },
    phaseDeg: _ => fx.recalcPhase(),
    lfoWaveForm: _ => int.lfo.type = value,
    lfoFreq: _ => fx.recalcLFOFreq(value),
    excursion: _ => {
      fx.setAt('lfoGain', 'gain', value * int.sign)
      fx.setAt('minModFilter', 'detune', -value * int.sign)
      fx.setAt('maxModFilter', 'detune', value * int.sign)
      fx.valueChanged('filterGraph')
    },
    filterType: _ => fx.modFilters(),
    filterGain: _ => fx.modFilters(),
    filterQ: _ => fx.modFilters(),
    filterFreq: _ => fx.modFilters()
  }[key] || (_ => fx.cmdProc(value, key)))
  
  wobbleFx.construct = (fx, pars, {int, atm} = fx) => {
    int.sign = 1
    int.period = atm.beatTime //: just for avoid div by zero at init
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
    int.phaseDelay = waCtx.createDelay(5) //: 5 sec = min freq is .2 Hz
    connectArr(int.lfo, int.lfoGain, int.phaseDelay)
    int.phaseDelay.connect(int.filter.detune)
    connectArr(fx.start, int.filter, fx.output)
    connectArr(fx.start, int.minModFilter, int.maxModFilter, int.dummyGain, waCtx.destination)
    
    const beatCmds = createRadioCmds(fx, beatCmdsDef)
    const lfoCmds = createRadioCmds(fx, lfoTypeCmdsDef)
    const biquadCmds = createRadioCmds(fx, biquadTypeCmdsDef)
    
    fx.setLFOWaveForm = type => type !== 'ext' && (int.lfo.type = type) //: no visuals (cmds done)
    
    fx.updateBeatCmds = _ => 
      beatCmds.evaluate((_, val) => val
       ? abs(int.period / atm.beatTime / val - 1) < 0.01
         ? 'active'
         : abs(int.period / atm.beatTime / val - 1) < 0.1
           ? 'on' 
           : 'off'
       : 'active')

    fx.recalcPhase = _ => fx.setValue('phaseDelay', atm.phaseDeg * int.period / 360)

    fx.recalcLFOFreq = (lfoFreq = 0) => {
      if (!lfoFreq) {
        if (int.beatTimeMod) {  //: setBeatTimeMod() called
          int.period = atm.beatTime * int.beatTimeMod
          fx.setValue('lfoFreq', 1 / int.period)
          return
        } else {
          lfoFreq = atm.lfoFreq
        }
      }
      int.period = 1 / lfoFreq

      fx.updateBeatCmds()
      fx.recalcPhase()
      fx.setAt('lfo', 'frequency', atm.lfoFreq)
      fx.valueChanged('filterGraph') //: this is for the vertical LFO freq line
      fx.setValue('lfoType', `LFO:#label.ledon#290,${round(int.period * 1000) / 1000}s`)
    }
    
    fx.setBeatTimeMod = val => {
      int.beatTimeMod = val
      fx.recalcLFOFreq()
    }

    const tripleFilterMod = (param, setat, mainVal, minVal = mainVal, maxVal = mainVal) => {
      if (setat) {
        fx.setAt('filter', param, mainVal)
        fx.setAt('minModFilter', param, minVal)
        fx.setAt('maxModFilter', param, maxVal)
      } else {
        int.filter[param] = mainVal
        int.minModFilter[param] = minVal
        int.maxModFilter[param] = maxVal
      }
    }
    fx.modFilters = _ => {
      tripleFilterMod('gain', true, atm.filterGain)
      tripleFilterMod('frequency', true, atm.filterFreq)
      tripleFilterMod('Q', true, atm.filterQ)
      tripleFilterMod('type', false, atm.filterType)
      fx.valueChanged('filterGraph')
    }
    
    fx.cmdProc = (fire, mode) => {
      if (fire === 'fire') {
        if (beatCmds.check(mode, val => fx.setBeatTimeMod(val)) ||
          lfoCmds.check(mode, val =>  fx.setLFOWaveForm(val)) ||
          biquadCmds.check(mode, val => fx.setValue('filterType', val))) {
          return
        }
        const action = {
          reverse: _ => {
            int.sign = -int.sign
            fx.setValue('reverse', int.sign === -1 ? 'active.ledon' : 'off')
            fx.setValue('excursion') //: this will recalc the filter and redraw
          }
        }[mode]
        void action?.()
      }
  }
  }
  
  registerFxType('fx_wobble', wobbleFx)
})
