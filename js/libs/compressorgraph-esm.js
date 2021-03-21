/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, space-unary-ops,
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, no-unused-vars, object-curly-newline */

import {Corelib, DOMplusUltra} from '../improxy-esm.js'

const {Ø, nop, yes, no, undef} = Corelib
const {wassert, weject} = Corelib.Debug
const {max, min, round, pow, log: mathlog, floor, LN2, LN10} = Math

export const createCompressorGrapher = waCtx => {// in ou
  const compressorGraph = {}
  
  compressorGraph.render = (scene, fx, graph) => {
    const {canvas$, width, height} = scene
    const {dbScaleFactor = 1, ix = 0} = graph
    const {attack, release, ratio, threshold, knee, makeupGain} = fx.live

    const dbGridColor = 'hsla(0, 0%, 66%, .5)'
    const dbGridColorDark = 'hsla(0, 0%, 50%, .5)'
    const dbTextColor = 'hsla(260, 68%, 82%, .8)'
    
    const transExp = xpt => (1 - pow(1 * xpt, 3)).toFixed(2)
    
    const halfWidth = width / 2
    const halfHeight = height / 2
    const maxDb = 5
    const minDb = -60
    const dbScale = maxDb - minDb
    const pixPerDbX = halfWidth / dbScale//  * dbScaleFactor
    const pixPerDbY = height / dbScale // * dbScaleFactor
    
    const dbToY = db => height - (db - minDb) * pixPerDbY
    const dbToX = db => (db - minDb) * pixPerDbX
    
    const minMs = 0
    const maxMs = 2750
    const msScale = maxMs - minMs
    const pixPerMsX = halfWidth / msScale
    
    const msToX = ms => (ms - minMs) * pixPerMsX + halfWidth
    
    const canvasContext = canvas$.getContext('2d')
    const canvasHeight = parseFloat(window.getComputedStyle(canvas$, null).height)
    const canvasWidth = parseFloat(window.getComputedStyle(canvas$, null).width)

    const frequencyHz = new Float32Array(width)
    const magResponse = new Float32Array(width)
    const phaseResponse = new Float32Array(width)
    const nOctaves = 11
    const nyquist = 0.5 * waCtx.sampleRate
    
    const setTextStyle = (fillStyle, textAlign) => {
      canvasContext.fillStyle = fillStyle
      canvasContext.textAlign = textAlign
    }
    const setLineStyle = (strokeStyle, lineWidth) => {
      canvasContext.strokeStyle = strokeStyle
      canvasContext.lineWidth = lineWidth
    }
    const drawLine = (x1, y1, x2, y2) => {
      canvasContext.beginPath()
      canvasContext.moveTo(x1, y1)
      canvasContext.lineTo(x2, y2)
      canvasContext.stroke()
    }
    const dbdbLine = (dbx1, dby1, dbx2, dby2) => {
      const x1 = dbToX(dbx1)
      const x2 = dbToX(dbx2)
      const y1 = dbToY(dby1)
      const y2 = dbToY(dby2)
      drawLine(x1, y1, x2, y2)
    }
    const dbdbQuadratic = (dbx1, dby1, dbcpx, dbcpy, dbx2, dby2) => {
      const x1 = dbToX(dbx1)
      const x2 = dbToX(dbx2)
      const cx = dbToX(dbcpx)
      const y1 = dbToY(dby1)
      const y2 = dbToY(dby2)
      const cy = dbToY(dbcpy)
      canvasContext.beginPath()
      canvasContext.moveTo(x1, y1)
      canvasContext.quadraticCurveTo(cx, cy, x2, y2)
      canvasContext.stroke()
    }
    const msdb = {x: 0, y: 0}
    const msdbLine = (msx1, dby1, msx2, dby2) => {
      msdb.x = msToX(msx1)
      msdb.y = dbToY(dby1)
      msdbLineTo(msx2, dby2)
    }
    const msdbLineTo = (msx2 = msdb.x, dby2 = msdb.y) => {
      const x1 = msdb.x
      const y1 = msdb.y
      const x2 = msToX(msx2)
      const y2 = dbToY(dby2)
      drawLine(x1, y1, x2, y2)
      msdb.x = x2
      msdb.y = y2
    }
    
    const drawDbGrid = _ => { //5#669 ----- draw dB grid -----
      for (let db = minDb; db < maxDb; db += 10) {
        setLineStyle(dbGridColor, 3)
        dbdbLine(minDb, db, maxDb + dbScale, db)

        const yy = dbToY(db)
        const y = round(yy)
        setTextStyle(dbTextColor, 'right')
        canvasContext.fillText(db + "dB", width - 2, yy - 4)
        canvasContext.fillText(db + "dB", 50, yy - 4)
      }
    }
    
    canvasContext.clearRect(0, 0, width, height)
    canvasContext.font = '22px roboto condensed'
    
    drawDbGrid()
    setLineStyle(dbGridColor, 2)
    msdbLine(0, minDb, 0, maxDb)
    msdbLine(1000, minDb, 1000, maxDb)
    msdbLine(2000, minDb, 2000, maxDb)
    setLineStyle(dbGridColorDark, 1)
    msdbLine(500, minDb, 500, maxDb)
    msdbLine(1500, minDb, 1500, maxDb)
    msdbLine(2500, minDb, 2500, maxDb)
    
    const refColor = 'hsl(200, 60%, 40%)'
    const thresholdColor = 'hsl(0, 75%, 50%)'
    const makeupColor = 'hsl(30, 80%, 50%)'
    const kneeCurveColor = 'hsl(60, 85%, 45%)'
    
    setLineStyle(refColor, 8)
    dbdbLine(minDb, minDb, maxDb, maxDb)

    setLineStyle(thresholdColor, 4)
    dbdbLine(threshold, minDb, threshold, maxDb)
    
    const compx1 = threshold
    const compx2 = maxDb
    const compWi = compx2 - compx1
    const compy1 = threshold + makeupGain
    const compHi = compWi / ratio // inkabb minusz szerintem
    
    const kneeRight = min(maxDb + 3, compx1 + knee) - compx1
    const kneex1 = compx1 - knee
    const kneex2 = compx1 + kneeRight
    const kneey1 = compy1 - knee
    const kneey2 = compy1 + kneeRight / ratio
    
    setLineStyle(kneeCurveColor, 5)
    dbdbQuadratic(kneex1, kneey1, compx1, compy1, kneex2, kneey2)

    setLineStyle(makeupColor, 5)
    dbdbLine(minDb, minDb + makeupGain, kneex1, kneey1)
    dbdbLine(kneex2, kneey2, compx2, compy1 + compHi)
    
    const inColor = 'hsl(200, 60%, 40%)'
    const outBaseColor = 'hsl(30, 90%, 50%)'
    
    const topDb = 0
    const bottomDb = -40
    const startMs = -500
    const upMs = 250
    const downMs = 1500
    const thrDb = threshold
    
    setLineStyle(thresholdColor, 4)
    msdbLine(-maxMs, thrDb, maxMs, thrDb)
        //dbdbLine(threshold, minDb, threshold, maxDb)

    setLineStyle(inColor, 12)
    msdbLine(startMs, bottomDb, upMs, bottomDb)
    msdbLineTo(upMs, topDb)
    msdbLineTo(downMs, topDb)
    msdbLineTo(downMs, bottomDb)
    msdbLineTo(maxMs, bottomDb)
    
    const g = makeupGain
    
    setLineStyle(outBaseColor, 4)
    msdbLine(startMs, g + bottomDb, upMs, g + bottomDb)
    msdbLineTo(upMs, g + topDb)
    msdbLineTo(upMs + attack, g + thrDb + (topDb - thrDb) / ratio)
    msdbLineTo(downMs, g + thrDb + (topDb - thrDb) / ratio) 
    msdbLineTo(downMs, g + thrDb + (topDb - thrDb) / ratio - (topDb - bottomDb))
    msdbLineTo(downMs + release, g + bottomDb)
    msdbLineTo(maxMs, g + bottomDb)
  }
  
  return compressorGraph
}
