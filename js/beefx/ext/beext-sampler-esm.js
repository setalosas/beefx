/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {nop, clamp} = Corelib
const {wassert, weject} = Corelib.Debug // eslint-disable-line
const {post} = Corelib.Tardis
const {max, round, floor} = Math
const {AudioWorkletNode, requestAnimationFrame: RAF} = window

onWaapiReady.then(waCtx => {
  const {registerFxType, connectArr, concatAudioBuffers} = BeeFX(waCtx)
  
  const logOn = false
  const clog = (...args) => logOn && console.log(...args)
  
  const drawWaveOverview = fx => {
    const {int} = fx
    const {cc, ccext, width, height, disp, final} = int
    const {sampleRate} = waCtx
    
    const sec2Pix = sec => (sec - disp.startRel) * sampleRate / disp.zoom
    
    const startx = sec2Pix(final.startRel)
    const midx = sec2Pix(final.startRel + final.len / 2)
    const endx = sec2Pix(final.endRel)
    
    const drawRecIndicator = _ => {
      if (int.inRec) {
        const timeFrac = (waCtx.currentTime * 1000) % 1000
        if (timeFrac > 450) {
          cc.beginPath()
          cc.arc(width - 30, 30, 15, 0, 2 * Math.PI, false)
          cc.fillStyle = '#e00'
          cc.fill()
          cc.stroke()
        }
      }
    }
    const drawGrid = _ => {
      cc.clearRect(0, 0, width, height)
      cc.font = '32px roboto condensed'
      cc.lineWidth = 2
      cc.strokeStyle = 'hsla(200, 70%, 50%, 0.8)'
      for (let sec = floor(disp.startRel); sec < floor(disp.endRel) + 1; sec++) {
        const secX = sec2Pix(sec)
        ccext.drawLine(secX, 0, secX, height)
      }
      cc.lineWidth = 5
      cc.strokeStyle = 'hsla(70, 70%, 65%, 0.8)'
      ccext.drawLine(startx, 0, startx, height)
      cc.strokeStyle = 'hsla(330, 70%, 65%, 0.8)'
      ccext.drawLine(endx, 0, endx, height)
      cc.lineWidth = 3
      cc.strokeStyle = 'hsla(25, 70%, 65%, 0.8)'
      ccext.drawLine(midx, 0, midx, height)
      drawRecIndicator()
    }
    
    const drawWave = _ => {
      const scale = height / 2
      const centerY = height / 2
      const data = int.audioBuffer.getChannelData(0)
      
      cc.lineWidth = 2.5
      cc.strokeStyle = 'hsl(35, 100%, 80%)' // strokeStyle
      cc.beginPath()
      
      let frameIx = disp.startRel * sampleRate
      const maxFrame = disp.endRel * sampleRate
      
      cc.moveTo(0, centerY - data[round(frameIx)] * scale)
      const step = 1 / (2 + Math.random())
      const startX = Math.random() / 2
      const fstep = disp.zoom * step

      for (let x = startX; frameIx < maxFrame && x < width; x += step, frameIx += fstep) {
        const magnitude = data[round(frameIx)] * scale
        cc.lineTo(x, centerY - magnitude)
      }
      cc.stroke()
    }
    
    if (cc) {
      if (int.audioBuffer) {
        drawGrid()
        drawWave()
      }
    }
    int.isRAFOn && RAF(_ => drawWaveOverview(fx))
  }

  const samplerEx = { //8#aa8 -------loop -------
    def: {
      log: {defVal: '-', type: 'info'},
      modeBypass: {defVal: 'active.ledon', type: 'cmd', subType: 'led', color: 140, name: 'Bypass'},
      modeRecord: {defVal: 'on', type: 'cmd', subType: 'led', color: 0, name: 'Record'},
      modeSampler: {defVal: 'off', type: 'cmd', subType: 'led', color: 180, name: 'Sampler'},
      useScriptProc: {defVal: 'on', type: 'cmd', subType: 'led', name: 'scriptProcessor (slow)'},
      useWorklet: {defVal: 'off', type: 'cmd', subType: 'led', name: 'audioWorklet (slow)'},
      wave: {type: 'graph'},
      trimLeft: {defVal: 'on', type: 'cmd', name: 'Trim left (1s)'},
      trimReset: {defVal: 'on', type: 'cmd', name: 'Reset'},
      trimRight: {defVal: 'on', type: 'cmd', name: 'Trim right (1s)'},
      startMod: {defVal: 0, min: -1, max: 1, unit: 's'},
      endMod: {defVal: 0, min: -1, max: 1, unit: 's'},
      samplePlay: {defVal: 'off', type: 'cmd', name: 'Play'},
      sampleLoop: {defVal: 'off', type: 'cmd', subType: 'led', color: 80, name: 'Loop sample'},
      sampleStop: {defVal: 'off', type: 'cmd', name: 'Stop loop'},
      piano: {defVal: 'Cm', type: 'piano'}
    },
    midi: {pars: ['startMod', 'endMod']},
    name: 'Dev Sampler',
    graphs: {
      wave: {
        graphType: 'custom',
        onInit: ({cc, width, height, fx, ccext}) => fx.int.capture({cc, width, height, ccext})
      }
    }
  }

  samplerEx.setValue = (fx, key, value, {atm, int} = fx) => ({
    log: nop,
    startMod: _ => fx.recalcMarkers(),
    endMod: _ => fx.recalcMarkers(),
    piano: _ => fx.setTone(value)
  }[key] || (_ => fx.cmdProc(value, key))) //: all commands sent to cmdProc

  samplerEx.onActivated = (fx, isActive) => isActive || fx.shutdownRecorder() //: cleanup!
  
  samplerEx.construct = (fx, pars, {int, atm} = fx) => {
    const recorded = {} //: this is fix
    const trim = {}     //: trim from the start and the end (in theory it's reversible)
    const sample = {}   //: can be changed with trim
    const final = {}    //: sample modified with startMod/endMod (sliders)
    const disp = {}     //: graph display interval
    int.capture({final, disp}) //: as we will need these in the graph redraw
      
    const initFx = _ => {
      int.isRAFOn = false
      int.useScriptProcessor = false
      int.procFrames = 4096
      int.muteInputOn = true //: so the next line will have a real effect
      muteInput(false)
      setMainMode('modeBypass')
      setScriptProcMode(int.useScriptProcessor)

      int.maxRunningLength = 6
      int.isLoopPlaying = false
      int.aubLength = 0
      int.sampleStored = false //: not used yet
      resetMarkers()
    }
    const resetMarkers = _ => { //: called at the start of a recording segment
      recorded.startAt = recorded.endAt = waCtx.currentTime
      trim.left = trim.right = 0
    }
    const muteInput = on => { //: we have two states: 'audio pass through' / 'sampler as source'
      if (int.muteInputOn !== on) {
        int.muteInputOn = on
        on ? fx.start.disconnect(fx.output) : fx.start.connect(fx.output)
      }
    }
    const setRAF = on => {
      if (on && !int.isRAFOn) {
        RAF(_ => drawWaveOverview(fx)) //: could be called directly, but RAF gives a bit time gap
      }                              //: + this is called by onaudioprocess, cannot touch the DOM
      int.isRAFOn = on
    }
    const relativize = interval => {
      interval.startRel = interval.startAt - recorded.startAt
      interval.endRel = interval.endAt - recorded.startAt
      interval.len = interval.endAt - interval.startAt
    }
    fx.recalcMarkers = _ => {
      recorded.len = recorded.endAt - recorded.startAt
      const isInRec = int.mode === 'modeRecord'
      if (isInRec) {
        const padding = clamp(recorded.len / 20, .01, 1)
        sample.startAt = recorded.startAt + padding
        sample.endAt = recorded.endAt - padding
      } else {
        sample.startAt = recorded.startAt + .0 + trim.left
        sample.endAt = max(recorded.endAt - .0 - trim.right, sample.startAt + .01)
      }
      relativize(sample)

      final.startAt = clamp(sample.startAt + atm.startMod, recorded.startAt, recorded.endAt)
      final.endAt = clamp(sample.endAt + atm.endMod, final.startAt + .01, recorded.endAt)
      relativize(final)
      
      if (isInRec) {
        disp.startAt = max(recorded.startAt, recorded.endAt - int.maxRunningLength)
        disp.endAt = recorded.endAt
      } else {        
        const margin = clamp(final.len / 10, .1, 1)
        disp.startAt = final.startAt - margin
        disp.endAt = final.endAt + margin
      }
      relativize(disp)
      disp.frames = disp.len * waCtx.sampleRate
      disp.zoom = disp.frames / int.width

      setRAF(true)
      post(updateLog) //: we can be in onaudiprocess, so we'll post it
      int.trimmable = int.mode === 'modeSampler' && sample.len > 2
      if (int.mode === 'modeSampler') { //: we cannot be in audioprocess if in sampler mode
        fx.setValue('trimLeft', int.trimmable ? 'on' : 'off')
        fx.setValue('trimRight', int.trimmable ? 'on' : 'off')
      }
    }
    const updateLog = _ => {
      const fix = v => round(v * 100) / 100
      
      if (!recorded.len) {
        fx.setValue('log', `No sample recorded.<br>Sample: - Final: -`)
      } else {
        const recTime = `Recorded/Sample/Final: ${recorded.len.toFixed(3)}s / ${fix(sample.len)}s / ${fix(final.len)}s`
        const sampleTime = `Sample: ${fix(sample.startRel)}-${fix(sample.endRel)} `
        const finalTime = `Final: ${fix(final.startRel)}-${fix(final.endRel)} Tr[-${trim.left}, -${trim.right}]`
        
        fx.setValue('log', [recTime, sampleTime + finalTime].join('<br>'))
      }
    }

    const setScriptProcMode = (useScriptProcessor, isActive = false) => {
      int.useScriptProcessor = useScriptProcessor
      const act = isActive ? 'ledon' : 'ledoff'
      fx.setValue('useWorklet', useScriptProcessor ? 'off.ledoff' : 'on.' + act)
      fx.setValue('useScriptProc', useScriptProcessor ? 'on.' + act : 'off.ledoff')
    }
    const appendBuffer = (buffer, frames) => {
      int.audioBuffer = concatAudioBuffers(int.audioBuffer, buffer)
      int.aubLength += frames
      recorded.endAt = waCtx.currentTime
      fx.recalcMarkers()
    }
    const setupRecorder = _ => { //: the output of both is int.audioBuffer / int.aubLength
      delete int.audioBuffer
      int.aubLength = 0
      setScriptProcMode(int.useScriptProcessor, true)

      if (int.useScriptProcessor) { //8#a43 Recorder ScriptProcessorNode. Fast, simple & deprecated.
        int.scriptNode = int.scriptNode || waCtx.createScriptProcessor(int.procFrames, 2, 2)
        int.scriptNode.onaudioprocess = data => appendBuffer(data.inputBuffer, int.procFrames)
        connectArr(fx.start, int.scriptNode, fx.output) //, waCtx.destination)//+teszt ha ez nincs
      } else {                      //8#43a Recorder AudioWorklet. Slow, complex & unstable.
        const pars = {outputChannelCount: [2]}
        int.recorder = int.recorder || new AudioWorkletNode(waCtx, 'Recorder', pars)
        int.recorder.port.onmessage = event => {
          const {data} = event
          if (data.op === 'audio') {
            const {frames, channels, channelData} = data
            const transBuff = waCtx.createBuffer(channels, frames, waCtx.sampleRate)
              
            for (let ch = 0; ch < channels; ch++) {
              transBuff.copyToChannel(channelData[ch], ch , 0)
            }
            appendBuffer(transBuff, frames)
          } else {
            console.log('Recorder got invalid message from worklet:', event)
          }
        }//: recorder already loaded the worklet or this wont work
        fx.start.connect(int.recorder)
        const params = {frameLimit: int.procFrames, transferCompact: false, transferAudio: true}
        int.recorder.port.postMessage({op: 'params', params})
        int.recorder.port.postMessage({op: 'rec'})
      }
    }
    fx.shutdownRecorder = _ => {
      setScriptProcMode(int.useScriptProcessor, false)
      if (int.useScriptProcessor) {
        if (int.scriptNode) {
          int.scriptNode.onaudioprocess = null
          delete int.scriptNode
        }
      } else {
        if (int.recorder) {
          int.recorder.port.postMessage({op: 'stop'})
          delete int.recorder
        }
      }
    }
    
    const updateMode = mode => {
      clog('enter ' + mode)
      int.mode = mode
      fx.setValue('modeBypass', 'on.ledoff')
      fx.setValue('modeRecord', 'on.ledoff')
      sample.len
        ? fx.setValue('modeSampler', 'on.ledoff')
        : fx.setValue('modeSampler', 'off.ledoff')
      fx.setValue(mode, 'active.ledon')
      setRAF(int.mode !== 'modeBypass')
      fx.recalcMarkers()
    }
    
    const enterBypassMode = _ => int.mode !== 'modeBypass' && updateMode('modeBypass')

    const exitBypassMode = _ => _
    
    const enterRecordMode = _ => {
      if (int.mode !== 'modeRecord') {
        setupRecorder()
        fx.setValue('startMod', 0)
        fx.setValue('endMod', 0)
        fx.setValue('trimLeft', 'off')
        fx.setValue('trimRight', 'off')
        resetMarkers()
        updateMode('modeRecord')
      }
    }
    const exitRecordMode = _ => int.mode === 'modeRecord' &&  fx.shutdownRecorder()

    const enterSamplerMode = _ => {
      if (int.mode !== 'modeSampler') {
        muteInput(true)
        fx.setValue('samplePlay', 'on')
        fx.setValue('sampleLoop', 'on')
        fx.setValue('sampleStop', 'on')
        fx.setValue('trimReset', 'on')
        updateMode('modeSampler')
      }
    }
    const exitSamplerMode = _ => {
      if (int.mode === 'modeSampler') {
        muteInput(false)
        endPlayOnce()
        endPlayLoop()
        fx.setValue('samplePlay', 'off')
        fx.setValue('sampleLoop', 'off')
        fx.setValue('sampleStop', 'off')
        fx.setValue('trimReset', 'off')
      }
    }
    
    const setMainMode = mode => {
      if (int.mode !== mode) { //: only if changed
        void (exitBypassMode(), exitRecordMode(), exitSamplerMode())
        mode === 'modeBypass' && enterBypassMode()
        mode === 'modeRecord' && enterRecordMode()
        mode === 'modeSampler' && enterSamplerMode()
      }
    }

    fx.cmdProc = (fire, mode) => {
      if (fire === 'fire') {
        const action = {
          modeBypass: _ => setMainMode(mode),
          modeRecord: _ => setMainMode(mode),
          modeSampler: _ => setMainMode(mode),
          trimLeft: _ => int.trimmable && trim.left++,
          trimRight: _ => int.trimmable && trim.right++,
          trimReset: _ => trim.left = trim.right = 0,
          samplePlay: _ => int.mode === 'modeSampler' && playOnce(),
          sampleLoop: _ => int.mode === 'modeSampler' && startPlayLoop(),
          sampleStop: _ => int.mode === 'modeSampler' && endPlayLoop(),
          useScriptProc: _ => int.mode !== 'modeRecord' && setScriptProcMode(true),
          useWorklet: _ => int.mode !== 'modeRecord' && setScriptProcMode(false)
        }[mode]
        void action?.()
        fx.recalcMarkers()
      }
    }
    
    const playOnce = _ => {
      if (int.mode === 'modeSampler') {
        int.singleSource = waCtx.createBufferSource()
        int.singleSource.buffer = int.audioBuffer
        int.singleSource.connect(fx.output)
        int.singleSource.detune.value = int.detune
        int.singleSource.start(0, final.startRel, final.len)
      }
    }
    const endPlayOnce = _ => int.singleSource?.stop()
    
    const startPlayLoop = _ => {
      if (int.mode === 'modeSampler' && !int.isLoopPlaying) {
        int.isLoopPlaying = true
        int.source = waCtx.createBufferSource()
        int.source.buffer = int.audioBuffer
        int.source.connect(fx.output)
        int.source.loop = true
        int.source.loopStart = final.startRel
        int.source.loopEnd = final.endRel
        int.source.start(0, final.startRel)
        fx.setValue('sampleLoop', 'active.ledon')
      } else {
        endPlayLoop()
        startPlayLoop() //: so this is a 'loopRestart'
      }
    }
    const endPlayLoop = _ => {
      void (int.isLoopPlaying && int.source?.stop())
      int.isLoopPlaying = false
      fx.setValue('sampleLoop', 'on')
    }
    
    fx.setTone = tone => {      
      const val = 'abcdefghijklmnopqrstuvwxy'.indexOf(tone[1])
      int.tone = tone
      int.inOff = val
      int.detune = ((val - 12) / 12 || 0) * 100
      int.source && (int.source.detune.value = int.detune)
      int.isLoopPlaying || playOnce()
    }
    
    post(initFx)
  }
  registerFxType('fx_sampler', samplerEx)
})
