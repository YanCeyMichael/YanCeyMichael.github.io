(function () {
  "use strict";

  var overlay = document.getElementById("architecture-overlay");
  var trigger = document.getElementById("architecture-trigger");
  if (!overlay || !trigger) return;

  var closeButton = document.getElementById("architecture-close");
  var shareButton = document.getElementById("architecture-share");
  var mapFrame = document.getElementById("architecture-map-frame");
  var moduleList = document.getElementById("architecture-module-list");
  var mobileMap = document.getElementById("architecture-mobile-map");
  var toast = document.getElementById("architecture-toast");
  var commitLabel = document.getElementById("architecture-commit");
  var moduleCount = document.getElementById("architecture-module-count");
  var nodeCount = document.getElementById("architecture-node-count");
  var factModules = document.getElementById("architecture-fact-modules");
  var factNodes = document.getElementById("architecture-fact-nodes");
  var factDependencies = document.getElementById("architecture-fact-dependencies");
  var viewButtons = Array.prototype.slice.call(document.querySelectorAll("[data-architecture-view]"));
  var viewPanels = Array.prototype.slice.call(document.querySelectorAll("[data-architecture-panel]"));
  var catalogPromise = null;
  var lastFocusedElement = null;
  var closeTimer = null;

  document.body.insertBefore(overlay, document.body.firstChild);
  toast = document.getElementById("architecture-toast");
  if (toast) document.body.append(toast);

  function createElement(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (typeof text === "string") element.textContent = text;
    return element;
  }

  function setText(element, value) {
    if (element) element.textContent = String(value);
  }

  function renderJourney(journey) {
    if (!mobileMap || !Array.isArray(journey)) return;
    mobileMap.replaceChildren();
    journey.forEach(function (step) {
      var row = createElement("div", "architecture-mobile-step");
      row.append(
        createElement("span", "", step.label),
        createElement("strong", "", step.title),
        createElement("small", "", step.summary)
      );
      mobileMap.append(row);
    });
  }

  function renderModules(modules) {
    if (!moduleList || !Array.isArray(modules)) return;
    moduleList.replaceChildren();
    modules.forEach(function (module) {
      var item = createElement("article", "architecture-module-item");
      item.dataset.moduleId = module.id;
      var detailId = "architecture-module-detail-" + module.id;
      var summary = createElement("button", "architecture-module-summary");
      summary.type = "button";
      summary.setAttribute("aria-expanded", "false");
      summary.setAttribute("aria-controls", detailId);
      summary.append(
        createElement("span", "architecture-module-title", module.name),
        createElement("span", "architecture-module-copy", module.summary),
        createElement("span", "architecture-module-toggle", "查看")
      );

      var detail = createElement("div", "architecture-module-detail");
      detail.id = detailId;
      var role = createElement("div");
      role.append(
        createElement("h3", "", "职责"),
        createElement("p", "", module.detail)
      );
      var position = createElement("div");
      position.append(
        createElement("h3", "", "架构位置"),
        createElement("p", "", module.role + "。新增功能模块加入清单后，会在这里出现新的条目与入口文件。")
      );
      var files = createElement("div", "architecture-module-files");
      files.append(createElement("h3", "", "入口文件"));
      (module.entry_files || []).forEach(function (file) {
        files.append(createElement("code", "", file));
      });
      detail.append(role, position, files);
      item.append(summary, detail);
      moduleList.append(item);
    });
  }

  function renderCatalog(catalog) {
    var stats = catalog.stats || {};
    var modules = Array.isArray(catalog.modules) ? catalog.modules : [];
    setText(commitLabel, catalog.short_commit ? "更新自 " + catalog.short_commit : "最近构建");
    setText(moduleCount, modules.length + " 个模块");
    setText(nodeCount, stats.nodes + " 个节点");
    setText(factModules, modules.length);
    setText(factNodes, stats.nodes || 0);
    setText(factDependencies, stats.runtime_dependencies || 0);
    renderJourney(catalog.journey);
    renderModules(modules);
  }

  function loadCatalog(force) {
    if (catalogPromise && !force) return catalogPromise;
    setText(moduleCount, "正在读取");
    setText(nodeCount, "正在读取");
    catalogPromise = fetch("/architecture/catalog.json", { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("architecture catalog unavailable");
        return response.json();
      })
      .then(function (catalog) {
        renderCatalog(catalog);
        return catalog;
      })
      .catch(function (error) {
        setText(moduleCount, "读取失败");
        setText(nodeCount, "读取失败");
        if (moduleList) {
          moduleList.replaceChildren(createElement("p", "architecture-module-status", "模块目录暂时无法读取。"));
          var retry = createElement("button", "architecture-module-retry", "重新读取");
          retry.type = "button";
          retry.addEventListener("click", function () {
            loadCatalog(true).catch(function () {});
          });
          moduleList.append(retry);
        }
        if (mobileMap) {
          mobileMap.replaceChildren(createElement("div", "architecture-mobile-loading", "架构数据暂时无法读取。"));
        }
        throw error;
      });
    return catalogPromise;
  }

  function setView(view) {
    viewButtons.forEach(function (button) {
      var active = button.dataset.architectureView === view;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    viewPanels.forEach(function (panel) {
      panel.classList.toggle("is-active", panel.dataset.architecturePanel === view);
    });
    syncTitleLevel();
    var sheet = overlay.querySelector(".architecture-sheet");
    if (sheet) sheet.scrollTop = 0;
  }

  function syncTitleLevel(restore) {
    viewPanels.forEach(function (panel) {
      var title = panel.querySelector("[data-architecture-title]");
      if (!title) return;
      var desiredTag = !restore && panel.classList.contains("is-active") ? "h1" : "h2";
      if (title.tagName.toLowerCase() === desiredTag) return;
      var replacement = document.createElement(desiredTag);
      replacement.id = title.id;
      replacement.setAttribute("data-architecture-title", "");
      replacement.textContent = title.textContent;
      title.replaceWith(replacement);
    });
  }

  function loadMap() {
    if (!mapFrame || mapFrame.src) return;
    mapFrame.src = mapFrame.dataset.src;
  }

  function openArchitecture(options) {
    clearTimeout(closeTimer);
    lastFocusedElement = document.activeElement;
    trigger.setAttribute("aria-expanded", "true");
    overlay.hidden = false;
    document.documentElement.classList.add("architecture-is-open");
    syncTitleLevel();
    loadMap();
    loadCatalog().catch(function () {});
    requestAnimationFrame(function () {
      overlay.classList.add("is-open");
      if (closeButton) closeButton.focus({ preventScroll: true });
    });
    if (!options || !options.fromHistory) {
      history.replaceState(null, "", location.pathname + location.search + "#architecture");
    }
  }

  function closeArchitecture(options) {
    if (overlay.hidden) return;
    trigger.setAttribute("aria-expanded", "false");
    overlay.classList.remove("is-open");
    document.documentElement.classList.remove("architecture-is-open");
    var finish = function () {
      overlay.hidden = true;
      syncTitleLevel(true);
      if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
        lastFocusedElement.focus({ preventScroll: true });
      }
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) finish();
    else closeTimer = window.setTimeout(finish, 240);
    if (!options || !options.keepHash) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(function () {
      toast.hidden = true;
    }, 1800);
  }

  function shareArchitecture() {
    var url = new URL(location.href);
    url.hash = "architecture";
    var data = {
      title: "Yancey’s Blog · 本站架构",
      text: "看这座个人博客如何从写作入口生成并发布。",
      url: url.href
    };
    if (navigator.share && window.matchMedia("(max-width: 800px)").matches) {
      navigator.share(data).catch(function () {});
      return;
    }
    var copied = navigator.clipboard && navigator.clipboard.writeText
      ? navigator.clipboard.writeText(url.href)
      : Promise.reject(new Error("clipboard unavailable"));
    copied.then(function () {
      showToast("分享链接已复制");
    }).catch(function () {
      var textarea = document.createElement("textarea");
      textarea.value = url.href;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      var success = document.execCommand("copy");
      textarea.remove();
      showToast(success ? "分享链接已复制" : "请复制地址栏链接");
    });
  }

  function trapFocus(event) {
    if (event.key !== "Tab" || overlay.hidden) return;
    var focusable = Array.prototype.filter.call(
      overlay.querySelectorAll('a[href], button:not([disabled]), iframe, input, textarea, select, [tabindex]:not([tabindex="-1"])'),
      function (element) { return !element.hidden && element.getClientRects().length; }
    );
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  trigger.addEventListener("click", function () { openArchitecture(); });
  closeButton.addEventListener("click", function () { closeArchitecture(); });
  shareButton.addEventListener("click", shareArchitecture);
  overlay.addEventListener("click", function (event) {
    if (event.target === overlay) closeArchitecture();
  });
  overlay.addEventListener("click", function (event) {
    var summary = event.target.closest(".architecture-module-summary");
    if (!summary) return;
    var item = summary.closest(".architecture-module-item");
    var expanded = summary.getAttribute("aria-expanded") === "true";
    summary.setAttribute("aria-expanded", String(!expanded));
    item.classList.toggle("is-open", !expanded);
    summary.querySelector(".architecture-module-toggle").textContent = expanded ? "查看" : "收起";
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !overlay.hidden) {
      event.preventDefault();
      closeArchitecture();
    }
    trapFocus(event);
  });
  viewButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setView(button.dataset.architectureView);
    });
  });
  window.addEventListener("hashchange", function () {
    if (location.hash === "#architecture") openArchitecture({ fromHistory: true });
    else if (!overlay.hidden) closeArchitecture({ keepHash: true });
  });

  if (location.hash === "#architecture") openArchitecture({ fromHistory: true });
})();
