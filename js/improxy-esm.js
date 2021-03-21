/* eslint-disable spaced-comment, object-curly-spacing */

import * as Corelib from '../res/esm/stdlib/corelib-esm.js'
import * as Logre from '../res/esm/stdlib/logre-esm.js'
import { createStore } from '../res/esm/stdlib/store-esm.js'
import * as Vomitter from '../res/esm/libs/vomitter-esm.js'
import * as DOMplusUltra from '../res/esm/dom/dom-plus-ultra-esm.js'
import { DragWithDOM } from '../res/esm/dom/dragwdom-esm.js'
//import * as YTPlayer from '../res/esm/webapis/youtube/fu3b-player-wrap-esm.js'
import '../res/esm/ui/fx/led-fx-esm.js'

import { createBiquadGrapher } from './libs/biquadgraph-esm.js'
import { createCompressorGrapher } from './libs/compressorgraph-esm.js'
import * as Visualizer from './libs/visualizer-esm.js'
import * as WaapiWrap from './libs/wautils-esm.js'
import { BeeFX } from './beefx/beefx-esm.js'
import * as Chebyshev from './beefx/chebyshev-math-esm.js'
import './beefx/jungle.js'
import './beefx/beefxs-basic-esm.js'
import './beefx/beefxs-ratio-esm.js'
import './beefx/beefxs-amp-esm.js'
import './beefx/beefxs-delays-esm.js'
import './beefx/beefxs-noise-esm.js'
import './beefx/beefxs-reverb-esm.js'
import './beefx/beefxs-compressor-esm.js'
import './beefx/beefxs-lfo-esm.js'
import './beefx/beefxs-chorus-esm.js'
import './beefx/beefxs-osc-esm.js'
import './beefx/beefxs-env-esm.js'
import './beefx/beefxs-iir-esm.js'
import './beefx/beefxs-bpmtrans-esm.js'
import { detectBPMa } from './beefx/bpma-esm.js'
import { detectBPMj } from './beefx/bpmj-esm.js'
import { createBPMAuditor } from './beefx/beefx-bpm-esm.js'
import * as Sources from './pg-sources-esm.js'
import * as Players from './pg-players-esm.js'
import * as Playground from './playground-esm.js'
import * as FxUi from './ui-fxpanel-esm.js'
import * as MixerUi from './ui-mixer-esm.js'
import { createUI } from './ui-esm.js'

export {
  Corelib, Logre, createStore, Vomitter, DOMplusUltra, DragWithDOM, // YTPlayer,
  WaapiWrap, BeeFX, Sources, Players, Playground,
  Chebyshev, detectBPMa, detectBPMj, createBPMAuditor,
  Visualizer, createBiquadGrapher, createCompressorGrapher,
  FxUi, MixerUi, createUI
}
