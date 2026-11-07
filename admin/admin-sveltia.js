import * as SveltiaModule from './vendor/sveltia-cms-0.261.0/npm/index.js';

/* Sveltia adapters: Yilia previews, tag reuse, and the surrounding admin shell. */
(function () {
  var root = document.getElementById('nc-root');
  if (!root) return;
  var workspace = document.getElementById('admin-workspace');
  var workspaceToggle = document.getElementById('workspace-toggle');
  var adminScrim = document.getElementById('admin-scrim');
  var compactSidebarQuery = window.matchMedia('(max-width: 1050px)');
  var mobileSidebarQuery = window.matchMedia('(max-width: 800px)');
  var sidebarPreference = null;
  var sidebarStorageKey = 'yilia-admin-sidebar-collapsed-v3';

  try {
    sidebarPreference = window.localStorage.getItem(sidebarStorageKey);
  } catch (error) {
    sidebarPreference = null;
  }

  function syncWorkspaceToggle() {
    if (!workspace || !workspaceToggle) return;
    var mobile = mobileSidebarQuery.matches;
    var open = mobile
      ? workspace.classList.contains('mobile-sidebar-open')
      : !workspace.classList.contains('is-sidebar-collapsed');
    workspaceToggle.setAttribute('aria-expanded', String(open));
    workspaceToggle.setAttribute('aria-label', mobile
      ? (open ? '关闭导航' : '打开导航')
      : (open ? '收起侧边栏' : '展开侧边栏'));
    workspaceToggle.dataset.tooltip = mobile
      ? (open ? '关闭导航' : '打开导航')
      : (open ? '收起侧栏  ⌘ \\' : '展开侧栏  ⌘ \\');
    if (adminScrim) adminScrim.hidden = !(mobile && open);
  }

  function setSidebarCollapsed(collapsed, persist) {
    if (!workspace) return;
    workspace.classList.toggle('is-sidebar-collapsed', collapsed);
    workspace.classList.remove('mobile-sidebar-open');
    if (persist) {
      sidebarPreference = collapsed ? 'collapsed' : 'expanded';
      try {
        window.localStorage.setItem(sidebarStorageKey, sidebarPreference);
      } catch (error) {
        // The layout still works when browser storage is unavailable.
      }
    }
    syncWorkspaceToggle();
  }

  function setMobileSidebar(open) {
    if (!workspace) return;
    workspace.classList.toggle('mobile-sidebar-open', open);
    syncWorkspaceToggle();
  }

  var initialCollapsed = sidebarPreference === 'collapsed'
    || (sidebarPreference === null && compactSidebarQuery.matches && !mobileSidebarQuery.matches);
  setSidebarCollapsed(initialCollapsed, false);

  if (workspaceToggle) {
    workspaceToggle.addEventListener('click', function () {
      if (!workspace) return;
      if (mobileSidebarQuery.matches) {
        setMobileSidebar(!workspace.classList.contains('mobile-sidebar-open'));
      } else {
        setSidebarCollapsed(!workspace.classList.contains('is-sidebar-collapsed'), true);
      }
    });
  }
  if (adminScrim) adminScrim.addEventListener('click', function () { setMobileSidebar(false); });
  mobileSidebarQuery.addEventListener('change', function () {
    setMobileSidebar(false);
  });
  compactSidebarQuery.addEventListener('change', function (event) {
    if (sidebarPreference === null && !mobileSidebarQuery.matches) {
      setSidebarCollapsed(event.matches, false);
    } else {
      syncWorkspaceToggle();
    }
  });
  document.querySelectorAll('.admin-nav a, .foot-link').forEach(function (link) {
    link.addEventListener('click', function () {
      if (mobileSidebarQuery.matches) setMobileSidebar(false);
    });
  });
  window.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && workspace?.classList.contains('mobile-sidebar-open')) {
      setMobileSidebar(false);
      workspaceToggle?.focus();
    }
    if ((event.metaKey || event.ctrlKey) && event.key === '\\' && !mobileSidebarQuery.matches) {
      event.preventDefault();
      setSidebarCollapsed(!workspace.classList.contains('is-sidebar-collapsed'), true);
    }
  });

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

  function ensureTagDatalist() {
    var datalist = document.getElementById('yilia-tag-suggestions');
    if (!datalist) {
      datalist = document.createElement('datalist');
      datalist.id = 'yilia-tag-suggestions';
      root.appendChild(datalist);
    }
    return datalist;
  }

  function enhanceTagFields() {
    var datalist = ensureTagDatalist();
    root.querySelectorAll('[data-field-type="list"][data-key-path="tags"] input').forEach(function (input) {
      if (input.getAttribute('list') !== datalist.id) input.setAttribute('list', datalist.id);
      if (!input.placeholder) input.placeholder = '输入标签，或从已有标签中选择';
    });
    window.__yiliaTagAutocompleteReady = true;
  }

  function renderTagOptions(tags) {
    var datalist = ensureTagDatalist();
    datalist.textContent = '';
    tags.forEach(function (tag) {
      var option = document.createElement('option');
      option.value = tag;
      datalist.appendChild(option);
    });
    enhanceTagFields();
  }

  function loadTagOptions() {
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
        renderTagOptions(Object.keys(merged)
          .map(function (key) { return merged[key]; })
          .sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); }));
      })
      .catch(function () {
        renderTagOptions([]);
      });
  }

  function applyEditorView(editor, view) {
    var nextView = ['edit', 'split', 'preview'].includes(view) ? view : 'split';
    editor.dataset.yiliaView = nextView;
    var picker = editor.querySelector('.yilia-view-switch');
    if (picker) {
      picker.querySelectorAll('[data-yilia-view]').forEach(function (button) {
        var active = button.dataset.yiliaView === nextView;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    }
    var panes = editor.querySelectorAll('.content-area .pane[data-mode]');
    if (panes.length === 1) {
      var pane = panes[0];
      var desiredMode = nextView === 'preview' ? 'preview' : 'edit';
      if (pane.dataset.mode !== desiredMode) {
        var previewToggle = pane.querySelector('.header button[aria-label="预览"]');
        previewToggle?.click();
      }
    }
    try {
      window.localStorage.setItem('yilia-admin-editor-view', nextView);
    } catch (error) {
      // The view still works when browser storage is unavailable.
    }
  }

  function decorateEditorTitle(toolbarInner) {
    var title = toolbarInner.querySelector(':scope > h2');
    if (!title) return;

    var isEntryTitle = Boolean(title.querySelector('bdi'));
    title.classList.toggle('is-entry-title', isEntryTitle);
    if (isEntryTitle) {
      title.classList.remove('is-new-entry');
      delete title.dataset.yiliaNewEntry;
      return;
    }

    var normalized = title.textContent.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim();
    var isNewEntry = title.dataset.yiliaNewEntry === 'true' || /^创建\s*文章/.test(normalized);
    title.classList.toggle('is-new-entry', isNewEntry);
    if (!isNewEntry) return;

    title.dataset.yiliaNewEntry = 'true';
    var text = title.querySelector('.truncated-text');
    if (text && text.textContent.trim() !== '新建文章') {
      text.textContent = '新建文章';
    }
  }

  function ensureMobileTitle(toolbarInner) {
    var title = toolbarInner.querySelector(':scope > .yilia-mobile-title');
    if (!title) {
      title = document.createElement('span');
      title.className = 'yilia-mobile-title';
      title.setAttribute('aria-hidden', 'true');
      toolbarInner.appendChild(title);
    }
    var documentTitle = document.title.split('–')[0]
      .replace(/[\u2066-\u2069]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    var label = /^创建\s*文章$/.test(documentTitle)
      ? '新建文章'
      : documentTitle.split('›').pop().trim();
    if (title.textContent !== label) title.textContent = label;
  }

  function ensureSaveState(toolbarInner, saveButton) {
    var state = toolbarInner.querySelector(':scope > .yilia-save-state');
    if (!saveButton) {
      state?.remove();
      return;
    }
    if (!state) {
      state = document.createElement('span');
      state.className = 'yilia-save-state';
      state.setAttribute('role', 'status');
      toolbarInner.insertBefore(state, saveButton);
    }
    var dirty = !saveButton.disabled;
    var nextState = dirty ? 'dirty' : 'saved';
    var nextLabel = dirty ? '待保存' : '已保存';
    if (state.dataset.state !== nextState) state.dataset.state = nextState;
    if (state.textContent !== nextLabel) state.textContent = nextLabel;
  }

  function decoratePaneHeaders(editPane, previewPane) {
    var editHeading = editPane?.querySelector('.header .sui.toolbar h3');
    if (editHeading && editHeading.textContent.trim() !== '编辑') {
      editHeading.textContent = '编辑';
    }

    var previewHeading = previewPane?.querySelector('.header .sui.toolbar h3');
    if (previewHeading && previewHeading.textContent.trim() !== '实时预览') {
      previewHeading.textContent = '实时预览';
    }

    var previewToolbar = previewPane?.querySelector('.header .sui.toolbar > .inner');
    if (previewToolbar && !previewToolbar.querySelector(':scope > .yilia-preview-size')) {
      var note = document.createElement('small');
      note.className = 'yilia-preview-size';
      note.textContent = '桌面阅读宽度';
      previewToolbar.appendChild(note);
    }
  }

  function closePanelDrawer(editor) {
    editor.classList.remove('yilia-panel-drawer-open');
  }

  function openPanelDrawer(editor, label) {
    var button = Array.from(editor.querySelectorAll('.sidebar .tabs button'))
      .find(function (item) {
        return item.getAttribute('aria-label') === label && !item.disabled;
      });
    if (!button) return;

    editor.classList.add('yilia-panel-drawer-open');
    if (button.getAttribute('aria-checked') !== 'true') button.click();
  }

  function decorateEditorMenu(editor, toolbarInner) {
    var menu = document.querySelector('[role="menu"][aria-label="编辑器选项"]');
    if (!menu || menu.querySelector(':scope > .yilia-panel-menu')) return;

    var tabs = Array.from(editor.querySelectorAll('.sidebar .tabs button'))
      .filter(function (button) { return !button.disabled; });
    if (!tabs.length) return;

    var panelMenu = document.createElement('div');
    panelMenu.className = 'yilia-panel-menu';
    var heading = document.createElement('span');
    heading.textContent = '内容面板';
    panelMenu.appendChild(heading);

    tabs.forEach(function (tab) {
      var item = document.createElement('button');
      var label = tab.getAttribute('aria-label') || '内容面板';
      item.type = 'button';
      item.setAttribute('role', 'menuitem');
      item.textContent = label;
      item.addEventListener('click', function () {
        openPanelDrawer(editor, label);
        window.setTimeout(function () {
          var trigger = toolbarInner.querySelector(':scope > button[aria-label="显示编辑器选项"]');
          if (trigger && trigger.getAttribute('aria-expanded') === 'true') trigger.click();
        }, 0);
      });
      panelMenu.appendChild(item);
    });

    menu.appendChild(panelMenu);
  }

  function yamlString(value) {
    return JSON.stringify(String(value || '').normalize('NFC').replace(/\r\n?/g, '\n'));
  }

  function safeFilename(value) {
    var name = String(value || '')
      .normalize('NFC')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/[. ]+$/g, '')
      .trim()
      .slice(0, 120);
    return name || '未命名文章';
  }

  function currentBackupFilename(editor, title) {
    var match = location.hash.match(/\/entries\/([^/?#]+)/);
    if (match) {
      try {
        var routeName = decodeURIComponent(match[1]).replace(/\.md$/i, '');
        if (routeName) return safeFilename(routeName) + '.md';
      } catch (error) {
        // Fall back to the title when the route cannot be decoded.
      }
    }
    if (editor.dataset.yiliaBackupFilename) return editor.dataset.yiliaBackupFilename;
    return safeFilename(title) + '.md';
  }

  function normalizedDate(value) {
    var raw = String(value || '').trim();
    var match = raw.match(/^(\d{4})[-/](\d{2})[-/](\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return raw;
    return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] || '00'}`;
  }

  function serializeCurrentMarkdown(editor) {
    var editPane = editor.querySelector('.content-area .pane[data-mode="edit"]');
    var titleInput = editPane?.querySelector('[data-key-path="title"] input');
    var dateInput = editPane?.querySelector('[data-key-path="date"] input');
    var bodyInput = editPane?.querySelector('[data-key-path="body"] textarea');

    if (!titleInput || !bodyInput) {
      throw new Error('当前编辑视图无法读取 Markdown 内容');
    }

    var title = titleInput.value.trim();
    if (!title) throw new Error('请先填写文章标题');

    var tags = [];
    var seenTags = new Set();
    editPane.querySelectorAll('[data-key-path="tags"] section[data-key-path^="tags."] input').forEach(function (input) {
      var name = input.value.normalize('NFC').trim().replace(/\s+/g, ' ');
      var key = /[A-Za-z]/.test(name) ? name.toLocaleLowerCase() : name;
      if (!name || seenTags.has(key)) return;
      seenTags.add(key);
      tags.push(name);
    });

    var frontmatter = ['---', `title: ${yamlString(title)}`];
    var date = normalizedDate(dateInput?.value);
    if (date) frontmatter.push(`date: ${date}`);
    if (tags.length) {
      frontmatter.push('tags:');
      tags.forEach(function (tag) {
        frontmatter.push(`  - ${yamlString(tag)}`);
      });
    }
    frontmatter.push('---', '');

    var body = bodyInput.value.replace(/\r\n?/g, '\n');
    if (!body.endsWith('\n')) body += '\n';
    return {
      filename: currentBackupFilename(editor, title),
      markdown: `${frontmatter.join('\n')}\n${body}`
    };
  }

  function setLocalSaveState(button, state, label) {
    var text = button.querySelector('.yilia-local-save-label');
    if (text) text.textContent = label;
    button.dataset.state = state;
  }

  async function saveCurrentMarkdown(editor, button) {
    var payload;
    try {
      payload = serializeCurrentMarkdown(editor);
    } catch (error) {
      setLocalSaveState(button, 'error', '无法保存');
      window.setTimeout(function () { setLocalSaveState(button, '', '保存到本地'); }, 2200);
      return;
    }

    button.disabled = true;
    try {
      if (typeof window.showSaveFilePicker === 'function') {
        var handle = await window.showSaveFilePicker({
          suggestedName: payload.filename,
          types: [{
            description: 'Markdown',
            accept: { 'text/markdown': ['.md'] }
          }]
        });
        var writable = await handle.createWritable();
        await writable.write(new Blob([payload.markdown], { type: 'text/markdown;charset=utf-8' }));
        await writable.close();
        setLocalSaveState(button, 'success', '已保存');
      } else {
        var url = URL.createObjectURL(new Blob([payload.markdown], { type: 'text/markdown;charset=utf-8' }));
        var link = document.createElement('a');
        link.href = url;
        link.download = payload.filename;
        link.click();
        window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        setLocalSaveState(button, 'success', '已下载');
      }
      window.setTimeout(function () { setLocalSaveState(button, '', '保存到本地'); }, 2200);
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.error('Local Markdown save failed', error);
        setLocalSaveState(button, 'error', '保存失败');
        window.setTimeout(function () { setLocalSaveState(button, '', '保存到本地'); }, 2200);
      }
    } finally {
      button.disabled = false;
    }
  }

  function ensureLocalSaveButton(editor, toolbarInner, saveButton) {
    var button = toolbarInner.querySelector(':scope > .yilia-local-save');
    if (!saveButton) {
      button?.remove();
      return;
    }
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'yilia-local-save';
      button.setAttribute('aria-label', '保存当前文章到本地');
      button.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 4v10"></path>
          <path d="m8 10 4 4 4-4"></path>
          <path d="M5 19h14"></path>
        </svg>
        <span class="yilia-local-save-label">保存到本地</span>
      `;
      button.addEventListener('click', function () {
        saveCurrentMarkdown(editor, button);
      });
    }
    if (button.previousElementSibling !== saveButton) {
      saveButton.insertAdjacentElement('afterend', button);
    }
  }

  var MEDIA_API = 'https://auth.aiyancey.com/media';
  var mediaState = {
    items: null,
    query: '',
    loading: false,
    mode: 'page',
    returnFocus: null
  };

  function formatMediaSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '未知大小';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function mediaLibraryElements() {
    var panel = document.getElementById('yilia-media-library');
    return panel ? {
      panel: panel,
      status: panel.querySelector('.yilia-media-status'),
      grid: panel.querySelector('.yilia-media-grid'),
      search: panel.querySelector('.yilia-media-search'),
      upload: panel.querySelector('.yilia-media-file'),
      close: panel.querySelector('.yilia-media-close')
    } : null;
  }

  function setMediaStatus(message, state) {
    var elements = mediaLibraryElements();
    if (!elements) return;
    elements.status.textContent = message;
    elements.status.dataset.state = state || '';
  }

  function renderMediaItems() {
    var elements = mediaLibraryElements();
    if (!elements || !mediaState.items) return;
    var query = mediaState.query.trim().toLocaleLowerCase();
    var items = mediaState.items.filter(function (item) {
      return !query || item.name.toLocaleLowerCase().includes(query);
    });
    elements.grid.textContent = '';

    if (!items.length) {
      var empty = document.createElement('div');
      empty.className = 'yilia-media-empty';
      empty.innerHTML = '<strong>图片库还是空的</strong><span>上传第一张图片后，这里会显示 jsDelivr 地址。</span>';
      elements.grid.appendChild(empty);
      return;
    }

    items.forEach(function (item) {
      var card = document.createElement('article');
      card.className = 'yilia-media-card';
      card.dataset.mediaPath = item.path;

      var preview = document.createElement('a');
      preview.className = 'yilia-media-preview';
      preview.href = item.url;
      preview.target = '_blank';
      preview.rel = 'noopener';
      var image = document.createElement('img');
      image.src = item.url;
      image.alt = item.name;
      image.loading = 'lazy';
      image.decoding = 'async';
      preview.appendChild(image);

      var meta = document.createElement('div');
      meta.className = 'yilia-media-meta';
      var name = document.createElement('strong');
      name.textContent = item.name;
      name.title = item.name;
      var size = document.createElement('span');
      size.textContent = formatMediaSize(item.size);
      meta.append(name, size);

      var actions = document.createElement('div');
      actions.className = 'yilia-media-actions';
      var copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.textContent = '复制 URL';
      copyButton.addEventListener('click', function () {
        copyMediaUrl(item.url, copyButton);
      });
      actions.appendChild(copyButton);

      if (mediaState.mode === 'editor') {
        var insertButton = document.createElement('button');
        insertButton.type = 'button';
        insertButton.className = 'is-primary';
        insertButton.textContent = '插入正文';
        insertButton.addEventListener('click', function () {
          insertMediaMarkdown(item);
        });
        actions.appendChild(insertButton);
      }

      var deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'is-danger';
      deleteButton.textContent = '删除';
      deleteButton.addEventListener('click', function () {
        deleteMedia(item, deleteButton);
      });
      actions.appendChild(deleteButton);

      card.append(preview, meta, actions);
      elements.grid.appendChild(card);
    });
  }

  async function copyText(value) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    var input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
  }

  async function copyMediaUrl(url, button) {
    try {
      await copyText(url);
      var previous = button.textContent;
      button.textContent = '已复制';
      window.setTimeout(function () { button.textContent = previous; }, 1400);
    } catch (error) {
      setMediaStatus('复制失败，请打开图片后从地址栏复制。', 'error');
    }
  }

  function insertMediaMarkdown(item) {
    var textarea = root.querySelector('.content-editor [data-key-path="body"] textarea');
    if (!textarea) {
      copyMediaUrl(item.url);
      setMediaStatus('当前视图未找到 Markdown 输入框，URL 已复制。', 'warning');
      return;
    }
    var markdown = '![' + item.name.replace(/[\[\]]/g, '') + '](' + item.url + ')';
    var start = textarea.selectionStart ?? textarea.value.length;
    var end = textarea.selectionEnd ?? start;
    var prefix = start > 0 && textarea.value[start - 1] !== '\n' ? '\n\n' : '';
    var suffix = textarea.value[end] === '\n' ? '\n' : '\n\n';
    textarea.setRangeText(prefix + markdown + suffix, start, end, 'end');
    textarea.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: markdown }));
    textarea.focus();
    closeMediaLibrary();
    setMediaStatus('已插入正文。', 'success');
  }

  async function loadMedia(force) {
    if (mediaState.loading || (mediaState.items && !force)) return;
    mediaState.loading = true;
    setMediaStatus('正在读取 imagesforblogs…', 'loading');
    try {
      var response = await nativeFetch(MEDIA_API + '?t=' + Date.now(), {
        credentials: 'include',
        cache: 'no-store'
      });
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        throw new Error(payload.error || ('HTTP ' + response.status));
      }
      mediaState.items = Array.isArray(payload.items) ? payload.items : [];
      setMediaStatus(mediaState.items.length + ' 张图片 · 全部通过 jsDelivr 分发', 'success');
      renderMediaItems();
    } catch (error) {
      mediaState.items = [];
      var message = /login|unauthorized|owner/i.test(error.message)
        ? '请先在文章页完成 GitHub 登录，再打开媒体库。'
        : '媒体库读取失败：' + error.message;
      setMediaStatus(message, 'error');
      renderMediaItems();
    } finally {
      mediaState.loading = false;
    }
  }

  async function uploadMedia(files) {
    var accepted = Array.from(files || []);
    if (!accepted.length) return;
    setMediaStatus('正在上传 ' + accepted.length + ' 张图片…', 'loading');
    var failures = [];
    for (var file of accepted) {
      var body = new FormData();
      body.append('file', file);
      try {
        var response = await nativeFetch(MEDIA_API, {
          method: 'POST',
          credentials: 'include',
          body: body
        });
        var payload = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(payload.error || ('HTTP ' + response.status));
      } catch (error) {
        failures.push(file.name + '：' + error.message);
      }
    }
    await loadMedia(true);
    setMediaStatus(
      failures.length
        ? failures.length + ' 张上传失败 · ' + failures[0]
        : accepted.length + ' 张图片已上传到 imagesforblogs',
      failures.length ? 'error' : 'success'
    );
  }

  async function deleteMedia(item, button) {
    if (!window.confirm('确认从 imagesforblogs 删除“' + item.name + '”？线上引用会失效。')) return;
    button.disabled = true;
    try {
      var response = await nativeFetch(
        MEDIA_API + '?path=' + encodeURIComponent(item.path),
        { method: 'DELETE', credentials: 'include' }
      );
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(payload.error || ('HTTP ' + response.status));
      mediaState.items = (mediaState.items || []).filter(function (entry) {
        return entry.path !== item.path;
      });
      setMediaStatus('已删除 ' + item.name, 'success');
      renderMediaItems();
    } catch (error) {
      setMediaStatus('删除失败：' + error.message, 'error');
      button.disabled = false;
    }
  }

  function ensureMediaLibrary() {
    var panel = document.getElementById('yilia-media-library');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'yilia-media-library';
    panel.className = 'yilia-media-library';
    panel.hidden = true;
    panel.setAttribute('aria-label', '图床媒体库');
    panel.innerHTML = `
      <div class="yilia-media-shell">
        <header class="yilia-media-head">
          <div>
            <p>IMAGESFORBLOGS · JSDELIVR</p>
            <h1>媒体库</h1>
            <span>图片统一存入独立图床仓库，公开地址固定使用 jsDelivr。</span>
          </div>
          <button class="yilia-media-close" type="button" aria-label="关闭媒体库">关闭</button>
        </header>
        <div class="yilia-media-toolbar">
          <label class="yilia-media-upload">
            <input class="yilia-media-file" type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif" multiple>
            <span>上传图片</span>
          </label>
          <label class="yilia-media-search-wrap">
            <span>搜索</span>
            <input class="yilia-media-search" type="search" placeholder="按文件名筛选">
          </label>
          <button class="yilia-media-refresh" type="button">刷新</button>
        </div>
        <p class="yilia-media-status" role="status">正在准备媒体库…</p>
        <div class="yilia-media-grid" aria-live="polite"></div>
      </div>
    `;
    (workspace || root).appendChild(panel);

    var elements = mediaLibraryElements();
    elements.close.addEventListener('click', closeMediaLibrary);
    elements.upload.addEventListener('change', function () {
      uploadMedia(elements.upload.files);
      elements.upload.value = '';
    });
    elements.search.addEventListener('input', function () {
      mediaState.query = elements.search.value;
      renderMediaItems();
    });
    panel.querySelector('.yilia-media-refresh').addEventListener('click', function () {
      loadMedia(true);
    });
    panel.addEventListener('dragover', function (event) {
      event.preventDefault();
      panel.classList.add('is-dragging');
    });
    panel.addEventListener('dragleave', function (event) {
      if (!panel.contains(event.relatedTarget)) panel.classList.remove('is-dragging');
    });
    panel.addEventListener('drop', function (event) {
      event.preventDefault();
      panel.classList.remove('is-dragging');
      uploadMedia(event.dataTransfer?.files);
    });
    return panel;
  }

  function openMediaLibrary(mode) {
    var panel = ensureMediaLibrary();
    mediaState.mode = mode;
    mediaState.returnFocus = document.activeElement;
    panel.hidden = false;
    panel.dataset.mode = mode;
    workspace?.classList.add('yilia-media-mode');
    mediaLibraryElements().close.hidden = mode === 'page';
    renderMediaItems();
    loadMedia(false);
    mediaLibraryElements().search.focus();
  }

  function closeMediaLibrary() {
    var panel = document.getElementById('yilia-media-library');
    if (!panel) return;
    panel.hidden = true;
    panel.classList.remove('is-dragging');
    workspace?.classList.remove('yilia-media-mode');
    if (mediaState.returnFocus?.focus) mediaState.returnFocus.focus();
    mediaState.mode = 'page';
  }

  function syncMediaLibraryRoute() {
    ensureMediaLibrary();
    if (/#\/assets(?:\/|$)/.test(location.hash)) {
      if (mediaState.mode !== 'editor' || document.getElementById('yilia-media-library').hidden) {
        openMediaLibrary('page');
      }
    } else if (mediaState.mode === 'page') {
      closeMediaLibrary();
    }
  }

  function ensureMediaButton(toolbarInner, saveButton) {
    var button = toolbarInner.querySelector(':scope > .yilia-media-open');
    if (!saveButton) {
      button?.remove();
      return;
    }
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'yilia-media-open';
      button.setAttribute('aria-label', '打开 jsDelivr 图床媒体库');
      button.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="14" rx="2"></rect>
          <circle cx="8.5" cy="9.5" r="1.4"></circle>
          <path d="m5.5 16 4-4.2 3.2 3 2.4-2.6 3.4 3.8"></path>
        </svg>
        <span>媒体库</span>
      `;
      button.addEventListener('click', function () {
        openMediaLibrary('editor');
      });
    }
    var localSave = toolbarInner.querySelector(':scope > .yilia-local-save');
    if (localSave) {
      if (localSave.previousElementSibling !== saveButton) saveButton.after(localSave);
      if (button.previousElementSibling !== localSave) localSave.after(button);
    } else if (button.previousElementSibling !== saveButton) {
      saveButton.after(button);
    }
  }

  function enhanceEditorChrome() {
    var editor = root.querySelector('.wrapper.content-editor');
    if (!editor) return;
    var toolbar = editor.querySelector(':scope > .sui.toolbar.primary');
    var editPane = editor.querySelector('.content-area .pane[data-mode="edit"]');
    var previewPane = editor.querySelector('.content-area .pane[data-mode="preview"]');
    var toolbarInner = toolbar && (toolbar.querySelector(':scope > .inner') || toolbar);
    var picker = toolbarInner && toolbarInner.querySelector(':scope > .yilia-view-switch');

    if (!toolbar || (!editPane && !previewPane)) {
      picker?.remove();
      delete editor.dataset.yiliaView;
      closePanelDrawer(editor);
      return;
    }

    decorateEditorTitle(toolbarInner);
    ensureMobileTitle(toolbarInner);

    if (!picker) {
      picker = document.createElement('div');
      picker.className = 'yilia-view-switch';
      picker.setAttribute('role', 'group');
      picker.setAttribute('aria-label', '编辑视图');
      [
        ['edit', '编辑'],
        ['split', '分屏'],
        ['preview', '预览']
      ].forEach(function ([view, label]) {
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.dataset.yiliaView = view;
        button.addEventListener('click', function () {
          applyEditorView(editor, view);
        });
        picker.appendChild(button);
      });
      var title = toolbarInner.querySelector(':scope > h2');
      toolbarInner.insertBefore(picker, title ? title.nextSibling : toolbarInner.firstChild);
    }

    var saveButton = toolbarInner.querySelector(':scope > button.primary');
    ensureSaveState(toolbarInner, saveButton);
    ensureLocalSaveButton(editor, toolbarInner, saveButton);
    ensureMediaButton(toolbarInner, saveButton);
    decoratePaneHeaders(editPane, previewPane);

    var savedView = editor.dataset.yiliaView;
    if (!savedView) {
      try {
        savedView = window.localStorage.getItem('yilia-admin-editor-view') || 'split';
      } catch (error) {
        savedView = 'split';
      }
    }
    applyEditorView(editor, savedView);
    decorateEditorMenu(editor, toolbarInner);
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
    enhanceTagFields();
    enhanceEditorChrome();
    syncMediaLibraryRoute();
  }

  var shellSyncPending = false;
  function scheduleShellSync() {
    if (shellSyncPending) return;
    shellSyncPending = true;
    window.requestAnimationFrame(function () {
      shellSyncPending = false;
      syncShell();
    });
  }

  registerPreviews();
  cms.init();
  loadTagOptions();
  syncShell();

  window.addEventListener('hashchange', syncShell);
  document.addEventListener('pointerdown', function (event) {
    var editor = root.querySelector('.wrapper.content-editor');
    if (!editor?.classList.contains('yilia-panel-drawer-open')) return;
    if (event.target.closest('.sidebar, .yilia-panel-menu')) return;
    closePanelDrawer(editor);
  });
  document.addEventListener('click', function (event) {
    var button = event.target.closest('.content-editor button[aria-label]');
    if (!button || button.classList.contains('yilia-media-open')) return;
    if (!/图片|媒体/.test(button.getAttribute('aria-label') || '')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openMediaLibrary('editor');
  }, true);
  window.addEventListener('keydown', function (event) {
    var editor = root.querySelector('.wrapper.content-editor');
    if (event.key === 'Escape' && editor?.classList.contains('yilia-panel-drawer-open')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closePanelDrawer(editor);
    }
  }, true);
  new MutationObserver(scheduleShellSync).observe(root, { childList: true, subtree: true });
})();
