const { writeFileSync, copySync, pathExistsSync } = require('fs-extra')
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const argv = yargs(hideBin(process.argv)).argv

let pkg = require('../package.json')

const development = argv.dev
const production = argv.prod

if (!development && !production) {
  throw new Error('Unknown environment.')
}

let version = '0.1.' + ~~(Date.now() / 1000)
let name = '@aaron-dev/torchlight-cli'

if (production) {
  // Populated by GitHub actions
  version = process.env.PACKAGE_VERSION
  name = '@torchlight-api/torchlight-cli'
}

if (pathExistsSync('./package.backup.json')) {
  throw new Error('package.backup.json already exists, not overwriting.')
}

copySync('./package.json', './package.backup.json')

pkg = {
  ...pkg,
  name,
  version: version
}

writeFileSync('./package.json', JSON.stringify(pkg, null, 2))
