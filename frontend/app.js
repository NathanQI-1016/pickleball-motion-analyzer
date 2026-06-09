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
let poseDetector = null;

const allowedExtensions = [".mp4", ".mov", ".avi"];
const targetFps = 12;

const L = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
};

const poseConnections = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
  [24, 26], [26, 28],
];

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

  if (!allowedExtensions.includes(getExtension(file.name))) {
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

  setLoading(true);
  updateProgress(3, "正在加载浏览器端姿态识别模型...");

  try {
    const payload = await analyzeInBrowser(file);
    updateProgress(100, "分析完成");
    renderResults(payload);
    statusMessage.textContent = "分析完成，所有处理均在浏览器中完成，视频没有上传到服务器。";
  } catch (error) {
    statusMessage.textContent = `分析失败：${error.message}`;
  } finally {
    setLoading(false);
    setTimeout(() => {
      progressWrap.hidden = true;
    }, 800);
  }
});

function setSelectedFile(file) {
  fileName.textContent = file ? file.name : "尚未选择文件";
  analyzeBtn.disabled = !file;
  statusMessage.textContent = file ? "视频已加入分析区域，可以开始分析。" : "";
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

function updateProgress(value, text) {
  const rounded = Math.max(0, Math.min(100, Math.round(value)));
  progressText.textContent = text;
  progressValue.textContent = `${rounded}%`;
  progressBar.style.width = `${rounded}%`;
}

async function loadPoseDetector() {
  if (poseDetector) return poseDetector;

  updateProgress(4, "正在检查本地模型文件...");
  await withTimeout(checkAsset("./vendor/pose/pose.js"), 20000, "姿态识别脚本加载超时");

  try {
    poseDetector = await withTimeout(loadTasksPoseDetector(), 35000, "新版模型初始化超时");
    return poseDetector;
  } catch (error) {
    console.warn("Tasks Vision failed, falling back to Legacy Pose:", error);
    updateProgress(15, "新版模型加载较慢，正在切换兼容模式...");
    poseDetector = await withTimeout(loadLegacyPoseDetector(), 45000, "兼容模式初始化超时");
    return poseDetector;
  }
}

async function loadTasksPoseDetector() {
  await withTimeout(checkAsset("./models/pose_landmarker_lite.task"), 20000, "模型文件加载超时");
  await withTimeout(checkAsset("./vendor/wasm/vision_wasm_internal.wasm"), 20000, "WASM 文件加载超时");
  updateProgress(8, "正在载入 MediaPipe 运行库...");
  const vision = await withTimeout(import("./vendor/vision_bundle.mjs"), 30000, "MediaPipe 运行库加载超时");

  updateProgress(12, "正在初始化姿态识别模型...");
  const fileset = await withTimeout(
    vision.FilesetResolver.forVisionTasks(new URL("./vendor/wasm", window.location.href).href),
    30000,
    "MediaPipe WASM 初始化超时"
  );

  const landmarker = await createPoseLandmarker(vision, fileset, "./models/pose_landmarker_lite.task");
  return {
    mode: "tasks",
    detect(video, timestampMs) {
      const result = landmarker.detectForVideo(video, timestampMs);
      return result.landmarks && result.landmarks[0] ? result.landmarks[0] : null;
    },
  };
}

async function createPoseLandmarker(vision, fileset, modelPath) {
  try {
    return await withTimeout(
      vision.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      }),
      60000,
      "姿态识别模型初始化超时"
    );
  } catch (error) {
    if (modelPath.includes("lite")) {
      updateProgress(12, "轻量模型初始化失败，正在尝试高精度模型...");
      return createPoseLandmarker(vision, fileset, "./models/pose_landmarker_full.task");
    }
    throw error;
  }
}

async function loadLegacyPoseDetector() {
  updateProgress(18, "正在载入兼容姿态识别模块...");
  await loadScript("./vendor/pose/pose.js");

  const pose = new window.Pose({
    locateFile: (file) => `./vendor/pose/${file}`,
  });

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    smoothSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  let pendingResolve = null;
  pose.onResults((result) => {
    if (pendingResolve) {
      const resolve = pendingResolve;
      pendingResolve = null;
      resolve(result.poseLandmarks || null);
    }
  });

  await detectLegacyFrame(pose, document.createElement("canvas"), () => pendingResolve, (value) => {
    pendingResolve = value;
  });

  return {
    mode: "legacy",
    detect(video) {
      return detectLegacyFrame(pose, video, () => pendingResolve, (value) => {
        pendingResolve = value;
      });
    },
  };
}

function detectLegacyFrame(pose, image, getPending, setPending) {
  return new Promise((resolve, reject) => {
    if (getPending()) {
      reject(new Error("上一帧仍在处理中"));
      return;
    }
    const timeoutId = setTimeout(() => {
      setPending(null);
      reject(new Error("兼容模式单帧检测超时"));
    }, 10000);
    setPending((result) => {
      clearTimeout(timeoutId);
      resolve(result);
    });
    pose.send({ image }).catch((error) => {
      clearTimeout(timeoutId);
      setPending(null);
      reject(error);
    });
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`脚本加载失败：${src}`));
    document.head.appendChild(script);
  });
}

async function checkAsset(url) {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`资源加载失败：${url}`);
  }
}

function withTimeout(promise, ms, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function analyzeInBrowser(file) {
  const detector = await loadPoseDetector();
  const video = document.createElement("video");
  const objectUrl = URL.createObjectURL(file);
  video.src = objectUrl;
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";

  await waitForVideoMetadata(video);

  const width = video.videoWidth;
  const height = video.videoHeight;
  const duration = video.duration;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const stream = canvas.captureStream(targetFps);
  const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" });
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  recorder.start(250);

  const frameData = [];
  const ballData = [];
  const ballTrail = [];
  const totalFrames = Math.max(1, Math.floor(duration * targetFps));

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
    const time = frameIndex / targetFps;
    await seekVideo(video, Math.min(time, Math.max(0, duration - 0.02)));

    ctx.drawImage(video, 0, 0, width, height);
    const timestampMs = Math.round(time * 1000);
    const landmarks = await detector.detect(video, timestampMs);

    const row = buildFrameRow(frameIndex + 1, landmarks, width, height);
    frameData.push(row);

    if (landmarks) {
      drawPose(ctx, landmarks, width, height);
      drawAngleOverlay(ctx, row);
    }

    const ball = detectBrightBall(ctx, width, height);
    if (ball) {
      ballTrail.push(ball);
      if (ballTrail.length > 50) ballTrail.shift();
      ballData.push({ frame: frameIndex + 1, ball_x: ball.x, ball_y: ball.y });
    }
    drawBallTrail(ctx, ballTrail);
    drawFrameNumber(ctx, frameIndex + 1);

    updateProgress(8 + (frameIndex / totalFrames) * 90, "正在浏览器中分析视频...");
    await sleep(1000 / targetFps);
  }

  recorder.stop();
  await new Promise((resolve) => {
    recorder.onstop = resolve;
  });

  URL.revokeObjectURL(objectUrl);

  const videoBlob = new Blob(chunks, { type: "video/webm" });
  const videoUrl = URL.createObjectURL(videoBlob);
  const csvBlob = new Blob([toCsv(frameData)], { type: "text/csv;charset=utf-8" });
  const ballCsvBlob = new Blob([toCsv(ballData)], { type: "text/csv;charset=utf-8" });

  return {
    video_url: videoUrl,
    csv_url: URL.createObjectURL(csvBlob),
    ball_csv_url: URL.createObjectURL(ballCsvBlob),
    frame_data: frameData,
    ball_data: ballData,
  };
}

function waitForVideoMetadata(video) {
  return new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve;
    video.onerror = () => reject(new Error("视频无法读取，请换用 mp4 格式或较短视频。"));
  });
}

function seekVideo(video, time) {
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done);
    video.currentTime = time;
  });
}

function calculateAngle(a, b, c) {
  if (!a || !b || !c) return null;
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const normBa = Math.hypot(ba.x, ba.y);
  const normBc = Math.hypot(bc.x, bc.y);
  if (!normBa || !normBc) return null;
  const cosine = Math.max(-1, Math.min(1, (ba.x * bc.x + ba.y * bc.y) / (normBa * normBc)));
  return (Math.acos(cosine) * 180) / Math.PI;
}

function point(landmarks, index, width, height) {
  const lm = landmarks[index];
  if (!lm || lm.visibility < 0.25) return null;
  return { x: lm.x * width, y: lm.y * height };
}

function buildFrameRow(frame, landmarks, width, height) {
  if (!landmarks) {
    return {
      frame,
      right_elbow_angle: null,
      left_elbow_angle: null,
      right_knee_angle: null,
      left_knee_angle: null,
      right_hip_angle: null,
      left_hip_angle: null,
      right_shoulder_trunk_angle: null,
      left_shoulder_trunk_angle: null,
    };
  }

  const p = (id) => point(landmarks, id, width, height);
  const rs = p(L.rightShoulder);
  const re = p(L.rightElbow);
  const rw = p(L.rightWrist);
  const rh = p(L.rightHip);
  const rk = p(L.rightKnee);
  const ra = p(L.rightAnkle);
  const ls = p(L.leftShoulder);
  const le = p(L.leftElbow);
  const lw = p(L.leftWrist);
  const lh = p(L.leftHip);
  const lk = p(L.leftKnee);
  const la = p(L.leftAnkle);

  return {
    frame,
    right_elbow_angle: calculateAngle(rs, re, rw),
    left_elbow_angle: calculateAngle(ls, le, lw),
    right_knee_angle: calculateAngle(rh, rk, ra),
    left_knee_angle: calculateAngle(lh, lk, la),
    right_hip_angle: calculateAngle(rs, rh, rk),
    left_hip_angle: calculateAngle(ls, lh, lk),
    right_shoulder_trunk_angle: calculateAngle(re, rs, rh),
    left_shoulder_trunk_angle: calculateAngle(le, ls, lh),
  };
}

function drawPose(ctx, landmarks, width, height) {
  ctx.save();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#22d3ee";
  ctx.fillStyle = "#a6d94a";

  for (const [a, b] of poseConnections) {
    const pa = point(landmarks, a, width, height);
    const pb = point(landmarks, b, width, height);
    if (!pa || !pb) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }

  for (const index of Object.values(L)) {
    const p = point(landmarks, index, width, height);
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawAngleOverlay(ctx, row) {
  const items = [
    ["R Elbow", row.right_elbow_angle],
    ["L Elbow", row.left_elbow_angle],
    ["R Knee", row.right_knee_angle],
    ["L Knee", row.left_knee_angle],
    ["R Hip", row.right_hip_angle],
    ["L Hip", row.left_hip_angle],
  ];

  ctx.save();
  ctx.font = "24px Arial";
  ctx.fillStyle = "rgba(5, 18, 34, 0.7)";
  ctx.fillRect(24, 24, 270, 240);
  ctx.fillStyle = "#ffffff";
  items.forEach(([label, value], index) => {
    ctx.fillText(`${label}: ${value == null ? "NA" : Math.round(value)}`, 44, 62 + index * 34);
  });
  ctx.restore();
}

function detectBrightBall(ctx, width, height) {
  const sampleScale = 4;
  const sampleWidth = Math.floor(width / sampleScale);
  const sampleHeight = Math.floor(height / sampleScale);
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = sampleWidth;
  sampleCanvas.height = sampleHeight;
  const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
  sampleCtx.drawImage(ctx.canvas, 0, 0, sampleWidth, sampleHeight);
  const image = sampleCtx.getImageData(0, 0, sampleWidth, sampleHeight).data;

  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      const i = (y * sampleWidth + x) * 4;
      const r = image[i];
      const g = image[i + 1];
      const b = image[i + 2];
      if (r > 150 && g > 140 && b < 120 && Math.abs(r - g) < 90) {
        sumX += x;
        sumY += y;
        count += 1;
      }
    }
  }

  if (count < 4 || count > 900) return null;
  return {
    x: Math.round((sumX / count) * sampleScale),
    y: Math.round((sumY / count) * sampleScale),
  };
}

function drawBallTrail(ctx, trail) {
  if (!trail.length) return;
  ctx.save();
  ctx.strokeStyle = "#facc15";
  ctx.fillStyle = "#ef4444";
  ctx.lineWidth = 4;
  ctx.beginPath();
  trail.forEach((p, index) => {
    if (index === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();
  const last = trail[trail.length - 1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFrameNumber(ctx, frame) {
  ctx.save();
  ctx.font = "24px Arial";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`Frame: ${frame}`, 44, 292);
  ctx.restore();
}

function renderResults(data) {
  resultVideo.src = data.video_url;
  resultVideo.load();
  downloadVideo.href = data.video_url;
  downloadVideo.download = "annotated_video.webm";
  downloadCsv.href = data.csv_url;
  downloadCsv.download = "frame_kinematics_bilateral.csv";
  downloadBallCsv.href = data.ball_csv_url;
  downloadBallCsv.download = "ball_tracking.csv";

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

  if (angleChart) angleChart.destroy();

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
        x: { title: { display: true, text: "Frame" } },
        y: { title: { display: true, text: "Angle (degrees)" } },
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
  const note = rows.length > 100 ? `<caption>默认显示前 100 行，共 ${rows.length} 行。完整数据可下载 CSV。</caption>` : "";
  container.innerHTML = `<table>${note}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function formatValue(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return typeof value === "number" ? value.toFixed(2) : value;
}

function toCsv(rows) {
  if (!rows.length) return "";
  const columns = Object.keys(rows[0]);
  const body = rows.map((row) => columns.map((column) => row[column] ?? "").join(","));
  return [columns.join(","), ...body].join("\n");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
