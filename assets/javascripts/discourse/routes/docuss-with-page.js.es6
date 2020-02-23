import DiscourseRoute from 'discourse/routes/discourse'
export default DiscourseRoute.extend({
  titleToken() {
    // Set page title
    return this['context']['page']
  }
})
