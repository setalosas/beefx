/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {nop, isArr, isStr, getRnd, getRndFloat, clamp} = Corelib
const {wassert} = Corelib.Debug
const {createPerfTimer, startEndThrottle, post, schedule} = Corelib.Tardis
const {round, max, pow, log2, floor} = Math
const {fetch, AudioWorkletNode} = window

onWaapiReady.then(async waCtx => {
  const {registerFxType, newFx, connectArr, getJsPath} = BeeFX(waCtx)
  
  const auWorkletPromise = waCtx.audioWorklet.addModule(getJsPath('beefx/ext/recorderWorker.js'))

  auWorkletPromise
    .then(_ => console.log(`Recorder audioWorklet loaded.`))
    .catch(err => {
      console.error(`Recorder audioWorklet failed to load.`, err)
      //debugger
    })
    
  const redrawWave = fx => {
    const {int, atm} = fx
    const {cc, ccext, width, height} = int
    const {sampleRate} = waCtx
    
    const {toSec: maxSec} = int.lastGraph
    
    if (!maxSec) {
      return
    }

    //const zoom = max(128, pow(2, floor(1 + log2(int.nextGraph / width))))
    // 100 .166 
    // 200 .33
    // 300 .5
    // 600 1 
    // 1200 2
    // compactzoom = 128
    const {compactZoom} = int.workerParams
    //sampleRate
    const compactFramesPerSec = sampleRate / compactZoom
    const compactFramesMax = maxSec * compactFramesPerSec
    const compactFramesMaxDeviance = compactFramesMax - int.nextGraph
    const idealCompactFrameScale = compactFramesMax / width
    const xFrameScale = idealCompactFrameScale //  * frame => pix
    
    //const compactLen = max(int.nextGraph, width / 2) // 300.....compactframes
    const zoom = clamp(int.nextGraph / width, .5, 1024 / compactZoom)
    // 44000 -> 44000 / zoom pix = 1s /seczoom pix
    // compframe = frame / compactzoom
    // compframe / zoom = pix
    // pix = compframe / zoom
    // pix = frame / compactzoom / zoom
    // pix = sec * 44k / compactzzom / zoom
    const secScale = sampleRate / compactZoom / zoom
    // 
    // sec * 44100 / zoom = pix
    //const secScale = compactLen * compactZoom / width // maxsec * compactzoom / actmaxframe
    
    //console.log({zoom, secScale})
    
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
      cc.strokeStyle = 'hsla(200, 70%, 55%, 0.6)'
      for (let sec = 0; sec < maxSec + 1; sec++) {
        const secX = sec * secScale
        ccext.drawLine(secX, 0, secX, height)
      }
      const mem = round(maxSec * sampleRate * 2 * 2 / 1024 / 1024 * 10) / 10
      ccext.setTextStyle('#aaf', 'right')
      cc.fillText(`Length: ${maxSec.toFixed(1)}s`, width - 12, height - 50)
      cc.fillText(`Mem: ${mem}MB`, width - 12, height - 18)
      drawRecIndicator()
    }
    
    const drawWave = _ => {
      const timer = Corelib.Tardis.createPerfTimer()
      timer.mark('getdata')
      const scale = height / 1.2
      const centerY = height / 2
      const maxFrame = int.nextGraph
      const data = int.graphData
      
      cc.lineWidth = 2.5
      cc.strokeStyle = 'hsl(30, 100%, 80%)' // strokeStyle
      cc.beginPath()
      cc.moveTo(0, centerY - data[0] * scale)
      
      let frameIx = width * zoom < int.nextGraph ? int.nextGraph - width * zoom : 0
      
      for (let x = 0; frameIx < maxFrame && x < width; x++, frameIx += zoom) {
        const magnitude = data[round(frameIx)] * scale
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

  const recorderExt = {
    def: {
      log: {defVal: '-', type: 'info'}, //+ ez mi?
      wave: {type: 'graph'},
      rec: {defVal: 'active', type: 'cmd'},
      stop: {defVal: 'off', type: 'cmd'},
      resume: {defVal: 'off', type: 'cmd'},
      play: {defVal: 'off', type: 'cmd'},
      reset: {defVal: 'off', type: 'cmd'},
      zoom: {defVal: 3, min: 2, max: 4, unit: '2^', subType: 'int'}, //: for zoom test only
      limit: {defVal: 1, min: 0, max: 2, unit: '2^', subType: 'int'} //: for zoom test only
    },
    promises: [auWorkletPromise],
    name: `Dev Recorder`,
    graphs: {
      wave: {
        graphType: 'custom',
        onInit: ({cc, width, height, fx, ccext}) => fx.int.capture({cc, width, height, ccext})
      }
    }
  }

  recorderExt.setValue = (fx, key, value, {int} = fx) => ({
    log: nop,
    wave: nop,
    rec: _ => fx.setMode(value, 'rec'),
    stop: _ => fx.setMode(value, 'stop'),
    resume: _ => fx.setMode(value, 'resume'),
    play: _ => fx.setMode(value, 'play'),
    reset: _ => fx.setMode(value, 'reset'),
    zoom: _ => fx.sendWorkerParams(),
    limit: _ => fx.sendWorkerParams()
  }[key])
  
  recorderExt.construct = (fx, {initial}, {int, atm, exo} = fx) => {
    const updateLog = _ => {
      const fix2 = val => isStr(val) ? val : (round(val * 100) / 100)
      const fix3 = val => isStr(val) ? val : (round(val * 1000) / 1000)
      const getProp = obj => prop => obj[prop] || '-'
      const getW = getProp(int.workerParams)
      const getG = getProp(int.lastGraph)
      const getWL3 = prop => prop + ': ' + fix3(getW(prop))
      
      fx.setValue('log', [
      `Got: ${int.nextGraph || '-'} ${getWL3('compactZoom')} ${getWL3('frameLimit')}`,
      `Last frames: ${getG('fromFrame')} / ${getG('toFrame')}`
      ].join('<br>'))
    }
    fx.sendWorkerParams = _ => {
      const compactZoom = 64 * pow(2, atm.zoom)
      const frameLimit = 640 * pow(2, atm.limit)
      int.workerParams = {compactZoom, frameLimit, transferCompact: true, transferAudio: false}
      int.recorder.port.postMessage({op: 'params', params: int.workerParams})
      updateLog()
    }
    int.recorder = new AudioWorkletNode(waCtx, 'Recorder', {outputChannelCount: [2]})
    int.lastGraph = {}
    fx.sendWorkerParams()

    const maxGraphData = 65536
    
    const startRec = _ => {
      int.graphData = new Float32Array(maxGraphData)
      int.nextGraph = 0
      int.inRec = true
      int.recorder.port.postMessage({op: 'rec'})
      console.log('🔴 Recorder start!')
      redrawWave(fx)
      updateLog()
    }
    const stopRec = _ => {
      int.inRec = false
      int.recorder.port.postMessage({op: 'stop'})
      console.log('⬛️ Recorder stop!')
    }
    
    const addToGraph = data => {
      if (int.nextGraph + data.length > maxGraphData) {
        console.warn('Graph data too big!', {nextGraph: int.nextGraph, len: data.length})
        stopRec()
      } else {
        wassert(int.graphData)
        int.graphData.set(data, int.nextGraph)
        int.nextGraph += data.length
        redrawWave(fx)
      }
      updateLog()
    }
    const addToAudio = data => {
    }
    
    int.recorder.port.onmessage = event => {
      const {data} = event
      if (data.op) {
        if (data.op === 'compact') {
          int.lastGraph = {
            channels: data.channels,
            frames: data.frames,
            toSec: data.frames / waCtx.sampleRate
          }
          addToGraph(data.up)
        } else {
          console.warn('Recorder got unknown op from worklet:', data.op)
        }
      } else if (data instanceof ArrayBuffer || data instanceof Float32Array) {
        if (int.lastEventOp === 'preCompact') {
        }
        if (int.lastEventOp === 'preAudio') {
          addToAudio(data)
        }
      } else {
        console.warn('Recorder got invalid message from worklet:', event)
      }
      int.lastEventOp = event.data.op || ''
    }

    fx.start.connect(int.recorder)
    fx.start.connect(fx.output)
    
    fx.setMode = (fire, mode) => {
      if (fire === 'fire') {
        if (mode === 'rec') { //+ should be resume
          startRec()
        } else if (mode === 'stop') {
          stopRec()
        } else if (mode === 'reset') {
          int.nextGraph = 0
          redrawWave(fx)
          updateLog()
        }
      }
    }
  }

  registerFxType('fx_recorder', recorderExt)
})
