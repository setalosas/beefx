/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, indent, new-cap, block-spacing, comma-spacing,
   handle-callback-err, no-return-assign, camelcase, yoda, object-property-newline,
   no-void, quotes, no-floating-decimal, import/first, space-unary-ops, brace-style, 
   standard/no-callback-literal, object-curly-newline */
/* eslint-disable no-unused-vars */
   
import * as pgIm from './improxy-esm.js'

const {Corelib, BeeFX, Sources, StateManager, StageManager, createUI} = pgIm
const {s_a, undef, isFun, isNum, getRnd} = Corelib
const {wassert, weject} = Corelib.Debug
const {schedule, adelay, NoW, startEndThrottle, post} = Corelib.Tardis

const createPlayground = async root => {
  const {waCtx, ui} = root
  const beeFx = root.beeFx = BeeFX(waCtx)
  const {namesDb, onReady: onBeeReady, getFxType} = beeFx
  await onBeeReady()
  
  ui.configNames(namesDb)
  
  const output = waCtx.createGain()
  
  const stageMan = StageManager.createStageManager(root)
  const {getStage} = stageMan

  const pg = {
    beeFx,
    stageMan, //+ PFUJ de sourcesnek kell es fxpaneluinak is
    lastSentAt: 0,
    lastReceivedAt: 0,
    senderStage: undef,   //: the stage object
    listenerStage: undef, //: the stage object
    meState: {},
    meStateHash: '',
    fingerPrint: getRnd(100000, 999999),
    getFxType
  }
  
  pg.sources = Sources.createSources(pg, root)
  //pg.players = Players.extendWithPlayers(pg, root)
  //const {radio} = pg.players
  
  //8#a66 ----------- Change core playground Fxs -----------
    
  pg.changeFx = (stageId, ix, type) => stageMan.changeFx({stageId, ix, type})
  
  //8#46f ------------- Sync control: Master/slave stage settings -------------
  
  const activateMaster = stageId => {
    pg.senderStage = getStage(stageId)
    pg.isMaster = true
    pg.senderStage.fpo.panel.set('send', {class: 'active'}) 
  }
  const activateSlave = stageId => {
    pg.listenerStage = getStage(stageId)
    pg.isSlave = true
    pg.listenerStage.fpo.panel.set('listen', {class: 'active'}) 
  }
  const inactivateMaster = _ => {
    void pg.senderStage?.fpo.panel.set('send', {declass: 'active'}) 
    delete pg.senderStage
    pg.isMaster = false
  }
  const inactivateSlave = _ => {
    void pg.listenerStage?.fpo.panel.set('listen', {declass: 'active'}) 
    delete pg.listenerStage
    pg.isSlave = false
  }
  const clearSendersListeners = _ => {
    inactivateMaster()
    inactivateSlave()
  }
  pg.setSenderStage = (stageId = -1) => {
    stageId === -1 && (stageId = 0) //: or getStageGroup's last Index
    const newSenderStage = getStage(stageId)
    clearSendersListeners()
    activateMaster(newSenderStage)
  }
  pg.setListenerStage = stageId => {
    const newListenerStage = getStage(stageId)
    clearSendersListeners()
    activateSlave(newListenerStage)
  } 
  
  //8#59c  ---------------- Stage init / change ----------------
  
  pg.addStage = letter => {
    const stPars = {hasEndSpectrum: root.config.showEndSpectrums, hasEndRatio: true, hasUi: true}
    const stage = stageMan.createStage({letter}, stPars)
    const {stageIx} = stage
    stage.changeFx({ix: 0, type: 'fx_gain', params: {isFixed: true, hasStageMark: true}})
    stage.output.connect(output)
    return stageIx
  }
  
  pg.destroyLastBlanks = _ => stageMan.iterateStandardStages(stage => stage.destroyLastBlanks())
  
  pg.rebuildStage = stageId => getStage(stageId)?.rebuild() //: re ui regen click

  pg.activateStage = (stageId, on) => getStage(stageId)?.activate(on)
  
  //8#c78 --------- Entry point / init --------- 
  
  const init = _ => {
    console.log(BeeFX(waCtx).fxHash)
    output.connect(waCtx.destination)
    //pg.players.init()
    //pg.players.initRadioListeners()
  }
  
  pg.initMixerStages = _ => {
    pg.localStage = stageMan.createStage({letter: pg.localStageLetter = 'LOC'})
    pg.localStageIx = pg.localStage.stageIx
    pg.remoteStage = stageMan.createStage({letter: pg.remoteStageLetter = 'REM'})
    pg.remoteStageIx = pg.remoteStage.stageIx
    pg.faderStage = stageMan.createStage({letter: pg.faderStageLetter = 'FAD'})
    pg.faderStageIx = pg.faderStage.stageIx
  }
  
  pg.changeDestination = newDestination => { //: not used
    output.disconnect()
    output.connect(newDestination)
  }
    
  pg.addFx = (stageId, name) => stageMan.addFx(stageId, name)
  
  pg.loadPreset = actPreset => {
    const stageNames = []
    
    for (const key in actPreset) {
      stageNames.includes(key) || stageNames.push(key)
    }
    stageNames.sort()
    console.log({stageNames})
    for (const stageName of stageNames) {
      pg.addStage(stageName)
    }      
    for (const key in actPreset) {
      const arr = actPreset[key]
      for (const fx of arr) {
        fx && pg.addFx(key, fx[2] === '_' ? fx : ('fx_' + fx)) 
      }
    }
  }
  
  pg.reloadWithProject = projName => {
    root.stateManager.setActProject(projName)
    window.location.href = window.location.href // eslint-disable-line no-self-assign
  }
  
  pg.loadProjectOnStart = async projName => {
    console.log('project load START')
    const project = root.stateManager.loadProject(projName)
    if (project) {
      const {stageLetters, stages, sourceRequests = [], flags = {}} = project
      console.log('flags loaded:', {flags})

      for (const key in flags) {
        key.slice(-2) === 'On' || ui.setFlag(key, flags[key])
      }
      
      for (const {method, sourceIx, par} of sourceRequests) {
        void ui[method]?.(sourceIx, par)
      }
      
      for (const stageName of stageLetters) {
        pg.addStage(stageName)
        const {state, sourceIx} = stages[stageName]
        const stage = stageMan.getStage(stageName)
        stage.loadState(state)
        while (sourceIx > 0 && !pg.sources.sourceArr[sourceIx]) { // eslint-disable-line
          console.log('wait for', sourceIx)
          await adelay(1000)
        }
      }
      schedule(0).then(_ => {
        for (const stageName of stageLetters) {
          const {sourceIx} = stages[stageName]
          sourceIx !== -1 && pg.sources.changeStageSourceIndex(stageName, sourceIx)
        }
      })
    } else {
      console.warn(`No such project in storage:`, projName)
    }
    console.log('project load END')
  }
  
  pg.saveProject = (projName, projDesc = '') => {
    const stageLetters = []
    const stages = {}
    stageMan.iterateStandardStages(stage => {
      stageLetters.push(stage.letter)
      stages[stage.letter] = {state: stage.saveState(), sourceIx: stage.sourceIx}
    })
    const sourceRequests = []
    ui.iterateSourceUis(sourceUi => {
      sourceUi.request && sourceRequests.push(sourceUi.request)
    })
    const {flags} = root
    console.log('flags saved:', {flags})
    const project = {projDesc, stageLetters, stages, sourceRequests, flags}
    root.stateManager.saveProject(project, projName)    
  }
  
  pg.createNewProject = projDesc => {
    const stageLetters = []
    stageMan.iterateStandardStages(stage => {
      stageLetters.push(stage.letter)
    })
    const projName = stageLetters.join('') + getRnd(100, 999) //: tmp: we have a projectname
    pg.saveProject(projName, projDesc)
  }

  init()
  
  return pg
}

//8#b39 All entry points are here (beeFxPlayground site, CromBee, Patashnik)

export const runPlaygroundWithin = async (waCtx, options) => { //: no mediaE, ABSNs will be added
  const config = {
    maxSources: 8,
    ...options
  }
  const root = {
    config,
    waCtx,
    mediaElement: null,
    ...options
  }
  root.ui = createUI(root)
  const playground = await createPlayground(root)
  root.pg = playground
  await root.ui.start(playground)
  return {root, playground}
}

export const runPlayground = async root => { //: we may have a mediaElement in root
  const ui = root.ui = createUI(root)
  root.midi = pgIm.TestMidi?.createTestMidi(ui) //: MIDI test, can be deleted
  const playground = await createPlayground(root)
  root.pg = playground
  await ui.start(playground)

  const setupName = root.onYoutube 
    ? root.killEmAll ? 'youtubeFull' : 'youtubeDefault'
    : 'last'
  
  const parent$ = root.config.presetDisplayOn ? document.body : undef
  
  root.stateManager = StateManager.create(root)
  
  root.stateManager.getActualPreset({name: setupName, parent$})
    .then(async ({actPreset, actProject}) => {
      actPreset && playground.loadPreset(actPreset) //: a name minek?
      actProject && await playground.loadProjectOnStart(actProject)

      ui.finalize()

      //: this should work delayed too (no video on non-watch youtbe pages in the first 10 sec)
      root.onYoutube
        ? root.mediaElement && ui.changeVideoElementSource(1, root.mediaElement)
        : playground.sources.getValidSourcesCnt() || ui.setFlag('sourceList', true)//if no sources
    })
}
