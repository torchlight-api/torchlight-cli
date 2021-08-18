const {writeFileSync, existsSync, readFileSync} = require('fs-extra')
const path = require('path');
const inquirer = require('inquirer');

function write(location) {
    let stub = readFileSync(path.resolve('src/stubs/config.js'), 'utf-8');
    writeFileSync(location, stub);
    console.log('File written to %s', location);
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