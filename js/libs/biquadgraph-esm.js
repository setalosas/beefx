/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, space-unary-ops,
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, no-unused-vars, object-curly-newline */

import {Corelib, DOMplusUltra} from '../improxy-esm.js'

const {Ø, nop} = Corelib
const {wassert, weject} = Corelib.Debug
const {max, min, round, pow, log: mathlog, floor, LN2, LN10} = Math

export const createBiquadGrapher = waCtx => {// in ou
  const biquadGraph = {}
  
  biquadGraph.render = (scene, filter, graph) => {
    const {canvas$, width, height, filterNo} = scene
    const {dbScaleFactor = 1, ix = 0, curveBaseColor} = graph

    const fixCurveColor = curveBaseColor || 'hsl(120, 90%, 55%)'
    const phaseColor = ix ? 'hsl(20, 58%, 48%)' : 'hsl(150, 70%, 35%)'
    const playheadColor = 'hsl(120, 90%, 40%)'
    const gridColor = 'hsla(0, 0%, 66%, .5)'
    const hzTextColor = 'hsla(200, 68%, 82%, .75)'
    const dbTextColor = 'hsla(260, 68%, 82%, .75)'
    
    const transExp = xpt => (1 - pow(1 * xpt, 3)).toFixed(2)
    
    const curveColor = filterNo === 1 ? _ => fixCurveColor : [
      xpt => `hsla(120, 90%, 55%, ${transExp(xpt)})`,
      xpt => `hsla(20, 99%, 65%, ${transExp(1 - xpt)})`
    ][ix] || console.warn(`Bad ix in biquadGraph.curveColor`) || nop
            
    const halfHeight = height / 2
    const dbScale = 60
    const pixPerDb = halfHeight / dbScale * dbScaleFactor
    
    const dbToY = db => halfHeight - pixPerDb * db
    
    const canvasContext = canvas$.getContext('2d')
    const canvasHeight = parseFloat(window.getComputedStyle(canvas$, null).height)
    const canvasWidth = parseFloat(window.getComputedStyle(canvas$, null).width)

    const frequencyHz = new Float32Array(width)
    const magResponse = new Float32Array(width)
    const phaseResponse = new Float32Array(width)
    const nOctaves = 11
    const nyquist = 0.5 * waCtx.sampleRate
    
    for (let i = 0; i < width; i++) {// Convert to log frequency scale (octaves).
      frequencyHz[i] = nyquist * pow(2, nOctaves * (i / width - 1))
    }
    
    filter.getFrequencyResponse(frequencyHz, magResponse, phaseResponse)
    
    const canvasBeginDraw = (strokeStyle, lineWidth) => {
      canvasContext.beginPath()
      canvasContext.strokeStyle = strokeStyle
      typeof lineWidth !== Ø && (canvasContext.lineWidth = lineWidth / 2)
    }
    const canvasLine = (x1, y1, x2, y2) => {
      canvasContext.moveTo(x1, y1)
      canvasContext.lineTo(x2, y2)
    }
    ix || canvasContext.clearRect(0, 0, width, height)
    canvasContext.font = '18px roboto condensed'
    
    canvasBeginDraw(curveColor(0), 9) //5#88e ----- draw magResponse curve -----
    
    let prev = {}
          
    const drawDynCurve = (x, y, col) => {//: canvas API is medieval
      canvasContext.strokeStyle = col
      canvasContext.beginPath() 
      if (x) {
        canvasContext.moveTo(prev.x, prev.y)
        canvasContext.lineTo(x, y) 
      }
      prev = {x, y}
      canvasContext.stroke()
    }
    
    for (let x = 0; x < width; ++x) {
      const magReX = magResponse[x]
      weject(Number.isNaN(magReX))
      const dbResponse = 20 * mathlog(magReX) / LN10
      const y = dbToY(dbResponse)
      drawDynCurve(x, y, curveColor(x / width))
    }

    const hasPhase = true
    const hasGrid = true
    const hasText = true
    
     if (hasPhase) {
      canvasBeginDraw(phaseColor, 5) //5#88e ----- draw phaseResponse curve -----

      for (let x = 0; x < width; ++x) {
        const phReX = phaseResponse[x]
        weject(Number.isNaN(phReX))
        const dbResponse = 20 * mathlog(phReX) / LN10
        const y = dbToY(dbResponse)
        x ? canvasContext.lineTo(x, y) : canvasContext.moveTo(x, y)
      }
      canvasContext.stroke()
    }
    
    if (!ix) { //: only for the first filter of the array
      if (hasGrid) {
        canvasBeginDraw(gridColor, 2)//5#669 ----- draw octave grid -----
      
        const txty = 34
        
        for (let octave = 0; octave <= nOctaves; octave++) {// Draw frequency scale
          const xx = octave * width / nOctaves
          const x = round(xx)
          
          canvasContext.strokeStyle = gridColor
          canvasLine(x, txty + 2, x, height - 1)
          canvasContext.stroke()

          const valueHerz = round(nyquist * pow(2.0, octave - nOctaves))
          const [value, unit] = valueHerz > 1000
            ? [round(valueHerz / 100) / 10, 'k']//was kHz but it won't fit on small rect
            : [valueHerz, '']//was Hz
            
          canvasContext.textAlign = 'left'
          canvasContext.strokeStyle = hzTextColor
          canvasContext.save()
          canvasContext.translate(x, txty)
          canvasContext.rotate(-Math.PI / 4)
          hasText && canvasContext.strokeText(value + unit, 0, 0)
          canvasContext.restore()
        }
        
        // Draw 0dB line.
        canvasContext.beginPath() //5#669 ----- draw dB grid -----
        canvasLine(0, 0.5 * height, width, 0.5 * height)
        canvasContext.stroke()
        
        for (let db = -dbScale; db < dbScale - 10; db += 10) {// Draw decibel scale.
          const yy = dbToY(db)
          const y = round(yy)
          canvasContext.fillStyle = dbTextColor
          canvasContext.textAlign = 'right'
          hasText && canvasContext.fillText(db + "dB", width - 2, y - 4)
          canvasBeginDraw(gridColor, 2)
          canvasLine(0, y, width, y)
          canvasContext.stroke()
        }
      }
    }
  }
  
  return biquadGraph
}
