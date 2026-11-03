/* v1.7 Decap adapters: preserve CMS writes and use a Yilia-styled live preview. */
(function () {
  var root = document.getElementById('nc-root');
  if (!root) return;

  function text(el) { return (el && (el.innerText || el.textContent) || '').replace(/\s+/g, ' ').trim(); }
  function findLabel(name) {
    return Array.from(root.querySelectorAll('label'))
      .filter(function (el) { return text(el).replace(/\s*\(OPTIONAL\)$/i, '') === name; })[0];
  }
  function fieldFor(label) {
    var node = label;
    var candidate = null;
    while (node && node !== root && node.parentElement && node.parentElement !== root) {
      if (node.querySelector('input,textarea,[contenteditable="true"],[role="textbox"]')) candidate = node;
      var parent = node.parentElement;
      if (parent.querySelectorAll('label').length > 1) return candidate || node;
      node = parent;
    }
    return candidate || (label && label.parentElement);
  }
  function registerPreview() {
    var cms = window.CMS;
    var createClass = window.createClass || (cms && cms.createClass);
    var h = window.h || (cms && cms.h);
    if (!cms || !createClass || !h || !cms.registerPreviewTemplate || window.__yiliaV17PreviewRegistered) return false;
    var Preview = createClass({
      render: function () {
        var entry = this.props.entry;
        var data = entry && entry.get ? entry.get('data') : null;
        var title = data && data.get ? data.get('title') : '';
        var date = data && data.get ? data.get('date') : '';
        var tags = data && data.get ? data.get('tags') : null;
        var body = data && data.get ? data.get('body') : '';
        var plainBody = typeof body === 'string' ? body.trim() : '';
        /* Decap exposes the markdown body through widgetFor('body'), not entry.data.body. */
        var bodyPreview = this.props.widgetFor('body');
        function listText(value) {
          return value && value.toArray ? value.toArray().filter(Boolean).join(' · ') : (Array.isArray(value) ? value.filter(Boolean).join(' · ') : String(value || ''));
        }
        var tagText = listText(tags);
        return h('article', { className: 'yilia-v17-preview' },
          h('header', { className: 'yilia-v17-preview-head' },
            h('p', { className: 'yilia-v17-preview-kicker' }, 'YANCEY’S BLOG · 文章预览'),
            h('h1', null, String(title || '未命名文章')),
            date ? h('time', null, String(date)) : null,
            tagText ? h('div', { className: 'yilia-v17-preview-taxonomy' }, tagText) : null
          ),
          plainBody
            ? h('div', { className: 'yilia-v17-preview-body' }, bodyPreview)
            : h('div', { className: 'yilia-v17-preview-empty' },
                h('span', { className: 'yilia-v17-preview-empty-mark', 'aria-hidden': true }, '文'),
                h('strong', null, '正文预览将在这里显示'),
                h('p', null, '开始输入 Markdown 后，右侧会同步呈现 Yilia 阅读效果。')
              )
        );
      }
    });
    cms.registerPreviewTemplate('posts', Preview);
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
    cms.registerPreviewTemplate('site', AboutPreview);
    if (cms.registerPreviewStyle) cms.registerPreviewStyle('/admin/admin-preview.css?v=1.9.0');
    window.__yiliaV17PreviewRegistered = true;
    return true;
  }

  function registerTagPicker() {
    var cms = window.CMS;
    var createClass = window.createClass || (cms && cms.createClass);
    var h = window.h || (cms && cms.h);
    if (!cms || !createClass || !h || window.__yiliaTagPickerRegistered) return false;
    var TagPicker = createClass({
      getInitialState: function () { return { query: '', tags: [] }; },
      componentDidMount: function () {
        var self = this;
        fetch('/content.json?tag-index=' + Date.now()).then(function (response) {
          if (!response.ok) throw new Error('tag index unavailable');
          return response.json();
        }).then(function (posts) {
          var merged = {};
          (Array.isArray(posts) ? posts : []).forEach(function (post) {
            (Array.isArray(post.tags) ? post.tags : []).forEach(function (tag) {
              var name = String(typeof tag === 'string' ? tag : tag && tag.name || '').normalize('NFC').trim().replace(/\s+/g, ' ');
              if (!name) return;
              var key = /[A-Za-z]/.test(name) ? name.toLocaleLowerCase() : name;
              if (!merged[key]) merged[key] = name;
            });
          });
          self.setState({ tags: Object.keys(merged).map(function (key) { return merged[key]; }).sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); }) });
        }).catch(function () { self.setState({ tags: [] }); });
      },
      getValues: function () {
        var value = this.props.value;
        return value && value.toArray ? value.toArray() : (Array.isArray(value) ? value : []);
      },
      commit: function (values) {
        var normalized = [];
        var seen = {};
        values.forEach(function (item) {
          var name = String(item || '').normalize('NFC').trim().replace(/\s+/g, ' ');
          var key = /[A-Za-z]/.test(name) ? name.toLocaleLowerCase() : name;
          if (name && !seen[key]) { seen[key] = true; normalized.push(name); }
        });
        var Immutable = window.Immutable || (window.CMS && window.CMS.Immutable);
        var List = (Immutable && Immutable.List) || (this.props.value && this.props.value.constructor);
        this.props.onChange(List ? List(normalized) : normalized);
      },
      addTag: function (name) {
        var values = this.getValues();
        var normalized = String(name || '').trim();
        if (!normalized) return;
        this.commit(values.concat([normalized]));
        this.setState({ query: '' });
      },
      render: function () {
        var self = this;
        var values = this.getValues();
        var query = this.state.query.trim();
        var selected = {};
        values.forEach(function (item) {
          var name = String(item || '').normalize('NFC').trim().replace(/\s+/g, ' ');
          selected[/[A-Za-z]/.test(name) ? name.toLocaleLowerCase() : name] = true;
        });
        var suggestions = this.state.tags.filter(function (tag) {
          var tagKey = /[A-Za-z]/.test(tag) ? tag.toLocaleLowerCase() : tag;
          return !selected[tagKey] && (!query || tag.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) !== -1);
        }).slice(0, 16);
        return h('div', { className: 'v17-tag-picker' },
          h('div', { className: 'v17-tag-picked', 'aria-label': '已选标签' }, values.map(function (tag, index) {
            return h('span', { className: 'v17-tag-chip', key: String(tag) + index }, String(tag),
              h('button', { type: 'button', 'aria-label': '移除标签 ' + tag, onClick: function () { self.commit(values.filter(function (_, i) { return i !== index; })); } }, '×'));
          })),
          h('input', { type: 'text', className: 'v17-tag-search', value: query, placeholder: '搜索已有标签，或输入新标签后按 Enter 添加', 'aria-label': '搜索或添加标签', onChange: function (event) { self.setState({ query: event.target.value }); }, onKeyDown: function (event) { if (event.key === 'Enter') { event.preventDefault(); self.addTag(query); } } }),
          h('div', { className: 'v17-tag-suggestions', 'aria-label': '已有标签，可搜索复用' }, suggestions.map(function (tag) {
            return h('button', { type: 'button', className: 'v17-tag-suggestion', key: tag, onClick: function () { self.addTag(tag); } }, tag);
          })),
          h('p', { className: 'v17-tag-help' }, '已有标签来自文章 front matter 的汇总；输入新标签并按 Enter 添加。保存后写入当前文章 Markdown 标签。'));
      }
    });
    cms.registerWidget('tag_picker', TagPicker);
    window.__yiliaTagPickerRegistered = true;
    return true;
  }
  function decorate() {
    var workspace = document.querySelector('.admin-workspace');
    var isEditor = /#\/collections\/posts\/(new|entries\/)/.test(location.hash);
    if (workspace) workspace.classList.toggle('v17-editor-mode', isEditor);
    document.querySelectorAll('.admin-nav a').forEach(function (link) {
      var aboutActive = /#\/collections\/site\/entries\/about/.test(location.hash);
      link.classList.toggle('active', aboutActive ? /collections\/site\/entries\/about/.test(link.href) : /collections\/posts/.test(link.href));
    });
    var bioLabel = findLabel('个人简介');
    var bioField = fieldFor(bioLabel);
    if (bioField) {
      bioField.classList.add('v17-about-field');
      var bioInput = bioField.querySelector('textarea');
      if (bioInput) {
        bioInput.maxLength = 100;
        var counter = bioField.querySelector('.v17-about-count');
        if (!counter) {
          counter = document.createElement('div');
          counter.className = 'v17-about-count';
          bioInput.insertAdjacentElement('afterend', counter);
        }
        counter.textContent = Array.from(bioInput.value || '').length + ' / 100';
        counter.classList.toggle('limit', Array.from(bioInput.value || '').length >= 90);
      }
    }
    if (!root.__v17AboutCounterBound) {
      root.__v17AboutCounterBound = true;
      root.addEventListener('input', function (event) {
        if (!event.target.matches('.v17-about-field textarea')) return;
        var counter = event.target.parentElement.querySelector('.v17-about-count') || event.target.closest('.v17-about-field').querySelector('.v17-about-count');
        if (counter) {
          counter.textContent = Array.from(event.target.value || '').length + ' / 100';
          counter.classList.toggle('limit', Array.from(event.target.value || '').length >= 90);
        }
      });
    }


    var publish = Array.from(root.querySelectorAll('button')).find(function (button) { return /^(publish|published|draft)\b/i.test(text(button)); });
    if (publish) { publish.classList.add('v17-publish-action'); publish.setAttribute('aria-label', '发布更新'); }

    var writingText = Array.from(root.querySelectorAll('*')).find(function (el) {
      return el.children.length === 0 && /文章 › (新建文章|编辑文章)|Writing in 文章 collection/i.test(text(el));
    });
    if (writingText && publish) {
      var toolbar = writingText;
      while (toolbar.parentElement && toolbar.parentElement !== root && !toolbar.parentElement.contains(publish)) toolbar = toolbar.parentElement;
      if (toolbar !== root && toolbar.contains(publish)) toolbar.classList.add('v17-entry-toolbar');
    }

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var textNode;
    while ((textNode = walker.nextNode())) {
      if (/Writing in 文章 collection/i.test(textNode.nodeValue)) {
        textNode.nodeValue = textNode.nodeValue.replace(/Writing in 文章 collection/i, isEditor && /\/new(?:$|\?)/.test(location.hash) ? '文章 › 新建文章' : '文章 › 编辑文章');
      }
    }

    var names = ['标题', '发布日期', '标签'];
    var fields = names.map(function (name) { var label = findLabel(name); var field = fieldFor(label); if (field) field.classList.add('v17-meta-field'); return field; }).filter(Boolean);
    if (fields.length === 3) {
      var common = fields[0];
      while (common && !fields.every(function (field) { return common.contains(field); })) common = common.parentElement;
      if (common && common !== root) {
        common.classList.add('v17-meta-grid');
        fields.forEach(function (field) { field.classList.add('v17-meta-field'); });
      }
    }
    var bodyLabel = findLabel('正文');
    var bodyField = fieldFor(bodyLabel);
    if (bodyField) bodyField.classList.add('v17-body-field');

    var editorToolbar = root.querySelector('.v17-entry-toolbar');
    if (editorToolbar) {
      var mobileTabs = editorToolbar.querySelector('.v17-mobile-preview-tabs');
      if (!mobileTabs) {
        var previewToggle = Array.from(root.querySelectorAll('button')).find(function (button) {
          return /toggle preview/i.test((button.getAttribute('aria-label') || '') + ' ' + (button.getAttribute('title') || '') + ' ' + text(button));
        });
        if (previewToggle) {
          previewToggle.classList.add('v17-native-preview-toggle');
          mobileTabs = document.createElement('div');
          mobileTabs.className = 'v17-mobile-preview-tabs';
          mobileTabs.setAttribute('role', 'tablist');
          mobileTabs.setAttribute('aria-label', '编辑和预览');
          ['edit', 'preview'].forEach(function (view) {
            var tab = document.createElement('button');
            tab.type = 'button';
            tab.dataset.v17View = view;
            tab.setAttribute('role', 'tab');
            tab.textContent = view === 'edit' ? '编辑' : '预览';
            tab.addEventListener('click', function () {
              var isOpen = Boolean(root.querySelector('iframe') && root.querySelector('iframe').getClientRects().length);
              var wantOpen = view === 'preview';
              if (isOpen !== wantOpen) previewToggle.click();
              mobileTabs.dataset.activeView = view;
              Array.from(mobileTabs.querySelectorAll('button')).forEach(function (item) {
                var active = item === tab;
                item.classList.toggle('active', active);
                item.setAttribute('aria-selected', active ? 'true' : 'false');
              });
            });
            mobileTabs.appendChild(tab);
          });
          editorToolbar.appendChild(mobileTabs);
        }
      }
      if (mobileTabs && window.matchMedia('(max-width: 800px)').matches) {
        var frame = root.querySelector('iframe');
        if (!mobileTabs.dataset.initialized && frame) {
          mobileTabs.dataset.activeView = 'edit';
          mobileTabs.dataset.initialized = 'true';
          if (frame.getClientRects().length) {
          var toggle = Array.from(root.querySelectorAll('button')).find(function (button) {
            return /toggle preview/i.test((button.getAttribute('aria-label') || '') + ' ' + (button.getAttribute('title') || '') + ' ' + text(button));
          });
          if (toggle) toggle.click();
          }
        }
        if (!mobileTabs.dataset.activeView) mobileTabs.dataset.activeView = 'edit';
        Array.from(mobileTabs.querySelectorAll('button')).forEach(function (item) {
          var active = item.dataset.v17View === mobileTabs.dataset.activeView;
          item.classList.toggle('active', active);
          item.setAttribute('aria-selected', active ? 'true' : 'false');
        });
      }
    }

  }

  var observer = new MutationObserver(decorate);
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  window.addEventListener('hashchange', decorate);
  if (!registerPreview()) {
    var previewAttempts = 0;
    var previewRetry = window.setInterval(function () {
      previewAttempts += 1;
      registerTagPicker();
      if (registerPreview() || previewAttempts >= 40) window.clearInterval(previewRetry);
    }, 100);
  }
  registerTagPicker();
  decorate();
})();
