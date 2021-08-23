const { bus, FILE_WATCHING_COMPLETE } = require('../../src/support/bus')
const { testCli } = require('../../src/cli')
const { readFileSync } = require('fs-extra')
const torchlight = require('../../src/torchlight')

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
