'use strict'

const { uniqBy, concat, isEmpty, reduce, get, findIndex } = require('lodash')
const { normalizeUrl } = require('@metascraper/helpers')
const isHttpUrl = require('is-url-http')
const cheerio = require('cheerio')
const matcher = require('matcher')

const UID = 'normalizedUrl'

const TAGS = {
  background: ['body'],
  cite: ['blockquote', 'del', 'ins', 'q'],
  data: ['object'],
  href: ['a', 'area', 'embed', 'link'],
  icon: ['command'],
  longdesc: ['frame', 'iframe'],
  manifest: ['html'],
  poster: ['video'],
  pluginspage: ['embed'],
  pluginurl: ['embed'],
  src: [
    'audio',
    'embed',
    'frame',
    'iframe',
    'img',
    'input',
    'script',
    'source',
    'track',
    'video'
  ]
}

const reduceSelector = (collection, fn, acc = []) => {
  collection.each(function () {
    acc = fn(acc, this)
  })
  return acc
}

const includes = (collection, fn) => findIndex(collection, fn) !== -1

const getLink = ({ url, el, attribute }) => {
  const attr = get(el, `attribs.${attribute}`, '')
  if (isEmpty(attr) || !isHttpUrl(attr)) return null

  try {
    const normalizedUrl = normalizeUrl(url, attr)
    return { url: attr, normalizedUrl }
  } catch (err) {
    return null
  }
}

const createGetLinksByAttribute = ({ removeDuplicates }) => {
  const has = removeDuplicates
    ? (acc, uid) => includes(acc, item => get(item, UID) === uid)
    : () => false

  return ({ selector, attribute, url, whitelist }) =>
    reduceSelector(
      selector,
      (acc, el) => {
        const link = getLink({ url, el, attribute })
        const uid = get(link, UID)
        if (isEmpty(link)) return acc
        const isAlreadyAdded = has(acc, uid)
        if (isAlreadyAdded) return acc
        const match = !isEmpty(whitelist) && matcher([uid], concat(whitelist))
        return isEmpty(match) ? concat(acc, link) : acc
      },
      []
    )
}

const createAdd = ({ removeDuplicates }) =>
  removeDuplicates
    ? (acc, links) => uniqBy(concat(acc, links), UID)
    : (acc, links) => concat(acc, links)

module.exports = ({
  html = '',
  url = '',
  whitelist = false,
  removeDuplicates = true,
  cheerioOpts = {}
} = {}) => {
  const $ = cheerio.load(html, cheerioOpts)

  const add = createAdd({ removeDuplicates })
  const getLinksByAttribute = createGetLinksByAttribute({ removeDuplicates })

  return reduce(
    TAGS,
    (acc, htmlTags, attribute) => {
      const links = getLinksByAttribute({
        selector: $(htmlTags.join(',')),
        attribute,
        url,
        whitelist
      })

      return add(acc, links)
    },
    []
  )
}

module.exports.TAGS = TAGS
