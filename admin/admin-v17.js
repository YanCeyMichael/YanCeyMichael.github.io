/* Small DOM adapters for the v1.7 editor layout; Decap remains responsible for Git writes. */
(function () {
  var root = document.getElementById('nc-root');
  if (!root) return;

  function text(el) { return (el && (el.innerText || el.textContent) || '').replace(/\s+/g, ' ').trim(); }
  function findLabel(name) {
    return Array.from(root.querySelectorAll('label,span,div,p'))
      .filter(function (el) { return el.children.length < 3 && text(el).replace(/\s*\(OPTIONAL\)$/i, '') === name; })
      .sort(function (a, b) { return a.textContent.length - b.textContent.length; })[0];
  }
  function fieldFor(label) {
    var node = label;
    for (var i = 0; node && i < 7 && node !== root; i++, node = node.parentElement) {
      if (node.querySelector('input,textarea,[contenteditable="true"],[role="textbox"]')) return node;
    }
    return label && label.parentElement;
  }
  function decorate() {
    var workspace = document.querySelector('.admin-workspace');
    var isEditor = /#\/collections\/posts\/(new|entries\/)/.test(location.hash);
    if (workspace) workspace.classList.toggle('v17-editor-mode', isEditor);

    var publish = Array.from(root.querySelectorAll('button')).find(function (button) { return /^publish\b/i.test(text(button)); });
    if (publish) { publish.classList.add('v17-publish-action'); publish.setAttribute('aria-label', '发布更新'); }

    var title = Array.from(root.querySelectorAll('a,button,div')).find(function (el) { return /^Writing in 文章 collection/i.test(text(el)); });
    if (title && !title.dataset.v17Localized) {
      Array.from(title.childNodes).filter(function (node) { return node.nodeType === 3 && /Writing in/i.test(node.nodeValue); })
        .forEach(function (node) { node.nodeValue = node.nodeValue.replace(/Writing in 文章 collection/i, '文章 › 新建文章'); });
      title.dataset.v17Localized = 'true';
    }

    var names = ['标题', '发布日期', '分类', '标签'];
    var fields = names.map(function (name) { var label = findLabel(name); var field = fieldFor(label); if (field) field.classList.add('v17-meta-field'); return field; }).filter(Boolean);
    if (fields.length === 4) {
      var common = fields[0];
      while (common && !fields.every(function (field) { return common.contains(field); })) common = common.parentElement;
      if (common && common !== root) common.classList.add('v17-meta-grid');
    }
    var bodyLabel = findLabel('正文');
    var bodyField = fieldFor(bodyLabel);
    if (bodyField) bodyField.classList.add('v17-body-field');

    Array.from(root.querySelectorAll('iframe')).forEach(function (frame) {
      try {
        var empty = !frame.contentDocument || !frame.contentDocument.body || !frame.contentDocument.body.textContent.trim();
        var pane = frame.parentElement && frame.parentElement.parentElement;
        if (pane) pane.classList.toggle('v17-empty-preview', empty);
      } catch (_) { /* Cross-origin preview frames are left untouched. */ }
    });
  }

  var observer = new MutationObserver(decorate);
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  window.addEventListener('hashchange', decorate);
  decorate();
})();
