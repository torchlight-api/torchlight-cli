import { readFileSync } from 'fs-extra'
import { bus, FILE_WATCHING_COMPLETE } from '../../src/support/bus.js'
import { testCli } from '../../src/cli.js'
import torchlight from '../../src/torchlight.js'

function fixture (file, callback, options = {}) {
  options = {
    clearCache: true,
    ...options
  }

  let [path, description] = file.split(':')

  path = path.replace(' ', '-') + '.html'
  description = description ?? 'snapshot'

  const dashes = '-'.repeat(30 - path.length)

  description = `${path} ${dashes} ${description.trim()}`

  // If there was no callback, it's just a snapshot test.
  callback = callback ?? function () {
    const mock = mockApi(() => [])

    return () => expect(mock).toHaveBeenCalledTimes(1)
  }

  test(description, done => {
    const after = callback()

    bus.once(FILE_WATCHING_COMPLETE, () => {
      after && after()

      const contents = readFileSync(`tests/tmp/${path}`, 'utf-8')
      expect(contents).toMatchSnapshot(`${path} ${description.trim()}`)

      done()
    })

    torchlight.init()
    
    if (options.clearCache) {
      torchlight.cache.clear()
    }

    testCli([
      '-i', 'tests/fixtures',
      '-o', 'tests/tmp',
      '-n', path
    ])
  }, 1000)
}

function mockApi (callback) {
  const axios = require('axios')

  jest.spyOn(axios, 'post').mockImplementation((url, data, config) => {
    const response = callback(data, url, config)

    return mockApiResponse(response)
  })

  return axios.post
}

function mockApiResponse (response) {
  if (Array.isArray(response)) {
    response = {
      blocks: response
    }
  }

  if (typeof response.then === 'function') {
    return response
  }

  return Promise.resolve({
    data: response
  })
}

module.exports = { fixture, mockApi, mockApiResponse }
