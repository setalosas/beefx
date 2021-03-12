/* eslint-disable no-multi-spaces, object-curly-spacing, no-trailing-spaces, spaced-comment */

const timothyMoody = _ => {
  const {XMLHttpRequest, AudioContext, OfflineAudioContext} = window
  
  function createBuffers (url) {
    const request = new XMLHttpRequest()  // Fetch Audio Track via AJAX with URL

    request.open('GET', url, true)
    request.responseType = 'arraybuffer'

    request.onload = ajaxResponseBuffer => {
      // Create and Save Original Buffer Audio Context in 'originalBuffer'
      const audioCtx = new AudioContext()
      const songLength = ajaxResponseBuffer.total

      // Arguments: Channels, Length, Sample Rate
      const offlineCtx = new OfflineAudioContext(1, songLength, 44100)
      //const source = offlineCtx.createBufferSource()
      const audioData = request.response
      audioCtx.decodeAudioData(audioData, buffer => {
        window.originalBuffer = buffer.getChannelData(0)
        const source = offlineCtx.createBufferSource()
        source.buffer = buffer

        // Create a Low Pass Filter to Isolate Low End Beat
        const filter = offlineCtx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 140
        source.connect(filter)
        filter.connect(offlineCtx.destination)

        // Render this low pass filter data to new Audio Context and Save in 'lowPassBuffer'
        offlineCtx.startRendering().then(lowPassAudioBuffer => {
          const audioCtx = new AudioContext()
          const song = audioCtx.createBufferSource()
          song.buffer = lowPassAudioBuffer
          song.connect(audioCtx.destination)

          // Save lowPassBuffer in Global Array
          window.lowPassBuffer = song.buffer.getChannelData(0)
          console.log('Low Pass Buffer Rendered!')
        })
      },
      function (e) {})
    }
    request.send()
  }

  createBuffers('/au/cascandy.mp3')
}

timothyMoody()

const allegroBdpmDetector = _ => {
  import ext from "./utils/ext";
  import storage from "./utils/storage";

  import Display from "./allegro/display";
  import allegro from "./allegro/allegro";
  import j2c from "j2c";
  import style from "./allegro/style";
  import Recorder from "./allegro/recorder";
  import URL from "./allegro/url";

  // Init Project Config in Global
  global.allegro = {
    env: document.location.href.indexOf('youtube.com') == -1 ? 'development' : 'production',
    // Init j2c instance
    j2c: j2c(),
    // Init AudioContext
    audioContext: new (window.AudioContext || window.webkitAudioContext)()
  };
  // Get and init style
  global.allegro.sheet = global.allegro.j2c.sheet(style.css);

  var HTMLElement = allegro.getAudioElement();
  var recorder = null;

  // Display recorded sound
  storage.getDataStored((data) => {
    var display = new Display(data);
    display.addBPMinTitles();
    global.allegro.display = display;

    // Try to catch a HTMLElement

    // Recorder
    if (HTMLElement) {
      // Set recorder listener
      recorder = new Recorder({element: HTMLElement});
      recorder.listen();
    } else {
      console.log('No audio/video node found in this page !');
    }

    // Youtube Special Listener
    document.addEventListener("spfrequest", function () {
      recorder.clear();
      global.allegro.audioContext.suspend();
      console.log('spf request');
    }, false);
    document.addEventListener("spfdone", function () {
      global.allegro.audioContext.resume();
      storage.getDataStored((data) => {
        global.allegro.display.update(data);
      });
      console.log('spf done');
      //that.init();
    }, false);
  });


  ////////////////////////
  // DEVELOPMENT LISTENER
  ////////////////////////
  if (global.allegro.env == 'development') {
    document.getElementById('set-test-data').addEventListener('click', function (e) {
      e.preventDefault();
      console.log('set Data Test');
      storage.storeResultInStorage('c3c3c3', 125);
    }, true);
    document.getElementById('extension-analyse').addEventListener('click', function (e) {
      e.preventDefault();
      console.log('extension-analyse');
      recorder.listen();
      HTMLElement.play();
    });
    document.getElementById('extension-pause').addEventListener('click', function (e) {
      e.preventDefault();
      console.log('extension-pause');
      HTMLElement.pause();
    });
    document.getElementById('extension-stop').addEventListener('click', function (e) {
      e.preventDefault();
      console.log('extension-stop');
      HTMLElement.currentTime = 0;
      HTMLElement.pause();
    });

    window.onpopstate = function(e){
      if(e.state){
        document.title = e.state.pageTitle;
      }
    };

    var wait = setTimeout( function () {
      HTMLElement.play();
    }, 300);
  }
  ////////////////////////
  // END
  ////////////////////////


  var extractPageData = () => {
    var url = document.location.href;
    if(!url || !url.match(/^http/) || !HTMLElement) return {hasAudio: false};

    var data = {
      hasAudio: true,
      youtubeId: "",
      title: "",
      origin: "",
      duration: "",
      isAnalysing: recorder.isAnalysing
    }

    // Get origin
    data.origin = document.location.hostname;

    // Get youtube ID
    var params = URL.getQueryParams(document.location.search);
    if (typeof(params.v) != 'undefined') {
      data.youtubeId = params.v;
    } else {
      data.youtubeId = params.id;
    }

    // Get durationForHuman
    var date = new Date(null);
    date.setSeconds(HTMLElement.duration); // specify value for SECONDS here
    data.duration = date.toISOString().substr(11, 8);
    if (data.duration.indexOf('00:') === 0 ) data.duration = data.duration.substring(3, data.duration.length);

    // Get title
    var ogTitle = document.querySelector("meta[property='og:title']");
    if(ogTitle) {
      data.title = ogTitle.getAttribute("content")
    } else {
      data.title = document.title
    }
    console.log(data);
    return data;
  }

  ext.runtime.onMessage.addListener( function (request, sender, sendResponse) {
    if (request.action === 'process-page') {
      sendResponse(extractPageData());
    }
    if (request.action === 'analyse-bpm') {
      recorder.listen();
      HTMLElement.play();
    }
    if (request.action === 'kill-analyze') {
      recorder.clear();
    }
    if (request.action === 'update-bpm') {
      storage.storeResultInStorage(request.v, request.bpm);
    }
  });
  
  class Recorder {

  constructor (config = {}) {
    // Default options
    this.options = {
      element: null,
      scriptNode: {
        bufferSize: 4096,
        numberOfInputChannels: 1,
        numberOfOutputChannels: 1
      }
    }
    // Merge Defaults with config
    Object.assign(this.options, config);
    // Shortcut
    this.audioContext = global.allegro.audioContext;
    // Source
    this.source = this.audioContext.createMediaElementSource(this.options.element);
    // Custom Event
    /*if (window.CustomEvent) {
      var event = new CustomEvent("newMessage", {
        detail: {
          message: msg,
          time: new Date(),
        },
        bubbles: true,
        cancelable: true
      });
      this.options.element.dispatchEvent(event);
    }*/
  }

  connect () {
    console.log('connect');
    // ScriptNode
    this.scriptNode = this.audioContext.createScriptProcessor(this.options.scriptNode.bufferSize, this.options.scriptNode.numberOfInputChannels, this.options.scriptNode.numberOfOutputChannels);
    this.scriptNode.connect(this.audioContext.destination);
    // Source connects
    this.source.connect(this.scriptNode);
    this.source.connect(this.audioContext.destination);
    // Buffer
    this.increment = 0;
    this.audioBuffer = null;
    this.superBuffer = null;
    this.arrayBuffer = [];
    // Counter
    this.progressionPC = 0;
    this.timeSpent = 0.0;
    // Flag
    this.isAnalysing = false;
  }

  clear () {
    console.log('clear');
    //this.source.disconnect(0);
    //this.scriptNode.disconnect(0);
    this.scriptNode.onaudioprocess = null;

    this.increment = 0;
    this.audioBuffer = null;
    this.superBuffer = null;
    this.arrayBuffer = [];

    this.progressionPC = 0;
    this.timeSpent = 0.0;

    this.isAnalysing = false;
  }

  listenAudioProcess () {
    console.log('listenAudioProcess' + this.options.element.duration);
    var that = this;
    this.scriptNode.onaudioprocess = function (e) {
      if (that.isAnalysing) {
        // Send calculated progression to popup
        that.timeSpent += e.inputBuffer.duration;
        that.progressionPC = that.progressionPC >= 100 ? 100 : (100 * that.timeSpent / that.options.element.duration).toFixed(2);
        chrome.runtime.sendMessage({action: 'progression', progression: that.progressionPC});

        // Get/Concat AudioBuffer
        if (that.audioBuffer == null) {
          that.audioBuffer = e.inputBuffer;
        } else {
          that.audioBuffer = buffer.concatenateAudioBuffers(that.audioBuffer, e.inputBuffer);
        }
        if (that.audioBuffer.duration > 10) {
          that.arrayBuffer.push(that.audioBuffer);
          that.increment++;
          that.audioBuffer = null;
        }
      }
    }
  }

  listen () {
    console.log('listen');
    this.connect();
    var that = this;

    // On Pause on recording
    this.options.element.onpause = (e) => {
      console.log('onpause fired');
      global.allegro.audioContext.suspend();
      that.isAnalysing = false;
      that.options.element.onplay = function (e) {
        console.log('audioContext.resume');
        that.isAnalysing = true;
        global.allegro.audioContext.resume();
      }
    }


    // Listener
    storage.get(function(data) {
      console.log(data);
      // On Play if necessary
      if (data.onplay) {
        console.log('onplay event setted');
        that.options.element.onplay = (e) => {
          console.log('onplay fired');
          that.isAnalysing = true;
          that.listenAudioProcess();
        }
        // On Pause on recording
        that.options.element.onpause = (e) => {
          console.log('onpause fired');
          global.allegro.audioContext.suspend();
          that.isAnalysing = false;
          that.options.element.onplay = function (e) {
            console.log('audioContext.resume');
            global.allegro.audioContext.resume();
            that.isAnalysing = true;
            that.listenAudioProcess();
          }
        }

        if (that.options.element.playing || ! that.options.element.paused) {
          console.log('video auto played');
          that.isAnalysing = true;
          that.listenAudioProcess();
        } else {
          console.log('video not auto played');
        }
      }
    });


    // Analyse at End !
    this.options.element.onended = function (e) {
      console.log('onended fired');
      that.isAnalysing = false;
      var superBuffer = buffer.getSuperBuffer(that.increment, that.arrayBuffer);
      if (that.increment == 0) {
        console.log('increment equal zero');
        superBuffer = that.audioBuffer;
      }
      try {
        var bpmCandidates = BPM(superBuffer);
        var bpm = bpmCandidates[0].tempo;
        that.clear();

        // Get param v value
        var params = URL.getQueryParams(document.location.search);
        if (typeof(params.v) != 'undefined') {
          storage.storeResultInStorage(params.v, bpm);
          chrome.runtime.sendMessage({action: 'audio-analyzed', v: params.v, bpm: bpm, bpmCandidates: bpmCandidates});
          console.log(bpm);
        } else {
          console.log('No "v" data found in URL... Record cannot be stored !');
        }

        if (global.allegro.env == 'development') {
          console.log('pushState');
          var hash = Math.random().toString(36).slice(-8);
          var newPath = '/?v=' + hash;
          window.history.pushState({"pageTitle": hash}, "", newPath);
          document.title = hash;
          that.options.element.currentTime = 0;

          var eventRequest = new CustomEvent("spfrequest", { "detail": "Example of an event" });
          document.dispatchEvent(eventRequest);

          var wait = setTimeout(function () {
            var eventDone = new CustomEvent("spfdone", { "detail": "Example of an event" });
            document.dispatchEvent(eventDone);
            that.options.element.play();
          }, 300);
        }
      } catch (e) {
        console.log(e);
      }
    }

  }
}

module.exports = Recorder;
}
