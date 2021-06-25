//import ApplicationRoute from 'discourse/routes/application'
//import TagsShowRoute from 'discourse/routes/tags-show'
//import DiscourseURL from 'discourse/lib/url'
import ComposerController from 'discourse/controllers/composer'
import Composer from 'discourse/models/composer'
//import TopicNavigation from 'discourse/components/topic-navigation'
import SiteHeaderComponent from 'discourse/components/site-header'
import { setDefaultHomepage } from 'discourse/lib/utilities'
import { withPluginApi } from 'discourse/lib/plugin-api'

import { onAfterRender } from '../lib/onAfterRender'
import { onDidTransition } from '../lib/onDidTransition'
import { DcsTag } from '../lib/DcsTag'
import { DcsIFrame } from '../lib/DcsIFrame'
import { discourseAPI } from '../lib/discourseAPI'
//import { simplifyTopicStates } from '../lib/simplifyTopicStates.js'

export default {
  name: 'docuss',
  initialize(container, app) {
    //----------------------------------------------------------------------------

    // If plugin is disabled, quit
    if (!Discourse.application.SiteSettings['docuss_enabled']) {
      return
    }

    //----------------------------------------------------------------------------

    // Disable the header title replacement when scrolling down a topic
    // https://github.com/discourse/discourse/blob/162413862c7561207964a685b9ab2ff392cb8582/app/assets/javascripts/discourse/components/site-header.js.es6#L45
    SiteHeaderComponent.reopen({
      ['setTopic'](topic) {
        // Do nothing
      }
    })

    //----------------------------------------------------------------------------

    // Set 'docuss' at the home route, i.e. the route when you land when loading
    // Discourse with the './' path
    // https://github.com/discourse/discourse/blob/master/app/assets/javascripts/discourse/lib/utilities.js.es6#L502
    setDefaultHomepage('docuss')

    //----------------------------------------------------------------------------

    // Wait until the page is rendered, then modify some stuff in the page
    // DO THIS FIRST, SO ANYONE TRIGGERING AN ERROR FROM HERE CAN DISPLAY THE
    // ERROR IN THE IFRAME (wa want to be the first afterRender(), so that
    // subsequent afterRender() can find an existing iframe)
    afterRender().then(() => onAfterRender(container))

    //----------------------------------------------------------------------------

    // Load the embedded website descriptor, then create the IFrame object
    const dcsIFrame = new DcsIFrame(app, container)

    //----------------------------------------------------------------------------

    // Add the 'r' query param. This query param is used only with routes
    // 'tags.intersection' and 'topic.*'
    // Starting on updated Discourse dev (10/01/2018),
    // use container.lookup('controller:application') instead of
    //ApplicationController, or it doesn't work
    container.lookup('controller:application').reopen({
      queryParams: { ['showRight']: 'r' },
      ['showRight']: true
    })

    //----------------------------------------------------------------------------

    const reg = container.lookup('-view-registry:main')
    container.dcsHeaderLogo = {
      _logoUrl: null,
      _mobileLogoUrl: null,
      _smallLogoUrl: null,
      _href: null,
      setLogo(logos) {
        // Store new values
        container.dcsHeaderLogo._logoUrl = logos && logos.logoUrl
        container.dcsHeaderLogo._mobileLogoUrl = logos && logos.mobileLogoUrl
        container.dcsHeaderLogo._smallLogoUrl = logos && logos.smallLogoUrl
        container.dcsHeaderLogo._href = logos && logos.href

        // Rerender the header. See:
        // https://github.com/AltSchool/ember-get-component
        // https://github.com/discourse/discourse/blob/b58867b6e936a5247304e9f06f827cf5012a92ed/app/assets/javascripts/discourse/components/mount-widget.js.es6#L90
        const viewId = $('.d-header').closest('.ember-view').attr('id')
        const component = reg[viewId]
        component['queueRerender']()
      }
    }

    //----------------------------------------------------------------------------

    let lastUrl = ''
    let shrinkComposer = true
    withPluginApi('0.8.30', api => {
      // Manage the logo
      api.reopenWidget('home-logo', {
        ['logoUrl']() {
          return container.dcsHeaderLogo._logoUrl || this._super()
        },
        ['mobileLogoUrl']() {
          return container.dcsHeaderLogo._mobileLogoUrl || this._super()
        },
        ['smallLogoUrl']() {
          return container.dcsHeaderLogo._smallLogoUrl || this._super()
        },
        ['href']() {
          return container.dcsHeaderLogo._href || this._super()
        }
      })

      // Page changed event
      api.onAppEvent(
        'page:changed',
        ({
          ['currentRouteName']: currentRouteName,
          ['title']: title,
          ['url']: url
        }) => {
          // Yes, this happens, at least in dev mode
          if (url === lastUrl) {
            return
          }

          // See if only query params have changed
          const queryParamsOnly = url.split('?')[0] === lastUrl.split('?')[0]
          lastUrl = url

          // Log route change
          /*
        u.log(
          `Discourse page changed to "${currentRouteName}"${
            queryParamsOnly ? ' (only queryParams)' : ''
          }`
        )
        */

          // Handle the transition
          onDidTransition({
            container,
            iframe: dcsIFrame,
            routeName: currentRouteName,
            queryParamsOnly
          })

          // Collapse the composer, because after changing route, the current draft
          // might not relate to the current balloon anymore. See below for
          // the part where we change the route back to the appropriate tag when
          // reopening the composer.
          if (shrinkComposer) {
            // @ts-ignore
            container.lookup('controller:composer').shrink()
          }
          shrinkComposer = true
        }
      )
    })

    //----------------------------------------------------------------------------

    ComposerController.reopen({
      composeStateChanged: Ember.observer('model.composeState', function() {
        // We are going to do something when the composer opens
        const state = this.get('model.composeState')
        if (state !== Composer.OPEN) {
          return
        }

        // Cases that are interesting for us:
        // - When the composer opens as "New Topic" on a Docuss tag, in which
        // case model.tags will contain 2 dcs tags
        // - When the composer opens as "New Reply" on a Docuss topic, in which
        // case model.topic.tags will contain 2 dcs tags
        const model = this.get('model')
        const tags = model['tags'] || (model['topic'] && model['topic']['tags'])
        const dcsTag = tags && tags.find(t => DcsTag.parse(t))
        if (!dcsTag) {
          return
        }

        // When opening (sliding up) the composer with a dcsTag, redirect to the
        // appropriate route
        let path
        const topic = model['topic']
        if (topic) {
          path = `/t/${topic['slug']}/${topic['id']}?r=true`
        } else {
          const isCommentMode = tags.includes('dcs-comment')
          const modeTag = isCommentMode ? 'dcs-comment' : 'dcs-discuss'
          path = `/tags/intersection/${modeTag}/${dcsTag}?r=true`
        }
        shrinkComposer = false
        container.lookup('router:main').transitionTo(path)
      }),

      tagsChanged: Ember.observer('model.tags', function() {
        // See if it is a balloon tag
        const model = this.get('model')
        const tags = model && model['tags']
        const dcsTag = tags && tags.find(tag => DcsTag.parse(tag))
        if (!dcsTag) {
          return
        }

        // If we are in comment mode, fill the title with a generic one. This
        // title will be hidden from the user (see the CSS)
        const isCommentMode = tags.includes('dcs-comment')
        if (isCommentMode) {
          model['setProperties']({
            ['title']: discourseAPI.commentTopicTitle(dcsTag)
          })
          // In composer buttons: "+ Create Topic" => "+ Add Comment"
          setTimeout(() => {
            $('#reply-control .save-or-cancel .d-button-label').text(
              'Add Comment'
            )
          }, 0)
        }
      })
    })

    //----------------------------------------------------------------------------
  }
}

const afterRender = res =>
  new Promise(resolve => {
    // @ts-ignore
    Ember.run.schedule('afterRender', null, () => resolve(res))
  })
