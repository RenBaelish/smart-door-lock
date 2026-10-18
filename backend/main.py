"""
FastAPI backend for the Face Recognition Smart Door Lock prototype.

Endpoints
---------
POST   /api/register         Enroll a user (multipart: name, file)
POST   /api/recognize        Identify the closest face in a frame (multipart: file)
GET    /api/logs             Paginated access history
GET    /api/users            Registered users (without embeddings)
DELETE /api/users/{user_id}  Remove a user
GET    /api/stats            Dashboard summary
GET    /api/health           Liveness and database check

Run with:  uvicorn main:app --reload --port 8000
"""

import io
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

import face_recognition
import numpy as np
from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session, joinedload

from database import get_db, init_db, IS_SQLITE
from models import AccessLog, User

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #

MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.6"))
# Stricter threshold used at enrollment to block registering the same face twice.
DUPLICATE_THRESHOLD = float(os.getenv("DUPLICATE_THRESHOLD", "0.45"))
# Frames wider than this are downscaled before detection (speed vs. range).
MAX_IMAGE_WIDTH = int(os.getenv("MAX_IMAGE_WIDTH", "800"))
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(5 * 1024 * 1024)))
# "hog" runs well on CPU; "cnn" is more accurate but needs a GPU build of dlib.
DETECTION_MODEL = os.getenv("DETECTION_MODEL", "hog")
UPSAMPLE_TIMES = int(os.getenv("UPSAMPLE_TIMES", "1"))
REGISTER_JITTERS = int(os.getenv("REGISTER_JITTERS", "3"))
RECOGNIZE_JITTERS = int(os.getenv("RECOGNIZE_JITTERS", "1"))
CORS_ORIGINS_RAW = os.getenv("CORS_ORIGINS", "*")
CORS_ORIGINS = ["*"] if CORS_ORIGINS_RAW.strip() == "*" else [
    o.strip() for o in CORS_ORIGINS_RAW.split(",") if o.strip()
]

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("facelock")

FaceLocation = tuple[int, int, int, int]  # (top, right, bottom, left) as returned by dlib


# --------------------------------------------------------------------------- #
# Schemas
# --------------------------------------------------------------------------- #

class FaceBox(BaseModel):
    top: int
    right: int
    bottom: int
    left: int


class FrameSize(BaseModel):
    width: int
    height: int


class RecognizeResponse(BaseModel):
    status: Literal["success", "invalid", "no_face", "tailgating"]
    decision: Optional[Literal["ACCEPT", "DENY"]] = None
    name: Optional[str]
    reason: Optional[str] = None
    distance: Optional[float]
    faces_detected: int
    box: Optional[FaceBox] = None
    frame: FrameSize
    threshold: float
    log_id: Optional[int] = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_at: datetime


class RegisterResponse(UserOut):
    faces_detected: int


class AccessLogOut(BaseModel):
    id: int
    user_id: Optional[int]
    user_name: Optional[str]
    status: str
    reason: Optional[str] = None
    timestamp: datetime
    confidence_score: Optional[float]


class LogsResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[AccessLogOut]


class StatsResponse(BaseModel):
    total_users: int
    total_attempts: int
    success_24h: int
    failed_24h: int
    match_threshold: float
    detection_model: str
    recent_logs: list[AccessLogOut]


# --------------------------------------------------------------------------- #
# Image and face helpers
# --------------------------------------------------------------------------- #

def read_upload(file: UploadFile) -> bytes:
    data = file.file.read()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty image upload.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Image exceeds the upload size limit.")
    return data


def decode_image(data: bytes) -> np.ndarray:
    """Decode JPEG/PNG bytes into an RGB uint8 array, downscaled if needed."""
    try:
        with Image.open(io.BytesIO(data)) as raw:
            img = ImageOps.exif_transpose(raw).convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Uploaded file is not a valid image.") from exc

    if img.width > MAX_IMAGE_WIDTH:
        ratio = MAX_IMAGE_WIDTH / img.width
        img = img.resize((MAX_IMAGE_WIDTH, round(img.height * ratio)), Image.Resampling.BILINEAR)

    return np.ascontiguousarray(np.asarray(img, dtype=np.uint8))


def box_area(location: FaceLocation) -> int:
    top, right, bottom, left = location
    return max(0, bottom - top) * max(0, right - left)


def locate_largest_face(image: np.ndarray) -> tuple[Optional[FaceLocation], int]:
    """Detect all faces and keep ONLY the one with the largest bounding box.

    The largest box belongs to the person closest to the camera. Every smaller
    box (people in the background) is discarded and never encoded or matched.
    Returns (largest_location_or_None, number_of_faces_detected).
    """
    locations: list[FaceLocation] = face_recognition.face_locations(
        image, number_of_times_to_upsample=UPSAMPLE_TIMES, model=DETECTION_MODEL
    )
    if not locations:
        return None, 0

    largest = max(locations, key=box_area)
    if len(locations) > 1:
        logger.info(
            "Detected %d faces; using largest box %s (area=%d), discarding %d smaller.",
            len(locations), largest, box_area(largest), len(locations) - 1,
        )
    return largest, len(locations)


def encode_face(image: np.ndarray, location: FaceLocation, jitters: int) -> np.ndarray:
    encodings = face_recognition.face_encodings(
        image, known_face_locations=[location], num_jitters=jitters
    )
    if not encodings:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Could not extract a face embedding.")
    return encodings[0]


def find_nearest_user(db: Session, embedding: np.ndarray) -> tuple[Optional[int], Optional[str], Optional[float]]:
    """Nearest registered user by Euclidean (L2) distance."""
    if IS_SQLITE:
        users = db.execute(select(User.id, User.name, User.face_embedding)).all()
        if not users:
            return None, None, None

        target = np.asarray(embedding, dtype=np.float64)
        best_id = None
        best_name = None
        min_dist = float("inf")

        for u_id, u_name, u_emb in users:
            if u_emb is not None:
                vec = np.asarray(u_emb, dtype=np.float64)
                dist = float(np.linalg.norm(vec - target))
                if dist < min_dist:
                    min_dist = dist
                    best_id = u_id
                    best_name = u_name

        if best_id is None:
            return None, None, None
        return best_id, best_name, min_dist

    distance = User.face_embedding.l2_distance(embedding.tolist()).label("distance")
    row = db.execute(select(User.id, User.name, distance).order_by(distance).limit(1)).first()
    if row is None:
        return None, None, None
    return row.id, row.name, float(row.distance)

def confidence_from_distance(distance: Optional[float]) -> Optional[float]:
    """Map L2 distance to a 0..1 score (1 - distance, clipped). Higher is better."""
    if distance is None:
        return None
    return round(max(0.0, min(1.0, 1.0 - distance)), 4)


def serialize_log(log: AccessLog) -> AccessLogOut:
    return AccessLogOut(
        id=log.id,
        user_id=log.user_id,
        user_name=log.user.name if log.user else None,
        status=log.status,
        reason=log.reason,
        timestamp=log.timestamp,
        confidence_score=log.confidence_score,
    )


# --------------------------------------------------------------------------- #
# Application
# --------------------------------------------------------------------------- #

@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    logger.info(
        "FaceLock API ready (threshold=%.2f, model=%s, max_width=%d).",
        MATCH_THRESHOLD, DETECTION_MODEL, MAX_IMAGE_WIDTH,
    )
    yield


app = FastAPI(title="FaceLock API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health(db: Session = Depends(get_db)) -> dict:
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok", "threshold": MATCH_THRESHOLD}


@app.post("/api/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register_user(
    name: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> RegisterResponse:
    clean_name = " ".join(name.split())
    if not clean_name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Name is required.")
    if len(clean_name) > 100:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Name must be at most 100 characters.")

    image = decode_image(read_upload(file))
    location, faces = locate_largest_face(image)
    if location is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "No face detected. Face the camera directly with good lighting and try again.",
        )

    embedding = encode_face(image, location, REGISTER_JITTERS)

    existing_id, existing_name, existing_distance = find_nearest_user(db, embedding)
    if existing_distance is not None and existing_distance < DUPLICATE_THRESHOLD:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"This face is already registered as '{existing_name}' (ID {existing_id}, distance {existing_distance:.3f}).",
        )

    user = User(name=clean_name, face_embedding=embedding.tolist())
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("Registered user id=%d name=%r (faces in frame: %d).", user.id, user.name, faces)

    return RegisterResponse(id=user.id, name=user.name, created_at=user.created_at, faces_detected=faces)


@app.post("/api/recognize", response_model=RecognizeResponse)
@app.post("/recognize", response_model=RecognizeResponse)
def recognize(
    file: Optional[UploadFile] = File(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
) -> RecognizeResponse:
    target_upload = file or image
    if target_upload is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "No image file uploaded. Expected multipart field 'file' or 'image'.",
        )

    decoded_img = decode_image(read_upload(target_upload))
    frame = FrameSize(width=decoded_img.shape[1], height=decoded_img.shape[0])

    # 1. Detect all faces
    locations: list[FaceLocation] = face_recognition.face_locations(
        decoded_img, number_of_times_to_upsample=UPSAMPLE_TIMES, model=DETECTION_MODEL
    )
    faces = len(locations)
    if faces == 0:
        return RecognizeResponse(
            status="no_face",
            decision="DENY",
            name=None,
            reason="Tidak ada wajah terdeteksi di depan kamera.",
            distance=None,
            faces_detected=0,
            frame=frame,
            threshold=MATCH_THRESHOLD,
        )

    # Locate largest face
    largest = max(locations, key=box_area)
    top, right, bottom, left = largest
    box = FaceBox(top=top, right=right, bottom=bottom, left=left)

    # 2. Anti-Tailgating Protection: Tolak jika ada lebih dari 1 orang di depan kamera
    if faces > 1:
        reason_msg = f"Tailgating terdeteksi! Ditemukan {faces} orang di depan kamera (Maksimal 1 orang diizinkan)."
        logger.warning("Tailgating detected: %d faces in frame.", faces)
        log = AccessLog(
            user_id=None,
            status="failed",
            reason=reason_msg,
            confidence_score=None,
        )
        db.add(log)
        db.commit()
        db.refresh(log)

        return RecognizeResponse(
            status="tailgating",
            decision="DENY",
            name="Tailgating Detected",
            reason=reason_msg,
            distance=None,
            faces_detected=faces,
            box=box,
            frame=frame,
            threshold=MATCH_THRESHOLD,
            log_id=log.id,
        )

    # 3. Tepat 1 wajah: ekstraksi 128-D embedding
    embedding = encode_face(decoded_img, largest, RECOGNIZE_JITTERS)

    # 4. Pencarian user terdekat
    user_id, user_name, distance = find_nearest_user(db, embedding)
    matched = distance is not None and distance < MATCH_THRESHOLD

    if matched:
        status_result = "success"
        decision_result = "ACCEPT"
        reason_msg = f"Akses diberikan: Wajah terverifikasi sebagai '{user_name}'."
    else:
        status_result = "invalid"
        decision_result = "DENY"
        reason_msg = "Akses ditolak: Wajah tidak terdaftar di sistem."

    # 5. Simpan log akses beserta alasan spesifik
    log = AccessLog(
        user_id=user_id if matched else None,
        status="success" if matched else "failed",
        reason=reason_msg,
        confidence_score=confidence_from_distance(distance),
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return RecognizeResponse(
        status=status_result,
        decision=decision_result,
        name=user_name if matched else "Unknown",
        reason=reason_msg,
        distance=round(distance, 4) if distance is not None else None,
        faces_detected=1,
        box=box,
        frame=frame,
        threshold=MATCH_THRESHOLD,
        log_id=log.id,
    )


@app.get("/api/logs", response_model=LogsResponse)
def get_logs(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    status_filter: Optional[Literal["success", "failed"]] = Query(None, alias="status"),
    db: Session = Depends(get_db),
) -> LogsResponse:
    conditions = [AccessLog.status == status_filter] if status_filter else []

    total = db.scalar(select(func.count()).select_from(AccessLog).where(*conditions)) or 0
    logs = db.scalars(
        select(AccessLog)
        .options(joinedload(AccessLog.user))
        .where(*conditions)
        .order_by(AccessLog.timestamp.desc(), AccessLog.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()

    return LogsResponse(total=total, limit=limit, offset=offset, items=[serialize_log(l) for l in logs])


@app.get("/api/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)) -> list[UserOut]:
    rows = db.execute(select(User.id, User.name, User.created_at).order_by(User.created_at.desc())).all()
    return [UserOut(id=r.id, name=r.name, created_at=r.created_at) for r in rows]


@app.delete("/api/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db)) -> None:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    db.delete(user)
    db.commit()
    logger.info("Deleted user id=%d.", user_id)


@app.get("/api/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)) -> StatsResponse:
    since = datetime.now(timezone.utc) - timedelta(hours=24)

    def count_logs(*conditions) -> int:
        return db.scalar(select(func.count()).select_from(AccessLog).where(*conditions)) or 0

    recent = db.scalars(
        select(AccessLog)
        .options(joinedload(AccessLog.user))
        .order_by(AccessLog.timestamp.desc(), AccessLog.id.desc())
        .limit(10)
    ).all()

    return StatsResponse(
        total_users=db.scalar(select(func.count()).select_from(User)) or 0,
        total_attempts=count_logs(),
        success_24h=count_logs(AccessLog.status == "success", AccessLog.timestamp >= since),
        failed_24h=count_logs(AccessLog.status == "failed", AccessLog.timestamp >= since),
        match_threshold=MATCH_THRESHOLD,
        detection_model=DETECTION_MODEL,
        recent_logs=[serialize_log(l) for l in recent],
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, reload_excludes=["*.db*"])
