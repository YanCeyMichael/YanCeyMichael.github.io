import * as SveltiaModule from './vendor/sveltia-cms-0.261.0/npm/index.js';

/* Sveltia adapters: Yilia previews, tag reuse, and the surrounding admin shell. */
(function () {
  var root = document.getElementById('nc-root');
  if (!root) return;

  var cms = SveltiaModule.default || window.CMS;
  if (!cms) {
    throw new Error('Sveltia CMS did not initialize its JavaScript API.');
  }
  Object.keys(SveltiaModule).forEach(function (key) {
    if (typeof cms[key] === 'undefined') cms[key] = SveltiaModule[key];
  });
  window.CMS = cms;

  var React = cms.React || SveltiaModule.React;
  var h = React.createElement;
  var lifecycleMethods = new Set([
    'componentDidMount',
    'componentDidUpdate',
    'componentWillUnmount',
    'getInitialState',
    'render'
  ]);

  function createClass(spec) {
    class LegacyComponent extends React.Component {
      constructor(props) {
        super(props);
        this.state = spec.getInitialState ? spec.getInitialState.call(this) : null;
      }

      componentDidMount() {
        if (spec.componentDidMount) spec.componentDidMount.call(this);
      }

      componentDidUpdate(previousProps, previousState) {
        if (spec.componentDidUpdate) spec.componentDidUpdate.call(this, previousProps, previousState);
      }

      componentWillUnmount() {
        if (spec.componentWillUnmount) spec.componentWillUnmount.call(this);
      }

      render() {
        return spec.render.call(this);
      }
    }

    Object.keys(spec).forEach(function (key) {
      if (!lifecycleMethods.has(key) && typeof spec[key] === 'function') {
        LegacyComponent.prototype[key] = spec[key];
      }
    });
    return LegacyComponent;
  }

  var nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.origin === 'https://unpkg.com' && url.pathname === '/@sveltia/cms/package.json') {
      return nativeFetch('/admin/vendor/sveltia-cms-0.261.0/package.json', init);
    }
    if (url.origin === 'https://unpkg.com' && url.pathname.startsWith('/@sveltia/cms@0.261.0/locales/')) {
      var localeFile = url.pathname.split('/').pop();
      return nativeFetch('/admin/vendor/sveltia-cms-0.261.0/locales/' + localeFile, init);
    }
    return nativeFetch(input, init);
  };

  function listText(value) {
    if (value && value.toArray) return value.toArray().filter(Boolean).join(' · ');
    return Array.isArray(value) ? value.filter(Boolean).join(' · ') : String(value || '');
  }

  function registerPreviews() {
    if (window.__yiliaSveltiaPreviewsRegistered) return true;

    var PostPreview = createClass({
      render: function () {
        var entry = this.props.entry;
        var data = entry && entry.get ? entry.get('data') : null;
        var title = data && data.get ? data.get('title') : '';
        var date = data && data.get ? data.get('date') : '';
        var tags = data && data.get ? data.get('tags') : null;
        var body = data && data.get ? data.get('body') : '';
        var bodyPreview = this.props.widgetFor('body');
        var tagText = listText(tags);

        return h('article', { className: 'yilia-v17-preview' },
          h('header', { className: 'yilia-v17-preview-head' },
            h('p', { className: 'yilia-v17-preview-kicker' }, 'YANCEY’S BLOG · 文章预览'),
            h('h1', null, String(title || '未命名文章')),
            date ? h('time', null, String(date)) : null,
            tagText ? h('div', { className: 'yilia-v17-preview-taxonomy' }, tagText) : null
          ),
          typeof body === 'string' && body.trim()
            ? h('div', { className: 'yilia-v17-preview-body' }, bodyPreview)
            : h('div', { className: 'yilia-v17-preview-empty' },
                h('span', { className: 'yilia-v17-preview-empty-mark', 'aria-hidden': true }, '文'),
                h('strong', null, '正文预览将在这里显示'),
                h('p', null, '开始输入 Markdown 后，右侧会同步呈现 Yilia 阅读效果。')
              )
        );
      }
    });

    var AboutPreview = createClass({
      render: function () {
        var entry = this.props.entry;
        var data = entry && entry.get ? entry.get('data') : null;
        var bio = data && data.get ? data.get('bio') : '';
        var value = typeof bio === 'string' ? bio : String(bio || '');

        return h('article', { className: 'yilia-about-preview' },
          h('p', { className: 'yilia-v17-preview-kicker' }, 'ABOUT THE AUTHOR'),
          h('h1', null, '你好，我是 Yancey。'),
          h('p', { className: 'yilia-about-preview-bio' }, value || '输入个人简介后，这里会同步显示预览。')
        );
      }
    });

    cms.registerPreviewTemplate('posts', PostPreview);
    cms.registerPreviewTemplate('about', AboutPreview);
    cms.registerPreviewStyle('/admin/admin-preview.css?v=2.0.0');
    window.__yiliaSveltiaPreviewsRegistered = true;
    return true;
  }

  function normalizeTag(value) {
    return String(value || '').normalize('NFC').trim().replace(/\s+/g, ' ');
  }

  function tagKey(value) {
    var name = normalizeTag(value);
    return /[A-Za-z]/.test(name) ? name.toLocaleLowerCase() : name;
  }

  function registerTagPicker() {
    if (window.__yiliaSveltiaTagPickerRegistered) return true;

    var TagPicker = createClass({
      getInitialState: function () {
        return { query: '', tags: [] };
      },
      componentDidMount: function () {
        var self = this;
        fetch('/content.json?tag-index=' + Date.now())
          .then(function (response) {
            if (!response.ok) throw new Error('tag index unavailable');
            return response.json();
          })
          .then(function (posts) {
            var merged = {};
            (Array.isArray(posts) ? posts : []).forEach(function (post) {
              (Array.isArray(post.tags) ? post.tags : []).forEach(function (tag) {
                var name = normalizeTag(typeof tag === 'string' ? tag : tag && tag.name);
                var key = tagKey(name);
                if (name && !merged[key]) merged[key] = name;
              });
            });
            self.setState({
              tags: Object.keys(merged)
                .map(function (key) { return merged[key]; })
                .sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); })
            });
          })
          .catch(function () {
            self.setState({ tags: [] });
          });
      },
      values: function () {
        var value = this.props.value;
        return value && value.toArray ? value.toArray() : (Array.isArray(value) ? value : []);
      },
      commit: function (values) {
        var normalized = [];
        var seen = {};
        values.forEach(function (item) {
          var name = normalizeTag(item);
          var key = tagKey(name);
          if (name && !seen[key]) {
            seen[key] = true;
            normalized.push(name);
          }
        });
        var Immutable = window.Immutable || cms.Immutable;
        var List = (Immutable && Immutable.List) || (this.props.value && this.props.value.constructor);
        this.props.onChange(List ? List(normalized) : normalized);
      },
      addTag: function (name) {
        var normalized = normalizeTag(name);
        if (!normalized) return;
        this.commit(this.values().concat([normalized]));
        this.setState({ query: '' });
      },
      render: function () {
        var self = this;
        var values = this.values();
        var query = this.state.query.trim();
        var selected = {};
        values.forEach(function (tag) {
          selected[tagKey(tag)] = true;
        });
        var suggestions = this.state.tags.filter(function (tag) {
          return !selected[tagKey(tag)]
            && (!query || tag.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) !== -1);
        }).slice(0, 16);

        return h('div', { className: 'v17-tag-picker' },
          h('div', { className: 'v17-tag-picked', 'aria-label': '已选标签' },
            values.map(function (tag, index) {
              return h('span', { className: 'v17-tag-chip', key: String(tag) + index }, String(tag),
                h('button', {
                  type: 'button',
                  'aria-label': '移除标签 ' + tag,
                  onClick: function () {
                    self.commit(values.filter(function (_, itemIndex) { return itemIndex !== index; }));
                  }
                }, '×')
              );
            })
          ),
          h('input', {
            type: 'text',
            className: 'v17-tag-search',
            value: query,
            placeholder: '搜索已有标签，或输入新标签后按 Enter 添加',
            'aria-label': '搜索或添加标签',
            onChange: function (event) {
              self.setState({ query: event.target.value });
            },
            onKeyDown: function (event) {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              self.addTag(query);
            }
          }),
          h('div', { className: 'v17-tag-suggestions', 'aria-label': '已有标签，可搜索复用' },
            suggestions.map(function (tag) {
              return h('button', {
                type: 'button',
                className: 'v17-tag-suggestion',
                key: tag,
                onClick: function () { self.addTag(tag); }
              }, tag);
            })
          ),
          h('p', { className: 'v17-tag-help' },
            '已有标签来自文章 front matter 的汇总；输入新标签并按 Enter 添加。保存后写入当前文章 Markdown 标签。')
        );
      }
    });

    cms.registerFieldType('tag_picker', TagPicker);
    window.__yiliaSveltiaTagPickerRegistered = true;
    return true;
  }

  function syncShell() {
    var workspace = document.querySelector('.admin-workspace');
    var isEditor = /#\/collections\/posts\/(new|entries\/)/.test(location.hash);
    var activeTarget = /#\/collections\/site\/entries\/about/.test(location.hash)
      ? '/admin/#/collections/site/entries/about'
      : (/#\/assets(?:\/|$)/.test(location.hash) ? '/admin/#/assets' : '/admin/#/collections/posts');
    if (workspace) workspace.classList.toggle('v17-editor-mode', isEditor);
    document.querySelectorAll('.admin-nav a').forEach(function (link) {
      link.classList.toggle('active', link.getAttribute('href') === activeTarget);
    });
    var authHeading = root.querySelector('.container > .inner > h1');
    if (authHeading && authHeading.textContent.trim() !== 'Yancey’s Blog') {
      authHeading.dataset.yiliaAuthHeading = 'true';
      authHeading.textContent = 'Yancey’s Blog';
    }
  }

  registerPreviews();
  registerTagPicker();
  cms.init();
  syncShell();

  window.addEventListener('hashchange', syncShell);
  new MutationObserver(syncShell).observe(root, { childList: true });
})();
