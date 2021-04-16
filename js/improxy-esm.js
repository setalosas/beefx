/* eslint-disable spaced-comment, object-curly-spacing */

import * as Corelib from './red/esm/stdlib/corelib-esm.js'
import * as Store from './red/esm/stdlib/store-esm.js'
import * as DOMplusUltra from './red/esm/dom/dom-plus-ultra-esm.js'
//import { DragWithDOM } from './red/esm/dom/dragwdom-esm.js'

import { BeeFX, BPM, onWaapiReady, Visualizer, createGraphBase } from './beefx/beeproxy-esm.js'

import * as Midi from './red/esm/webapis/midi-interface-esm.js'
import * as TestMidi from './ui/ui-midi-esm.js'

import * as Sources from './pg-sources-esm.js'
import * as Players from './pg-players-esm.js'
import * as StateManager from './pg-states-esm.js'
import * as StageManager from './pg-stages-esm.js'

import * as FxUi from './ui/ui-fxpanel-esm.js'
import * as StagesUi from './ui/ui-stages-esm.js'
import * as PlayersUi from './ui/ui-players-esm.js'
import * as SourcesUi from './ui/ui-sources-esm.js'
import * as MixerUi from './ui/ui-mixer-esm.js'

import { createUI } from './ui/ui-esm.js'

import * as Playground from './playground-esm.js'

export {
  Corelib, Store, DOMplusUltra, Midi, TestMidi,
  onWaapiReady, BeeFX, BPM, Visualizer, createGraphBase,
  Sources, Players, StateManager, StageManager, Playground,
  StagesUi, FxUi, PlayersUi, SourcesUi, MixerUi, createUI
}
