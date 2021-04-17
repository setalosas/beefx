/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, 
   standard/no-callback-literal, object-curly-newline */
/* eslint-disable no-unused-vars */   
   
import {Corelib, DOMplusUltra, DragWithDOM} from '../improxy-esm.js'

const {Ø, undef, isNum, isFun, nop, clamp, s_a, hashOfString} = Corelib
const {wassert, weject, brexru} = Corelib.Debug
const {post, startEndThrottle, schedule} = Corelib.Tardis
const {secToString} = Corelib.DateHumanizer
const {div$, leaf$, set$, setClass$, q$, q$$, haltEvent} = DOMplusUltra
const {addDraggable, addDragTarget} = DragWithDOM
const {round, abs} = Math

//8#49f --------------------------States ui --------------------------

export const extendUi = ui => {
  const {root, pg} = ui
  //const {stageMan, players, sources} = pg

  const states = {}
    
  const logOn = false
  const clog = (...args) => logOn && console.log(...args)
  
  const dragDroppedOnSlot = dstSlot => (data, mod) => {
    const [source, letter] = data.split('.')
    if (source === 'fromStage') {
      root.stateManager.onStageToSlotDrop({dstSlot, letter})
    } else if (source === 'fromSlot') {
      const srcSlot = parseInt(letter)
      root.stateManager.onSlotToSlotDrop({dstSlot, srcSlot})
    }
    buildStagePresetList(true)
  }
  
  const buildStagePresetList = on => {
    void ui.stagePresetList$?.remove()
    
    if (on) {
      const {slots} = root.stateManager
      wassert(slots.length)

      ui.stagePresetList$ = div$(ui.frame$, {class: 'state-stagelist-frame'}, 
        div$({class: 'st-stagelist-inframe'}, [
          div$(),
          ...slots.map((state, slot) => {
            const fxs = state.fxarr?.map(fx => pg.getFxType(fx.fxName).name).join(' ◻️ ')
            return addDragTarget(addDraggable(div$({
              class: 'st-stageslot',
              html: `<em>${slot}</em>` + fxs,
              attr: {drid: slot}
            }), 'fromSlot.' + slot), dragDroppedOnSlot(slot))
          })
        ]))
    }
  }
  
  ui.onStagePresetsToggled = buildStagePresetList
}
