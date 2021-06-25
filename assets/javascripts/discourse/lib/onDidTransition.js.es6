import { u } from './utils'
import { DcsTag } from './DcsTag'
import User from 'discourse/models/user'

//------------------------------------------------------------------------------

export function onDidTransition({
  container,
  iframe,
  routeName,
  queryParamsOnly
}) {
  //console.log('onDidTransition: ', routeName)
  iframe
    .readyForTransitions()
    .then(() => {
      onDidTransition2({ container, iframe, queryParamsOnly, routeName })
    })
    .catch(e => {
      if (routeName.startsWith('docuss')) {
        // Show the error page
        container.dcsLayout.setLayout(0)
      } else {
        // Show the normal Discourse
        container.dcsLayout.setLayout(1)
      }
      throw e
    })
}

//------------------------------------------------------------------------------

function onDidTransition2({ container, iframe, routeName, queryParamsOnly }) {
  //console.log('onDidTransition2: ', routeName)

  if (routeName.startsWith('topic.')) {
    const route = container.lookup('route:topic')
    const model = route['currentModel']
    // Wait for the "tags" field. The "tags" field is not always there
    // immediately, especially when creating a new topic
    // 15x200 = 3s total.Tried 1,5s before -> not enough.
    const hasTagsProp = () => model.hasOwnProperty('tags')
    u.async.retryDelay(hasTagsProp, 15, 200).then(
      () => {
        onDidTransition3({ container, iframe, routeName, queryParamsOnly })
      },
      () => {
        // Property "tags" not found in topic model'. This happens when topis
        // has no tags. Show the normal Discourse.
        container.dcsLayout.setLayout(1)
      }
    )
  } else {
    onDidTransition3({ container, iframe, routeName, queryParamsOnly })
  }
}

//------------------------------------------------------------------------------

function onDidTransition3({ container, iframe, routeName, queryParamsOnly }) {
  //console.log('onDidTransition3: ', routeName)

  //**** Docuss routes ****
  if (routeName.startsWith('docuss')) {
    const route = container.lookup('route:' + routeName)
    const context = route['context'] || {}
    const dcsRoute = { layout: 0, pageName: context['page'] } // Here pageName can be empty
    const hasRedirected = iframe.didTransition(dcsRoute)
    if (hasRedirected) {
      return
    }
    $('html').removeClass('dcs-tag dcs-topic dcs-comment dcs-discuss')
    container.dcsLayout.setLayout(dcsRoute.layout)
    return
  }

  //**** Tag intersection route ****
  if (routeName === 'tags.intersection') {
    const route = container.lookup('route:tags.intersection')
    const model = route['currentModel']
    if (model['id'] === 'dcs-comment' || model['id'] === 'dcs-discuss') {
      const tag = route.get('additionalTags')[0]
      const parsed = DcsTag.parse(tag)
      if (parsed) {
        const { pageName, triggerId } = parsed
        const isCommentMode = model['id'] === 'dcs-comment'
        const interactMode = isCommentMode ? 'COMMENT' : 'DISCUSS'
        const layout = container.dcsLayout.getShowRightQP() ? 3 : 2
        const dcsRoute = { layout, pageName, triggerId, interactMode }
        const hasRedirected = iframe.didTransition(dcsRoute)
        if (hasRedirected) {
          return
        }
        if (!queryParamsOnly) {
          const modeClass = isCommentMode ? 'dcs-comment' : 'dcs-discuss'
          $('html').removeClass('dcs-tag dcs-topic dcs-comment dcs-discuss')
          $('html').addClass(`dcs-tag ${modeClass}`)
          afterRender().then(() => modifyTagPage(isCommentMode))
        }
        container.dcsLayout.setLayout(layout)
        return
      }
    }
  }

  //**** topic route ****
  if (routeName.startsWith('topic.')) {
    const route = container.lookup('route:topic')
    const model = route['currentModel']
    const tags = model['tags'] || []
    const commentOrDiscuss = tags.find(
      tag => tag === 'dcs-comment' || tag === 'dcs-discuss'
    )
    const dcsTag = tags.find(tag => DcsTag.parse(tag))
    if (commentOrDiscuss && dcsTag) {
      const { pageName, triggerId } = DcsTag.parse(dcsTag)
      const isCommentMode = model['tags'].includes('dcs-comment')
      const interactMode = isCommentMode ? 'COMMENT' : 'DISCUSS'
      const layout = container.dcsLayout.getShowRightQP() ? 3 : 2
      const dcsRoute = { layout, pageName, triggerId, interactMode }
      const hasRedirected = iframe.didTransition(dcsRoute)
      if (hasRedirected) {
        return
      }
      if (!queryParamsOnly) {
        const modeClass = isCommentMode ? 'dcs-comment' : 'dcs-discuss'
        $('html').removeClass('dcs-tag dcs-topic dcs-comment dcs-discuss')
        $('html').addClass(`dcs-topic ${modeClass}`)
        afterRender().then(() => modifyTopicPage(dcsTag, isCommentMode))
      }
      container.dcsLayout.setLayout(layout)
      return
    }
  }

  //**** Other routes ****
  $('html').removeClass('dcs-tag dcs-topic dcs-comment dcs-discuss')
  const layout = 1
  const dcsRoute = { layout, pathname: location.pathname }
  const hasRedirected = iframe.didTransition(dcsRoute)
  if (hasRedirected) {
    return
  }
  container.dcsLayout.setLayout(layout)
}

//------------------------------------------------------------------------------

function modifyTagPage(commentMode) {
  // Add the title
  /*
  $('.navigation-container').prepend(`
    <ul class="nav nav-pills dcs-tag-title">
      <li>
        <a style="pointer-events:none">
          ${commentMode ? 'Comments' : 'Discussions'}          
        </a>
      </li>
    </ul>
  `)
  */

  // Change the "New Topic" button to "New Comment"
  if (commentMode) {
    $('#create-topic > .d-button-label').text('New Comment')
  }

  // Change the "There are no latest topics. Browse all categories or view
  // latest topics" message when there is no topic
  const footer = $('footer.topic-list-bottom')
  if (footer.length) {
    let html = `
      <div style="margin-left:12px">
        <p><i>No ${commentMode ? 'comment' : 'topic'} yet</i></p>
      `
    if (!User.current()) {
      html += `<p>(you need to log in before you can create one)</p>`
    }
    html += `</div>`
    footer.html(html)

    // Hide the notifications button, because it doesn't work on empty tags
    $('.tag-notifications-button').hide()
  }
}

//------------------------------------------------------------------------------

function modifyTopicPage(dcsTag, commentMode) {
  if (commentMode) {
    // Move the topic-map on top
    //$('.topic-map').prependTo('#post_1 .topic-body')
    /*
    // Add the title
    $('#main-outlet').prepend(`
      <h2 id="dcs-comment-title" style="margin-bottom:3rem; margin-left:10px">
        Comments
      </h2>
    `)
    */
  } else {
    // Add the "back" link
    // WARNING: if we already were on a dcs topic page, the "back"
    // link is already there. This happens when using the "Suggested Topics" list
    // at the bottom on a topic (admin mode only, I think)
    if (!$('#dcs-back').length) {
      $('#main-outlet > .ember-view[class*="category-"]').prepend(`
      <div id="dcs-back" class="list-controls">
        <div class="container">
          <a style="line-height:28px" href="/tags/intersection/dcs-discuss/${dcsTag}">
            &#8630; Back to topic list
          </a>
        </div>
      </div>
    `)
    }
  }
}

//------------------------------------------------------------------------------

/*
// CAREFUL: when redirecting a route change (for example within willTransition),
// always use the same method as the original transition, otherwise strange bugs
// occur. For example, if in a transitionTo() you redirect with replaceWith(),
// you erase the previous entry in the browser history !
function redirect(container, transition, ...args) {
  // Don't use transition.router here, it is wrong (or not the right one)
  const router = container.lookup('router:main')
  const fun =
    transition.urlMethod === 'replace'
      ? router.replaceWith
      : router.transitionTo
  return fun.bind(router)(...args)
}
*/
//------------------------------------------------------------------------------

const afterRender = res =>
  new Promise(resolve => {
    Ember.run.schedule('afterRender', null, () => resolve(res))
  })

//------------------------------------------------------------------------------
