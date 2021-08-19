const chalk = require('chalk');

function log(fn, args) {
    args = Array.from(args);
    console.log(fn(args.shift()), ...args);
}

exports.error = function error() {
    log(chalk.bold.bgRed, arguments);
}

exports.info = function error() {
    log(chalk.green, arguments);
}