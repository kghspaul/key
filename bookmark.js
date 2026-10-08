// === bookmark.js (萬用相容版：同時支援 L1 Tailwind、L2 qcard、L3 details.q 與新考卷) ===
const CONFIG = {
  // 👇 請替換成你部署的 Google Apps Script 網址
  GAS_URL: "https://script.google.com/macros/s/請替換成你的網址/exec",
  REVIEW_PAGE_URL: "review.html"
};

(function () {
  const STORAGE_KEY = "kghs_exam_bookmarks_v1";
  const STUDENT_KEY = "kghs_student_id";
  const examTitle = (document.querySelector("h1")?.innerText || document.title || "未命名考卷").trim();

  function getLocalData() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { questions: [], vocab: [] }; }
    catch { return { questions: [], vocab: [] }; }
  }
  function saveLocalData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    updateUI();
  }
  function getStudentId() {
    return localStorage.getItem(STUDENT_KEY) || "";
  }

  async function syncToCloud(action, itemType, item) {
    const studentId = getStudentId();
    if (!studentId || !CONFIG.GAS_URL.startsWith("https://script.google.com")) return;
    showToast("☁️ 雲端同步中...");
    try {
      await fetch(CONFIG.GAS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, studentId, itemType, item })
      });
      showToast("✅ 已儲存並同步至雲端");
    } catch (e) {
      showToast("⚠️ 離線狀態，已先儲存於本機");
    }
  }

  async function pullFromCloud() {
    const studentId = getStudentId();
    if (!studentId) return showToast("請先輸入學號或暱稱！");
    if (!CONFIG.GAS_URL.startsWith("https://script.google.com")) return showToast("⚠️ 尚未設定雲端網址，目前僅使用本機儲存");
    showToast("🔄 正在從雲端同步標記...");
    try {
      const res = await fetch(`${CONFIG.GAS_URL}?studentId=${encodeURIComponent(studentId)}`);
      const cloudData = await res.json();
      if (cloudData.status === "ok") {
        saveLocalData({ questions: cloudData.questions || [], vocab: cloudData.vocab || [] });
        showToast("✅ 雲端同步完成！");
      }
    } catch (e) {
      showToast("⚠️ 無法連線雲端，目前顯示本機紀錄");
    }
  }

  // 1. 注入萬用樣式（含 CSS 變數 Fallback 預設值，確保任何版型都清晰可見）
  const style = document.createElement("style");
  style.textContent = `
    :root {
      --bm-acc: var(--acc, var(--accent, #9a3b2e));
      --bm-bg: var(--card, #ffffff);
      --bm-fg: var(--fg, var(--ink, #1e293b));
      --bm-line: var(--line, #cbd5e1);
      --bm-hl: var(--hl, var(--clue-bg, #fef3c7));
    }
    .bm-bar { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-left: auto; padding: 2px 0; }
    .bm-input { padding: 4px 10px !important; border: 1px solid var(--bm-line) !important; border-radius: 99px !important; background: var(--bm-bg) !important; color: var(--bm-fg) !important; font-size: 13px !important; width: 130px !important; outline: none !important; }
    .bm-sync-btn { padding: 4px 10px !important; border: 1px solid var(--bm-line) !important; border-radius: 99px !important; background: var(--bm-bg) !important; color: var(--bm-fg) !important; font-size: 13px !important; cursor: pointer !important; }
    .bm-nav-link { padding: 5px 12px !important; border-radius: 99px !important; background: var(--bm-acc) !important; color: #fff !important; font-weight: 600 !important; text-decoration: none !important; font-size: 13px !important; display: inline-flex !important; align-items: center !important; gap: 4px !important; border: none !important; }
    .bm-star-btn { padding: 3px 10px !important; border-radius: 99px !important; border: 1px solid var(--bm-line) !important; background: var(--bm-bg) !important; color: #64748b !important; font-size: 12.5px !important; font-weight: 600 !important; cursor: pointer !important; transition: .15s !important; margin-left: 6px !important; display: inline-flex !important; align-items: center !important; }
    .bm-star-btn:hover { border-color: var(--bm-acc) !important; color: var(--bm-acc) !important; }
    .bm-star-btn.saved { background: var(--bm-hl) !important; border-color: var(--bm-acc) !important; color: var(--bm-acc) !important; font-weight: 700 !important; }
    .bm-popup { position: absolute; z-index: 99999; background: #1e293b; color: #fff; padding: 6px 14px; border-radius: 99px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.25); display: none; transform: translate(-50%, -100%); margin-top: -10px; white-space: nowrap; }
    .bm-toast { position: fixed; bottom: 20px; right: 20px; background: #1e293b; color: #fff; padding: 8px 16px; border-radius: 99px; font-size: 13px; z-index: 99999; opacity: 0; transition: opacity .25s; pointer-events: none; box-shadow: 0 4px 12px rgba(0,0,0,.25); }
  `;
  document.head.appendChild(style);

  // 2. 自動尋找導覽列掛載（支援 L3 #nav、L2 nav.subnav、L1 header 控制列）
  const navTarget =
    document.getElementById("nav") ||
    document.querySelector("nav.subnav") ||
    document.querySelector("header .flex.items-center.gap-2") ||
    document.querySelector("header");

  if (navTarget) {
    const bmBar = document.createElement("div");
    bmBar.className = "bm-bar";
    bmBar.innerHTML = `
      <input type="text" class="bm-input" id="bm-sid" placeholder="👤 學號/暱稱同步" value="${getStudentId()}">
      <button type="button" class="bm-sync-btn" id="bm-sync-btn" title="從雲端載入紀錄">🔄 同步</button>
      <a href="${CONFIG.REVIEW_PAGE_URL}" class="bm-nav-link">📚 複習本 (<span id="bm-total">0</span>)</a>
    `;
    navTarget.appendChild(bmBar);

    document.getElementById("bm-sid").addEventListener("change", (e) => {
      localStorage.setItem(STUDENT_KEY, e.target.value.trim());
      pullFromCloud();
    });
    document.getElementById("bm-sync-btn").addEventListener("click", pullFromCloud);
  }

  const toast = document.createElement("div");
  toast.className = "bm-toast";
  document.body.appendChild(toast);
  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.style.opacity = "0"; }, 2400);
  }

  // 3. 智慧掃描所有題目容器（同時支援 L3 details.q、L2 .qcard、L1 article 與第3大題卡片）
  function getQuestionElements() {
    const list = [];
    // (A) L3 格式: details.q
    document.querySelectorAll("details.q").forEach(el => {
      const qNum = el.querySelector("summary .n")?.innerText.trim() || el.id.replace("q", "");
      const header = el.querySelector("summary");
      const insertBeforeEl = header?.querySelector(".ans");
      list.push({ box: el, header, insertBeforeEl, qNum });
    });
    // (B) L2 格式: .qcard
    document.querySelectorAll(".qcard").forEach(el => {
      const rawNum = el.querySelector(".qnum")?.innerText.trim() || "";
      const qNum = rawNum.match(/^\d+/)?.[0] || rawNum;
      const header = el.querySelector(".qhead") || el;
      list.push({ box: el, header, insertBeforeEl: null, qNum });
    });
    // (C) L1 格式: article 與 #sec-3 內的單題卡片
    document.querySelectorAll("article, #sec-3 .grid > div.bg-white.p-4").forEach(el => {
      const firstRow = el.firstElementChild;
      const numBadge = firstRow?.querySelector("span.font-extrabold, span.font-black");
      if (numBadge) {
        const qNum = numBadge.innerText.trim();
        list.push({ box: el, header: firstRow, insertBeforeEl: firstRow.lastElementChild, qNum });
      }
    });
    return list;
  }

  function injectQuestionButtons() {
    const qItems = getQuestionElements();
    qItems.forEach(({ box, header, insertBeforeEl, qNum }, idx) => {
      if (!header || header.querySelector(".bm-star-btn")) return;

      const cleanNum = String(qNum).replace(/[^\d]/g, "") || (idx + 1);
      const qId = `${examTitle}_Q${cleanNum}`.replace(/\s+/g, "_");
      box.setAttribute("data-bm-qid", qId);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bm-star-btn";
      btn.setAttribute("data-bm-btn", qId);

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const data = getLocalData();
        const existIdx = data.questions.findIndex(q => q.id === qId);

        if (existIdx >= 0) {
          const removed = data.questions.splice(existIdx, 1)[0];
          saveLocalData(data);
          showToast(`已取消標記 第 ${cleanNum} 題`);
          syncToCloud("delete", "question", removed);
        } else {
          const clone = box.cloneNode(true);
          clone.querySelector(".bm-star-btn")?.remove();

          const note = prompt(`【標記第 ${cleanNum} 題】\n可輸入這題的個人筆記（直接按確定可略過）：`, "");
          if (note === null) return;

          const newItem = {
            id: qId,
            examTitle,
            qNum: `第 ${cleanNum} 題`,
            htmlContent: clone.outerHTML,
            note: note.trim(),
            timestamp: Date.now()
          };
          data.questions.push(newItem);
          saveLocalData(data);
          showToast(`⭐ 已將 第 ${cleanNum} 題 加入複習本`);
          syncToCloud("upsert", "question", newItem);
        }
      });

      if (insertBeforeEl && insertBeforeEl.parentNode === header) {
        header.insertBefore(btn, insertBeforeEl);
      } else {
        header.appendChild(btn);
      }
    });
    updateUI();
  }

  function updateUI() {
    const data = getLocalData();
    const totalEl = document.getElementById("bm-total");
    if (totalEl) totalEl.textContent = data.questions.length + data.vocab.length;

    document.querySelectorAll(".bm-star-btn").forEach(btn => {
      const qId = btn.getAttribute("data-bm-btn");
      const saved = data.questions.some(q => q.id === qId);
      btn.classList.toggle("saved", saved);
      btn.textContent = saved ? "★ 已標記" : "☆ 標記此題";
    });
  }

  // 4. 反白文字：跨版型自動擷取「英文原句 + 中文翻譯」
  const popup = document.createElement("div");
  popup.className = "bm-popup";
  popup.textContent = "➕ 收藏單字 / 片語";
  document.body.appendChild(popup);

  let selWord = "";
  let selEnSentence = "";
  let selZhSentence = "";

  function extractSingleSentence(text, target) {
    if (!text) return target;
    const clean = text.replace(/\s+/g, " ").trim();
    const sents = clean.match(/[^.!?]+[.!?]+/g) || [clean];
    return (sents.find(s => s.toLowerCase().includes(target.toLowerCase())) || clean).trim();
  }

  function handleSelection(e) {
    if (popup.contains(e.target)) return;
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel.toString().trim();
      if (text.length >= 2 && text.length <= 75) {
        selWord = text;
        const anchorEl = sel.anchorNode?.parentElement;

        // 支援 L3 (.s, .stem)、L2 (.qcard, .passage)、L1 (article, p)
        const sBlock = anchorEl?.closest(".s, .stem");
        const qCardL2 = anchorEl?.closest(".qcard");
        const articleL1 = anchorEl?.closest("article");

        if (sBlock && sBlock.querySelector(".en")) {
          // L3 格式
          selEnSentence = (sBlock.querySelector(".en")?.innerText || "").replace(/^參考譯文：\s*/, "").trim();
          selZhSentence = (sBlock.querySelector(".zh")?.innerText || "").trim();
        } else if (qCardL2 && qCardL2.querySelector(".stem")) {
          // L2 單題格式
          selEnSentence = qCardL2.querySelector(".stem")?.innerText.trim() || text;
          selZhSentence = qCardL2.querySelector(".zh-stem")?.innerText.trim() || "";
        } else if (articleL1 && articleL1.querySelector(".border-l-4")) {
          // L1 單題格式
          const box = articleL1.querySelector(".border-l-4");
          const pTags = box.querySelectorAll("p");
          selEnSentence = pTags[0]?.innerText.trim() || box.innerText.trim();
          selZhSentence = (pTags[1]?.innerText || "").replace(/^【中譯】/, "").trim();
        } else {
          // 文章段落或其他區塊：自動從該段落切出包含該單字的那一句英文
          const para = anchorEl?.closest("p, li, td, div");
          selEnSentence = extractSingleSentence(para?.innerText || text, selWord);
          selZhSentence = "";
        }

        const rect = sel.getRangeAt(0).getBoundingClientRect();
        popup.style.left = `${rect.left + rect.width / 2 + window.scrollX}px`;
        popup.style.top = `${rect.top + window.scrollY}px`;
        popup.style.display = "block";
      } else {
        popup.style.display = "none";
      }
    }, 15);
  }

  document.addEventListener("mouseup", handleSelection);
  document.addEventListener("touchend", handleSelection);

  popup.addEventListener("mousedown", (e) => {
    e.preventDefault();
    popup.style.display = "none";

    const defaultNote = selZhSentence ? `句意：${selZhSentence}` : "";
    const note = prompt(
      `【收藏單字 / 片語】\n字詞：${selWord}\n例句：${selEnSentence}\n\n請輸入字義或筆記：`,
      defaultNote
    );
    if (note === null) return;

    const data = getLocalData();
    const newItem = {
      id: "v_" + Date.now(),
      examTitle,
      word: selWord,
      contextSentence: selEnSentence,
      note: note.trim(),
      timestamp: Date.now()
    };
    data.vocab.push(newItem);
    saveLocalData(data);
    window.getSelection().removeAllRanges();
    showToast(`⭐ 已收藏「${selWord}」`);
    syncToCloud("upsert", "vocab", newItem);
  });

  injectQuestionButtons();
})();
