# Harmonic Change Detection Function (HCDF) Javascript library HCDF.js

This library is used to compute HCDF. [Here]() is described the algorithm in detail. As many of the solutions overlap partilly, all the algorithm data computed in the different blocks is saved in out folder in order to not compute same blocks parameterization two times. Harmonic Change Detection Function implementation based on essentia.js.

## Installation

For using this library have to been added the following CDNs:
```
<script src="https://unpkg.com/essentia.js@0.0.9/dist/essentia-wasm.web.js"></script>
<script src="https://unpkg.com/essentia.js@0.0.9/dist/essentia.js-core.js"></script>
<script src="https://unpkg.com/essentia.js@0.0.9/dist/essentia.js-plot.js"></script>
```

## Usage
The library can be imported as a module with `import HCDF from './hcdf.js'` and `import loadEssentia from './hcdf.js'`. First, `loadEssentia()` have to be called and later `loadEssentia(id_audio)` can be used. `id_audio` is `<audio> </audio>` html id element. 