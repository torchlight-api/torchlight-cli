import fs from 'fs-extra'
import path from 'path'
import inquirer from 'inquirer'
import log from '../support/log.js'

function write (location) {
  const source = path.resolve(path.join(__dirname, '../stubs/config.js'))
  const stub = fs.readFileSync(source, 'utf-8')

  fs.ensureFileSync(location)
  fs.writeFileSync(location, stub)
  log.info('File written to %s', location)
}

export default function (torchlight, options) {
  options = {
    path: 'torchlight.config.js',
    ...options
  }

  const location = path.resolve(options.path)

  if (!fs.existsSync(location)) {
    return write(location)
  }

  const questions = [{
    type: 'confirm',
    name: 'overwrite',
    message: `Overwrite file at ${location}?`,
    default: false
  }]

  inquirer.prompt(questions).then(answers => {
    if (answers.overwrite) {
      write(location)
    }
  })
}
