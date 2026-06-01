const API_BASE = (window.PMA_CONFIG && window.PMA_CONFIG.apiBase ? window.PMA_CONFIG.apiBase : "").replace(/\/$/, "");

const fileInput = document.getElementById("videoFile");
const dropZone = document.querySelector(".drop-zone");
const fileName = document.getElementById("fileName");
const analyzeBtn = document.getElementById("analyzeBtn");
const progressWrap = document.getElementById("progressWrap");
const progressText = document.getElementById("progressText");
const progressValue = document.getElementById("progressValue");
const progressBar = document.getElementById("progressBar");
const statusMessage = document.getElementById("statusMessage");
const results = document.getElementById("results");
const resultVideo = document.getElementById("resultVideo");
const frameTable = document.getElementById("frameTable");
const ballTable = document.getElementById("ballTable");
const downloadVideo = document.getElementById("downloadVideo");
const downloadCsv = document.getElementById("downloadCsv");
const downloadBallCsv = document.getElementById("downloadBallCsv");

let angleChart = null;
let progressTimer = null;

const allowedExtensions = [".mp4", ".mov", ".avi"];

fileInput.addEventListener("change", () => {
  setSelectedFile(fileInput.files[0]);
});

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropZone.classList.add("is-dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropZone.classList.remove("is-dragover");
  });
});

dropZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer.files[0];
  if (!file) return;

  const extension = getExtension(file.name);
  if (!allowedExtensions.includes(extension)) {
    statusMessage.textContent = "仅支持 mp4、mov、avi 视频格式。";
    return;
  }

  const transfer = new DataTransfer();
  transfer.items.add(file);
  fileInput.files = transfer.files;
  setSelectedFile(file);
});

analyzeBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];
  if (!file) return;

  if (!API_BASE) {
    statusMessage.textContent = "公网分析 API 尚未配置。请在 Vercel 环境变量 PMA_API_BASE 中填写后端 HTTPS 地址。";
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  setLoading(true);
  startProgress();

  try {
    const response = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      body: formData,
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.detail || "分析失败，请检查视频格式或后端日志。");
    }

    finishProgress();
    renderResults(payload);
    statusMessage.textContent = "分析完成，结果已在网页中生成。";
  } catch (error) {
    stopProgress();
    statusMessage.textContent = error.message;
  } finally {
    setLoading(false);
  }
});

resultVideo.addEventListener("error", () => {
  const currentSrc = resultVideo.currentSrc || resultVideo.src;
  if (currentSrc.endsWith(".mp4")) {
    resultVideo.src = currentSrc.replace(/\.mp4$/, ".webm");
    resultVideo.load();
    statusMessage.textContent = "正在切换到浏览器兼容的视频格式...";
    return;
  }
  statusMessage.textContent = "分析视频已生成，但当前浏览器无法播放该编码。请重新分析一次，系统会生成 WebM 格式视频。";
});

function setSelectedFile(file) {
  fileName.textContent = file ? file.name : "尚未选择文件";
  analyzeBtn.disabled = !file;
  statusMessage.textContent = file ? "视频已加入上传分析区域，可以开始分析。" : "";
}

function getExtension(name) {
  const dotIndex = name.lastIndexOf(".");
  return dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : "";
}

function setLoading(isLoading) {
  analyzeBtn.disabled = isLoading || !fileInput.files[0];
  analyzeBtn.textContent = isLoading ? "分析中..." : "开始分析";
  progressWrap.hidden = !isLoading;
}

function startProgress() {
  let value = 8;
  updateProgress(value, "正在上传视频...");
  clearInterval(progressTimer);
  progressTimer = setInterval(() => {
    value = Math.min(value + Math.random() * 7, 88);
    const message =
      value < 35
        ? "正在识别姿态关键点..."
        : value < 66
          ? "正在计算关节角度..."
          : "正在生成标注视频...";
    updateProgress(value, message);
  }, 700);
}

function stopProgress() {
  clearInterval(progressTimer);
  updateProgress(0, "分析未完成");
  progressWrap.hidden = true;
}

function finishProgress() {
  clearInterval(progressTimer);
  updateProgress(100, "分析完成");
  setTimeout(() => {
    progressWrap.hidden = true;
  }, 900);
}

function updateProgress(value, text) {
  const rounded = Math.round(value);
  progressText.textContent = text;
  progressValue.textContent = `${rounded}%`;
  progressBar.style.width = `${rounded}%`;
}

function renderResults(data) {
  const videoUrl = toAbsoluteUrl(data.video_url);
  const csvUrl = toAbsoluteUrl(data.csv_url);
  const ballCsvUrl = toAbsoluteUrl(data.ball_csv_url);

  resultVideo.src = videoUrl;
  resultVideo.load();
  downloadVideo.href = videoUrl;
  downloadCsv.href = csvUrl;
  downloadBallCsv.href = ballCsvUrl;

  renderChart(data.frame_data || []);
  renderTable(frameTable, data.frame_data || [], [
    "frame",
    "right_elbow_angle",
    "left_elbow_angle",
    "right_knee_angle",
    "left_knee_angle",
    "right_hip_angle",
    "left_hip_angle",
    "right_shoulder_trunk_angle",
    "left_shoulder_trunk_angle",
  ]);
  renderTable(ballTable, data.ball_data || [], ["frame", "ball_x", "ball_y"]);

  results.hidden = false;
  results.scrollIntoView({ behavior: "smooth", block: "start" });
}

function toAbsoluteUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}

function renderChart(frameData) {
  const ctx = document.getElementById("angleChart");
  const labels = frameData.map((row) => row.frame);
  const datasets = [
    ["right_elbow_angle", "Right Elbow", "#1e6bff"],
    ["left_elbow_angle", "Left Elbow", "#00a99d"],
    ["right_knee_angle", "Right Knee", "#f59e0b"],
    ["left_knee_angle", "Left Knee", "#7c3aed"],
    ["right_hip_angle", "Right Hip", "#ef4444"],
    ["left_hip_angle", "Left Hip", "#14b8a6"],
  ].map(([key, label, color]) => ({
    label,
    data: frameData.map((row) => row[key]),
    borderColor: color,
    backgroundColor: color,
    borderWidth: 2,
    pointRadius: 0,
    tension: 0.25,
    spanGaps: true,
  }));

  if (angleChart) {
    angleChart.destroy();
  }

  angleChart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "top" },
        tooltip: {
          callbacks: {
            label: (item) => `${item.dataset.label}: ${formatValue(item.raw)}`,
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: "Frame" },
          grid: { color: "rgba(16, 32, 51, 0.06)" },
        },
        y: {
          title: { display: true, text: "Angle (degrees)" },
          grid: { color: "rgba(16, 32, 51, 0.08)" },
        },
      },
    },
  });
}

function renderTable(container, rows, columns) {
  const visibleRows = rows.slice(0, 100);
  if (!visibleRows.length) {
    container.innerHTML = "<div class='empty-table'>暂无数据</div>";
    return;
  }

  const head = columns.map((column) => `<th>${column}</th>`).join("");
  const body = visibleRows
    .map((row) => `<tr>${columns.map((column) => `<td>${formatValue(row[column])}</td>`).join("")}</tr>`)
    .join("");

  const note =
    rows.length > 100
      ? `<caption>默认显示前 100 行，共 ${rows.length} 行。完整数据可下载 CSV。</caption>`
      : "";
  container.innerHTML = `<table>${note}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function formatValue(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return typeof value === "number" ? value.toFixed(2) : value;
}
