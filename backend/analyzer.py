import math
import os
from collections import deque
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
import pandas as pd
from ultralytics import YOLO


MODEL = YOLO("yolov8n.pt")
MP_POSE = mp.solutions.pose
MP_DRAW = mp.solutions.drawing_utils


def calculate_angle(a, b, c):
    """
    Calculate the angle formed by three points, with b as the vertex.
    Elbow: shoulder-elbow-wrist
    Knee: hip-knee-ankle
    Hip: shoulder-hip-knee
    """
    a = np.array(a, dtype=np.float32)
    b = np.array(b, dtype=np.float32)
    c = np.array(c, dtype=np.float32)

    ba = a - b
    bc = c - b

    norm_ba = np.linalg.norm(ba)
    norm_bc = np.linalg.norm(bc)

    if norm_ba == 0 or norm_bc == 0:
        return np.nan

    cosine = np.dot(ba, bc) / (norm_ba * norm_bc)
    cosine = np.clip(cosine, -1.0, 1.0)
    angle = np.degrees(np.arccos(cosine))
    return float(angle)


def landmark_to_pixel(landmarks, landmark_id, w, h):
    lm = landmarks[landmark_id.value]
    return [lm.x * w, lm.y * h]


def draw_angle_text(frame, label, value, pos, color):
    text = f"{label}: NA" if np.isnan(value) else f"{label}: {int(value)}"
    cv2.putText(frame, text, pos, cv2.FONT_HERSHEY_SIMPLEX, 0.75, color, 2)


def draw_joint_point(frame, point, color, name=""):
    x, y = int(point[0]), int(point[1])
    cv2.circle(frame, (x, y), 6, color, -1)
    if name:
        cv2.putText(
            frame,
            name,
            (x + 6, y - 6),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            color,
            1,
        )


def clean_records(records):
    cleaned = []
    for record in records:
        row = {}
        for key, value in record.items():
            if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
                row[key] = None
            elif isinstance(value, np.floating):
                row[key] = None if np.isnan(value) or np.isinf(value) else float(value)
            elif isinstance(value, np.integer):
                row[key] = int(value)
            else:
                row[key] = value
        cleaned.append(row)
    return cleaned


def analyze_video(video_path, output_dir):
    """
    Analyze an uploaded pickleball video and save browser-accessible artifacts.
    Returns paths and JSON-ready frame/ball data.
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError("Video could not be opened. Please check the file format.")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    annotated_video_path = output_path / "annotated_video.webm"
    angle_csv_path = output_path / "frame_kinematics_bilateral.csv"
    ball_csv_path = output_path / "ball_tracking.csv"

    # WebM/VP8 plays more reliably in browsers than OpenCV's MP4/FMP4 output.
    fourcc = cv2.VideoWriter_fourcc(*"VP80")
    out = cv2.VideoWriter(str(annotated_video_path), fourcc, fps, (width, height))
    if not out.isOpened():
        annotated_video_path = output_path / "annotated_video.mp4"
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        out = cv2.VideoWriter(str(annotated_video_path), fourcc, fps, (width, height))

    if not out.isOpened():
        cap.release()
        raise ValueError("Could not create output video writer.")

    frame_data = []
    ball_data = []
    ball_trail = deque(maxlen=50)
    last_ball = None
    max_ball_jump = 80
    frame_id = 0

    with MP_POSE.Pose(
        static_image_mode=False,
        model_complexity=1,
        smooth_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as pose:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame_id += 1
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(rgb)

            right_elbow_angle = np.nan
            left_elbow_angle = np.nan
            right_knee_angle = np.nan
            left_knee_angle = np.nan
            right_hip_angle = np.nan
            left_hip_angle = np.nan
            right_shoulder_trunk_angle = np.nan
            left_shoulder_trunk_angle = np.nan

            if results.pose_landmarks:
                landmarks = results.pose_landmarks.landmark
                P = MP_POSE.PoseLandmark

                r_shoulder = landmark_to_pixel(landmarks, P.RIGHT_SHOULDER, width, height)
                r_elbow = landmark_to_pixel(landmarks, P.RIGHT_ELBOW, width, height)
                r_wrist = landmark_to_pixel(landmarks, P.RIGHT_WRIST, width, height)
                r_hip = landmark_to_pixel(landmarks, P.RIGHT_HIP, width, height)
                r_knee = landmark_to_pixel(landmarks, P.RIGHT_KNEE, width, height)
                r_ankle = landmark_to_pixel(landmarks, P.RIGHT_ANKLE, width, height)

                l_shoulder = landmark_to_pixel(landmarks, P.LEFT_SHOULDER, width, height)
                l_elbow = landmark_to_pixel(landmarks, P.LEFT_ELBOW, width, height)
                l_wrist = landmark_to_pixel(landmarks, P.LEFT_WRIST, width, height)
                l_hip = landmark_to_pixel(landmarks, P.LEFT_HIP, width, height)
                l_knee = landmark_to_pixel(landmarks, P.LEFT_KNEE, width, height)
                l_ankle = landmark_to_pixel(landmarks, P.LEFT_ANKLE, width, height)

                right_elbow_angle = calculate_angle(r_shoulder, r_elbow, r_wrist)
                left_elbow_angle = calculate_angle(l_shoulder, l_elbow, l_wrist)
                right_knee_angle = calculate_angle(r_hip, r_knee, r_ankle)
                left_knee_angle = calculate_angle(l_hip, l_knee, l_ankle)
                right_hip_angle = calculate_angle(r_shoulder, r_hip, r_knee)
                left_hip_angle = calculate_angle(l_shoulder, l_hip, l_knee)
                right_shoulder_trunk_angle = calculate_angle(r_elbow, r_shoulder, r_hip)
                left_shoulder_trunk_angle = calculate_angle(l_elbow, l_shoulder, l_hip)

                MP_DRAW.draw_landmarks(frame, results.pose_landmarks, MP_POSE.POSE_CONNECTIONS)

                draw_joint_point(frame, r_elbow, (0, 255, 0), "R-Elbow")
                draw_joint_point(frame, l_elbow, (0, 180, 0), "L-Elbow")
                draw_joint_point(frame, r_knee, (0, 255, 255), "R-Knee")
                draw_joint_point(frame, l_knee, (0, 180, 180), "L-Knee")
                draw_joint_point(frame, r_hip, (255, 0, 255), "R-Hip")
                draw_joint_point(frame, l_hip, (180, 0, 180), "L-Hip")

                draw_angle_text(frame, "R Elbow", right_elbow_angle, (40, 45), (0, 255, 0))
                draw_angle_text(frame, "L Elbow", left_elbow_angle, (40, 80), (0, 180, 0))
                draw_angle_text(frame, "R Knee", right_knee_angle, (40, 125), (0, 255, 255))
                draw_angle_text(frame, "L Knee", left_knee_angle, (40, 160), (0, 180, 180))
                draw_angle_text(frame, "R Hip", right_hip_angle, (40, 205), (255, 0, 255))
                draw_angle_text(frame, "L Hip", left_hip_angle, (40, 240), (180, 0, 180))
                draw_angle_text(
                    frame,
                    "R Shoulder-Trunk",
                    right_shoulder_trunk_angle,
                    (40, 285),
                    (255, 120, 0),
                )
                draw_angle_text(
                    frame,
                    "L Shoulder-Trunk",
                    left_shoulder_trunk_angle,
                    (40, 320),
                    (255, 180, 0),
                )

            frame_data.append(
                {
                    "frame": frame_id,
                    "right_elbow_angle": right_elbow_angle,
                    "left_elbow_angle": left_elbow_angle,
                    "right_knee_angle": right_knee_angle,
                    "left_knee_angle": left_knee_angle,
                    "right_hip_angle": right_hip_angle,
                    "left_hip_angle": left_hip_angle,
                    "right_shoulder_trunk_angle": right_shoulder_trunk_angle,
                    "left_shoulder_trunk_angle": left_shoulder_trunk_angle,
                }
            )

            yolo_results = MODEL(frame, verbose=False)
            current_ball = None

            for result in yolo_results:
                boxes = result.boxes
                if boxes is None:
                    continue

                for box in boxes:
                    cls = int(box.cls[0])
                    conf = float(box.conf[0])
                    if cls == 32 and conf > 0.25:
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        cx = int((x1 + x2) / 2)
                        cy = int((y1 + y2) / 2)
                        current_ball = (cx, cy)
                        break
                if current_ball is not None:
                    break

            if current_ball is not None:
                if last_ball is not None:
                    jump = math.dist(current_ball, last_ball)
                    if jump > max_ball_jump:
                        current_ball = None

                if current_ball is not None:
                    last_ball = current_ball
                    ball_trail.append(current_ball)
                    ball_data.append(
                        {
                            "frame": frame_id,
                            "ball_x": current_ball[0],
                            "ball_y": current_ball[1],
                        }
                    )

            for i in range(1, len(ball_trail)):
                cv2.line(frame, ball_trail[i - 1], ball_trail[i], (0, 255, 255), 2)

            if current_ball is not None:
                cv2.circle(frame, current_ball, 8, (0, 0, 255), -1)
                cv2.putText(
                    frame,
                    "Ball",
                    (current_ball[0] + 8, current_ball[1] - 8),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (0, 0, 255),
                    2,
                )

            cv2.putText(
                frame,
                f"Frame: {frame_id}",
                (40, 365),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (255, 255, 255),
                2,
            )

            out.write(frame)

    cap.release()
    out.release()

    cleaned_frame_data = clean_records(frame_data)
    cleaned_ball_data = clean_records(ball_data)

    pd.DataFrame(cleaned_frame_data).to_csv(
        angle_csv_path,
        index=False,
        encoding="utf-8-sig",
    )
    pd.DataFrame(cleaned_ball_data).to_csv(
        ball_csv_path,
        index=False,
        encoding="utf-8-sig",
    )

    return {
        "video_path": os.fspath(annotated_video_path),
        "csv_path": os.fspath(angle_csv_path),
        "ball_csv_path": os.fspath(ball_csv_path),
        "frame_data": cleaned_frame_data,
        "ball_data": cleaned_ball_data,
    }
