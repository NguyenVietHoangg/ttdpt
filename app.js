/**
 * LZW Visualization Application Controller
 */

// Global App State
let appState = {
  originalText: "",
  encodedCodes: [],
  decodedText: "",
  encoderTrace: [],
  decoderTrace: [],
  initialDict: {},
  addedDict: {}, // dictionary entries added during compression
  currentStep: 0,
  maxStep: 0,
  activeVizTab: "encoder", // 'encoder', 'decoder', 'dict'
  playbackInterval: null,
  playbackSpeed: 600, // ms
  isPlaying: false,
  inputMethod: "text" // 'text' or 'file'
};

// Initialize app when DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  // Initialize Lucide Icons
  lucide.createIcons();

  // Theme Switching Logic
  initTheme();

  // Setup drag & drop for file input
  setupDragAndDrop();

  // Setup file selector trigger
  const fileSelector = document.getElementById("file-selector");
  const dropZone = document.getElementById("file-drop-zone");
  
  dropZone.addEventListener("click", () => {
    fileSelector.click();
  });

  fileSelector.addEventListener("change", (e) => {
    handleFileSelect(e.target.files[0]);
  });

  // Load default trace table layout or run default immediately
  runLZW();
});

// Theme management
function initTheme() {
  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  if (!themeToggleBtn) return;

  // Retrieve theme from localStorage or default to light theme (since the user requested white background)
  const savedTheme = localStorage.getItem("app-theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);

  themeToggleBtn.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("app-theme", newTheme);
  });
}

// Switching main sections (Simulation vs Theory)
function switchTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.remove("active");
  });
  document.querySelectorAll(".tab-content").forEach(content => {
    content.classList.remove("active");
  });

  // Find the button and trigger active state
  const activeBtn = Array.from(document.querySelectorAll(".tab-btn")).find(btn => 
    btn.getAttribute("onclick").includes(tabId)
  );
  if (activeBtn) activeBtn.classList.add("active");

  const activeContent = document.getElementById(`tab-${tabId}`);
  if (activeContent) activeContent.classList.add("active");
}

// Switching internal visualizer tabs (Encoder vs Decoder vs Dict)
function switchVizTab(vizTabId) {
  appState.activeVizTab = vizTabId;

  document.querySelectorAll(".viz-tab-btn").forEach(btn => {
    btn.classList.remove("active");
  });
  document.querySelectorAll(".viz-tab-content").forEach(content => {
    content.classList.remove("active");
  });

  // Find the button and trigger active
  const activeBtn = Array.from(document.querySelectorAll(".viz-tab-btn")).find(btn => 
    btn.getAttribute("onclick").includes(vizTabId)
  );
  if (activeBtn) activeBtn.classList.add("active");

  const activeContent = document.getElementById(`viz-${vizTabId}`);
  if (activeContent) activeContent.classList.add("active");

  // Sync step display and rows representation
  syncPlaybackUI();
}

// Toggle text vs file input method
function toggleInputMethod(method) {
  appState.inputMethod = method;
  
  document.getElementById("input-text-btn").classList.toggle("active", method === "text");
  document.getElementById("input-file-btn").classList.toggle("active", method === "file");

  document.getElementById("text-input-group").classList.toggle("d-none", method !== "text");
  document.getElementById("file-input-group").classList.toggle("d-none", method !== "file");
}

// Handle file loading
function handleFileSelect(file) {
  if (!file) return;

  const dropZone = document.getElementById("file-drop-zone");
  const fileInfo = document.getElementById("file-info");
  const fileNameSpan = document.getElementById("file-name");
  const fileSizeSpan = document.getElementById("file-size");

  fileNameSpan.innerText = file.name;
  fileSizeSpan.innerText = `(${(file.size / 1024).toFixed(2)} KB)`;

  // UI updates
  fileInfo.classList.remove("d-none");
  dropZone.classList.add("has-file");

  const reader = new FileReader();
  reader.onload = (e) => {
    appState.originalText = e.target.result;
  };
  reader.readAsText(file);
}

// Setup drag and drop events
function setupDragAndDrop() {
  const dropZone = document.getElementById("file-drop-zone");

  ["dragenter", "dragover"].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    }, false);
  });

  ["dragleave", "drop"].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
    }, false);
  });

  dropZone.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    if (file && file.name.endsWith(".txt")) {
      document.getElementById("file-selector").files = dt.files;
      handleFileSelect(file);
    } else {
      alert("Chỉ chấp nhận tệp văn bản .txt!");
    }
  });
}

// Load pre-defined sample text
function loadSample(text) {
  toggleInputMethod("text");
  document.getElementById("input-text").value = text;
  runLZW();
}

// Core Execution
function runLZW() {
  // Stop any running playback
  if (appState.isPlaying) {
    playbackControl("play"); // Toggles off
  }

  // Get input text
  if (appState.inputMethod === "text") {
    appState.originalText = document.getElementById("input-text").value;
  }

  if (!appState.originalText) {
    alert("Vui lòng nhập chuỗi văn bản hoặc tải lên tệp tin!");
    return;
  }

  const dictType = document.getElementById("dict-type").value;

  try {
    // 1. Encode
    const encodeRes = LZWEngine.encode(appState.originalText, dictType);
    appState.encodedCodes = encodeRes.codes;
    appState.encoderTrace = encodeRes.trace;
    appState.initialDict = encodeRes.initialDict;

    // Filter which elements are added dictionary entries
    appState.addedDict = {};
    for (const key in encodeRes.finalDict) {
      if (appState.initialDict[key] === undefined) {
        appState.addedDict[key] = encodeRes.finalDict[key];
      }
    }

    // 2. Decode
    const decodeRes = LZWEngine.decode(appState.encodedCodes, dictType, appState.originalText);
    appState.decodedText = decodeRes.text;
    appState.decoderTrace = decodeRes.trace;

    // 3. Verification check
    const isMatching = (appState.originalText === appState.decodedText);
    const verificationBadge = document.getElementById("verification-status");
    
    if (isMatching) {
      verificationBadge.className = "verification-badge success";
      verificationBadge.innerHTML = `<i data-lucide="check-circle"></i> <span>Giải mã thành công: Trùng khớp 100% dữ liệu gốc!</span>`;
    } else {
      verificationBadge.className = "verification-badge error";
      verificationBadge.innerHTML = `<i data-lucide="x-circle"></i> <span>Lỗi: Dữ liệu giải mã KHÔNG khớp với dữ liệu gốc!</span>`;
    }
    lucide.createIcons(); // refresh badge icon

    // 4. Update stats
    const stats = LZWEngine.getStats(appState.originalText, appState.encodedCodes, dictType);
    document.getElementById("stat-orig-chars").innerText = stats.originalChars;
    document.getElementById("stat-orig-bits").innerText = `${stats.originalBits} bits (8-bit ASCII)`;
    document.getElementById("stat-comp-codes").innerText = stats.compressedCodes;
    document.getElementById("stat-comp-bits").innerText = `${stats.compressedBits} bits (${stats.bitsPerCode}-bit code)`;
    document.getElementById("stat-ratio").innerText = `${stats.ratio}x`;
    document.getElementById("stat-saving").innerText = `${stats.spaceSaving}%`;

    // Progress Bar Fill
    const progressFill = document.getElementById("progress-fill");
    const progressPercent = document.getElementById("progress-percent");
    progressFill.style.width = `${stats.spaceSaving}%`;
    progressPercent.innerText = `${stats.spaceSaving}%`;

    // Output box text
    document.getElementById("compressed-output").innerText = appState.encodedCodes.join(" ");
    
    // Decompressed box text (handling long strings gracefully)
    document.getElementById("decompressed-output").innerText = appState.decodedText;

    // 5. Setup Trace Data and tables
    renderTables();
    renderDictionary();

    // Show visualizer card
    document.getElementById("visualizer-card").classList.remove("d-none");

    // Initialize playback steps
    appState.currentStep = 1;
    appState.maxStep = Math.max(appState.encoderTrace.length, appState.decoderTrace.length);
    document.getElementById("total-steps-display").innerText = appState.maxStep;

    // Sync state
    syncPlaybackUI();

  } catch (error) {
    console.error(error);
    alert(`Lỗi trong quá trình nén/giải nén LZW: ${error.message}`);
  }
}

// Render trace tables in memory
function renderTables() {
  // Encoder Table
  const encBody = document.getElementById("encoder-table-body");
  encBody.innerHTML = "";
  appState.encoderTrace.forEach((row) => {
    const tr = document.createElement("tr");
    tr.id = `enc-row-${row.step}`;
    tr.innerHTML = `
      <td>${row.step}</td>
      <td class="td-code">${escapeHtml(row.w)}</td>
      <td class="td-code">${escapeHtml(row.k)}</td>
      <td class="td-code">${escapeHtml(row.wk)}</td>
      <td>
        <span class="td-badge ${row.inDict === null ? '' : (row.inDict ? 'yes' : 'no')}">
          ${row.inDict === null ? 'Ø' : (row.inDict ? 'Có' : 'Không')}
        </span>
      </td>
      <td class="td-code">${row.outputCode !== null ? row.outputCode : '-'}</td>
      <td>
        ${row.dictAddedString ? `<span class="td-code">${escapeHtml(row.dictAddedString)}</span> &rarr; ${row.dictAddedCode}` : '-'}
      </td>
      <td class="td-action-text">${row.action}</td>
    `;
    encBody.appendChild(tr);
  });

  // Decoder Table
  const decBody = document.getElementById("decoder-table-body");
  decBody.innerHTML = "";
  appState.decoderTrace.forEach((row) => {
    const tr = document.createElement("tr");
    tr.id = `dec-row-${row.step}`;
    
    // For trace visual: we want to extract the previous entry W and character c
    // LZW Decoder logic updates: trace records contains inputCode, outputString, dictAddedString, dictAddedCode
    // We can infer W and c from previous states or split the description
    let w = "-";
    let c = "-";
    let wc = "-";
    
    if (row.step > 1 && row.dictAddedString) {
      // dictAddedString is W + c
      w = row.dictAddedString.slice(0, -1);
      c = row.dictAddedString.slice(-1);
      wc = row.dictAddedString;
    }

    tr.innerHTML = `
      <td>${row.step}</td>
      <td class="td-code">${row.inputCode}</td>
      <td class="td-code">${escapeHtml(row.outputString)}</td>
      <td class="td-code">${escapeHtml(w)}</td>
      <td class="td-code">${escapeHtml(c)}</td>
      <td class="td-code">${escapeHtml(wc)}</td>
      <td>
        ${row.dictAddedString ? `<span class="td-code">${escapeHtml(row.dictAddedString)}</span> &rarr; ${row.dictAddedCode}` : '-'}
      </td>
      <td class="td-action-text">${row.notes}</td>
    `;
    decBody.appendChild(tr);
  });
}

// Render dictionary grid views
function renderDictionary() {
  const initGrid = document.getElementById("initial-dict-grid");
  const addedGrid = document.getElementById("added-dict-grid");

  initGrid.innerHTML = "";
  addedGrid.innerHTML = "";

  // Render initial dict (limit view to first 256 for ASCII, but let's show all or just printable ones to save rendering cost)
  const initKeys = Object.keys(appState.initialDict);
  let count = 0;
  
  initKeys.forEach(key => {
    // For ASCII, only render printable characters or representations to avoid breaking layout
    if (initKeys.length > 50 && count > 50) {
      if (count === 51) {
        const div = document.createElement("div");
        div.className = "dict-item text-muted";
        div.style.gridColumn = "1 / -1";
        div.innerHTML = `<span style="width:100%; text-align:center;">... và ${initKeys.length - 50} mã cơ bản khác ...</span>`;
        initGrid.appendChild(div);
      }
      count++;
      return;
    }
    
    const div = document.createElement("div");
    div.className = "dict-item";
    div.innerHTML = `
      <span class="dict-item-string">${escapeHtml(getDisplayChar(key))}</span>
      <span class="dict-item-code">${appState.initialDict[key]}</span>
    `;
    initGrid.appendChild(div);
    count++;
  });

  // Render added dictionary entries
  const addedKeys = Object.keys(appState.addedDict);
  if (addedKeys.length === 0) {
    addedGrid.innerHTML = `<div style="color:var(--text-muted); font-size:0.9rem; text-align:center; width:100%; padding:20px;">Không có từ khóa mới được thêm (chuỗi quá ngắn hoặc không lặp).</div>`;
    return;
  }

  addedKeys.forEach(key => {
    const code = appState.addedDict[key];
    const div = document.createElement("div");
    div.className = "dict-item";
    div.id = `dict-item-code-${code}`;
    div.innerHTML = `
      <span class="dict-item-string">${escapeHtml(key)}</span>
      <span class="dict-item-code">${code}</span>
    `;
    addedGrid.appendChild(div);
  });
}

// Safe escape HTML utilities
function escapeHtml(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t")
    .replace(/ /g, "&nbsp;");
}

// Display representation of non-printable ASCII
function getDisplayChar(char) {
  if (char === " ") return "Space";
  if (char === "\n") return "\\n";
  if (char === "\t") return "\\t";
  if (char === "\r") return "\\r";
  
  const code = char.charCodeAt(0);
  if (code < 32 || code > 126) {
    return `ASCII ${code}`;
  }
  return char;
}

// Playback Control execution logic
function playbackControl(action) {
  switch (action) {
    case "start":
      appState.currentStep = 1;
      if (appState.isPlaying) stopAutoplay();
      break;
    case "prev":
      if (appState.currentStep > 1) appState.currentStep--;
      if (appState.isPlaying) stopAutoplay();
      break;
    case "next":
      if (appState.currentStep < appState.maxStep) appState.currentStep++;
      else if (appState.isPlaying) stopAutoplay();
      break;
    case "end":
      appState.currentStep = appState.maxStep;
      if (appState.isPlaying) stopAutoplay();
      break;
    case "play":
      if (appState.isPlaying) {
        stopAutoplay();
      } else {
        startAutoplay();
      }
      break;
  }
  syncPlaybackUI();
}

function startAutoplay() {
  appState.isPlaying = true;
  const btn = document.getElementById("btn-play");
  btn.innerHTML = `<i data-lucide="pause"></i> Tạm dừng`;
  btn.classList.add("playing");
  lucide.createIcons();

  appState.playbackInterval = setInterval(() => {
    if (appState.currentStep < appState.maxStep) {
      appState.currentStep++;
      syncPlaybackUI();
    } else {
      stopAutoplay();
      syncPlaybackUI();
    }
  }, appState.playbackSpeed);
}

function stopAutoplay() {
  appState.isPlaying = false;
  const btn = document.getElementById("btn-play");
  btn.innerHTML = `<i data-lucide="play"></i> Tự chạy`;
  btn.classList.remove("playing");
  lucide.createIcons();
  clearInterval(appState.playbackInterval);
}

function updatePlaybackSpeed() {
  const speed = document.getElementById("speed-range").value;
  appState.playbackSpeed = parseInt(speed);
  document.getElementById("speed-display").innerText = `${speed}ms`;
  
  if (appState.isPlaying) {
    clearInterval(appState.playbackInterval);
    startAutoplay();
  }
}

// Synchronize UI steps, row highlights and dictionary filtering
function syncPlaybackUI() {
  // Update step number text
  document.getElementById("current-step-display").innerText = appState.currentStep;

  // 1. Remove highlight on all rows
  document.querySelectorAll(".trace-table tbody tr").forEach(tr => {
    tr.classList.remove("active-step-row");
    tr.style.opacity = "0.4"; // dim other rows
  });

  const activeTab = appState.activeVizTab;
  let targetRow = null;

  if (activeTab === "encoder") {
    // Find encoder trace step
    const encRow = document.getElementById(`enc-row-${appState.currentStep}`);
    if (encRow) {
      encRow.classList.add("active-step-row");
      encRow.style.opacity = "1";
      targetRow = encRow;
    }
    
    // Highlight up to the current encoder rows
    for (let i = 1; i <= appState.currentStep; i++) {
      const row = document.getElementById(`enc-row-${i}`);
      if (row && i !== appState.currentStep) {
        row.style.opacity = "0.85";
      }
    }
  } else if (activeTab === "decoder") {
    // Find decoder step
    const decRow = document.getElementById(`dec-row-${appState.currentStep}`);
    if (decRow) {
      decRow.classList.add("active-step-row");
      decRow.style.opacity = "1";
      targetRow = decRow;
    }

    // Highlight up to current decoder rows
    for (let i = 1; i <= appState.currentStep; i++) {
      const row = document.getElementById(`dec-row-${i}`);
      if (row && i !== appState.currentStep) {
        row.style.opacity = "0.85";
      }
    }
  } else if (activeTab === "dict") {
    // Show dictionary items dynamically based on LZW compression progress
    // Let's check what code was added up to the current step of Encoder
    // We get the nextCode limit at current step
    let activeLimitCode = -1;
    
    // Loop through trace up to current step
    const bound = Math.min(appState.currentStep, appState.encoderTrace.length);
    for (let i = 0; i < bound; i++) {
      const stepData = appState.encoderTrace[i];
      if (stepData.dictAddedCode) {
        activeLimitCode = Math.max(activeLimitCode, stepData.dictAddedCode);
      }
    }

    // Highlight added dictionary items
    document.querySelectorAll("#added-dict-grid .dict-item").forEach(item => {
      const codeId = parseInt(item.id.replace("dict-item-code-", ""));
      if (codeId <= activeLimitCode) {
        item.style.display = "flex";
        item.style.opacity = "1";
        if (codeId === activeLimitCode) {
          item.style.borderColor = "var(--accent-cyan)";
          item.style.boxShadow = "var(--glow-cyan)";
        } else {
          item.style.borderColor = "var(--border-color)";
          item.style.boxShadow = "none";
        }
      } else {
        item.style.display = "none"; // Hide dictionary items not yet added
      }
    });

    // Make initial dictionary always opacity 1
    document.querySelectorAll("#initial-dict-grid .dict-item").forEach(item => {
      item.style.opacity = "1";
    });
  }

  // Scroll current highlighted row into view smoothly
  if (targetRow) {
    targetRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

// Handle Dictionary selection reset
function handleDictTypeChange() {
  runLZW();
}

// Copy to clipboard helper
function copyText(elementId) {
  const text = document.getElementById(elementId).innerText;
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      alert("Đã sao chép vào bộ nhớ đệm!");
    }).catch(err => {
      console.error("Lỗi copy: ", err);
    });
  } else {
    // Fallback
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    alert("Đã sao chép vào bộ nhớ đệm (fallback)!");
  }
}
