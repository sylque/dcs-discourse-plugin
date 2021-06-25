//import { u } from './utils'
import { DcsLayout } from './DcsLayout'
import User from 'discourse/models/user'

//------------------------------------------------------------------------------

export function onAfterRender(container) {
  const appCtrl = container.lookup('controller:application')

  // Add classes to the <html> tag
  let classes = 'dcs2'
  //classes += userIsAdmin ? ' dcs-admin' : ' dcs-not-admin'
  if (appCtrl.siteSettings['docuss_hide_sugg_topics']) {
    classes += ' dcs-disable-sugg'
  }
  if (appCtrl.siteSettings['docuss_hide_categories']) {
    classes += ' dcs-disable-cats'
  }
  if (appCtrl.siteSettings['docuss_hide_hamburger_menu']) {
    classes += ' dcs-no-ham-menu'
  }
  if (appCtrl.siteSettings['docuss_hide_tags']) {
    classes += ' dcs-hide-tags'
  }

  $('html').addClass(classes)

  $('body').prepend(`
    <div id="dcs-ghost">
      <div class="dcs-ghost-splitbar"></div>
    </div>
    <div id="dcs-container">
      <div id="dcs-ios-wrapper">
        <div id="dcs-left">
        </div>
      </div>
      <div id="dcs-splitbar">
        <div style="flex:1 0 0"></div>
        <div id="dcs-splitbar-text">&gt;</div>
        <div style="flex:1 0 0"></div>
      </div>
    </div>
  `)

  $('#main-outlet').wrap('<div id="dcs-right"></div>')

  // Prevent scrolling of the Discourse page (right) when scrolling in iframe
  // reaches top / bottom.
  // Notice that the "scroll" events fires *after* scrolling has been done.
  // DRAWBACK:
  // - makes the right page to "vibrate",
  // - doesn't work if the scrolls with his keyboard (up, down, page up, page
  // down) while the iframe has the focus but the mouse cursor is over the right
  // panel.
  // For reference, although those solutions don't work:
  // https://stackoverflow.com/questions/32165246/prevent-parent-page-from-scrolling-when-mouse-is-over-embedded-iframe-in-firefox
  // https://stackoverflow.com/questions/5802467/prevent-scrolling-of-parent-element-when-inner-element-scroll-position-reaches-t
  // An idea I did not investigate: within the iframe, in the dcs-client code,
  // catch [wheel, keydown, touchmove] events and, if position is past
  // top / bottom, cancel the scroll.This should prevent bubbling to the parent
  // window.
  /* DOESN'T WORK ON MOBILE !!!!!!!!!!!!!!!!!
  With touch screens, it seems $('#dcs-container:hover').length is always truly.
  if (!appCtrl.site.mobileView) {
    const scrollMem = { left: 0, top: 0 }
    window.addEventListener('scroll', function(e) {
      // If mouse is over #dcs-container...
      if ($('#dcs-container:hover').length) {
        window.scrollTo(scrollMem.left, scrollMem.top)
      } else {
        scrollMem.left = window.scrollX
        scrollMem.top = window.scrollY
      }
    })
  }
  */

  container.dcsLayout = new DcsLayout(appCtrl)

  // Set the click handler for the split bar
  const router = container.lookup('router:main')
  $('#dcs-splitbar').click(() => {
    const showRight = !container.dcsLayout.getShowRightQP()
    router.transitionTo({ queryParams: { ['showRight']: showRight } })
  })

  // Set the "a" hotkey for debug display
  // https://stackoverflow.com/a/2879095/3567351
  const user = User.current()
  const userIsAdmin = user && user['admin']
  if (userIsAdmin) {
    $(document).keydown(function(e) {
      // Alt+a
      if (e['keyCode'] === 65 && e['altKey']) {
        $('html').toggleClass('dcs-debug')
      }
      // Alt+b
      if (e['keyCode'] === 66 && e['altKey']) {
        container.dcsLayout.setLayout(1)
      }
    })
  }
}
