(function () {
  'use strict';
  var drawer = document.querySelector('.site-drawer-v6');
  var scrim = document.querySelector('.site-drawer-scrim');
  if (!drawer || !scrim) return;

  var search = drawer.querySelector('#site-drawer-search');
  var results = drawer.querySelector('#site-drawer-results');
  var empty = drawer.querySelector('.site-drawer-empty');
  var clear = drawer.querySelector('.site-drawer-clear');
  var cloud = drawer.querySelector('#site-drawer-tag-cloud');
  var expand = drawer.querySelector('.site-drawer-expand');
  var posts = [];
  var selectedTag = '';
  var returnFocus = null;
  var root = (window.yiliaConfig && window.yiliaConfig.root) || '/';

  function clean(value) {
    return String(value == null ? '' : value).normalize('NFC').trim().replace(/\s+/g, ' ');
  }
  function key(value) {
    var valueClean = clean(value);
    return /[A-Za-z]/.test(valueClean) ? valueClean.toLocaleLowerCase() : valueClean;
  }
  function safePath(path) {
    return new URL(root + String(path || '').replace(/^\//, ''), location.href).href;
  }
  function dateOf(post) {
    var parsed = new Date(post.date || 0);
    return isNaN(parsed.getTime()) ? new Date(0) : parsed;
  }
  function postTags(post) {
    var seen = {};
    return (Array.isArray(post.tags) ? post.tags : []).map(function (tag) {
      return clean(typeof tag === 'string' ? tag : tag && tag.name);
    }).filter(function (tag) {
      var k = key(tag);
      if (!tag || seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }
  function tagCloudCounts() {
    var counts = {};
    posts.forEach(function (post) {
      var seen = {};
      postTags(post).forEach(function (tag) {
        var k = key(tag);
        if (seen[k]) return;
        seen[k] = true;
        if (!counts[k]) counts[k] = { name: tag, count: 0 };
        counts[k].count += 1;
      });
    });
    var sorted = Object.keys(counts).map(function (k) { return counts[k]; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'zh-CN'); });
    cloud.replaceChildren();
    sorted.forEach(function (tag) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'site-drawer-tag';
      button.dataset.tag = tag.name;
      button.setAttribute('aria-pressed', 'false');
      var name = document.createElement('span');
      name.textContent = tag.name;
      var count = document.createElement('b');
      count.textContent = tag.count;
      button.append(name, count);
      cloud.appendChild(button);
    });
    expand.hidden = sorted.length <= 10;
  }
  function render() {
    var term = clean(search.value).toLocaleLowerCase();
    var filtered = posts.filter(function (post) {
      var title = clean(post.title).toLocaleLowerCase();
      var tags = postTags(post);
      var matchedText = !term || title.indexOf(term) !== -1 || tags.some(function (tag) { return tag.toLocaleLowerCase().indexOf(term) !== -1; });
      var matchedTag = !selectedTag || tags.some(function (tag) { return key(tag) === key(selectedTag); });
      return matchedText && matchedTag;
    });
    filtered.sort(function (a, b) { return dateOf(b) - dateOf(a); });
    results.replaceChildren();
    var lastYear = '';
    filtered.forEach(function (post) {
      var date = dateOf(post);
      var year = date.getTime() ? String(date.getFullYear()) : '未注明日期';
      if (year !== lastYear) {
        var yearLabel = document.createElement('div');
        yearLabel.className = 'site-drawer-year';
        yearLabel.textContent = year;
        results.appendChild(yearLabel);
        lastYear = year;
      }
      var link = document.createElement('a');
      link.className = 'site-drawer-result';
      link.href = safePath(post.path);
      var title = document.createElement('span');
      title.className = 'site-drawer-result-title';
      title.textContent = clean(post.title) || '未命名文章';
      var meta = document.createElement('span');
      meta.className = 'site-drawer-result-meta';
      var dateLabel = document.createElement('time');
      dateLabel.dateTime = date.toISOString();
      dateLabel.textContent = date.getTime() ? [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-') : '日期未知';
      meta.appendChild(dateLabel);
      postTags(post).forEach(function (tag) {
        var badge = document.createElement('span');
        badge.className = 'site-drawer-result-tag';
        badge.textContent = tag;
        meta.appendChild(badge);
      });
      link.append(title, meta);
      results.appendChild(link);
    });
    empty.hidden = filtered.length !== 0;
    clear.hidden = !(term || selectedTag);
    drawer.querySelectorAll('.site-drawer-tag').forEach(function (button) {
      var active = selectedTag && key(button.dataset.tag) === key(selectedTag);
      button.classList.toggle('is-selected', !!active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }
  function open(tab, focusTarget) {
    returnFocus = focusTarget || document.activeElement;
    drawer.classList.add('is-open');
    scrim.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
    drawer.removeAttribute('inert');
    document.body.classList.add('site-drawer-open');
    switchTab(tab || 'archive');
    window.requestAnimationFrame(function () { drawer.querySelector('.site-drawer-close').focus(); });
  }
  function closeDrawer() {
    drawer.classList.remove('is-open');
    scrim.hidden = true;
    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('inert', '');
    document.body.classList.remove('site-drawer-open');
    if (returnFocus && returnFocus.focus) returnFocus.focus();
  }
  function switchTab(name) {
    drawer.querySelectorAll('[data-drawer-tab]').forEach(function (button) {
      var active = button.dataset.drawerTab === name;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    drawer.querySelectorAll('[data-drawer-page]').forEach(function (page) {
      page.hidden = page.dataset.drawerPage !== name;
    });
  }
  function handleOpenClick(event) {
    var menu = event.target.closest && event.target.closest('.header-smart-menu a');
    var mobileList = event.target.closest && event.target.closest('.slider-trigger.list');
    var tagLink = event.target.closest && event.target.closest('.tagcloud a.js-tag');
    if (menu) {
      event.preventDefault();
      event.stopImmediatePropagation();
      var label = clean(menu.textContent).toLowerCase();
      open(label.indexOf('about') !== -1 || label.indexOf('关于') !== -1 ? 'about' : 'archive', menu);
    } else if (mobileList) {
      event.preventDefault();
      event.stopImmediatePropagation();
      open('archive', mobileList);
    } else if (tagLink) {
      event.preventDefault();
      event.stopImmediatePropagation();
      selectedTag = clean(tagLink.textContent.replace(/^#/, ''));
      search.value = '';
      render();
      open('archive', tagLink);
    }
  }

  document.addEventListener('click', handleOpenClick, true);
  drawer.addEventListener('click', function (event) {
    var tab = event.target.closest('[data-drawer-tab]');
    var tag = event.target.closest('.site-drawer-tag');
    if (tab) switchTab(tab.dataset.drawerTab);
    if (tag) {
      var next = key(selectedTag) === key(tag.dataset.tag) ? '' : tag.dataset.tag;
      selectedTag = next;
      render();
    }
    if (event.target.closest('.site-drawer-close')) closeDrawer();
    if (event.target.closest('.site-drawer-expand')) {
      var expanded = expand.getAttribute('aria-expanded') === 'true';
      expand.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      expand.textContent = expanded ? '展开全部标签' : '收起标签';
      cloud.classList.toggle('is-expanded', !expanded);
    }
  });
  scrim.addEventListener('click', closeDrawer);
  search.addEventListener('input', render);
  clear.addEventListener('click', function () { search.value = ''; selectedTag = ''; render(); search.focus(); });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer();
    if (event.key === 'Tab' && drawer.classList.contains('is-open')) {
      var focusables = drawer.querySelectorAll('button:not([disabled]):not([hidden]),a[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      var first = focusables[0], last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  fetch(root + 'content.json?t=' + Date.now(), { credentials: 'same-origin' })
    .then(function (response) { if (!response.ok) throw new Error('content index unavailable'); return response.json(); })
    .then(function (data) { posts = Array.isArray(data) ? data : []; tagCloudCounts(); render(); })
    .catch(function () {
      results.textContent = '文章索引暂时无法读取，请稍后刷新页面。';
      empty.hidden = true;
    });
})();
