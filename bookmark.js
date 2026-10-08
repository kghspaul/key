// === bookmark.js (303 大卷標準格式專用定案版) ===
const CONFIG = {
  // 👇 請替換成你部署的 Google Apps Script 網址
  GAS_URL: "https://script.google.com/macros/s/AKfycbz4d11mhhpKrOul0U05G5J0MyrAODB9byZeOzfSeyd005XPf6m1jMSrAeuqgULevn5q/exec",
  REVIEW_PAGE_URL: "review.html"
};

(function () {
  const STORAGE_KEY = "kghs_exam_bookmarks_v1";
  const STUDENT_KEY = "kghs_student_id";
  const examTitle = (document.querySelector(".top h1")?.innerText || document.title || "未命名考卷").trim();

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
    .bm-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-left: auto; }
    .bm-input { padding: 4px 10px; border: 1px solid var(--line); border-radius: 99px; background: var(--card); color: var(--fg); font-size: .84rem; width: 125px; outline: none; }
    .bm-input:focus { border-color: var(--acc); }
    .bm-nav-link { padding: 5px 12px; border-radius: 99px; background: var(--acc) !important; color: #fff !important; font-weight: 600; text-decoration: none; font-size: .86rem; display: inline-flex; align-items: center; gap: 4px; border: none !important; }
    .bm-star-btn { padding: 2px 10px; border-radius: 99px; border: 1px solid var(--line); background: var(--bg); color: var(--mut); font-size: .8rem; cursor: pointer; transition: .15s; margin-left: 4px; }
    .bm-star-btn:hover { border-color: var(--acc); color: var(--acc); }
    .bm-star-btn.saved { background: var(--hl); border-color: var(--acc); color: var(--acc); font-weight: 700; }
    .bm-popup { position: absolute; z-index: 9999; background: var(--fg); color: var(--bg); padding: 6px 14px; border-radius: 99px; font-size: .86rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.25); display: none; transform: translate(-50%, -100%); margin-top: -10px; white-space: nowrap; }
    .bm-toast { position: fixed; bottom: 20px; right: 20px; background: var(--fg); color: var(--bg); padding: 8px 16px; border-radius: 99px; font-size: .86rem; z-index: 9999; opacity: 0; transition: opacity .25s; pointer-events: none; box-shadow: 0 4px 12px rgba(0,0,0,.2); }
  `;
  document.head.appendChild(style);

  const nav = document.getElementById("nav");
  if (nav) {
    const bmBar = document.createElement("div");
    bmBar.className = "bm-bar";
    bmBar.innerHTML = `
      <input type="text" class="bm-input" id="bm-sid" placeholder="👤 學號/暱稱同步" value="${getStudentId()}">
      <button type="button" id="bm-sync-btn">🔄 同步</button>
      <a href="${CONFIG.REVIEW_PAGE_URL}" class="bm-nav-link">📚 複習本 (<span id="bm-total">0</span>)</a>
    `;
    nav.appendChild(bmBar);

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

  function injectQuestionButtons() {
    document.querySelectorAll("details.q").forEach((det) => {
      const summary = det.querySelector("summary");
      if (!summary || summary.querySelector(".bm-star-btn")) return;

      const qNumText = summary.querySelector(".n")?.innerText.trim() || det.id.replace("q", "");
      const qId = `${examTitle}_Q${qNumText}`.replace(/\s+/g, "_");
      det.setAttribute("data-bm-qid", qId);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bm-star-btn";
      btn.setAttribute("data-bm-btn", qId);

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const data = getLocalData();
        const idx = data.questions.findIndex(q => q.id === qId);

        if (idx >= 0) {
          const removed = data.questions.splice(idx, 1)[0];
          saveLocalData(data);
          showToast(`已取消標記 第 ${qNumText} 題`);
          syncToCloud("delete", "question", removed);
        } else {
          const clone = det.cloneNode(true);
          clone.querySelector(".bm-star-btn")?.remove();

          const note = prompt(`【標記第 ${qNumText} 題】\n可輸入這題的個人筆記（直接按確定可略過）：`, "");
          if (note === null) return;

          const newItem = {
            id: qId,
            examTitle,
            qNum: `第 ${qNumText} 題`,
            htmlContent: clone.innerHTML,
            note: note.trim(),
            timestamp: Date.now()
          };
          data.questions.push(newItem);
          saveLocalData(data);
          showToast(`⭐ 已將 第 ${qNumText} 題 加入複習本`);
          syncToCloud("upsert", "question", newItem);
        }
      });

      const ansEl = summary.querySelector(".ans");
      if (ansEl) summary.insertBefore(btn, ansEl);
      else summary.appendChild(btn);
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

  const popup = document.createElement("div");
  popup.className = "bm-popup";
  popup.textContent = "➕ 收藏單字 / 片語";
  document.body.appendChild(popup);

  let selWord = "";
  let selEnSentence = "";
  let selZhSentence = "";

  function handleSelection(e) {
    if (popup.contains(e.target)) return;
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel.toString().trim();
      if (text.length >= 2 && text.length <= 70) {
        selWord = text;
        const anchorEl = sel.anchorNode?.parentElement;
        const sentenceBlock = anchorEl?.closest(".s, .stem");
        if (sentenceBlock) {
          selEnSentence = (sentenceBlock.querySelector(".en")?.innerText || "").replace(/^參考譯文：\s*/, "").trim();
          selZhSentence = (sentenceBlock.querySelector(".zh")?.innerText || "").trim();
        } else {
          const fallbackBlock = anchorEl?.closest("li, .clue, p, div");
          selEnSentence = (fallbackBlock?.innerText || text).replace(/\s+/g, " ").trim();
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
      `【收藏單字 / 片語】\n字詞：${selWord}\n例句：${selEnSentence}\n\n請輸入字義或筆記（已自動帶入原句中譯，可直接修改）：`,
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
