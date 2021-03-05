/* eslint-disable spaced-comment, object-curly-spacing */

//import { konfigurator, rootKonf } from './beefxkonfig-esm.js'

import * as Corelib from '../res/esm/stdlib/corelib-esm.js'
import * as Logre from '../res/esm/stdlib/logre-esm.js'
import { createStore } from '../res/esm/stdlib/store-esm.js'
import * as Vomitter from '../res/esm/libs/vomitter-esm.js'
import * as DOMplusUltra from '../res/esm/dom/dom-plus-ultra-esm.js'
import * as DragaDOM from '../res/esm/dom/dragadome-esm.js'
import { DragWithDOM } from '../res/esm/dom/dragwdom-esm.js'

import * as WaapiWrap from './libs/wautils-esm.js'

import { BeeFX } from './beefx/beefx-esm.js'
import './beefx/beefxs-basic-esm.js'
import { createUI } from './ui-esm.js'

export {
  //konfigurator as pataKonfig, rootKonf,

  Corelib, Logre, createStore,
  Vomitter, DOMplusUltra, DragaDOM, DragWithDOM,
  WaapiWrap, BeeFX, createUI
}
