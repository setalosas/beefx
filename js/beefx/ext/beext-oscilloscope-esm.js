/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {nop, no, yes, undef, isArr, getRnd, getRndFloat} = Corelib
const {wassert} = Corelib.Debug

onWaapiReady.then(waCtx => {
  const {connectArr, registerFxType, newFx} = BeeFX(waCtx)
  
  const logOn = false
  const logPerfOn = false
  const clog = (...args) => logOn && console.log(...args)  
  const plog = (...args) => logPerfOn && console.log(...args)
  
  const findZeroCrossing = (data, width, sensitivity) => {
    const min = (sensitivity - 0) / 100 * 128 + 128
    let i = 0
    let last = -1
    while (i < width && (data[i] > 128)) {
      i++
    }
    if (i >= width) {
      return 0
    }
    let s
    while (i < width && ((s = data[i]) < min)) {
      last = s >= 128 
        ? last === -1
          ? i 
          : last 
        : -1
      i++
    }
    last = last < 0 ? i : last
    return i === width ? 0 : last
  }
  
  const drawFrame = fx => {
    const {int, atm} = fx
    const {cc, ccext, width, height, osc, freqData} = int
    const {sensitivity} = atm
    const {sampleRate} = waCtx
    
    const drawGrid = _ => {
      cc.clearRect(0, 0, width, height)
      cc.font = '32px roboto condensed'
      cc.lineWidth = 3
      cc.strokeStyle = 'hsla(200, 70%, 55%, 0.1)'
      cc.beginPath()
      
      for (let i = 50; i < width; i += 50) {
        cc.moveTo(i, 0)
        cc.lineTo(i, height)
      }
      for (let j = 0; j < height; j += 50) {
        cc.moveTo(0, j)
        cc.lineTo(width, j)
      }
      cc.stroke()
    }
    
    const drawXAxis = _ => {
      cc.lineWidth = 2 * 2
      cc.strokeStyle = 'rgba(60,180,220,0.22)'
      cc.beginPath()
      cc.moveTo(0, height / 2)
      cc.lineTo(width, height / 2)
      cc.stroke()
    }
    
    const drawWaveform = _ => {
      const timer = Corelib.Tardis.createPerfTimer()
      const {zoom} = atm
      osc.getByteTimeDomainData(freqData)
      timer.mark('getdata')
      const findingZero = zoom > .2
      const frameIxFromZero = findingZero ? findZeroCrossing(freqData, width, sensitivity) : 0
      const flen = freqData.length
      const scale = height / 256 / 1.2
      const centerY = height / 2
      
      cc.lineWidth = 2.5 * 2
      cc.strokeStyle = 'hsl(0, 100%, 80%)' // strokeStyle
      cc.shadowColor = 'hsl(0, 100%, 70%)'
      cc.shadowBlur = 8
      cc.shadowOffsetX = 4
      cc.shadowOffsetY = 4
      cc.beginPath()
      cc.moveTo(0, centerY - (128 - freqData[frameIxFromZero]) * scale)
      
      // 7 12 17 22 27 32
      let version = parseInt(fx.zholger)
      if (version < 15) {
        version = '1.6'
      } else if (version < 30) {
        version = '1.2'
      } else {
        version = '.8'
      }
      const step = parseFloat(version)
        
      let j = 0 //: for test/debug
      let frameIx = frameIxFromZero
      let prevj = -1
      
      for (; frameIx < flen && j < width; frameIx++, j += zoom) {
        if (j - prevj > step) {
          const magnitude = (128 - freqData[frameIx]) * scale
          cc.lineTo(j, centerY - magnitude)
          prevj = j
        }
      }
      timer.mark('calc')
      cc.stroke()
      
      const txtx = width - 12
      const used = Math.round(100 * (frameIx - frameIxFromZero) / flen) //+ ez nem jo
      const ffts = int.fftSize + (int.fftSize === 32768 ? ' (max)' : '')
      const msec = Math.round(1000 * (frameIx - frameIxFromZero) / sampleRate)
      ccext.setTextStyle('#aaa', 'right')
      cc.fillText(`FFT: ${used}% of ${ffts} used`, txtx, 40)
      cc.fillText(`${msec}ms${findingZero ? ' Z' : ''}`, txtx, 80)

      if (!findingZero && j < width) {
        ccext.setTextStyle('hsl(180, 100%, 75%)', 'right')
        cc.fillText('FFT window too short!', txtx, height - 20)
      }
      
      timer.mark('stroke&text')
      const sum = timer.sum()
      if (logPerfOn) {
        int.prof.push(sum.dur.sum)
        if (version) {
          if (int.prof.length % 410 === 405) {
            const last = int.prof.slice(-400).map(a => parseFloat(a))
            let agg = 0
            for (let i = 0; i < 400; i++) {
              agg += last[i]
            }
            agg = Math.round(agg * 2.5)
            plog(`##OSCP ${version} avg: ${agg}ms **** `, int.prof.slice(-20).join(' / '))
          }
        }
      }
      //parseInt(fx.zholger) === 7 && console.log(timer.summary())
    }
    if (cc) {
      //const profile = startProfile()
      //if (int.drawCnt++ % 2) {
        drawGrid()
        drawXAxis()
        drawWaveform()
      //}
      //profile.stop(fx, 'draw')
    }
    int.isRAFOn && window.requestAnimationFrame(_ => drawFrame(fx))
  }

  const oscilloscopeExt = { //8#48d ------- oscilloscope -------
    def: {
      sensitivity: {defVal: 50, min: 1, max: 100},
      zoom: {defVal: 1, min: .025, max: 2, subType: 'exp'},
      fullZoom: {defVal: 'off', type: 'cmd', name: 'Zoom x1'},
      halfZoom: {defVal: 'off', type: 'cmd', name: 'Zoom x2'},
      quartZoom: {defVal: 'off', type: 'cmd', name: 'Zoom x4'},
      resetZoom: {defVal: 'act', type: 'cmd', name: 'No zoom'},
      freeze: {defVal: 'off', type: 'cmd', name: 'Freeze'},
      scope: {type: 'graph'}
    },
    name: 'Oscilloscope',
    graphs: {
      scope: {
        graphType: 'custom',
        onInit: ({cc, width, height, fx, ccext}) => fx.int.capture({cc, width, height, ccext})
      }
    }
  }
  oscilloscopeExt.setValue = (fx, key, value, {int} = fx) => ({
    sensitivity: nop,
    zoom: _ => fx.resizeFFT(),
    fullZoom: _ => value === 'fire' && fx.setCmds('fullZoom', int.width / 16384),
    halfZoom: _ => value === 'fire' && fx.setCmds('halfZoom', int.width / 8192),
    quartZoom: _ => value === 'fire' && fx.setCmds('quartZoom', int.width / 4096),
    resetZoom: _ => value === 'fire' && fx.setCmds('resetZoom', 1),
    freeze: _ => int.isRAFOn ? (int.isRAFOn = false) : fx.startOsc()
  }[key])
  
  oscilloscopeExt.onActivated = (fx, isActive) => isActive ? fx.startOsc() : fx.stopOsc()
  
  oscilloscopeExt.construct = (fx, pars, {int, atm} = fx) => {
    int.prof = []
    int.drawCnt = 0
    int.rAF = null
    int.cc = undef    //: baseGraph fills it in onInit
    int.width = 600   //: baseGraph fills it in onInit
    int.isRAFOn = false
    
    const regenFFTArray = fftSize => {
      if (fftSize !== int.fftSize) {
        int.fftSize = fftSize
        int.osc.fftSize = fftSize
        int.freqData = new Uint8Array(int.osc.frequencyBinCount) //: fftSize / 2
        clog(`Scope.regenFFTArray: FFT array resized with fftsize`, fftSize)
      }
    }
    
    int.osc = waCtx.createAnalyser()
    regenFFTArray(2048)
    
    fx.start.connect(int.osc)
    fx.start.connect(fx.output)
    
    fx.resizeFFT = _ => {
      const idealFFTSize = Math.round(int.width / atm.zoom * 2 * Math.pow(2, atm.zoom / 2))
      let found = 32768
      for (let fftSize = 256; fftSize < 32768; fftSize *= 2) {
        if (fftSize > idealFFTSize) {
          found = fftSize
          break
        }
      }
      clog(`Scope.resizeFFT: actual fft reqs recalculated:`, {zoom: atm.zoom.toFixed(3), idealFFTSize, oldFFT: int.fftSize, newFFT: found, width: int.width})
      regenFFTArray(found)
    }
    
    fx.startOsc = _ => {
      if (!int.isRAFOn) {
        int.isRAFOn = true
        window.requestAnimationFrame(_ => drawFrame(fx))
      }
    }
    fx.stopOsc = _ => int.isRAFOn = false
    
    fx.setCmds = (act, newZoomVal) => {
      fx.setValue('zoom', newZoomVal)
      fx.setValue('fullZoom', act === 'fullZoom' ? 'active' : 'off')
      fx.setValue('halfZoom', act === 'halfZoom' ? 'active' : 'off')
      fx.setValue('quartZoom', act === 'quartZoom' ? 'active' : 'off')
      fx.setValue('resetZoom', act === 'resetZoom' ? 'active' : 'off')
    }
  }
  
  registerFxType('fx_oscilloscope', oscilloscopeExt)
})
