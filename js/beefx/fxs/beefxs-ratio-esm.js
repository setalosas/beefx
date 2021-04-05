/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {nop, no, yes, isArr, getRnd, getRndFloat} = Corelib
const {wassert} = Corelib.Debug
const {post} = Corelib.Tardis
const {round, max} = Math

onWaapiReady.then(waCtx => {
  const {registerFxType, connectArr} = BeeFX(waCtx)
  
  const logRatio = false
  const rlog = (...args) => logRatio && console.log(...args)
  const slog = (...args) => logRatio && console.warn(...args)
  const glog = (...args) => logRatio && console.group(...args)
  const hlog = _ => logRatio && console.groupEnd()
  
  const ratioFx = { //8#666 ------- ratio -------
    def: {
      gain: {defVal: .25, min: 0.00001, max: 1.00001, name: 'Stage ratio'}
    }
  }
  
  ratioFx.setValue = (fx, key, value, {int} = fx) => ({
    gain: _ => {
      fx.setAt('gain', 'gain', value)
      fx.distributeGain()
    }
  }[key])
  
  const getAggregatedGain = arr => arr.reduce((acc, fx) => acc + fx.atm.gain, 0)
  
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
  
  ratioFx.construct = (fx, pars, {int, atm} = fx) => {
    const {min: minGain, max: maxGain} = ratioFx.def.gain
    int.gain = waCtx.createGain()
    connectArr(fx.start, int.gain, fx.output)
    
    fx.modifyGain = factor => fx.setValue('gain', max(atm.gain * factor, minGain))

    fx.chain = (...arr) => { //: rewrites all shareds created previously, but others not!
      arr = isArr(arr[0]) ? arr[0] : arr
      const chainArr = [fx, ...arr.filter(f => f !== fx)] //: no duplicates!
      const chainLen = chainArr.length
      const sumGain = maxGain + minGain * (chainLen - 1)
      const resetGain = sumGain / chainLen
      int.shared = {chainArr, chainLen, sumGain, resetGain, isWarModeOn: true}
      
      rlog(`🔗🔗fx.chain() calling setValue(gain) loop now:`)
      for (const chainedFx of chainArr) {
        chainedFx.int.shared = int.shared
        chainedFx.setValue('gain', resetGain)
      }
      int.shared.isWarModeOn = false
      //rlog(`🔗🔗fx.chain() calling setValue(gain) now:`, {shared: int.shared, int, fx})
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
      
      fx.distributeGain(fx.isActive ? atm.gain : minGain)
      dumpChain(fx, `🔗fx.onActivated(${fx.zholger}) end`)
      hlog()
    }

    fx.distributeGain = (masterGain = atm.gain) => {
      const {shared} = int
      if (!shared) {
        slog(`Too early post() brought us here (after state restore?), skip!`, fx)
        return
      }
      if (shared.isWarModeOn) {
        return
      }
      shared.isWarModeOn = true
      glog(`🔗📊 %cdistributeGain(${fx.zholger}) masterGain=${masterGain}`, 'background: #ff8')
      //slog('callers')
      dumpChain(fx, '🔗📊 ')
      if (shared.activeChainLen > 1) {
        const othersAggregated = getAggregatedGain(shared.activeChainArr.filter(f => f !== fx))
        const remaining = shared.sumGain - masterGain // 3.5
        const factor = remaining / othersAggregated
        
        wassert(othersAggregated * 1.0001 >= minGain * (shared.activeChainLen - 1))
        rlog('🔗📊 dist tmp', {othersAggregated, remaining, factor, sumGain: shared.sumGain})
        
        shared.lastFixedFx = fx
        glog(`🔗📊 (BEFORE LOOP FOR NOT FIXED FXS) lastfixed set to ${fx.zholger}`, shared)
        for (const chainFx of shared.activeChainArr) {
          fx !== chainFx && chainFx.modifyGain(factor)
        }
        hlog() //: groupEnd
      }
      hlog()
      shared.isWarModeOn = false
    }
  }
  ratioFx.onActivated = fx => fx.onActivated()

  registerFxType('fx_ratio', ratioFx)    
})
