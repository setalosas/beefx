/* eslint-disable spaced-comment, object-curly-spacing */

import * as Corelib from './res/esm/stdlib/corelib-esm.js'
import * as Logre from './res/esm/stdlib/logre-esm.js'
import { createStore } from './res/esm/stdlib/store-esm.js'
import * as Vomitter from './res/esm/libs/vomitter-esm.js'
import * as DOMplusUltra from './res/esm/dom/dom-plus-ultra-esm.js'
import { DragWithDOM } from './res/esm/dom/dragwdom-esm.js'
import './res/esm/ui/fx/led-fx-esm.js'

import {onReady as onWaapiReady} from './wautils-esm.js'

import { createGraphBase } from './vis/graphbase-esm.js'
import * as Visualizer from './vis/visualizer-esm.js'
import { BeeFX } from './beefx-esm.js'

import './fxs/beefxs-basic-esm.js'
import './fxs/beefxs-ratio-esm.js'
import './fxs/beefxs-amp-esm.js'
import './fxs/beefxs-equalizer-esm.js'
import './fxs/beefxs-delays-esm.js'
import './fxs/beefxs-noise-esm.js'
import './fxs/beefxs-reverb-esm.js'
import './fxs/beefxs-compressor-esm.js'
import './fxs/beefxs-lfo-esm.js'
import './fxs/beefxs-chorus-esm.js'
import './fxs/beefxs-pitchshifter-esm.js'
import './fxs/beefxs-osc-esm.js'
import './fxs/beefxs-env-esm.js'
import './fxs/beefxs-overdrive-esm.js'
import * as Chebyshev from './fxs/chebyshev-math-esm.js'
import './fxs/beefxs-iir-esm.js'

import './ext/beext-oscillator-esm.js'
import './ext/beext-oscilloscope-esm.js'
import './ext/beext-spectrum-esm.js'

import './med/beefxs-bpmtrans-esm.js'
import { detectBPMa } from './med/bpma-esm.js'
import { detectBPMj } from './med/bpmj-esm.js'
import * as BPM from './med/bpm-auditor-esm.js'

export {
  Corelib, Logre, createStore, Vomitter, DOMplusUltra, DragWithDOM,
  onWaapiReady, BeeFX, Chebyshev, detectBPMa, detectBPMj, BPM, Visualizer, createGraphBase
}
