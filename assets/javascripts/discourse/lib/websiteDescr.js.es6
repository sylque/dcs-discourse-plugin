//import { u } from './utils'
import { DcsTag } from './DcsTag'
import { deepCloneJSON } from './deepCloneJSON'

//------------------------------------------------------------------------------

// Load the embedded website descriptor from the url of the json data
export const loadWebsiteDescr = (jsonUrls, validCatNames, proxyUrl) => {
  // Load and check all jsonUrl separately
  const loadAll = jsonUrls.map(jsonUrl =>
    getJSON(jsonUrl).then(
      descr => {
        transformOriginalDescr(descr, jsonUrl)

        const clone = deepCloneJSON(descr)

        try {
          validateClone(clone, validCatNames, descr['dcsTag'], proxyUrl)
        } catch (e) {
          if (typeof e === 'string' && jsonUrls.length > 1) {
            e = `In ${jsonUrl} - ${e}`
          }
          throw e
        }

        transformClone(clone, jsonUrl)

        clone.originalDescr = descr

        return clone
      },
      e => {
        throw `<p>Failed to load <a href="${jsonUrl}" target="_blank">${jsonUrl}</a></p>` +
          '<o>Possible causes:</p><ol>' +
          '<li>File is missing (click on the above url, this should open your file in a new tab) </li>' +
          '<li>File is hosted at a "https://" url and your Discourse forum is at a "http://" url (or the other way around)</li>' +
          `<li>File is not in json format (in the new tab that you've just opened, does it look like JSON?)</li>` +
          '<li>File has not been validated (please check with the <a href="https://sylque.github.io/dcs-website-schema/public/validate.html" target="_blank">Docuss Validation Tool</a>)</li>' +
          '<li>File is blocked by an ad-blocker (try to disable any ad-blockers and refresh the page)</li>' +
          `<li>File is hosted on a server that doesn't support CORS (open the <a href="https://kb.mailster.co/how-can-i-open-the-browsers-console/" target="_blank">browser console</a> and look for some red text about "CORS policy")</li></ol>`
      }
    )
  )

  // Merge all descr to make one
  return Promise.all(loadAll).then(cloneArray => {
    validateCloneArray(cloneArray)
    return cloneArray
  })
}

//------------------------------------------------------------------------------

function transformOriginalDescr(descr, jsonUrl) {
  // Transform page urls from relative to absolute
  // THE CLIENT NEEDS THIS, AS IT IS IMPOSSIBLE TO RETRIEVE THE PROTOCOL OF THE
  // ORIGINAL URL WITHOUT PROXY
  descr['pages'].forEach(page => {
    page['url'] = new URL(page['url'], jsonUrl).href
  })
}

//------------------------------------------------------------------------------

function validateClone(clone, validCatNames, originalDcsTag, proxyUrl) {
  // Check the dcsTag field
  DcsTag.init(clone.dcsTag)

  const errorMsg =
    `contains invalid characters or doesn't comply with dcsTag=` +
    JSON.stringify(originalDcsTag)

  // Check pages
  clone.pages.forEach(page => {
    if (!DcsTag.checkPageName(page.name)) {
      throw `Page name "${page.name}" ${errorMsg}`
    }
    if (page.needsProxy && !proxyUrl) {
      throw 'Discourse setting "docuss proxy url" is required because a page has needsProxy=true'
    }
  })

  // Check redirects
  // Remember pages can be cross-website or dynamic
  if (clone.redirects) {
    clone.redirects.forEach(r => {
      const error = checkRedirect(r)
      if (error) {
        throw error
      }
    })
  }

  // Check web app
  if (clone.webApp) {
    // Check page name prefix
    const prefix = clone.webApp.otherPagesPrefix
    if (prefix && !DcsTag.checkPageNamePrefix(prefix)) {
      throw `Page name prefix "${prefix}" ${errorMsg}`
    }

    // Check url same origin
    const origin = new URL(clone.pages[0].url).origin
    const page = clone.pages.find(p => new URL(p.url).origin !== origin)
    if (page) {
      throw `Invalid url "${page.url}": in a web app, all page urls should be of same origin`
    }
  }

  // If no decorator, quit
  const decorator = clone.clientData && clone.clientData.decorator
  if (!decorator) {
    return
  }

  // Case there is a decorator

  // Extract some arrays
  const pageProperties = decorator.pageProperties || []
  //const injectCss = decorator.injectCss || []
  const triggers = decorator.injectTriggers || []
  /*
  // Check page name references
  const objsWithPageNames = [...pageProperties, ...injectCss, ...triggers]
  objsWithPageNames.forEach(o => {
    o.pageNames.forEach(pn => {
      if (pn === '*' && o.pageNames.length !== 1) {
        throw `Wildcard page name "*" must be alone in field "pageNames"`
      }
    })
  })

  // Check page name references
  const validPageNames = clone.pages.map(page => page.name)
  const allPageNames = objsWithPageNames
    .filter(o => o.pageNames[0] !== '*')
    .reduce((res, o) => res.concat(o.pageNames), [])
  const invalid = allPageNames.filter(pn => !validPageNames.includes(pn))
  if (invalid.length) {
    throw `Unknown page name(s) ${JSON.stringify(invalid)} in field "pageNames"`
  }
  */
  // Check categories
  const pagePropsCats = pageProperties.map(pp => pp.category)
  const triggerCats = triggers.map(t => t.category)
  const allCats = [decorator.category, ...pagePropsCats, ...triggerCats]
  allCats.forEach(catName => {
    if (catName && !validCatNames.includes(catName)) {
      throw `Category "${catName}" not found`
    }
  })

  // Check trigger ids
  triggers.forEach(trigger => {
    trigger.ids.forEach(id => {
      if (id === '@GENERATE@' || id === '@GENERATE_FROM_HTML_ID@') {
        if (trigger.ids.length !== 1) {
          throw `Reserved trigger id "${id}" must be alone in field "trigger.ids"`
        }
      } else {
        if (!DcsTag.checkTriggerId(id)) {
          throw `Trigger id "${id}" ${errorMsg}`
        }
      }
    })
  })
}

//------------------------------------------------------------------------------

function transformClone(clone, jsonUrl) {
  // Transform logo urls from relative to absolute
  const l = clone.logo
  if (l) {
    l.logoUrl = l.logoUrl && new URL(l.logoUrl, jsonUrl).href
    l.mobileLogoUrl = l.mobileLogoUrl && new URL(l.mobileLogoUrl, jsonUrl).href
    l.smallLogoUrl = l.smallLogoUrl && new URL(l.smallLogoUrl, jsonUrl).href
  }
}

//------------------------------------------------------------------------------

function validateCloneArray(cloneArray) {
  // Check dcsTag settings equality among websites
  const dcsTag1 = cloneArray[0].dcsTag
  for (let i = 1; i < cloneArray.length; ++i) {
    const dcsTag2 = cloneArray[i].dcsTag
    Object.keys(dcsTag1).forEach(key => {
      if (dcsTag1[key] !== dcsTag2[key]) {
        throw `Fields dcsTag.${key} are not equal across websites`
      }
    })
  }

  // Check website name uniqueness across websites
  const websiteNames = {}
  cloneArray.forEach(descr => {
    if (websiteNames[descr.websiteName]) {
      throw `Duplicate website name "${descr.websiteName}" across websites`
    }
    websiteNames[descr.websiteName] = true
  })

  // Check page name prefix
  const webApps = cloneArray
    .filter(descr => descr.webApp)
    .map(descr => descr.webApp)
  if (webApps.length > 1) {
    webApps.forEach(wa => {
      if (!wa.otherPagesPrefix) {
        throw `webApp.otherPagesPrefix must not be empty when there are several web apps`
      }
      if (
        webApps.find(
          wa2 =>
            wa2 !== wa && wa2.otherPagesPrefix.startsWith(wa.otherPagesPrefix)
        )
      ) {
        throw `overlapping webApp.otherPagesPrefix across web apps`
      }
    })
  }

  // Check page name uniqueness across websites
  const pageNames = {}
  cloneArray.forEach(descr => {
    descr.pages.forEach(p => {
      if (pageNames[p.name]) {
        throw `Duplicate page name "${p.name}" (across websites or within same website)`
      }
      pageNames[p.name] = true

      const found = webApps.find(
        wa => wa !== descr.webApp && p.name.startsWith(wa.otherPagesPrefix)
      )
      if (found) {
        throw `Page name "${p.name}" collides with page name prefix "${found.otherPagesPrefix}"`
      }
    })
  })
}

//------------------------------------------------------------------------------

const getJSON = url =>
  new Promise((resolve, reject) => {
    $.getJSON(url)
      .done(data => resolve(data))
      .fail((jqXHR, textStatus, errorThrown) => {
        reject(textStatus)
      })
  })

//------------------------------------------------------------------------------

export function checkRedirect(r) {
  let route
  if (r.src.layout === 1 || r.src.pathname) {
    route = { layout: 1, pathname: 'bla' }
  } else if (
    r.src.layout === 2 ||
    r.src.layout === 3 ||
    r.src.interactMode ||
    r.src.triggerId
  ) {
    route = { layout: 2, pageName: 'a', interactMode: 'DISCUSS' }
  } else {
    route = { layout: 0, pageName: 'a' }
  }
  const src = Object.assign({}, route, r.src)

  const err1 = checkRoute(src)
  if (err1) {
    // It's not good to display r.src here, because it is closure compiled
    return `Invalid redirect src - ${err1}`
  }

  const dest = Object.assign({}, r.dest)
  Object.keys(dest).forEach(key => {
    if (dest[key] === '@SAME_AS_SRC@') {
      dest[key] = src[key]
    }
  })

  const err2 = checkRoute(dest)
  if (err2) {
    // It's not good to display r.dest here, because it is closure compiled
    return `Invalid redirect dest - ${err2}`
  }
}

export function checkRoute(route) {
  // Remove empty properties
  Object.keys(route).forEach(key => {
    if (route[key] === undefined || route[key] === '') {
      delete route[key]
    }
  })

  // Don't use hasOwnProperty() here, otherwise it will always fail with the
  // closure compiler
  if (route.layout === undefined || route.layout === '') {
    return 'Missing layout'
  }

  let n = 1
  if (route.hash) {
    if (!route.hash.startsWith('#')) {
      return `Invalid hash "${route.hash}"`
    }
    ++n
  }

  switch (route.layout) {
    case 1:
      if (!route.pathname) {
        return 'Missing pathname'
      }
      ++n
      break
    case 2:
    case 3:
      if (!route.interactMode) {
        return 'Missing interactMode'
      }
      if (!['COMMENT', 'DISCUSS'].includes(route.interactMode)) {
        return `Invalid interactMode "${route.interactMode}"`
      }
      ++n
      if (route.triggerId) {
        if (!DcsTag.checkTriggerId(route.triggerId)) {
          return `Invalid triggerId "${route.triggerId}"`
        }
        ++n
      }
    case 0:
      if (!route.pageName) {
        return 'Missing pageName'
      }
      const pn = route.pageName.endsWith('*')
        ? route.pageName.slice(0, -1)
        : route.pageName
      if (!DcsTag.checkPageName(pn)) {
        return `Invalid pageName "${route.pageName}"`
      }
      ++n
      break
    default:
      return `Invalid layout "${route.layout}"`
  }

  if (Object.keys(route).length !== n) {
    return `Too many arguments for layout "${route.layout}"`
  }
}

//------------------------------------------------------------------------------
