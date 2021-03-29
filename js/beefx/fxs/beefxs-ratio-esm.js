/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {nop, no, yes, isArr, getRnd, getRndFloat} = Corelib
const {wassert} = Corelib.Debug
const {post} = Corelib.Tardis
const {round} = Math

onWaapiReady.then(waCtx => {
  const {registerFxType, newFx, connectArr} = BeeFX(waCtx)
  
  const ratioFx = { //8#666 ------- ratio -------
    def: {
      gain: {defVal: .25, min: 0.01, max: 1, name: 'Stage ratio'}
    }
  }
  
  ratioFx.setValue = (fx, key, value) => ({
    gain: _ => {
      fx.setAt('gain', 'gain', value)
      //post(_ => fx.distributeGain())
      fx.distributeGain()
    }
  }[key])
  
  ratioFx.setValueAlt = (fx, key, value) => ({
    gain: _ => fx.setAt('gain', 'gain', value < .04 ? 0 : value)
  }[key])

  const getAggregatedGain = arr => arr.reduce((acc, fx) => acc + fx.atm.gain, 0)
  
  const logRatio = false
  const rlog = (...args) => logRatio && console.log(...args)
  const slog = (...args) => logRatio && console.warn(...args)
  const glog = (...args) => logRatio && console.group(...args)
  const hlog = _ => logRatio && console.groupEnd()
  
  const dumpChain = (fx, msg, {int} = fx) => {
    if (yes) {
      const {shared} = int
      const tab = []
      for (const chainFx of shared.chainArr) {
        const {zholger, isActive} = chainFx
        const gain = chainFx.atm.gain
        const isThisMe = fx === chainFx ? '🟠' : '⚪️'
        tab.push(`${zholger.substr(0, 4)} ${isThisMe} ${gain} act:${isActive}`)
      }
      tab.sort((a, b) => a > b ? 1 : -1)
      rlog(msg + ' ' + tab.join(' / '))
    }
  }
  
  ratioFx.construct = (fx, pars) => {
    const {int, exo} = fx
    /* int.capture({
      gain: waCtx.createGain(),
      chainArr: [],
      activeChainArr: [],
      chainLen: 0,
      activeChainLen: 0
    }) */
    int.gain = waCtx.createGain()
    connectArr(fx.start, int.gain, fx.output)

    fx.chain = (...arr) => { //: rewrites all shareds created previously, but others not!
      arr = isArr(arr[0]) ? arr[0] : arr
      const chainArr = [fx, ...arr.filter(f => f !== fx)] //: no duplicates!
      const chainLen = chainArr.length
      const sumGain = exo.def.gain.max + exo.def.gain.min * (chainLen - 1)
      const resetGain = sumGain / chainLen
      
      int.shared = {chainArr, chainLen, sumGain, resetGain}
      rlog(`🔗🔗fx.chain() calling setValueAlt(gain) loop now:`)
      for (const chainedFx of chainArr) {
        chainedFx.setValueAlt('gain', resetGain)
        chainedFx.int.shared = int.shared
      }
      rlog(`🔗🔗fx.chain() calling setValue(gain) now:`, {shared: int.shared, int, fx})
      fx.setValue('gain', fx.atm.gain)
      dumpChain(fx, '🔗🔗fx.chain() finished')
      fx.onActivated()
    }
    
    fx.onActivated = _ => { //:activation changed (or chain was called), recalc!
      const {shared} = int
      if (!shared) {
        return
      }
      glog(`🔗%cfx.onActivated(${fx.zholger}) start`, 'background: #fc9')
      dumpChain(fx, '🔗')
      
      shared.activeChainArr = shared.chainArr.filter(fx => fx.isActive)
      shared.activeChainLen = shared.activeChainArr.length
      rlog(`🔗%cratio.onActivated ACTIVE CHAIN RECALCED`, 'font-size:20px', shared.activeChainArr)
      
      fx.distributeGain(fx.isActive ? fx.atm.gain : 0)
      dumpChain(fx, `🔗fx.onActivated(${fx.zholger}) end`)
      hlog()
    }

    fx.distributeGain = (fixedGain = fx.atm.gain) => {
      const {shared} = int
      if (!shared) {
        slog(`Too early post() brought us here (after state restore?), skip!`, fx)
        return
      }
      glog(`🔗📊 %cdistributeGain(${fx.zholger}) fixedGain=${fixedGain}`, 'background: #ff8')
      slog('callers')
      dumpChain(fx, '🔗📊 ')
      if (shared.activeChainLen > 1) {
        const othersAggregated = getAggregatedGain(shared.activeChainArr.filter(f => f !== fx))
        const remaining = shared.sumGain - fixedGain // 3.5
        const factor = remaining / othersAggregated
        
        wassert(othersAggregated * 1.0001 >= exo.def.gain.min * (shared.activeChainLen - 1))
        rlog('🔗📊 dist tmp', {othersAggregated, remaining, factor})
        
        shared.lastFixedFx = fx
        glog(`🔗📊 (BEFORE LOOP FOR NOT FIXED FXS) lastfixed set to ${fx.zholger}`, shared)
        for (const chainFx of shared.activeChainArr) {
          fx !== chainFx &&
            chainFx.setValueAlt('gain', Math.max(chainFx.atm.gain * factor, exo.def.gain.min))
        }
        hlog()
      }
      hlog()
    }
  }
  ratioFx.onActivated = fx => fx.onActivated()

  registerFxType('fx_ratio', ratioFx)    
})
