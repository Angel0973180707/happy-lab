/* =========================================================
幸福教養｜研發室 happy-lab v0.3.2.2
- 完整 CRUD：themes / tools / videos / copies / modules / publishes / courses / ideas
- 完整下拉同步：主題/工具/影片/模組/文案/課程
- 匯出/匯入 JSON（含合併與覆蓋）
- Inventory Tabs（影片/工具/文案）
- 配對推薦（簡單可用版）
- 一鍵把配對結果建立發佈套件
- stats 統計
- 首次使用若全空：自動放入一筆示範主題/工具（可立刻測）
========================================================= */

(function () {
"use strict";

// ---------- utils ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const nowISO = () => new Date().toISOString();
const uid = (prefix = "id") => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const s = (v) => (v == null ? "" : String(v));
const esc = (str) =>
s(str)
.replaceAll("&", "&amp;")
.replaceAll("<", "&lt;")
.replaceAll(">", "&gt;")
.replaceAll('"', "&quot;")
.replaceAll("'", "&#39;");

function toast(msg) {
const el = $("#toast");
if (!el) return;
el.textContent = msg;
el.classList.add("show");
setTimeout(() => el.classList.remove("show"), 1600);
}

async function copyText(text) {
text = s(text);
try {
await navigator.clipboard.writeText(text);
toast("已複製到剪貼簿");
} catch (e) {
const ta = document.createElement("textarea");
ta.value = text;
ta.setAttribute("readonly", "readonly");
ta.style.position = "fixed";
ta.style.opacity = "0";
document.body.appendChild(ta);
ta.select();
try {
document.execCommand("copy");
toast("已複製到剪貼簿");
} catch (e2) {
toast("複製失敗，請手動複製");
}
document.body.removeChild(ta);
}
}

// ---------- storage ----------
const KEY = "happyLab_v0_3_2"; // 你目前版本 key
const MIGRATE_KEYS = ["happyLab_v0_3_2", "happyLab_v0_3_1", "happyLab_v0_3", "happyLab_v0_2", "happyLab", "happy-lab"];

const defaultDB = () => ({
meta: { version: "0.3.2.2", updatedAt: nowISO() },
themes: [],
tools: [],
videos: [],
copies: [],
modules: [],
publishes: [],
courses: [],
ideas: [],
_lastMatch: null,
_seeded: false
});

function normalizeDB(obj) {
const base = defaultDB();
if (!obj || typeof obj !== "object") return base;
Object.keys(base).forEach((k) => {
if (obj[k] != null) base[k] = obj[k];
});
if (!base.meta) base.meta = { version: "0.3.2.2", updatedAt: nowISO() };
base.meta.version = "0.3.2.2";
base.meta.updatedAt = nowISO();
return base;
}

function loadDB() {
// 先讀本 key
try {
const raw = localStorage.getItem(KEY);
if (raw) return normalizeDB(JSON.parse(raw));
} catch (_) {}

// 沒有就搬舊 key
for (const k of MIGRATE_KEYS) {
try {
const raw = localStorage.getItem(k);
if (!raw) continue;
const obj = JSON.parse(raw);
if (obj && (obj.themes || obj.tools || obj.videos)) {
const db = normalizeDB(obj);
localStorage.setItem(KEY, JSON.stringify(db));
return db;
}
} catch (_) {}
}

return defaultDB();
}

function saveDB() {
db.meta.updatedAt = nowISO();
localStorage.setItem(KEY, JSON.stringify(db));
renderStats();
syncAllSelects();
}

let db = loadDB();

// ---------- seed (首次空資料時，給你能立刻測功能的基本資料) ----------
function seedIfEmpty() {
if (db._seeded) return;
const isEmpty =
db.themes.length === 0 &&
db.tools.length === 0 &&
db.videos.length === 0 &&
db.copies.length === 0 &&
db.modules.length === 0 &&
db.publishes.length === 0 &&
db.courses.length === 0 &&
db.ideas.length === 0;

if (!isEmpty) {
db._seeded = true;
saveDB();
return;
}

const t1 = {
id: "theme-demo-01",
sentence: "無欲則剛｜孩子學會等一下，選擇力就開始長出來",
pain: "孩子一遇到想要就失控、忍不住、停不下來",
scenario: "超市｜看到想買的東西",
video: "",
toolHint: "需要/想要口袋卡＋紅綠燈30秒踩煞車＋『我等一下』+1",
createdAt: nowISO()
};
const tool1 = {
id: "tool-demo-need-want",
name: "需要/想要 口袋卡",
desc:
"孩子想買時，先問兩句：\n1) 這是需要還是想要？\n2) 如果等10分鐘，我還想要嗎？\n\n家長可照念：\n『我們先把剎車踩一下，等一下再決定。』",
createdAt: nowISO()
};
db.themes.push(t1);
db.tools.push(tool1);
db._seeded = true;
saveDB();
}

// ---------- navigation ----------
const navItems = $$(".navItem");
const views = $$(".view");

function openView(viewName) {
navItems.forEach((b) => b.classList.toggle("active", b.dataset.view === viewName));
views.forEach((v) => v.classList.toggle("active", v.id === `view-${viewName}`));
// 切頁就 render 當頁清單（避免你以為沒資料）
renderAllLists();
syncAllSelects();
}

navItems.forEach((b) => b.addEventListener("click", () => openView(b.dataset.view)));

// ---------- select helpers ----------
function fillSelect(el, options, placeholder = "請選") {
if (!el) return;
const prev = el.value;
el.innerHTML =
`<option value="">${esc(placeholder)}</option>` +
options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("");
// 盡量保留原選擇
if (prev && options.some((o) => o.value === prev)) el.value = prev;
}

function syncAllSelects() {
// themes
const themeOptions = db.themes
.slice()
.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
.map((t) => ({ value: t.id, label: t.sentence || t.id }));

[
$("#matchTheme"),
$("#spellTheme"),
$("#copySpellTheme"),
$("#publishTheme")
].forEach((sel) => fillSelect(sel, themeOptions, "請選主題"));

// tools
const toolOptions = db.tools
.slice()
.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
.map((t) => ({ value: t.id, label: t.name || t.id }));
fillSelect($("#publishTool"), toolOptions, "請選工具");

// videos
const videoOptions = db.videos
.slice()
.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
.map((v) => ({ value: v.id, label: `${v.title || v.id}` }));
fillSelect($("#publishVideo"), videoOptions, "請選影片");

// modules
const moduleOptions = db.modules
.slice()
.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
.map((m) => ({ value: m.id, label: `${m.type || "-"}｜${m.title || m.id}` }));
fillSelect($("#publishModule"), moduleOptions, "（不選）");
fillSelect($("#assignModule"), moduleOptions, "請選模組");

// copies
const copyOptions = db.copies
.slice()
.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
.map((c) => ({ value: c.id, label: `${c.title || c.id}` }));
fillSelect($("#publishCopy"), copyOptions, "（不選）");

// courses
const courseOptions = db.courses
.slice()
.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
.map((c) => ({ value: c.id, label: c.name || c.id }));
fillSelect($("#assignCourse"), courseOptions, "請選課程");
}

// ---------- stats ----------
function renderStats() {
const el = $("#stats");
if (!el) return;
const items = [
["主題", db.themes.length],
["工具", db.tools.length],
["影片", db.videos.length],
["模組", db.modules.length],
["文案", db.copies.length],
["套件", db.publishes.length],
["課程", db.courses.length],
["發想", db.ideas.length]
];
el.innerHTML = items
.map(
([k, v]) =>
`<div class="stat"><div class="statK">${esc(k)}</div><div class="statV">${esc(v)}</div></div>`
)
.join("");
}

// ---------- common list renderer ----------
function renderList(container, items, renderItem) {
if (!container) return;
if (!items.length) {
container.innerHTML = `<div class="muted">目前沒有資料。</div>`;
return;
}
container.innerHTML = items.map(renderItem).join("");
}

function bySearch(items, text, fields) {
text = s(text).trim().toLowerCase();
if (!text) return items;
return items.filter((it) => fields.some((f) => s(it[f]).toLowerCase().includes(text)));
}

// ---------- Theme Lab ----------
const formTheme = $("#formTheme");
const themeList = $("#themeList");
const themeSearch = $("#themeSearch");
const themeSort = $("#themeSort");

function renderThemeList() {
if (!themeList) return;
let items = db.themes.slice();
items = bySearch(items, themeSearch?.value, ["id", "sentence", "pain", "scenario"]);
const sort = themeSort?.value || "new";
if (sort === "new") items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
if (sort === "old") items.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
if (sort === "az") items.sort((a, b) => s(a.sentence).localeCompare(s(b.sentence), "zh-Hant"));

renderList(themeList, items, (t) => {
return `
<div class="item">
<div class="itemMain">
<div class="itemTitle">${esc(t.sentence || "(無主題一句)")}</div>
<div class="itemMeta muted">
${t.pain ? "卡點：" + esc(t.pain) + "<br/>" : ""}
${t.scenario ? "情境：" + esc(t.scenario) + "<br/>" : ""}
<span>id：${esc(t.id)}</span>
</div>
</div>
<div class="itemActions">
<button class="btn small ghost" data-act="copy-theme" data-id="${esc(t.id)}">複製</button>
<button class="btn small danger" data-act="del-theme" data-id="${esc(t.id)}">刪除</button>
</div>
</div>`;
});
}

formTheme?.addEventListener("submit", (e) => {
e.preventDefault();
const id = s($("#themeId")?.value).trim() || uid("theme");
const sentence = s($("#themeSentence")?.value).trim();
if (!sentence) return toast("主題一句必填");
db.themes.push({
id,
sentence,
pain: s($("#themePain")?.value).trim(),
scenario: s($("#themeScenario")?.value).trim(),
video: s($("#themeVideo")?.value).trim(),
toolHint: s($("#themeToolHint")?.value).trim(),
createdAt: nowISO()
});
saveDB();
formTheme.reset();
toast("主題已新增");
renderThemeList();
});

themeSearch?.addEventListener("input", renderThemeList);
themeSort?.addEventListener("change", renderThemeList);

themeList?.addEventListener("click", (e) => {
const btn = e.target.closest("button[data-act]");
if (!btn) return;
const act = btn.dataset.act;
const id = btn.dataset.id;
const t = db.themes.find((x) => x.id === id);
if (!t) return;

if (act === "copy-theme") {
copyText(
`【主題】${t.sentence}\n卡點：${t.pain || "-"}\n情境：${t.scenario || "-"}\n工具提示：${t.toolHint || "-"}`
);
}
if (act === "del-theme") {
if (!confirm("確定刪除此主題？")) return;
db.themes = db.themes.filter((x) => x.id !== id);
saveDB();
toast("已刪除主題");
renderThemeList();
}
});

// ---------- Tool Lab ----------
const formTool = $("#formTool");
const toolList = $("#toolList");
const toolSearch = $("#toolSearch");

function renderToolList() {
if (!toolList) return;
let items = db.tools.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
items = bySearch(items, toolSearch?.value, ["id", "name", "desc"]);
renderList(toolList, items, (t) => `
<div class="item">
<div class="itemMain">
<div class="itemTitle">${esc(t.name || "(無名稱)")}</div>
<div class="itemMeta muted">id：${esc(t.id)}</div>
</div>
<div class="itemActions">
<button class="btn small ghost" data-act="copy-tool" data-id="${esc(t.id)}">複製</button>
<button class="btn small danger" data-act="del-tool" data-id="${esc(t.id)}">刪除</button>
</div>
</div>
`);
}

formTool?.addEventListener("submit", (e) => {
e.preventDefault();
const id = s($("#toolId")?.value).trim() || uid("tool");
const name = s($("#toolName")?.value).trim();
if (!name) return toast("工具名稱必填");
db.tools.push({
id,
name,
desc: s($("#toolDesc")?.value).trim(),
createdAt: nowISO()
});
saveDB();
formTool.reset();
toast("工具已新增");
renderToolList();
});

toolSearch?.addEventListener("input", renderToolList);

toolList?.addEventListener("click", (e) => {
const btn = e.target.closest("button[data-act]");
if (!btn) return;
const act = btn.dataset.act;
const id = btn.dataset.id;
const t = db.tools.find((x) => x.id === id);
if (!t) return;

if (act === "copy-tool") copyText(`【工具】${t.name}\n\n${t.desc || ""}`);
if (act === "del-tool") {
if (!confirm("確定刪除此工具？")) return;
db.tools = db.tools.filter((x) => x.id !== id);
saveDB();
toast("已刪除工具");
renderToolList();
}
});

// ---------- Inventory Lab (videos/tools/copies) ----------
const inventoryPanel = $("#inventoryPanel");
const invTabs = $$(".tab");

let invMode = "videos";
invTabs.forEach((t) =>
t.addEventListener("click", () => {
invTabs.forEach((x) => x.classList.toggle("active", x.dataset.inv === t.dataset.inv));
invMode = t.dataset.inv;
renderInventory();
})
);

function renderInventory() {
if (!inventoryPanel) return;
if (invMode === "videos") {
const items = db.videos.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
renderList(inventoryPanel, items, (v) => `
<div class="item">
<div class="itemMain">
<div class="itemTitle">${esc(v.title || "(無標題)")}</div>
<div class="itemMeta muted">${esc(v.series || "-")} · id：${esc(v.id)}</div>
<div class="itemMeta muted">${v.url ? "連結：" + esc(v.url) : ""}</div>
</div>
<div class="itemActions">
<button class="btn small ghost" data-act="copy-video" data-id="${esc(v.id)}">複製</button>
<button class="btn small danger" data-act="del-video" data-id="${esc(v.id)}">刪除</button>
</div>
</div>
`);
}
if (invMode === "tools") {
const items = db.tools.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
renderList(inventoryPanel, items, (t) => `
<div class="item">
<div class="itemMain">
<div class="itemTitle">${esc(t.name || "(無名稱)")}</div>
<div class="itemMeta muted">id：${esc(t.id)}</div>
</div>
<div class="itemActions">
<button class="btn small ghost" data-act="copy-tool2" data-id="${esc(t.id)}">複製</button>
</div>
</div>
`);
}
if (invMode === "copies") {
const items = db.copies.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
renderList(inventoryPanel, items, (c) => `
<div class="item">
<div class="itemMain">
<div class="itemTitle">${esc(c.title || "(無標題)")}</div>
<div class="itemMeta muted">${esc(c.series || "-")} · id：${esc(c.id)}</div>
</div>
<div class="itemActions">
<button class="btn small ghost" data-act="copy-copy2" data-id="${esc(c.id)}">複製</button>
</div>
</div>
`);
}
}

// ---------- Video add (Inventory) ----------
const formVideo = $("#formVideo");
formVideo?.addEventListener("submit", (e) => {
e.preventDefault();
const id = s($("#videoId")?.value).trim() || uid("video");
const title = s($("#videoTitle")?.value).trim();
const url = s($("#videoUrl")?.value).trim();
const series = s($("#videoSeries")?.value).trim();
if (!title) return toast("影片標題必填");
if (!url) return toast("影片連結必填");
db.videos.push({ id, title, url, series, createdAt: nowISO() });
saveDB();
formVideo.reset();
toast("影片已新增");
renderInventory();
});

inventoryPanel?.addEventListener("click", (e) => {
const btn = e.target.closest("button[data-act]");
if (!btn) return;
const act = btn.dataset.act;
const id = btn.dataset.id;

if (act === "copy-video") {
const v = db.videos.find((x) => x.id === id);
if (v) copyText(`【影片】${v.title}\n系列：${v.series}\n連結：${v.url}`);
}
if (act === "del-video") {
if (!confirm("確定刪除影片？")) return;
db.videos = db.videos.filter((x) => x.id !== id);
saveDB();
renderInventory();
toast("已刪除影片");
}
if (act === "copy-tool2") {
const t = db.tools.find((x) => x.id === id);
if (t) copyText(`【工具】${t.name}\n\n${t.desc || ""}`);
}
if (act === "copy-copy2") {
const c = db.copies.find((x) => x.id === id);
if (c) copyText(c.content || "");
}
});

// ---------- Spell Lab (生成模組) ----------
const formSpell = $("#formSpell");
const spellResult = $("#spellResult");
const btnOpenModuleLab = $("#btnOpenModuleLab");

function genModule(themeObj, type, version, flavor) {
const baseTitle = themeObj?.sentence || "（未命名主題）";
const title = `${baseTitle}｜${type}模組｜${version || "v1"}`;
const f = s(flavor).trim();

const toolLine = themeObj.toolHint ? `工具提示：${themeObj.toolHint}` : "工具提示：請補一個口袋卡/練習卡";
const pain = themeObj.pain ? `卡點：${themeObj.pain}` : "";

if (type === "A") {
return {
title,
body: [
`【A｜踩煞車＋選擇力】${f ? "（" + f + "）" : ""}`,
`主題：${baseTitle}`,
pain,
`核心一句：先等一下，再決定。`,
toolLine,
``,
`步驟（30–60秒）`,
`1) 大人先穩：4吸6吐 × 2輪`,
`2) 命名：『你很想要，對嗎？』`,
`3) 踩煞車：『我們先等10分鐘』`,
`4) 二選一：『你要現在放回去 +1，還是等一下再看？』`,
`5) 入帳：每成功一次『等一下』＝+1（水滴/點數）`,
``,
`可照念一句：`,
`『我不是不給你，我是在幫你把大腦的剎車裝回來。』`
].filter(Boolean).join("\n")
};
}

return {
title,
body: [
`【B｜柔軟彈性＋感恩善解溝通力】${f ? "（" + f + "）" : ""}`,
`主題：${baseTitle}`,
pain,
`核心一句：先連結，再引導。`,
toolLine,
``,
`步驟（60–90秒）`,
`1) 連結：『我知道你很想要。』`,
`2) 理由：『你想要它，是因為…？（好奇/跟同學/口味/收藏）』`,
`3) 彈性選擇：『我們可以用兩種方式：等一下再決定 / 記在想要清單』`,
`4) 感恩收尾：『謝謝你願意跟我一起練剎車。』`,
``,
`可照念一句：`,
`『我站在你這邊，我們一起把事情說清楚。』`
].filter(Boolean).join("\n")
};
}

formSpell?.addEventListener("submit", (e) => {
e.preventDefault();
const themeId = $("#spellTheme")?.value;
const themeObj = db.themes.find((t) => t.id === themeId);
if (!themeObj) return toast("請先選主題");

const type = (document.querySelector('input[name="spellType"]:checked')?.value) || "A";
const version = s($("#spellVersion")?.value).trim() || "v1";
const flavor = s($("#spellFlavor")?.value).trim();

const mod = genModule(themeObj, type, version, flavor);
const newItem = {
id: uid("module"),
themeId: themeObj.id,
type,
title: mod.title,
content: mod.body,
createdAt: nowISO()
};
db.modules.push(newItem);
saveDB();
if (spellResult) spellResult.textContent = newItem.content;
toast("模組已生成並存入模組庫");
renderModuleList();
});

btnOpenModuleLab?.addEventListener("click", () => openView("moduleLab"));

// ---------- Module Lab ----------
const moduleList = $("#moduleList");
const moduleSearch = $("#moduleSearch");
const moduleFilterType = $("#moduleFilterType");

function renderModuleList() {
if (!moduleList) return;
let items = db.modules.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
items = bySearch(items, moduleSearch?.value, ["id", "title", "content"]);
const ft = moduleFilterType?.value || "all";
if (ft !== "all") items = items.filter((m) => m.type === ft);

renderList(moduleList, items, (m) => `
<div class="item">
<div class="itemMain">
<div class="itemTitle">${esc(m.title || "(無標題)")}</div>
<div class="itemMeta muted">${esc(m.type || "-")} · id：${esc(m.id)}</div>
</div>
<div class="itemActions">
<button class="btn small ghost" data-act="copy-module" data-id="${esc(m.id)}">複製</button>
<button class="btn small danger" data-act="del-module" data-id="${esc(m.id)}">刪除</button>
</div>
</div>
`);
}

moduleSearch?.addEventListener("input", renderModuleList);
moduleFilterType?.addEventListener("change", renderModuleList);

moduleList?.addEventListener("click", (e) => {
const btn = e.target.closest("button[data-act]");
if (!btn) return;
const act = btn.dataset.act;
const id = btn.dataset.id;
const m = db.modules.find((x) => x.id === id);
if (!m) return;

if (act === "copy-module") copyText(m.content || "");
if (act === "del-module") {
if (!confirm("確定刪除此模組？")) return;
db.modules = db.modules.filter((x) => x.id !== id);
saveDB();
toast("已刪除模組");
renderModuleList();
}
});

// ---------- CopySpell (生成模板) ----------
const formCopySpell = $("#formCopySpell");
const copySpellResult = $("#copySpellResult");
const btnCopySpellToClipboard = $("#btnCopySpellToClipboard");

function genCopyTemplate(themeObj, series, ctaTone) {
const sentence = themeObj.sentence || "";
const pain = themeObj.pain || "";
const scenario = themeObj.scenario || "";
const toolHint = themeObj.toolHint || "";

let cta = s(ctaTone).trim();
if (!cta) cta = "回主頁領工具｜每週更新｜把心站穩，活出自在幸福感";

return [
"【架構＋工具＋留言＋CTA（可存成草稿）】",
`系列：${series}`,
`主題一句：${sentence}`,
pain ? `觀眾卡點：${pain}` : "",
scenario ? `情境：${scenario}` : "",
"",
"A. Hook（3–15 秒）",
"你有沒有發現——孩子不是故意失控，是『想要一來，剎車還沒裝好』。",
"",
"B. 承諾",
"這集不教你管孩子，我帶你用一個不說教的方式，陪孩子把剎車系統裝回來。",
"",
"C. 正文（貼你的完整故事）",
"1) 故事：_____（把超市/在家故事貼進來）",
"2) 腦科學一句：前額葉=剎車；練習就是在幫剎車長肌肉。",
`3) 工具：${toolHint || "（請補：需要/想要口袋卡、30秒踩煞車…）"}`,
"4) 留言引導：今天你家有沒有『等一下』成功一次？留言 +1",
"",
"D. CTA（導到主頁）",
cta
].filter(Boolean).join("\n");
}

formCopySpell?.addEventListener("submit", (e) => {
e.preventDefault();
const themeId = $("#copySpellTheme")?.value;
const themeObj = db.themes.find((t) => t.id === themeId);
if (!themeObj) return toast("請先選主題");
const series = $("#copySpellSeries")?.value || "幸福教養";
const ctaTone = $("#copySpellCtaTone")?.value || "";
const saveToDraft = $("#copySpellSave")?.value === "yes";

const content = genCopyTemplate(themeObj, series, ctaTone);
if (copySpellResult) copySpellResult.textContent = content;

if (saveToDraft) {
db.copies.push({
id: uid("copy"),
title: `${themeObj.sentence}｜${series}｜草稿 v1`,
series,
content,
createdAt: nowISO()
});
saveDB();
toast("已生成並存成草稿");
renderCopyList();
} else {
toast("模板已生成");
}
});

btnCopySpellToClipboard?.addEventListener("click", () => copyText(copySpellResult?.textContent || ""));

// ---------- Copy Lab (文案研究室) ----------
const formCopy = $("#formCopy");
const copyList = $("#copyList");
const copySearch = $("#copySearch");

function renderCopyList() {
if (!copyList) return;
let items = db.copies.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
items = bySearch(items, copySearch?.value, ["id", "title", "series", "content"]);
renderList(copyList, items, (c) => `
<div class="item">
<div class="itemMain">
<div class="itemTitle">${esc(c.title || "(無標題)")}</div>
<div class="itemMeta muted">${esc(c.series || "-")} · id：${esc(c.id)}</div>
</div>
<div class="itemActions">
<button class="btn small ghost" data-act="copy-copy" data-id="${esc(c.id)}">複製</button>
<button class="btn small danger" data-act="del-copy" data-id="${esc(c.id)}">刪除</button>
</div>
</div>
`);
}

formCopy?.addEventListener("submit", (e) => {
e.preventDefault();
const title = s($("#copyTitle")?.value).trim();
const series = s($("#copySeries")?.value).trim();
const content = s($("#copyContent")?.value);
if (!title) return toast("標題必填");
if (!series) return toast("系列必填");
if (!content.trim()) return toast("內容必填");

db.copies.push({ id: uid("copy"), title, series, content, createdAt: nowISO() });
saveDB();
formCopy.reset();
toast("文案已儲存");
renderCopyList();
});

copySearch?.addEventListener("input", renderCopyList);

copyList?.addEventListener("click", (e) => {
const btn = e.target.closest("button[data-act]");
if (!btn) return;
const act = btn.dataset.act;
const id = btn.dataset.id;
const c = db.copies.find((x) => x.id === id);
if (!c) return;

if (act === "copy-copy") copyText(c.content || "");
if (act === "del-copy") {
if (!confirm("確定刪除此文案？")) return;
db.copies = db.copies.filter((x) => x.id !== id);
saveDB();
toast("已刪除文案");
renderCopyList();
}
});

// ---------- Publish Lab (發片助手) ----------
const formPublish = $("#formPublish");
const publishList = $("#publishList");
const publishSearch = $("#publishSearch");

function renderPublishList() {
if (!publishList) return;
let items = db.publishes.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
items = bySearch(items, publishSearch?.value, ["id", "title", "note"]);
renderList(publishList, items, (p) => `
<div class="item">
<div class="itemMain">
<div class="itemTitle">${esc(p.title || "(未命名套件)")}</div>
<div class="itemMeta muted">id：${esc(p.id)}</div>
<div class="itemMeta muted">
主題：${esc(p.themeTitle || "-")}<br/>
影片：${esc(p.videoTitle || "-")}<br/>
工具：${esc(p.toolName || "-")}<br/>
模組：${esc(p.moduleTitle || "（不選）")}<br/>
文案：${esc(p.copyTitle || "（不選）")}
</div>
${p.note ? `<div class="itemMeta muted">備註：${esc(p.note)}</div>` : ""}
</div>
<div class="itemActions">
<button class="btn small ghost" data-act="copy-publish" data-id="${esc(p.id)}">複製</button>
<button class="btn small danger" data-act="del-publish" data-id="${esc(p.id)}">刪除</button>
</div>
</div>
`);
}

function buildPublishText(p) {
return [
`【發佈套件】${p.title}`,
`主題：${p.themeTitle || "-"}`,
`影片：${p.videoTitle || "-"}${p.videoUrl ? "（" + p.videoUrl + "）" : ""}`,
`工具：${p.toolName || "-"}`,
`模組：${p.moduleTitle || "（不選）"}`,
`文案：${p.copyTitle || "（不選）"}`,
p.note ? `備註：${p.note}` : ""
].filter(Boolean).join("\n");
}

formPublish?.addEventListener("submit", (e) => {
e.preventDefault();
const themeId = $("#publishTheme")?.value;
const videoId = $("#publishVideo")?.value;
const toolId = $("#publishTool")?.value;

if (!themeId) return toast("請選主題");
if (!videoId) return toast("請選影片");
if (!toolId) return toast("請選工具");

const theme = db.themes.find((x) => x.id === themeId);
const video = db.videos.find((x) => x.id === videoId);
const tool = db.tools.find((x) => x.id === toolId);

const moduleId = $("#publishModule")?.value || "";
const copyId = $("#publishCopy")?.value || "";

const module = moduleId ? db.modules.find((x) => x.id === moduleId) : null;
const copy = copyId ? db.copies.find((x) => x.id === copyId) : null;

const note = s($("#publishNote")?.value).trim();

const item = {
id: uid("publish"),
title: `${theme?.sentence || "主題"}｜發佈套件`,
themeId, themeTitle: theme?.sentence || "",
videoId, videoTitle: video?.title || "", videoUrl: video?.url || "",
toolId, toolName: tool?.name || "",
moduleId: moduleId || "", moduleTitle: module?.title || "",
copyId: copyId || "", copyTitle: copy?.title || "",
note,
createdAt: nowISO()
};

db.publishes.push(item);
saveDB();
formPublish.reset();
toast("已打包發佈套件");
renderPublishList();
});

publishSearch?.addEventListener("input", renderPublishList);

publishList?.addEventListener("click", (e) => {
const btn = e.target.closest("button[data-act]");
if (!btn) return;
const act = btn.dataset.act;
const id = btn.dataset.id;
const p = db.publishes.find((x) => x.id === id);
if (!p) return;

if (act === "copy-publish") copyText(buildPublishText(p));
if (act === "del-publish") {
if (!confirm("確定刪除此發佈套件？")) return;
db.publishes = db.publishes.filter((x) => x.id !== id);
saveDB();
toast("已刪除套件");
renderPublishList();
}
});

// ---------- Match (一鍵配對) ----------
const formMatch = $("#formMatch");
const matchResult = $("#matchResult");
const btnMatchToPublish = $("#btnMatchToPublish");
const btnOpenPublishLabFromMatch = $("#btnOpenPublishLabFromMatch");

function kw(text) {
text = s(text).toLowerCase();
return text
.replaceAll("｜", " ")
.replaceAll("|", " ")
.replaceAll("×", " ")
.replaceAll("/", " ")
.replaceAll("／", " ")
.replaceAll("，", " ")
.replaceAll(",", " ")
.replaceAll("。", " ")
.replaceAll(".", " ")
.replace(/\s+/g, " ")
.trim()
.split(" ")
.filter((x) => x && x.length >= 2);
}

function overlapScore(a, b) {
const A = new Set(kw(a));
const B = kw(b);
let hit = 0;
B.forEach((w) => { if (A.has(w)) hit++; });
return hit;
}

function pickBest(list, getText, queryText) {
if (!list.length) return null;
let best = null;
let bestScore = -1;
for (const item of list) {
const sc = overlapScore(getText(item), queryText);
if (sc > bestScore) { best = item; bestScore = sc; }
}
return { best, score: bestScore };
}

formMatch?.addEventListener("submit", (e) => {
e.preventDefault();
const themeId = $("#matchTheme")?.value;
const theme = db.themes.find((x) => x.id === themeId);
if (!theme) return toast("請先選主題");

const strict = Number($("#matchStrict")?.value || 1);
const queryText = [theme.sentence, theme.pain, theme.scenario, theme.toolHint].filter(Boolean).join(" ");

const toolPick = pickBest(db.tools, (t) => `${t.name} ${t.desc}`, queryText);
const modPick = pickBest(db.modules, (m) => `${m.title} ${m.content}`, queryText);
const copyPick = pickBest(db.copies, (c) => `${c.title} ${c.content}`, queryText);

const passTool = toolPick?.score >= (strict === 2 ? 2 : strict === 1 ? 1 : 0);
const passMod = modPick?.score >= (strict === 2 ? 2 : strict === 1 ? 1 : 0);
const passCopy = copyPick?.score >= (strict === 2 ? 2 : strict === 1 ? 1 : 0);

db._lastMatch = {
themeId: theme.id,
toolId: passTool ? toolPick.best?.id || "" : "",
moduleId: passMod ? modPick.best?.id || "" : "",
copyId: passCopy ? copyPick.best?.id || "" : "",
at: nowISO()
};
saveDB();

if (matchResult) {
matchResult.classList.remove("muted");
matchResult.innerHTML = `
<div><b>主題：</b>${esc(theme.sentence)}</div>
<div><b>工具推薦：</b>${passTool ? esc(toolPick.best?.name) : "（沒有夠像的，請先新增工具）"}</div>
<div><b>模組推薦：</b>${passMod ? esc(modPick.best?.title) : "（沒有夠像的，請先生成模組）"}</div>
<div><b>文案推薦：</b>${passCopy ? esc(copyPick.best?.title) : "（沒有夠像的，請先存草稿/文案）"}</div>
<div class="tiny muted">提示：沒有影片推薦，因為影片通常要你自己挑（庫存區新增後可選）。</div>
`;
}

if (btnMatchToPublish) btnMatchToPublish.disabled = false;
if (btnOpenPublishLabFromMatch) btnOpenPublishLabFromMatch.disabled = false;

toast("配對完成");
});

btnOpenPublishLabFromMatch?.addEventListener("click", () => openView("publishLab"));

btnMatchToPublish?.addEventListener("click", () => {
if (!db._lastMatch) return toast("請先配對一次");
// 帶入 publish 表單
const m = db._lastMatch;
if ($("#publishTheme")) $("#publishTheme").value = m.themeId || "";
if ($("#publishTool")) $("#publishTool").value = m.toolId || "";
if ($("#publishModule")) $("#publishModule").value = m.moduleId || "";
if ($("#publishCopy")) $("#publishCopy").value = m.copyId || "";
openView("publishLab");
toast("已帶入發片助手（請再選影片）");
});

// ---------- Course Lab ----------
const formCourse = $("#formCourse");
const courseList = $("#courseList");
const courseSearch = $("#courseSearch");
const formAssign = $("#formAssign");

function renderCourseList() {
if (!courseList) return;
let items = db.courses.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
items = bySearch(items, courseSearch?.value, ["id", "name", "desc"]);
renderList(courseList, items, (c) => {
const mods = (c.moduleIds || []).map((mid) => db.modules.find((m) => m.id === mid)).filter(Boolean);
return `
<div class="item">
<div class="itemMain">
<div class="itemTitle">${esc(c.name || "(無課程名)")}</div>
<div class="itemMeta muted">id：${esc(c.id)}</div>
${c.desc ? `<div class="itemMeta muted">${esc(c.desc)}</div>` : ""}
<div class="itemMeta muted">模組數：${mods.length}</div>
</div>
<div class="itemActions">
<button class="btn small ghost" data-act="copy-course" data-id="${esc(c.id)}">複製</button>
<button class="btn small danger" data-act="del-course" data-id="${esc(c.id)}">刪除</button>
</div>
</div>
`;
});
}

formCourse?.addEventListener("submit", (e) => {
e.preventDefault();
const id = s($("#courseId")?.value).trim() || uid("course");
const name = s($("#courseName")?.value).trim();
if (!name) return toast("課程名稱必填");
const desc = s($("#courseDesc")?.value).trim();
db.courses.push({ id, name, desc, moduleIds: [], createdAt: nowISO() });
saveDB();
formCourse.reset();
toast("課程已新增");
renderCourseList();
});

formAssign?.addEventListener("submit", (e) => {
e.preventDefault();
const cid = $("#assignCourse")?.value;
const mid = $("#assignModule")?.value;
if (!cid) return toast("請選課程");
if (!mid) return toast("請選模組");
const course = db.courses.find((c) => c.id === cid);
if (!course) return toast("找不到課程");
course.moduleIds = course.moduleIds || [];
if (!course.moduleIds.includes(mid)) course.moduleIds.push(mid);
saveDB();
toast("已加入模組");
renderCourseList();
});

courseSearch?.addEventListener("input", renderCourseList);

courseList?.addEventListener("click", (e) => {
const btn = e.target.closest("button[data-act]");
if (!btn) return;
const act = btn.dataset.act;
const id = btn.dataset.id;
const c = db.courses.find((x) => x.id === id);
if (!c) return;

if (act === "copy-course") {
const mods = (c.moduleIds || []).map((mid) => db.modules.find((m) => m.id === mid)).filter(Boolean);
copyText(
[
`【課程】${c.name}`,
c.desc ? `描述：${c.desc}` : "",
`模組：`,
...mods.map((m, idx) => `${idx + 1}. ${m.title}`)
].filter(Boolean).join("\n")
);
}
if (act === "del-course") {
if (!confirm("確定刪除此課程？")) return;
db.courses = db.courses.filter((x) => x.id !== id);
saveDB();
toast("已刪除課程");
renderCourseList();
}
});

// ---------- Idea Lab ----------
const formIdea = $("#formIdea");
const ideaList = $("#ideaList");
const ideaSearch = $("#ideaSearch");

function renderIdeaList() {
if (!ideaList) return;
let items = db.ideas.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
items = bySearch(items, ideaSearch?.value, ["id", "title", "desc"]);
renderList(ideaList, items, (x) => `
<div class="item">
<div class="itemMain">
<div class="itemTitle">${esc(x.title || "(無標題)")}</div>
${x.desc ? `<div class="itemMeta muted">${esc(x.desc)}</div>` : ""}
<div class="itemMeta muted">id：${esc(x.id)}</div>
</div>
<div class="itemActions">
<button class="btn small ghost" data-act="copy-idea" data-id="${esc(x.id)}">複製</button>
<button class="btn small danger" data-act="del-idea" data-id="${esc(x.id)}">刪除</button>
</div>
</div>
`);
}

formIdea?.addEventListener("submit", (e) => {
e.preventDefault();
const title = s($("#ideaTitle")?.value).trim();
if (!title) return toast("標題必填");
const desc = s($("#ideaDesc")?.value).trim();
db.ideas.push({ id: uid("idea"), title, desc, createdAt: nowISO() });
saveDB();
formIdea.reset();
toast("已儲存發想");
renderIdeaList();
});

ideaSearch?.addEventListener("input", renderIdeaList);

ideaList?.addEventListener("click", (e) => {
const btn = e.target.closest("button[data-act]");
if (!btn) return;
const act = btn.dataset.act;
const id = btn.dataset.id;
const x = db.ideas.find((i) => i.id === id);
if (!x) return;

if (act === "copy-idea") copyText(`【發想】${x.title}\n\n${x.desc || ""}`);
if (act === "del-idea") {
if (!confirm("確定刪除此發想？")) return;
db.ideas = db.ideas.filter((i) => i.id !== id);
saveDB();
toast("已刪除發想");
renderIdeaList();
}
});

// ---------- top actions: demo / export / import ----------
$("#btnQuickAddDemo")?.addEventListener("click", () => {
// 不重複加
if (db.themes.some((t) => t.id === "theme-demo-01")) return toast("示範資料已存在");
db._seeded = false; // 允許 seed
db.themes = [];
db.tools = [];
db.videos = [];
db.copies = [];
db.modules = [];
db.publishes = [];
db.courses = [];
db.ideas = [];
seedIfEmpty();
toast("已加入示範資料");
renderAllLists();
});

function exportJSON() {
const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = `happy-lab-${db.meta.version}-${Date.now()}.json`;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
toast("已匯出 JSON");
}

$("#btnExport")?.addEventListener("click", exportJSON);
$("#btnExport2")?.addEventListener("click", exportJSON);

function importJSONFile(file) {
if (!file) return;
const reader = new FileReader();
reader.onload = () => {
try {
const obj = JSON.parse(reader.result);
const incoming = normalizeDB(obj);

// 合併策略：用 id 去重（新資料覆蓋舊同 id）
function mergeArr(key) {
const map = new Map();
(db[key] || []).forEach((x) => map.set(x.id, x));
(incoming[key] || []).forEach((x) => map.set(x.id, x));
db[key] = Array.from(map.values());
}
["themes", "tools", "videos", "copies", "modules", "publishes", "courses", "ideas"].forEach(mergeArr);

db._seeded = true;
saveDB();
renderAllLists();
toast("已匯入並合併資料");
} catch (e) {
toast("匯入失敗：JSON 格式錯誤");
}
};
reader.readAsText(file, "utf-8");
}

$("#fileImport")?.addEventListener("change", (e) => importJSONFile(e.target.files?.[0]));
$("#fileImport2")?.addEventListener("change", (e) => importJSONFile(e.target.files?.[0]));

// ---------- settings: clear all ----------
$("#btnClearAll")?.addEventListener("click", () => {
if (!confirm("確定清除所有資料？（localStorage）")) return;
localStorage.removeItem(KEY);
db = defaultDB();
saveDB();
renderAllLists();
toast("已清除");
});

// ---------- render all lists ----------
function renderAllLists() {
renderThemeList();
renderToolList();
renderInventory();
renderModuleList();
renderCopyList();
renderPublishList();
renderCourseList();
renderIdeaList();
}

// ---------- init ----------
seedIfEmpty();
renderStats();
syncAllSelects();
renderAllLists();

})();
