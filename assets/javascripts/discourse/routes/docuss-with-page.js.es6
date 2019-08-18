export default Discourse.Route.extend({
  titleToken() {
    // Set page title
    return this['context']['page']
  }
})
