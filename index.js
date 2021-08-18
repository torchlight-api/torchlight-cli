#! /usr/bin/env node
const {program} = require('commander')
const torchlight = require('./src/torchlight');

command('_default_')
    .alias('highlight')
    .description('Highlight <code> blocks in source files')
    .option('-i, --input <directory>', 'Input directory')
    .option('-o, --output <directory>', 'Output directory')
    .option('-g, --globs <pattern>', 'Glob patterns used to search for source files. Separate multiple patterns with commas.')
    .option('-x, --ignore <pattern>', 'Glob patterns used to ignore source files. Separate multiple patterns with commas.')
    .option('-w, --watch', 'Watch source files for changes')

command('init')
    .option('-p, --path <path>', 'Location for the configuration file')
    .description('Publish the Torchlight configuration file');

command('cache:clear')
    .description('Clear the cache');

// Bootstrap the Torchlight singleton before every command.
program.hook('preAction', thisCommand => {
    torchlight.init(thisCommand.opts().config)
})

program.parse()

// A helper function to define commands. It takes
// care of several defaults for every command.
function command(name) {
    let cmd = program;
    let action = name;

    // The default command has no name.
    if (name !== '_default_') {
        cmd = cmd.command(name);
    } else {
        action = 'highlight';
    }

    // Namespaced command convention. The command config:cache
    // has a handler at config/cache.js.
    action = action.replace(':', '/');

    let handler = require(`./src/commands/${action}`);

    // Add a little shim around the handler so we can pass the
    // torchlight variable in, just for convenience.
    cmd.action(function (options) {
        return handler(torchlight, options);
    })

    // Options config path
    return cmd.option('-c, --config <file>', 'Path to the Torchlight configuration file.')
}
