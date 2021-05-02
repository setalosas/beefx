/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {nop} = Corelib
const {schedule} = Corelib.Tardis
const {min, max, round} = Math

onWaapiReady.then(waCtx => {
  const {connectArr, registerFxType, nowa} = BeeFX(waCtx)
  
  const beatDelayFx = { //8#96e ------- Perfect beat delay -------
    def: {
      bpmLabel: {defVal: 'BPM:#label', type: 'box', width: 26},
      bpm: {defVal: 333, min: 40, max: 240, skipUi: true},
      bpmDisp: {defVal: '50#set', type: 'box', width: 24},
      beatTime: {defVal: 60 / 333, min: .25, max: 2, skipUi: true},
      beatTimeDisp: {defVal: '500ms#set', type: 'box', width: 40},
      delayLabel: {defVal: 'Delay:#label', type: 'box', width: 28},
      delayDisp: {defVal: '0 beats / 0ms#set', type: 'box', width: 67},
      wait: {defVal: 'on.ledoff', type: 'cmd', subType: 'led', color: 10, name: 'Wait'},
      noDelay: {defVal: 'on', type: 'cmd', name: 'No delay'},
      decDelay: {defVal: 'on', type: 'cmd', name: '-1 beat'},
      incDelay: {defVal: 'on', type: 'cmd', name: '+1 beat'},
      halfBeat: {defVal: 'off', type: 'cmd', subType: 'led', color: 190, name: '/2 beat'},
      delayBeats: {defVal: 0, min: 0, max: 16, subType: 'int', skipUi: true},
      delayTime: {defVal: 0, min: 0, max: 16, unit: 's', readOnly: true, skipUi: true},
      reset: {skipUi: true},
      onChange: {skipUi: true}
    },
    state: {
      disableStandardState: false,
      save: fx => fx.int.extract('half'),
      restore: (fx, state) => state.half && fx.setValue('halfBeat', 'fire')
    },
    name: 'Perfect Beat Delay',
    listen: ['source.bpm:bpm', 'source.chg:onChange']
  }
  beatDelayFx.setValue = (fx, key, value, {atm, int, exo} = fx) => ({
    wait: nop,
    onChange: _ => fx.setBusy(),
    reset: _ => {
      if (value) {
        fx.setValue('bpm', exo.def.bpm.defVal)
        fx.setValue('beatTime', exo.def.beatTime.defVal)
      }
    },
    bpmLabel: nop,
    bpm: _ => {
      const defBpm = exo.def.bpm.defVal
      const hasBpm = fx.past.bpm !== defBpm && fx.past.bpm > 0
      atm.bpm !== defBpm || !hasBpm
        ? fx.recalc()
        : atm.bpm = fx.past.bpm //: don't set back to default, rather remember the last good one
    },
    bpmDisp: nop,
    beatTime: nop,
    beatTimeDisp: nop,
    delayLabel: nop,
    delayDisp: nop,
    halfBeat: _ => {
      if (value === 'fire') {
        int.half = !int.half
        fx.setValue('halfBeat', int.half ? 'active.ledon' : 'off.ledoff')
        fx.recalc()
      }
    },
    noDelay: _ => fx.setValue('delayBeats', 0),
    decDelay: _ => fx.setValue('delayBeats', max(0, atm.delayBeats - 1)),
    incDelay: _ => fx.setValue('delayBeats', min(16, atm.delayBeats + 1)),
    delayBeats: _ => fx.recalc(),
    delayTime: _ => fx.setDelayTime('delay', atm.delayTime) //: much better than the setter
  }[key])

  beatDelayFx.construct = (fx, pars, {int, atm, exo} = fx) => {
    int.delay = waCtx.createDelay(10)
    connectArr(fx.start, int.delay, fx.output)
    int.half = false
    
    const checkBusy = _ => {
      if (int.isBusy) {
        if (int.endBusy < nowa()) {
          int.isBusy = false
          fx.setValue('wait', 'on.ledoff')
        } else {
          schedule(30).then(checkBusy)
        }
      }
    }
    
    fx.setBusy = _ => {
      int.endBusy = nowa() + atm.delayTime
      if (!int.isBusy) {
        int.isBusy = true
        fx.setValue('wait', 'on.ledon')
        checkBusy()
      }
    }
    
    fx.recalc = _ => { //: in: bpm, delayBeats, out: beatTimeDisp, bpmDisp, delayTime
      fx.setValue('beatTime', 60 / atm.bpm)
      const beatTimeStr = round(atm.beatTime * 1000) + 'ms'
      const [mod1, mod2] = ~~atm.bpm === exo.def.bpm.defVal ? ['#def', '#def'] : ['#set', '#mod']
      const halfer = int.half ? 2 : 1
      fx.setValue('beatTimeDisp', beatTimeStr + mod1)
      fx.setValue('bpmDisp', atm.bpm + mod1)
      fx.setValue('delayTime', atm.beatTime * atm.delayBeats / halfer)
      const delayTimeStr = round(atm.delayTime * 1000) + 'ms'
      fx.setValue('delayDisp', atm.delayBeats / halfer + ' / ' + delayTimeStr + mod2)
      fx.setBusy()
    }
  }
  registerFxType('fx_beatDelay', beatDelayFx)

  const delayExFx = { //8#05e ------- Delay extended (Oskar Eriksson / Tuna) -------
    def: {
      delayTime: {defVal: 100, min: 20, max: 1000, unit: 'ms'},
      feedback: {defVal: .45, min: .0, max: .99},
      cutOff: {defVal: 20000, min: 20, max: 20000, unit: 'Hz', subType: 'exp'},
      wetLevel: {defVal: .5, min: 0, max: 1},
      dryLevel: {defVal: 1, min: 0, max: 1},
      freqGraph: {type: 'graph'}
    },
    midi: {pars: ['delayTime,feedback,cutOff', 'wetLevel,dryLevel']},
    name: 'Delay (extended)',
    graphs: {}
  }
  delayExFx.graphs.freqGraph = {
    graphType: 'freq',
    filter: 'filter',
    minDb: -43,
    maxDb: 10,
    diynamic: .5
  }
  delayExFx.setValue = (fx, key, value, {int, atm} = fx) => ({
    delayTime: _ => fx.setDelayTime('delay', value / 1000),
    feedback: _ => fx.setAt('feedback', 'gain', value),
    cutOff: _ => fx.setAt('filter', 'frequency', value),
    wetLevel: _ => fx.setAt('wet', 'gain', value),
    dryLevel: _ => fx.setAt('dry', 'gain', value)
  }[key])
  
  delayExFx.construct = (fx, pars, {int} = fx) => {
    int.dry = waCtx.createGain()
    int.wet = waCtx.createGain()
    int.filter = waCtx.createBiquadFilter()
    int.filter.type = 'lowpass'
    int.delay = waCtx.createDelay(10)
    int.feedback = waCtx.createGain()

    connectArr(fx.start, int.delay, int.filter, int.feedback, int.wet, fx.output)
    int.feedback.connect(int.delay)
    connectArr(fx.start, int.dry, fx.output)
  }

  registerFxType('fx_delayExt', delayExFx)
  
  const pingPongDelayAFx = { //8#0ac -------pingPongDelayA (Chris Wilson) -------
    def: {
      delayLeft: {defVal: 200, min: 0, max: 4000, unit: 'ms'},
      delayRight: {defVal: 400, min: 0, max: 4000, unit: 'ms'},
      feedbackLeft: {defVal: .5, min: .01, max: 1.0},
      feedbackRight: {defVal: .5, min: .01, max: 1.0, name: 'feedbkRight'}
    },
    midi: {pars: ['delayLeft,feedbackLeft', 'delayRight,feedbackRight']},
    name: 'Ping Pong Delay A'
  }
  pingPongDelayAFx.setValue = (fx, key, value) => ({
    delayLeft: _ => fx.int.leftDelay.delayTime.value = value / 1000, //: setAt makes this worse
    delayRight: _ => fx.setDelayTime('rightDelay', value / 1000),    //: that's 100%
    feedbackLeft: _ => fx.setAt('leftFeedback', 'gain', value),
    feedbackRight: _ => fx.setAt('rightFeedback', 'gain', value)
  }[key])
  
  pingPongDelayAFx.construct = (fx, pars, {int} = fx) => {
    int.merger = waCtx.createChannelMerger(2)
    int.leftDelay = waCtx.createDelay(10)
    int.rightDelay = waCtx.createDelay(10)
    int.leftFeedback = waCtx.createGain()
    int.rightFeedback = waCtx.createGain()
    int.splitter = waCtx.createChannelSplitter(2)

    int.splitter.connect(int.leftDelay, 0)
    int.splitter.connect(int.rightDelay, 1)
    connectArr(int.leftDelay, int.leftFeedback, int.rightDelay, int.rightFeedback, int.leftDelay)
    int.leftFeedback.connect(int.merger, 0, 0)
    int.rightFeedback.connect(int.merger, 0, 1)
    fx.start.connect(int.splitter)
    int.merger.connect(fx.output)
  }

  registerFxType('fx_pingPongDelayA', pingPongDelayAFx)
  
  const pingPongDelayBFx = { //8#0b8 -------pingPongDelayB (Tuna) -------
    def: {
      delayLeft: {defVal: 200, min: 0, max: 4000, unit: 'ms'},
      delayRight: {defVal: 400, min: 0, max: 4000, unit: 'ms'},
      feedback: {defVal: .5, min: .01, max: 1.0},
      wetLevel: {defVal: .5, min: .01, max: 1.0}
    },
    midi: {pars: ['delayLeft,feedback', 'delayRight,wetLevel']},
    name: 'Ping Pong Delay B'
  }
  
  pingPongDelayBFx.setValue = (fx, key, value) => ({
    delayLeft: _ => fx.int.leftDelay.delayTime.value = value / 1000, //: no setAt, this is better
    delayRight: _ => fx.int.rightDelay.delayTime.value = value / 1000,
    feedback: _ => fx.setAt('feedbackLevel', 'gain', value),
    wetLevel: _ => fx.setAt('wet', 'gain', value)
  }[key])

  pingPongDelayBFx.construct = (fx, pars, {int} = fx) => {
    int.wet = waCtx.createGain()
    int.stereoToMonoMix = waCtx.createGain()
    int.stereoToMonoMix.gain.value = .5
    int.feedbackLevel = waCtx.createGain()
    int.leftDelay = waCtx.createDelay(10)
    int.rightDelay = waCtx.createDelay(10)
    int.splitter = waCtx.createChannelSplitter(2)
    int.merger = waCtx.createChannelMerger(2)

    fx.start.connect(int.splitter)
    int.splitter.connect(int.stereoToMonoMix, 0, 0)
    int.splitter.connect(int.stereoToMonoMix, 1, 0)
    connectArr(int.stereoToMonoMix, int.wet, int.leftDelay, int.rightDelay, int.feedbackLevel)
    int.feedbackLevel.connect(int.wet)
    int.leftDelay.connect(int.merger, 0, 0)
    int.rightDelay.connect(int.merger, 0, 1)
    int.merger.connect(fx.output)
    fx.start.connect(fx.output) //:dry
  }
  
  registerFxType('fx_pingPongDelayB', pingPongDelayBFx)
})
