/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   standard/no-callback-literal, object-curly-newline */
  
import * as Corelib from '../stdlib/corelib-esm.js'
import * as DOMplusUltra from './dom-plus-ultra-esm.js'

const {nop, isStr} = Corelib
const {pinky} = Corelib.Tardis
const {leaf$} = DOMplusUltra
void isStr

//8#87d Redact - React/DOMplusUltra adapter - currently selects React if 'react' is in the URL

export const R = {
  useReact: window.location.href.includes('react'),
  isReady: pinky.promise('redact'),
  isProduction: false
}

void (async _ => {
  if (R.useReact) {
     if (R.isProduction) {
      await import('https://cdn.skypack.dev/react')
      await import('https://cdn.skypack.dev/react-dom')
    } else {
      await import('./react.development.js')
      await import('./react-dom.development.js')
    }
    const {React, ReactDOM} = window
    R.capture({React, ReactDOM})
    
    R.c = React.createElement
    
    R.extend = sa => sa.split(',').map(tag => R[tag] = (...args) => {
      delete args[0].re
      return R.c(tag, ...args)
    })
    R.extend('div,span,a,h1,h2,h3,strong,em,form,label,input,button,ol,ul,li')
    R.extendComp = CC => R[CC.name] = (...args) => R.c(CC, ...args)
    R.ext = R.extendComp
    R.Frag = (...args) => R.c(React.Fragment, ...args)
  } else {
    R.React = {
      createRef: _ => ({isRef: true}),
      forwardRef: fun => ({render: fun})
    }
    R.ReactDOM = {
      render: nop
    }
      
    R.c = (tag, par, ...children) => {
      if (children[0]?.isRef) {
        par.re = children.shift()
        return R.c(tag, par, ...children)
      }
      par.cclass = par.className
      par.css = par.style
      par.on = {
        click: par.onClick,
        mouseenter: par.onMouseEnter,
        mousemove: par.onMouseMove,
        change: par.onChange
      }
      try {
        const node = leaf$(tag, par, children)
        par.re && (par.re.current = node)
        console.log(node, tag, par, children)
        return node
      } catch (err) {
        console.error(err)
        console.log(tag, par, children)
        debugger
      }
    }
    
    R.extend = sa => sa.split(',').map(tag => R[tag] = (...args) => R.c(tag, ...args))
    R.extend('div,span,a,h1,h2,h3,strong,em,form,label,input,button,ol,ul,li')
    R.extendComp = CC => R[CC.name] = (...args) => R.c(CC, ...args)
    R.ext = R.extendComp
    R.Frag = (...args) => R.c('frag', ...args)
  }
  pinky.redact.resolve(R)
  console.log(`Redact resolved`)
})()
