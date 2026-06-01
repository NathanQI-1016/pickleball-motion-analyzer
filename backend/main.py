import shutil
import uuid
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"
FRONTEND_DIR = PROJECT_DIR / "frontend"
ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi"}

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Pickleball Motion Analyzer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")


@app.get("/")
def index():
    index_file = FRONTEND_DIR / "index.html"
    if not index_file.exists():
        return {"message": "Pickleball Motion Analyzer API is running."}
    return FileResponse(index_file)


@app.get("/style.css")
def style_css():
    return FileResponse(FRONTEND_DIR / "style.css")


@app.get("/app.js")
def app_js():
    return FileResponse(FRONTEND_DIR / "app.js")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/analyze")
@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...)):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only mp4, mov, and avi files are supported.")

    job_id = uuid.uuid4().hex
    upload_path = UPLOAD_DIR / f"{job_id}{suffix}"
    job_output_dir = OUTPUT_DIR / job_id
    job_output_dir.mkdir(parents=True, exist_ok=True)

    try:
        with upload_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        from analyzer import analyze_video

        result = analyze_video(upload_path, job_output_dir)
    except ModuleNotFoundError as exc:
        missing_module = exc.name or str(exc)
        raise HTTPException(
            status_code=500,
            detail=(
                f"后端缺少视频分析依赖：{missing_module}。"
                "请先运行项目根目录下的 rebuild_env_py311.bat，"
                "再运行 start_server.bat 重新启动后端。"
            ),
        ) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Video analysis failed: {exc}") from exc
    finally:
        file.file.close()

    return {
        "video_url": f"/outputs/{job_id}/{Path(result['video_path']).name}",
        "frame_data": result["frame_data"],
        "ball_data": result["ball_data"],
        "csv_url": f"/outputs/{job_id}/frame_kinematics_bilateral.csv",
        "ball_csv_url": f"/outputs/{job_id}/ball_tracking.csv",
    }
