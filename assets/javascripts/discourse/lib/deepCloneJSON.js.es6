export function deepCloneJSON(val) {
  const res = {}
  if ('$schema' in val) {
    res.$schema = val['$schema']
  }
  if ('websiteName' in val) {
    res.websiteName = val['websiteName']
  }
  if ('logo' in val) {
    res.logo = {}
    if ('logoUrl' in val['logo']) {
      res.logo.logoUrl = val['logo']['logoUrl']
    }
    if ('mobileLogoUrl' in val['logo']) {
      res.logo.mobileLogoUrl = val['logo']['mobileLogoUrl']
    }
    if ('smallLogoUrl' in val['logo']) {
      res.logo.smallLogoUrl = val['logo']['smallLogoUrl']
    }
  }
  if ('dcsTag' in val) {
    res.dcsTag = {}
    if ('maxPageNameLength' in val['dcsTag']) {
      res.dcsTag.maxPageNameLength = val['dcsTag']['maxPageNameLength']
    }
    if ('maxTriggerIdLength' in val['dcsTag']) {
      res.dcsTag.maxTriggerIdLength = val['dcsTag']['maxTriggerIdLength']
    }
    if ('forceLowercase' in val['dcsTag']) {
      res.dcsTag.forceLowercase = val['dcsTag']['forceLowercase']
    }
  }
  if ('pages' in val) {
    res.pages = val['pages'].map(val => {
      const res = {}
      if ('name' in val) {
        res.name = val['name']
      }
      if ('url' in val) {
        res.url = val['url']
      }
      if ('needsProxy' in val) {
        res.needsProxy = val['needsProxy']
      }
      return res
    })
  }
  if ('webApp' in val) {
    res.webApp = {}
    if ('otherPagesPrefix' in val['webApp']) {
      res.webApp.otherPagesPrefix = val['webApp']['otherPagesPrefix']
    }
  }
  if ('redirects' in val) {
    res.redirects = val['redirects'].map(val => {
      const res = {}
      if ('src' in val) {
        res.src = {}
        if ('pageName' in val['src']) {
          res.src.pageName = val['src']['pageName']
        }
        if ('layout' in val['src']) {
          res.src.layout = val['src']['layout']
        }
        if ('interactMode' in val['src']) {
          res.src.interactMode = val['src']['interactMode']
        }
        if ('triggerId' in val['src']) {
          res.src.triggerId = val['src']['triggerId']
        }
        if ('pathname' in val['src']) {
          res.src.pathname = val['src']['pathname']
        }
      }
      if ('dest' in val) {
        res.dest = {}
        if ('pageName' in val['dest']) {
          res.dest.pageName = val['dest']['pageName']
        }
        if ('layout' in val['dest']) {
          res.dest.layout = val['dest']['layout']
        }
        if ('interactMode' in val['dest']) {
          res.dest.interactMode = val['dest']['interactMode']
        }
        if ('triggerId' in val['dest']) {
          res.dest.triggerId = val['dest']['triggerId']
        }
        if ('pathname' in val['dest']) {
          res.dest.pathname = val['dest']['pathname']
        }
      }
      return res
    })
  }
  if ('clientData' in val) {
    res.clientData = {}
    if ('decorator' in val['clientData']) {
      res.clientData.decorator = {}
      if ('category' in val['clientData']['decorator']) {
        res.clientData.decorator.category = val['clientData']['decorator']['category']
      }
      if ('discourseTitle' in val['clientData']['decorator']) {
        res.clientData.decorator.discourseTitle = val['clientData']['decorator']['discourseTitle']
      }
      if ('pageProperties' in val['clientData']['decorator']) {
        res.clientData.decorator.pageProperties = val['clientData']['decorator']['pageProperties'].map(val => {
          const res = {}
          if ('pageNames' in val) {
            res.pageNames = val['pageNames'].slice(0)
          }
          if ('category' in val) {
            res.category = val['category']
          }
          if ('discourseTitle' in val) {
            res.discourseTitle = val['discourseTitle']
          }
          return res
        })
      }
      if ('injectCss' in val['clientData']['decorator']) {
        res.clientData.decorator.injectCss = val['clientData']['decorator']['injectCss'].map(val => {
          const res = {}
          if ('pageNames' in val) {
            res.pageNames = val['pageNames'].slice(0)
          }
          if ('css' in val) {
            res.css = val['css'].slice(0)
          }
          return res
        })
      }
      if ('injectTriggers' in val['clientData']['decorator']) {
        res.clientData.decorator.injectTriggers = val['clientData']['decorator']['injectTriggers'].map(val => {
          const res = {}
          if ('pageNames' in val) {
            res.pageNames = val['pageNames'].slice(0)
          }
          if ('ids' in val) {
            res.ids = val['ids'].slice(0)
          }
          if ('interactMode' in val) {
            res.interactMode = val['interactMode']
          }
          if ('ui' in val) {
            res.ui = {}
            if ('cssSelector' in val['ui']) {
              res.ui.cssSelector = val['ui']['cssSelector']
            }
            if ('highlightable' in val['ui']) {
              res.ui.highlightable = val['ui']['highlightable']
            }
            if ('insertTextSpan' in val['ui']) {
              res.ui.insertTextSpan = val['ui']['insertTextSpan']
            }
            if ('insertBalloon' in val['ui']) {
              res.ui.insertBalloon = val['ui']['insertBalloon']
            }
            if ('insertCountBadge' in val['ui']) {
              res.ui.insertCountBadge = val['ui']['insertCountBadge']
            }
            if ('subsection' in val['ui']) {
              res.ui.subsection = {}
              if ('begin' in val['ui']['subsection']) {
                res.ui.subsection.begin = val['ui']['subsection']['begin']
              }
              if ('end' in val['ui']['subsection']) {
                res.ui.subsection.end = val['ui']['subsection']['end']
              }
            }
          }
          if ('category' in val) {
            res.category = val['category']
          }
          if ('discourseTitle' in val) {
            res.discourseTitle = val['discourseTitle']
          }
          return res
        })
      }
    }
  }
  return res
}
