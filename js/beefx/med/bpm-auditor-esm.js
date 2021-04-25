/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */

import {Corelib, BeeFX, detectBPMj} from '../beeproxy-esm.js'

const {undef} = Corelib
const {wassert} = Corelib.Debug
const {createPerfTimer} = Corelib.Tardis

export const createBPMAuditor = waCtx => { //: allegro
  const {concatAudioBuffers} = BeeFX(waCtx)

  const auditor = {}
    
  const options = {
    element: null,
    // bufferSize: 4096, numberOfInputChannels: 1, numberOfOutputChannels: 1
    scriptNodeArgs: [8192, 1, 1]
  }
  const dis = {
    source: undef,
    audioBuffer: undef,
    isAnalysing: false
  }
    
  const connectAuditor = _ => {
    dis.scriptNode = waCtx.createScriptProcessor(...options.scriptNodeArgs)
    dis.scriptNode.connect(waCtx.destination)
    dis.source.connect(dis.scriptNode)
    dis.audioBuffer = null
    dis.isAnalysing = false
    
    dis.scriptNode.onaudioprocess = ({inputBuffer}) => {
      if (dis.isAnalysing) {
        dis.audioBuffer = concatAudioBuffers(dis.audioBuffer, inputBuffer)
      }
    }
  }

  const disconnectAuditor = _ => {
    dis.source.disconnect(dis.scriptNode)
    dis.scriptNode.disconnect()
    dis.scriptNode.onaudioprocess = null
    delete dis.scriptNode
    dis.audioBuffer = null
    dis.isAnalysing = false
  }
  
  auditor.start = source => {
    dis.source = wassert(source)
    connectAuditor()
    dis.isAnalysing = true
  }
  
  auditor.stop = async _ => {
    const bpm = await auditor.detect(dis.audioBuffer)
    disconnectAuditor()
    return bpm
  }
  auditor.detect = async audioBuffer => {
    const timer = createPerfTimer()
    let bpmj
    try {
      bpmj = await detectBPMj(audioBuffer)
      bpmj.bpm = bpmj.candidates?.[0]?.tempo  
    } catch (err) {
      console.warn(err)
      bpmj.error = err
    }
    console.log(`BPM details:`, timer.sum().summary, bpmj)
    return bpmj
  }
  
  return auditor
}
