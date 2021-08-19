const {readFileSync, writeFileSync, ensureFileSync} = require('fs-extra')
const path = require('path');
const torchlight = require('../torchlight');
const Block = require('../block');
const cheerio = require('cheerio').default;
const chokidar = require('chokidar');
const log = require('../support/log')

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

    let input = path.resolve(options.input);
    let output = path.resolve(options.output || options.input);

    let watcher = chokidar.watch(normalizeStringedArray(options.include), {
        cwd: input,
        ignored: path => normalizeStringedArray(options.exclude).some(s => path.includes(s)),
        ignoreInitial: false
    })

    watcher.on('all', (event, file) => {
        if (event !== 'add' && event !== 'change') {
            return;
        }

        log.info('Highlighting %s', file);

        let source = readFileSync(path.join(input, file), 'utf-8');

        highlight(torchlight, source).then(highlighted => {
            let destination = path.join(output, file);

            ensureFileSync(destination);
            if (highlighted === readFileSync(destination, 'utf-8')) {
                return;
            }

            log.info('Writing to %s', destination);
            writeFileSync(destination, highlighted, 'utf-8')
        })
    })

    watcher.on('ready', function () {
        if (!options.watch) {
            watcher.close();
        }
    })
}

function normalizeStringedArray(value) {
    return (typeof value === 'string' ? value.split(',') : value).filter(x => x);
}

function highlight(torchlight, source) {
    let highlighted = source;

    let $ = cheerio.load(source, {
        sourceCodeLocationInfo: true
    }, false);

    let blocks = [];

    // Search for blocks that have not already been processed.
    $('pre:not([data-torchlight-processed])').each((index, pre) => {
        let $pre = $(pre);
        let $code = $pre.children('code');

        let block = new Block({
            // Using `text()` will re-encode entities like &lgt;
            code: $pre.text(),
            language: decipherLanguage($pre)
        });

        // Cut out the *exact* pre element as it is in the file. Cheerio converts
        // single quotes to double, normalizes whitespace, and otherwise "cleans
        // up" the parsed document, so we can't simply modify the Cheerio dom and
        // write it back to disk. Instead we're going to surgically cut out the
        // pre tag and all its contents without touching anything else around it.
        let pristinePreElement = source.substring(
            pre.sourceCodeLocation.startOffset,
            pre.sourceCodeLocation.endOffset
        );

        // Add our class placeholder as a class, so that we don't overwrite
        // any classes that are already there.
        $pre.addClass(block.placeholder('class'));

        // Add the options hash that this block will be highlighted with.
        $pre.attr('data-torchlight-processed', torchlight.configHash());

        // Add a fake style that we can replace later.
        $pre.css(block.placeholder('style'), '0')

        // Store the raw code as the developer wrote it, so we can re-highlight
        // it later if we need to, or allow it to be copied to clipboard.
        let raw = `<textarea data-torchlight-original='true' style='display: none !important;'>${$code.html()}</textarea>`;

        // Add the placeholder inside the code tag.
        $code.html(block.placeholder('highlighted') + raw);

        // Give the developer an opportunity to add things to the placeholder
        // element. Like copy to clipboard buttons, language indicators, etc.
        if (torchlight.config('modifyPlaceholderElement')) {
            torchlight.config('modifyPlaceholderElement')($, $pre, $code, block);
        }

        // Swap out the original tag with the outerHTML of our built up tag.
        highlighted = highlighted.replace(pristinePreElement, $.html($pre));

        blocks.push(block);
    });

    if (!blocks.length) {
        return Promise.resolve(source);
    }

    return torchlight.highlight(blocks).then(() => {
        blocks.forEach(block => {
            let swap = {
                [block.placeholder('class')]: block.classes ?? '',
                [block.placeholder('style') + ': 0;']: block.styles ?? '',
                [block.placeholder('highlighted')]: block.highlighted
            }

            Object.keys(swap).forEach(key => {
                highlighted = highlighted.replace(key, swap[key]);
            })
        })

        return highlighted;
    })

}

/**
 * Given a <pre> element, figure out what language it is.
 *
 * @param $pre
 * @return {string}
 */
function decipherLanguage($pre) {
    let custom = torchlight.config('decipherLanguageFromElement')

    // Let the developer add their own deciphering mechanism.
    if (custom) {
        let lang = custom($pre);

        if (lang) {
            return lang;
        }
    }

    let langs = [
        // Look first at the code element.
        ...decipherFromElement($pre.children('code')),
        // And then the pre element.
        ...decipherFromElement($pre),
    ]

    return langs.length ? langs[0] : 'text';
}

/**
 * Given any element, figure out what language it might be.
 *
 * @param $el
 * @return {*[]}
 */
function decipherFromElement($el) {
    if (!$el) {
        return []
    }

    let classes = ($el.attr('class') || '')
        .split(' ')
        // These classes are commonly used to denote code languages.
        .filter(c => c.startsWith('language-') || c.startsWith('lang-'))
        .map(c => c.replace('language-', '').replace('lang-', ''));

    return [
        // Data attributes get highest priority.
        $el.data()?.language,
        $el.data()?.lang,
        ...classes
    ].filter(l => l);
}