const chalk = require('chalk')
let silent = false

function log (fn, args) {
  args = Array.from(args)

  if (!silent) {
    console.log(fn(args.shift()), ...args)
  }
}

exports.error = function error () {
  log(chalk.bold.bgRed, arguments)
}

exports.info = function error () {
  log(chalk.green, arguments)
}

exports.silence = function (silence = true) {
  silent = silence
}
