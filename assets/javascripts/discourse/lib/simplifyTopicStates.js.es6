/*

//------------------------------------------------------------------------------

import { NotificationLevels } from 'discourse/lib/notification-levels'

//------------------------------------------------------------------------------

export function simplifyTopicStates(topicStates) {
  // Parse topic states to build a simpler object (res).
  // A new topic is a topic the user has never opened
  // An unread topic is a topic user is watching or tracking and which has unread posts
  // See:
  // https://github.com/discourse/discourse/blob/8bd7cfedfd65d15a4b1278125beb664b3b6166c5/app/assets/javascripts/discourse/components/suggested-topics.js.es6
  // https://github.com/discourse/discourse/blob/05a74d2534dc7e89f59bfb3ebbdc9f6cbc7cc905/app/assets/javascripts/discourse/models/topic-tracking-state.js.es6#L288
  // https://github.com/discourse/discourse/blob/05a74d2534dc7e89f59bfb3ebbdc9f6cbc7cc905/app/assets/javascripts/discourse/models/topic-tracking-state.js.es6#L310
  return _.chain(topicStates)
    .reject(
      topic => topic['deleted'] || topic['archetype'] === 'private_message'
    )
    .map(topic => ({
      topicId: topic['topic_id'],
      isNewTopic: isNew(topic),
      unreadPostCount: hasUnreadPosts(topic)
        ? topic['highest_post_number'] - topic['last_read_post_number']
        : 0
    }))
    .reject(topic => !topic['isNewTopic'] && !topic['unreadPostCount'])
    .value()
}

//------------------------------------------------------------------------------

// https://github.com/discourse/discourse/blob/05a74d2534dc7e89f59bfb3ebbdc9f6cbc7cc905/app/assets/javascripts/discourse/models/topic-tracking-state.js.es6#L7
function isNew(topic) {
  return (
    topic['last_read_post_number'] === null &&
    ((topic['notification_level'] !== 0 && !topic['notification_level']) ||
      topic['notification_level'] >= NotificationLevels.TRACKING)
  )
}

// https://github.com/discourse/discourse/blob/05a74d2534dc7e89f59bfb3ebbdc9f6cbc7cc905/app/assets/javascripts/discourse/models/topic-tracking-state.js.es6#L13
function hasUnreadPosts(topic) {
  return (
    topic['last_read_post_number'] !== null &&
    topic['last_read_post_number'] < topic['highest_post_number'] &&
    topic['notification_level'] >= NotificationLevels.TRACKING
  )
}

//------------------------------------------------------------------------------

*/