/* eslint-disable no-debugger, spaced-comment, no-multi-spaces, valid-typeof, 
   object-curly-spacing, no-trailing-spaces, quotes, no-return-assign */

const {OfflineAudioContext} = window

export const detectBPMj = buffer => {
  const bpm = {}

  function getPeaks (data) {
    // What we're going to do here, is to divide up our audio into parts.
    // We will then identify, for each part, what the loudest sample is in that part.
    // It's implied that that sample would represent the most likely 'beat' within that part.
    // Each part is 0.5 seconds long - or 22,050 samples.
    // This will give us 60 'beats' - we will only take the loudest half of those.
    // This will allow us to ignore breaks, and allow us to address tracks with a BPM below 120.
  
    const partSize = 22050
    const parts = data[0].length / partSize
    const peaks = []
  
    for (var i = 0; i < parts; i++) {
      var max = 0
      for (var j = i * partSize; j < (i + 1) * partSize; j++) {
        var volume = Math.max(Math.abs(data[0][j]), Math.abs(data[1][j]))
        if (!max || (volume > max.volume)) {
          max = {
            position: j,
            volume: volume
          }
        }
      }
      peaks.push(max)
    }
    peaks.sort((a, b) => b.volume - a.volume) 
    // We then sort the peaks according to volume...take the loudest half of those...
    // ...and re-sort it back based on position.
  
    return peaks.splice(0, peaks.length * 0.5).sort((a, b) => a.position - b.position)
  }

  function getIntervals (peaks) {
    // What we now do is get all of our peaks, and then measure the distance to other peaks,
    // to create intervals.  Then based on the distance between those peaks (the distance of 
    // the intervals) we can calculate the BPM of that particular interval. The interval 
    // that is seen the most should have the BPM that corresponds to the track itself.
  
    const groups = []
  
    peaks.forEach(function (peak, index) {
      for (var i = 1; (index + i) < peaks.length && i < 10; i++) {
        var group = {
          tempo: (60 * 44100) / (peaks[index + i].position - peak.position),
          count: 1
        }
  
        while (group.tempo < 90) {
          group.tempo *= 2
        }
  
        while (group.tempo > 180) {
          group.tempo /= 2
        }
  
        group.tempo = Math.round(group.tempo)
  
        if (!(groups.some(function (interval) {
          return (interval.tempo === group.tempo ? interval.count++ : 0)
        }))) {
          groups.push(group)
        }
      }
    })
    return groups
  }
  
  const detectj = _ => new Promise(resolve => {
    var offlineContext = new OfflineAudioContext(2, 30 * 44100, 44100)
    const source = offlineContext.createBufferSource()
    source.buffer = buffer

    // Beats, or kicks, generally occur around the 100 to 150 hz range.
    // Below this is often the bassline.  So let's focus just on that.

    // First a lowpass to remove most of the song.
    const lowpass = offlineContext.createBiquadFilter()
    lowpass.type = "lowpass"
    lowpass.frequency.value = 150
    lowpass.Q.value = 1

    // Run the output of the source through the low pass.
    source.connect(lowpass)

    // Now a highpass to remove the bassline.
    const highpass = offlineContext.createBiquadFilter()
    highpass.type = "highpass"
    highpass.frequency.value = 100
    highpass.Q.value = 1

    // Run the output of the lowpass through the highpass.
    lowpass.connect(highpass)

    // Run the output of the highpass through our offline context.
    highpass.connect(offlineContext.destination)

    // Start the source, and render the output into the offline conext.

    source.start(0)
    offlineContext.startRendering()
    
    offlineContext.oncomplete = function (e) {
      var buffer = e.renderedBuffer
      var peaks = getPeaks([buffer.getChannelData(0), buffer.getChannelData(1)])
      var groups = getIntervals(peaks)
      
      var candidates = groups.sort(function (intA, intB) {
        return intB.count - intA.count
      }).splice(0, 10)
      bpm.capture({candidates, groups, peaks})
      
      console.log(bpm)
      resolve(bpm)
    }
  })
  
  return detectj()
}
