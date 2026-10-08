// === bookmark.js (終極穩定版：精準抓取 301/302/L3 所有文章句子與選填詞庫) ===
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

  // 🔍 終極版題幹擷取器：解決 _ 底線邊界問題，並自動附帶文意選填/篇章結構選項庫
  function extractContextFromSection(box, qNum) {
    if (box.querySelector(".stem, .zh-stem, .border-l-4")) return "";

    const sec = box.closest("section");
    if (!sec) return "";

    let extraHtml = "";

    // 1. 若該大題有「文意選填詞庫 (.word-bank 或 #sec-3 詞庫)」或「篇章結構選項」，一併抓進來方便重測作答
    const wordBank = sec.querySelector(".word-bank, .grid.grid-cols-2.sm\\:grid-cols-5");
    if (wordBank) {
      extraHtml += `<div style="background:#fffbeb;border:1px solid #fde68a;padding:8px 12px;border-radius:8px;margin-bottom:8px;font-size:13px;color:#92400e;"><b>【選項詞庫】</b> ${wordBank.innerText.replace(/\s+/g, " ")}</div>`;
    }
    const passageAllEn = sec.querySelectorAll(".passage .en");
    if (passageAllEn.length > 1) {
      // L2 第四部分「篇章結構」的第一個 .en 是 (A)~(E) 句子選項
      extraHtml += `<div style="background:#fffbeb;border:1px solid #fde68a;padding:8px 12px;border-radius:8px;margin-bottom:8px;font-size:13px;color:#1e293b;"><b>【篇章選項】</b><br>${passageAllEn[0].innerHTML}</div>`;
    }

    // 2. 尋找包含題號的文章段落
    const passageContainers = sec.querySelectorAll(".passage .en, .font-mono");
    // 注意：不用 \b 包尾，改用明確匹配： [21. C] 或 11.___ 或 獨立數字 11
    const matchPattern = new RegExp(`(\\[${qNum}\\.\\s*[A-Z]\\]|(?:^|\\D)${qNum}\\.___|(?:^|\\s)${qNum}(?:\\s|[.,?!]|$))`);

    for (const p of passageContainers) {
      const fullText = p.innerText.replace(/\s+/g, " ").trim();
      if (matchPattern.test(fullText)) {
        // 先把 "11." 暫時換成標記，避免切句子時把 "11." 的點當成句號切斷！
        const safeText = fullText
          .replace(/\[(\d+)\.\s*[A-Z]\]/g, "___BLANK_$1___")
          .replace(/(\d+)\.___/g, "___BLANK_$1___");

        const sentences = safeText.match(/[^.!?]+[.!?]+/g) || [safeText];
        const targetToken = `___BLANK_${qNum}___`;
        const looseNumRegex = new RegExp(`(^|\\s)${qNum}(\\s|[.,?!]|$)`);

        const idx = sentences.findIndex(s => s.includes(targetToken) || looseNumRegex.test(s));
        if (idx !== -1) {
          const prevSent = idx > 0 ? sentences[idx - 1].trim() + " " : "";
          const currSent = sentences[idx].trim();
          const nextSent = idx < sentences.length - 1 ? " " + sentences[idx + 1].trim() : "";

          const combined = (prevSent + currSent + nextSent)
            // 把目標題號換成醒目的紅色填空
            .replace(new RegExp(`___BLANK_${qNum}___`, "g"), `<strong style="color:#c0392b;background:#fef3c7;padding:0 6px;border-bottom:2px solid #c0392b;border-radius:3px;"> [ ___(${qNum})___ ] </strong>`)
            .replace(looseNumRegex, `$1<strong style="color:#c0392b;background:#fef3c7;padding:0 6px;border-bottom:2px solid #c0392b;border-radius:3px;"> [ ___(${qNum})___ ] </strong>$2`)
            // 把同句中其他題號還原為普通空格
            .replace(/___BLANK_(\d+)___/g, " ___($1)___ ");

          extraHtml += `<div class="stem auto-extracted-stem" style="background:#f8fafc;padding:12px 14px;border-left:4px solid #9a3b2e;border-radius:6px;margin:10px 0;font-family:Georgia,serif;font-size:15.5px;line-height:1.7;color:#1e293b;"><b>📖 文章前後文題幹：</b><br>${combined}</div>`;
          break;
        }
      }
    }
    return extraHtml;
  }

  function getQuestionElements() {
    const list = [];
    document.querySelectorAll("details.q").forEach(el => {
      const qNum = el.querySelector("summary .n")?.innerText.trim() || el.id.replace("q", "");
      const header = el.querySelector("summary");
      const insertBeforeEl = header?.querySelector(".ans");
      list.push({ box: el, header, insertBeforeEl, qNum });
    });
    document.querySelectorAll(".qcard").forEach(el => {
      const rawNum = el.querySelector(".qnum")?.innerText.trim() || "";
      const qNum = rawNum.match(/^\d+/)?.[0] || rawNum;
      const header = el.querySelector(".qhead") || el;
      list.push({ box: el, header, insertBeforeEl: null, qNum });
    });
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

  // 🔄 自動升級已標記的舊題目：只要打開考卷網頁，若發現 localStorage 裡該考卷的舊標記沒抓到文章原句，立刻自動補齊！
  function autoUpgradeExistingBookmarks(qItems) {
    const data = getLocalData();
    let updated = false;
    qItems.forEach(({ box, qNum }, idx) => {
      const cleanNum = String(qNum).replace(/[^\d]/g, "") || (idx + 1);
      const qId = `${examTitle}_Q${cleanNum}`.replace(/\s+/g, "_");
      const savedItem = data.questions.find(q => q.id === qId);
      if (savedItem && !savedItem.htmlContent.includes("auto-extracted-stem")) {
        const extraStemHtml = extractContextFromSection(box, cleanNum);
        if (extraStemHtml) {
          const clone = box.cloneNode(true);
          clone.querySelector(".bm-star-btn")?.remove();
          const firstChild = clone.firstElementChild;
          if (firstChild) firstChild.insertAdjacentHTML("afterend", extraStemHtml);
          else clone.insertAdjacentHTML("afterbegin", extraStemHtml);
          savedItem.htmlContent = clone.outerHTML;
          updated = true;
          syncToCloud("upsert", "question", savedItem);
        }
      }
    });
    if (updated) {
      saveLocalData(data);
      showToast("✨ 已自動為舊標記補齊文章原句！");
    }
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

          const extraStemHtml = extractContextFromSection(box, cleanNum);
          if (extraStemHtml) {
            const firstChild = clone.firstElementChild;
            if (firstChild) firstChild.insertAdjacentHTML("afterend", extraStemHtml);
            else clone.insertAdjacentHTML("afterbegin", extraStemHtml);
          }

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

    // 自動檢查並幫舊標記補上文章題幹
    autoUpgradeExistingBookmarks(qItems);
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

  // 反白文字收藏單字
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

        const sBlock = anchorEl?.closest(".s, .stem");
        const qCardL2 = anchorEl?.closest(".qcard");
        const articleL1 = anchorEl?.closest("article");

        if (sBlock && sBlock.querySelector(".en")) {
          selEnSentence = (sBlock.querySelector(".en")?.innerText || "").replace(/^參考譯文：\s*/, "").trim();
          selZhSentence = (sBlock.querySelector(".zh")?.innerText || "").trim();
        } else if (qCardL2 && qCardL2.querySelector(".stem")) {
          selEnSentence = qCardL2.querySelector(".stem")?.innerText.trim() || text;
          selZhSentence = qCardL2.querySelector(".zh-stem")?.innerText.trim() || "";
        } else if (articleL1 && articleL1.querySelector(".border-l-4")) {
          const box = articleL1.querySelector(".border-l-4");
          const pTags = box.querySelectorAll("p");
          selEnSentence = pTags[0]?.innerText.trim() || box.innerText.trim();
          selZhSentence = (pTags[1]?.innerText || "").replace(/^【中譯】/, "").trim();
        } else {
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
