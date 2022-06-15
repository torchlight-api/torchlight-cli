import torchlight from '../src/torchlight.js';
import {mockApi, fixture} from './support/helpers.js';
import log from '../src/support/log.js';

process.env.TORCHLIGHT_TOKEN = 'test'

log.silence()

beforeEach(() => {
  torchlight.initialized = false
})

fixture('keygen: fixes zekes issue')

fixture('multiple-blocks: three blocks in one pre tag', () => {
  const mock = mockApi(data => {
    expect(data.blocks).toHaveLength(3)

    return data.blocks
  })

  return () => expect(mock).toHaveBeenCalledTimes(1)
})

fixture('120-blocks: it sends requests in chunks', () => {
  const mock = mockApi(data => {
    expect(data.blocks).toHaveLength(torchlight.chunkSize)

    return data.blocks.map(block => {
      block.highlighted = 'highlighted'
      return block
    })
  })

  return () => expect(mock).toHaveBeenCalledTimes(Math.ceil(120 / torchlight.chunkSize))
})

fixture('single-block', () => {
  const mock = mockApi(data => {
    expect(data.blocks).toHaveLength(1)

    const block = data.blocks[0]

    expect(block.code).toEqual('this is test <code>')
    expect(block.language).toEqual('html')

    return [{
      ...block,
      highlighted: 'highlighted',
      classes: 'classes',
      styles: 'style: 1;'
    }]
  })

  return () => expect(mock).toHaveBeenCalledTimes(1)
})

fixture('cached: pulls from cache', () => {
  // This is the known hash of the block in the cached.html file.
  torchlight.cache.set('56cb7c008dcb9a0c1f619c83454e5817', {
    highlighted: 'highlighted',
    classes: 'classes',
    styles: 'styles'
  })

  // Don't return anything from the API.
  const mock = mockApi(data => [])

  // Assert it was never called.
  return () => expect(mock).toHaveBeenCalledTimes(0)
}, { clearCache: false })

fixture('decipher-language: it deciphers languages based on attributes', () => {
  torchlight.init({
    highlight: {
      // If data-custom exists we'll use it,
      // otherwise it should fall through.
      decipherLanguageFromElement: function ($pre) {
        return $pre.data()?.custom
      }
    }
  })

  const mock = mockApi(data => {
    data.blocks.forEach(block => {
      // To simplify this test, we set the expectations in the
      // fixture file. The language should match whatever
      // we put in there as the code.
      expect(block.language).toEqual(block.code)
    })

    return data.blocks
  })

  return () => expect(mock).toHaveBeenCalledTimes(1)
})