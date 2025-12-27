/* happy-lab v0.3.2.1 app.js
   Fix:
   1) 主題下拉「自動綁定」：不再依賴單一 id，避免 HTML 調整後下拉變空
   2) localStorage 資料遷移：換版本 KEY 後，舊資料不會消失
*/

(function () {
  "use strict";

  // ===== utils =====
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function safeText(s) { return (s == null) ? "" : String(s); }
  function nowISO() { return new Date().toISOString(); }
  function uid(prefix) {
    var t = new Date().getTime();
    var r = Math.floor(Math.random() * 100000);
    return (prefix || "id") + "-" + t + "-" + r;
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
    try { document.execCommand("copy"); toast("已複製到剪貼簿"); }
    catch (e) { toast("複製失敗，請手動複製"); }
    document.body.removeChild(ta);
  }

  function norm(s) {
    s = safeText(s).toLowerCase();
    var rep = ["｜", "|", "×", "／", "/", "，", ",", "。", ".", "「", "」", "（", "）", "(", ")", "—", "-", "_", ":", "：", " "];
    for (var i = 0; i < rep.length; i++) s = s.split(rep[i]).join(" ");
    return s.replace(/\s+/g, " ").trim();
  }
  function keywords(s) {
    s = norm(s);
    if (!s) return [];
    var arr = s.split(" ");
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var w = arr[i].trim();
      if (w && w.length >= 2) out.push(w);
    }
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

  // ===== storage =====
  var KEY = "happyLab_v0_3_2"; // 目前 key

  function defaultDB() {
    return {
      meta: { version: "0.3.2.1", updatedAt: nowISO() },
      themes: [],
      tools: [],
      videos: [],
      copies: [],
      modules: [],
      publishes: [],
      courses: [],
      ideas: [],
      _lastMatch: null
    };
  }

  // ✅ 舊資料遷移：避免你「換 KEY」後看起來像全空
  var MIGRATE_KEYS = [
    "happyLab_v0_3_2",
    "happyLab_v0_3_1",
    "happyLab_v0_3",
    "happyLab_v0_2",
    "happyLab",
    "happy-lab",
    "happy_lab"
  ];

  function loadFromAnyKey() {
    for (var i = 0; i < MIGRATE_KEYS.length; i++) {
      var k = MIGRATE_KEYS[i];
      try {
        var raw = localStorage.getItem(k);
        if (!raw) continue;
        var obj = JSON.parse(raw);
        if (obj && typeof obj === "object" && (obj.themes || obj.tools || obj.videos)) {
          return { key: k, obj: obj };
        }
      } catch (e) {}
    }
    return null;
  }

  function normalizeDB(obj) {
    var base = defaultDB();
    if (!obj || typeof obj !== "object") return base;
    for (var k in base) {
      if (base.hasOwnProperty(k)) {
        if (obj[k] != null) base[k] = obj[k];
      }
    }
    if (!base.meta) base.meta = { version: "0.3.2.1", updatedAt: nowISO() };
    return base;
  }

  function loadDB() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return normalizeDB(JSON.parse(raw));
    } catch (e) {}

    // 沒讀到 KEY → 試著從舊 key 搬
    var found = loadFromAnyKey();
    if (found && found.obj) {
      var migrated = normalizeDB(found.obj);
      migrated.meta.version = "0.3.2.1";
      migrated.meta.updatedAt = nowISO();
      try { localStorage.setItem(KEY, JSON.stringify(migrated)); } catch (e2) {}
      return migrated;
    }

    return defaultDB();
  }

  function saveDB(db) {
    db.meta.updatedAt = nowISO();
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  var db = loadDB();

  // ===== find helpers =====
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

  // ===== DOM: views/nav =====
  var navItems = qsa(".navItem");
  var views = qsa(".view");

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
    renderAll();
  }

  for (var ni = 0; ni < navItems.length; ni++) {
    navItems[ni].addEventListener("click", function () {
      var name = this.getAttribute("data-view");
      if (name) openView(name);
    });
  }

  // ====== ✅ 主題下拉「自動抓」：不怕你改 id ======
  function getThemeSelects() {
    // 1) 你如果有加 data-bind="theme" 最穩
    var list = qsa('select[data-bind="theme"]');

    // 2) 沒加也沒關係：抓 id/name 可能包含 theme 的
    if (!list.length) {
      var allSel = qsa("select");
      for (var i = 0; i < allSel.length; i++) {
        var id = safeText(allSel[i].id).toLowerCase();
        var nm = safeText(allSel[i].name).toLowerCase();
        if (id.indexOf("theme") >= 0 || nm.indexOf("theme") >= 0 || id.indexOf("subject") >= 0 || nm.indexOf("subject") >= 0) {
          list.push(allSel[i]);
        }
      }
    }

    // 3) 再補：常見固定 id（你之前版本用過）
    var maybeIds = ["matchTheme", "spellTheme", "copySpellTheme", "publishTheme", "tplTheme", "templateTheme", "themeSelect"];
    for (var j = 0; j < maybeIds.length; j++) {
      var el = qs("#" + maybeIds[j]);
      if (el && list.indexOf(el) < 0) list.push(el);
    }
    return list;
  }

  function fillSelect(sel, options, emptyLabel) {
    if (!sel) return;
    var html = "";
    if (emptyLabel) html += '<option value="">' + escapeHtml(emptyLabel) + "</option>";
    for (var i = 0; i < options.length; i++) {
      html += '<option value="' + escapeHtml(options[i].value) + '">' + escapeHtml(options[i].label) + "</option>";
    }
    sel.innerHTML = html;
  }

  function syncThemeSelects() {
    var themeSelects = getThemeSelects();
    var themeOpts = db.themes.slice()
      .sort(function (a, b) { return (a.createdAt < b.createdAt) ? 1 : -1; })
      .map(function (t) { return { value: t.id, label: (t.sentence || t.id) }; });

    for (var i = 0; i < themeSelects.length; i++) {
      fillSelect(themeSelects[i], themeOpts, "請選主題");
    }
  }

  // ======= 你畫面上的「生成模板」功能（最小可用版，先救主題下拉） =======
  var formCopySpell = qs("#formCopySpell");
  var copySpellTheme = qs("#copySpellTheme") || qs('select[data-bind="theme"]') || qs("select");
  var copySpellSeries = qs("#copySpellSeries");
  var copySpellCtaTone = qs("#copySpellCtaTone");
  var copySpellSave = qs("#copySpellSave");
  var copySpellResult = qs("#copySpellResult");
  var btnCopySpellToClipboard = qs("#btnCopySpellToClipboard");

  function genCopyTemplate(themeObj, series, ctaTone) {
    var sentence = themeObj.sentence || "";
    var pain = themeObj.pain || "";
    var scenario = themeObj.scenario || "";
    var toolHint = themeObj.toolHint || "";
    var seriesName = safeText(series);

    var cta = safeText(ctaTone).trim();
    if (!cta) cta = "回主頁領工具｜每週更新｜把心站穩，活出自在幸福感";

    var lines = [];
    lines.push("【架構＋工具＋留言＋CTA（可存成草稿）】");
    lines.push("主題一句：" + sentence);
    if (pain) lines.push("觀眾卡點：" + pain);
    if (scenario) lines.push("情境：" + scenario);
    lines.push("");

    lines.push("A. Hook（3–15 秒）");
    lines.push("你有沒有發現——孩子不是故意失控，是『想要一來，剎車還沒裝好』。");
    lines.push("");

    lines.push("B. 承諾（你會得到什麼）");
    lines.push("這集不教你管孩子，我帶你用一個『不說教的工具』，陪孩子把剎車系統裝回來。");
    lines.push("");

    lines.push("C. 正文（你可把故事貼進來）");
    lines.push("✅ 1) 完整故事（請貼：孩子怎麼說、怎麼猶豫、怎麼放回去…）");
    lines.push("✅ 2) 腦科學一句（親民版）：前額葉=剎車；杏仁核=警報；練習就是在幫剎車長肌肉。");
    lines.push("✅ 3) 好用工具：需要/想要口袋卡 + 紅綠燈30秒踩煞車 + 『我等一下』+1");
    if (toolHint) lines.push("✅ 4) 你這集工具提示：" + toolHint);
    lines.push("✅ 5) 留言互動：今天你家有沒有『等一下』成功一次？留言 +1");
    lines.push("");

    lines.push("D. CTA（導到主頁）");
    lines.push(cta);

    return lines.join("\n");
  }

  if (formCopySpell) {
    formCopySpell.addEventListener("submit", function (e) {
      e.preventDefault();

      var tid = copySpellTheme ? copySpellTheme.value : "";
      var t = findById(db.themes, tid);
      if (!t) {
        toast("主題庫是空的：請先到『主題實驗室』新增一筆主題");
        return;
      }

      var series = copySpellSeries ? copySpellSeries.value : "幸福教養";
      var ctaTone = copySpellCtaTone ? copySpellCtaTone.value : "";

      var temp = genCopyTemplate(t, series, ctaTone);
      if (copySpellResult) copySpellResult.textContent = temp;

      if (copySpellSave && copySpellSave.value === "yes") {
        db.copies.push({
          id: uid("copy"),
          title: t.sentence + "｜" + series + "｜草稿 v1",
          series: series,
          content: temp,
          createdAt: nowISO()
        });
        saveDB(db);
        toast("已存成草稿");
        renderAll();
      } else {
        toast("模板已生成");
      }
    });
  }

  if (btnCopySpellToClipboard) {
    btnCopySpellToClipboard.addEventListener("click", function () {
      copyToClipboard(copySpellResult ? copySpellResult.textContent : "");
    });
  }

  // ===== 主題新增（如果你主題表單存在，就能新增；不存在也不會壞） =====
  var formTheme = qs("#formTheme");
  var themeId = qs("#themeId");
  var themeSentence = qs("#themeSentence");
  var themePain = qs("#themePain");
  var themeScenario = qs("#themeScenario");
  var themeVideo = qs("#themeVideo");
  var themeToolHint = qs("#themeToolHint");
  var themeList = qs("#themeList");

  function renderThemeList() {
    if (!themeList) return;
    if (!db.themes.length) {
      themeList.innerHTML = '<div class="muted">目前主題庫是空的，所以「請選主題」會沒有選項。請先新增一筆主題，或加入示範資料。</div>';
      return;
    }
    var html = "";
    var items = db.themes.slice().sort(function (a, b) { return (a.createdAt < b.createdAt) ? 1 : -1; });
    for (var i = 0; i < items.length; i++) {
      var t = items[i];
      html += '<div class="item">';
      html +=   '<div class="itemMain">';
      html +=     '<div class="itemTitle">' + escapeHtml(t.sentence || "(無標題)") + '</div>';
      html +=     '<div class="itemMeta muted">ID：' + escapeHtml(t.id) + '</div>';
      html +=   '</div>';
      html +=   '<div class="itemActions">';
      html +=     '<button class="btn small ghost" data-act="copyTheme" data-id="' + escapeHtml(t.id) + '">複製</button>';
      html +=     '<button class="btn small danger" data-act="delTheme" data-id="' + escapeHtml(t.id) + '">刪除</button>';
      html +=   '</div>';
      html += '</div>';
    }
    themeList.innerHTML = html;
  }

  if (formTheme) {
    formTheme.addEventListener("submit", function (e) {
      e.preventDefault();
      var id = themeId ? safeText(themeId.value).trim() : "";
      if (!id) id = uid("theme");
      var sentence = themeSentence ? safeText(themeSentence.value).trim() : "";
      if (!sentence) { toast("主題一句必填"); return; }

      db.themes.push({
        id: id,
        sentence: sentence,
        pain: themePain ? safeText(themePain.value).trim() : "",
        scenario: themeScenario ? safeText(themeScenario.value).trim() : "",
        video: themeVideo ? safeText(themeVideo.value).trim() : "",
        toolHint: themeToolHint ? safeText(themeToolHint.value).trim() : "",
        createdAt: nowISO()
      });
      saveDB(db);
      toast("主題已新增");
      if (formTheme.reset) formTheme.reset();
      renderAll();
    });
  }

  if (themeList) {
    themeList.addEventListener("click", function (e) {
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
        var text = "【主題】" + (t.sentence || "") +
          "\n卡點：" + (t.pain || "-") +
          "\n情境：" + (t.scenario || "-") +
          "\n工具提示：" + (t.toolHint || "-");
        copyToClipboard(text);
      }
    });
  }

  // ===== demo seed button（如果存在）=====
  var btnQuickAddDemo = qs("#btnQuickAddDemo");
  function addDemo() {
    if (db.themes.length) { toast("你已有主題，不重複加示範"); return; }
    db.themes.push({
      id: "theme-demo-01",
      sentence: "無欲則剛｜孩子學會等一下，選擇力就開始長出來",
      pain: "孩子一遇到想要就失控、忍不住、停不下來",
      scenario: "超市｜看到想買的東西",
      video: "",
      toolHint: "需要/想要口袋卡＋紅綠燈30秒踩煞車＋我等一下 +1",
      createdAt: nowISO()
    });
    saveDB(db);
    toast("已加入示範主題");
    renderAll();
  }
  if (btnQuickAddDemo) btnQuickAddDemo.addEventListener("click", addDemo);

  // ===== render all =====
  function renderAll() {
    syncThemeSelects();
    renderThemeList();
  }

  // init
  renderAll();

})();
