# dcs-discourse-plugin2

A Discourse plugin that allows to integrate your website or web app within
Discourse.

## Demos

See [here](https://github.com/sylque/docuss).

## Discourse Setup

### 1. Install the plugin in Discourse

The plugin’s repository url is:

```
https://github.com/sylque/dcs-discourse-plugin2.git
```

Step by step guide, based on Discourse
[official documentation](https://meta.discourse.org/t/install-plugins-in-discourse):

1. Access your Discourse server
2. Type `cd /var/discourse`
3. Type `sudo nano containers/app.yml`
4. Arrow down until you see this:

```
hooks:
  after_code:
    - exec:
        cd: $home/plugins
        cmd:
           - git clone https://github.com/discourse/docker_manager.git
```

5. Paste `- git clone https://github.com/sylque/dcs-discourse-plugin2.git`
   beneath that, so that all together it looks like this:

```
hooks:
  after_code:
    - exec:
        cd: $home/plugins
        cmd:
           - git clone https://github.com/discourse/docker_manager.git
           - git clone https://github.com/sylque/dcs-discourse-plugin2.git
```

6. Hit `control + O` then Enter (to save `app.yml`)

7. Hit `control + X` (to exit `app.yml`)

8. Type `sudo ./launcher rebuild app` to rebuild Discourse

### 2. Set Discourse settings

In the Discourse Admin panel, open the Settings page and set the following
settings:

- `tagging enabled` &rightarrow; checked
- `min trust to create tag` &rightarrow; `0: new user`
- `allow duplicate topic titles` &rightarrow; checked
- `docuss enabled` &rightarrow; checked
- `docuss emb website descr` &rightarrow; url of a json file describing your
  website or web app.

If your Discourse instance doesn't use tags (i.e. if `tagging enabled` was
unchecked before you checked it as part of this setup), set this additional
setting:

- `docuss hide tags` &rightarrow; checked

### 3. Create the required tags

Select a public topic (or create a new one), edit it, and add those two tags:

- `dcs-comment`
- `dcs-discuss`

Discourse will ask if you want to create them: answer yes.

~~Now you can safely delete the topic if you want, the tags will remain~~. Nope,
sometimes it doesn't work. You better keep the topic.

## The JSON Description File

[Under construction]

Be sure to validate you JSON file using the
[Website Description File Validator](https://sylque.github.io/dcs-website-schema/public/validate.html).

## Website Navigation

Now that your website is displayed within Discourse, you might want to
reconsider your navigation/menu system. You can keep it in your website, you can
move it to Discourse, or you can do a bit of both.

At the very minimum, in your website, you need to update the links to your
forum. Change them all to `http://www.mydiscourse.org/latest` (instead of
`http://www.mydiscourse.org`).

Discourse custom navigation is out of the scope of this plugin. To learn more
about it, see
[Best way to customize the header](https://meta.discourse.org/t/best-way-to-customize-the-header/13368).
Just use the fact that, whether from a Discourse menu or from your website:

- `http://www.mydiscourse.org/` points to your home page,
- `http://www.mydiscourse.org/docuss/[pageName]` points to one of your website's
  page,
- `http://www.mydiscourse.org/latest` points to your forum.

## License

See [here](https://github.com/sylque/docuss#license).