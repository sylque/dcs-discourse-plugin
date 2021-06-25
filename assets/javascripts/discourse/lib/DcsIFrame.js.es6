import { u } from './utils'
import { DcsTag } from './DcsTag'
// Don't import this from "ComToClient.js" (notice the .js), as ComToClient.js
// is *not* part of the rollup bundle (so the path won't work once transferred
// to the plugin folder)
import { ComToClient } from './ComToClient'
import { loadWebsiteDescr, checkRoute, checkRedirect } from './websiteDescr'
import { discourseAPI } from './discourseAPI'
import User from 'discourse/models/user'

//------------------------------------------------------------------------------

/**
 * @param {(string | boolean | IArguments)[]} args
 */
const log = (...args) => {
	//u.log(...args)
}

//------------------------------------------------------------------------------

export class DcsIFrame {
	//----------------------------------------------------------------------------
	// Constructor
	//----------------------------------------------------------------------------

	constructor(app, container) {
		this.container = container
		this.descrArray = null
		this.readyPromise = null
		this.currentRoute = null
		this.clientContext = null
		this.additionalRedirects = null
		this.connectionTimer = null

		/*
    discourseAPI.newTags(['tete']).then(() => {
      discourseAPI.setTagNotification({ tag: 'tete', notificationLevel: 3 })
    })
    */

		// Check Discourse settings
		const jsonUrlsStr = Discourse.application.SiteSettings['docuss_website_json_file']
		if (!jsonUrlsStr) {
			this._displayError(
				'Error in Discourse settings',
				'At least one "docuss website json file" must be set'
			)
			this.readyPromise = Promise.reject('Docuss error, see the home page')
			return
		}
		const jsonUrls = jsonUrlsStr
			.split('|')
			.filter(url => !url.startsWith('DISABLE'))
		if (!jsonUrls.length) {
			this._displayError(
				'Error in Discourse settings',
				'All files in "docuss website json file" are disabled'
			)
			this.readyPromise = Promise.reject('Docuss error, see the home page')
			return
		}
		if (!Discourse.application.SiteSettings['tagging_enabled']) {
			this._displayError(
				'Error in Discourse settings',
				'"tagging enabled" must be set to true'
			)
			this.readyPromise = Promise.reject('Docuss error, see the home page')
			return
		}
		const proxyUrl = Discourse.application.SiteSettings['docuss_proxy_url']
		if (proxyUrl) {
			try {
				this.parsedProxyUrl = new URL(proxyUrl)
			} catch (e) {
				this._displayError(
					'Error in Discourse settings',
					'Invalid url in "docuss proxy url"'
				)
				this.readyPromise = Promise.reject('Docuss error, see the home page')
				return
			}
		}

		/*
    // Unfortunately, those 2 settings are server-side only
    if (Discourse.application.SiteSettings.allow_duplicate_topic_titles < DcsTag.MIN_TAG_LENGTH) {    
      settingsError('"allow duplicate topic titles" must be set to true')
      return
    }  
    if (Discourse.application.SiteSettings.min_trust_to_create_tag !== '0') {    
      settingsError(`"min trust to create tags" must be set to 0`)
      return
    }
    */

		// Get all category names
		const appCtrl = container.lookup('controller:application')
		const validCatNames = appCtrl.site.categories.map(c => c['name'])

		// Load and check the JSON descriptor file
		const descrPromise = loadWebsiteDescr(jsonUrls, validCatNames, proxyUrl)
			.then(descrArray => {
				// Init dcsTag
				const dcsTagSettings = descrArray[0].dcsTag
				DcsTag.init(dcsTagSettings)

				// Check tag max length against Discourse settings
				const maxTagLength1 = DcsTag.maxTagLength()
				const maxTagLength2 = Discourse.application.SiteSettings['max_tag_length']
				if (maxTagLength1 > maxTagLength2) {
					throw `dcsTag=${JSON.stringify(
						DcsTag.getSettings()
					)} implies a max tag length of ${maxTagLength1}, which doesn't match Discourse setting "max tag length"=${maxTagLength2}`
				}

				// Check tag case against Discourse settings
				const forceLowercase1 = DcsTag.getSettings().forceLowercase
				const forceLowercase2 = Discourse.application.SiteSettings['force_lowercase_tags']
				if (forceLowercase1 !== forceLowercase2) {
					throw `dcsTag.forceLowercase=${forceLowercase1} doesn't match Discourse setting "force lowercase tags"=${forceLowercase2}`
				}

				return descrArray
			})
			.catch(e => {
				if (typeof e === 'string') {
					this._displayError('Docuss - Error in website JSON file', e)
					throw 'Docuss error, see the home page'
				}

				throw e
			})

		const tagsPromise = discourseAPI.getTagList().catch(e => {
			if (typeof e === 'string') {
				this._displayError('Docuss - Error loading tags', e)
			}
			throw e
		})

		this.readyPromise = Promise.all([descrPromise, tagsPromise]).then(res => {
			// Store the descr array
			this.descrArray = res[0]

			// Get the tag list
			const tags = res[1]['tags']

			// Check for required tags
			const check = tag => {
				if (!tags.find(tagObj => tagObj['id'] === tag)) {
					this._displayError(
						'Error in Docuss setup',
						`Missing required tag "${tag}"`
					)
					throw 'Docuss error - See the error message in the app'
				}
			}
			check('dcs-comment')
			check('dcs-discuss')

			// Extract docuss tags. Beware that we need to wait for descrPromise
			// to resolve before we can do this, because we need the DcsTag
			// to be initialized
			const allCounts = tags.reduce((res, tagObj) => {
				const tag = tagObj['id']
				const count = tagObj['count']
				if (count !== 0) {
					const parsed = DcsTag.parse(tag)
					if (parsed) {
						const { pageName, triggerId } = parsed
						res.push({ pageName, triggerId, count })
					}
				}
				return res
			}, [])

			// Distribute counts in their respective descr
			this.descrArray.forEach(descr => {
				const pageNames = descr.pages.map(sp => sp.name)
				const counts = allCounts.filter(
					c =>
						pageNames.includes(c.pageName) ||
						(descr.webApp &&
							c.pageName.startsWith(descr.webApp.otherPagesPrefix))
				)
				descr.counts = serializeCounts(counts)
			})
		})

		// Set the message handlers
		ComToClient.onSetDiscourseRoute(this.onSetDiscourseRoute.bind(this))
		ComToClient.onSetRouteProps(this.onSetRouteProps.bind(this))
		ComToClient.onSetRedirects(this.onSetRedirects.bind(this))
		ComToClient.onCreateDcsTags(this.onCreateDcsTags.bind(this))
		ComToClient.onCreateTopic(this.onCreateTopic.bind(this))
	}

	//----------------------------------------------------------------------------
	// Public interface
	//----------------------------------------------------------------------------

	// Return a promise that resolves to 'ready' or 'failure'
	readyForTransitions() {
		return this.readyPromise
	}

	/**
   * @param {Route} route
   */
	didTransition(route) {
		u.dev.assert(this.descrArray)
		log('didTransition: ', route)

		//================================

		// resolve empty page name for route "docuss"
		// We *need* a complete route, because the route will be forwarded to client
		if (route.layout === 0 && !route.pageName) {
			route.pageName = this.descrArray[0].pages[0].name
		}

		const error = checkRoute(route)
		if (error) {
			u.throw(`Invalid route ${JSON.stringify(route)} - ${error}`)
		}

		//================================

		// Get all redirects
		const descrRedirects = this.descrArray.reduce(
			(res, da) => res.concat(da.redirects || []),
			[]
		)
		const redirects = descrRedirects.concat(this.additionalRedirects || [])

		// Find a redirect matching the current route change
		const destRoute = getRedirectedRoute({ src: route, redirects })

		// Redirect and quit
		if (destRoute) {
			log('Redirect to ', destRoute)

			this._goToRouteFromClient({
				route: destRoute,
				mode: 'REPLACE',
				clientContext: this.clientContext // Keep the same clientContext
			})

			return true
		}

		//================================

		this.currentRoute = route

		//================================

		// Case FULL_DISCOURSE
		if (route.layout === 1) {
			if (!this.currentDescr) {
				// When we load the application on a FULL_DISCOURSE route, we set
				// the logo and menu to the first website. THIS WILL PROBABLY NEED
				// TO BE CHANGED, as some user want a dedicated Discourse category
				// per website. When initially loading the app on this category, the
				// corresponding website should be set instead of the first one.
				this.currentDescr = this.descrArray[0]
				$('html').addClass(`dcs-website-${this.currentDescr.websiteName}`)
				if (this.currentDescr.logo) {
					this.container.dcsHeaderLogo.setLogo(this.currentDescr.logo)
				}
			}

			this._notifyClientOfCurrentRoute()

			return false
		}

		//================================

		// Get the descr and page corresponding to the pageName
		let page = null
		const descr = this.descrArray.find(d => {
			page = d.pages.find(p => p.name === route.pageName)
			return (
				!!page ||
				(d.webApp && route.pageName.startsWith(d.webApp.otherPagesPrefix))
			)
		})

		// Case we didn't find the descr
		if (!descr) {
			this._displayError(
				'Page Not Found',
				`Unknown page "${route.pageName}".<br>` +
					'Use the top left logo to come back to safety.'
			)
			return false
		}

		// If the descr has changed...
		if (descr !== this.currentDescr) {
			// Set the descr class
			if (this.currentDescr) {
				$('html').removeClass(`dcs-website-${this.currentDescr.websiteName}`)
			}
			$('html').addClass(`dcs-website-${descr.websiteName}`)
			this.currentDescr = descr

			// Set the descr logo
			const homePath =
				this.currentDescr === this.descrArray[0]
					? null
					: `/docuss/${this.currentDescr.pages[0].name}`
			const logo = Object.assign({}, this.currentDescr.logo, { href: homePath })
			this.container.dcsHeaderLogo.setLogo(logo)

			// If there is no page, it means we are in a web app. Because the descr
			// has just changed, we need to load the web app url.
			page = page || descr.pages[0]
		}

		// Case webApp with no need for reloading the url
		if (!page) {
			this._notifyClientOfCurrentRoute()
			return false
		}

		// Get the page url
		let url = page.url
		if (page.needsProxy) {
			const parsedUrl = new URL(url)
			parsedUrl.protocol = this.parsedProxyUrl.protocol
			parsedUrl.hostname += '.' + this.parsedProxyUrl.hostname
			if (this.parsedProxyUrl.port) {
				parsedUrl.port = this.parsedProxyUrl.port
			}
			url = parsedUrl.href
		}

		// Load the url
		if (url !== this.currentUrl) {
			this.clientContext = null // New page = new clientContext
			this._loadPage({
				url,
				onConnectedOrReconnected: () => {
					if (this.connectionTimer) {
						clearTimeout(this.connectionTimer)
						this.connectionTimer = null
					}
					this._notifyClientOfCurrentRoute()
				}
			})
			this.currentUrl = url
		} else {
			this._notifyClientOfCurrentRoute()
		}

		return false
	}

	//----------------------------------------------------------------------------
	// Private methods
	//----------------------------------------------------------------------------

	/**
   * @param {Object} args
   * @param {Object} args.descr
   * @param {Route} args.route
   */
	_notifyClientOfCurrentRoute() {
		u.dev.assert(this.currentRoute)
		u.dev.assert(this.currentDescr)

		// Beware, there might be no page previously loaded (so no comToClient
		// yet): this is the case when startup occurs on a pure Discourse route
		// (such as Admin)
		if (ComToClient.isConnected()) {
			ComToClient.postDiscourseRoutePushed({
				route: this.currentRoute,
				descr: this.currentDescr.originalDescr,
				counts: this.currentDescr.counts,
				clientContext: this.clientContext,
				origin: location.origin
			})
		}

		this.clientContext = null
	}

	_loadPage({ url, onConnectedOrReconnected }) {
		// Reset
		ComToClient.disconnect()

		// Build the target url
		const parsedUrl = new URL(url)
		parsedUrl.hash = location.hash

		// Add a query param to ask for login (in case the page or app supports it)
		if (User.current()) {
			parsedUrl.searchParams.set('discourse-login', true)
		}

		// Create the iframe with the right url.
		this.container.dcsLayout.replaceLeftWithIFrame(parsedUrl.href)

		// Connect to the iframe
		ComToClient.connect({
			iframeElement: this.container.dcsLayout.left,
			iframeOrigin: parsedUrl.origin,
			onConnected: onConnectedOrReconnected
			/*
      timeout: 10000,
      onTimeout: () => {
        this._displayError(
          'Docuss Error: connection timeout',
          'Communication could not be established with the embedded website.<br />' +
            'Please check that it includes one of the Docuss ' +
            '<a href="https://github.com/sylque/dcs-client" target="_blank">client libraries</a>.'
        )
        //reject() WE DON'T WANT TO DISPLAY AN "Uncaught (in promise)" additional error
      }
      */
		})

		// In the past, we used to display the error below as a connection timeout.
		// But this didn't work: users repeatedly complained about their website
		// sometimes hanging with the timeout error. My hypothesis is that the error
		// was due to very slow Internet connection on mobile. So one solution could
		// have been to increase the timeout from 10s to 20s or more (after all,
		// typical browser timeout is 5 minutes!). But then, webmasters forgetting
		// to add a dcs-client library to their page would not have seen the error
		// message soon enough.
		if (this.connectionTimer) {
			clearTimeout(this.connectionTimer)
		}
		this.connectionTimer = setTimeout(() => {
			u.logWarning(
				'For 10 seconds now, the Docuss plugin is trying to connect to ' +
					`the iframe displaying this url: ${url}. Possible issues: ` +
					'1. your Internet connection is slow and everything will be working ' +
					'fine once the iframe has finished loading ' +
					'2. the page in the iframe does not include one of the Docuss client ' +
					'libraries (see more information at https://github.com/sylque/dcs-client).' +
					'3. the page in the iframe is a web app which has crashed.'
			)
			this.connectionTimer = null
		}, 10000)
	}

	_displayError(title, msg) {
		//u.logError(title + '. ' + msg) //DISPLAYS HTML MARKUP + RISK TO CONFUSE PEOPLE, BETTER LET THE MAIN SCREEN DISPLAY THE ERROR

		ComToClient.disconnect()
		this.currentUrl = null

		afterRender().then(() => {
			this.container.dcsLayout.replaceLeftWithDiv(`<h3>${title}</h3>${msg}`)
		})

		// Wait after load time transition (otherwise it will be put back)
		u.async.delay(2000).then(() => {
			this.container.dcsLayout.setLayout(0)
		})
	}

	_goToPathFromClient({ path, hash, mode, clientContext }) {
		// Get the router
		const router = this.container.lookup('router:main')

		// Change the route (it will do nothing if the path is the same)
		const transition =
			mode === 'PUSH' ? router.transitionTo(path) : router.replaceWith(path)
		const transitionActuallyOccurred = !!transition['intent']
		if (transitionActuallyOccurred) {
			this.clientContext = clientContext
		}

		// Ember doesn't support anchors. So we need to manage them manually.
		// https://github.com/discourse/discourse/blob/35bef72d4ed6d530468bdc091bc076d431a2cdc4/app/assets/javascripts/discourse/lib/discourse-location.js.es6#L85
		const location = this.container.lookup('location:discourse-location')
		if (hash !== location.location.hash) {
			const url = hash || path // "hash" to set the hash, "path" to reset the hash
			transition.then(() => {
				if (mode === 'REPLACE' || transitionActuallyOccurred) {
					location['replaceURL'](url)
				} else {
					location['setURL'](url)
				}
			})
		}
	}

	/**
   *  @param {SetRouteParams}
   */
	_goToRouteFromClient({ route, mode, clientContext }) {
		const error = checkRoute(route)
		if (error) {
			u.throw(`Invalid route ${JSON.stringify(route)} - ${error}`)
		}
		u.throwIfNot(
			mode === 'PUSH' || mode === 'REPLACE',
			'setDiscourseRoute: missing or invalid argument "mode"'
		)

		// Case FULL_CLIENT
		if (route.layout === 0) {
			this._goToPathFromClient({
				path: `/docuss/${route.pageName}`,
				hash: route.hash,
				mode,
				clientContext
			})
			return
		}

		// Case FULL_DISCOURSE
		if (route.layout === 1) {
			this._goToPathFromClient({ path: route.pathname, mode, clientContext })
			return
		}

		// Case WITH_SPLIT_BAR

		const { pageName, interactMode, triggerId } = route
		const dcsTag = DcsTag.build({ pageName, triggerId })
		const queryParams = route.layout === 2 ? '?r=false' : ''

		// Case WITH_SPLIT_BAR + DISCUSS
		if (interactMode === 'DISCUSS') {
			this._goToPathFromClient({
				path: `/tags/intersection/dcs-discuss/${dcsTag}${queryParams}`,
				hash: route.hash,
				mode,
				clientContext
			})
			return
		}

		// Case WITH_SPLIT_BAR + COMMENT
		discourseAPI
			.getTopicList({ tag: dcsTag })
			.then(topicList => {
				// Case there's no topic with this tag yet: see next "then"
				if (!topicList.length) {
					return 'not found'
				}

				// Case topics have been found: go through those topics and find
				// the first one that also has the tag 'dcs-comment'
				const topic = topicList.find(t => t['tags'].includes('dcs-comment'))

				// If no such topic is found, there something wrong (should never
				// happen)
				u.throwIf(!topic, 'Error: no dcs-comment topic found in', topicList)

				// Display the topic
				// Don't forget the slug, otherwise Discourse will go through the
				// intermediate route "topicBySlugOrId" that never resolves (i.e.
				// transition.then() is never called)
				this._goToPathFromClient({
					path: `/t/${topic.slug}/${topic.id}${queryParams}`,
					hash: route.hash,
					mode,
					clientContext
				})

				return 'ok'
			}, e => 'not found')
			.then(res => {
				// Case there's no topic with this tag yet
				if (res === 'not found') {
					this._goToPathFromClient({
						path: `/tags/intersection/dcs-comment/${dcsTag}${queryParams}`,
						hash: route.hash,
						mode,
						clientContext
					})
				}
			})
	}

	//----------------------------------------------------------------------------
	// Handlers for client messages
	//----------------------------------------------------------------------------

	/**
   *  @param {SetRouteParams}
   */
	onSetDiscourseRoute({ route, mode, clientContext }) {
		// DON'T USE arguments[0], see https://github.com/google/closure-compiler/issues/3285
		log('onSetDiscourseRoute: ', route, mode, clientContext)
		this._goToRouteFromClient({ route, mode, clientContext })
	}

	/**
   *  @param {RouteProps} args
   */
	onSetRouteProps(args) {
		log('onSetRouteProps: ', arguments)

		const { error, category, discourseTitle } = args

		// Case error
		if (error) {
			u.logError(error)
			this._displayError(error, `Use the top left logo to come back to safety.`)
			return
		}

		// Check that the layout is WITH_SPLIT_BAR. If it is not, it doesn't mean
		// something is wrong. When clicking quickly on a menu, Discourse might
		// already have changed the route to a non WITH_SPLIT_BAR page when the
		// setRouteProps message arrives
		if (this.currentRoute.layout !== 2 && this.currentRoute.layout !== 3) {
			return
		}

		// Set title
		if (discourseTitle) {
			// Escape the title
			const safeTitle = escapeHtml(discourseTitle)

			// Remove previous title if any
			$('.dcs-title-prefix').remove()

			// In tag route, we add the title at the top of the page
			/*
      $('.navigation-container').after(
        `<h1 class="dcs-title-prefix">${safeTitle}</h1>`
      )
      */
			$('.tag-show-heading').text(safeTitle).css({ display: 'inline-flex' })

			// In topic route, we transform the topic title. The issue here is that
			// the title is rendered very late, so we nee to wait until the title
			// has been rendered before we can transform it. Also, beware that the
			// route can change while we are waiting! (we don't want to transform the
			// title of another topic)
			const router = this.container.lookup('router:main')
			const hasTitle = () => {
				if (!router['currentPath'].startsWith('topic.')) {
					throw 'bad route'
				}
				const $title = $('.fancy-title')
				return $title.length && $title
			}
			u.async
				.retryDelay(hasTitle, 15, 200, 'title not found') // 15*200 = 3s
				.then(
					$title => {
						if (this.currentRoute.interactMode === 'COMMENT') {
							$title.text(safeTitle)

							// By default, the title is hidden with css, so bring it back
							const $topicTitle = $('#topic-title')
							$topicTitle.css('display', 'block')

							// Is there a topic map? The topic map is th grey rectangular area
							// containing the number of posters, viewers, etc.
							const $topicMap = $('.topic-map')
							if ($topicMap.length) {
								// Make room of moving the topic map on top of the title (see
								// the css)
								$topicTitle.css('margin-top', '50px')
							}
						} else {
							const topicCtrl = this.container.lookup('controller:topic')
							const originalTitle = topicCtrl.get('model.title')
							$title.html(
								`<span class="dcs-title-prefix">${safeTitle} | </span>${originalTitle}`
							)
						}
					},
					e => {
						if (e === 'bad route') {
							// No error here. It's just that we are not on a route where it makes
							// sense to set the title.
						} else {
							u.logError(e)
						}
					}
				)
		}

		// Set category
		if (category) {
			// Get the category from Discourse
			const appCtrl = this.container.lookup('controller:application')
			const cat = appCtrl.site.categories.find(c => c['name'] === category)

			// Set the category in the composer
			if (cat) {
				const tagsShowCtrl = this.container.lookup('controller:tags-show')
				tagsShowCtrl.set('category', cat)
				tagsShowCtrl.set('canCreateTopicOnCategory', true)
			} else {
				u.logError(`Category "${category}" not found in Discourse`)
			}
		}
	}

	/**
   * @param {[Redirect]} redirects
   */
	onSetRedirects(redirects) {
		// Check redirects validity
		redirects.forEach(r => {
			const error = checkRedirect(r)
			u.throwIf(error, error)
		})

		// Remove previous redirects and store the new ones
		this.additionalRedirects = redirects

		// Perform immediate redirect if the current route matches a redirect rule.
		// This allows redirecting when loading the app on a wrong (non-redirected)
		// url
		const dest = getRedirectedRoute({ src: this.currentRoute, redirects })
		if (dest) {
			this._goToRouteFromClient({
				route: dest,
				mode: 'REPLACE',
				clientContext: null
			})
		}
	}

	/**
   * @param {CreateTagsParams} args
   */
	onCreateDcsTags(args) {
		log('onCreateDcsTags: ', arguments)

		const { pageName, triggerIds, notificationLevel } = args
		u.throwIfNot(pageName, 'postCreateDcsTags: missing argument "pageName"')

		// Check page name existence
		const found = this.descrArray.find(
			d =>
				d.pages.find(p => p.name === pageName) ||
				(d.webApp && pageName.startsWith(d.webApp.otherPagesPrefix))
		)
		if (!found) {
			u.logError(`Unable to create tag: page "${pageName}" not found`)
			return
		}

		// Build the tag names
		const tags = triggerIds
			? triggerIds.map(triggerId => DcsTag.build({ pageName, triggerId }))
			: [DcsTag.build({ pageName, triggerId: undefined })]

		// Create the tags
		discourseAPI.newTags(tags).then(
			() => {
				// Set tag notification level
				if (notificationLevel !== undefined && notificationLevel !== 1) {
					u.async
						.forEach(tags, tag =>
							discourseAPI.setTagNotification({ tag, notificationLevel })
						)
						.catch(e => {
							const tagsStr = JSON.stringify(tags)
							u.logError(
								`Failed to set the notification level for one of those tags: ${tagsStr} (${e})`
							)
						})
				}
			},
			e => {
				const tagsStr = JSON.stringify(tags)
				u.logError(`Failed to create tags ${tagsStr}: ${e}`)
			}
		)
	}

	/**
   * @param {CreateTopicParams} args
   */
	onCreateTopic(args) {
		log('onCreateTopic: ', arguments)

		const {
			title,
			body,
			category,
			pageName,
			triggerId,
			tagNotificationLevel
		} = args
		u.throwIfNot(pageName, 'postCreateTopic: missing argument "pageName"')

		// Check page name existence
		const found = this.descrArray.find(
			d =>
				d.pages.find(p => p.name === pageName) ||
				(d.webApp && pageName.startsWith(d.webApp.otherPagesPrefix))
		)
		if (!found) {
			u.logError(`Unable to create topic: page "${pageName}" not found`)
			return
		}

		// Build the tags
		const tag = DcsTag.build({ pageName, triggerId })
		const tags = [tag, 'dcs-discuss']

		// Get the category id
		let catId = undefined
		if (category) {
			const appCtrl = this.container.lookup('controller:application')
			const cat = appCtrl.site.categories.find(c => c['name'] === category)
			if (!cat) {
				u.logError(`Unable to create topic: category "${category}" not found`)
				return
			}
			catId = cat['id']
		}

		// Create the topic
		discourseAPI.newTopic({ title, body, catId, tags }).then(
			() => {
				// Set tag notification level
				if (tagNotificationLevel !== undefined && tagNotificationLevel !== 1) {
					discourseAPI
						.setTagNotification({
							tag,
							notificationLevel: tagNotificationLevel
						})
						.catch(e => {
							u.logError(
								`Failed to set the notification level for tag: ${tag} (${e})`
							)
						})
				}
			},
			e => {
				const tagsStr = JSON.stringify(tags)
				u.logError(`Failed to create topic: ${e}`)
			}
		)
	}
}

//------------------------------------------------------------------------------

// A note on transitionTo: providing both a path and a queryParams object
// doesn't work. You need to provide either a route name and a queryParams
// object OR a full path containing everything.

const get = url =>
	new Promise((resolve, reject) => {
		$.get(url, data => resolve(data)).fail(() => reject(`get "${url}" failed`))
	})

const afterRender = res =>
	new Promise(resolve => {
		Ember.run.schedule('afterRender', null, () => resolve(res))
	})

// Return null if "route" doesn't match one of the redirect rules
// Return the destination route if it does
function getRedirectedRoute({ src, redirects }) {
	const match = redirects.find(redirect => {
		const nonMatchingKeys = Object.keys(redirect.src).filter(key => {
			const wildcardRedirectSrc = redirect.src[key]
			if (
				typeof wildcardRedirectSrc === 'string' &&
				wildcardRedirectSrc.endsWith('*')
			) {
				return (
					!src[key] || !src[key].startsWith(wildcardRedirectSrc.slice(0, -1))
				)
			}
			return wildcardRedirectSrc !== src[key]
		})
		return nonMatchingKeys.length === 0
	})
	if (!match) {
		return null
	}

	const dest = Object.assign({}, match.dest)
	Object.keys(dest).forEach(key => {
		if (dest[key] === '@SAME_AS_SRC@') {
			dest[key] = src[key]
		}
	})

	return dest
}

//https://stackoverflow.com/questions/1787322/htmlspecialchars-equivalent-in-javascript/4835406#4835406
const map = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#039;'
}
const escapeHtml = text => text.replace(/[&<>"']/g, m => map[m])

function serializeCounts(counts) {
	return counts.map(c => {
		const { pageName, triggerId, count } = c
		return {
			['pageName']: pageName,
			['triggerId']: triggerId,
			['count']: count
		}
	})
}

//------------------------------------------------------------------------------
