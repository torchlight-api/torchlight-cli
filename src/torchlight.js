const axios = require('axios');
const FileCache = require('./cache/file');
const MemoryCache = require('./cache/memory');
const {readJsonSync, pathExistsSync} = require('fs-extra')
const path = require('path');
const md5 = require('md5');
const get = require('lodash.get');
const log = require('./support/log');

const VERSION = readJsonSync(path.resolve('package.json')).version;

/**
 * @constructor
 */
let Torchlight = function () {
    //
}

/**
 * @param config
 * @return {Torchlight}
 */
Torchlight.prototype.init = function (config) {
    this.configuration = this.normalizeConfiguration(config);
    this.cache = this.makeCache();

    return this;
}

/**
 * Get a value out of the configuration.
 *
 * @param {string} key
 * @param {*} def
 * @return {*}
 */
Torchlight.prototype.config = function (key, def = undefined) {
    return get(this.configuration, key, def);
}

/**
 * Hash of the Torchlight configuration.
 *
 * @return {string}
 */
Torchlight.prototype.configHash = function () {
    return md5(this.configuration);
}

/**
 * @param {string|object} config
 * @return {*}
 */
Torchlight.prototype.normalizeConfiguration = function (config) {
    // By convention, look in the root directory for
    // a torchlight.config.js file.
    if (config === undefined || config === '') {
        config = 'torchlight.config.js';
    }

    // Allow the developer to pass another path to us.
    if (typeof config === 'string') {
        config = pathExistsSync(path.resolve(config)) ? require(path.resolve(config)) : {};
    }

    return config;
}

/**
 * Make a cache to hold highlighted blocks.
 *
 * @return {Cache}
 */
Torchlight.prototype.makeCache = function () {
    let cache = this.config('cache', false);

    // Make a file cache if we're given a directory.
    if (cache && typeof cache === 'string') {
        return new FileCache({
            directory: cache
        });
    }

    // Use the cache they have provided, or default to an in-memory cache.
    return cache ? cache : new MemoryCache();
}

/**
 * @param blocks
 * @return {Promise<*>}
 */
Torchlight.prototype.highlight = function (blocks) {
    blocks.map(block => block.setResponseData(this.cache.get(block.hash(), {})));

    let needed = blocks.filter(block => !block.highlighted);

    return this.request(needed).then(response => {
        needed.forEach(block => {
            let found = response?.data?.blocks?.find(b => block.id === b.id);

            if (!found) {
                return;
            }

            this.cache.set(block.hash(), {
                highlighted: found.highlighted,
                classes: found.classes,
                styles: found.styles,
            });

            block.setResponseData(found);
        })

        blocks.filter(block => !block.highlighted)
            .forEach(block => {
                if (response !== 403) {
                    log.error('A block failed to highlight. Ensure "%s" is a valid language.', block.language);
                }

                block.highlighted = block.code.split('\n').map(line => `<div class="line">${htmlEntities(line)}</div>`).join('');
                block.classes = 'torchlight';
            })

        return blocks;
    });
}

Torchlight.prototype.request = function (blocks) {
    if (!blocks.length) {
        return Promise.resolve([])
    }

    let token = this.config('token');

    if (!token) {
        log.error(`No Torchlight token configured!`);
        return Promise.resolve(403);
    }

    return axios.post('https://api.torchlight.dev/highlight', {
        blocks: blocks.map(block => block.toRequestParams()),
        options: this.config('options', {})
    }, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'X-Torchlight-Client': `Torchlight CLI ${VERSION}`
        }
    }).catch(err => {
        log.error(err.message);

        return err.response.status;
    })
}

function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = new Torchlight;
