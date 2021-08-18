const axios = require('axios');
const FileCache = require('./cache/file');
const MemoryCache = require('./cache/memory');
const {readJsonSync, pathExistsSync} = require('fs-extra')
const path = require('path');
const md5 = require('md5');

const VERSION = readJsonSync(path.resolve('package.json')).version;

/**
 * @constructor
 */
let Torchlight = function () {
    //
}

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
    return this.configuration.hasOwnProperty(key) ? this.configuration[key] : def;
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
    // Make a file cache if we're given a directory.
    if (this.config('cacheDirectory')) {
        return new FileCache({
            directory: this.config('cacheDirectory')
        });
    }

    // Use the cache they have provided, or default to an in-memory cache.
    return this.config('cache') ? this.config('cache') : new MemoryCache();
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
            let found = response.data.blocks.find(b => block.id === b.id);

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

        return blocks;
    });
}

Torchlight.prototype.request = function (blocks) {
    if (!blocks.length) {
        return Promise.resolve([])
    }

    // @TODO Catch rejection
    return axios.post('https://api.torchlight.dev/highlight', {
        blocks: blocks.map(block => block.toRequestParams()),
        options: this.config('options', {})
    }, {
        headers: {
            'Authorization': `Bearer ` + this.config('token'),
            'X-Torchlight-Client': `Torchlight CLI ${VERSION}`
        }
    })
}

module.exports = new Torchlight;
