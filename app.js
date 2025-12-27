// happy-lab v0.3.2 — Adds: Match → One-click create Publish Pack
const K = {
  themes: "happyLab.themes",
  modules: "happyLab.modules",
  copies: "happyLab.copy",
  tools: "happyLab.tools",
  videos: "happyLab.videos",
  publishes: "happyLab.publishes",
  courses: "happyLab.courses",
  ideas: "happyLab.ideas",
  meta: "happyLab.meta"
};

// ---------- utils ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const nowISO = () => new Date().toISOString();
const toast = (msg) => {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1600);
};
const safeJson = (x, fallback) => { try { return JSON.parse(x); } catch { return fallback; } };
const uid = (prefix="id") => `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
const byText = (s="") => (s ?? "").toString().toLowerCase();

function load(key, fallback){ return safeJson(localStorage.getItem(key) ?? "", fallback); }
function save(key, value){ localStorage.setItem(key, JSON.stringify(value)); }

function getAllData(){
  return {
    version: "v0.3.2",
    exportedAt: nowISO(),
    themes: load(K.themes, []),
    modules: load(K.modules, []),
    copies: load(K.copies, []),
    tools: load(K.tools, []),
    videos: load(K.videos, []),
    publishes: load(K.publishes, []),
    courses: load(K.courses, []),
    ideas: load(K.ideas, []),
    meta: load(K.meta, {})
  };
}

function setAllData(data){
  save(K.themes, data.themes ?? []);
  save(K.modules, data.modules ?? []);
  save(K.copies, data.copies ?? []);
  save(K.tools, data.tools ?? []);
  save(K.videos, data.videos ?? []);
  save(K.publishes, data.publishes ?? []);
  save(K.courses, data.courses ?? []);
  save(K.ideas, data.ideas ?? []);
  save(K.meta, data.meta ?? {});
}

const db = {
  themes(){ return load(K.themes, []); },
  modules(){ return load(K.modules, []); },
  copies(){ return load(K.copies, []); },
  tools(){ return load(K.tools, []); },
  videos(){ return load(K.videos, []); },
  publishes(){ return load(K.publishes, []); },
  courses(){ return load(K.courses, []); },
  ideas(){ return load(K.ideas, []); },

  setThemes(v){ save(K.themes, v); },
  setModules(v){ save(K.modules, v); },
  setCopies(v){ save(K.copies, v); },
  setTools(v){ save(K.tools, v); },
  setVideos(v){ save(K.videos, v); },
  setPublishes(v){ save(K.publishes, v); },
  setCourses(v){ save(K.courses, v); },
  setIdeas(v){ save(K.ideas, v); },
};

function findTheme(id){ return db.themes().find(x => x.id === id); }
function findTool(id){ return db.tools().find(x => x.id === id); }
function findVideo(id){ return db.videos().find(x => x.id === id); }
function findModule(id){ return db.modules().find(x => x.id === id); }
function findCopy(id){ return db.copies().find(x => x.id === id); }

// ---------- UI helpers ----------
function itemShell({title, metaLines=[], body="", buttons=[]}){
  const el = document.createElement("div");
  el.className = "item";
  el.innerHTML = `
    <div class="itemTop">
      <div>
        <div class="itemTitle"></div>
        <div class="itemMeta"></div>
      </div>
      <div class="itemBtns"></div>
    </div>
    <div class="itemBody"></div>
  `;
  el.querySelector(".itemTitle").textContent = title;
  el.querySelector(".itemMeta").textContent = metaLines.filter(Boolean).join(" · ");
  el.querySelector(".itemBody").textContent = body || "";
  const btns = el.querySelector(".itemBtns");
  buttons.forEach(b => btns.appendChild(b));
  return el;
}

function btn(text, onClick, cls="iconBtn"){
  const b = document.createElement("button");
  b.type = "button";
  b.className = cls;
  b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}

function copyToClipboard(text){
  navigator.clipboard?.writeText(text).then(()=>toast("已複製到剪貼簿")).catch(()=>{
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta);
    ta.select(); document.execCommand("copy");
    document.body.removeChild(ta);
    toast("已複製到剪貼簿");
  });
}

// ---------- view router ----------
function setView(viewName){
  $$(".navItem").forEach(btn => btn.classList.toggle("active", btn.dataset.view === viewName));
  $$(".view").forEach(v => v.classList.remove("active"));
  $(`#view-${viewName}`).classList.add("active");
  refreshAllSelects();
  renderAll();
}
$$(".navItem").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.view)));

// ---------- top actions ----------
function bindTopActions(){
  $("#btnQuickAddDemo").addEventListener("click", seedDemo);
  const doExport = () => exportJson();
  $("#btnExport").addEventListener("click", doExport);
  $("#btnExport2").addEventListener("click", doExport);

  $("#fileImport").addEventListener("change", (e)=>importJson(e.target.files?.[0]));
  $("#fileImport2").addEventListener("change", (e)=>importJson(e.target.files?.[0]));
}

function exportJson(){
  const data = getAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `happy-lab_v0.3.2_export_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast("已匯出");
}

function importJson(file){
  if(!file) return;
  const r = new FileReader();
  r.onload = () => {
    const data = safeJson(r.result, null);
    if(!data || typeof data !== "object"){ toast("匯入失敗：格式不正確"); return; }
    setAllData(data);
    toast("匯入成功");
    refreshAllSelects();
    renderAll();
  };
  r.readAsText(file);
}

// ---------- demo seed ----------
function seedDemo(){
  const themes = db.themes();
  if (themes.length) { toast("已經有資料了"); return; }

  const t1 = {
    id: "theme-desire-money",
    sentence: "無欲則剛｜零用錢×需要／想要×選擇力",
    pain: "孩子一遇到想要就失控、忍不住、停不下來",
    scenario: "超市/零用錢/想要vs需要/練習「等一下」",
    video: "",
    toolHint: "need-want口袋卡、超市30秒踩煞車、我等一下計分",
    createdAt: nowISO()
  };

  const t2 = {
    id: "theme-soft-talk",
    sentence: "柔軟而有力量｜感恩×善解×溝通力",
    pain: "一開口就硬、越講越僵、氣氛卡住",
    scenario: "親子衝突/伴侶誤會/一句話能不能變柔軟",
    video: "",
    toolHint: "心軟一下呼吸、善解卡、重來一句",
    createdAt: nowISO()
  };

  db.setThemes([t1, t2]);

  db.setTools([
    {
      id: "tool-need-want-card",
      name: "需要/想要 口袋卡",
      desc: "孩子想買時先摸口袋卡：三問『我想要什麼？我真的需要嗎？我可以等一下嗎？』",
      createdAt: nowISO()
    },
    {
      id: "tool-traffic-light-30s",
      name: "紅綠燈30秒踩煞車",
      desc: "紅燈停：吸4吐6一次｜黃燈想：一句話說清楚想要｜綠燈選：先等一下或放回去",
      createdAt: nowISO()
    },
    {
      id: "tool-soft-restart",
      name: "重來一句（柔軟版）",
      desc: "把硬話改柔：先承認+再說需求+給選擇。例：『我剛剛太急了，我想重來…』",
      createdAt: nowISO()
    }
  ]);

  db.setVideos([
    {
      id: "video-demo-001",
      title: "無欲則剛｜孩子學會等一下，選擇力就開始長出來",
      url: "https://example.com",
      series: "幸福教養",
      createdAt: nowISO()
    }
  ]);

  toast("已加入示範資料");
  refreshAllSelects();
  renderAll();
}

// ---------- MATCH helpers ----------
function tokenize(text){
  const s = (text||"").toLowerCase();
  const chunks = s
    .replace(/[，。！？、（）【】「」『』：；\n\r\t]/g, " ")
    .replace(/[^a-z0-9\u4e00-\u9fff ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const han = (s.match(/[\u4e00-\u9fff]/g) || []);
  return [...new Set([...chunks, ...han])];
}

function scoreItem(tokens, text){
  const t = tokenize(text);
  let score = 0;
  tokens.forEach(k=>{
    if(t.includes(k)) score += (k.length >= 2 ? 2 : 1);
  });
  return score;
}

function topMatches(theme, list, toTextFn, topN=5, strict=0){
  const themeText = `${theme.sentence} ${theme.pain||""} ${theme.scenario||""} ${theme.toolHint||""}`;
  const tokens = tokenize(themeText);

  const scored = list.map(x=>{
    const text = toTextFn(x);
    return {item:x, score: scoreItem(tokens, text)};
  }).sort((a,b)=>b.score-a.score);

  const min = strict===2 ? 6 : strict===1 ? 3 : 1;
  const filtered = scored.filter(s=>s.score >= min);

  return (filtered.length ? filtered : scored.slice(0, topN)).slice(0, topN);
}

function matchAllForThemeDetailed(theme, strict=0){
  const tools = db.tools();
  const modules = db.modules();
  const videos = db.videos();

  const toolTop = topMatches(
    theme,
    tools,
    (t)=>`${t.id} ${t.name} ${t.desc||""}`,
    5,
    strict
  );

  const modTop = topMatches(
    theme,
    modules,
    (m)=>{
      const th = findTheme(m.themeId)?.sentence || "";
      return `${m.id} ${m.title} ${th} ${(m.core||[]).join(" ")} ${(m.gameplay||[]).join(" ")} ${(m.prompts?.commentLine||"")}`;
    },
    5,
    strict
  );

  const videoTop = topMatches(
    theme,
    videos,
    (v)=>`${v.id} ${v.title} ${v.url} ${v.series||""}`,
    3,
    strict
  );

  const bestMod = modTop[0]?.item || null;
  const commentLine =
    bestMod?.prompts?.commentLine ||
    `留言一句：今天我做了『${theme.sentence.includes("｜") ? theme.sentence.split("｜")[0] : "小練習"}』，我替自己加了一點點選擇力。`;

  const parentLines = bestMod?.prompts?.parentLines?.length
    ? bestMod.prompts.parentLines
    : ["我不急著說不，我先陪你把想要說清楚。", "我們先做一個小決定：要不要先等一下？"];

  const childLines = bestMod?.prompts?.childLines?.length
    ? bestMod.prompts.childLines
    : ["我想要，但我可以等一下。", "我先放回去，等一下再決定。"];

  const toolText = toolTop.length
    ? toolTop.map((x,i)=>`${i+1}. ${x.item.name}（${x.item.id}） score=${x.score}`).join("\n")
    : "（目前沒有工具）";

  const modText = modTop.length
    ? modTop.map((x,i)=>`${i+1}. ${x.item.title}（${x.item.id}） score=${x.score}`).join("\n")
    : "（目前沒有模組：去咒語生成器先生一個！）";

  const videoText = videoTop.length
    ? videoTop.map((x,i)=>`${i+1}. ${x.item.title}（${x.item.id}） score=${x.score}`).join("\n")
    : "（目前沒有影片：請到庫存區新增，或在主題內填影片連結）";

  const text = [
    `【主題】${theme.sentence}`,
    theme.pain ? `【卡點】${theme.pain}` : "",
    theme.scenario ? `【情境】${theme.scenario}` : "",
    ``,
    `🎬【推薦影片 Top】`,
    videoText,
    ``,
    `🎒【推薦工具 Top】`,
    toolText,
    ``,
    `🧩【推薦模組 Top】`,
    modText,
    ``,
    `🗨️【留言引導一句】`,
    commentLine,
    ``,
    `🗣️【可說出口句（家長）】`,
    `- ${parentLines.join("\n- ")}`,
    ``,
    `🧒【可說出口句（孩子）】`,
    `- ${childLines.join("\n- ")}`,
    ``,
    `✨【一秒定錨】`,
    `今天不是要你「忍住」，是要你「多一秒選擇」。`
  ].filter(Boolean).join("\n");

  return { theme, strict, toolTop, modTop, videoTop, commentLine, parentLines, childLines, text };
}

// ---------- create placeholders for pack ----------
function ensureToolFromMatch(theme, toolTop){
  const best = toolTop?.[0]?.item || null;
  if(best) return best.id;

  const hint = (theme.toolHint || "").trim() || "（尚未填工具提示）";
  const id = uid("tool");
  const item = {
    id,
    name: `占位工具｜${theme.sentence.split("｜")[0] || "工具"}`,
    desc: `（自動補位）建議工具提示：${hint}\n你可以到「工具庫」補齊更精準的工具說明。`,
    createdAt: nowISO()
  };
  const list = db.tools();
  list.unshift(item);
  db.setTools(list);
  return id;
}

function ensureVideoFromMatch(theme, videoTop){
  const url = (theme.video || "").trim();
  if(url){
    const hit = db.videos().find(v => (v.url||"").trim() === url);
    if(hit) return hit.id;

    const id = uid("video");
    const item = {
      id,
      title: `（占位影片）${theme.sentence}`,
      url,
      series: "幸福教養",
      createdAt: nowISO()
    };
    const list = db.videos();
    list.unshift(item);
    db.setVideos(list);
    return id;
  }

  const best = videoTop?.[0]?.item || null;
  if(best) return best.id;

  const id = uid("video");
  const item = {
    id,
    title: `（占位影片）${theme.sentence}`,
    url: "",
    series: "幸福教養",
    createdAt: nowISO()
  };
  const list = db.videos();
  list.unshift(item);
  db.setVideos(list);
  return id;
}

function pickModuleIdFromMatch(modTop){
  const best = modTop?.[0]?.item || null;
  return best ? best.id : "";
}

// ---------- view: THEME LAB ----------
let lastMatch = null;

function bindThemeLab(){
  $("#formTheme").addEventListener("submit", (e)=>{
    e.preventDefault();
    const id = ($("#themeId").value || "").trim() || uid("theme");
    const sentence = ($("#themeSentence").value || "").trim();
    if(!sentence){ toast("主題句必填"); return; }

    const item = {
      id,
      sentence,
      pain: ($("#themePain").value || "").trim(),
      scenario: ($("#themeScenario").value || "").trim(),
      video: ($("#themeVideo").value || "").trim(),
      toolHint: ($("#themeToolHint").value || "").trim(),
      createdAt: nowISO()
    };

    const list = db.themes();
    if(list.some(x=>x.id===id)){ toast("這個主題ID已存在"); return; }
    list.unshift(item);
    db.setThemes(list);

    e.target.reset();
    toast("主題已新增");
    refreshAllSelects();
    renderThemeList();
  });

  $("#themeSearch").addEventListener("input", renderThemeList);
  $("#themeSort").addEventListener("change", renderThemeList);

  const btnToPack = $("#btnMatchToPublish");
  const btnOpenPublish = $("#btnOpenPublishLabFromMatch");

  function setPackButtons(enabled){
    if(btnToPack) btnToPack.disabled = !enabled;
    if(btnOpenPublish) btnOpenPublish.disabled = !enabled;
  }
  setPackButtons(false);

  $("#formMatch").addEventListener("submit", (e)=>{
    e.preventDefault();
    const themeId = $("#matchTheme").value;
    const strict = parseInt($("#matchStrict").value, 10) || 0;
    const theme = findTheme(themeId);
    if(!theme){ toast("請先建立主題"); return; }

    lastMatch = matchAllForThemeDetailed(theme, strict);
    $("#matchResult").textContent = lastMatch.text;
    setPackButtons(true);
    toast("配對完成");
  });

  if(btnToPack){
    btnToPack.addEventListener("click", ()=>{
      if(!lastMatch?.theme){ toast("請先配對一次"); return; }

      const theme = lastMatch.theme;
      const toolId = ensureToolFromMatch(theme, lastMatch.toolTop);
      const videoId = ensureVideoFromMatch(theme, lastMatch.videoTop);
      const moduleId = pickModuleIdFromMatch(lastMatch.modTop);

      const note = `（由配對自動建立）${lastMatch.commentLine || ""}`.trim();

      const item = {
        id: uid("pack"),
        themeId: theme.id,
        videoId,
        toolId,
        moduleId,
        copyId: "",
        note,
        createdAt: nowISO()
      };

      const list = db.publishes();
      list.unshift(item);
      db.setPublishes(list);

      refreshAllSelects();
      renderPublishList();
      renderInventoryPanel();
      renderToolList();

      toast("已建立發佈套件");
    });
  }

  if(btnOpenPublish){
    btnOpenPublish.addEventListener("click", ()=>{
      if(!lastMatch?.theme){ toast("請先配對一次"); return; }
      setView("publishLab");
    });
  }
}

function renderThemeList(){
  const q = byText($("#themeSearch").value);
  const sort = $("#themeSort").value;
  let list = db.themes();

  list = list.filter(t=>{
    const blob = `${t.id} ${t.sentence} ${t.pain} ${t.scenario} ${t.toolHint}`.toLowerCase();
    return !q || blob.includes(q);
  });

  if(sort==="az"){
    list = [...list].sort((a,b)=>a.sentence.localeCompare(b.sentence));
  }else if(sort==="old"){
    list = [...list].sort((a,b)=>(a.createdAt||"").localeCompare(b.createdAt||""));
  }else{
    list = [...list].sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
  }

  const box = $("#themeList");
  box.innerHTML = "";
  if(!list.length){
    box.innerHTML = `<div class="item muted">目前沒有主題（或搜尋不到）。</div>`;
    return;
  }

  list.forEach(t=>{
    const meta = [t.id, t.createdAt ? new Date(t.createdAt).toLocaleString() : ""];
    const body = [
      t.pain ? `卡點：${t.pain}` : "",
      t.scenario ? `情境：${t.scenario}` : "",
      t.video ? `影片：${t.video}` : "",
      t.toolHint ? `工具：${t.toolHint}` : ""
    ].filter(Boolean).join("\n");

    const bMatch = btn("配對推薦", ()=>{
      const strict = 0;
      lastMatch = matchAllForThemeDetailed(t, strict);
      $("#matchTheme").value = t.id;
      $("#matchStrict").value = "0";
      $("#matchResult").textContent = lastMatch.text;

      const btnToPack = $("#btnMatchToPublish");
      const btnOpenPublish = $("#btnOpenPublishLabFromMatch");
      if(btnToPack) btnToPack.disabled = false;
      if(btnOpenPublish) btnOpenPublish.disabled = false;

      toast("已產出配對結果（可一鍵建立發佈套件）");
    });

    const bCopy = btn("複製摘要", ()=>{
      const text = `【主題】${t.sentence}\n【卡點】${t.pain||""}\n【情境】${t.scenario||""}\n【影片】${t.video||""}\n【工具】${t.toolHint||""}\n【ID】${t.id}`;
      copyToClipboard(text);
    });

    const bDel = btn("刪除", ()=>{
      if(!confirm("刪除主題？（不會刪除已生成的模組）")) return;
      db.setThemes(db.themes().filter(x=>x.id!==t.id));
      toast("已刪除");
      refreshAllSelects();
      renderAll();
    }, "iconBtn danger");

    box.appendChild(itemShell({
      title: t.sentence,
      metaLines: meta,
      body,
      buttons:[bMatch, bCopy, bDel]
    }));
  });
}

// ---------- SPELL GENERATOR (modules) ----------
function bindSpellLab(){
  $("#btnOpenModuleLab").addEventListener("click", ()=>setView("moduleLab"));

  $("#formSpell").addEventListener("submit", (e)=>{
    e.preventDefault();
    const themeId = $("#spellTheme").value;
    const type = ($("input[name='spellType']:checked")?.value) || "A";
    const version = ($("#spellVersion").value || "v1").trim();
    const flavor = ($("#spellFlavor").value || "").trim();

    const theme = findTheme(themeId);
    if(!theme){ toast("請先建立主題"); return; }

    const mod = generateModuleFromSpell({theme, type, version, flavor});
    const list = db.modules();
    list.unshift(mod);
    db.setModules(list);

    $("#spellResult").textContent = formatModuleForHuman(mod);
    toast("已生成模組");
    refreshAllSelects();
    renderModuleList();
  });
}

function generateModuleFromSpell({theme, type, version, flavor}){
  const baseId = theme.id.replace(/^theme-/, "");
  const id = `mod-${type==="A" ? "brake-choice" : "soft-talk"}-${baseId}-${version}`.replace(/[^a-z0-9\-]/gi,"-").toLowerCase();

  if(type==="A"){
    return {
      id,
      type: "A",
      themeId: theme.id,
      title: `A｜踩煞車×選擇力｜${theme.sentence}（${version}）`,
      core: [
        "練習「等一下」：把衝動拉出 2 秒空間",
        "分清「想要 vs 需要」：把欲望變清楚，不用壓抑",
        "把選擇說出口：用一句話讓前額葉接手"
      ],
      gameplay: [
        "1) 看到想買 → 先按『暫停鈕』（深呼吸 1 次）",
        "2) 口袋卡三問：我想要什麼？我真的需要嗎？我可以等一下嗎？",
        "3) 選擇一句說出口：『我想要，但我先等一下。』",
        "4) 完成後點一下『我等一下了』計數（像闖關一樣）"
      ],
      rewards: {
        name: "選擇力能量",
        points: 3,
        badges: ["我等一下徽章", "需要想要辨識徽章", "超市冷靜徽章"],
        streakHint: "連續天數不是打卡，是「大腦剎車系統」長肌肉。"
      },
      prompts: {
        parentLines: [
          "我不急著說不，我陪你把想要說清楚。",
          "你可以想要，重點是你能不能先等一下。",
          "我們先做一個小決定：要不要先等 10 秒？"
        ],
        childLines: [
          "我想要，但我可以等一下。",
          "這是想要，不是需要。",
          "我先放回去，等一下再決定。"
        ],
        commentLine: "留言一句：今天我『等了一下』，我替自己按了暫停。"
      },
      flavor,
      createdAt: nowISO()
    };
  }

  return {
    id,
    type: "B",
    themeId: theme.id,
    title: `B｜柔軟彈性×溝通力｜${theme.sentence}（${version}）`,
    core: [
      "練習『先穩住』：情緒有地方放，話才有地方走",
      "練習『善解』：先猜對方的不容易",
      "練習『感恩』：把關係的好留下來"
    ],
    gameplay: [
      "1) 衝突出現 → 先做『心軟一下』：吸4吐6一次",
      "2) 選一張『善解卡』：我猜對方是____（累/急/怕/需要被看見）",
      "3) 選一句『溫柔溝通句』說出口",
      "4) 完成後點一下『我柔軟了』計數（像升等一樣）"
    ],
    rewards: {
      name: "關係溫度",
      points: 3,
      badges: ["我先穩住徽章", "善解一句話徽章", "感恩回收徽章"],
      streakHint: "連續不是完美，是願意回來一次。"
    },
    prompts: {
      parentLines: [
        "我先不急著糾正，我想先懂你。",
        "你不用立刻變好，我們先讓關係軟一點。",
        "謝謝你願意說出來，我聽到了。"
      ],
      childLines: [
        "我需要你聽我一下。",
        "我剛剛太急了，我想重來。",
        "謝謝你陪我。"
      ],
      commentLine: "留言一句：今天我做了『心軟一下』，關係變得比較好。"
    },
    flavor,
    createdAt: nowISO()
  };
}

function formatModuleForHuman(mod){
  const theme = findTheme(mod.themeId);
  return [
    `【模組】${mod.title}`,
    `【ID】${mod.id}`,
    `【主題】${theme?.sentence || mod.themeId}`,
    ``,
    `【核心概念】`,
    ...(mod.core||[]).map(x=>`- ${x}`),
    ``,
    `【直覺式遊戲化操作】`,
    ...(mod.gameplay||[]).map(x=>`- ${x}`),
    ``,
    `【獎勵回饋】${mod.rewards?.name || ""} +${mod.rewards?.points || 0}`,
    `徽章：${(mod.rewards?.badges||[]).join("、")}`,
    `連續提示：${mod.rewards?.streakHint || ""}`,
    ``,
    `【可說出口句】`,
    `家長：${(mod.prompts?.parentLines||[]).join("｜")}`,
    `孩子：${(mod.prompts?.childLines||[]).join("｜")}`,
    ``,
    `【留言引導】${mod.prompts?.commentLine || ""}`,
    mod.flavor ? `\n【遊戲風格】${mod.flavor}` : ""
  ].join("\n");
}

// ---------- MODULE LAB ----------
function bindModuleLab(){
  $("#moduleSearch").addEventListener("input", renderModuleList);
  $("#moduleFilterType").addEventListener("change", renderModuleList);
}

function renderModuleList(){
  const q = byText($("#moduleSearch").value);
  const ft = $("#moduleFilterType").value;

  let list = db.modules();
  if(ft !== "all") list = list.filter(m => m.type === ft);
  if(q){
    list = list.filter(m=>{
      const theme = findTheme(m.themeId)?.sentence || "";
      const blob = `${m.id} ${m.title} ${theme} ${(m.core||[]).join(" ")} ${(m.gameplay||[]).join(" ")} ${m.flavor||""}`.toLowerCase();
      return blob.includes(q);
    });
  }

  const box = $("#moduleList");
  box.innerHTML = "";
  if(!list.length){
    box.innerHTML = `<div class="item muted">尚未有模組（請去咒語生成器）。</div>`;
    return;
  }

  list.forEach(m=>{
    const theme = findTheme(m.themeId);
    const meta = [m.id, `類型${m.type}`, theme?.sentence || m.themeId];
    const body = formatModuleForHuman(m);

    const bCopy = btn("複製模組", ()=>copyToClipboard(body));
    const bDel = btn("刪除", ()=>{
      if(!confirm("刪除模組？（課程中引用也會移除）")) return;
      db.setModules(db.modules().filter(x=>x.id!==m.id));
      const courses = db.courses().map(c => ({...c, moduleIds: (c.moduleIds||[]).filter(id=>id!==m.id)}));
      db.setCourses(courses);
      toast("已刪除");
      refreshAllSelects();
      renderAll();
    }, "iconBtn danger");

    $("#moduleList").appendChild(itemShell({title: m.title, metaLines: meta, body, buttons:[bCopy, bDel]}));
  });
}

// ---------- (2) COPY SPELL GENERATOR ----------
let lastCopySpellText = "";
function bindCopySpell(){
  $("#formCopySpell").addEventListener("submit", (e)=>{
    e.preventDefault();
    const themeId = $("#copySpellTheme").value;
    const series = $("#copySpellSeries").value;
    const ctaTone = ($("#copySpellCtaTone").value || "").trim();
    const saveMode = $("#copySpellSave").value;

    const theme = findTheme(themeId);
    if(!theme){ toast("請先建立主題"); return; }

    const bestMod = topMatches(theme, db.modules(), (m)=>{
      const th = findTheme(m.themeId)?.sentence || "";
      return `${m.title} ${th} ${(m.core||[]).join(" ")} ${(m.gameplay||[]).join(" ")} ${(m.prompts?.commentLine||"")}`;
    }, 1, 0)[0]?.item || null;

    const text = generateCopyTemplate({theme, series, bestMod, ctaTone});
    lastCopySpellText = text;
    $("#copySpellResult").textContent = text;
    toast("模板已生成");

    if(saveMode === "yes"){
      const title = `${theme.sentence}｜${series}｜模板草稿 v1`;
      const item = { id: uid("copy"), title, series, content: text, createdAt: nowISO() };
      const list = db.copies();
      list.unshift(item);
      db.setCopies(list);
      toast("已存成草稿");
      refreshAllSelects();
      renderCopyList();
    }
  });

  $("#btnCopySpellToClipboard").addEventListener("click", ()=>{
    if(!lastCopySpellText){ toast("先生成模板再複製"); return; }
    copyToClipboard(lastCopySpellText);
  });
}

function generateCopyTemplate({theme, series, bestMod, ctaTone}){
  const hookPunch = {
    "幸福教養": [
      "你有沒有發現——孩子不是故意鬧，是『剎車系統』還沒長好？",
      "孩子一看到想要，整個人像被推著走，停不下來對嗎？",
      "你不是管不動，你是在跟『衝動』賽跑。"
    ],
    "詩詞人生": [
      "有些詩，像一盞燈——一照就照到我們心裡那個最真實的自己。",
      "你以為你在讀詩，其實是詩在讀你。",
      "一首詩，可能比一千句勸說更有效。"
    ],
    "腦神經科學": [
      "你的腦不是懶，是它很會『省電』。",
      "大腦最愛走老路，因為省力——所以你才會忍不住。",
      "今天我們用最不說教的方法，偷偷把大腦升級。"
    ],
    "人生感悟": [
      "人生很多時候不是不懂，是太快。",
      "慢下來，不代表輸；慢下來，是拿回方向盤。",
      "你不需要更厲害，你只需要更穩。"
    ],
    "幸福小腦袋": [
      "嘿～小腦袋今天要玩一個超酷的遊戲：『我等一下！』",
      "看到想要的東西？先按一下暫停鈕～",
      "今天我們來當『小小剎車王』！"
    ]
  };

  const pick = (arr)=>arr[Math.floor(Math.random()*arr.length)];
  const hook = pick(hookPunch[series] || hookPunch["人生感悟"]);

  const toolBlock = bestMod
    ? [
        "【好用工具（跟著做，不說教）】",
        ...(bestMod.gameplay||[]).map(x=>`- ${x}`),
        "",
        "【可說出口句（你直接照念就好）】",
        `- 家長：${(bestMod.prompts?.parentLines||[]).slice(0,3).join("｜")}`,
        `- 孩子：${(bestMod.prompts?.childLines||[]).slice(0,3).join("｜")}`,
        ""
      ].join("\n")
    : [
        "【好用工具（跟著做，不說教）】",
        "- 先暫停 1 次呼吸（吸4吐6）",
        "- 用一句話把感受說清楚",
        "- 做一個小選擇：先等一下/先放回去/先重來一句",
        ""
      ].join("\n");

  const cta = ctaTone?.length
    ? ctaTone
    : "回主頁領工具｜每週更新｜把心站穩，活得自在，幸福感會自己長出來。";

  const commentLine = bestMod?.prompts?.commentLine
    ? bestMod.prompts.commentLine
    : "留言一句：今天我給自己『多一秒選擇』。";

  const bodyGuide = {
    "幸福教養": [
      "（完整故事）先把情境說出來：孩子怎麼想？你怎麼卡？轉折在哪？",
      "（心理學）點出：孩子不是壞，是衝動接手；大人要做的是『陪他裝剎車』。",
      "（腦神經科學）用親民比喻：前額葉=剎車、杏仁核=警報器、基底核=自動導航。",
      "（練習）帶觀眾做一次：暫停→三問→說出口→計分回饋。",
      "（收尾）把焦點放回『關係』：不是買不買，而是孩子學會選擇。"
    ],
    "詩詞人生": [
      "（作者介紹）他/她當時的人生處境與心境。",
      "（詩詞背景）這首詩為何寫？寫給誰？當時發生什麼？",
      "（全詩）貼上全文（可分段加停頓）。",
      "（心理學×腦科學）詩句對應：注意力/情緒/自我調節/意義感。",
      "（生活練習）用一個小練習把詩活出來。"
    ],
    "腦神經科學": [
      "（笑點開場）先讓觀眾『啊我就是這樣』。",
      "（科普一句話）把概念講得像朋友聊天：大腦省電、習慣走老路。",
      "（工具）給一個30秒可做的小動作。",
      "（回饋）用徽章/計分讓人想再玩一次。"
    ],
    "人生感悟": [
      "（故事/觀察）從一個生活小場景切入。",
      "（轉折）你突然看懂什麼？",
      "（練習）給一個很小很小的可做步驟。",
      "（收尾）留一句可以反覆想的話。"
    ],
    "幸福小腦袋": [
      "（遊戲規則）用一句話講清楚：今天要玩什麼？",
      "（闖關步驟）三步就好：暫停→問一問→選一個。",
      "（獎勵）星星/徽章/升級詞。",
      "（收尾）鼓勵孩子：你不是要忍，你是在變強。"
    ]
  };

  const guide = (bodyGuide[series] || bodyGuide["人生感悟"]).map(x=>`- ${x}`).join("\n");

  return [
    `【主題】${theme.sentence}`,
    theme.pain ? `【觀眾卡點】${theme.pain}` : "",
    theme.scenario ? `【情境】${theme.scenario}` : "",
    "",
    `A. Hook（3–15 秒）`,
    hook,
    "",
    `B. 承諾（今天你會得到什麼）`,
    `今天我不教你「更用力管」，我帶你用一個更聰明、更溫柔的方法，讓孩子（也讓你）多出「一秒選擇」。`,
    "",
    `C. 正文框架（把內容填進去就會變完整稿）`,
    guide,
    "",
    toolBlock,
    `D. 留言互動引導`,
    commentLine,
    "",
    `E. CTA（導主頁/每週更新/幸福感）`,
    cta,
    ""
  ].filter(Boolean).join("\n");
}

// ---------- COPY LAB ----------
function bindCopyLab(){
  $("#formCopy").addEventListener("submit", (e)=>{
    e.preventDefault();
    const title = ($("#copyTitle").value||"").trim();
    const series = $("#copySeries").value;
    const content = ($("#copyContent").value||"").trim();
    if(!title || !content){ toast("標題與內容必填"); return; }

    const item = { id: uid("copy"), title, series, content, createdAt: nowISO() };
    const list = db.copies();
    list.unshift(item);
    db.setCopies(list);

    e.target.reset();
    toast("文案已儲存");
    refreshAllSelects();
    renderCopyList();
  });

  $("#copySearch").addEventListener("input", renderCopyList);
}

function renderCopyList(){
  const q = byText($("#copySearch").value);
  let list = db.copies();
  if(q) list = list.filter(c => `${c.title} ${c.series} ${c.content}`.toLowerCase().includes(q));

  const box = $("#copyList");
  box.innerHTML = "";
  if(!list.length){
    box.innerHTML = `<div class="item muted">尚未有文案。</div>`;
    return;
  }

  list.forEach(c=>{
    const meta = [c.id, c.series, c.createdAt ? new Date(c.createdAt).toLocaleString() : ""];
    const body = c.content;

    const bCopy = btn("複製", ()=>copyToClipboard(body));
    const bDel = btn("刪除", ()=>{
      if(!confirm("刪除文案？")) return;
      db.setCopies(db.copies().filter(x=>x.id!==c.id));
      toast("已刪除");
      refreshAllSelects();
      renderCopyList();
    }, "iconBtn danger");

    box.appendChild(itemShell({title: c.title, metaLines: meta, body, buttons:[bCopy, bDel]}));
  });
}

// ---------- TOOL LAB ----------
function bindToolLab(){
  $("#formTool").addEventListener("submit", (e)=>{
    e.preventDefault();
    const id = ($("#toolId").value||"").trim() || uid("tool");
    const name = ($("#toolName").value||"").trim();
    const desc = ($("#toolDesc").value||"").trim();
    if(!name){ toast("工具名稱必填"); return; }

    const list = db.tools();
    if(list.some(x=>x.id===id)){ toast("這個工具ID已存在"); return; }
    list.unshift({id, name, desc, createdAt: nowISO()});
    db.setTools(list);

    e.target.reset();
    toast("工具已新增");
    refreshAllSelects();
    renderToolList();
  });

  $("#toolSearch").addEventListener("input", renderToolList);
}

function renderToolList(){
  const q = byText($("#toolSearch").value);
  let list = db.tools();
  if(q) list = list.filter(t => `${t.id} ${t.name} ${t.desc}`.toLowerCase().includes(q));

  const box = $("#toolList");
  box.innerHTML = "";
  if(!list.length){
    box.innerHTML = `<div class="item muted">尚未有工具。</div>`;
    return;
  }

  list.forEach(t=>{
    const meta = [t.id, t.createdAt ? new Date(t.createdAt).toLocaleString() : ""];
    const body = t.desc || "";

    const bCopy = btn("複製說明", ()=>copyToClipboard(`【工具】${t.name}\n${t.desc||""}\n【ID】${t.id}`));
    const bDel = btn("刪除", ()=>{
      if(!confirm("刪除工具？（發片套件引用不會自動刪除，但會顯示未知）")) return;
      db.setTools(db.tools().filter(x=>x.id!==t.id));
      toast("已刪除");
      refreshAllSelects();
      renderAll();
    }, "iconBtn danger");

    box.appendChild(itemShell({title: t.name, metaLines: meta, body, buttons:[bCopy, bDel]}));
  });
}

// ---------- INVENTORY LAB ----------
let invTab = "videos";
function bindInventoryLab(){
  $("#formVideo").addEventListener("submit", (e)=>{
    e.preventDefault();
    const id = ($("#videoId").value||"").trim() || uid("video");
    const title = ($("#videoTitle").value||"").trim();
    const url = ($("#videoUrl").value||"").trim();
    const series = $("#videoSeries").value;
    if(!title || !url){ toast("影片標題與連結必填"); return; }

    const list = db.videos();
    if(list.some(x=>x.id===id)){ toast("這個影片ID已存在"); return; }
    list.unshift({id, title, url, series, createdAt: nowISO()});
    db.setVideos(list);

    e.target.reset();
    toast("影片已新增");
    refreshAllSelects();
    renderInventoryPanel();
  });

  $$(".tab").forEach(t => t.addEventListener("click", ()=>{
    $$(".tab").forEach(x=>x.classList.remove("active"));
    t.classList.add("active");
    invTab = t.dataset.inv;
    renderInventoryPanel();
  }));
}

function renderInventoryPanel(){
  const box = $("#inventoryPanel");
  box.innerHTML = "";

  if(invTab === "videos"){
    const list = db.videos();
    if(!list.length){ box.innerHTML = `<div class="item muted">尚未有影片。</div>`; return; }
    list.forEach(v=>{
      const meta = [v.id, v.series, v.createdAt ? new Date(v.createdAt).toLocaleString(): ""];
      const body = `連結：${v.url || "（尚未填）"}`;

      const bOpen = btn("開啟", ()=> v.url ? window.open(v.url, "_blank") : toast("此影片尚未填連結"));
      const bCopy = btn("複製連結", ()=>copyToClipboard(v.url || ""));
      const bDel = btn("刪除", ()=>{
        if(!confirm("刪除影片？")) return;
        db.setVideos(db.videos().filter(x=>x.id!==v.id));
        toast("已刪除");
        refreshAllSelects();
        renderInventoryPanel();
      }, "iconBtn danger");

      box.appendChild(itemShell({title: v.title, metaLines: meta, body, buttons:[bOpen, bCopy, bDel]}));
    });
    return;
  }

  if(invTab === "tools"){
    const list = db.tools();
    if(!list.length){ box.innerHTML = `<div class="item muted">尚未有工具。</div>`; return; }
    list.forEach(t=>{
      const meta = [t.id];
      const body = t.desc || "";
      const bCopy = btn("複製", ()=>copyToClipboard(`【工具】${t.name}\n${t.desc||""}`));
      box.appendChild(itemShell({title: t.name, metaLines: meta, body, buttons:[bCopy]}));
    });
    return;
  }

  const list = db.copies();
  if(!list.length){ box.innerHTML = `<div class="item muted">尚未有文案。</div>`; return; }
  list.forEach(c=>{
    const meta = [c.id, c.series];
    const body = c.content.slice(0, 400) + (c.content.length>400 ? "\n...\n(內容太長已截斷，請到文案研究室查看)" : "");
    const bCopy = btn("複製全文", ()=>copyToClipboard(c.content));
    box.appendChild(itemShell({title: c.title, metaLines: meta, body, buttons:[bCopy]}));
  });
}

// ---------- PUBLISH LAB ----------
function bindPublishLab(){
  $("#formPublish").addEventListener("submit", (e)=>{
    e.preventDefault();
    const themeId = $("#publishTheme").value;
    const videoId = $("#publishVideo").value;
    const toolId = $("#publishTool").value;
    const moduleId = $("#publishModule").value || "";
    const copyId = $("#publishCopy").value || "";
    const note = ($("#publishNote").value || "").trim();

    if(!themeId || !videoId || !toolId){ toast("主題/影片/工具必選"); return; }

    const item = {
      id: uid("pack"),
      themeId, videoId, toolId, moduleId, copyId,
      note,
      createdAt: nowISO()
    };

    const list = db.publishes();
    list.unshift(item);
    db.setPublishes(list);

    e.target.reset();
    toast("已打包發佈套件");
    renderPublishList();
  });

  $("#publishSearch").addEventListener("input", renderPublishList);
}

function buildPublishText(p){
  const theme = findTheme(p.themeId);
  const video = findVideo(p.videoId);
  const tool = findTool(p.toolId);
  const mod = p.moduleId ? findModule(p.moduleId) : null;
  const copy = p.copyId ? findCopy(p.copyId) : null;

  const lines = [];
  lines.push(`【發佈套件】${theme?.sentence || p.themeId}`);
  lines.push(`【影片】${video?.title || p.videoId}`);
  lines.push(`【連結】${video?.url || "（尚未填）"}`);
  lines.push(`【工具】${tool?.name || p.toolId}`);
  if(tool?.desc) lines.push(tool.desc);
  if(mod){
    lines.push(`\n【模組（留言引導/工具描述）】`);
    lines.push(formatModuleForHuman(mod));
  }
  if(copy){
    lines.push(`\n【文案（草稿/完稿）】`);
    lines.push(copy.content);
  }
  if(p.note) lines.push(`\n【備註】${p.note}`);
  return lines.join("\n");
}

function renderPublishList(){
  const q = byText($("#publishSearch").value);
  let list = db.publishes();
  if(q){
    list = list.filter(p=>{
      const theme = findTheme(p.themeId)?.sentence || "";
      const video = findVideo(p.videoId)?.title || "";
      const tool = findTool(p.toolId)?.name || "";
      const blob = `${p.id} ${theme} ${video} ${tool} ${p.note||""}`.toLowerCase();
      return blob.includes(q);
    });
  }

  const box = $("#publishList");
  box.innerHTML = "";
  if(!list.length){
    box.innerHTML = `<div class="item muted">尚未有發佈套件。</div>`;
    return;
  }

  list.forEach(p=>{
    const theme = findTheme(p.themeId);
    const video = findVideo(p.videoId);
    const tool = findTool(p.toolId);

    const meta = [p.id, theme?.sentence || p.themeId, video?.title || p.videoId, tool?.name || p.toolId];
    const body = buildPublishText(p);

    const bCopy = btn("複製套件", ()=>copyToClipboard(body));
    const bDel = btn("刪除", ()=>{
      if(!confirm("刪除發佈套件？")) return;
      db.setPublishes(db.publishes().filter(x=>x.id!==p.id));
      toast("已刪除");
      renderPublishList();
    }, "iconBtn danger");

    box.appendChild(itemShell({title: "發佈套件", metaLines: meta, body, buttons:[bCopy, bDel]}));
  });
}

// ---------- COURSE LAB ----------
function bindCourseLab(){
  $("#formCourse").addEventListener("submit", (e)=>{
    e.preventDefault();
    const id = ($("#courseId").value||"").trim() || uid("course");
    const name = ($("#courseName").value||"").trim();
    const desc = ($("#courseDesc").value||"").trim();
    if(!name){ toast("課程名稱必填"); return; }

    const list = db.courses();
    if(list.some(x=>x.id===id)){ toast("這個課程ID已存在"); return; }
    list.unshift({id, name, desc, moduleIds: [], createdAt: nowISO()});
    db.setCourses(list);

    e.target.reset();
    toast("課程已新增");
    refreshAllSelects();
    renderCourseList();
  });

  $("#formAssign").addEventListener("submit", (e)=>{
    e.preventDefault();
    const courseId = $("#assignCourse").value;
    const moduleId = $("#assignModule").value;
    if(!courseId || !moduleId){ toast("請選課程與模組"); return; }

    const list = db.courses();
    const c = list.find(x=>x.id===courseId);
    if(!c){ toast("課程不存在"); return; }

    c.moduleIds = c.moduleIds || [];
    if(!c.moduleIds.includes(moduleId)){
      c.moduleIds.unshift(moduleId);
      db.setCourses(list);
      toast("已加入模組");
      renderCourseList();
    }else{
      toast("模組已在課程內");
    }
  });

  $("#courseSearch").addEventListener("input", renderCourseList);
}

function renderCourseList(){
  const q = byText($("#courseSearch").value);
  let list = db.courses();
  if(q) list = list.filter(c => `${c.id} ${c.name} ${c.desc}`.toLowerCase().includes(q));

  const box = $("#courseList");
  box.innerHTML = "";
  if(!list.length){
    box.innerHTML = `<div class="item muted">尚未有課程。</div>`;
    return;
  }

  list.forEach(c=>{
    const meta = [c.id, c.createdAt ? new Date(c.createdAt).toLocaleString() : ""];
    const names = (c.moduleIds||[]).map(id => findModule(id)?.title || id);
    const body = [
      c.desc ? `描述：${c.desc}` : "",
      names.length ? `模組：\n- ${names.join("\n- ")}` : "模組：尚未加入"
    ].filter(Boolean).join("\n");

    const bCopy = btn("複製課綱", ()=>{
      const text = `【課程】${c.name}\n【描述】${c.desc||""}\n【模組】\n- ${(c.moduleIds||[]).map(id=>findModule(id)?.title || id).join("\n- ")}`;
      copyToClipboard(text);
    });

    const bDel = btn("刪除", ()=>{
      if(!confirm("刪除課程？")) return;
      db.setCourses(db.courses().filter(x=>x.id!==c.id));
      toast("已刪除");
      refreshAllSelects();
      renderCourseList();
    }, "iconBtn danger");

    box.appendChild(itemShell({title: c.name, metaLines: meta, body, buttons:[bCopy, bDel]}));
  });
}

// ---------- IDEA LAB ----------
function bindIdeaLab(){
  $("#formIdea").addEventListener("submit", (e)=>{
    e.preventDefault();
    const title = ($("#ideaTitle").value||"").trim();
    const desc = ($("#ideaDesc").value||"").trim();
    if(!title){ toast("標題必填"); return; }

    const list = db.ideas();
    list.unshift({id: uid("idea"), title, desc, createdAt: nowISO()});
    db.setIdeas(list);

    e.target.reset();
    toast("已存發想");
    renderIdeaList();
  });

  $("#ideaSearch").addEventListener("input", renderIdeaList);
}

function renderIdeaList(){
  const q = byText($("#ideaSearch").value);
  let list = db.ideas();
  if(q) list = list.filter(i => `${i.title} ${i.desc}`.toLowerCase().includes(q));

  const box = $("#ideaList");
  box.innerHTML = "";
  if(!list.length){
    box.innerHTML = `<div class="item muted">尚未有發想。</div>`;
    return;
  }

  list.forEach(i=>{
    const meta = [i.id, i.createdAt ? new Date(i.createdAt).toLocaleString(): ""];
    const body = i.desc || "";

    const bCopy = btn("複製", ()=>copyToClipboard(`【發想】${i.title}\n${i.desc||""}`));
    const bDel = btn("刪除", ()=>{
      if(!confirm("刪除發想？")) return;
      db.setIdeas(db.ideas().filter(x=>x.id!==i.id));
      toast("已刪除");
      renderIdeaList();
    }, "iconBtn danger");

    box.appendChild(itemShell({title: i.title, metaLines: meta, body, buttons:[bCopy, bDel]}));
  });
}

// ---------- SETTINGS ----------
function bindSettings(){
  $("#btnClearAll").addEventListener("click", ()=>{
    if(!confirm("確定清除所有資料？建議先匯出備份。")) return;
    Object.values(K).forEach(key => localStorage.removeItem(key));
    toast("已清除");
    refreshAllSelects();
    renderAll();
  });
}

function renderStats(){
  const stats = [
    {name:"主題", num: db.themes().length},
    {name:"模組", num: db.modules().length},
    {name:"文案", num: db.copies().length},
    {name:"工具", num: db.tools().length},
    {name:"影片", num: db.videos().length},
    {name:"發佈套件", num: db.publishes().length},
    {name:"課程", num: db.courses().length},
    {name:"發想", num: db.ideas().length},
  ];

  const box = $("#stats");
  if(!box) return;
  box.innerHTML = "";
  stats.forEach(s=>{
    const el = document.createElement("div");
    el.className = "stat";
    el.innerHTML = `<div class="statNum">${s.num}</div><div class="statName">${s.name}</div>`;
    box.appendChild(el);
  });
}

// ---------- selects refresh ----------
function refreshAllSelects(){
  const themes = db.themes();
  const tools = db.tools();
  const videos = db.videos();
  const modules = db.modules();
  const copies = db.copies();
  const courses = db.courses();

  const fill = (sel, arr, optFn, keepFirst=false) => {
    const el = $(sel);
    if(!el) return;
    const first = keepFirst ? el.querySelector("option")?.outerHTML : "";
    el.innerHTML = first || "";
    arr.forEach(x=>{
      const opt = document.createElement("option");
      const {value, label} = optFn(x);
      opt.value = value;
      opt.textContent = label;
      el.appendChild(opt);
    });
  };

  fill("#spellTheme", themes, (t)=>({value:t.id, label:t.sentence}));
  fill("#publishTheme", themes, (t)=>({value:t.id, label:t.sentence}));
  fill("#matchTheme", themes, (t)=>({value:t.id, label:t.sentence}));
  fill("#copySpellTheme", themes, (t)=>({value:t.id, label:t.sentence}));

  fill("#publishTool", tools, (t)=>({value:t.id, label:t.name}));
  fill("#publishVideo", videos, (v)=>({value:v.id, label:`${v.title} (${v.series||""})`}));
  fill("#publishModule", modules, (m)=>({value:m.id, label:m.title}), true);
  fill("#publishCopy", copies, (c)=>({value:c.id, label:`${c.title} (${c.series})`}), true);

  fill("#assignCourse", courses, (c)=>({value:c.id, label:c.name}));
  fill("#assignModule", modules, (m)=>({value:m.id, label:m.title}));
}

// ---------- render all ----------
function renderAll(){
  renderThemeList();
  renderModuleList();
  renderCopyList();
  renderToolList();
  renderInventoryPanel();
  renderPublishList();
  renderCourseList();
  renderIdeaList();
  renderStats();
}

// ---------- PWA ----------
function registerSW(){
  if(!("serviceWorker" in navigator)) return;
  window.addEventListener("load", async ()=>{
    try{ await navigator.serviceWorker.register("./sw.js"); }catch(e){}
  });
}

// ---------- boot ----------
function boot(){
  bindTopActions();
  bindThemeLab();
  bindSpellLab();
  bindModuleLab();
  bindCopySpell();
  bindCopyLab();
  bindToolLab();
  bindInventoryLab();
  bindPublishLab();
  bindCourseLab();
  bindIdeaLab();
  bindSettings();

  refreshAllSelects();
  renderAll();
  registerSW();
}
boot();
