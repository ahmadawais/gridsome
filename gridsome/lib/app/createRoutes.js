const camelCase = require('camelcase')

const {
  PAGED_ROUTE,
  STATIC_ROUTE,
  STATIC_TEMPLATE_ROUTE,
  DYNAMIC_TEMPLATE_ROUTE
} = require('../utils/constants')

module.exports = store => {
  const pages = store.pages.find({ type: 'page' })
  const templates = store.pages.find({ type: 'template' })
  const notFoundPage = store.pages.findOne({ type: '404' })
  const staticPages = []
  const pagedPages = []
  const staticTemplates = []
  const dynamicTemplates = []

  const notFoundComponent = notFoundPage
    ? notFoundPage.component
    : 'gridsome/app/pages/404.vue'

  pages.forEach(page => {
    const name = camelCase(page.path.replace(/\//g, ' ')) || 'home'
    let arr = staticPages
    let type = STATIC_ROUTE
    let route = page.path

    if (page.pageQuery.paginate.collection) {
      route = `${page.path === '/' ? '' : page.path}/:page(\\d+)?`
      type = PAGED_ROUTE
      arr = pagedPages
    }

    arr.push({
      name,
      type,
      route,
      path: page.path,
      component: page.component,
      pageQuery: page.pageQuery
    })
  })

  templates.forEach(page => {
    const typeName = page.pageQuery.type
    const contentType = store.types[typeName]
    const collection = store.collections[typeName]
    const { component, pageQuery } = page

    // Add a dynamic route for this template if a route is
    // specified. Or we'll create a route for each node. The only
    // difference here is that dynamic routes has route and name
    // while static routes has path and chunkName.

    if (contentType.route) {
      dynamicTemplates.push({
        type: DYNAMIC_TEMPLATE_ROUTE,
        route: contentType.route,
        name: camelCase(typeName),
        component,
        pageQuery,
        collection
      })
    } else {
      const nodes = collection.find()

      for (const node of nodes) {
        staticTemplates.push({
          type: STATIC_TEMPLATE_ROUTE,
          path: node.path,
          chunkName: camelCase(typeName),
          component,
          pageQuery,
          collection
        })
      }
    }
  })

  return {
    notFoundComponent,
    pages: [
      ...staticPages,
      ...pagedPages,
      ...staticTemplates,
      ...dynamicTemplates
    ]
  }
}
