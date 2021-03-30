/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {nop, isArr, undef, getRnd, getRndFloat, clamp} = Corelib
const {wassert} = Corelib.Debug
const {createPerfTimer, startEndThrottle, post} = Corelib.Tardis
const {max, pow, round, tanh, abs, min, sign, sqrt} = Math

onWaapiReady.then(waCtx => {
  const {registerFxType, newFx, connectArr, dB2Gain, gainToDb} = BeeFX(waCtx)
  
  const tlPitchShifter = {//8#095 ----- Jungle (original from Chris Wilson) -----
    def: {
      delayTime: {defVal: .1, min: 0, max: 1, readOnly: true},
      pitch: {defVal: 0, min: -1, max: 1, readOnly: true},
      log: {defVal: '-', type: 'info'}
    },
    name: 'Jungle',
    graphs: {}
  }
  
  tlPitchShifter.setValue = (fx, key, value, {int, atm} = fx) => ({
    delayTime: _ => fx.setDelay(value),
    pitch: _ => fx.setPitchOffset(value),
    log: nop
  }[key])
  
  tlPitchShifter.construct = (fx, {initial}, {int, atm} = fx) => {
    int.frequency = 0
    int.delayA = waCtx.createDelay(1)
    int.delayB = waCtx.createDelay(1)
    //+ a tone.,jsajat LFO-ja tok mas!
    int.lfoA = newFx('fx_LFO') // min 0 max .1 sawtooth
    int.lfoB = newFx('fx_LFO') // min 0 max .1 sawtooth phase 180
    int.lfoA.connect(int.delayA.delayTime)
    int.lfoB.connect(int.delayB.delayTime)
    int.crossfade = newFx('fx_xFade')
    int.lfoCrossFade = newFx('fx_LFO') // min 0 max 1 triangle phase 90
    int.lfoCrossFade.connect(int.crossFade.int.fade) // crossfade.fade!!!
    int.feedbackDelay = waCtx.createDelay(1)
    int.delayTime = int.feedbackDelay.delayTime // readonly
    // init:
    int.delayTime = 0
    int.pitch = 0
    int.windowSize = 0.1
    int.feedback = 0
    
    int.delayA.connect(int.crossFade.a)
    int.delayB.connect(int.crossFade.b)
    int.frequency.connect(int.lfoA.frequency)
    int.frequency.connect(int.lfoB.frequency)
    int.frequency.connect(int.lfoCrossFade.frequency)
    
    //int.effectSend.connect(int.feedbackDelay -> effectReturn)
    fx.start.connect(int.delayA)
    fx.start.connect(int.delayB)
    connectArr(int.crossFade, int.feedbackDelay, fx.output)
    
    const at = waCtx.currentTime + .01
    int.lfoA.start(at)  
    int.lfoB.start(at)
    int.lfoCrossfade.start(at)
    
    fx.setDelay = delayTime => {
      int.modGain1.gain.setTargetAtTime(0.5 * delayTime, 0, 0.010)
      int.modGain2.gain.setTargetAtTime(0.5 * delayTime, 0, 0.010)
    }
    fx.setPitchOffset = mult => {
      if (mult > 0) { // pitch up
        int.lfoA.min = 0
        int.lfoA.max = int.windowSize
        int.lfoB.min = 0
        int.lfoB.max = int.windowSize
        //int.factor = intervaltofrequencyratio(mult - 1) + 1
      } else { // pitch down
        int.lfoA.min = int.windowSize
        int.lfoA.max = 0
        int.lfoB.min = int.windowSize
        int.lfoB.max = 0
        //int.factor = intervaltofrequencyratio(mult) - 1
      }
      int.frequency.value = int.factor * (1.2 / int.windowSize)
    }
    fx.setDelay(atm.delayTime)
    atm.pitch = 0

    fx.updateLog = _ => {
      fx.setValue('log', [
        `outputGain(Db): ${atm.outputGain} outputGain(Gain): ${int.outputGainGain}`,
        `outputGainMod: ${int.outputGainMod} outputGainReal: ${int.outputGainReal.toFixed(3)}`
      ].join('<br>'))
    }
  }
  //: not yet registerFxType('fx_tlPitchShifter', tlPitchShifter)
  
  // Copyright 2012, Google Inc.
  // All rights reserved.
  //
  // Redistribution and use in source and binary forms, with or without
  // modification, are permitted provided that the following conditions are
  // met:
  //
  //   * Redistributions of source code must retain the above copyright
  // notice, this list of conditions and the following disclaimer.
  //   * Redistributions in binary form must reproduce the above
  // copyright notice, this list of conditions and the following disclaimer
  // in the documentation and/or other materials provided with the
  // distribution.
  //   * Neither the name of Google Inc. nor the names of its
  // contributors may be used to endorse or promote products derived from
  // this software without specific prior written permission.
  //
  // THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
  // "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
  // LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
  // A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
  // OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
  // SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
  // LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
  // DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
  // THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  // (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
  // OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

  const createFadeBuffer = (activeTime, fadeTime) => {
    const length1 = activeTime * waCtx.sampleRate
    const length2 = (activeTime - 2 * fadeTime) * waCtx.sampleRate
    const length = length1 + length2
    const buffer = waCtx.createBuffer(1, length, waCtx.sampleRate)
    const chnData = buffer.getChannelData(0)
    
    console.log("createFadeBuffer() length = ", {length, length1, length2})
    
    const fadeLength = fadeTime * waCtx.sampleRate
    const fadeIndex1 = fadeLength
    const fadeIndex2 = length1 - fadeLength
    
    for (let i = 0; i < length; ++i) {
      chnData[i] = i < length1
        ? i < fadeIndex1
          ? Math.sqrt(i / fadeLength)
          : i >= fadeIndex2
            ? Math.sqrt(1 - (i - fadeIndex2) / fadeLength)
            : 1
        : 0    
    }
    return buffer
  }

  const createDelayTimeBuffer = (activeTime, fadeTime, shiftUp) => {
    const length1 = activeTime * waCtx.sampleRate
    const length2 = (activeTime - 2 * fadeTime) * waCtx.sampleRate
    const length = length1 + length2
    const buffer = waCtx.createBuffer(1, length, waCtx.sampleRate)
    const chnData = buffer.getChannelData(0)

    console.log("createDelayTimeBuffer() length = ", {length, length1, length2})
    
    for (let i = 0; i < length; ++i) {
      chnData[i] = i < length1
        ? shiftUp       
          ? (length1 - i) / length  // This line does shift-up transpose
          : i / length1 // This line does shift-down transpose
        : 0  
    }
    return buffer
  }

  const jungleFx = {//8#095 ----- Jungle (original from Chris Wilson) -----
    def: {
      delayTime: {defVal: .1, min: 0, max: 1, readOnly: true},
      pitch: {defVal: 0, min: -1, max: 1, readOnly: true},
      log: {defVal: '-', type: 'info'}
    },
    name: 'Jungle',
    graphs: {}
  }
  jungleFx.graphs.sigmoidGraph = { //+ ez mi?
    graphType: 'sigmoid',
    genCurveColor: '#fc6'
  }
  
  jungleFx.setValue = (fx, key, value, {int, atm} = fx) => ({
    delayTime: _ => fx.setDelay(value),
    pitch: _ => fx.setPitchOffset(value),
    log: nop
  }[key])
  
  jungleFx.construct = (fx, {initial}, {int, atm} = fx) => {
    //int.delayTime = 0.100
    int.fadeTime = 0.050
    int.bufferTime = 0.100
    
    int.mod1 = waCtx.createBufferSource()// Delay modulation.
    int.mod2 = waCtx.createBufferSource()
    int.mod3 = waCtx.createBufferSource()
    int.mod4 = waCtx.createBufferSource()
    int.shiftDownBuffer = createDelayTimeBuffer(int.bufferTime, int.fadeTime, false)
    int.shiftUpBuffer = createDelayTimeBuffer(int.bufferTime, int.fadeTime, true)
    int.mod1.buffer = int.mod2.buffer = int.shiftDownBuffer
    int.mod3.buffer = int.mod4.buffer = int.shiftUpBuffer
    int.mod1.loop = true
    int.mod2.loop = true
    int.mod3.loop = true
    int.mod4.loop = true
    
    int.mod1Gain = waCtx.createGain() // for switching between oct-up and oct-down
    int.mod2Gain = waCtx.createGain()
    int.mod3Gain = waCtx.createGain()
    int.mod3Gain.gain.value = 0
    int.mod4Gain = waCtx.createGain()
    int.mod4Gain.gain.value = 0

    int.modGain1 = waCtx.createGain() // Delay amount for changing pitch.
    int.modGain2 = waCtx.createGain()
    int.delay1 = waCtx.createDelay()
    int.delay2 = waCtx.createDelay()
    connectArr(int.mod1, int.mod1Gain, int.modGain1, int.delay1.delayTime)
    connectArr(int.mod2, int.mod2Gain, int.modGain2, int.delay2.delayTime)
    connectArr(int.mod3, int.mod3Gain, int.modGain1)
    connectArr(int.mod4, int.mod4Gain, int.modGain2)

    // Crossfading.
    int.fade1 = waCtx.createBufferSource()
    int.fade2 = waCtx.createBufferSource()
    int.fadeBuffer = createFadeBuffer(int.bufferTime, int.fadeTime)
    int.fade1.buffer = int.fade2.buffer = int.fadeBuffer
    int.fade1.loop = true
    int.fade2.loop = true

    int.mix1 = waCtx.createGain()
    int.mix2 = waCtx.createGain()
    int.mix1.gain.value = 0
    int.mix2.gain.value = 0

    int.fade1.connect(int.mix1.gain)
    int.fade2.connect(int.mix2.gain)
      
    // Connect processing graph.
    connectArr(fx.start, int.delay1, int.mix1, fx.output)
    connectArr(fx.start, int.delay2, int.mix2, fx.output)
    
    // Start
    int.t = waCtx.currentTime + 0.050
    int.t2 = int.t + int.bufferTime - int.fadeTime
    int.mod1.start(int.t)
    int.mod2.start(int.t2)
    int.mod3.start(int.t)
    int.mod4.start(int.t2)
    int.fade1.start(int.t)
    int.fade2.start(int.t2)
    
    fx.setDelay = delayTime => {
      int.modGain1.gain.setTargetAtTime(0.5 * delayTime, 0, 0.010)
      int.modGain2.gain.setTargetAtTime(0.5 * delayTime, 0, 0.010)
    }
    fx.setPitchOffset = mult => {
      if (mult > 0) { // pitch up
        int.mod1Gain.gain.value = 0
        int.mod2Gain.gain.value = 0
        int.mod3Gain.gain.value = 1
        int.mod4Gain.gain.value = 1
      } else { // pitch down
        int.mod1Gain.gain.value = 1
        int.mod2Gain.gain.value = 1
        int.mod3Gain.gain.value = 0
        int.mod4Gain.gain.value = 0
      }
      fx.setDelay(atm.delayTime * Math.abs(mult))
      atm.pitch = mult
    }
    fx.setDelay(atm.delayTime)
    atm.pitch = 0

    fx.updateLog = _ => {
      fx.setValue('log', [
        `outputGain(Db): ${atm.outputGain} outputGain(Gain): ${int.outputGainGain}`,
        `outputGainMod: ${int.outputGainMod} outputGainReal: ${int.outputGainReal.toFixed(3)}`
      ].join('<br>'))
    }
  }
  registerFxType('fx_jungle', jungleFx)
  
  const pitchShifterFx = { //8#e74 ------- pitchShifter (Chris Wilson / jungle) -------
    def: {
      //reset: {defVal: false, type: 'cmd'},
      offset: {defVal: 0, min: -1, max: 1},
      fineTune: {defVal: 0, min: -.1, max: .1},
      realOffset: {defVal: 0, min: -.1, max: .1, readOnly: true},
      log: {defVal: '-', type: 'info'}
    }
  }

  pitchShifterFx.setValue = (fx, key, value) => ({
    log: nop,
    realOffset: nop,
    offset: _ => fx.setOffset(),
    fineTune: _ => fx.setOffset()
  }[key])

  pitchShifterFx.construct = (fx, pars, {int, atm} = fx) => {
    int.jungle = newFx('fx_jungle')
    connectArr(fx.start, int.jungle, fx.output)
    int.jungle.setValue('pitch', 0) // setPitchOffset(0)
    
    const updateLog = _ => {
      const {delayTime, fadeTime, bufferTime, mult} = int.jungle.getState()
      fx.setValue('log', [
        `offset: ${atm.offset} mult: ${mult.toFixed(3)} realOffset: ${atm.realOffset.toFixed(3)}`,
        `delayTime: ${delayTime} fadeTime: ${fadeTime} bufferTime: ${bufferTime}`
      ].join('<br>'))
    }
    fx.setOffset = _ => {
      atm.realOffset = atm.offset + atm.fineTune
      int.jungle.setPitchOffset(atm.realOffset)
      int.jungle.setValue('pitch', atm.realOffset)
      //updateLog()
    }
  }
  registerFxType('fx_pitchShifter', pitchShifterFx)
})
