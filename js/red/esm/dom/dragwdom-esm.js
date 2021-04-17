/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, object-curly-newline,
   standard/no-callback-literal */

import * as Corelib from '../stdlib/corelib-esm.js'
import * as DOMplusUltra from './dom-plus-ultra-esm.js'

//8#ac5 DragwDOM - normal drag with built-in DOM methods

const {undef, s_a} = Corelib
const {wassert} = Corelib.Debug
const {NoW} = Corelib.Tardis
const {set$, haltEvent} = DOMplusUltra

const createDragWithDOM = _ => { 
  const ddrag = {
    dragOn: false,
    draggedSrc: undef,
    dragDst: undef,
    lastData: undef,
    dridHash: {}
  }
  
  const wlog = console.warn
  const llog = console.log
  const slog = (...args) => console.log('🔷' + args.shift(), ...args)
  const dlog = (...args) => console.log('🟩' + args.shift(), ...args)
  const olog = (...args) => console.log('🟠' + args.shift(), ...args)
  const plog = (...args) => console.log('🟦' + args.shift(), ...args)
  const qlog = (...args) => console.log('🟧' + args.shift(), ...args)
  const klog = (...args) => console.log('⬜️' + args.shift(), ...args)
    
  const getDragData = event => event.dataTransfer.getData('text/plain') + event.target.className
  
  //8#6a4 draggable handlers
    
  const postDragStart = (event, src$, data) => {//:called with (event, src$)
    if (event.dataTransfer) {
      ddrag.dragOn = true
      ddrag.draggedSrc = src$
      ddrag.dragDst = undef
      ddrag.dragModDst = undef
      ddrag.lastMod = undef
      ddrag.draggedData = data
      set$(src$, {class: 'dragged'})
      wassert(event.dataTransfer)
      event.dataTransfer.dropEffect = ddrag.dragType = event.shiftKey ? 'copy' : 'move'
      event.dataTransfer.effectAllowed = 'all'
      event.dataTransfer.setData('text/plain', data)
      
      slog(`dragstart with data ${getDragData(event)}`, {event, data: 'macko'})
      //console.log(event.dataTransfer)
    } else {
      wlog(`Check this event.dataTransfer thingy out! It's undef?? $.originalEvent?`, event)
    }
  }  
  const postDragEnd = (event, src$) => {//:called with (event, src$)
    if (ddrag.dragOn) {
      ddrag.dragOn = false
      if (ddrag.draggedSrc && ddrag.dragDst) {
        slog(`drag ended: `, ddrag.draggedSrc, ddrag.dragDst)
      }
      
      set$(src$, {declass: 'dragged'})
      ddrag.dragDst && set$(ddrag.dragDst, {declass: 'dragover'})
      
      ddrag.draggedSrc = undef
      ddrag.dragDst = undef
      slog(`dragend with data ${getDragData(event)}`, {event, src$})
      //console.log(event.dataTransfer)
    }
  }
  
  //8#66e dragTarget handlers
  
  const postDragEnter = (event, dst$, callback) => {
    const drid = wassert(dst$.getAttribute('drid'))
    ddrag.dridHash[drid] || (ddrag.dridHash[drid] = {})
      ddrag.dridHash[drid].lastDragEnterAt = NoW()
    const drmod = dst$.getAttribute('drmod')
    if (drmod) {
      plog('dragenter MOD only', drid, drmod)
      ddrag.lastMod = drmod
      ddrag.dragModDst && set$(ddrag.dragModDst, {declass: 'dragovermod'})
      ddrag.dragModDst = dst$
      set$(dst$, {class: 'dragovermod'})
    } else {
      dlog('dragenter', drid)
      ddrag.dragDst && set$(ddrag.dragDst, {declass: 'dragover'})
      ddrag.dragDst = dst$
      set$(ddrag.dragDst, {class: 'dragover'})
    }
    haltEvent(event)
  }
  const postDragLeave = (event, dst$, callback) => {
    const drid = wassert(dst$.getAttribute('drid'))
    const drmod = dst$.getAttribute('drmod')
    if (NoW() - ddrag.dridHash[drid]?.lastDragEnterAt < 4) {
      klog('----dragleave SKIPPED (too early)', {drid, drmod}, ddrag.dridHash[drid], NoW())
    } else {
      if (drmod) {
        plog('dragleave MOD only', drid, drmod, ddrag.lastMod)
        ddrag.lastMod = undef
        set$(dst$, {declass: 'dragovermod'})
        if (dst$ === ddrag.dragModDst) {
          ddrag.dragModDst = undef
        }
      } else {
        if (ddrag.lastMod) {
          klog('----dragleave SKIPPED (lastMod)', drid, ddrag.lastMod, NoW())
        } else {
          qlog('dragleave', drid)
          set$(dst$, {declass: 'dragover'})
          if (dst$ === ddrag.dragDst) {
            ddrag.dragDst = undef
          }
        }
      }
    }
  }
  const postDrop = (event, dst$, callback) => {
    const drid = wassert(dst$.getAttribute('drid'))
    dlog('dragdrop', drid)
    const data = event.dataTransfer.getData('text/plain')
    olog(`DROPPED: ${data} ->}`, ddrag.dragDst)
    //callback(data + ' / ' + ddrag.draggedData) nem bizunk ebben a datatransferben :-(
    set$(dst$, {declass: 'dragover dragovermod'})
    callback(ddrag.draggedData, ddrag.lastMod)
  }
  
  //8#c78 ezek igazabol csak a tulellenorzes miatt vannak
    
  const draggableHandler = (event, item$, data) => {//:felesleges az item, de biztosabb
    //llog('draggableHandler', event.type, item$, event.target, event.currentTarget)
    
    const post = fun => fun()
    
    event.type === 'dragstart' && post(_ => postDragStart(event, item$, data))
    event.type === 'dragend' && post(_ => postDragEnd(event, item$, data))
    
    s_a(`dragstart,dragleave,dragover,drag`).includes(event.type) ||
      llog(`ANYAD:`, event.type, event)
      
    if (event.type !== 'dragstart' && event.type !== 'drag') {
      haltEvent(event)      
      return false
    }
  }
  const dragTargetHandler = (event, item$, callback) => {//:felesleges az item, de biztosabb
    //llog('dragTargetHandler', event.type, item$, event.target, event.currentTarget)
    
    const post = fun => fun()
    
    event.type === 'dragenter' && post(_ => postDragEnter(event, item$, callback))
    event.type === 'dragleave' && post(_ => postDragLeave(event, item$, callback))
    event.type === 'drop' && post(_ => postDrop(event, item$, callback))
    
    s_a(`dragenter,dragleave,dragover,drag`).includes(event.type) ||
      llog(`ANYAD:`, event.type, event)
      
    if (event.type !== 'drag') {
      haltEvent(event)      
      return false
    }
  }
  ddrag.addDraggable = (src$, data) => {
    set$(src$, {attr: {draggable: 'true'}, on: {
      dragstart: event => draggableHandler(event, src$, data),
      drag: event => draggableHandler(event, src$, data),
      dragend: event => draggableHandler(event, src$, data)
    }})
    return src$
  }
  ddrag.addDragTarget = (dst$, callback) => {
    set$(dst$, {on: {
      dragenter: event => dragTargetHandler(event, dst$, callback),
      dragover: event => dragTargetHandler(event, dst$, callback),
      dragleave: event => dragTargetHandler(event, dst$, callback),
      drop: event => dragTargetHandler(event, dst$, callback)
    }})
    return dst$
  }

  return ddrag
}

export const DragWithDOM = createDragWithDOM()

/* eslint-disable */
/* 
const dis$ = div$({class: 'be-fxframe', attr: {hidden}, css: {__fxhue: info.hue}}, [
  addDraggable(div$({class: 'be-title', attr: {fxscript}, text: info.dispName}), name),
  div$({class: 'be-st led-fx fix-on', attr: {fxstate}, 
    click: _ => set$(dis$, {attr: {hidden: filterix.toggleHidden(name)}})}),
  div$({class: 'be-info', text: info.onePerTrak ? `max 1 / trk` : ''}),
  parsRama$
])


const dragDropped = (data, mod) => {
  console.log('DROPPPP', {data, mod})
  mixer.addDroppedFxToAll(data, mod) // dis.lastTarget || 0))
}
div$(parent$, {class: 'kaos-right-on-drag'}, [
  addDragTarget(div$({class: 'dragarea row1', attr: {drid: 'X1', drmod: '1'}, html: 'Replace <strong>upper</strong> Fx in every track.', on: {
    mouseenter: _ => console.log(dis.lastTarget = 1),
    mouseleave: _ => console.log(dis.lastTarget = 0)
  }}), dragDropped),
  addDragTarget(div$({class: 'dragarea row2', attr: {drid: 'X2', drmod: '2'}, html: 'Replace <strong>lower</strong> Fx in every track.', on: {
    mouseenter: _ => console.log(dis.lastTarget = 2),
    mouseleave: _ => console.log(dis.lastTarget = 0)
  }}), dragDropped),  
  div$({class: 'dragarea free', html: 'Add first <strong>empty</strong> Fx in every track.'})
])
addDragTarget(parent$, dragDropped) */