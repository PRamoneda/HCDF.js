function handleFiles(event) {
  var files = event.target.files;
  $("#src").attr("src", URL.createObjectURL(files[0]));
  document.getElementById("audio").load();
}

document.getElementById("upload").addEventListener("change", handleFiles, false);


let essentia

/* "https://freesound.org/data/previews/328/328857_230356-lq.mp3"; */

let audioData;
// fallback for cross-browser Web Audio API BaseAudioContext
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = new AudioContext();
let plotChroma;
let plotContainerId = "plotDiv";

let isComputed = false;

function downsample(buffer, old_sr, new_sr) {
    if (new_sr == old_sr) {
        return buffer;
    }
    if (new_sr > old_sr) {
        throw "downsampling rate show be smaller than original sample rate";
    }
    var sampleRateRatio = old_sr / new_sr;
    var newLength = Math.round(buffer.length / sampleRateRatio);
    var result = new Float32Array(newLength);
    var offsetResult = 0;
    var offsetBuffer = 0;
    while (offsetResult < result.length) {
        var nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
        var accum = 0, count = 0;
        for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
            accum += buffer[i];
            count++;
        }
        result[offsetResult] = accum / count;
        offsetResult++;
        offsetBuffer = nextOffsetBuffer;
    }
    return result;
}

function chromaCQT(){
  // CHROMA CQT
  // var chroma_list = [];
  
  // for (var i = 0; i < frames.size(); i++) {
  //   let chroma = essentia.Chromagram(frames.get(i),
  //                                   12,//binsPerOctave
  //                                   110, //minFrequency
  //                                   4, //minimumKernelSize
  //                                   "unit_max", // normalizeType
  //                                   36, //numberBins
  //                                   sampleRate,
  //                                   1, //scale
  //                                   0.01, //threshold
  //                                   "hann",//hann
  //                                    ).chromagram;
  //   chroma = essentia.vectorToArray(chroma);
  //   console.log(chroma);
  //   chroma_list.push(chroma);
  // }
  return;
}

function chromaNNLS(frames, frameSize, hopSize, sampleRate){
  let logSpectFrames = new essentia.module.VectorVectorFloat();
  for (var i=0; i<frames.size(); i++) {
      // default hanning window (you can change it according to your need)
      let windowing = essentia.Windowing(frames.get(i), false, hopSize, 'hann');
      let spect = essentia.Spectrum(windowing.frame, frameSize); // frameSize
      let logSpectrum =  essentia.LogSpectrum(spect.spectrum,
                                             3, // bins per semitone
                                             frameSize,
                                             0, // rollon
                                             sampleRate);// sample rate
     
      logSpectFrames.push_back(logSpectrum.logFreqSpectrum);
      // console.log(essentia.vectorToArray(logSpectrum.logFreqSpectrum));

      meanTuning = logSpectrum.meanTuning;
      localTuning = logSpectrum.meanTuning;
  }

  let nnlsChroma = essentia.NNLSChroma(logSpectFrames,
                                       meanTuning,
                                      localTuning, 
                                      "none",
                                      frameSize,
                                      sampleRate,
                                      0.7,
                                      1,
                                      "global",
                                      false).chromagram;

  delete windowing;
  delete spect;
  delete logSpectrum;
  console.log(nnlsChroma);
  var chroma_list = [];
  for (var i = 0; i < nnlsChroma.size(); i++){
      console.log(essentia.vectorToArray(nnlsChroma.get(i)));
      chroma_list.push(essentia.vectorToArray(nnlsChroma.get(i)));
  }
  return chroma_list;
}

function everything_is_zero(vector){
  let is_zero = true;
  for (var i = vector.length - 1; i >= 0 && is_zero; i--) {
     if (vector[i] !== 0){
        is_zero = false;
     }
  }
  return is_zero;
}



function DFT(input, zero = 1e-10) {
  // Discrete Fourier Transform
  const N = input.length;
  const signals = [];
  // Each discrete frecuenciy
  for (let frequency = 0; frequency < N; frequency += 1) {
    //complex(frequencySignal)
    let frequencySignal_re = 0;
    let frequencySignal_im = 0;
    // Each discrete time
    for (let timer = 0; timer < N; timer += 1) {
      const amplitude = input[timer];

      //rotation angle.
      const angle = -1 * (2 * Math.PI) * frequency * (timer / N);

      // Remember that e^ix = cos(x) + i * sin(x);

      let point_re = Math.cos(angle) * amplitude;
      let point_im = Math.sin(angle) * amplitude;
      // Add this data point's contribution.
      frequencySignal_re += point_re;
      frequencySignal_im += point_im;
    }

    // If is close to zero.... zero
    if (Math.abs(frequencySignal_re) < zero) {
      frequencySignal_re = 0;
    }

    if (Math.abs(frequencySignal_im) < zero) {
      frequencySignal_im = 0;
    }

    // Average contribution at this frequency.
    // complex(frecuencySignal) / N
    frequencySignal_re = (frequencySignal_re * N) / (N*N);
    frequencySignal_im = (frequencySignal_im * N) / (N*N);

    // Add current frequency signal to the list of compound signals.
    signals.push(frequencySignal_re);
    signals.push(frequencySignal_im);

  }

  return signals;
}

function division(vector, energy){
  for (var i = vector.length - 1; i >= 0; i--) {
    vector[i] = vector[i]/energy;
  }
  return vector;
}

function multiply(vectorA, vectorB){
    var ans = new Array(12);
    for (var i = vectorA.length - 1; i >= 0; i--) {
        ans[i] = vectorA[i] * vectorB[i]
    }
    return ans;
}

function TIV(pcp, weights){
  // Tonal Interval Vectors
  let fft = DFT(pcp);
  let energy = fft[0]; 
  let vector = fft.slice(2, 14);
  if (weights === "symbolic"){
      let weights_symbolic = [2, 2, 11, 11, 17, 17, 16, 16, 19, 19, 7, 7] 
      vector = multiply(division(vector, energy), weights_symbolic);
  }
  else if (weights === "audio"){
      let weights_audio = [3, 3, 8, 8, 11.5, 11.5, 15, 15, 14.5, 14.5, 7.5,7.5];
      vector = multiply(division(vector, energy), weights_audio);
  }
  else if (weights === "harte"){
      let weithts_harte = [0, 0, 0, 0, 1, 1, 0.5, 0.5, 1, 1, 0, 0];
      vector = multiply(division(vector, energy), weithts_harte);
  }
  return vector;
}

function tonal_interval_space(chroma, weights="audio"){
  // Tonal Interval Space
  let centroid_vector = [];
  for (var i = 0; i < chroma.length; i++){
    let each_chroma = chroma[i];
    
    let centroid = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    if (!everything_is_zero(each_chroma)){
        centroid = TIV(each_chroma, weights)  
    }
    centroid_vector.push(centroid);
    
  }
  return centroid_vector;
}


function avg (v) {
  return v.reduce((a,b) => a+b, 0)/v.length;
}

function gaussian_smoothing_vector(vector, sigma) {
  var t_avg = avg(vector)*sigma;
  var ret = Array(vector.length);
  for (var i = 0; i < vector.length; i++) {
    (function () {
      var prev = i>0 ? ret[i-1] : vector[i];
      var next = i<vector.length ? vector[i] : vector[i-1];
      ret[i] = avg([t_avg, avg([prev, vector[i], next])]);
    })();
  }
  return ret;
}

function gaussian_smoothing(tis, sigma){
  var ans = [];
  for (var i = tis.length - 1; i >= 0; i--) {
      ans.push(gaussian_smoothing_vector(tis[i], sigma));
  }
  return ans;
}

function distance(centroids){
    var ans = [0];
    for (var i = 1; i < centroids.length - 1; i++) {
        var sum = 0;
        for (var j = 1; j < centroids[i].length - 1; j++) {
            sum += Math.pow((centroids[i][j + 1] - centroids[i][j - 1]), 2)
        }
        sum = Math.sqrt(sum)
        ans.push(sum);
    }
    return ans;
}

function centroids_per_second(y, sr, centroids){
  return sr * centroids.length / y.length;
}

function peaks(hcdf_function, rate_centroids_second){
    let changes = [0];
    for (var i = 0; i < hcdf_function.length; i++) {
      if (hcdf_function[i - 1] < hcdf_function[i] && hcdf_function[i + 1] < hcdf_function[i]){
          changes.push(i / rate_centroids_second)
      }
    }
    return changes;
}


// callback function which compute the frame-wise HPCP chroma of input audioURL on a button.onclick event
async function onClickFeatureExtractor() {
  let audioURL = document.getElementById("audio").currentSrc;
  console.log(audioURL);

  // load audio file from an url
  let audioData = await essentia.getAudioChannelDataFromURL(audioURL, audioCtx, 0);
 
  if (isComputed) { plotChroma.destroy(); };
  
  const frameSize = 2048;
  const hopSize = 512;
  const sampleRate = 8000;

  // console.log("audio antes downsampling", audioData);
  // audioData = downsample(audioData, 44100, sampleRate); 
  // console.log("audio despues downsampling", audioData);
  // let frames = essentia.FrameGenerator(audioData, 
  //                                     frameSize, 
  //                                     hopSize)


  // let chroma = chromaNNLS(frames, frameSize, hopSize, sampleRate);
  // console.log("chroma", chroma);
  let chroma = [[0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0]]

  let tonal_centroids = tonal_interval_space(chroma, "symbolic");
  console.log("tonal centroids", tonal_centroids);

  // let smoothed_centroids = gaussian_smoothing(tonal_centroids, 5);
  // console.log("gaussian smoothing", tonal_centroids);

  // let harmonic_function = distance(smoothed_centroids);
  // console.log("distance", distance);

  // let cps = centroids_per_second(audioData, sampleRate, smoothed_centroids);
  // let harmonic_changes = peaks(harmonic_function, cps);
  // console.log("harmonic_changes", harmonic_changes);








      
  // plot the feature
  plotChroma.create(
    chroma, // input feature array
    "NNLS Chroma", // plot title
    audioData.length, // length of audio in samples
    sampleRate // audio sample rate
  );
  isComputed = true;
 

}

$(document).ready(function() {
  
  // create EssentaPlot instance
  plotChroma = new EssentiaPlot.PlotHeatmap(
    Plotly, // Plotly.js global 
    plotContainerId, // HTML container id
    "chroma", // type of plot
    EssentiaPlot.LayoutChromaPlot // layout settings
  );

  // Now let's load the essentia wasm back-end, if so create UI elements for computing features
  EssentiaModule().then(async function(WasmModule) {

    essentia = new Essentia(WasmModule);

    // essentia version log to html div
    $("#logDiv").html(
      "<h5> essentia-" + essentia.version + " wasm backend loaded ... </h5>"
    );

    $("#logDiv").append(
      '<button id="btn" class="ui white inverted button">Compute HCDF </button>'
    );

    var button = document.getElementById("btn");

    // add onclick event handler to comoute button
    button.addEventListener("click", () => onClickFeatureExtractor(), false);
  });
});