(function () {
  if (!window.yiliaConfig || !window.yiliaConfig.isHome || !window.yiliaFetchContentIndex) return;
  var content = document.getElementById('js-content');
  if (!content) return;
  var refreshTimer = null;

  function pathKey(value) {
    try {
      var pathname = new URL(String(value || ''), location.origin).pathname;
      return decodeURIComponent(pathname).replace(/\/+$/, '');
    } catch (error) {
      return String(value || '').replace(/\/+$/, '');
    }
  }

  function articleDate(value) {
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  }

  function makeLink(post) {
    var link = document.createElement('a');
    link.href = window.yiliaConfig.root + String(post.path || '').replace(/^\/+/, '');
    link.textContent = post.title || '未命名文章';
    return link;
  }

  function createFreshArticle(post) {
    var article = document.createElement('article');
    article.className = 'article article-type-post article-index article-fresh-index';
    article.dataset.freshPost = pathKey(post.path);

    var inner = document.createElement('div');
    inner.className = 'article-inner';
    var header = document.createElement('header');
    header.className = 'article-header';
    var titleRow = document.createElement('div');
    titleRow.className = 'article-title-row';
    var title = document.createElement('h2');
    title.className = 'article-title';
    title.appendChild(makeLink(post));
    titleRow.appendChild(title);
    var dateText = articleDate(post.date);
    if (dateText) {
      var date = document.createElement('time');
      date.className = 'archive-article-date';
      date.dateTime = dateText;
      date.textContent = dateText;
      titleRow.appendChild(date);
    }
    header.appendChild(titleRow);

    var entry = document.createElement('div');
    entry.className = 'article-entry';
    var summary = document.createElement('p');
    summary.textContent = post.summary || '新文章已发布，点击查看全文。';
    entry.appendChild(summary);

    if (post.image && /^https:\/\//i.test(post.image)) {
      article.classList.add('article-has-media');
      var layout = document.createElement('div');
      layout.className = 'list-entry-layout';
      var copy = document.createElement('div');
      copy.className = 'list-entry-copy';
      copy.appendChild(summary.cloneNode(true));
      var figure = document.createElement('figure');
      figure.className = 'list-entry-media';
      var image = document.createElement('img');
      image.src = post.image;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      figure.appendChild(image);
      layout.append(copy, figure);
      entry.replaceChildren(layout);
    }

    var info = document.createElement('div');
    info.className = 'article-info article-info-index';
    if (Array.isArray(post.tags) && post.tags.length) {
      var tags = document.createElement('div');
      tags.className = 'article-tag';
      post.tags.slice(0, 4).forEach(function (tag) {
        var chip = document.createElement('a');
        chip.className = 'article-tag-list-link';
        chip.href = window.yiliaConfig.root + 'tags/' + encodeURIComponent(tag) + '/';
        chip.textContent = tag;
        tags.appendChild(chip);
      });
      info.appendChild(tags);
    }
    var more = document.createElement('p');
    more.className = 'article-more-link';
    var moreLink = makeLink(post);
    moreLink.textContent = '阅读全文 >>';
    more.appendChild(moreLink);
    info.appendChild(more);

    inner.append(header, entry, info);
    article.appendChild(inner);
    return article;
  }

  async function refresh() {
    if (document.visibilityState === 'hidden' || navigator.onLine === false) return;
    try {
      var response = await window.yiliaFetchContentIndex(true);
      var posts = await response.json();
      if (!Array.isArray(posts)) return;
      document.querySelectorAll('[data-fresh-post]').forEach(function (node) { node.remove(); });
      var existing = new Set();
      content.querySelectorAll('.article-index .article-title a').forEach(function (link) {
        existing.add(pathKey(link.getAttribute('href')));
      });
      var fresh = posts.filter(function (post) {
        return post && post.path && !existing.has(pathKey(post.path));
      }).slice(0, 6);
      if (!fresh.length) return;
      var anchor = content.querySelector('.article-index');
      fresh.reverse().forEach(function (post) {
        content.insertBefore(createFreshArticle(post), anchor || content.firstChild);
      });
    } catch (error) {
      // Static article cards remain usable when the live index is unavailable.
    }
  }

  function schedule() {
    if (refreshTimer) window.clearInterval(refreshTimer);
    refreshTimer = window.setInterval(refresh, 30000);
  }

  refresh();
  schedule();
  window.addEventListener('online', refresh);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') refresh();
  });
})();
