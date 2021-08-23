const md5 = require('md5')
const guid = require('./support/guid')
const torchlight = require('./torchlight')

const Block = function (opts = {}) {
  opts = {
    id: guid(),
    theme: torchlight.config('theme', 'nord'),
    ...opts
  }

  this.id = opts.id
  this.code = opts.code
  this.language = opts.language
  this.theme = opts.theme

  this.highlighted = null
  this.classes = null
  this.styles = null
}

Block.prototype.hash = function () {
  return md5('' +
        this.language +
        this.theme +
        this.code +
        torchlight.config('bust', 0) +
        JSON.stringify(torchlight.config('options'))
  )
}

Block.prototype.code = function (code) {
  this.code = code

  return this
}

Block.prototype.language = function (language) {
  this.language = language

  return this
}

Block.prototype.theme = function (theme) {
  this.theme = theme

  return this
}

Block.prototype.placeholder = function (extra = '') {
  if (extra) {
    extra = `-${extra}`
  }

  return `__torchlight-block-[${this.id}]${extra}__`
}

Block.prototype.setResponseData = function (data) {
  if (data) {
    this.highlighted = data.highlighted
    this.classes = data.classes
    this.styles = data.styles
  }

  return this
}

Block.prototype.toRequestParams = function () {
  return {
    id: this.id,
    hash: this.hash,
    language: this.language,
    theme: this.theme,
    code: this.code
  }
}

module.exports = Block
