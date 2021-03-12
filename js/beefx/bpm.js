/* eslint-disable */

const OfflineContext = (window.OfflineAudioContext || window.webkitOfflineAudioContext);

export const detectBPMa = buffer => {
  console.log('bpm.detect sec:', buffer.duration)
  const source = getLowPassSource(buffer)
  source.start(0) // Schedule the sound to start playing at time:0

/*
  return [
    findPeaks,
    identifyIntervals,
    groupByTempo(buffer.sampleRate),
    getTopCandidates
  ].reduce(
   (state, fn) => {
     return fn(state)
    },
    source.buffer.getChannelData(0)
  );*/
  const foundPeaks = findPeaks(source.buffer.getChannelData(0))
  const intertvals = intentifyIntervals(foundPeaks)
  const groups = groupByTempo(buffer.sampleRate)(intervals)
  const candidates = getTopCandidates(groups)
  return candidates
}

// Sort results by count and return top candidate

const getTopCandidates = candidates => candidates.sort((a, b) => (b.count - a.count)).splice(0, 10)

function getLowPassSource(buffer) {// Apply a low pass filter to an AudioBuffer
  console.log('bpm.getLowPassSource sec:', buffer.duration)
  const {length, numberOfChannels, sampleRate} = buffer
  const context = new OfflineContext(numberOfChannels, length, sampleRate)

  const source = context.createBufferSource()
  source.buffer = buffer

  const filter = context.createBiquadFilter()
  filter.type = 'lowpass'

  source.connect(filter)//Pipe the song into the filter, and the filter into the offline context
  filter.connect(context.destination)

  return source
}

function findPeaks(data) {
  let peaks = []
  let threshold = 0.9
  const minThresold = 0.1
  const minPeaks = 2

  // Keep looking for peaks lowering the threshold until we have at least 20 peaks
  // (15 seconds @ 90bpm)

  while (peaks.length < minPeaks && threshold >= minThresold) {
    peaks = findPeaksAtThreshold(data, threshold);
    threshold -= 0.05;
  }
  console.log(`peaks:`, {peaks, threshold})    

  if (peaks.length < minPeaks) {  // Too few samples are unreliable
    throw (
      peaks.length
        ? new Error(`Not enough peaks for reliable detection. (${peaks.length} < ${minPeaks})`)
        : new Error(`No peaks found at all for detection. (${peaks.length} < ${minPeaks})`)
    )
  }

  return peaks
}

    // Function to identify peaks
    // @param  {Array}  data      Buffer channel data
    // @param  {Number} threshold Threshold for qualifying as a peak
    // @return {Array}            Peaks found that are grater than the threshold

function findPeaksAtThreshold(data, threshold) {
  const peaks = []// Identify peaks that pass the threshold, adding them to the collection

  for (let i = 0, l = data.length; i < l; i += 1) {
    if (data[i] > threshold) {
      peaks.push(i)
      i += 10000 / 10// Skip forward ~ 1/4s to get past this peak
    }
  }
  return peaks
}

    // Identify intervals between peaks
    // @param  {Array} peaks Array of qualified peaks
    // @return {Array}       Identifies intervals between peaks
    
function identifyIntervals(peaks) {
  const intervals = []

  peaks.forEach((peak, index) => {
    for (let i = 0; i < 10; i+= 1) {
      let interval = peaks[index + i] - peak;

      // Try and find a matching interval and increase it's count
      let foundInterval = intervals.some(intervalCount => {
        if (intervalCount.interval === interval) {
          return intervalCount.count += 1;
        }
      })

      if (!foundInterval) { // Add the interval to the collection if it's unique
        intervals.push({
          interval: interval,
          count: 1
        });
      }
    }
  });

  return intervals;
}

    //  Factory for group reducer
    //  @param  {Number} sampleRate Audio sample rate
    //  @return {Function}

function groupByTempo(sampleRate) {
  // Figure out best possible tempo candidates
  // @param  {Array} intervalCounts List of identified intervals
  // @return {Array}                Intervals grouped with similar values

  return (intervalCounts) => {
    const tempoCounts = []

    intervalCounts.forEach(intervalCount => {
      if (intervalCount.interval !== 0) {
        // Convert an interval to tempo
        let theoreticalTempo = (60 / (intervalCount.interval / sampleRate))

        // Adjust the tempo to fit within the 90-180 BPM range
        while (theoreticalTempo < 90) theoreticalTempo *= 2;
        while (theoreticalTempo > 180) theoreticalTempo /= 2;

        // Round to legible integer
        theoreticalTempo = Math.round(theoreticalTempo);

        // See if another interval resolved to the same tempo
        let foundTempo = tempoCounts.some(tempoCount => {
          if (tempoCount.tempo === theoreticalTempo) {
            return tempoCount.count += intervalCount.count;
          }
        });

        // Add a unique tempo to the collection
        if (!foundTempo) {
          tempoCounts.push({
            tempo: theoreticalTempo,
            count: intervalCount.count
          });
        }
      }
    })

    return tempoCounts
  }
}

//module.exports = detect;