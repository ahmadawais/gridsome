const path = require('path')
const fs = require('fs-extra')
const crypto = require('crypto')
const { defaultsDeep, camelCase } = require('lodash')
const { internalRE, transformerRE } = require('../utils/constants')

const builtInPlugins = [
  'internal://plugins/source-vue'
]

// TODO: use joi to define and validate config schema
module.exports = (context, options = {}, pkg = {}) => {
  const resolve = (...p) => path.resolve(context, ...p)
  const isServing = process.env.GRIDSOME_MODE === 'serve'
  const isProd = process.env.NODE_ENV === 'production'
  const configPath = resolve('gridsome.config.js')
  const args = options.args || {}
  const plugins = []
  const config = {}

  const localConfig = fs.existsSync(configPath)
    ? require(configPath)
    : {}

  // use provided plugins instaed of local plugins
  if (Array.isArray(options.plugins)) {
    plugins.push(...options.plugins)
  } else if (Array.isArray(localConfig.plugins)) {
    plugins.push(...localConfig.plugins)
  }

  // add built-in plugins as default
  if (options.useBuiltIn !== false) {
    plugins.unshift(...builtInPlugins)
  }

  if (localConfig.pathPrefix && /\/+$/.test(localConfig.pathPrefix)) {
    throw new Error(`pathPrefix must not have a trailing slash`)
  }

  config.pkg = options.pkg || resolvePkg(context)
  config.host = args.host || 'localhost'
  config.port = parseInt(args.port, 10) || 8080
  config.plugins = normalizePlugins(plugins)
  config.chainWebpack = localConfig.chainWebpack
  config.transformers = resolveTransformers(config.pkg, localConfig)
  config.pathPrefix = isProd && isServing ? '/' : localConfig.pathPrefix || '/'
  config.staticDir = resolve('static')
  config.outDir = resolve(localConfig.outDir || 'dist')
  config.targetDir = path.join(config.outDir, config.pathPrefix)
  config.assetsDir = path.join(config.targetDir, localConfig.assetsDir || 'assets')
  config.appPath = path.resolve(__dirname, '../../app')
  config.tmpDir = resolve('src/.temp')
  config.cacheDir = resolve('.cache')
  config.minProcessImageWidth = 500 // TODO: find a better name for this
  config.maxImageWidth = localConfig.maxImageWidth || 1920

  // max cache age for html markup in serve mode
  config.maxCacheAge = localConfig.maxCacheAge || 1000

  config.siteUrl = localConfig.siteUrl || ''
  config.baseUrl = localConfig.baseUrl || '/'
  config.siteName = localConfig.siteName || path.parse(context).name
  config.titleTemplate = localConfig.titleTemplate || `%s - ${config.siteName}`

  config.manifestsDir = path.join(config.assetsDir, 'manifest')
  config.clientManifestPath = path.join(config.manifestsDir, 'client.json')
  config.serverBundlePath = path.join(config.manifestsDir, 'server.json')

  config.icon = normalizeIconsConfig(localConfig.icon)

  config.templatePath = path.resolve(config.appPath, 'index.html')
  config.htmlTemplate = fs.readFileSync(config.templatePath, 'utf-8')

  config.scss = {}
  config.sass = {}
  config.less = {}
  config.stylus = {}
  config.postcss = {}

  return Object.freeze(config)
}

function resolvePkg (context) {
  const pkgPath = path.resolve(context, 'package.json')
  let pkg = { dependencies: {}}

  try {
    const content = fs.readFileSync(pkgPath, 'utf-8')
    pkg = Object.assign(pkg, JSON.parse(content))
  } catch (err) {}

  if (!Object.keys(pkg.dependencies).includes('gridsome')) {
    throw new Error('This is not a Gridsome project.')
  }

  return pkg
}

function normalizePlugins (plugins) {
  return plugins.map((plugin, index) => {
    if (typeof plugin === 'string') {
      plugin = { options: {}, use: plugin }
    }

    const re = /(?:^@?gridsome[/-]|\/)(source|plugin)-([\w-]+)/
    const use = plugin.use.replace(internalRE, '../')
    const uid = crypto.createHash('md5').update(`${use}-${index}`).digest('hex')
    const { isBrowser, isServer, isApp } = resolvePluginType(use)
    const [, type, name] = plugin.use.match(re)

    return defaultsDeep({
      instance: undefined,
      options: {},
      isBrowser,
      isServer,
      isApp,
      name,
      use,
      uid,
      type
    }, plugin)
  })
}

function resolvePluginType (id) {
  const exists = entry => {
    const pluginPath = path.parse(require.resolve(id)).dir
    return /^@gridsome\//.test(id) && process.env.GRIDSOME_DEV
      ? fs.existsSync(`${pluginPath}/src/${entry}`)
      : fs.existsSync(`${pluginPath}/${entry}`)
  }

  const isBrowser = exists('browser.js')
  const isServer = exists('server.js')
  const isApp = exists('app.js')

  return { isBrowser, isServer, isApp }
}

function resolveTransformers (pkg, config) {
  const { dependencies = {}, devDependencies = {}} = pkg
  const deps = Object.keys({
    ...dependencies,
    ...devDependencies
  })

  const result = {}

  for (let id of deps) {
    let matches = id.match(transformerRE)

    if (internalRE.test(id)) {
      id = id.replace(internalRE, '../')
      matches = []
    }

    if (!matches) continue

    // TODO: transformers looks for base config in gridsome.config.js
    // - @gridsome/transformer-remark -> config.transformers.remark
    // - @foo/gridsome-transformer-remark -> config.transformers.remark
    // - gridsome-transformer-foo-bar -> config.transformers.fooBar

    const [, suffix] = matches
    const name = camelCase(suffix)
    const TransformerClass = require(id)
    const options = (config.transformers || {})[name] || {}

    for (const mimeType of TransformerClass.mimeTypes()) {
      result[mimeType] = { TransformerClass, options, name }
    }
  }

  return result
}

function normalizeIconsConfig (config = {}) {
  const res = {}

  const faviconSizes = [16, 32, 96]
  const touchiconSizes = [76, 152, 120, 167, 180]
  const defaultIcon = 'src/favicon.png'
  const icon = typeof config === 'string' ? { favicon: icon } : (config || {})

  res.favicon = typeof icon.favicon === 'string'
    ? { src: icon.favicon, sizes: faviconSizes }
    : Object.assign({}, icon.favicon, {
      sizes: faviconSizes,
      src: defaultIcon
    })

  res.touchicon = typeof icon.touchicon === 'string'
    ? { src: icon.touchicon, sizes: faviconSizes, precomposed: false }
    : Object.assign({}, icon.touchicon, {
      sizes: touchiconSizes,
      src: res.favicon.src,
      precomposed: false
    })

  return res
}
