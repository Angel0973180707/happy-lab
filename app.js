/* happy-lab v0.3.2 app.js
   - localStorage 資料庫
   - 導覽切頁
   - 主題/工具/影片/文案/模組/發佈套件/課程/發想 CRUD
   - 一鍵配對（簡易關鍵字打分）
   - 咒語生成器（A/B 模組結構）
   - 文案咒語包（模板）
   - 匯入/匯出 JSON
   - 統計總覽
*/
(function () {
  "use strict";

  // ======= utils =======
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function nowISO() { return new Date().toISOString(); }
  function uid(prefix) {
    var t = new Date().getTime();
    var r = Math.floor(Math.random() * 100000);
    return (prefix || "id") + "-" + t + "-" + r;
  }
  function safeText(s) { return (s == null) ? "" : String(s); }
  function norm(s) {
    s = safeText(s).toLowerCase();
    // 簡易正規化：去掉常見分隔
    var rep = ["｜", "|", "×", "／", "/", "，", ",", "。", ".", "「", "」", "（", "）", "(", ")", "—", "-", "_", ":", "：", " "];
    for (var i = 0; i < rep.length; i++) s = s.split(rep[i]).join(" ");
    return s.replace(/\s+/g, " ").trim();
  }
  function keywords(s) {
    s = norm(s);
    if (!s) return [];
    // 中文沒有空白時，這邊用「空白拆」+「保留原句」
    var arr = s.split(" ");
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var w = arr[i].trim();
      if (w && w.length >= 2) out.push(w);
    }
    // 去重
    var seen = {};
    var uniq = [];
    for (var j = 0; j < out.length; j++) {
      if (!seen[out[j]]) { seen[out[j]] = 1; uniq.push(out[j]); }
    }
    return uniq;
  }
  function scoreByOverlap(aText, bText) {
    var a = keywords(aText);
    var b = keywords(bText);
    if (!a.length || !b.length) return 0;
    var map = {};
    for (var i = 0; i < a.length; i++) map[a[i]] = 1;
    var hit = 0;
    for (var j = 0; j < b.length; j++) if (map[b[j]]) hit++;
    return hit;
  }
  function escapeHtml(s) {
    s = safeText(s);
    return s
      .split("&").join("&amp;")
      .split("<").join("&lt;")
      .split(">").join("&gt;")
      .split('"').join("&quot;")
      .split("'").join("&#39;");
  }
  function toast(msg) {
    var el = qs("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(function () { el.classList.remove("show"); }, 1600);
  }
  function copyToClipboard(text) {
    text = safeText(text);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast("已複製到剪貼簿");
      }).catch(function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "readonly");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      toast("已複製到剪貼簿");
    } catch (e) {
      toast("複製失敗，請手動複製");
    }
    document.body.removeChild(ta);
  }

  // ======= storage =======
  var KEY = "happyLab_v0_3_2";
  function defaultDB() {
    return {
      meta: { version: "0.3.2", updatedAt: nowISO() },
      themes: [],
      tools: [],
      videos: [],
      copies: [],
      modules: [],
      publishes: [],
      courses: [], // {id,name,desc,createdAt, moduleIds:[]}
      ideas: [],
      _lastMatch: null
    };
  }
  function loadDB() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return defaultDB();
      var obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return defaultDB();
      // 補缺欄位
      var base = defaultDB();
      for (var k in base) if (base.hasOwnProperty(k) && obj[k] == null) obj[k] = base[k];
      if (!obj.meta) obj.meta = base.meta;
      return obj;
    } catch (e) {
      return defaultDB();
    }
  }
  function saveDB(db) {
    db.meta.updatedAt = nowISO();
    localStorage.setItem(KEY, JSON.stringify(db));
  }
  var db = loadDB();

  // ======= DOM refs =======
  // nav/views
  var navItems = qsa(".navItem");
  var views = qsa(".view");

  // stats
  var statsEl = qs("#stats");

  // Theme lab
  var formTheme = qs("#formTheme");
  var themeId = qs("#themeId");
  var themeSentence = qs("#themeSentence");
  var themePain = qs("#themePain");
  var themeScenario = qs("#themeScenario");
  var themeVideo = qs("#themeVideo");
  var themeToolHint = qs("#themeToolHint");
  var themeList = qs("#themeList");
  var themeSearch = qs("#themeSearch");
  var themeSort = qs("#themeSort");

  // Match
  var formMatch = qs("#formMatch");
  var matchTheme = qs("#matchTheme");
  var matchStrict = qs("#matchStrict");
  var matchResult = qs("#matchResult");
  var btnMatchToPublish = qs("#btnMatchToPublish");
  var btnOpenPublishLabFromMatch = qs("#btnOpenPublishLabFromMatch");

  // Spell lab
  var formSpell = qs("#formSpell");
  var spellTheme = qs("#spellTheme");
  var spellVersion = qs("#spellVersion");
  var spellFlavor = qs("#spellFlavor");
  var spellResult = qs("#spellResult");
  var btnOpenModuleLab = qs("#btnOpenModuleLab");

  // Module lab
  var moduleList = qs("#moduleList");
  var moduleSearch = qs("#moduleSearch");
  var moduleFilterType = qs("#moduleFilterType");

  // Copy spell
  var formCopySpell = qs("#formCopySpell");
  var copySpellTheme = qs("#copySpellTheme");
  var copySpellSeries = qs("#copySpellSeries");
  var copySpellCtaTone = qs("#copySpellCtaTone");
  var copySpellSave = qs("#copySpellSave");
  var copySpellResult = qs("#copySpellResult");
  var btnCopySpellToClipboard = qs("#btnCopySpellToClipboard");

  // Copy lab
  var formCopy = qs("#formCopy");
  var copyTitle = qs("#copyTitle");
  var copySeries = qs("#copySeries");
  var copyContent = qs("#copyContent");
  var copyList = qs("#copyList");
  var copySearch = qs("#copySearch");

  // Tool lab
  var formTool = qs("#formTool");
  var toolId = qs("#toolId");
  var toolName = qs("#toolName");
  var toolDesc = qs("#toolDesc");
  var toolList = qs("#toolList");
  var toolSearch = qs("#toolSearch");

  // Inventory
  var formVideo = qs("#formVideo");
  var videoId = qs("#videoId");
  var videoTitle = qs("#videoTitle");
  var videoUrl = qs("#videoUrl");
  var videoSeries = qs("#videoSeries");
  var inventoryPanel = qs("#inventoryPanel");
  var invTabs = qsa(".tab");

  // Publish lab
  var formPublish = qs("#formPublish");
  var publishTheme = qs("#publishTheme");
  var publishVideo = qs("#publishVideo");
  var publishTool = qs("#publishTool");
  var publishModule = qs("#publishModule");
  var publishCopy = qs("#publishCopy");
  var publishNote = qs("#publishNote");
  var publishList = qs("#publishList");
  var publishSearch = qs("#publishSearch");

  // Course lab
  var formCourse = qs("#formCourse");
  var courseId = qs("#courseId");
  var courseName = qs("#courseName");
  var courseDesc = qs("#courseDesc");
  var formAssign = qs("#formAssign");
  var assignCourse = qs("#assignCourse");
  var assignModule = qs("#assignModule");
  var courseList = qs("#courseList");
  var courseSearch = qs("#courseSearch");

  // Idea lab
  var formIdea = qs("#formIdea");
  var ideaTitle = qs("#ideaTitle");
  var ideaDesc = qs("#ideaDesc");
  var ideaList = qs("#ideaList");
  var ideaSearch = qs("#ideaSearch");

  // Top actions
  var btnQuickAddDemo = qs("#btnQuickAddDemo");
  var btnExport = qs("#btnExport");
  var btnExport2 = qs("#btnExport2");
  var fileImport = qs("#fileImport");
  var fileImport2 = qs("#fileImport2");
  var btnClearAll = qs("#btnClearAll");

  // ======= render helpers =======
  function renderStats() {
    if (!statsEl) return;
    var items = [
      { k: "主題", v: db.themes.length },
      { k: "模組", v: db.modules.length },
      { k: "文案", v: db.copies.length },
      { k: "工具", v: db.tools.length },
      { k: "影片", v: db.videos.length },
      { k: "發佈套件", v: db.publishes.length },
      { k: "課程", v: db.courses.length },
      { k: "發想", v: db.ideas.length }
    ];
    var html = "";
    for (var i = 0; i < items.length; i++) {
      html += '<div class="stat"><div class="statNum">' + items[i].v + '</div><div class="statLabel">' + escapeHtml(items[i].k) + '</div></div>';
    }
    statsEl.innerHTML = html;
  }

  function fillSelect(sel, list, optFn, emptyLabel) {
    if (!sel) return;
    var html = "";
    if (emptyLabel) html += '<option value="">' + escapeHtml(emptyLabel) + "</option>";
    for (var i = 0; i < list.length; i++) {
      var o = optFn(list[i], i);
      html += '<option value="' + escapeHtml(o.value) + '">' + escapeHtml(o.label) + "</option>";
    }
    sel.innerHTML = html;
  }

  function currentThemeQuery() {
    var q = safeText(themeSearch && themeSearch.value).trim();
    return q;
  }

  function sortThemes(arr) {
    var mode = themeSort ? themeSort.value : "new";
    var out = arr.slice();
    out.sort(function (a, b) {
      if (mode === "old") return (a.createdAt > b.createdAt) ? 1 : -1;
      if (mode === "az") return (a.sentence || "").localeCompare(b.sentence || "");
      // new default
      return (a.createdAt < b.createdAt) ? 1 : -1;
    });
    return out;
  }

  function renderThemeList() {
    if (!themeList) return;
    var q = currentThemeQuery();
    var items = db.themes.slice();
    if (q) {
      var nq = norm(q);
      items = items.filter(function (t) {
        var bag = norm((t.id || "") + " " + (t.sentence || "") + " " + (t.pain || "") + " " + (t.scenario || ""));
        return bag.indexOf(nq) >= 0;
      });
    }
    items = sortThemes(items);

    if (!items.length) {
      themeList.innerHTML = '<div class="muted">尚無主題。你可以先按「加入示範資料」或新增一筆。</div>';
      return;
    }

    var html = "";
    for (var i = 0; i < items.length; i++) {
      var t = items[i];
      html += '<div class="item">';
      html +=   '<div class="itemMain">';
      html +=     '<div class="itemTitle">' + escapeHtml(t.sentence || "(無標題)") + '</div>';
      html +=     '<div class="itemMeta muted">ID：' + escapeHtml(t.id) +
                 ' · 情境：' + escapeHtml(t.scenario || "-") +
                 (t.video ? ' · 影片：<a href="' + escapeHtml(t.video) + '" target="_blank" rel="noopener">開啟</a>' : "") +
                 '</div>';
      if (t.pain) html += '<div class="muted">卡點：' + escapeHtml(t.pain) + '</div>';
      if (t.toolHint) html += '<div class="muted">工具提示：' + escapeHtml(t.toolHint) + '</div>';
      html +=   '</div>';
      html +=   '<div class="itemActions">';
      html +=     '<button class="btn small ghost" data-act="copyTheme" data-id="' + escapeHtml(t.id) + '">複製</button>';
      html +=     '<button class="btn small danger" data-act="delTheme" data-id="' + escapeHtml(t.id) + '">刪除</button>';
      html +=   '</div>';
      html += '</div>';
    }
    themeList.innerHTML = html;
  }

  function renderToolList() {
    if (!toolList) return;
    var q = safeText(toolSearch && toolSearch.value).trim();
    var items = db.tools.slice();
    if (q) {
      var nq = norm(q);
      items = items.filter(function (t) {
        var bag = norm((t.id || "") + " " + (t.name || "") + " " + (t.desc || ""));
        return bag.indexOf(nq) >= 0;
      });
    }
    items.sort(function (a, b) { return (a.createdAt < b.createdAt) ? 1 : -1; });

    if (!items.length) {
      toolList.innerHTML = '<div class="muted">尚無工具。</div>';
      return;
    }
    var html = "";
    for (var i = 0; i < items.length; i++) {
      var t = items[i];
      html += '<div class="item">';
      html +=   '<div class="itemMain">';
      html +=     '<div class="itemTitle">' + escapeHtml(t.name || "(未命名工具)") + '</div>';
      html +=     '<div class="itemMeta muted">ID：' + escapeHtml(t.id) + '</div>';
      if (t.desc) html += '<div class="muted prelike">' + escapeHtml(t.desc) + '</div>';
      html +=   '</div>';
      html +=   '<div class="itemActions">';
      html +=     '<button class="btn small ghost" data-act="copyTool" data-id="' + escapeHtml(t.id) + '">複製</button>';
      html +=     '<button class="btn small danger" data-act="delTool" data-id="' + escapeHtml(t.id) + '">刪除</button>';
      html +=   '</div>';
      html += '</div>';
    }
    toolList.innerHTML = html;
  }

  function renderModuleList() {
    if (!moduleList) return;
    var q = safeText(moduleSearch && moduleSearch.value).trim();
    var filter = moduleFilterType ? moduleFilterType.value : "all";
    var items = db.modules.slice();

    if (filter !== "all") items = items.filter(function (m) { return m.type === filter; });

    if (q) {
      var nq = norm(q);
      items = items.filter(function (m) {
        var bag = norm((m.id || "") + " " + (m.title || "") + " " + (m.content || ""));
        return bag.indexOf(nq) >= 0;
      });
    }
    items.sort(function (a, b) { return (a.createdAt < b.createdAt) ? 1 : -1; });

    if (!items.length) {
      moduleList.innerHTML = '<div class="muted">尚無模組。</div>';
      return;
    }

    var html = "";
    for (var i = 0; i < items.length; i++) {
      var m = items[i];
      html += '<div class="item">';
      html +=   '<div class="itemMain">';
      html +=     '<div class="itemTitle">' + escapeHtml(m.title || "(未命名模組)") + ' <span class="tag">' + escapeHtml(m.type) + '</span></div>';
      html +=     '<div class="itemMeta muted">ID：' + escapeHtml(m.id) + ' · 來源主題：' + escapeHtml(m.themeSentence || "-") + '</div>';
      html +=     '<div class="muted prelike">' + escapeHtml(m.content || "") + '</div>';
      html +=   '</div>';
      html +=   '<div class="itemActions">';
      html +=     '<button class="btn small ghost" data-act="copyModule" data-id="' + escapeHtml(m.id) + '">複製</button>';
      html +=     '<button class="btn small danger" data-act="delModule" data-id="' + escapeHtml(m.id) + '">刪除</button>';
      html +=   '</div>';
      html += '</div>';
    }
    moduleList.innerHTML = html;
  }

  function renderCopyList() {
    if (!copyList) return;
    var q = safeText(copySearch && copySearch.value).trim();
    var items = db.copies.slice();
    if (q) {
      var nq = norm(q);
      items = items.filter(function (c) {
        var bag = norm((c.id || "") + " " + (c.title || "") + " " + (c.series || "") + " " + (c.content || ""));
        return bag.indexOf(nq) >= 0;
      });
    }
    items.sort(function (a, b) { return (a.createdAt < b.createdAt) ? 1 : -1; });

    if (!items.length) {
      copyList.innerHTML = '<div class="muted">尚無文案。</div>';
      return;
    }

    var html = "";
    for (var i = 0; i < items.length; i++) {
      var c = items[i];
      html += '<div class="item">';
      html +=   '<div class="itemMain">';
      html +=     '<div class="itemTitle">' + escapeHtml(c.title || "(未命名文案)") + ' <span class="tag">' + escapeHtml(c.series || "-") + '</span></div>';
      html +=     '<div class="itemMeta muted">ID：' + escapeHtml(c.id) + ' · ' + escapeHtml(c.createdAt ? c.createdAt.split("T")[0] : "") + '</div>';
      html +=     '<div class="muted prelike">' + escapeHtml((c.content || "").slice(0, 240)) + (c.content && c.content.length > 240 ? "…" : "") + '</div>';
      html +=   '</div>';
      html +=   '<div class="itemActions">';
      html +=     '<button class="btn small ghost" data-act="copyCopy" data-id="' + escapeHtml(c.id) + '">複製</button>';
      html +=     '<button class="btn small danger" data-act="delCopy" data-id="' + escapeHtml(c.id) + '">刪除</button>';
      html +=   '</div>';
      html += '</div>';
    }
    copyList.innerHTML = html;
  }

  function renderInventory(panelType) {
    if (!inventoryPanel) return;
    var html = "";
    if (panelType === "tools") {
      if (!db.tools.length) { inventoryPanel.innerHTML = '<div class="muted">工具庫目前是空的。</div>'; return; }
      var tools = db.tools.slice().sort(function (a, b) { return (a.createdAt < b.createdAt) ? 1 : -1; });
      for (var i = 0; i < tools.length; i++) {
        var t = tools[i];
        html += '<div class="item">';
        html +=   '<div class="itemMain">';
        html +=     '<div class="itemTitle">' + escapeHtml(t.name) + '</div>';
        html +=     '<div class="itemMeta muted">ID：' + escapeHtml(t.id) + '</div>';
        html +=   '</div>';
        html += '</div>';
      }
      inventoryPanel.innerHTML = html;
      return;
    }
    if (panelType === "copies") {
      if (!db.copies.length) { inventoryPanel.innerHTML = '<div class="muted">文案研究室目前是空的。</div>'; return; }
      var copies = db.copies.slice().sort(function (a, b) { return (a.createdAt < b.createdAt) ? 1 : -1; });
      for (var j = 0; j < copies.length; j++) {
        var c = copies[j];
        html += '<div class="item">';
        html +=   '<div class="itemMain">';
        html +=     '<div class="itemTitle">' + escapeHtml(c.title) + '</div>';
        html +=     '<div class="itemMeta muted">' + escapeHtml(c.series || "-") + ' · ID：' + escapeHtml(c.id) + '</div>';
        html +=   '</div>';
        html += '</div>';
      }
      inventoryPanel.innerHTML = html;
      return;
    }
    // videos default
    if (!db.videos.length) { inventoryPanel.innerHTML = '<div class="muted">影片庫存目前是空的。</div>'; return; }
    var vids = db.videos.slice().sort(function (a, b) { return (a.createdAt < b.createdAt) ? 1 : -1; });
    for (var k = 0; k < vids.length; k++) {
      var v = vids[k];
      html += '<div class="item">';
      html +=   '<div class="itemMain">';
      html +=     '<div class="itemTitle">' + escapeHtml(v.title) + '</div>';
      html +=     '<div class="itemMeta muted">' + escapeHtml(v.series || "-") + ' · ID：' + escapeHtml(v.id) +
               ' · <a href="' + escapeHtml(v.url) + '" target="_blank" rel="noopener">開啟</a></div>';
      html +=   '</div>';
      html += '</div>';
    }
    inventoryPanel.innerHTML = html;
  }

  function renderPublishList() {
    if (!publishList) return;
    var q = safeText(publishSearch && publishSearch.value).trim();
    var items = db.publishes.slice();
    if (q) {
      var nq = norm(q);
      items = items.filter(function (p) {
        var bag = norm((p.id || "") + " " + (p.themeSentence || "") + " " + (p.videoTitle || "") + " " + (p.toolName || "") + " " + (p.note || ""));
        return bag.indexOf(nq) >= 0;
      });
    }
    items.sort(function (a, b) { return (a.createdAt < b.createdAt) ? 1 : -1; });

    if (!items.length) {
      publishList.innerHTML = '<div class="muted">尚無發佈套件。</div>';
      return;
    }

    var html = "";
    for (var i = 0; i < items.length; i++) {
      var p = items[i];
      html += '<div class="item">';
      html +=   '<div class="itemMain">';
      html +=     '<div class="itemTitle">' + escapeHtml(p.themeSentence || "(未命名主題)") + '</div>';
      html +=     '<div class="itemMeta muted">套件ID：' + escapeHtml(p.id) + '</div>';
      html +=     '<div class="muted">影片：' + escapeHtml(p.videoTitle || "-") +
               (p.videoUrl ? ' · <a href="' + escapeHtml(p.videoUrl) + '" target="_blank" rel="noopener">開啟</a>' : "") + '</div>';
      html +=     '<div class="muted">工具：' + escapeHtml(p.toolName || "-") + '</div>';
      if (p.moduleTitle) html += '<div class="muted">模組：' + escapeHtml(p.moduleTitle) + '</div>';
      if (p.copyTitle) html += '<div class="muted">文案：' + escapeHtml(p.copyTitle) + '</div>';
      if (p.note) html += '<div class="muted">備註：' + escapeHtml(p.note) + '</div>';

      // 一鍵輸出「發片小抄」
      var cheat = [];
      cheat.push("【發佈套件】" + (p.themeSentence || ""));
      cheat.push("影片：" + (p.videoTitle || "") + (p.videoUrl ? "（" + p.videoUrl + "）" : ""));
      cheat.push("工具：" + (p.toolName || ""));
      if (p.moduleTitle) cheat.push("模組：" + p.moduleTitle);
      if (p.copyTitle) cheat.push("文案：" + p.copyTitle);
      if (p.note) cheat.push("備註：" + p.note);
      var cheatText = escapeHtml(cheat.join("\n"));

      html +=     '<div class="muted prelike">' + cheatText.split("\n").join("<br/>") + '</div>';
      html +=   '</div>';
      html +=   '<div class="itemActions">';
      html +=     '<button class="btn small ghost" data-act="copyPublish" data-id="' + escapeHtml(p.id) + '">複製小抄</button>';
      html +=     '<button class="btn small danger" data-act="delPublish" data-id="' + escapeHtml(p.id) + '">刪除</button>';
      html +=   '</div>';
      html += '</div>';
    }
    publishList.innerHTML = html;
  }

  function renderCourseList() {
    if (!courseList) return;
    var q = safeText(courseSearch && courseSearch.value).trim();
    var items = db.courses.slice();
    if (q) {
      var nq = norm(q);
      items = items.filter(function (c) {
        var bag = norm((c.id || "") + " " + (c.name || "") + " " + (c.desc || ""));
        return bag.indexOf(nq) >= 0;
      });
    }
    items.sort(function (a, b) { return (a.createdAt < b.createdAt) ? 1 : -1; });

    if (!items.length) {
      courseList.innerHTML = '<div class="muted">尚無課程。</div>';
      return;
    }

    var html = "";
    for (var i = 0; i < items.length; i++) {
      var c = items[i];
      var moduleCount = (c.moduleIds && c.moduleIds.length) ? c.moduleIds.length : 0;
      html += '<div class="item">';
      html +=   '<div class="itemMain">';
      html +=     '<div class="itemTitle">' + escapeHtml(c.name || "(未命名課程)") + ' <span class="tag">' + moduleCount + ' 模組</span></div>';
      html +=     '<div class="itemMeta muted">ID：' + escapeHtml(c.id) + '</div>';
      if (c.desc) html += '<div class="muted prelike">' + escapeHtml(c.desc) + '</div>';

      // 列出模組名稱
      if (moduleCount) {
        var names = [];
        for (var j = 0; j < c.moduleIds.length; j++) {
          var mid = c.moduleIds[j];
          var m = findById(db.modules, mid);
          if (m) names.push(m.title);
        }
        if (names.length) html += '<div class="muted">已加入：' + escapeHtml(names.join("、")) + '</div>';
      }
      html +=   '</div>';
      html +=   '<div class="itemActions">';
      html +=     '<button class="btn small ghost" data-act="copyCourse" data-id="' + escapeHtml(c.id) + '">複製課綱</button>';
      html +=     '<button class="btn small danger" data-act="delCourse" data-id="' + escapeHtml(c.id) + '">刪除</button>';
      html +=   '</div>';
      html += '</div>';
    }
    courseList.innerHTML = html;
  }

  function renderIdeaList() {
    if (!ideaList) return;
    var q = safeText(ideaSearch && ideaSearch.value).trim();
    var items = db.ideas.slice();
    if (q) {
      var nq = norm(q);
      items = items.filter(function (it) {
        var bag = norm((it.id || "") + " " + (it.title || "") + " " + (it.desc || ""));
        return bag.indexOf(nq) >= 0;
      });
    }
    items.sort(function (a, b) { return (a.createdAt < b.createdAt) ? 1 : -1; });

    if (!items.length) {
      ideaList.innerHTML = '<div class="muted">尚無發想。</div>';
      return;
    }

    var html = "";
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      html += '<div class="item">';
      html +=   '<div class="itemMain">';
      html +=     '<div class="itemTitle">' + escapeHtml(it.title || "(未命名)") + '</div>';
      html +=     '<div class="itemMeta muted">ID：' + escapeHtml(it.id) + '</div>';
      if (it.desc) html += '<div class="muted prelike">' + escapeHtml(it.desc) + '</div>';
      html +=   '</div>';
      html +=   '<div class="itemActions">';
      html +=     '<button class="btn small ghost" data-act="copyIdea" data-id="' + escapeHtml(it.id) + '">複製</button>';
      html +=     '<button class="btn small danger" data-act="delIdea" data-id="' + escapeHtml(it.id) + '">刪除</button>';
      html +=   '</div>';
      html += '</div>';
    }
    ideaList.innerHTML = html;
  }

  function findById(arr, id) {
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  }
  function removeById(arr, id) {
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === id) { arr.splice(i, 1); return true; }
    }
    return false;
  }

  // ======= select options sync =======
  function syncSelects() {
    // Themes
    var themeOpts = db.themes.slice().sort(function (a, b) { return (a.createdAt < b.createdAt) ? 1 : -1; })
      .map(function (t) {
        return { value: t.id, label: (t.sentence || t.id) };
      });
    fillSelect(matchTheme, themeOpts, function (o) { return o; }, "請選主題");
    fillSelect(spellTheme, themeOpts, function (o) { return o; }, "請選主題");
    fillSelect(copySpellTheme, themeOpts, function (o) { return o; }, "請選主題");
    fillSelect(publishTheme, themeOpts, function (o) { return o; }, "請選主題");

    // Tools
    var toolOpts = db.tools.slice().sort(function (a, b) { return (a.createdAt < b.createdAt) ? 1 : -1; })
      .map(function (t) {
        return { value: t.id, label: (t.name || t.id) };
      });
    fillSelect(publishTool, toolOpts, function (o) { return o; }, "請選工具");

    // Videos
    var videoOpts = db.videos.slice().sort(function (a, b) { return (a.createdAt < b.createdAt) ? 1 : -1; })
      .map(function (v) {
        return { value: v.id, label: (v.title || v.id) };
      });
    fillSelect(publishVideo, videoOpts, function (o) { return o; }, "請選影片");

    // Modules (optional)
    var moduleOpts = db.modules.slice().sort(function (a, b) { return (a.createdAt < b.createdAt) ? 1 : -1; })
      .map(function (m) { return { value: m.id, label: (m.title || m.id) }; });
    fillSelect(publishModule, moduleOpts, function (o) { return o; }, "（不選）");

    // Copies (optional)
    var copyOpts = db.copies.slice().sort(function (a, b) { return (a.createdAt < b.createdAt) ? 1 : -1; })
      .map(function (c) { return { value: c.id, label: (c.title || c.id) }; });
    fillSelect(publishCopy, copyOpts, function (o) { return o; }, "（不選）");

    // Courses
    var courseOpts = db.courses.slice().sort(function (a, b) { return (a.createdAt < b.createdAt) ? 1 : -1; })
      .map(function (c) { return { value: c.id, label: (c.name || c.id) }; });
    fillSelect(assignCourse, courseOpts, function (o) { return o; }, "請選課程");

    // Assign module
    fillSelect(assignModule, moduleOpts, function (o) { return o; }, "請選模組");
  }

  // ======= navigation =======
  function openView(name) {
    for (var i = 0; i < navItems.length; i++) {
      var b = navItems[i];
      var ok = b.getAttribute("data-view") === name;
      if (ok) b.classList.add("active"); else b.classList.remove("active");
    }
    for (var j = 0; j < views.length; j++) {
      var v = views[j];
      var id = v.getAttribute("id") || "";
      var ok2 = id === ("view-" + name);
      if (ok2) v.classList.add("active"); else v.classList.remove("active");
    }
    // 每次切頁都刷新
    renderAll();
  }

  // ======= seed demo =======
  function addDemo() {
    if (db.themes.length || db.tools.length || db.videos.length) {
      toast("你已經有資料了，示範不再重複加入");
      return;
    }

    var t1 = {
      id: "theme-desire-money",
      sentence: "無欲則剛｜零用錢×需要／想要×選擇力",
      pain: "孩子一遇到想要就失控、忍不住、停不下來",
      scenario: "超市現場｜看到想買的東西",
      video: "",
      toolHint: "需要/想要口袋卡、紅綠燈30秒踩煞車、我等一下計分"
    };

    var tool1 = {
      id: "tool-need-want-card",
      name: "需要/想要 口袋卡",
      desc: "孩子想買時，先問：\n1) 這是需要還是想要？\n2) 如果等一下，會不會更好？\n家長句子：『我不急著說不，我陪你把剎車踩一下。』",
      createdAt: nowISO()
    };

    var tool2 = {
      id: "tool-traffic-light-30s",
      name: "紅綠燈30秒踩煞車",
      desc: "紅燈：停一下（手摸胸口）\n黃燈：呼吸 4吸6吐 ×3\n綠燈：做選擇（買/不買/放回去/改天）\n加一句：『你不是被想要推著走，你在練選擇力。』",
      createdAt: nowISO()
    };

    var v1 = {
      id: "video-desire-money-01",
      title: "無欲則剛｜孩子學會等一下，選擇力就開始長出來",
      url: "https://example.com",
      series: "幸福教養",
      createdAt: nowISO()
    };

    db.themes.push(extend(t1, { createdAt: nowISO() }));
    db.tools.push(tool1);
    db.tools.push(tool2);
    db.videos.push(v1);

    saveDB(db);
    toast("示範資料已加入");
    renderAll();
  }

  function extend(a, b) {
    for (var k in b) if (b.hasOwnProperty(k)) a[k] = b[k];
    return a;
  }

  // ======= match =======
  function doMatch(themeObj, strict) {
    // strict: 0 多給 1 平衡 2 嚴格
    var baseText = (themeObj.sentence || "") + " " + (themeObj.pain || "") + " " + (themeObj.scenario || "") + " " + (themeObj.toolHint || "");
    // tool score
    var bestTool = null, bestToolScore = -1;
    for (var i = 0; i < db.tools.length; i++) {
      var t = db.tools[i];
      var s = scoreByOverlap(baseText, (t.name || "") + " " + (t.desc || ""));
      if (s > bestToolScore) { bestToolScore = s; bestTool = t; }
    }
    // module score
    var bestModule = null, bestModuleScore = -1;
    for (var j = 0; j < db.modules.length; j++) {
      var m = db.modules[j];
      var s2 = scoreByOverlap(baseText, (m.title || "") + " " + (m.content || ""));
      if (s2 > bestModuleScore) { bestModuleScore = s2; bestModule = m; }
    }
    // copy score
    var bestCopy = null, bestCopyScore = -1;
    for (var k = 0; k < db.copies.length; k++) {
      var c = db.copies[k];
      var s3 = scoreByOverlap(baseText, (c.title || "") + " " + (c.content || ""));
      if (s3 > bestCopyScore) { bestCopyScore = s3; bestCopy = c; }
    }

    // strict gates
    function pass(score) {
      if (strict === 2) return score >= 2;
      if (strict === 1) return score >= 1;
      return score >= 0; // 活潑模式：都給
    }

    var result = {
      themeId: themeObj.id,
      themeSentence: themeObj.sentence,
      tool: pass(bestToolScore) ? bestTool : null,
      module: pass(bestModuleScore) ? bestModule : null,
      copy: pass(bestCopyScore) ? bestCopy : null,
      scores: { tool: bestToolScore, module: bestModuleScore, copy: bestCopyScore },
      createdAt: nowISO()
    };
    return result;
  }

  function renderMatch(result) {
    if (!matchResult) return;
    if (!result) {
      matchResult.textContent = "尚未配對。";
      if (btnMatchToPublish) btnMatchToPublish.disabled = true;
      if (btnOpenPublishLabFromMatch) btnOpenPublishLabFromMatch.disabled = true;
      return;
    }

    var lines = [];
    lines.push("✅ 主題：" + (result.themeSentence || result.themeId));
    if (result.tool) lines.push("🧰 工具推薦：" + result.tool.name + "（分數 " + result.scores.tool + "）");
    else lines.push("🧰 工具推薦：目前找不到相近工具（先去工具庫存一筆）");

    if (result.module) lines.push("🧩 模組推薦：" + result.module.title + "（分數 " + result.scores.module + "）");
    else lines.push("🧩 模組推薦：目前找不到相近模組（可用咒語生成器先生成）");

    if (result.copy) lines.push("✍️ 文案推薦：" + result.copy.title + "（分數 " + result.scores.copy + "）");
    else lines.push("✍️ 文案推薦：目前找不到相近文案（可用文案咒語包先生成模板）");

    lines.push("");
    lines.push("下一步：按「把配對結果 → 一鍵建立發佈套件」");

    matchResult.textContent = lines.join("\n");
    if (btnMatchToPublish) btnMatchToPublish.disabled = false;
    if (btnOpenPublishLabFromMatch) btnOpenPublishLabFromMatch.disabled = false;
  }

  // ======= spell generator =======
  function genModuleSpell(themeObj, type, version, flavor) {
    var sentence = themeObj.sentence || "";
    var pain = themeObj.pain || "";
    var scenario = themeObj.scenario || "";
    flavor = safeText(flavor);

    // 模組結構（可陪伴式、遊戲化、直覺式）
    var lines = [];
    lines.push("【可陪伴式模組設計｜" + type + "｜" + safeText(version || "v1") + "】");
    lines.push("主題一句：" + sentence);
    if (pain) lines.push("觀眾卡點：" + pain);
    if (scenario) lines.push("情境：" + scenario);
    if (flavor) lines.push("風格：" + flavor);
    lines.push("");

    if (type === "A") {
      lines.push("✅ 核心練習：踩煞車＋選擇力（欲望/金錢版本）");
      lines.push("1) 觸發瞬間：我想要（看到/想到/別人有）");
      lines.push("2) 30秒踩煞車：手摸胸口＋4吸6吐×3（紅→黃→綠）");
      lines.push("3) 需要/想要判斷：這是『現在必須』還是『現在想要』？");
      lines.push("4) 三選一：A買 / B不買 / C放回去改天（孩子自己說出來）");
      lines.push("5) 回饋遊戲化：");
      lines.push("   - 『我等一下』+1（每次成功踩煞車就得分）");
      lines.push("   - 連續天數：今天踩煞車了嗎？");
      lines.push("   - 徽章：『我把想要放回去』、『我等一下大師』");
      lines.push("6) 親子一句話（不說教）：");
      lines.push("   - 家長：『我不急著說不，我陪你把剎車踩一下。』");
      lines.push("   - 孩子：『我可以等一下，再做選擇。』");
      lines.push("");
      lines.push("🔁 可延伸主題：零食/3C/遊戲時間/人際衝動/情緒爆衝");
    } else {
      lines.push("✅ 核心練習：柔軟彈性＋感恩善解溝通力");
      lines.push("1) 觸發瞬間：起衝突（誤會/被頂嘴/不配合）");
      lines.push("2) 30秒軟化：放慢語速＋先說感受（不下判斷）");
      lines.push("3) 善解一句：『我猜你是…（累/急/怕/想要被看見）』");
      lines.push("4) 邊界一句：『我們可以…，但我們不會…』");
      lines.push("5) 感恩回饋：每天收集 1 個『謝謝你』瞬間");
      lines.push("6) 回饋遊戲化：");
      lines.push("   - 『關係軟一點』+1（每次先善解再講規則）");
      lines.push("   - 徽章：『先抱住再說』、『善解翻譯官』、『彈性溝通王』");
      lines.push("7) 親子一句話（不說教）：");
      lines.push("   - 大人：『我先站穩，再把話說清楚。』");
      lines.push("   - 孩子：『我可以好好說，不用硬碰硬。』");
      lines.push("");
      lines.push("🔁 可延伸主題：手足衝突/作業拉扯/睡覺拖延/伴侶對話/師生互動");
    }

    lines.push("");
    lines.push("📌 留言引導（不暴露隱私）：");
    lines.push("「今天你/孩子有沒有成功『等一下』或『先善解』一次？留言：+1」");
    return lines.join("\n");
  }

  // ======= copy spell generator =======
  function genCopyTemplate(themeObj, series, ctaTone) {
    var sentence = themeObj.sentence || "";
    var pain = themeObj.pain || "";
    var scenario = themeObj.scenario || "";
    var toolHint = themeObj.toolHint || "";
    var seriesName = safeText(series);

    var cta = safeText(ctaTone).trim();
    if (!cta) cta = "回主頁領工具｜每週更新｜把心站穩，活出自在幸福感";

    var lines = [];
    lines.push("【文案咒語包｜" + seriesName + "】");
    lines.push("主題一句：" + sentence);
    if (pain) lines.push("觀眾卡點：" + pain);
    if (scenario) lines.push("情境：" + scenario);
    lines.push("");

    // Hook / Promise / Body / CTA
    lines.push("A. Hook（3–15 秒）");
    if (seriesName === "幸福教養") {
      lines.push("你有沒有發現——孩子不是故意失控，是『想要一來，剎車還沒裝好』。");
    } else if (seriesName === "詩詞人生") {
      lines.push("有一首詩，明明在寫景，卻把人的心寫得通透。");
    } else if (seriesName === "腦神經科學") {
      lines.push("你以為你在『忍』，其實是你的前額葉在跟杏仁核拔河。");
    } else if (seriesName === "人生感悟") {
      lines.push("有些改變，不靠努力，是靠『停一下』。");
    } else {
      lines.push("小腦袋今天學一招：遇到想要，先等一下再決定！");
    }
    lines.push("");

    lines.push("B. 承諾（你會得到什麼）");
    if (seriesName === "幸福教養") {
      lines.push("這集不教你管孩子，我帶你用一個『不說教的工具』，陪孩子把剎車系統裝回來。");
    } else if (seriesName === "詩詞人生") {
      lines.push("我會用詩的背景＋作者心境＋心理學/腦科學視角，帶你把這首詩讀成自己的力量。");
    } else if (seriesName === "腦神經科學") {
      lines.push("我用最白話、最好笑的方式，讓你秒懂：為什麼你會衝動？以及怎麼『踩煞車』。");
    } else if (seriesName === "人生感悟") {
      lines.push("我想陪你把『卡住』變成『看懂』，把『焦慮』變成『選擇』。");
    } else {
      lines.push("你會拿到一張小卡：需要/想要＋30秒剎車，回家就能玩。");
    }
    lines.push("");

    lines.push("C. 正文（請依系列套內容）");
    if (seriesName === "幸福教養") {
      lines.push("✅ 1) 完整故事（親子/超市/零用錢）");
      lines.push("（把你的故事原文貼上，保留細節：孩子怎麼說、怎麼猶豫、怎麼放回去…）");
      lines.push("");
      lines.push("✅ 2) 心理學（不說教）");
      lines.push("- 欲望不是壞，是訊號；重點是『能不能等一下』。");
      lines.push("");
      lines.push("✅ 3) 腦神經科學（親民版）");
      lines.push("- 前額葉=剎車；杏仁核=警報；練習就是在幫剎車長肌肉。");
      lines.push("");
      lines.push("✅ 4) 好用工具（要可落地）");
      lines.push("- 工具：需要/想要口袋卡 + 紅綠燈30秒踩煞車 + 『我等一下』+1");
      if (toolHint) lines.push("- 你這集工具提示：" + toolHint);
      lines.push("");
      lines.push("✅ 5) 留言互動（社群感）");
      lines.push("請留言：今天你家有沒有『等一下』成功一次？ +1");
      lines.push("");
      lines.push("（全文≥2000字以上可在這段自然擴寫：多兩個情境例子＋一句家長台詞庫）");
    } else if (seriesName === "詩詞人生") {
      lines.push("✅ 1) 作者介紹（生平/處境）");
      lines.push("✅ 2) 詩詞背景（寫作脈絡）");
      lines.push("✅ 3) 全詩全文（完整貼上）");
      lines.push("✅ 4) 心理學/腦科學觀點（用詩照見自己）");
      lines.push("✅ 5) 生活練習（1個小練習）");
    } else if (seriesName === "腦神經科學") {
      lines.push("✅ 1) 一個日常爆衝場景（幽默）");
      lines.push("✅ 2) 腦內角色：杏仁核/前額葉/多巴胺（比喻說人話）");
      lines.push("✅ 3) 30秒工具：停一下＋呼吸＋一句自我指令");
      lines.push("✅ 4) 小挑戰：今天『剎車』一次就算贏");
    } else if (seriesName === "人生感悟") {
      lines.push("✅ 1) 一個人生瞬間（故事/感悟）");
      lines.push("✅ 2) 轉折：看懂自己在追什麼/怕什麼");
      lines.push("✅ 3) 一個練習：停一下、再選一次");
    } else {
      lines.push("✅ 1) 小故事（孩子聽得懂）");
      lines.push("✅ 2) 一句咒語（孩子可跟讀）");
      lines.push("✅ 3) 遊戲：今天『等一下』成功幾次？");
    }
    lines.push("");

    lines.push("D. CTA（導到主頁）");
    lines.push(cta);

    return lines.join("\n");
  }

  // ======= events =======
  // nav
  for (var i = 0; i < navItems.length; i++) {
    navItems[i].addEventListener("click", function (e) {
      var name = this.getAttribute("data-view");
      if (name) openView(name);
    });
  }

  // search triggers
  if (themeSearch) themeSearch.addEventListener("input", renderThemeList);
  if (themeSort) themeSort.addEventListener("change", renderThemeList);
  if (toolSearch) toolSearch.addEventListener("input", renderToolList);
  if (moduleSearch) moduleSearch.addEventListener("input", renderModuleList);
  if (moduleFilterType) moduleFilterType.addEventListener("change", renderModuleList);
  if (copySearch) copySearch.addEventListener("input", renderCopyList);
  if (publishSearch) publishSearch.addEventListener("input", renderPublishList);
  if (courseSearch) courseSearch.addEventListener("input", renderCourseList);
  if (ideaSearch) ideaSearch.addEventListener("input", renderIdeaList);

  // theme add
  if (formTheme) formTheme.addEventListener("submit", function (e) {
    e.preventDefault();
    var id = safeText(themeId.value).trim();
    if (!id) id = uid("theme");
    var sentence = safeText(themeSentence.value).trim();
    if (!sentence) { toast("主題一句必填"); return; }

    var obj = {
      id: id,
      sentence: sentence,
      pain: safeText(themePain.value).trim(),
      scenario: safeText(themeScenario.value).trim(),
      video: safeText(themeVideo.value).trim(),
      toolHint: safeText(themeToolHint.value).trim(),
      createdAt: nowISO()
    };
    db.themes.push(obj);
    saveDB(db);
    toast("主題已新增");
    formTheme.reset();
    renderAll();
  });

  // theme list delegation
  if (themeList) themeList.addEventListener("click", function (e) {
    var btn = e.target;
    if (!btn || !btn.getAttribute) return;
    var act = btn.getAttribute("data-act");
    var id = btn.getAttribute("data-id");
    if (!act || !id) return;

    if (act === "delTheme") {
      if (!confirm("要刪除這個主題嗎？")) return;
      removeById(db.themes, id);
      saveDB(db);
      toast("已刪除主題");
      renderAll();
    }
    if (act === "copyTheme") {
      var t = findById(db.themes, id);
      if (!t) return;
      var text = "【主題】" + (t.sentence || "") + "\n卡點：" + (t.pain || "-") + "\n情境：" + (t.scenario || "-") + "\n工具提示：" + (t.toolHint || "-");
      copyToClipboard(text);
    }
  });

  // match
  if (formMatch) formMatch.addEventListener("submit", function (e) {
    e.preventDefault();
    var tid = matchTheme.value;
    var t = findById(db.themes, tid);
    if (!t) { toast("請先選主題"); return; }
    var strict = parseInt(matchStrict.value, 10) || 0;
    var res = doMatch(t, strict);
    db._lastMatch = res;
    saveDB(db);
    renderMatch(res);
    toast("配對完成");
  });

  if (btnMatchToPublish) btnMatchToPublish.addEventListener("click", function () {
    var res = db._lastMatch;
    if (!res) { toast("尚未配對"); return; }
    // 需要主題、影片、工具（影片可能空）
    // 這裡：若主題有 video url 且影片庫沒對應，就幫它先建一筆影片庫存（可選）
    var themeObj = findById(db.themes, res.themeId);
    if (!themeObj) { toast("主題不存在"); return; }

    // 影片：優先用庫存第一筆，或主題附帶連結
    var videoObj = null;
    if (db.videos.length) videoObj = db.videos[0];
    if (!videoObj && themeObj.video) {
      videoObj = {
        id: uid("video"),
        title: themeObj.sentence,
        url: themeObj.video,
        series: "幸福教養",
        createdAt: nowISO()
      };
      db.videos.push(videoObj);
    }
    if (!videoObj) { toast("請先在庫存區新增一支影片"); return; }

    // 工具：用配對結果，沒有就選第一筆
    var toolObj = res.tool || (db.tools.length ? db.tools[0] : null);
    if (!toolObj) { toast("請先在工具庫新增一個工具"); return; }

    var pub = {
      id: uid("publish"),
      themeId: themeObj.id,
      themeSentence: themeObj.sentence,
      videoId: videoObj.id,
      videoTitle: videoObj.title,
      videoUrl: videoObj.url,
      toolId: toolObj.id,
      toolName: toolObj.name,
      moduleId: res.module ? res.module.id : "",
      moduleTitle: res.module ? res.module.title : "",
      copyId: res.copy ? res.copy.id : "",
      copyTitle: res.copy ? res.copy.title : "",
      note: "由『一鍵配對』建立",
      createdAt: nowISO()
    };
    db.publishes.push(pub);
    saveDB(db);
    toast("已建立發佈套件");
    renderAll();
  });

  if (btnOpenPublishLabFromMatch) btnOpenPublishLabFromMatch.addEventListener("click", function () {
    openView("publishLab");
  });

  // spell generate
  if (formSpell) formSpell.addEventListener("submit", function (e) {
    e.preventDefault();
    var tid = spellTheme.value;
    var t = findById(db.themes, tid);
    if (!t) { toast("請先選主題"); return; }

    var type = (qsa('input[name="spellType"]', formSpell).filter(function (r) { return r.checked; })[0] || {}).value || "A";
    var ver = safeText(spellVersion.value).trim() || "v1";
    var flav = safeText(spellFlavor.value).trim();

    var content = genModuleSpell(t, type, ver, flav);
    spellResult.textContent = content;

    // 生成後也直接存成模組
    var m = {
      id: uid("module"),
      type: type,
      version: ver,
      themeId: t.id,
      themeSentence: t.sentence,
      title: "模組" + type + "｜" + t.sentence + "｜" + ver,
      content: content,
      createdAt: nowISO()
    };
    db.modules.push(m);
    saveDB(db);
    toast("模組已生成並存入模組庫");
    renderAll();
  });

  if (btnOpenModuleLab) btnOpenModuleLab.addEventListener("click", function () {
    openView("moduleLab");
  });

  // module list delegation
  if (moduleList) moduleList.addEventListener("click", function (e) {
    var btn = e.target;
    if (!btn || !btn.getAttribute) return;
    var act = btn.getAttribute("data-act");
    var id = btn.getAttribute("data-id");
    if (!act || !id) return;

    if (act === "delModule") {
      if (!confirm("要刪除這個模組嗎？")) return;
      removeById(db.modules, id);
      saveDB(db);
      toast("已刪除模組");
      renderAll();
    }
    if (act === "copyModule") {
      var m = findById(db.modules, id);
      if (!m) return;
      copyToClipboard(m.content || "");
    }
  });

  // copy spell
  if (formCopySpell) formCopySpell.addEventListener("submit", function (e) {
    e.preventDefault();
    var tid = copySpellTheme.value;
    var t = findById(db.themes, tid);
    if (!t) { toast("請先選主題"); return; }
    var series = copySpellSeries.value;
    var ctaTone = copySpellCtaTone.value;

    var temp = genCopyTemplate(t, series, ctaTone);
    copySpellResult.textContent = temp;

    if (copySpellSave.value === "yes") {
      var c = {
        id: uid("copy"),
        title: t.sentence + "｜" + series + "｜草稿 v1",
        series: series,
        content: temp,
        createdAt: nowISO()
      };
      db.copies.push(c);
      saveDB(db);
      toast("模板已存到文案研究室（草稿）");
      renderAll();
    } else {
      toast("模板已生成");
    }
  });

  if (btnCopySpellToClipboard) btnCopySpellToClipboard.addEventListener("click", function () {
    copyToClipboard(copySpellResult ? copySpellResult.textContent : "");
  });

  // copy add
  if (formCopy) formCopy.addEventListener("submit", function (e) {
    e.preventDefault();
    var title = safeText(copyTitle.value).trim();
    var series = copySeries.value;
    var content = safeText(copyContent.value);

    if (!title) { toast("標題必填"); return; }
    if (!content.trim()) { toast("內容必填"); return; }

    db.copies.push({
      id: uid("copy"),
      title: title,
      series: series,
      content: content,
      createdAt: nowISO()
    });
    saveDB(db);
    toast("文案已儲存");
    formCopy.reset();
    renderAll();
  });

  // copy list delegation
  if (copyList) copyList.addEventListener("click", function (e) {
    var btn = e.target;
    if (!btn || !btn.getAttribute) return;
    var act = btn.getAttribute("data-act");
    var id = btn.getAttribute("data-id");
    if (!act || !id) return;

    if (act === "delCopy") {
      if (!confirm("要刪除這篇文案嗎？")) return;
      removeById(db.copies, id);
      saveDB(db);
      toast("已刪除文案");
      renderAll();
    }
    if (act === "copyCopy") {
      var c = findById(db.copies, id);
      if (!c) return;
      copyToClipboard(c.content || "");
    }
  });

  // tool add
  if (formTool) formTool.addEventListener("submit", function (e) {
    e.preventDefault();
    var id = safeText(toolId.value).trim();
    if (!id) id = uid("tool");
    var name = safeText(toolName.value).trim();
    if (!name) { toast("工具名稱必填"); return; }

    db.tools.push({
      id: id,
      name: name,
      desc: safeText(toolDesc.value),
      createdAt: nowISO()
    });
    saveDB(db);
    toast("工具已新增");
    formTool.reset();
    renderAll();
  });

  // tool list delegation
  if (toolList) toolList.addEventListener("click", function (e) {
    var btn = e.target;
    if (!btn || !btn.getAttribute) return;
    var act = btn.getAttribute("data-act");
    var id = btn.getAttribute("data-id");
    if (!act || !id) return;

    if (act === "delTool") {
      if (!confirm("要刪除這個工具嗎？")) return;
      removeById(db.tools, id);
      saveDB(db);
      toast("已刪除工具");
      renderAll();
    }
    if (act === "copyTool") {
      var t = findById(db.tools, id);
      if (!t) return;
      var text = "【工具】" + t.name + "\n\n" + (t.desc || "");
      copyToClipboard(text);
    }
  });

  // video add
  if (formVideo) formVideo.addEventListener("submit", function (e) {
    e.preventDefault();
    var id = safeText(videoId.value).trim();
    if (!id) id = uid("video");
    var title = safeText(videoTitle.value).trim();
    var url = safeText(videoUrl.value).trim();
    var series = videoSeries.value;

    if (!title) { toast("影片標題必填"); return; }
    if (!url) { toast("影片連結必填"); return; }

    db.videos.push({
      id: id,
      title: title,
      url: url,
      series: series,
      createdAt: nowISO()
    });
    saveDB(db);
    toast("影片已新增");
    formVideo.reset();
    renderAll();
    renderInventory("videos");
  });

  // inventory tabs
  if (invTabs && invTabs.length) {
    for (var t = 0; t < invTabs.length; t++) {
      invTabs[t].addEventListener("click", function () {
        for (var j = 0; j < invTabs.length; j++) invTabs[j].classList.remove("active");
        this.classList.add("active");
        var type = this.getAttribute("data-inv") || "videos";
        renderInventory(type);
      });
    }
  }

  // publish add
  if (formPublish) formPublish.addEventListener("submit", function (e) {
    e.preventDefault();

    var tid = publishTheme.value;
    var vid = publishVideo.value;
    var toid = publishTool.value;

    var t = findById(db.themes, tid);
    var v = findById(db.videos, vid);
    var tool = findById(db.tools, toid);

    if (!t) { toast("請選主題"); return; }
    if (!v) { toast("請選影片"); return; }
    if (!tool) { toast("請選工具"); return; }

    var mid = publishModule.value;
    var cid = publishCopy.value;
    var m = mid ? findById(db.modules, mid) : null;
    var c = cid ? findById(db.copies, cid) : null;

    var pub = {
      id: uid("publish"),
      themeId: t.id,
      themeSentence: t.sentence,
      videoId: v.id,
      videoTitle: v.title,
      videoUrl: v.url,
      toolId: tool.id,
      toolName: tool.name,
      moduleId: m ? m.id : "",
      moduleTitle: m ? m.title : "",
      copyId: c ? c.id : "",
      copyTitle: c ? c.title : "",
      note: safeText(publishNote.value).trim(),
      createdAt: nowISO()
    };

    db.publishes.push(pub);
    saveDB(db);
    toast("發佈套件已建立");
    formPublish.reset();
    renderAll();
  });

  // publish list delegation
  if (publishList) publishList.addEventListener("click", function (e) {
    var btn = e.target;
    if (!btn || !btn.getAttribute) return;
    var act = btn.getAttribute("data-act");
    var id = btn.getAttribute("data-id");
    if (!act || !id) return;

    if (act === "delPublish") {
      if (!confirm("要刪除這個發佈套件嗎？")) return;
      removeById(db.publishes, id);
      saveDB(db);
      toast("已刪除發佈套件");
      renderAll();
    }
    if (act === "copyPublish") {
      var p = findById(db.publishes, id);
      if (!p) return;
      var lines = [];
      lines.push("【發佈套件】" + (p.themeSentence || ""));
      lines.push("影片：" + (p.videoTitle || "") + (p.videoUrl ? "（" + p.videoUrl + "）" : ""));
      lines.push("工具：" + (p.toolName || ""));
      if (p.moduleTitle) lines.push("模組：" + p.moduleTitle);
      if (p.copyTitle) lines.push("文案：" + p.copyTitle);
      if (p.note) lines.push("備註：" + p.note);
      copyToClipboard(lines.join("\n"));
    }
  });

  // course add
  if (formCourse) formCourse.addEventListener("submit", function (e) {
    e.preventDefault();
    var id = safeText(courseId.value).trim();
    if (!id) id = uid("course");
    var name = safeText(courseName.value).trim();
    if (!name) { toast("課程名稱必填"); return; }

    db.courses.push({
      id: id,
      name: name,
      desc: safeText(courseDesc.value).trim(),
      moduleIds: [],
      createdAt: nowISO()
    });
    saveDB(db);
    toast("課程已新增");
    formCourse.reset();
    renderAll();
  });

  // assign module to course
  if (formAssign) formAssign.addEventListener("submit", function (e) {
    e.preventDefault();
    var cid = assignCourse.value;
    var mid = assignModule.value;
    if (!cid || !mid) { toast("請選課程與模組"); return; }
    var c = findById(db.courses, cid);
    var m = findById(db.modules, mid);
    if (!c || !m) { toast("資料不存在"); return; }

    if (!c.moduleIds) c.moduleIds = [];
    // 去重
    for (var i = 0; i < c.moduleIds.length; i++) {
      if (c.moduleIds[i] === mid) { toast("這個模組已在課程中"); return; }
    }
    c.moduleIds.push(mid);
    saveDB(db);
    toast("已加入模組");
    renderAll();
  });

  // course list delegation
  if (courseList) courseList.addEventListener("click", function (e) {
    var btn = e.target;
    if (!btn || !btn.getAttribute) return;
    var act = btn.getAttribute("data-act");
    var id = btn.getAttribute("data-id");
    if (!act || !id) return;

    if (act === "delCourse") {
      if (!confirm("要刪除這個課程嗎？")) return;
      removeById(db.courses, id);
      saveDB(db);
      toast("已刪除課程");
      renderAll();
    }
    if (act === "copyCourse") {
      var c = findById(db.courses, id);
      if (!c) return;
      var lines = [];
      lines.push("【課程】" + (c.name || ""));
      if (c.desc) lines.push("描述：" + c.desc);
      lines.push("模組：");
      if (c.moduleIds && c.moduleIds.length) {
        for (var i = 0; i < c.moduleIds.length; i++) {
          var m = findById(db.modules, c.moduleIds[i]);
          lines.push("- " + (m ? m.title : c.moduleIds[i]));
        }
      } else {
        lines.push("-（尚未加入）");
      }
      copyToClipboard(lines.join("\n"));
    }
  });

  // idea add
  if (formIdea) formIdea.addEventListener("submit", function (e) {
    e.preventDefault();
    var title = safeText(ideaTitle.value).trim();
    var desc = safeText(ideaDesc.value).trim();
    if (!title) { toast("標題必填"); return; }

    db.ideas.push({
      id: uid("idea"),
      title: title,
      desc: desc,
      createdAt: nowISO()
    });
    saveDB(db);
    toast("發想已儲存");
    formIdea.reset();
    renderAll();
  });

  // idea list delegation
  if (ideaList) ideaList.addEventListener("click", function (e) {
    var btn = e.target;
    if (!btn || !btn.getAttribute) return;
    var act = btn.getAttribute("data-act");
    var id = btn.getAttribute("data-id");
    if (!act || !id) return;

    if (act === "delIdea") {
      if (!confirm("要刪除這筆發想嗎？")) return;
      removeById(db.ideas, id);
      saveDB(db);
      toast("已刪除發想");
      renderAll();
    }
    if (act === "copyIdea") {
      var it = findById(db.ideas, id);
      if (!it) return;
      copyToClipboard("【發想】" + it.title + "\n\n" + (it.desc || ""));
    }
  });

  // export/import
  function doExport() {
    var data = JSON.stringify(db, null, 2);
    var blob = new Blob([data], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "happy-lab-v0.3.2-" + new Date().toISOString().split("T")[0] + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 0);
    toast("已匯出 JSON");
  }
  function handleImport(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var obj = JSON.parse(reader.result);
        if (!obj || typeof obj !== "object") throw new Error("bad");
        // 只接受我們需要的欄位
        var base = defaultDB();
        for (var k in base) {
          if (base.hasOwnProperty(k)) {
            if (obj[k] != null) base[k] = obj[k];
          }
        }
        db = base;
        saveDB(db);
        toast("已匯入 JSON");
        renderAll();
      } catch (e) {
        toast("匯入失敗：檔案不是有效的 JSON");
      }
    };
    reader.readAsText(file);
  }

  if (btnExport) btnExport.addEventListener("click", doExport);
  if (btnExport2) btnExport2.addEventListener("click", doExport);
  if (fileImport) fileImport.addEventListener("change", function () { handleImport(this.files && this.files[0]); this.value = ""; });
  if (fileImport2) fileImport2.addEventListener("change", function () { handleImport(this.files && this.files[0]); this.value = ""; });

  // clear
  if (btnClearAll) btnClearAll.addEventListener("click", function () {
    if (!confirm("確定要清除所有資料嗎？（不可復原）")) return;
    localStorage.removeItem(KEY);
    db = defaultDB();
    saveDB(db);
    toast("已清除");
    renderAll();
  });

  // quick demo
  if (btnQuickAddDemo) btnQuickAddDemo.addEventListener("click", addDemo);

  // ======= render all =======
  function renderAll() {
    renderStats();
    syncSelects();
    renderThemeList();
    renderToolList();
    renderModuleList();
    renderCopyList();
    renderPublishList();
    renderCourseList();
    renderIdeaList();

    // inventory default: 看目前 active tab
    var activeTab = qs(".tab.active");
    var inv = activeTab ? activeTab.getAttribute("data-inv") : "videos";
    renderInventory(inv);

    // last match
    renderMatch(db._lastMatch);
  }

  // ======= init =======
  renderAll();

})();
