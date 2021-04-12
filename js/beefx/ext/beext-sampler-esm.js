/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {nop, isArr, undef, clamp} = Corelib
const {wassert, weject} = Corelib.Debug
const {createPerfTimer, post, schedule} = Corelib.Tardis
const {max, pow, round, floor, log2, tanh, abs, min, sign, sqrt} = Math
const {fetch, AudioWorkletNode} = window

onWaapiReady.then(waCtx => {
  const {registerFxType, connectArr, concatAudioBuffers} = BeeFX(waCtx)
  
  const drawWaveOverview = fx => {
    const {int, atm} = fx
    const {cc, ccext, width, height} = int
    const {graphZoom: zoom, graphStartRel, graphEndRel} = int
    const {sampleStartR, sampleEndR, recLength} = int
    const {sampleRate} = waCtx
    
    const sec2Pix = sec => (sec - graphStartRel) * sampleRate / zoom
    const startx = sec2Pix(sampleStartR)
    const endx = sec2Pix(sampleEndR === sampleStartR ? recLength - .2 : sampleEndR)
    
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
      cc.lineWidth = 3
      cc.strokeStyle = 'hsla(200, 70%, 55%, 0.8)'
      for (let sec = floor(graphStartRel); sec < floor(graphEndRel) + 1; sec++) {
        const secX = sec2Pix(sec)
        ccext.drawLine(secX, 0, secX, height)
      }
      cc.lineWidth = 5
      cc.strokeStyle = 'hsla(70, 70%, 65%, 0.8)'
      ccext.drawLine(startx, 0, startx, height)
      cc.strokeStyle = 'hsla(330, 70%, 65%, 0.8)'
      ccext.drawLine(endx, 0, endx, height)
      drawRecIndicator()
    }
    
    const drawWave = _ => {
      const timer = Corelib.Tardis.createPerfTimer()
      timer.mark('getdata')
      const scale = height / 2
      const centerY = height / 2
      const data = int.audioBuffer.getChannelData(0)
      
      cc.lineWidth = 2.5
      cc.strokeStyle = 'hsl(35, 100%, 80%)' // strokeStyle
      cc.beginPath()
      
      let frameIx = graphStartRel * sampleRate
      const maxFrame = graphEndRel * sampleRate
      
      cc.moveTo(0, centerY - data[round(frameIx)] * scale)

      for (let x = 0; frameIx < maxFrame && x < width; x++, frameIx += zoom) {
        const magnitude = data[round(frameIx)] * scale
        cc.lineTo(x, centerY - magnitude)
      }
      timer.mark('calc')
      cc.stroke()
    }
    
    if (cc) {
      if (int.audioBuffer) {
        drawGrid()
        drawWave()
      }
    }
  }

  const samplerEx = { //8#aa8 -------loop -------
    def: {
      log: {defVal: '-', type: 'info'},
      modeBypass: {defVal: 'active.ledon', type: 'cmd', subType: 'led', color: 140, name: 'Bypass'},
      modeRecord: {defVal: 'on', type: 'cmd', subType: 'led', color: 0, name: 'Record'},
      modeSampler: {defVal: 'off', type: 'cmd', subType: 'led', color: 180, name: 'Sampler'},
      useScriptProc: {defVal: 'on', type: 'cmd', name: 'scriptProcessor (slow)'},
      useWorklet: {defVal: 'off', type: 'cmd', name: 'audioWorklet (slow)'},
      wave: {type: 'graph'},
      recStart: {defVal: 'on', type: 'cmd'},
      recEnd: {defVal: 'on', type: 'cmd'},
      startMod: {defVal: 0, min: -1, max: 3, unit: 's'},
      endMod: {defVal: 0, min: -3, max: .1, unit: 's'},
      samplePlay: {defVal: 'off', type: 'cmd', name: 'Play'},
      sampleLoop: {defVal: 'off', type: 'cmd', subType: 'led', color: 80, name: 'Loop sample'},
      sampleStop: {defVal: 'off', type: 'cmd', name: 'Stop loop'},
      piano: {defVal: 'Cm', type: 'piano'}
    },
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
    startMod: _ => fx.recalcEverything(),
    endMod: _ => fx.recalcEverything(),
    piano: _ => fx.setTone(value)
  }[key] || (_ => fx.cmdProc(value, key)))

  samplerEx.construct = (fx, pars, {int, atm} = fx) => {
    const initFx = _ => {
      int.useScriptProcessor = false
      int.scriptProcessorFrames = 4096
      int.muteInputOn = true
      muteInput(false)
      setMainMode('modeBypass')
      setScriptProcMode(int.useScriptProcessor)
      
      int.recStartAt = 0 //: for the last recording if there was any
      int.recEndAt = 0
      int.recLength = 0
      int.sampleStartAt = 0
      int.sampleEndAt = 0
      int.sampleStartRel = 0
      int.sampleEndRel = 0
      int.sampleLength = 0
      int.maxRunningLength = 6
      
      int.isLoopPlaying = false
      int.aubLength = 0
      int.sampleStored = false
    }
    const muteInput = on => {
      if (int.muteInputOn !== on) {
        int.muteInputOn = on
        on ? fx.start.disconnect(fx.output) : fx.start.connect(fx.output)
      }
    }

    fx.recalcEverything = _ => {
      int.recLength = int.recEndAt - int.recStartAt
      int.sampleStartRel = int.sampleStartAt - int.recStartAt
      int.sampleEndRel = int.sampleEndAt ? int.sampleEndAt - int.recStartAt : 0
      int.sampleLength = int.sampleEndRel ? int.sampleEndRel - int.sampleStartRel : 0

      int.graphStartRel = int.sampleStartRel
        ? max(int.sampleStartRel - 1, 0)
        : max(int.recLength - int.maxRunningLength, 0)

      int.graphEndRel = int.recLength
      int.graphLength = int.graphEndRel - int.graphStartRel  
      int.graphFrames = int.graphLength * waCtx.sampleRate
      int.graphZoom = int.graphFrames / int.width
      
      int.sampleStartR = clamp(int.sampleStartRel + atm.startMod, 0, int.recLength)
      int.sampleEndR = clamp(int.sampleEndRel + atm.endMod, int.sampleStartR, int.recLength)
      int.sampleLengthR = int.sampleEndR - int.sampleStartR
      drawWaveOverview(fx)
      updateLog()
    }
    
    const setScriptProcMode = useScriptProcessor => {
      int.useScriptProcessor = useScriptProcessor
      fx.setValue('useWorklet', useScriptProcessor ? 'off' : 'on')
      fx.setValue('useScriptProc', useScriptProcessor ? 'on' : 'off')
    }
      
    const updateLog = _ => {
      const fix3 = prop => round(int[prop] * 1000) / 1000
      
      if (!int.recLength) {
        fx.setValue('log', 'No sample recorded.')
      } else {
        const recTime = `Rec length: ${int.recLength.toFixed(3)}`
        const sampleTime = `Sample: ${fix3('sampleStartR')}-${fix3('sampleEndR')}`
        
        fx.setValue('log', [
        `${recTime} ${sampleTime}`
        ].join('<br>'))
      }
    }
    
    fx.sendWorkerParams = _ => {
      const frameLimit = 1280
      int.workerParams = {frameLimit, transferCompact: false, transferAudio: true}
      int.recorder.port.postMessage({op: 'params', params: int.workerParams})
      updateLog()
    }
    
    const setupRecorder = _ => { //: the output of both is int.audioBuffer / int.aubLength
      if (int.useScriptProcessor) { //8#a43 Recorder SpriptProcessorNode. Fast, simple & deprecated.
        int.scriptNode = int.scriptNode || 
          waCtx.createScriptProcessor(int.scriptProcessorFrames, 1, 1)
          
          int.scriptNode.onaudioprocess = ({inputBuffer}) => {
            wassert(int.mode === 'modeRecord')
            int.audioBuffer = concatAudioBuffers(int.audioBuffer, inputBuffer)
            int.aubLength += int.scriptProcessorFrames
            int.recEndAt = waCtx.currentTime 
            fx.recalcEverything()
          }

        connectArr(fx.start, int.scriptNode, waCtx.destination)
      } else {            //8#43a Recorder AudioWorklet. Slow, complex & unstable.
        //: recorder already loaded the worklet or this wont work
        int.recorder = int.recorder || 
          new AudioWorkletNode(waCtx, 'Recorder', {outputChannelCount: [2]})
          
        int.recorder.port.onmessage = event => {
          const {data} = event
          if (data.op) {
            if (data.op === 'audio') {
              const {frames, channels, channelData} = data
              int.last = {frames, channels}
              const transBuff = waCtx.createBuffer(channels, frames, waCtx.sampleRate)
              
              for (let ch = 0; ch < int.last.channels; ch++) {
                transBuff.copyToChannel(channelData[ch], ch , 0)
              }
              int.audioBuffer = concatAudioBuffers(int.audioBuffer, transBuff)
              int.aubLength += int.last.frames
              int.recEndAt = waCtx.currentTime
              fx.recalcEverything()
            }
          } else {
            console.log('Recorder got invalid message from worklet:', event)
          }
          int.lastEventOp = event.data.op || ''
        }
        
        fx.sendWorkerParams()
        fx.start.connect(int.recorder)
        int.recorder.port.postMessage({op: 'rec'})
      }
    }
    const shutdownRecorder = _ => {
      if (int.useScriptProcessor) {
        int.scriptNode.onaudioprocess = null
        delete int.scriptNode
      } else {
        void int.recorder?.port.postMessage({op: 'stop'})
        delete int.recorder
      }
    }
    
    const updateMode = mode => {
      int.mode = mode
      fx.setValue('modeBypass', 'on.ledoff')
      fx.setValue('modeRecord', 'on.ledoff')
      checkForValidSample()
        ? fx.setValue('modeSampler', 'on.ledoff')
        : fx.setValue('modeSampler', 'on.ledoff') // this could be off
      fx.setValue(mode, 'active.ledon')
    }
    
    const enterBypassMode = _ => {
      if (int.mode !== 'modeBypass') {
        updateMode('modeBypass')
        console.log('enter modeBypass')
      }
    }
    const exitBypassMode = _ => {
      if (int.mode === 'modeBypass') {
        console.log('exit modeBypass')
      }
    }

    const enterRecordMode = _ => {
      if (int.mode !== 'modeRecord') {
        delete int.audioBuffer
        weject(int.isLoopReady)
        int.aubLength = 0
        setupRecorder()
        fx.setValue('startMod', 0)
        fx.setValue('endMod', 0)
        int.sampleEndAt = 0
        int.sampleStartAt = int.recStartAt = int.recEndAt = waCtx.currentTime
        fx.setValue('recStart', 'active')
        fx.setValue('recEnd', 'off')
        updateMode('modeRecord')
        console.log('enter modeRecord')
      }
    }
    const exitRecordMode = _ => {
      if (int.mode === 'modeRecord') {
        shutdownRecorder()
        //int.recEndAt = waCtx.currentTime //: ez inkabb auto az onprocessben es akkor itt nem kell, de mindig no
        fx.setValue('recStart', 'off')
        fx.setValue('recEnd', 'off')
        console.log('exit modeRecord')
      }
    }
    
    const enterSamplerMode = _ => { //+ no need for check validsample ? already checked
      if (int.mode !== 'modeSampler') {
        muteInput(true)
        fx.setValue('samplePlay', 'on')
        fx.setValue('sampleLoop', 'on')
        fx.setValue('sampleStop', 'on')
        updateMode('modeSampler')
        console.log('enter modeSampler')
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
        console.log('exit modeSampler')
      }
    }
    const checkForValidSample = _ => !!int.sampleLength
    
    const setMainMode = mode => {
      if (int.mode !== mode) { //: only if changed
        if (mode === 'modeBypass') { //: always valid
          exitRecordMode()
          exitSamplerMode()
          enterBypassMode()
        } else if (mode === 'modeRecord') {
          exitBypassMode()
          exitSamplerMode()
          enterRecordMode()
        } else if (mode === 'modeSampler') {
          if (checkForValidSample()) {
            exitBypassMode()
            exitRecordMode()
            enterSamplerMode()
          } else if (int.mode === 'modeRecord') {
            fx.cmdProc('fire', 'recEnd')
          }
        }
      }
    }

    fx.cmdProc = (fire, mode) => {
      if (fire === 'fire') {
        const action = {
          modeBypass: _ => setMainMode(mode),
          modeRecord: _ => setMainMode(mode),
          modeSampler: _ => setMainMode(mode),
          recStart: _ => {
            if (int.mode === 'modeRecord') {
              int.sampleStartAt = waCtx.currentTime
              fx.setValue('recStart', 'on')
              fx.setValue('recEnd', 'active')
              fx.recalcEverything()
            }
          },
          recEnd: _ => {
            if (int.mode === 'modeRecord') {
              int.sampleEndAt = waCtx.currentTime
              fx.recalcEverything()
              //fx.setValue('recEnd', 'off')
              schedule(200).then(_ => setMainMode('modeSampler'))
            }
          },
          samplePlay: _ => int.mode === 'modeSampler' && playOnce(),
          sampleLoop: _ => int.mode === 'modeSampler' && startPlayLoop(),
          sampleStop: _ => int.mode === 'modeSampler' && endPlayLoop(),
          useScriptProc: _ => int.mode !== 'modeRecord' && setScriptProcMode(true),
          useWorklet: _ => int.mode !== 'modeRecord' && setScriptProcMode(false)
        }[mode]
        void action?.()
      }
      updateLog()
    }
    
    const playOnce = _ => {
      if (int.mode === 'modeSampler') {
        int.singleSource = waCtx.createBufferSource()
        int.singleSource.buffer = int.audioBuffer
        int.singleSource.connect(fx.output)
        int.singleSource.detune.value = int.detune
        int.singleSource.start(0, int.sampleStartR, int.sampleLengthR)
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
        int.source.loopStart = int.sampleStartR
        int.source.loopEnd = int.sampleEndR
        int.source.start(0, int.sampleStartR)
        fx.setValue('sampleLoop', 'active.ledon')
      } else {
        endPlayLoop()
      }
    }
    const endPlayLoop = _ => {
      void (int.isLoopPlaying && int.source?.stop())
      int.isLoopPlaying = false
      fx.setValue('sampleLoop', 'on')
    }
    
    fx.setTone = tone => {      
      const val = 'abcdefghijklmnopqrstuvwxy'.indexOf(tone[1])
      wassert(val > -1)
      int.tone = tone
      int.inOff = val
      int.detune = ((val - 12) / 12 || 0) * 100
      int.source && (int.source.detune.value = int.detune)
      int.isLoopPlaying || playOnce()
    }
    
    initFx()
  }
  registerFxType('fx_sampler', samplerEx)
})
