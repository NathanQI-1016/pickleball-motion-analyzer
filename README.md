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

## Deploy Backend To Render

当前 Python 后端已补充 Docker 部署配置：

- `backend/Dockerfile`
- `.dockerignore`
- `render.yaml`

Render 部署步骤：

1. 把本项目推送到 GitHub。
2. 打开 https://render.com
3. 使用 GitHub 登录。
4. 点击 `New +` -> `Blueprint`，选择本仓库。
5. Render 会读取 `render.yaml` 并创建服务：

```text
pickleball-motion-analyzer-api
```

6. 部署成功后，Render 会给出公网地址，例如：

```text
https://pickleball-motion-analyzer-api.onrender.com
```

7. 在 Vercel 项目设置里添加环境变量：

```text
PMA_API_BASE=https://pickleball-motion-analyzer-api.onrender.com
```

8. 重新部署 Vercel 前端。

注意：免费/低配云服务处理视频会比较慢，首次请求还可能因为下载 YOLO 权重而更慢。正式稳定使用建议使用付费实例或云服务器。

## Free Backend Option: Hugging Face Spaces

如果不想绑定信用卡，可以用 Hugging Face Spaces 免费部署后端。

本仓库已包含 Hugging Face Spaces Docker 配置，位于：

- `hf-space/`

先运行：

```powershell
npm run prepare:hf
```

这会把后端需要的 `main.py`、`analyzer.py`、`requirements.txt` 复制到 `hf-space/`。

部署步骤：

1. 打开 https://huggingface.co
2. 注册或登录账号。
3. 点击头像 -> `New Space`
4. Space name 填：

```text
pickleball-motion-analyzer-api
```

5. SDK 选择：

```text
Docker
```

6. Visibility 可先选 `Public`
7. 创建后，把 `hf-space/` 文件夹中的内容推送到 Hugging Face Space 仓库，或在 Space 的 Files 页面上传这些文件。
8. 构建完成后，后端地址类似：

```text
https://YOUR_USERNAME-pickleball-motion-analyzer-api.hf.space
```

9. 在 Vercel 项目里设置：

```text
PMA_API_BASE=https://YOUR_USERNAME-pickleball-motion-analyzer-api.hf.space
```

10. 重新部署 Vercel。

免费 Space 会休眠，第一次请求会比较慢。建议测试视频控制在较短时长。

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
