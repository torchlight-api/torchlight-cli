const { readFileSync, writeFileSync, ensureFileSync } = require('fs-extra')
const path = require('path')
const torchlight = require('../torchlight')
const Block = require('../block')
const cheerio = require('cheerio').default
const chokidar = require('chokidar')
const log = require('../support/log')
const { bus, FILE_WATCHING_COMPLETE } = require('../support/bus')

module.exports = function (torchlight, options) {
  options = {
    input: torchlight.config('highlight.input', ''),
    output: torchlight.config('highlight.output', ''),
    include: torchlight.config('highlight.includeGlobs', ['**/*.htm', '**/*.html']),
    exclude: torchlight.config('highlight.excludePatterns', ['/node_modules/', '/vendor/']),
    watch: false,
    ...options
  }

  if (options.watch) {
    log.info(`
***************************************
*   Torchlight is watching files...   *
***************************************
        `)
  }

  const input = path.resolve(options.input)
  const output = path.resolve(options.output || options.input)

  const watcher = chokidar.watch(normalizeStringedArray(options.include), {
    cwd: input,
    ignored: path => normalizeStringedArray(options.exclude).some(s => path.includes(s)),
    ignoreInitial: false
  })

  watcher.on('all', (event, file) => {
    if (event !== 'add' && event !== 'change') {
      return
    }

    log.info('Highlighting %s', file)

    const source = readFileSync(path.join(input, file), 'utf-8')

    highlight(torchlight, source).then(highlighted => {
      const destination = path.join(output, file)

      ensureFileSync(destination)
      if (highlighted === readFileSync(destination, 'utf-8')) {
        return
      }

      log.info('Writing to %s', destination)
      writeFileSync(destination, highlighted, 'utf-8')
    })
  })

  watcher.on('ready', function () {
    if (!options.watch) {
      watcher.close().then(() => bus.emit(FILE_WATCHING_COMPLETE))
    }
  })
}

function normalizeStringedArray (value) {
  return (typeof value === 'string' ? value.split(',') : value).filter(x => x)
}

function highlight (torchlight, source) {
  let highlighted = source

  const $ = cheerio.load(source, {
    sourceCodeLocationInfo: true
  }, false)

  const blocks = []

  // Search for blocks that have not already been processed.
  $('pre:not([data-torchlight-processed])').each((index, pre) => {
    const $pre = $(pre)

    $pre.children('code').each((index, code) => {
      const $code = $(code)

      const block = new Block({
        // Using `text()` will re-encode entities like &lgt;
        code: $code.text(),
        language: decipherLanguage($pre, $code)
      })

      // Add our class placeholder as a class, so that we don't overwrite
      // any classes that are already there.
      $pre.addClass(block.placeholder('class'))

      // Add a fake style that we can replace later.
      $pre.css(block.placeholder('style'), '0')

      // Store the raw code as the developer wrote it, so we can re-highlight
      // it later if we need to, or allow it to be copied to clipboard.
      const raw = `<textarea data-torchlight-original='true' style='display: none !important;'>${$code.html()}</textarea>`

      // Add the placeholder inside the code tag.
      $code.html(block.placeholder('highlighted') + raw)

      // Give the developer an opportunity to add things to the placeholder
      // element. Like copy to clipboard buttons, language indicators, etc.
      if (torchlight.config('modifyPlaceholderElement')) {
        torchlight.config('modifyPlaceholderElement')($, $pre, $code, block)
      }

      blocks.push(block)
    })

    // Add the options hash that this block will be highlighted with.
    $pre.attr('data-torchlight-processed', torchlight.configHash())

    // Cut out the *exact* pre element as it is in the file. Cheerio converts
    // single quotes to double, normalizes whitespace, and otherwise "cleans
    // up" the parsed document, so we can't simply modify the Cheerio dom and
    // write it back to disk. Instead we're going to surgically cut out the
    // pre tag and all its contents without touching anything else around it.
    const pristinePreElement = source.substring(
      pre.sourceCodeLocation.startOffset,
      pre.sourceCodeLocation.endOffset
    )

    // Swap out the original tag with the outerHTML of our modified tag.
    highlighted = highlighted.replace(pristinePreElement, $.html($pre))
  })

  if (!blocks.length) {
    return Promise.resolve(source)
  }

  return torchlight.highlight(blocks).then(() => {
    blocks.forEach(block => {
      const swap = {
        [block.placeholder('class')]: block.classes ?? '',
        [block.placeholder('style') + ': 0;']: block.styles ?? '',
        [block.placeholder('highlighted')]: block.highlighted
      }

      Object.keys(swap).forEach(key => {
        highlighted = highlighted.replace(key, swap[key])
      })
    })

    return highlighted
  })
}

/**
 * Given a <pre> element, figure out what language it is.
 *
 * @param $pre
 * @return {string}
 */
function decipherLanguage ($pre, $code) {
  const custom = torchlight.config('highlight.decipherLanguageFromElement')

  // Let the developer add their own deciphering mechanism.
  if (custom) {
    const lang = custom($pre)

    if (lang) {
      return lang
    }
  }

  const langs = [
    // Look first at the code element.
    ...decipherFromElement($code),
    // And then the pre element.
    ...decipherFromElement($pre)
  ]

  return langs.length ? langs[0] : 'text'
}

/**
 * Given any element, figure out what language it might be.
 *
 * @param $el
 * @return {*[]}
 */
function decipherFromElement ($el) {
  if (!$el) {
    return []
  }

  const classes = ($el.attr('class') || '')
    .split(' ')
  // These classes are commonly used to denote code languages.
    .filter(c => c.startsWith('language-') || c.startsWith('lang-'))
    .map(c => c.replace('language-', '').replace('lang-', ''))

  return [
    // Data attributes get highest priority.
    $el.data()?.language,
    $el.data()?.lang,
    ...classes
  ].filter(l => l)
}
