/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   no-unused-vars, standard/no-callback-literal, object-curly-newline */
   
import {Corelib, DOMplusUltra} from '../improxy-esm.js'

const {Ø, undef, isNum, isFun, nop, clamp, s_a} = Corelib
const {wassert, weject, brexru} = Corelib.Debug
const {post, startEndThrottle} = Corelib.Tardis
const {secToString} = Corelib.DateHumanizer
const {div$, leaf$, set$, setClass$, q$$, iAttr, haltEvent, canvas$} = DOMplusUltra
const {round} = Math

//8#49f -------------------------- Stages ui --------------------------

export const extendUi = ui => { //: input: ui.sourceStrip$ (empty)
  const {root, pg} = ui
  const {sources} = pg

  const stageHash = {} //: hash instead of an array ([0 1 2 3 5 6 101 102] are possible)
  const stageLetterHash = {} 
    
  ui.capture({stageHash, stageLetterHash})  //+ ezt nem szabad hasznalni!!!!
  
  ui.iterateStageObjects = callback => {
    for (const stageIx in stageHash) {
      const stageObj = stageHash[stageIx]
      stageObj && callback(stageObj)
    }
  }
  ui.getStageObj = stageIx => 
    stageHash[stageIx] || console.warn(`Invalid stage index: ${stageIx}`)
  
  ui.addStage = (stage, parent$ = ui.mid$, pars = {}) => {//+bena ez az opcionalis parent
    const {stageIx, letter, isStandardStage, hasEndSpectrum} = stage
    
    const stageObj = {
      stage,
      letter,
      stageIx,             //: stage index
      isStandardStage,
      fxPanelObjArr: [],    //:fx panel objects in the stage
      ...pars
    }
    
    //+LETTER-re kene atirni classokat is meg mindent
    
    const cc = 'bfx-stage bfx-st' + (stageIx + 1) + ' bfx-st-' + letter + (hasEndSpectrum ? '' : ' noendspectrum')
            
    set$(parent$, {}, 
      stageObj.frame$ = div$({class: cc}, [
        stageObj.inputSelector$ = isStandardStage && div$({class: 'input-selector'}),
        stageObj.ramas$ = div$({class: 'bfx-ramas'}),
        stageObj.bottomFrame$ = !stageObj.hasNoBottom && div$({class: 'st-bottomframe'}, [
          stageObj.endRatio$ = div$({class: 'bfx-rama isEndRatio'}),
          stageObj.spectrama$ = hasEndSpectrum && div$({class: 'st-spectrum huerot'},
            stageObj.spectcanv$ = canvas$())
        ])   
      ]))
    return stageHash[stageIx] = stageLetterHash[letter] = stageObj //eslint-disable-line no-return-assign
  }

  ui.resetStage = stageIx => { //:nothing to do? NOT USED
    // endratioba az ujat kell befuzni, pl volume? led!
  }
  
  ui.createInputDispatchers = sourceIxArr => ui.iterateStageObjects(stageObj => {
    const {stageIx, isStandardStage} = stageObj
    if (isStandardStage) {
      //console.log('found a stage to dispatch to', stageIx, stageObj)
      const chg = sourceIx => _ => sources.changeStageSourceIndex(stageIx, sourceIx)
      stageObj.inputCmd$ = []
      set$(stageObj.inputSelector$, {class: 'blue'}, [
        div$({class: 'input-selbg huerot'}),
        div$({class: 'input-label', text: 'Input:'}),
        div$({class: 'input-cmd bee-cmd', text: 'M'}),
        ...sourceIxArr.map((sourceIx, ix) => 
          stageObj.inputCmd$[ix] = div$({class: 'input-cmd bee-cmd', text: 'In ' + sourceIx,
            attr: {sourceIx, state: 'off'}, click: chg(sourceIx)}))
      ])
    }
  })

  ui.setStageInputState = (stageIx, sourceIx) => {
    const stageObj = ui.getStageObj(stageIx)
    if (stageObj?.inputCmd$?.length) {
      for (const inCmd$ of stageObj.inputCmd$) {
        const inputSourceIx = iAttr(inCmd$, 'sourceIx')
        if (sources.getSource(inputSourceIx)) {
          set$(inCmd$, {attr: {state: sourceIx === inputSourceIx ? 'active' : 'on'}})
        } else {
          weject(sourceIx === inputSourceIx)
          set$(inCmd$,{attr: {type: 'off'}})
        }
      }
    } else {
      //console.warn(`ui.setStageInputState called too early`)
    }
  }
    
  const init = _ => {
  }
  
  init()
}
