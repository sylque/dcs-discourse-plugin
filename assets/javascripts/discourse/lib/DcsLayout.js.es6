import { u } from './utils'

export class DcsLayout {
  constructor(appCtrl) {
    this.appCtrl = appCtrl
    this.saveMobileView = appCtrl.site.mobileView
    this.left = document.getElementById('dcs-left')
    //this.right = document.getElementById('dcs-right')
    this.ghost = document.getElementById('dcs-ghost')
    this.prevLayout = null
  }

  getShowRightQP() {
    return this.appCtrl.get('showRight')
  }

  replaceLeftWithDiv(html) {
    $(this.left).replaceWith(`    
      <div id="dcs-left" style="${this.left.style.cssText}">
        <div style="padding:20px">
          ${html}
        </div>
      </div>
    `)
    this.left = document.getElementById('dcs-left')
  }

  replaceLeftWithIFrame(src) {
    const additionalAttr = this.appCtrl.siteSettings['docuss_iframe_attributes']

    $(this.left).replaceWith(`
      <iframe id="dcs-left" frameborder="0" style="${this.left.style.cssText}" 
          src="${src}" ${additionalAttr}>
      </iframe>
    `)
    this.left = document.getElementById('dcs-left')
  }

  _animateGhost(leftStart, leftEnd, onFinish) {
    if (this.ghost.animate) {
      // Case the browser supports the Web Animation API
      const anim = this.ghost.animate(
        [{ left: leftStart }, { left: leftEnd }],
        { duration: 200 }
      )
      if (onFinish) {
        anim.onfinish = onFinish
      }
    } else {
      onFinish && onFinish()
    }
  }

  _animateGhostRL(onFinish) {
    const end = isWideScreen() ? '50%' : '0%'
    this._animateGhost('100%', end, onFinish)
  }

  _animateGhostLR() {
    const start = isWideScreen() ? '50%' : '0%'
    this._animateGhost(start, '100%')
  }

  setLayout(layout) {
    //afterRender().then(() => {
    switch (this.prevLayout) {
      case null:
        switch (layout) {
          case 0:
            // Startup => FULL_CLIENT
            $('html').attr('dcs-layout', layout)
            break
          case 1:
            // Startup => FULL_DISCOURSE
            $('html').attr('dcs-layout', layout)
            break
          case 2:
            // Startup => WITH_SPLIT_BAR
            $('html').attr('dcs-layout', layout)
            break
          case 3:
            // Startup => WITH_SPLIT_BAR
            $('html').attr('dcs-layout', layout)
            break
        }
        break

      case 0:
        switch (layout) {
          case 0:
            // FULL_CLIENT => FULL_CLIENT
            break
          case 1:
            // FULL_CLIENT => FULL_DISCOURSE
            $('html').attr('dcs-layout', layout)
            break
          case 2:
            // FULL_CLIENT => WITH_SPLIT_BAR
            $('html').attr('dcs-layout', layout)
            break
          case 3:
            // FULL_CLIENT => WITH_SPLIT_BAR
            this._animateGhostRL(() => {
              $('html').attr('dcs-layout', layout)
            })
            break
        }
        break

      case 1:
        switch (layout) {
          case 0:
            // FULL_DISCOURSE => FULL_CLIENT
            $('html').attr('dcs-layout', layout)
            break
          case 1:
            // FULL_DISCOURSE => FULL_DISCOURSE
            break
          case 2:
            // FULL_DISCOURSE => WITH_SPLIT_BAR
            $('html').attr('dcs-layout', layout)
            break
          case 3:
            // FULL_DISCOURSE => WITH_SPLIT_BAR
            $('html').attr('dcs-layout', layout)
            break
        }
        break

      case 2:
        switch (layout) {
          case 0:
            // WITH_SPLIT_BAR => FULL_CLIENT
            $('html').attr('dcs-layout', layout)
            break
          case 1:
            // WITH_SPLIT_BAR => FULL_DISCOURSE
            $('html').attr('dcs-layout', layout)
            break
          case 2:
            // WITH_SPLIT_BAR => WITH_SPLIT_BAR
            break
          case 3:
            // WITH_SPLIT_BAR => WITH_SPLIT_BAR
            this._animateGhostRL(() => {
              $('html').attr('dcs-layout', layout)
            })
            break
        }
        break

      case 3:
        switch (layout) {
          case 0:
            // WITH_SPLIT_BAR => FULL_CLIENT
            $('html').attr('dcs-layout', layout)
            this._animateGhostLR()
            break
          case 1:
            // WITH_SPLIT_BAR => FULL_DISCOURSE
            $('html').attr('dcs-layout', layout)
            break
          case 2:
            // WITH_SPLIT_BAR => WITH_SPLIT_BAR
            $('html').attr('dcs-layout', layout)
            this._animateGhostLR()
            break
          case 3:
            // WITH_SPLIT_BAR => WITH_SPLIT_BAR
            break
        }
        break

      default:
        u.throw()
    }

    // Force the mobile view in case of splitted screen.
    // Mobile view is important in at least this case:
    // The topic-navigation component is responsible for
    // displaying either a vertical timeline (on large screens) or a small
    // horizontal gauge (on small screens). See this code:
    // https://github.com/discourse/discourse/blob/502b1316d04c2b228b0974f40ac263fe4df2ae0a/app/assets/javascripts/discourse/components/topic-navigation.js.es6#L19
    // This code fails because it performs a computation based on the window
    // width instead of #main-outlet width.
    const forceMobileView = this.saveMobileView || layout === 2 || layout === 3
    this.appCtrl.site.set('mobileView', forceMobileView)

    this.prevLayout = layout
  }
}

//------------------------------------------------------------------------------

function isWideScreen() {
  return window.innerWidth >= 1035
}

function setWideClass() {
  $('html').toggleClass('dcs-wide', isWideScreen())
}

window.addEventListener('resize', setWideClass)

setWideClass()

//------------------------------------------------------------------------------

const afterRender = res =>
  new Promise(resolve => {
    Ember.run.schedule('afterRender', null, () => resolve(res))
  })

//------------------------------------------------------------------------------
