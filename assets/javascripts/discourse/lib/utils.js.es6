//------------------------------------------------------------------------------

export const u = {}

//------------------------------------------------------------------------------

u.windowName = () => {
  let res = 'Docuss'
  if (typeof window !== 'undefined') {
    res = window.name.trim() || document.title.trim() || res
  } else {
    // https://stackoverflow.com/a/26614875/3567351
    res = require(__dirname + '/package.json').name || res
  }
  return res.substring(0, 12)
}

u.log = (...args) => {
  args = [`%c${u.windowName()} -`, 'color:grey', ...args]
  console.log(...args)
}

u.logError = (...args) => {
  args = [
    `%c${u.windowName()} %c- Docuss Error -`,
    'color:grey',
    'color:red',
    ...args
  ]
  console.log(...args)
}

u.logWarning = (...args) => {
  args = [
    `%c${u.windowName()} %c- Docuss Warning -`,
    'color:grey',
    'color:orange',
    ...args
  ]
  console.log(...args)
}

class DocussError extends Error {
  constructor(msg) {
    super(msg)
    this.name = 'DocussError'
  }
}

u.throw = msg => {
  throw new DocussError(msg)
}

u.throwIf = (cond, msg) => cond && u.throw(msg)
u.throwIfNot = (cond, msg) => !cond && u.throw(msg)

// Functions from the "dev" field might be striped out of production code
u.dev = {
  assert: (cond, msg) =>
    u.throwIf(!cond, `Assertion Failed${msg ? ' - ' + msg : ''}`),
  log: u.log,
  logWarning: u.logWarning,
  logError: u.logError
}

// Return true if we are in an iframe
// https://stackoverflow.com/a/326076/3567351
u.inIFrame = () => {
  try {
    return window.self !== window.top
  } catch (e) {
    return true
  }
}

//------------------------------------------------------------------------------

/*
// https://stackoverflow.com/a/41532415/3567351
// https://stackoverflow.com/questions/6393943/convert-javascript-string-in-dot-notation-into-an-object-reference/6394168#6394168

u.get = function(obj, fieldNameDotNotation) {
  return fieldNameDotNotation.split('.').reduce((o, i) => o[i], obj)
}
*/

/*
u.pick = (o, keys) =>
  o
    ? keys.reduce((res, key) => {
        if (o.hasOwnProperty(key)) {
          res[key] = o[key]
        }
        return res
      }, {})
    : o

u.omit = (o, keys) =>
  o
    ? Object.keys(o).reduce((res, key) => {
        if (!keys.includes(key)) {
          res[key] = o[key]
        }
        return res
      }, {})
    : o
*/

//------------------------------------------------------------------------------
/*
// https://stackoverflow.com/a/265125/3567351
// https://stackoverflow.com/a/26127647/3567351
const c = document.cookie
console.log('c: ', c)
const loadedFromBrowserCache = c.includes('loadedFromBrowserCache=false')
  ? false
  : c.includes('loadedFromBrowserCache=true') ? true : undefined
document.cookie = 'loadedFromBrowserCache=true'

// Return true if the current page has been loaded from the browser cache
u.loadedFromBrowserCache = () => {
  u.throwIf(
    loadedFromBrowserCache === undefined,
    'Missing cookie "loadedFromBrowserCache". Check your server.'
  )
  return loadedFromBrowserCache
}
*/
//------------------------------------------------------------------------------

/*
// https://stackoverflow.com/a/31991870/3567351
// Notice that the npm packages is-absolute-url and is-relative-url fail for
// url of type //google.com/blablabla
const absoluteUrlRegex = /(?:^[a-z][a-z0-9+.-]*:|\/\/)/i
dcsQuery.isAbsoluteUrl = url => absoluteUrlRegex.test(url)
*/
//------------------------------------------------------------------------------

/*
// https://stackoverflow.com/a/4314050
u.spliceStr = (str, start, delCount, insertStr) =>
  str.slice(0, start) + insertStr + str.slice(start + Math.abs(delCount))
*/

u.async = {
  // SEE https://stackoverflow.com/a/46295049/286685
  forEach(arr, fn, busy, err, i = 0) {
    const body = (ok, er) => {
      try {
        const r = fn(arr[i], i, arr)
        r && r.then ? r.then(ok).catch(er) : ok(r)
      } catch (e) {
        er(e)
      }
    }
    const next = (ok, er) => () => u.async.forEach(arr, fn, ok, er, ++i)
    const run = (ok, er) =>
      i < arr.length ? new Promise(body).then(next(ok, er)).catch(er) : ok()
    return busy ? run(busy, err) : new Promise(run)
  },

  // Create a promise with 2 additional functions (resolve and reject) and one
  // addition (state)
  // createfun: optional, the usual promise creation function -> (resolve, reject) => { ... }
  createPromise(createfun) {
    // Create the promise
    let originalResolve, originalReject
    const promise = new Promise((resolve, reject) => {
      originalResolve = resolve
      originalReject = reject
    })

    // Enriched the promise
    promise.state = 'pending'
    promise.resolve = value => {
      originalResolve(value)
      if (promise.state === 'pending') {
        promise.state = 'resolved'
      }
    }
    promise.reject = value => {
      originalReject(value)
      if (promise.state === 'pending') {
        promise.state = 'rejected'
      }
    }

    // Call the original creation function (if any)
    createfun && createfun(promise.resolve, promise.reject)

    return promise
  },

  // Use like this:
  // u.async.promiseState(a).then(state => console.log(state)); // Output: fulfilled | rejected | pending
  // https://stackoverflow.com/a/35820220/3567351
  promiseState(p) {
    const t = {}
    return Promise.race([p, t]).then(
      v => (v === t ? 'pending' : 'fulfilled'),
      () => 'rejected'
    )
  },

  // Call like this: delay(1000).then(() => { do_something })
  delay: (ms, returnValue) =>
    new Promise(resolve => {
      setTimeout(() => {
        resolve(returnValue)
      }, ms)
    }),

  // Retry calling fn until:
  // - it returns a truthy value (or a Promise resolving to truthy)
  // - retries is reached, in which case the function return a rejected promise
  retry: (fn, retries, res = undefined) =>
    retries === 0
      ? Promise.reject(res)
      : Promise.resolve(fn(res, retries)).then(
          res => res || u.async.retry(fn, retries - 1, res)
        ),

  // Call like this: retryDelay(fn, 5, 1000).then(() => { do_something }), fn
  // being a function that might returns a promise
  retryDelay(fn, retries, ms, err = undefined) {
    const fnDelayed = retries => u.async.delay(ms).then(() => fn(retries))
    try {
      return retries === 0
        ? Promise.reject(err)
        : Promise.resolve(fn(retries)).then(
            res => res || u.async.retryDelay(fnDelayed, retries - 1)
          )
    } catch (e) {
      return Promise.reject(e)
    }
  },

  // Resolve to undefined if not found (never reject)
  // A bit complex because we support finding in an array of promises
  find: (array, fn) =>
    !array || array.length === 0
      ? Promise.resolve(undefined)
      : Promise.resolve(fn(array[0])).then(res =>
          res ? array[0] : u.async.find(array.slice(1), fn)
        )
}

u.dom = {
  // Resolve when DOM is ready
  onDOMReady() {
    return new Promise(resolve => {
      if (document.readyState !== 'loading') {
        resolve()
      } else {
        document.addEventListener('DOMContentLoaded', resolve)
      }
    })
  },

  // https://github.com/imagitama/nodelist-foreach-polyfill/blob/master/index.js
  forEach(nodeList, callback, scope) {
    // Duplicate the list, so that we can iterate over a dynamic node list
    // returned by getElementsByClassName() and the likes. If we don't, the
    // following won't work, as we change the list dynamically while we iterate
    // over it:
    // u.dom.forEach(document.getElementsByClassName('toto'), node => node.classList.remove('toto'))
    const list = [...nodeList]
    for (let i = 0; i < list.length; i++) {
      callback.call(scope || window, list[i], i)
    }
  },

  wrap(el, wrapper) {
    el.parentNode.insertBefore(wrapper, el)
    wrapper.appendChild(el)
    return wrapper
  },

  wrapAll(elArray, wrapper) {
    if (elArray && elArray.length) {
      // Duplicate the array in case it is a DOM nodeList than would be modified
      // while we move elements
      const copyArray = Array.prototype.slice.call(elArray)
      copyArray[0].parentNode.insertBefore(wrapper, copyArray[0])
      copyArray.forEach(el => wrapper.appendChild(el))
    }
    return wrapper
  },

  createElement(htmlString) {
    const div = document.createElement('div')
    div.innerHTML = htmlString.trim()
    return div.firstChild
  }
}

u.dot = {
  set(obj, name, value) {
    const split = name.split('.')
    u.throwIf(!split.length)
    const lastName = split.pop()
    const o = split.reduce((o, n) => (o[n] = {}), obj)
    o[lastName] = value
  },
  get(obj, name) {
    return name
      .split('.')
      .reduce((o, n) => (o !== undefined ? o[n] : undefined), obj)
  }
}
