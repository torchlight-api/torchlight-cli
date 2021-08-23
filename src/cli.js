const {program} = require('commander')
const torchlight = require('./torchlight');

/**
 * Configure the commander CLI application.
 *
 * @param options
 * @return {Command}
 */
function makeProgram(options = {}) {
    if (options?.testing) {
        // Don't exit when there are errors, so we
        // can catch them.
        program.exitOverride();

        // Capture the output, so we can inspect it.
        program.configureOutput({
            writeOut: () => {
                //
            },
            writeErr: () => {
                //
            },
            ...options?.configureOutput || {}
        });
    }

    // Bootstrap the Torchlight singleton before every command.
    program.hook('preAction', thisCommand => {
        torchlight.init(thisCommand.opts().config)
    })

    makeCommand('_default_')
        .description('Highlight code blocks in source files')
        .option(
            '-i, --input <directory>',
            'Input directory. Defaults to current directory.'
        )
        .option(
            '-o, --output <directory>',
            'Output directory. Defaults to current directory.'
        )
        .option(
            '-n, --include <patterns>',
            'Glob patterns used to search for source files. Separate '
            + 'multiple patterns with commas. Defaults to "**/*.htm,**/*.html".'
        )
        .option(
            '-x, --exclude <patterns>',
            'String patterns to ignore (not globs). Separate multiple '
            + 'patterns with commas. Defaults to "/node_modules/,/vendor/".'
        )
        .option(
            '-w, --watch',
            'Watch source files for changes.'
        )

    makeCommand('init')
        .description('Publish the Torchlight configuration file.')
        .option(
            '-p, --path <path>',
            'Location for the configuration file.'
        );

    makeCommand('cache:clear')
        .description('Clear the cache');

    return program;
}


/**
 * Run the CLI for testing purposes
 *
 * @param args
 * @param opts
 */
function testCli(args, opts) {
    // https://github.com/shadowspawn/forest-arborist/blob/master/src/command.ts#L345
    return makeProgram({
        ...opts,
        testing: true
    }).parse(args, {
        from: 'user'
    });
}

/**
 * @param name
 * @return {Command}
 */
function makeCommand(name) {
    let cmd = program;
    let action = name;

    if (name === '_default_') {
        // The default command has a handler at
        // highlight.js, and no command name.
        action = 'highlight';
    } else {
        // Name the other commands.
        cmd = cmd.command(name);
    }

    // Namespaced command convention. E.g. The config:cache
    // command has a handler at config/cache.js.
    action = action.replace(':', '/');

    let handler = require(`./commands/${action}`);

    // Add a little shim around the handler so we can pass the
    // torchlight variable in, just for convenience.
    cmd.action(function (options) {
        return handler(torchlight, options);
    })

    // Every command gets the -c option, so the developer can
    // specify a path to a config file.
    return cmd.option(
        '-c, --config <file>',
        'Path to the Torchlight configuration file.'
    )
}


exports.testCli = testCli;
exports.makeProgram = makeProgram;
