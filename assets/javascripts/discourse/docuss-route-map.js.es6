// SYNTAX THAT WORKS:
// https://github.com/discourse/discourse/blob/master/app/assets/javascripts/discourse/routes/app-route-map.js.es6
// SYNTAX THAT DOESN'T SEEM TO WORK:
// https://github.com/discourse/discourse-solved/blob/master/assets/javascripts/discourse/solved-route-map.js.es6

// We need 2 routes here, in order to have an optional dynamic
// segments (unfortunately, Embers doesn't support this feature out of the
// box). In fact, with Ember, it' is' usually better to use query params
// instead of optional dynamic segments, but the  issue here is that
// setDefaultHomepage() doesn't seem to support query params: suppose the
// current url is /? s = foo, then clicking a '/' link won't trigger a transition.

export default function() {
  this.route('docuss', { path: '/docuss' })
  this.route('docuss-with-page', { path: '/docuss/:page' })
}
