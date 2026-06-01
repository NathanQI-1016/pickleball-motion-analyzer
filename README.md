# Pickleball Motion Analyzer

皮克球动作分析系统。当前仓库包含：

- `frontend/`：官网首页、上传页面、结果视频、角度曲线和数据表格展示。
- `backend/`：FastAPI 视频分析服务，使用 OpenCV、MediaPipe Pose 和 YOLOv8。
- `package.json` / `vercel.json`：用于把前端部署到 Vercel。

## Important Deployment Note

Vercel 适合托管这个项目的前端静态网站，但不适合直接运行当前 Python 视频分析后端。

原因是视频分析后端依赖 OpenCV、MediaPipe、Ultralytics、Torch，并且需要上传和逐帧处理视频。Vercel Functions 有函数体积、上传请求体和执行时间限制；Vercel 官方文档也说明函数有最大持续时间限制和函数包体积限制。

因此推荐架构是：

```text
Vercel HTTPS Frontend
        |
        | PMA_API_BASE
        v
Public HTTPS Python API
FastAPI + OpenCV + MediaPipe + YOLO
```

前端部署到 Vercel 后，必须配置环境变量：

```text
PMA_API_BASE=https://your-public-api.example.com
```

如果暂时没有公网后端，网站仍可打开，但点击“开始分析”会提示公网分析 API 尚未配置。

## Vercel Static Frontend Build

安装 Node.js 后，在项目根目录运行：

```powershell
npm run build
```

这会生成：

```text
dist/
```

Vercel 会部署 `dist/`。

## GitHub Upload

```powershell
cd "C:\Users\琪哥\Desktop\pickle ball\pickleball-motion-analyzer"
git init
git add .
git commit -m "Deploy frontend to Vercel"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/pickleball-motion-analyzer.git
git push -u origin main
```

## Connect Vercel

1. 打开 https://vercel.com
2. 使用 GitHub 登录
3. 点击 `Add New...` -> `Project`
4. 选择 `pickleball-motion-analyzer` 仓库
5. Framework Preset 选择 `Other`
6. Build Command 使用：

```text
npm run build
```

7. Output Directory 使用：

```text
dist
```

8. Environment Variables 添加：

```text
PMA_API_BASE=https://你的公网后端域名
```

9. 点击 `Deploy`

部署成功后，Vercel 会生成类似：

```text
https://pickleball-motion-analyzer.vercel.app
```

## API Contract

前端会请求：

```text
POST {PMA_API_BASE}/api/analyze
```

后端应返回：

```json
{
  "video_url": "/outputs/job_id/annotated_video.webm",
  "frame_data": [],
  "ball_data": [],
  "csv_url": "/outputs/job_id/frame_kinematics_bilateral.csv",
  "ball_csv_url": "/outputs/job_id/ball_tracking.csv"
}
```

后端必须开启 CORS，当前 FastAPI 已开启 `CORSMiddleware`。
