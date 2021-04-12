/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   standard/no-callback-literal, object-curly-newline */
   
import {Corelib, DOMplusUltra, onWaapiReady, Playground, createUI} from './improxy-esm.js'

const {adelay} = Corelib.Tardis
const {onDomReady} = DOMplusUltra

const config = {
  showEndSpectrums: false,
  sourceListDisplayOn: true,
  presetDisplayOn: true,
  maxSources: 8
}

onDomReady(async _ => {
  await adelay(1000)// = await onBeeFxExtReady() - that can't be implemented easily
  
  const root = {
    config,
    waCtx: await onWaapiReady,
    mediaElement: null
  }
  root.ui = createUI(root)
  Playground.runPlayground(root)
})
