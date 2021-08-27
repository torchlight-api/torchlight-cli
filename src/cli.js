import { program } from 'commander'
import torchlight from './torchlight'
import highlight from './commands/highlight'
import init from './commands/init'
import cacheClear from './commands/cache/clear'
import { makeConfig, makeCache } from './config'

/**
 * Configure the commander CLI application.
 *
 * @param options
 * @return {Command}
 */
export function makeProgram (options = {}) {
  if (options?.testing) {
    // Don't exit when there are errors, so we
    // can catch them.
    program.exitOverride()

    // Capture the output, so we can inspect it.
    program.configureOutput({
      writeOut: () => {
        //
      },
      writeErr: () => {
        //
      },
      ...options?.configureOutput || {}
    })
  }

  // Bootstrap the Torchlight singleton before every command.
  program.hook('preAction', thisCommand => {
    const config = makeConfig(thisCommand.opts().config)
    const cache = makeCache(config)

    torchlight.init(config, cache)
  })

  makeCommand('_default_', highlight)
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
      'Glob patterns used to search for source files. Separate ' +
      'multiple patterns with commas. Defaults to "**/*.htm,**/*.html".'
    )
    .option(
      '-x, --exclude <patterns>',
      'String patterns to ignore (not globs). Separate multiple ' +
      'patterns with commas. Defaults to "/node_modules/,/vendor/".'
    )
    .option(
      '-w, --watch',
      'Watch source files for changes.'
    )

  makeCommand('init', init)
    .description('Publish the Torchlight configuration file.')
    .option(
      '-p, --path <path>',
      'Location for the configuration file.'
    )

  makeCommand('cache:clear', cacheClear)
    .description('Clear the cache')

  return program
}

/**
 * Run the CLI for testing purposes
 *
 * @param args
 * @param opts
 */
export function testCli (args, opts) {
  // https://github.com/shadowspawn/forest-arborist/blob/master/src/command.ts#L345
  return makeProgram({
    ...opts,
    testing: true
  }).parse(args, {
    from: 'user'
  })
}

/**
 * @param name
 * @return {Command}
 */
function makeCommand (name, handler) {
  let cmd = program

  if (name !== '_default_') {
    // Name the other commands.
    cmd = cmd.command(name)
  }

  // Add a little shim around the handler so we can pass the
  // torchlight variable in, just for convenience.
  cmd.action(function (options) {
    return handler(torchlight, options)
  })

  // Every command gets the -c option, so the developer can
  // specify a path to a config file.
  return cmd.option(
    '-c, --config <file>',
    'Path to the Torchlight configuration file.'
  )
}
