/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, WaapiWrap} from '../improxy-esm.js'

const {nop, no, yes, isArr, getRnd, getRndFloat} = Corelib
const {wassert} = Corelib.Debug
const {post} = Corelib.Tardis
const {round} = Math

WaapiWrap.onRun(waCtx => {
  const {registerFxType, newFx} = BeeFX(waCtx)
  
  const ratioFx = { //8#666 ------- ratio -------
    def: {
      gain: {defVal: .25, min: 0.01, max: 1, name: 'Stage ratio'}
    }
  }
  
  ratioFx.setValue = (fx, key, value) => ({
    gain: _ => {
      fx.setAt('gain', 'gain', value)
      post(_ => fx.distributeGain())
    }
  }[key])
  
  ratioFx.setValueAlt = (fx, key, value) => ({
    gain: _ => fx.setAt('gain', 'gain', value)
  }[key])

  const getAggregatedGain = arr => arr.reduce((acc, fx) => acc + fx.live.gain, 0)
  
  const dumpChain = (fx, msg) => {
    if (no) {
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
  }
  
  ratioFx.construct = (fx, pars) => {
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

    fx.chain = (...arr) => { //: rewrites all shareds created previously, but others not!
      arr = isArr(arr[0]) ? arr[0] : arr
      const chainArr = [fx, ...arr.filter(f => f !== fx)] //: no duplicates!
      const chainLen = chainArr.length
      const sumGain = exo.def.gain.max + exo.def.gain.min * (chainLen - 1)
      const resetGain = sumGain / chainLen
      
      ext.shared = {chainArr, chainLen, sumGain, resetGain}
      
      for (const chainedFx of chainArr) {
        chainedFx.setValueAlt('gain', resetGain)
        chainedFx.ext.shared = ext.shared
      }
      //console.log(`ratio chaining`, {fx, shared: ext.shared, ext})
      fx.setValue('gain', fx.live.gain)
      dumpChain(fx, 'fx.chain.end')
      fx.onActivated()
    }
    
    fx.onActivated = _ => { //:activation changed (or chain was called), recalc!
      const {shared} = ext
      if (!shared) {
        return
      }
      dumpChain(fx, 'ratio onactivated start')
      
      shared.activeChainArr = shared.chainArr.filter(fx => fx.isActive)
      shared.activeChainLen = shared.activeChainArr.length
      
      fx.distributeGain(fx.isActive ? fx.live.gain : 0)
      dumpChain(fx, 'ratio onactivated end')
    }

    fx.distributeGain = (fixedGain = fx.live.gain) => {
      //console.groupCollapsed('%cdistributee', 'background: #ff8', fx.zholger, dumpChain(fx, 'before'))
      const {shared} = ext
      if (!shared) {
        console.warn(`Too early post() brought us here (after state restore?), skip!`, fx)
        return
      }
      if (shared.activeChainLen > 1) {
        const othersAggregated = getAggregatedGain(shared.activeChainArr.filter(f => f !== fx))
        const remaining = shared.sumGain - fixedGain // 3.5
        const factor = remaining / othersAggregated
        
        wassert(othersAggregated * 1.0001 >= exo.def.gain.min * (shared.activeChainLen - 1))
        //console.log('dist', {othersAggregated, remaining, factor})
        
        shared.lastFixedFx = fx
        //console.log('lastfixed set to', fx, shared)
        for (const chainFx of shared.activeChainArr) {
          fx !== chainFx &&
            chainFx.setValueAlt('gain', Math.max(chainFx.live.gain * factor, exo.def.gain.min))
        }
      }
      //console.groupEnd()
    }
  }
  ratioFx.onActivated = fx => fx.onActivated()

  registerFxType('fx_ratio', ratioFx)    
})
