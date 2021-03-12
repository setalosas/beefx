/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */

import {Corelib, detectBPMa, detectBPMj} from '../improxy-esm.js'

const {Ø, undef, isFun, isArr, getRnd, nop, s_a} = Corelib
const {wassert, weject, brexru} = Corelib.Debug
const {post, createPerfTimer} = Corelib.Tardis

export const createBPMAuditor = waCtx => { //: allegro
  //
  const concatenateAudioBuffers = (buf1, buf2) => { // concat AudioBuffers
    if (!buf1 && buf2) {
      return buf2
    }
    wassert(buf2)
  
    const tmp = waCtx.createBuffer(buf1.numberOfChannels, buf1.length + buf2.length, buf1.sampleRate)
  
    for (let i = 0; i < tmp.numberOfChannels; i++) {
      const data = tmp.getChannelData(i)
      data.set(buf1.getChannelData(i))
      data.set(buf2.getChannelData(i), buf1.length)
    }
    return tmp
  }

  const auditor = {}
    
  const options = {
    element: null,
    //scriptNode: {bufferSize: 4096, numberOfInputChannels: 1, numberOfOutputChannels: 1},
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
        dis.audioBuffer = concatenateAudioBuffers(dis.audioBuffer, inputBuffer)

        const {sum} = timer.sum().dur
        sum > 1 && console.log(`bpm onaudioproc(${inputBuffer.length}) ${sum}ms`, dis.audioBuffer)
      }
    }
    
    // Buffer
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
      bpmj = await detectBPMj(dis.audioBuffer)
      bpmj.bpm = bpmj.candidates?.[0]?.tempo  
      timer.mark('bpmj')

      bpma = await detectBPMa(dis.audioBuffer)
      bpma.bpm = bpma.candidates?.[0]?.tempo  
      timer.mark('bpma')
    } catch (err) {
      console.warn(err)
      bpmj.error = err
    }
    disconnectAuditor()
    console.log(`BPM, candidates`, timer.sum().summary, bpma, bpmj)
    console.log('bpmj', bpmj.candidates)
    console.log('bpma', bpma.candidates)
    return bpmj
  }
  
  return auditor
}
