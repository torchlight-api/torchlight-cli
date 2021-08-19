const {writeFileSync, existsSync, readFileSync, ensureFileSync} = require('fs-extra')
const path = require('path');
const inquirer = require('inquirer');
const log = require('../support/log');

function write(location) {
    let source = path.resolve(path.join(__dirname, '../stubs/config.js'));
    let stub = readFileSync(source, 'utf-8');

    ensureFileSync(location);
    writeFileSync(location, stub);
    log.info('File written to %s', location);
}

module.exports = function (torchlight, options) {
    options = {
        path: 'torchlight.config.js',
        ...options
    }

    let location = path.resolve(options.path);

    if (!existsSync(location)) {
        return write(location);
    }

    let questions = [{
        type: 'confirm',
        name: 'overwrite',
        message: `Overwrite file at ${location}?`,
        default: false,
    }];

    inquirer.prompt(questions).then(answers => {
        if (answers.overwrite) {
            write(location);
        }
    })
}