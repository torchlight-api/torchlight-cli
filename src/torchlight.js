import axios from 'axios'
import FileCache from './cache/file'
import fs from 'fs-extra'
import MemoryCache from './cache/memory'
import path from 'path'
import md5 from 'md5'
import get from 'lodash.get'
import chunk from 'lodash.chunk'
import log from './support/log'

const VERSION = fs.readJsonSync(path.resolve('package.json')).version

/**
 * @constructor
 */
const Torchlight = function () {
  this.initialized = false
  this.chunkSize = 30
  this.configuration = {}
}

/**
 * @param config
 * @return {Torchlight}
 */
Torchlight.prototype.init = function (config) {
  if (this.initialized) {
    return this
  }

  this.initialized = true
  this.configuration = this.normalizeConfiguration(config)
  this.cache = this.makeCache()

  return this
}

/**
 * Get a value out of the configuration.
 *
 * @param {string} key
 * @param {*} def
 * @return {*}
 */
Torchlight.prototype.config = function (key, def = undefined) {
  return get(this.configuration, key, def)
}

/**
 * Hash of the Torchlight configuration.
 *
 * @return {string}
 */
Torchlight.prototype.configHash = function () {
  return md5(this.configuration)
}

/**
 * @param {string|object} config
 * @return {*}
 */
Torchlight.prototype.normalizeConfiguration = function (config) {
  // By convention, look in the root directory for
  // a torchlight.config.js file.
  if (config === undefined || config === '') {
    config = 'torchlight.config.js'
  }

  // Allow the developer to pass another path to us.
  if (typeof config === 'string') {
    config = fs.pathExistsSync(path.resolve(config)) ? require(path.resolve(config)) : {}
  }

  if (process.env.TORCHLIGHT_TOKEN && !config.token) {
    config.token = process.env.TORCHLIGHT_TOKEN
  }

  return config
}

/**
 * Make a cache to hold highlighted blocks.
 *
 * @return {Cache}
 */
Torchlight.prototype.makeCache = function () {
  const cache = this.config('cache', false)

  // Make a file cache if we're given a directory.
  if (cache && typeof cache === 'string') {
    return new FileCache({
      directory: cache
    })
  }

  // Use the cache they have provided, or default to an in-memory cache.
  return cache || new MemoryCache()
}

/**
 * @param blocks
 * @return {Promise<*>}
 */
Torchlight.prototype.highlight = function (blocks) {
  // Set the data from cache if it's there.
  blocks.map(block => block.setResponseData(this.cache.get(block.hash(), {})))

  // Reject the blocks that have already been highlighted from the cache.
  const needed = blocks.filter(block => !block.highlighted)

  // Only send the un-highlighted blocks to the API.
  return this.request(needed)
    .then(highlighted => {
      needed.forEach(block => {
        // Look through the response and match em up by ID.
        const found = highlighted.find(b => block.id === b.id)

        if (!found || !found.highlighted) {
          return
        }

        // Store it in the cache for later.
        this.cache.set(block.hash(), {
          highlighted: found.highlighted,
          classes: found.classes,
          styles: found.styles
        })

        // Set the info on the block.
        block.setResponseData(found)
      })

      // Look for the blocks that weren't highlighted and add a default.
      blocks.filter(block => !block.highlighted).forEach(block => {
        log.error(`A block failed to highlight. The code was: \`${block.code.substring(0, 20)} [...]\``)

        // Add the `line` divs so everyone's CSS will work even on default blocks.
        block.highlighted = block.code.split('\n').map(line => `<div class="line">${htmlEntities(line)}</div>`).join('')
        block.classes = 'torchlight'
      })

      return blocks
    })
}

/**
 * @param blocks
 * @return {Promise<*[]>}
 */
Torchlight.prototype.request = function (blocks) {
  if (!blocks.length) {
    return Promise.resolve([])
  }

  const token = this.config('token')

  if (!token) {
    throw new Error('No Torchlight token configured!')
  }

  // For huge sites, we need to send blocks in chunks so
  // that we don't send e.g. 500 blocks in one request.
  if (blocks.length > this.chunkSize) {
    return this.fan(blocks)
  }

  const host = this.config('host', 'https://api.torchlight.dev')

  return axios.post(`${host}/highlight`, {
    blocks: blocks.map(block => block.toRequestParams()),
    options: this.config('options', {})
  }, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Torchlight-Client': `Torchlight CLI ${VERSION}`
    }
  }).then(response => response.data.blocks)
}

Torchlight.prototype.fan = function (blocks) {
  const highlighted = []
  const errors = []
  const requests = chunk(blocks, this.chunkSize).map(chunk => this.request(chunk))

  // Let all of the promises settle, even if some of them fail.
  return Promise.allSettled(requests).then(responses => {
    responses.forEach(response => {
      // For a successful request, add the blocks to the array.
      if (response.status === 'fulfilled') {
        highlighted.push(...response.value)
      }

      // For an error, stash it as well.
      if (response.status === 'rejected') {
        errors.push(response.reason)
      }
    })

    // We got some blocks...
    if (highlighted.length) {
      // ...and some errors. In this case we just log the
      // error and go ahead and use the blocks.
      if (errors.length) {
        log.error(`${errors.length} fanned request(s) failed, but others succeeded. Error: ${errors[0]}.`)
      }

      return highlighted
    }

    // Errors only, throw a proper error.
    if (errors.length) {
      throw new Error(errors[0])
    }

    return []
  })
}

function htmlEntities (str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export default new Torchlight()
