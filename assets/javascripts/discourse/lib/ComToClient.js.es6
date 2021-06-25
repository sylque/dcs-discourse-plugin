// @ts-nocheck
//import * as types from '../../dcs-client/src/com-types'
import { Bellhop } from './bellhop'
//import { u } from './utils'
//import { Bellhop } from '../../Bellhop/src/Bellhop'

const log = (fnName, params) => {
  //u.log('ComToClient:' + fnName, params)
}

/**
 * @interface
 */
class ComToClientClass {
  //----------------------------------------------------------------------------

  constructor() {
    this._bellhop = new Bellhop()
    this._timer = null
    this._onConnected = null

    // This is called avery time the iframe reloads
    this._bellhop.on('connected', () => {
      if (this._timer) {
        clearTimeout(this._timer)
        this._timer = null
      }
      this._onConnected && this._onConnected()
    })
  }

  //----------------------------------------------------------------------------

  /**
   * @param {Object} arg
   * @param {Element} arg.iframeElement
   * @param {string} arg.iframeOrigin
   * @param {OnConnectedCallback} [arg.onConnected]
   * @param {number} [arg.timeout]
   * @param {OnTimeoutCallback} [arg.onTimeout]
   */
  connect({ iframeElement, iframeOrigin, onConnected, timeout, onTimeout }) {
    this.disconnect()
    this._onConnected = onConnected
    this._timer = timeout
      ? setTimeout(() => {
        onTimeout && onTimeout()
      }, timeout)
      : null
    this._bellhop.connect(iframeElement, iframeOrigin)
  }

  disconnect() {
    if (this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }
    this._bellhop.disconnect()
  }

  isConnected() {
    return this._bellhop.connected
  }

  //----------------------------------------------------------------------------

  /**
   * @param {RoutePushedParams}
   * BEWARE: descr should be the original serialized descr
   */
  postDiscourseRoutePushed({ route, descr, counts, clientContext, origin }) {
    const data = {
      ['route']: serializeRoute(route),
      ['descr']: descr,
      ['counts']: counts,
      ['clientContext']: clientContext,
      ['origin']: origin
    }
    log('postDiscourseRoutePushed', data)
    this._bellhop.send('m2', data)
  }

  /**
   * @param {Counts}
   */
  postCountsChanged({ counts }) {
    const data = { ['counts']: counts }
    log('postCountsChanged', data)
    this._bellhop.send('m3', data)
  }

  //----------------------------------------------------------------------------

  /**
   * @callback OnSetDiscourseRouteCallback
   * @param {SetRouteParams}
   */
  /**
   *  @param {OnSetDiscourseRouteCallback} cb
   */
  onSetDiscourseRoute(cb) {
    this._bellhop.on('m4', e => {
      log('onSetDiscourseRoute', e.data)
      const data = {
        route: deserializeRoute(e.data['route']),
        mode: e.data['mode'],
        clientContext: e.data['clientContext']
      }
      cb(data)
    })
  }

  /**
   * @callback onSetRoutePropsCallback
   * @param {RouteProps}
   */
  /**
   *  @param {onSetRoutePropsCallback} cb
   */
  onSetRouteProps(cb) {
    this._bellhop.on('m6', e => {
      log('onSetRouteProps', e.data)
      const data = {
        category: e.data['category'],
        discourseTitle: e.data['discourseTitle'],
        error: e.data['error']
      }
      cb(data)
    })
  }

  /**
   * @callback onSetRedirectsCallback
   * @param {[Redirects]}
   */
  /**
   *  @param {onSetRedirectsCallback} cb
   */
  onSetRedirects(cb) {
    this._bellhop.on('m7', e => {
      log('onSetRedirects', e.data)
      const data = e.data.map(redirect => ({
        src: deserializeRoute(redirect['src']),
        dest: deserializeRoute(redirect['dest'])
      }))
      cb(data)
    })
  }

  /**
   * @callback onCreateDiscussTagsCallback
   * @param {CreateTagsParams}
   */
  /**
   *  @param {onCreateDiscussTagsCallback} cb
   */
  onCreateDcsTags(cb) {
    this._bellhop.on('m8', e => {
      log('onCreateDcsTags', e.data)
      const data = {
        pageName: e.data['pageName'],
        triggerIds: e.data['triggerIds'],
        notificationLevel: e.data['notificationLevel']
      }
      cb(data)
    })
  }

  /**
   * @callback onCreateTopicCallback
   * @param {CreateTopicParams}
   */
  /**
   *  @param {onCreateTopicCallback} cb
   */
  onCreateTopic(cb) {
    this._bellhop.on('m9', e => {
      log('onCreateTopic', e.data)
      const data = {
        title: e.data['title'],
        body: e.data['body'],
        category: e.data['category'],
        pageName: e.data['pageName'],
        triggerId: e.data['triggerId'],
        tagNotificationLevel: e.data['tagNotificationLevel']
      }
      cb(data)
    })
  }

  //----------------------------------------------------------------------------
}

export const ComToClient = new ComToClientClass()

function serializeRoute(route) {
  return {
    ['layout']: route.layout,
    ['pageName']: route.pageName,
    ['hash']: route.hash,
    ['interactMode']: route.interactMode,
    ['triggerId']: route.triggerId,
    ['pathname']: route.pathname
  }
}

function deserializeRoute(route) {
  const res = {}
  if ('layout' in route) {
    res.layout = route['layout']
  }
  if ('pageName' in route) {
    res.pageName = route['pageName']
  }
  if ('hash' in route) {
    res.hash = route['hash']
  }
  if ('interactMode' in route) {
    res.interactMode = route['interactMode']
  }
  if ('triggerId' in route) {
    res.triggerId = route['triggerId']
  }
  if ('pathname' in route) {
    res.pathname = route['pathname']
  }
  return res
}
