import { u } from './utils'

export const discourseAPI = {
	commentTopicTitle(dcsTag) {
		return `Docuss comments (${dcsTag})`
	},

	_request({ method, path, params = undefined, moreAjaxSettings = {} }) {
		return new Promise((resolve, reject) => {
			const settings = {
				['type']: method,
				['url']: path,
				['data']: params,
				['success']: data => resolve(data)
			}
			const allSettings = Object.assign(settings, moreAjaxSettings)
			$.ajax(allSettings).fail(e => reject(e.responseText))
		})
	},

	getCatList() {
		return discourseAPI
			._request({ method: 'GET', path: `/categories.json` })
			.then(obj => obj['category_list']['categories'])
	},

	getTagList() {
		return discourseAPI._request({ method: 'GET', path: '/tags.json' })
	},

	getTopicList({ tag }) {
		return discourseAPI
			._request({ method: 'GET', path: `/tags/${tag}.json` })
			.then(tagObj => tagObj['topic_list']['topics'])
	},

	// Beware:
	// - the topic id is in topic.topic_id
	// - topic.id is the is of the first topic post
	newTopic({ title, body, catId, tags }) {
		return discourseAPI._request({
			method: 'POST',
			path: `/posts`,
			params: {
				['title']: title,
				['raw']: body,
				['category']: catId,
				['tags']: tags || []
			}
		})
	},

	// Delete a topic
	// Beware that topics created by the system user (such as the category "About"
	// topics) cannot be deleted and will throw an exception
	delTopic({ topicId }) {
		return discourseAPI._request({
			method: 'DELETE',
			path: `/t/${topicId}.json`
		})
	},

	// Naive approach for creating a tag (see below)
	// tags is an array of strings
	// See also https://meta.discourse.org/t/api-cleaner-way-to-create-a-tag/70526
	_newTags(tags, catId) {
		return (
			discourseAPI
				.newTopic({
					title: 'Temporary Docuss-generated topic ' + Date.now(),
					body:
						'This topic was supposed to be removed and should not be there.' +
						Date.now(),
					catId,
					tags
				})
				// Sometimes the topic is not deleted. Hope this will help.
				.then(tempTopic => u.async.delay(2000, tempTopic))
				.then(tempTopic =>
					discourseAPI.delTopic({ topicId: tempTopic['topic_id'] })
				)
		)
	},

	// Complete function to create a tag.
	// tags is an array of strings.
	//
	// When Discourse setting "allow uncategorized topics" is unchecked, a
	// category is mandatory when creating a topic.But some categories might lack
	// the "create" permission for the current user! So we try all categories.
	// The good thing is: in most cases, the "Uncategorized" category is the first
	// one of the list
	newTags(tags) {
		return discourseAPI.getCatList().then(cats =>
			u.async
				.find(cats, cat =>
					discourseAPI._newTags(tags, cat.id).then(
						() => true,
						e => {
							console.log(
								'discourseAPI.newTags(): cannot create topic.',
								e
							)
							return false
						}
					)
				)
				.then(foundCat => {
					if (!foundCat) {
						throw 'discourseAPI.newTags(): could not find a category where creating a topic is allowed.'
					} else {
						console.log(
							'discourseAPI.newTags(): found a category to create a topic.',
							foundCat
						)
					}
				})
		)
	},

	/*
  // tags is an array of strings
  // topicTitle and topicBody must be specified or unspecified together
  // (beware of title and content conditions such as length, entropy,
  // similarity, etc.).If they are, then the temporary topic is not deleted.
  newTags2({ tags, catId, topicTitle, topicBody }) {
    if (topicTitle || topicBody) {
      return discourseAPI.newTopic({
        title: topicTitle,
        body: topicBody,
        catId,
        tags,
      })
    } else {
      const date = Date.now()
      const title = 'Temporary Docuss-generated topic ' + date
      const body =
        'This topic was supposed to be removed and should not be there.' + date
      return (
        discourseAPI
          .newTopic({ title, body, catId, tags })
          // Sometimes the topic is not deleted. Hope this will help.
          .then((tempTopic) => u.async.delay(2000, tempTopic))
          .then((tempTopic) =>
            discourseAPI.delTopic({ topicId: tempTopic['topic_id'] })
          )
      )
    }
  },
  */

	// notificationLevel = 0..3
	// PUT
	// Url: /tags/dcs-missio-test1/notifications
	// Data: tag_notification[notification_level]: 3
	setTagNotification({ tag, notificationLevel }) {
		return discourseAPI._request({
			method: 'PUT',
			path: `/tags/${tag}/notifications`,
			params: {
				['tag_notification']: {
					['notification_level']: notificationLevel
				}
			}
		})
	}
}
