/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {undef, nop, no, yes, isArr} = Corelib // eslint-disable-line
const {wassert} = Corelib.Debug
const {max} = Math

onWaapiReady.then(waCtx => {
  const {registerFxType, connectArr} = BeeFX(waCtx)
  
  const logRatio = false
  const rlog = (...args) => logRatio && console.log(...args)
  const slog = (...args) => logRatio && console.warn(...args) // eslint-disable-line
  const glog = (...args) => logRatio && console.group(...args)
  const hlog = _ => logRatio && console.groupEnd()
  
  const ratioFx = { //8#666 ------- ratio -------
    def: {
      solo: {defVal: 'off', type: 'cmd', name: 'Solo'},
      same: {defVal: 'off', type: 'cmd', name: '==='},
      regen: {defVal: 'off', type: 'cmd', name: 'Regen'},
      save: {defVal: 'off', type: 'cmd', name: 'Save'},
      master: {defVal: 'off', type: 'cmd', subType: 'led', color: 0, name: 'Master'},
      slave: {defVal: 'off', type: 'cmd', subType: 'led', color: 50, name: 'Slave'},
      gain: {defVal: .25, min: 0.00001, max: 1.00001, name: 'Stage ratio'},
      onCmd: {defVal: nop, subType: 'skipui'}
    }
  }
  
  ratioFx.setValue = (fx, key, value, {int} = fx) => ({
    gain: _ => {
      fx.setAt('gain', 'gain', value)
      fx.distributeGain()
    }
  }[key] || (_ => fx.cmdProc(value, key)))
  
  const getAggregatedGain = arr => arr.reduce((acc, fx) => acc + fx.atm.gain, 0)
  
  const dumpChain = (fx, msg, {int} = fx) => {
    if (yes) {
      const {shared} = int
      const tab = []
      for (const chainFx of shared.chainArr) {
        const {zholger, isActive} = chainFx
        const gain = chainFx.atm.gain.toFixed(3)
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
    
    fx.cmdProc = (fire, op) => {
      if (fire === 'fire') {
        const action = {
          solo: _ => {
            const {shared} = int
            const wasSolo = fx === shared.soloFx
            shared.isWarModeOn++
            for (const chainFx of shared.chainArr) {
              void chainFx.atm.onCmd?.({op: 'activate', par: fx === chainFx || wasSolo})
              chainFx.setValue('solo', fx === chainFx && !wasSolo ? 'on' : 'off')
            }
            shared.isWarModeOn--
            if (wasSolo) {
              fx.setValue('gain', shared.origSoloGain)
              shared.soloFx = undef
            } else {
              shared.origSoloGain = atm.gain
              fx.setValue('gain', 1)
              shared.soloFx = fx
            }
          },
          same: _ => fx.isActive && fx.level()
        }[op]
        action ? action() : void fx.atm.onCmd?.({op})
      }
    }

    fx.chain = (...arr) => { //: rewrites all shareds created previously, but others not!
      arr = isArr(arr[0]) ? arr[0] : arr
      const chainArr = [fx, ...arr.filter(f => f !== fx)] //: no duplicates!
      const chainLen = chainArr.length
      const sumGain = maxGain + minGain * (chainLen - 1)
      const resetGain = sumGain / chainLen
      int.shared = {chainArr, chainLen, sumGain, resetGain, isWarModeOn: 1}
      
      rlog(`🔗🔗fx.chain() calling setValue(gain) loop now:`)
      for (const chainedFx of chainArr) {
        chainedFx.int.shared = int.shared
        chainedFx.setValue('gain', resetGain)
      }
      int.shared.isWarModeOn--
      rlog(`🔗🔗fx.chain() calling setValue(gain) now:`, {shared: int.shared, int, fx})
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
      if (!shared || shared.isWarModeOn) {
        return
      }
      shared.isWarModeOn++
      glog(`🔗📊 %cdistributeGain(${fx.zholger}) masterGain=${masterGain}`, 'background: #ff8')
      //slog('callers')
      dumpChain(fx, '🔗📊 ')
      if (shared.activeChainLen > 0) {
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
      shared.isWarModeOn--
    }
    
    fx.level = _ => {
      const {shared} = int
      if (shared.activeChainLen) {
        const fixedGain = maxGain / shared.activeChainLen
        for (const chainFx of shared.activeChainArr) {
          chainFx.setValue('gain', fixedGain)
        }
      }
    }
  }
  ratioFx.onActivated = fx => fx.onActivated()

  registerFxType('fx_ratio', ratioFx)    
})
