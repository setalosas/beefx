/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {nop, isArr, undef, getRnd, getRndFloat, clamp} = Corelib
const {wassert, weject} = Corelib.Debug
const {createPerfTimer, startEndThrottle, post, schedule} = Corelib.Tardis
const {max, pow, round, floor, log2, tanh, abs, min, sign, sqrt} = Math

onWaapiReady.then(waCtx => {
  const {registerFxType, connectArr, concatAudioBuffers} = BeeFX(waCtx)
  
  const drawWaveOverview = fx => {
    const {int, atm} = fx
    const {cc, ccext, width, height, osc, freqData} = int
    const {sampleRate} = waCtx
    
    const zoom = max(128, pow(2, floor(1 + log2(int.aubLength / width))))
    const startx = int.loopStartR * 44100 / zoom
    const endx = int.loopEndR * 44100 / zoom
    
    const drawGrid = _ => {
      cc.clearRect(0, 0, width, height)
      cc.font = '32px roboto condensed'
      cc.lineWidth = 3
      cc.strokeStyle = 'hsla(200, 70%, 55%, 0.6)'
      ccext.drawLine(startx, 0, startx, height)
      cc.strokeStyle = 'hsla(100, 70%, 55%, 0.6)'
      ccext.drawLine(endx, 0, endx, height)
    }
    
    const drawWave = _ => {
      const timer = Corelib.Tardis.createPerfTimer()
      timer.mark('getdata')
      const scale = height / 1.2
      const centerY = height / 2
      const maxFrame = int.aubLength
      const data = int.audioBuffer.getChannelData(0)
      
      cc.lineWidth = 2.5
      cc.strokeStyle = 'hsl(20, 100%, 80%)' // strokeStyle
      cc.beginPath()
      cc.moveTo(0, centerY - data[0] * scale)
      
      for (let frameIx = 0, x = 0; frameIx < maxFrame && x < width; x++, frameIx += zoom) {
        const magnitude = data[frameIx] * scale
        cc.lineTo(x, centerY - magnitude)
      }
      timer.mark('calc')
      cc.stroke()
    }
    
    if (cc) {
      drawGrid()
      drawWave()
    }
  }

  const samplerFx = { //8#aa8 -------loop -------
    def: {
      log: {defVal: '-', type: 'info'}, //+ ez mi?
      wave: {type: 'graph'},
      startMod: {defVal: 0, min: -1, max: 3, unit: 's'},
      endMod: {defVal: 0, min: -2, max: .1, unit: 's'},
      rec: {defVal: 'active', type: 'cmd'},
      start: {defVal: 'off', type: 'cmd'},
      end: {defVal: 'off', type: 'cmd'},
      play: {defVal: 'off', type: 'cmd'},
      pause: {defVal: 'off', type: 'cmd'},
      release: {defVal: 'off', type: 'cmd'},
      piano: {defVal: 'Cm', type: 'piano'}
    },
    name: 'Sampler',
    graphs: {
      wave: {
        graphType: 'custom',
        onInit: ({cc, width, height, fx, ccext}) => fx.int.capture({cc, width, height, ccext})
      }
    }
  }

  samplerFx.setValue = (fx, key, value, {atm, int} = fx) => ({
    log: nop,
    startMod: _ => fx.modChanged(),
    endMod: _ => fx.modChanged(),
    rec: _ => fx.setMode(value, 'rec'),
    start: _ => fx.setMode(value, 'start'),
    end: _ => fx.setMode(value, 'end'),
    play: _ => fx.setMode(value, 'play'),
    pause: _ => fx.setMode(value, 'pause'),
    release: _ => fx.setMode(value, 'release'),
    piano: _ => fx.setTone(value)
  }[key])

  samplerFx.construct = (fx, pars, {int, atm} = fx) => {
    int.frames = 4096
    int.loopStart = 0
    int.loopEnd = 0
    int.loopLength = 0
    int.loopStartR = 0
    int.loopEndR = 0
    int.loopLengthR = 0
    int.mode = 'idle' //: idle -> rec -> start -> end -> play[] -> release
    int.sampleStored = false
    int.scriptNode = waCtx.createScriptProcessor(int.frames, 1, 1) //: audioworklet!
    connectArr(fx.start, int.scriptNode, waCtx.destination)
    fx.start.connect(fx.output)
    
    const updateLog = _ => {
      const round3 = prop => prop + ': ' + round(int[prop] * 1000) / 1000
      fx.setValue('log', [
        `${round3('loopStart')} ${round3('loopEnd')} ${round3('loopLength')}`
      ].join('<br>'))
    }
    const buttonsOff = _ => {
      fx.setValue('rec', 'off')
      fx.setValue('start', 'off')
      fx.setValue('end', 'off')
      fx.setValue('play', 'off')
      fx.setValue('release', 'off')
    }
    fx.setMode = (fire, mode) => {
      if (fire === 'fire') {
        const action = {
          rec: _ => { //+ kene recjelzes es eldobni ha 2mp eltelt start nelkul, az azelottieket
            if (int.mode === 'idle') { //: egy timeout is kell ide, 10 sec kb 1.7MB
              int.mode = 'rec'
              int.recAt = waCtx.currentTime
              startRecording()
              buttonsOff()
              fx.setValue('rec', 'alert') //kell egy disabled allapot
              fx.setValue('start', 'active')
            }
          },
          start: _ => {
            if (int.mode === 'rec') {
              int.startAt = waCtx.currentTime
              int.loopStart = int.startAt - int.recAt //+ ez nem kell ide
              recalcInterval()
              int.hasStarted = true
              buttonsOff()
              fx.setValue('end', 'active')
            }
          },
          end: _ => {
            if (int.hasStarted) {
              int.hasStarted = false
              int.isLoopReady = true
              int.endAt = waCtx.currentTime
              int.loopEnd = int.endAt - int.recAt //+ ez nem kell ide
              recalcInterval()
              endRecording()
              enterSamplerMode()
              buttonsOff()
              fx.setValue('play', 'active')
              fx.setValue('release', 'active')
            }
          },
          play: _ => {
            if (int.isLoopReady && !int.isPlaying) {
              int.isPlaying = true
              startPlayLoop()
              buttonsOff()
              fx.setValue('release', 'active')
              fx.setValue('pause', 'active')
            }
          },
          pause: _ => {
            if (int.isLoopReady && int.isPlaying) {
              int.isPlaying = false
              endPlayLoop()
              buttonsOff()
              fx.setValue('release', 'active')
              fx.setValue('play', 'active')
            }
          },
          release: _ => {
            int.mode = 'idle'
            endRecording()
            buttonsOff()
            int.hasStarted = false
            int.isLoopReady = false
            int.isPlaying = false
            endPlayLoop()
            exitSamplerMode()
            fx.setValue('rec', 'active')
          }
        }[mode]
        void action?.()
      }
      updateLog()
    }
    
    const recalcInterval = _ => {
      int.loopStartR = int.loopStart + atm.startMod
      int.loopEndR = int.loopEnd + atm.endMod
      int.loopLengthR = int.loopEndR - int.loopStartR
      drawWaveOverview(fx)
    }
    
    fx.modChanged = recalcInterval
    
    const startRecording = _ => {
      delete int.audioBuffer
      weject(int.isLoopReady)
      int.aubLength = 0
      
      int.scriptNode.onaudioprocess = ({inputBuffer}) => {
        wassert(int.mode === 'rec')
        int.audioBuffer = concatAudioBuffers(int.audioBuffer, inputBuffer)
        int.aubLength += int.frames
        drawWaveOverview(fx)
        updateLog()
      }
    }
        
    const endRecording = _ => {
      int.scriptNode.onaudioprocess = null
    }

    const playOnce = _ => {
      if (!int.isLoopReady || int.isPlaying) {
        return
      }
      recalcInterval()
      const singleSource = waCtx.createBufferSource()
      singleSource.buffer = int.audioBuffer
      singleSource.connect(fx.output)
      singleSource.detune.value = int.detune
      singleSource.start(0, int.loopStartR, int.loopLengthR)
    }
    
    const startPlayLoop = _ => {
      recalcInterval()
      int.source = waCtx.createBufferSource()
      int.source.buffer = int.audioBuffer
      int.source.connect(fx.output)
      int.source.loop = true
      int.source.loopStart = int.loopStartR
      int.source.loopEnd = int.loopEndR
      int.source.start(0, int.loopStartR)
    }
    const endPlayLoop = _ => {
      void int.source?.stop()
    }
    
    const enterSamplerMode = _ => {
      fx.start.disconnect(fx.output)
    }
    const exitSamplerMode = _ => {
      fx.start.connect(fx.output)
    }
    
    fx.setTone = tone => {      
      const val = 'abcdefghijklmnopqrstuvwxy'.indexOf(tone[1])
      wassert(val > -1)
      int.tone = tone
      int.inOff = val
      int.detune = ((val - 12) / 12 || 0) * 100
      int.source && (int.source.detune.value = int.detune)
      playOnce()
    }
  }
  registerFxType('fx_sampler', samplerFx)
})
