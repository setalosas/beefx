/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, WaapiWrap} from '../improxy-esm.js'

const {wassert} = Corelib.Debug
const {round, PI, log} = Math

WaapiWrap.onRun(waCtx => {
  const {connectArr, registerFxType, newFx} = BeeFX(waCtx)

  const bpmTransformerFx = { //8#e74 ------- bpmTransformer -------
    def: {
      bpmOriginal: {defVal: 120, min: 0, max: 300, subType: 'skipui'},
      bpmModified: {defVal: 120, min: 100, max: 140}, //+ int 
      playbackRate: {defVal: 1, min: 0.33, max: 3, subType: 'skipui'},
      media: {defVal: null, type: 'object', subType: 'skipui'},
      offset: {defVal: 0, min: -1, max: 1, subType: 'skipui'},//+vagy nem is kell
      pitchCorrection: {defVal: false, type: 'boolean'}
    }
  }
  
  bpmTransformerFx.setValue = (fx, key, value, {ext} = fx) => ({
    bpmOriginal: _ => {
      ext.bpmOriginal = value
      fx.setValue('bpmModified', value) //: will call  recalcOnChange
    },
    bpmModified: _ => {
      ext.bpmModified = value
      ext.recalcOnChange(key)
    },
    playbackRate: _ => {
      ext.playbackRate = value
      ext.media && (ext.media.playbackRate = value)
      ext.media && console.log('playbackrate modified', value)
    },
    media: _ => ext.media = value,
    offset: _ => {
      ext.offset = value
      ext.recalcOnChange(key) //: read only! this branchh is not valis
    },
    pitchCorrection: _ => {
      ext.pitchCorrection = value
      ext.recalcOnChange(key)
    }
  }[key])

  bpmTransformerFx.construct = (fx, pars, {ext} = fx) => {
    ext.pitchShifter = newFx('fx_pitchShifter') //: def params = no shift
    fx.start.connect(fx.output)
    
    const insertPitchShifter = _ => {
      if (!ext.isPitchShifterOn) {
        ext.pitchShifter.connect(fx.output)
        fx.start.disconnect()
        fx.start.connect(ext.pitchShifter)
        ext.isPitchShifterOn = true
        console.log('pitch inserted')
      }
    }
    const removePitchShifter = _ => {
      if (ext.isPitchShifterOn) {
        fx.start.disconnect()
        fx.start.connect(fx.output)
        ext.pitchShifter.disconnect()
        ext.isPitchShifterOn = false
        console.log('pitch removed')
      }
    }
    ext.recalcOnChange = src => { //: offset: man, bpmmod: do it, pitchCorr: do it
      fx.setValue('playbackRate', ext.bpmModified / ext.bpmOriginal)

      if (ext.pitchCorrection && ext.playbackRate !== 1) {
        insertPitchShifter()
        const ratio = log(ext.bpmModified) / log(ext.bpmOriginal)
        const newOffset = ratio - 1
        if (src !== 'offset') {
          fx.setValue('offset', newOffset) //:prevent endless loop
        }
        console.log('bpmtrans mod', newOffset)
        ext.pitchShifter.setValue('offset', newOffset)
      } else {
        removePitchShifter()
        console.log('bpmtrans mod', 0)
        ext.pitchShifter.setValue('offset', 0)
      }
    }
  }
  
  registerFxType('fx_bpmTransformer', bpmTransformerFx)
})
