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
  window.addEventListener('keydown', function (event) {
    var editor = root.querySelector('.wrapper.content-editor');
    if (event.key === 'Escape' && editor?.classList.contains('yilia-panel-drawer-open')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closePanelDrawer(editor);
    }
  }, true);
  new MutationObserver(syncShell).observe(root, { childList: true, subtree: true });
})();
