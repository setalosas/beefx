/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, WaapiWrap} from '../improxy-esm.js'

const {nop, isArr, getRnd, getRndFloat} = Corelib
const {wassert} = Corelib.Debug
const {post} = Corelib.Tardis
const {round} = Math

WaapiWrap.onRun(waCtx => {
  const {registerFxType, newFx} = BeeFX(waCtx)

  const createBasicFxTypes = _ => {
    const blankFx = { //8#bbb ------- blank -------
      def: {}
    }
    blankFx.construct = (fx, pars) => {//: gainFx egy van, fx az instancia
      fx.start.connect(fx.output)
    }
    registerFxType('fx_blank', blankFx)
    
    const gainFx = { //8#a00 ------- gain -------
      def: {
        gain: {defVal: 1, min: 0, max: 4, name: 'gain'}
      }
    }
    gainFx.construct = (fx, pars) => {//: gainFx egy van, fx az instancia
      const {ext} = fx
      ext.gain = waCtx.createGain()
      fx.start.connect(ext.gain)
      ext.gain.connect(fx.output)
    }
    gainFx.setValue = (fx, key, value) => ({
      gain: _ => fx.setAt('gain', 'gain', value)
    }[key])
    registerFxType('fx_gain', gainFx)

    const delayFx = { //8#a0a ------- delay -------
      def: {
        delayTime: {defVal: 0, min: 0, max: 1}
      }
    }
    delayFx.construct = (fx, pars) => {//: delayFx egy van, fx az instancia
      const {ext} = fx
      ext.delay = waCtx.createDelay()
      fx.start.connect(ext.delay)
      ext.delay.connect(fx.output)
    }
    delayFx.setValue = (fx, key, value) => ({
      delayTime: _ => fx.setAt('delay', 'delayTime', value) //fx.ext.delay.delayTime.value = value
    }[key])
    registerFxType('fx_delay', delayFx)
    
    const ratioFx = { //8#666 ------- ratio -------
      def: {
        gain: {defVal: .25, min: 0.01, max: 1, name: 'Stage ratio'}
      }
    }
    const getAggregatedGain = arr => arr.reduce((acc, fx) => acc + fx.live.gain, 0)
    
    const dumpChain = (fx, msg) => {
      console.log(msg)
      const {ext} = fx
      const tab = []
      const arr =  ext.chainArr
      for (const chainFx of arr) {
        tab.push({
          zholger: chainFx.zholger,
          gain: chainFx.live.gain,
          isActive: chainFx.isActive,
          isThisMe: fx === chainFx
        })
      }
      console.table(tab)
      console.log(`sumGain: ${ext.sumGain} syncLen: ${ext.chainLen}`)
    }
    
    ratioFx.construct = (fx, pars) => {//: ratioFx egy van, fx az instancia
      const {ext, exo} = fx
      ext.capture({
        gain: waCtx.createGain(),
        chainArr: [],
        activeChainArr: [],
        chainLen: 0,
        activeChainLen: 0
      })
      fx.start.connect(ext.gain)
      ext.gain.connect(fx.output)

      fx.chain = (...arr) => {
        arr = isArr(arr[0]) ? arr[0] : arr
        const chainArr = [fx, ...arr.filter(f => f !== fx)] //: no duplicates!
        const chainLen = chainArr.length
        const sumGain = exo.def.gain.max + exo.def.gain.min * (chainLen - 1)
        const resetGain = sumGain / chainLen
        //: i.e.4 => 1 + 3 * .01 = 1.03 => 0.2575
        
        for (const chainedFx of chainArr) {
          chainedFx.setValueAlt('gain', resetGain)
          chainedFx.ext.capture({chainArr, chainLen, sumGain, resetGain})
        }
        console.log(`ration chaining`, {fx, chainArr, chainLen, sumGain, resetGain, ext})
        fx.setValue('gain', fx.live.gain)
        dumpChain(fx, 'fx.chain.end')
        fx.exo.onActivated(fx)
      }
    }
    ratioFx.onActivated = fx => { //:activation changed (or chain was called), recalc!
      dumpChain(fx, 'ratio onactivated start')
      const {ext} = fx
      const activeChainArr = ext.chainArr.filter(fx => fx.isActive)
      const activeChainLen = activeChainArr.length
      for (const chainedFx of ext.chainArr) {
        chainedFx.ext.capture({activeChainArr, activeChainLen})
      }
      fx.exo.distributeGain(fx, fx.isActive ? fx.live.gain : 0)
      
      /*
      const activeArr = fullArr.filter(fx => fx.isActive)
      const aggregated = getAggregatedGain(activeArr)
      const othersAggregated = aggregated - fx.live.gain 
      const ratio = SUM_GAIN / aggregated
      */
      dumpChain(fx, 'ratio onactivated end')
    }
    ratioFx.distributeGain = (fixedFx, fixedGain = fixedFx.live.gain) => {
      console.group('%cdistributee', 'background: #ff8', fixedFx.zholger, dumpChain(fixedFx, 'before'))
      const {ext, exo} = fixedFx
      if (ext.activeChainLen > 1) {
        const othersAggregated = getAggregatedGain(ext.activeChainArr.filter(f => f !== fixedFx))
        const remaining = ext.sumGain - fixedGain // 3.5
        const factor = remaining / othersAggregated
        
        wassert(othersAggregated * 1.0001 >= exo.def.gain.min * (ext.activeChainLen - 1))
        console.log('dist', {othersAggregated, remaining, factor})
        
        for (const chainFx of ext.activeChainArr) {
          if (fixedFx !== chainFx) {
            const oldVal = chainFx.live.gain
            const newVal = oldVal * factor
            console.log('--->', chainFx.zholger, {oldVal, newVal})
            chainFx.setValueAlt('gain', Math.max(newVal, exo.def.gain.min))
          }
        }
      }
      console.groupEnd()
    }
    ratioFx.setValue = (fx, key, value) => ({
      gain: _ => {
        fx.setAt('gain', 'gain', value)
        post(_ => ratioFx.distributeGain(fx))
      }
    }[key])
    ratioFx.setValueAlt = (fx, key, value) => ({
      gain: _ => {
        fx.setAt('gain', 'gain', value)
      }
    }[key])
    registerFxType('fx_ratio', ratioFx)

    const biquadFx = { //8#48d ------- biquadFilter (WA) -------
      def: {
        filterType: {defVal: 'peaking', type: 'string', subType: 'biquad'},
        frequency: {defVal: 800, min: 50, max: 22050, subType: 'exp'},
        //detune: {defVal: 100, min: 1, max: 10000, subType: 'exp'},
        detune: {defVal: 0, min: -2400, max: 2400},
        gain: {defVal: 0, min: -40, max: 40, subType: 'decibel'},
        Q: {defVal: 1, min: .0001, max: 100, subType: 'exp'}
      },
      name: 'BiquadFilter'
    }
    
    const detuneFactor = Math.log(2) / 1200
    //: const hz = Math.pow2(detune / 1200)
    //: const detune = Math.log(hz) / Math.log(2) * 1200
    //: const detune = Math.log(hz) / detuneFactor
    
    biquadFx.construct = (fx, pars) => {
      const {ext} = fx
      ext.biquad = waCtx.createBiquadFilter()
      fx.start.connect(ext.biquad)
      ext.biquad.connect(fx.output)
    }
    biquadFx.setValue = (fx, key, value) => ({
      filterType: _ => fx.ext.biquad.type = value,
      frequency: _ => fx.setAt('biquad', 'frequency', value),
      detune: _ => fx.setAt('biquad', 'detune', value /*Math.log(value) / detuneFactor*/),
      gain: _ => fx.setAt('biquad', 'gain', value),
      Q: _ => fx.ext.biquad.Q.value = value
    }[key])
    
    registerFxType('fx_biquad', biquadFx)
      
    //+ sima lo hi szuro! vagy lo hi pan!
  }
  
  createBasicFxTypes()
})
