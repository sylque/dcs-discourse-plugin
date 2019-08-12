# name: docuss
# about: Docuss plugin for Discourse
# version: 1.0.16
# authors: Sylvain Quendez

# When styles are not working or are not updating, try:
# - stopping server
# - rm -rf discourse/tmp
# - delete discourse/public/uploads/stylesheet-cache
# - restart server
# If styles are still not updating, there is probably a syntax error in the SCSS 
# causing a silent failure and causing the file not being processed.
# To be 100% sure you can also enable Chrome Dev Tools -> Settings -> General -> 
# Disable cache (while DevTools is open), but note it leads to 30s onload times.

# Load styles
register_asset "stylesheets/docuss.css"

# Register admin settings
enabled_site_setting :docuss_enabled

# Changes X-Frame-Options so the site can be embedded in an iframe. See:
# https://github.com/BeXcellent/discourse-allowiframe/blob/master/plugin.rb
# https://github.com/TheBunyip/discourse-allow-same-origin/blob/master/plugin.rb
# Rails.application.config.action_dispatch.default_headers.merge!({'X-Frame-Options' => 'ALLOWALL'})

# Monkey-ptach the tags:show_latest controller, so that it returns an empty list
# instead of a 404 exception when the tag doesn't exist. Thisserver-side part
# is mandatory to handle loading an initial url pointing to a non-existent tag
# Thefull  solution also require to override TagsShowRoute::model() client-side.
# We are overriding this:
# https://github.com/discourse/discourse/blob/385829d7be7cc85b2eb561b7a2640768bc7710de/app/controllers/tags_controller.rb#L70
# Example of controller overriding:
# https://github.com/discourse/discourse-voting/blob/master/plugin.rb#L213
# https://meta.discourse.org/t/overriding-a-method-in-a-controller/92657
# Clean monkey patching in ruby (first metho, with 'prepend()', doesn't work) :
# https://stackoverflow.com/questions/4470108/when-monkey-patching-a-method-can-you-call-the-overridden-method-from-the-new-i
# About handling exceptions:
# http://rubylearning.com/satishtalim/ruby_exceptions.html

#after_initialize do
#  require_dependency 'tags_controller'  
#  class ::TagsController
#    old_show_latest = instance_method(:show_latest)
#    define_method(:show_latest) do
#      begin  
#        old_show_latest.bind(self).()
#      rescue  
#        list_opts = build_topic_list_options
#        @list = TopicQuery.new(current_user, list_opts).public_send("list_latest")
#        @list.draft_key = Draft::NEW_TOPIC
#        @list.draft_sequence = DraftSequence.current(current_user, Draft::NEW_TOPIC)
#        @list.draft = Draft.get(current_user, @list.draft_key, @list.draft_sequence) if current_user
#        @list.more_topics_url = construct_url_with(:next, list_opts)
#        @list.prev_topics_url = construct_url_with(:prev, list_opts)
#        respond_with_list(@list)
#      end        
#    end
#  end
#end

after_initialize do

  # https://github.com/discourse/discourse-slack-official/blob/master/plugin.rb#L35
  require_dependency 'application_controller'
  class ::DocussController < ::ApplicationController
    def show
      # render html: 'Hello'
    end
  end

  Discourse::Application.routes.append do
    # https://meta.discourse.org/t/make-forum-available-on-a-subpath-via-additional-route/89453?u=jack2
    # https://github.com/discourse/discourse/blob/master/config/routes.rb#L677
    #get '/docuss' => 'list#latest'
    get '/docuss(/:page)' => 'docuss#show'
  end

end