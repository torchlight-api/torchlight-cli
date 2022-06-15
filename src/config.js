import fs from 'fs-extra'
import path from 'path'
import FileCache from './cache/file'
import MemoryCache from './cache/memory'

/**
 * @param {string|object} config
 * @return {*}
 */
export function makeConfig (config) {
  // By convention, look in the root directory for
  // a torchlight.config.js file.
  if (config === undefined || config === '') {
    config = 'torchlight.config.js'
  }

  if (typeof config === 'string') {
    config = fs.pathExistsSync(path.resolve(config)) ? require(path.resolve(config)) : {}
  }

  return config || {}
}

/**
 * Make a cache to hold highlighted blocks.
 *
 * @return {Cache}
 */
export function makeCache (config) {
  const cache = config?.cache

  // Make a file cache if we're given a directory.
  if (cache && typeof cache === 'string') {
    return new FileCache({
      directory: cache
    })
  }

  // Use the cache they have provided, or default to an in-memory cache.
  return cache || new MemoryCache()
}
