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
    if (!cms || !cms.createClass || !cms.registerPreviewTemplate || window.__yiliaV17PreviewRegistered) return;
    var h = cms.h;
    var Preview = cms.createClass({
      render: function () {
        var entry = this.props.entry;
        var data = entry && entry.get ? entry.get('data') : null;
        var title = data && data.get ? data.get('title') : '';
        var date = data && data.get ? data.get('date') : '';
        /* Decap exposes the markdown body through widgetFor('body'), not entry.data.body. */
        var bodyPreview = this.props.widgetFor('body');
        return h('article', { className: 'yilia-v17-preview' },
          h('header', { className: 'yilia-v17-preview-head' },
            h('p', { className: 'yilia-v17-preview-kicker' }, 'YANCEY’S BLOG · 文章预览'),
            h('h1', null, String(title || '未命名文章')),
            date ? h('time', null, String(date)) : null
          ),
          h('div', { className: 'yilia-v17-preview-body' }, bodyPreview)
        );
      }
    });
    cms.registerPreviewTemplate('posts', Preview);
    if (cms.registerPreviewStyle) cms.registerPreviewStyle('/admin/admin-preview.css?v=1.7.2');
    window.__yiliaV17PreviewRegistered = true;
  }
  function decorate() {
    var workspace = document.querySelector('.admin-workspace');
    var isEditor = /#\/collections\/posts\/(new|entries\/)/.test(location.hash);
    if (workspace) workspace.classList.toggle('v17-editor-mode', isEditor);

    var publish = Array.from(root.querySelectorAll('button')).find(function (button) { return /^publish\b/i.test(text(button)); });
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

    var names = ['标题', '发布日期', '分类', '标签'];
    var fields = names.map(function (name) { var label = findLabel(name); var field = fieldFor(label); if (field) field.classList.add('v17-meta-field'); return field; }).filter(Boolean);
    if (fields.length === 4) {
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

  }

  var observer = new MutationObserver(decorate);
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  window.addEventListener('hashchange', decorate);
  registerPreview();
  decorate();
})();
