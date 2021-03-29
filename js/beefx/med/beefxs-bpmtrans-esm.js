/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, BeeFX, onWaapiReady} from '../beeproxy-esm.js'

const {wassert} = Corelib.Debug
const {round, PI, log} = Math

onWaapiReady.then(waCtx => {
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
  
  bpmTransformerFx.setValue = (fx, key, value, {int} = fx) => ({
    bpmOriginal: _ => {
      int.bpmOriginal = value
      fx.setValue('bpmModified', value) //: will call  recalcOnChange
    },
    bpmModified: _ => {
      int.bpmModified = value
      int.recalcOnChange(key)
    },
    playbackRate: _ => {
      int.playbackRate = value
      int.media && (int.media.playbackRate = value)
      int.media && console.log('playbackrate modified', value)
    },
    media: _ => int.media = value,
    offset: _ => {
      int.offset = value
      int.recalcOnChange(key) //: read only! this branchh is not valis
    },
    pitchCorrection: _ => {
      int.pitchCorrection = value
      int.recalcOnChange(key)
    }
  }[key])

  bpmTransformerFx.construct = (fx, pars, {int} = fx) => {
    int.pitchShifter = newFx('fx_pitchShifter') //: def params = no shift
    fx.start.connect(fx.output)
    
    const insertPitchShifter = _ => {
      if (!int.isPitchShifterOn) {
        int.pitchShifter.connect(fx.output)
        fx.start.disconnect()
        fx.start.connect(int.pitchShifter)
        int.isPitchShifterOn = true
        console.log('pitch inserted')
      }
    }
    const removePitchShifter = _ => {
      if (int.isPitchShifterOn) {
        fx.start.disconnect()
        fx.start.connect(fx.output)
        int.pitchShifter.disconnect()
        int.isPitchShifterOn = false
        console.log('pitch removed')
      }
    }
    int.recalcOnChange = src => { //: offset: man, bpmmod: do it, pitchCorr: do it
      fx.setValue('playbackRate', int.bpmModified / int.bpmOriginal)

      if (int.pitchCorrection && int.playbackRate !== 1) {
        insertPitchShifter()
        const ratio = log(int.bpmModified) / log(int.bpmOriginal)
        const newOffset = ratio - 1
        if (src !== 'offset') {
          fx.setValue('offset', newOffset) //:prevent endless loop
        }
        console.log('bpmtrans mod', newOffset)
        int.pitchShifter.setValue('offset', newOffset)
      } else {
        removePitchShifter()
        console.log('bpmtrans mod', 0)
        int.pitchShifter.setValue('offset', 0)
      }
    }
  }
  
  registerFxType('fx_bpmTransformer', bpmTransformerFx)
})
