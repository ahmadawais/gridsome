const fs = require('fs-extra')
const { createBundleRenderer } = require('vue-server-renderer')

exports.render = async function ({ pages, outDir }) {
  const clientManifest = require(`${outDir}/manifest/client.json`)
  const serverBundle = require(`${outDir}/manifest/server.json`)
  const templatePath = require.resolve('../../../../app/index.server.html')
  const template = fs.readFileSync(templatePath, 'utf-8')

  const renderer = createBundleRenderer(serverBundle, {
    inject: false,
    runInNewContext: false,
    clientManifest,
    template
  })

  for (let i = 0, l = pages.length; i < l; i++) {
    const page = pages[i]

    const context = {
      url: page.path,
      title: 'Gridsome',
      lang: 'en',
      state: {}
    }

    if (page.query) {
      context.queryResults = require(`${page.output}/data.json`)
    }

    try {
      const html = await renderer.renderToString(context)
      fs.outputFileSync(`${page.output}/index.html`, html)
    } catch (err) {
      throw err
    }
  }
}