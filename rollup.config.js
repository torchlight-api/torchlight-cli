import resolve from '@rollup/plugin-node-resolve'
import babel from '@rollup/plugin-babel'
import { terser } from 'rollup-plugin-terser'

const common = {
  external: [
    /node_modules/
  ],
  plugins: [
    resolve(),
    babel({
      babelHelpers: 'bundled'
    })
  ]
}

const cjs = {
  format: 'cjs',
  exports: 'named',
  sourcemap: true
}

const esm = {
  ...cjs,
  format: 'es'
}

module.exports = [{
  ...common,
  input: 'src/index.js',
  output: [{
    file: 'dist/torchlight-cli.esm.js',
    ...esm
  }, {
    file: 'dist/torchlight-cli.esm.min.js',
    plugins: [terser()],
    ...esm
  }, {
    file: 'dist/torchlight-cli.cjs.js',
    ...cjs
  }, {
    file: 'dist/torchlight-cli.cjs.min.js',
    plugins: [terser()],
    ...cjs
  }]
}, {
  ...common,
  input: 'src/bin/torchlight.js',
  output: [{
    banner: '#! /usr/bin/env node',
    file: 'dist/bin/torchlight.cjs.js',
    ...cjs
  }]
}]
