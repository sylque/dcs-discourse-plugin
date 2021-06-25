import { u } from './utils'

// A docuss tag is of the form: dcs-PAGENAME-CLIENTROUTE-TRIGGERID

// DON'T USE 'THIS' IN OBJECT LITERALS:
// http://closuretools.blogspot.com/2012/09/which-compilation-level-is-right-for-me.html

export const DcsTag = {
  _PREFIX: 'dcs',
  _TAG_PART_REGEX: /^[0-9A-Za-z_]+$/,
  _settings: null,

  /**
   *  @param {*} settings
   *  @param {Number} settings.maxPageNameLength
   *  @param {Number} settings.maxTriggerIdLength
   *  @param {boolean} settings.forceLowercase
   */
  init(settings) {
    // Check
    u.dev.assert(
      typeof settings.maxPageNameLength === 'number' &&
        settings.maxPageNameLength >= 1
    )
    u.dev.assert(
      typeof settings.maxTriggerIdLength === 'number' &&
        settings.maxTriggerIdLength >= 1
    )
    u.dev.assert(typeof settings.forceLowercase === 'boolean')
    DcsTag._settings = settings
  },

  initialized() {
    return !!DcsTag._settings
  },

  _checkInit() {
    u.dev.assert(DcsTag._settings, 'DcsTag not initialized')
  },

  getSettings() {
    DcsTag._checkInit()
    return DcsTag._settings
  },

  build({ pageName, triggerId }) {
    DcsTag.checkPageNameThrow(pageName)
    triggerId && DcsTag.checkTriggerIdThrow(triggerId)
    return triggerId
      ? `${DcsTag._PREFIX}-${pageName}-${triggerId}`
      : `${DcsTag._PREFIX}-${pageName}`
  },

  parse(dcsTag) {
    DcsTag._checkInit()

    if (dcsTag === 'dcs-comment' || dcsTag === 'dcs-discuss') {
      return null
    }

    const split = dcsTag.split('-')

    if (split.shift() !== DcsTag._PREFIX) {
      return null
    }

    const pageName = split.shift()
    if (!DcsTag.checkPageName(pageName)) {
      // u.throw(`Invalid dcsTag "${dcsTag}": invalid part page name`)
      return null
    }

    const triggerId = split.shift()
    if (triggerId && !DcsTag.checkTriggerId(triggerId)) {
      //u.throw(`Invalid dcsTag "${dcsTag}": invalid part triggerId`)
      return null
    }

    return { pageName, triggerId }
  },

  maxTagLength() {
    DcsTag._checkInit()
    return (
      DcsTag._PREFIX.length +
      DcsTag._settings.maxPageNameLength +
      DcsTag._settings.maxTriggerIdLength +
      2
    )
  },

  checkPageName(pageName) {
    return DcsTag._checkPart(pageName, DcsTag._settings.maxPageNameLength)
  },

  checkPageNamePrefix(pageNamePrefix) {
    const maxPrefixLength = DcsTag._settings.maxPageNameLength - 1
    return DcsTag._checkPart(pageNamePrefix, maxPrefixLength)
  },

  checkPageNameThrow(pageName) {
    if (!DcsTag.checkPageName(pageName)) {
      u.throw(`Invalid pageName "${pageName}"`)
    }
  },

  checkTriggerId(triggerId) {
    return DcsTag._checkPart(triggerId, DcsTag._settings.maxTriggerIdLength)
  },

  checkTriggerIdThrow(triggerId) {
    if (!DcsTag.checkTriggerId(triggerId)) {
      u.throw(`Invalid triggerId "${triggerId}"`)
    }
  },

  _checkPart(part, maxLength) {
    DcsTag._checkInit()
    return (
      part &&
      part.length <= maxLength &&
      part.match(DcsTag._TAG_PART_REGEX) &&
      (!DcsTag._settings.forceLowercase || part === part.toLowerCase())
    )
  }
}
