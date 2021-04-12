/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */

import {Corelib, BeeFX, detectBPMa, detectBPMj} from '../beeproxy-esm.js'

const {Ø, no, yes, undef, isFun, isArr, getRnd, nop, s_a} = Corelib
const {wassert, weject, brexru} = Corelib.Debug
const {post, createPerfTimer} = Corelib.Tardis

export const createBPMAuditor = waCtx => { //: allegro
  const {concatAudioBuffers} = BeeFX(waCtx)

  const auditor = {}
    
  const options = {
    element: null,
    // bufferSize: 4096, numberOfInputChannels: 1, numberOfOutputChannels: 1
    scriptNodeArgs: [8192, 1, 1]
  }
  const dis = {
    scriptNode: waCtx.createScriptProcessor(...options.scriptNodeArgs),
    source: undef,
    audioBuffer: undef,
    isAnalysing: false
  }
    
  const connectAuditor = _ => {
    console.log('auditor.connect')
    wassert(dis.source)
    dis.scriptNode.connect(waCtx.destination)
    dis.source.connect(dis.scriptNode)
    
    dis.scriptNode.onaudioprocess = ({inputBuffer}) => {
      if (dis.isAnalysing) {
        const timer = createPerfTimer()
        dis.audioBuffer = concatAudioBuffers(dis.audioBuffer, inputBuffer)

        const {sum} = timer.sum().dur
        sum > 9 && console.log(`bpm onaudioproc(${inputBuffer.length}) ${sum}ms`, dis.audioBuffer)
      }
    }
    
    dis.audioBuffer = null
    dis.isAnalysing = false
  }

  const disconnectAuditor = _ => {
    console.log('auditor.disconnect')
    wassert(dis.source)
    dis.source.disconnect(dis.scriptNode)
    dis.scriptNode.disconnect()
    dis.scriptNode.onaudioprocess = null
    dis.audioBuffer = null
    dis.isAnalysing = false
  }
  
  auditor.start = source => {
    console.log('auditor.start')
    dis.source = source
    connectAuditor()
    dis.isAnalysing = true
  }
  
  auditor.stop = async _ => {
    console.log('auditor.stop')
    const timer = createPerfTimer()
    let bpmj = {
      candidates: [],
      bpm: '???'
    }
    let bpma = {
      candidates: [],
      bpm: '???'
    }
    try {
      if (yes) {
        bpmj = await detectBPMj(dis.audioBuffer)
        bpmj.bpm = bpmj.candidates?.[0]?.tempo  
        timer.mark('bpmj')
      } else {
        bpma = await detectBPMa(dis.audioBuffer)
        bpma.bpm = bpma.candidates?.[0]?.tempo  
        timer.mark('bpma')
      }
    } catch (err) {
      console.warn(err)
      bpmj.error = err
    }
    disconnectAuditor()
    console.log(`BPM, candidates`, timer.sum().summary, bpma, bpmj)
    console.log('bpmj', bpmj.candidates)
    //console.log('bpma', bpma.candidates)
    return bpmj
  }
  
  return auditor
}
