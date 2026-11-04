"""
FastAPI backend for Smart Classroom Face Recognition & Access Control System.
"""

import io
import logging
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

import face_recognition
import numpy as np
from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session, joinedload

from database import CAPTURES_DIR, get_db, init_db, IS_SQLITE
from models import AccessLog, ClassSchedule, User

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #

MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.6"))
DUPLICATE_THRESHOLD = float(os.getenv("DUPLICATE_THRESHOLD", "0.45"))
MAX_IMAGE_WIDTH = int(os.getenv("MAX_IMAGE_WIDTH", "800"))
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(5 * 1024 * 1024)))
DETECTION_MODEL = os.getenv("DETECTION_MODEL", "hog")
UPSAMPLE_TIMES = int(os.getenv("UPSAMPLE_TIMES", "0"))  # Default 0 untuk performa optimal di Raspberry Pi & Laptop
REGISTER_JITTERS = int(os.getenv("REGISTER_JITTERS", "3"))
RECOGNIZE_JITTERS = int(os.getenv("RECOGNIZE_JITTERS", "1"))
CORS_ORIGINS_RAW = os.getenv("CORS_ORIGINS", "*")
CORS_ORIGINS = ["*"] if CORS_ORIGINS_RAW.strip() == "*" else [
    o.strip() for o in CORS_ORIGINS_RAW.split(",") if o.strip()
]

# WIB Timezone (UTC+7)
WIB = timezone(timedelta(hours=7))

INDONESIAN_DAYS = {
    0: "Senin",
    1: "Selasa",
    2: "Rabu",
    3: "Kamis",
    4: "Jumat",
    5: "Sabtu",
    6: "Minggu",
}

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
    status: Literal["success", "invalid", "no_face", "tailgating", "out_of_schedule"]
    decision: Optional[Literal["ACCEPT", "DENY"]] = None
    name: Optional[str] = None
    role: Optional[str] = None
    nim: Optional[str] = None
    kelas: Optional[str] = None
    room: Optional[str] = None
    subject: Optional[str] = None
    lecturer: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    schedule_time: Optional[str] = None
    day: Optional[str] = None
    wib_time: Optional[str] = None
    lcd_line1: Optional[str] = None
    lcd_line2: Optional[str] = None
    serial_log: Optional[str] = None
    reason: Optional[str] = None
    distance: Optional[float] = None
    faces_detected: int
    box: Optional[FaceBox] = None
    all_boxes: Optional[list[FaceBox]] = None
    frame: FrameSize
    threshold: float
    log_id: Optional[int] = None
    image_url: Optional[str] = None


# Mapping IP Statis Perangkat Pintu (Virtual-AP3: Door-Net 192.168.30.0/24) ke Kode Ruangan
DOOR_DEVICE_MAP: dict[str, str] = {
    "192.168.30.2": "GSG210",
    "192.168.30.3": "GSG211",
}


class DoorDeviceMapUpdate(BaseModel):
    ip_address: str
    room: Literal["GSG210", "GSG211"]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    role: str = "mahasiswa"
    nim: Optional[str] = None
    kelas: Optional[str] = None
    prodi: Optional[str] = None
    jurusan: Optional[str] = None
    has_face: bool = False
    image_url: Optional[str] = None
    created_at: datetime


class UserCreate(BaseModel):
    name: str
    role: str = "mahasiswa"
    nim: Optional[str] = None
    kelas: Optional[str] = None
    prodi: Optional[str] = None
    jurusan: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    nim: Optional[str] = None
    kelas: Optional[str] = None
    prodi: Optional[str] = None
    jurusan: Optional[str] = None
    reset_face: Optional[bool] = None


class RegisterResponse(UserOut):
    faces_detected: int


class AccessLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    user_role: Optional[str] = None
    user_nim: Optional[str] = None
    user_kelas: Optional[str] = None
    room: Optional[str] = None
    status: str
    reason: Optional[str] = None
    timestamp: datetime
    confidence_score: Optional[float] = None
    has_image: bool = False
    image_url: Optional[str] = None



class LogsResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[AccessLogOut]


class StatsResponse(BaseModel):
    total_users: int
    total_with_face: int = 0
    total_mahasiswa: int = 0
    total_mahasiswa_with_face: int = 0
    total_dosen: int = 0
    total_dosen_with_face: int = 0
    total_admin: int = 0
    total_attempts: int
    success_24h: int
    failed_24h: int
    match_threshold: float
    detection_model: str
    recent_logs: list[AccessLogOut]


class ClassScheduleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kelas: str
    day: str
    slot: Optional[str] = None
    start_time: str
    end_time: str
    subject: str
    lecturer: str
    room: str
    sks: int


class ClassScheduleIn(BaseModel):
    kelas: str = "TMJ 5C"
    day: str
    slot: Optional[str] = None
    start_time: str
    end_time: str
    subject: str
    lecturer: str
    room: str
    sks: int = 3


# --------------------------------------------------------------------------- #
# Image and Face Helpers
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


def save_captured_image(data: bytes) -> str:
    """Save raw image bytes into captures/ folder and return filename."""
    timestamp_str = datetime.now(WIB).strftime("%Y%m%d_%H%M%S")
    rand_suffix = uuid.uuid4().hex[:8]
    filename = f"capture_{timestamp_str}_{rand_suffix}.jpg"
    filepath = os.path.join(CAPTURES_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(data)
    return filename


def box_area(location: FaceLocation) -> int:
    top, right, bottom, left = location
    return max(0, bottom - top) * max(0, right - left)


def locate_largest_face(image: np.ndarray) -> tuple[Optional[FaceLocation], int]:
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


def find_nearest_user(db: Session, embedding: np.ndarray) -> tuple[Optional[User], Optional[float]]:
    """Find the nearest registered user by Euclidean (L2) distance."""
    if IS_SQLITE:
        users = db.scalars(select(User)).all()
        if not users:
            return None, None

        target = np.asarray(embedding, dtype=np.float64)
        best_user = None
        min_dist = float("inf")

        for u in users:
            if u.face_embedding is not None:
                vec = np.asarray(u.face_embedding, dtype=np.float64)
                dist = float(np.linalg.norm(vec - target))
                if dist < min_dist:
                    min_dist = dist
                    best_user = u

        if best_user is None:
            return None, None
        return best_user, min_dist

    # PostgreSQL with pgvector
    distance = User.face_embedding.l2_distance(embedding.tolist()).label("distance")
    row = db.execute(
        select(User, distance).where(User.face_embedding.isnot(None)).order_by(distance).limit(1)
    ).first()
    if row is None:
        return None, None
    return row[0], float(row[1])


def confidence_from_distance(distance: Optional[float]) -> Optional[float]:
    """Map L2 distance to a 0..1 score (1 - distance, clipped). Higher is better."""
    if distance is None:
        return None
    return round(max(0.0, min(1.0, 1.0 - distance)), 4)


def get_current_wib_datetime() -> datetime:
    return datetime.now(WIB)


def check_class_schedule(
    db: Session,
    user_kelas: Optional[str],
    room: Optional[str] = None,
    target_dt: Optional[datetime] = None,
) -> tuple[bool, Optional[ClassSchedule], Optional[str]]:
    """Verify if the class has an active lecture slot in the schedule right now.
    Returns: (is_allowed, active_schedule_or_none, rejection_reason_or_none)
    """
    if not user_kelas:
        return False, None, "Data kelas mahasiswa tidak terdefinisi."

    dt = target_dt or get_current_wib_datetime()
    day_name = INDONESIAN_DAYS.get(dt.weekday(), "")
    current_time_str = dt.strftime("%H:%M")

    schedules = db.scalars(
        select(ClassSchedule).where(
            ClassSchedule.kelas == user_kelas,
            ClassSchedule.day == day_name,
        )
    ).all()

    active_slot = None
    for s in schedules:
        if s.start_time <= current_time_str <= s.end_time:
            active_slot = s
            break

    if not active_slot:
        return False, None, f"Tidak ada jadwal kuliah kelas {user_kelas} saat ini ({day_name}, {current_time_str} WIB)."

    # Jika pintu mengirimkan kode ruangan (misal: GSG210 atau GSG211)
    if room and active_slot.room.strip().upper() != room.strip().upper():
        return False, active_slot, f"Jadwal kuliah Anda ({active_slot.subject}) saat ini berada di ruang {active_slot.room}, bukan di ruang {room}."

    return True, active_slot, None


def find_active_room_or_lecturer_schedule(
    db: Session,
    room: Optional[str] = None,
    lecturer_name: Optional[str] = None,
    target_dt: Optional[datetime] = None,
) -> Optional[ClassSchedule]:
    """Cari jadwal aktif saat ini di ruangan tertentu atau yang diampu oleh dosen tertentu."""
    dt = target_dt or get_current_wib_datetime()
    day_name = INDONESIAN_DAYS.get(dt.weekday(), "")
    current_time_str = dt.strftime("%H:%M")

    schedules = db.scalars(
        select(ClassSchedule).where(ClassSchedule.day == day_name)
    ).all()

    # 1. Prioritaskan jadwal yang sedang aktif pada jam saat ini di ruangan tersebut
    if room:
        for s in schedules:
            if s.room.strip().upper() == room.strip().upper() and (s.start_time <= current_time_str <= s.end_time):
                return s

    # 2. Cek apakah nama dosen cocok pada jadwal hari ini
    if lecturer_name:
        clean_lec = lecturer_name.lower()
        for s in schedules:
            if s.lecturer and (clean_lec in s.lecturer.lower() or s.lecturer.lower() in clean_lec):
                if not room or s.room.strip().upper() == room.strip().upper():
                    return s

    # 3. Fallback ke jadwal terdekat hari ini di ruangan tersebut
    if room:
        for s in schedules:
            if s.room.strip().upper() == room.strip().upper():
                return s

    return None



def serialize_log(log: AccessLog) -> AccessLogOut:
    user_name = log.user_name or (log.user.name if log.user else None)
    user_role = log.user_role or (log.user.role if log.user else "mahasiswa")
    user_nim = log.user_nim or (log.user.nim if log.user else None)
    user_kelas = log.user_kelas or (log.user.kelas if log.user else None)

    return AccessLogOut(
        id=log.id,
        user_id=log.user_id,
        user_name=user_name,
        user_role=user_role,
        user_nim=user_nim,
        user_kelas=user_kelas,
        room=log.room,
        status=log.status,
        reason=log.reason,
        timestamp=log.timestamp,
        confidence_score=log.confidence_score,
        has_image=bool(log.image_path),
        image_url=f"/api/logs/{log.id}/image" if log.image_path else None,
    )


# --------------------------------------------------------------------------- #
# Application
# --------------------------------------------------------------------------- #

@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    logger.info(
        "FaceLock Smart Classroom API ready (threshold=%.2f, model=%s, max_width=%d).",
        MATCH_THRESHOLD, DETECTION_MODEL, MAX_IMAGE_WIDTH,
    )
    yield


app = FastAPI(title="Smart Classroom Access Control API", version="2.0.0", lifespan=lifespan)

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
    wib_now = get_current_wib_datetime()
    return {
        "status": "ok",
        "database": "ok",
        "threshold": MATCH_THRESHOLD,
        "wib_time": wib_now.strftime("%Y-%m-%d %H:%M:%S WIB"),
        "wib_day": INDONESIAN_DAYS.get(wib_now.weekday(), ""),
    }


# --------------------------------------------------------------------------- #
# User Registration
# --------------------------------------------------------------------------- #

@app.post("/api/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register_user(
    name: Optional[str] = Form(None),
    role: str = Form("mahasiswa"),
    nim: Optional[str] = Form(None),
    kelas: Optional[str] = Form(None),
    prodi: Optional[str] = Form(None),
    jurusan: Optional[str] = Form(None),
    user_id: Optional[int] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> RegisterResponse:
    clean_name = " ".join(name.split()) if name else ""
    clean_role = role.strip().lower() if role else "mahasiswa"
    if clean_role not in ["mahasiswa", "dosen", "admin"]:
        clean_role = "mahasiswa"
    clean_nim = " ".join(nim.split()) if nim and nim.strip() else None
    clean_kelas = " ".join(kelas.split()) if kelas and kelas.strip() else None
    clean_prodi = " ".join(prodi.split()) if prodi and prodi.strip() else None
    clean_jurusan = " ".join(jurusan.split()) if jurusan and jurusan.strip() else None

    # Check if existing target user is specified
    target_user: Optional[User] = None
    if user_id:
        target_user = db.get(User, user_id)
        if target_user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Pengguna ID #{user_id} tidak ditemukan.")
        clean_name = clean_name or target_user.name
    elif clean_nim:
        target_user = db.scalar(select(User).where(User.nim == clean_nim, User.face_embedding.is_(None)))
        if target_user:
            clean_name = clean_name or target_user.name

    if not clean_name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nama lengkap pengguna wajib diisi.")
    if len(clean_name) > 100:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nama maksimal 100 karakter.")

    raw_bytes = read_upload(file)
    image = decode_image(raw_bytes)
    location, faces = locate_largest_face(image)
    if location is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Wajah tidak terdeteksi. Posisikan wajah tegak di depan kamera dengan pencahayaan cukup dan ulangi.",
        )

    embedding = encode_face(image, location, REGISTER_JITTERS)

    existing_user, existing_distance = find_nearest_user(db, embedding)
    if existing_distance is not None and existing_distance < DUPLICATE_THRESHOLD:
        if not (target_user and target_user.id == existing_user.id):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Wajah ini telah terdaftar atas nama '{existing_user.name}' (ID {existing_user.id}, distance {existing_distance:.3f}).",
            )

    saved_filename = save_captured_image(raw_bytes)

    if target_user is not None:
        target_user.face_embedding = embedding.tolist()
        target_user.image_path = saved_filename
        if clean_name:
            target_user.name = clean_name
        if clean_role:
            target_user.role = clean_role
        if clean_nim:
            target_user.nim = clean_nim
        if clean_kelas:
            target_user.kelas = clean_kelas
        if clean_prodi:
            target_user.prodi = clean_prodi
        if clean_jurusan:
            target_user.jurusan = clean_jurusan
        user = target_user
    else:
        user = User(
            name=clean_name,
            role=clean_role,
            nim=clean_nim,
            kelas=clean_kelas,
            prodi=clean_prodi,
            jurusan=clean_jurusan,
            face_embedding=embedding.tolist(),
            image_path=saved_filename,
        )
        db.add(user)

    db.commit()
    db.refresh(user)
    logger.info("Registered face for user id=%d name=%r role=%r nim=%r kelas=%r.", user.id, user.name, user.role, user.nim, user.kelas)

    return RegisterResponse(
        id=user.id,
        name=user.name,
        role=user.role,
        nim=user.nim,
        kelas=user.kelas,
        prodi=user.prodi,
        jurusan=user.jurusan,
        has_face=True,
        image_url=f"/api/users/{user.id}/image",
        created_at=user.created_at,
        faces_detected=faces,
    )


# --------------------------------------------------------------------------- #
# Face Recognition & Smart Classroom Access Control
# --------------------------------------------------------------------------- #

@app.get("/api/doors")
def get_door_device_map() -> dict:
    """Return mapping of ESP32-CAM static IP addresses (Door-Net) to room codes (GSG210, GSG211)."""
    return {
        "doors": [
            {"ip_address": ip, "room": room, "subnet": "192.168.30.0/24 (Virtual-AP3: Door-Net)"}
            for ip, room in DOOR_DEVICE_MAP.items()
        ],
        "map": DOOR_DEVICE_MAP,
    }


@app.put("/api/doors")
def update_door_device_map(payload: DoorDeviceMapUpdate) -> dict:
    """Allow web admin to dynamically bind an ESP32-CAM IP address to GSG210 or GSG211."""
    clean_ip = payload.ip_address.strip()
    clean_room = payload.room.strip().upper()
    if clean_room not in ["GSG210", "GSG211"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ruangan hanya mendukung GSG210 atau GSG211.")
    DOOR_DEVICE_MAP[clean_ip] = clean_room
    return {"status": "updated", "ip_address": clean_ip, "room": clean_room, "map": DOOR_DEVICE_MAP}


@app.post("/api/recognize", response_model=RecognizeResponse)
@app.post("/recognize", response_model=RecognizeResponse)
def recognize(
    request: Request,
    file: Optional[UploadFile] = File(None),
    image: Optional[UploadFile] = File(None),
    room: Optional[str] = Query(None, description="Kode Ruangan Door Lock: GSG210 atau GSG211"),
    bypass_schedule: bool = Query(False, description="Bypass schedule verification for lab testing"),
    is_simulation: bool = Query(False, description="Mode simulasi: evaluasi wajah tanpa menyimpan ke audit log"),
    db: Session = Depends(get_db),
) -> RecognizeResponse:
    target_upload = file or image
    if target_upload is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "No image file uploaded. Expected multipart field 'file' or 'image'.",
        )

    # Resolusi Ruangan (Statis dari Query Parameter ESP32-CAM ATAU Dinamis dari IP Pengirim Door-Net)
    client_ip = request.client.host if request.client else None
    resolved_room = (room.strip().upper() if room and room.strip() else None) or (
        DOOR_DEVICE_MAP.get(client_ip) if client_ip else None
    ) or "GSG210"
    if resolved_room not in ["GSG210", "GSG211"]:
        resolved_room = "GSG210"

    wib_dt = get_current_wib_datetime()
    wib_day = INDONESIAN_DAYS.get(wib_dt.weekday(), "")
    wib_clock = wib_dt.strftime("%H:%M:%S")

    raw_bytes = read_upload(target_upload)
    
    # Simpan gambar jika bukan mode simulasi
    saved_filename = save_captured_image(raw_bytes) if not is_simulation else None

    decoded_img = decode_image(raw_bytes)
    frame = FrameSize(width=decoded_img.shape[1], height=decoded_img.shape[0])

    # Deteksi semua wajah di depan kamera
    locations: list[FaceLocation] = face_recognition.face_locations(
        decoded_img, number_of_times_to_upsample=UPSAMPLE_TIMES, model=DETECTION_MODEL
    )
    faces = len(locations)
    all_boxes = [FaceBox(top=t, right=r, bottom=b, left=l) for (t, r, b, l) in locations]

    # KASUS A: Muka tidak terdeteksi (0 orang)
    if faces == 0:
        reason_msg = "Wajah tidak terdeteksi. Silakan berdiri tepat di depan kamera dan ulangi."
        lcd_l1 = f"[{resolved_room}] NO FACE"[:16]
        lcd_l2 = "COBA LAGI..."[:16]
        serial_msg = f"[{wib_clock} WIB] [{resolved_room}] DENY (NO_FACE) | Wajah tidak terdeteksi di kamera."
        log_id = None
        if not is_simulation:
            log = AccessLog(
                user_id=None,
                room=resolved_room,
                status="no_face",
                reason=reason_msg,
                image_path=saved_filename,
                confidence_score=None,
            )
            db.add(log)
            db.commit()
            db.refresh(log)
            log_id = log.id

        return RecognizeResponse(
            status="no_face",
            decision="DENY",
            name=None,
            room=resolved_room,
            day=wib_day,
            wib_time=wib_clock,
            lcd_line1=lcd_l1,
            lcd_line2=lcd_l2,
            serial_log=serial_msg,
            reason=reason_msg,
            distance=None,
            faces_detected=0,
            all_boxes=[],
            frame=frame,
            threshold=MATCH_THRESHOLD,
            log_id=log_id,
            image_url=f"/api/logs/{log_id}/image" if log_id else None,
        )

    # Cari bounding box wajah terbesar
    largest = max(locations, key=box_area)
    top, right, bottom, left = largest
    box = FaceBox(top=top, right=right, bottom=bottom, left=left)

    # KASUS B: Terdeteksi > 1 orang (Multi-Person Protection)
    if faces > 1:
        reason_msg = f"Akses ditolak: Terdeteksi {faces} orang di depan kamera (Deteksi Multi-Orang / Harap antre satu per satu)."
        lcd_l1 = "DITOLAK: >1 ORG"[:16]
        lcd_l2 = f"TERDETEKSI {faces} ORG"[:16]
        serial_msg = f"[{wib_clock} WIB] [{resolved_room}] DENY (TAILGATING) | Terdeteksi {faces} wajah sekaligus."
        logger.warning("Multi-person detected: %d faces in frame.", faces)
        log_id = None
        if not is_simulation:
            log = AccessLog(
                user_id=None,
                room=resolved_room,
                status="tailgating",
                reason=reason_msg,
                image_path=saved_filename,
                confidence_score=None,
            )
            db.add(log)
            db.commit()
            db.refresh(log)
            log_id = log.id

        return RecognizeResponse(
            status="tailgating",
            decision="DENY",
            name="Deteksi Multi-Orang (>1 Orang)",
            room=resolved_room,
            day=wib_day,
            wib_time=wib_clock,
            lcd_line1=lcd_l1,
            lcd_line2=lcd_l2,
            serial_log=serial_msg,
            reason=reason_msg,
            distance=None,
            faces_detected=faces,
            box=box,
            all_boxes=all_boxes,
            frame=frame,
            threshold=MATCH_THRESHOLD,
            log_id=log_id,
            image_url=f"/api/logs/{log_id}/image" if log_id else None,
        )

    # KASUS C & D: Tepat 1 wajah terdeteksi -> Ekstraksi embedding
    embedding = encode_face(decoded_img, largest, RECOGNIZE_JITTERS)
    user, distance = find_nearest_user(db, embedding)
    matched = distance is not None and distance < MATCH_THRESHOLD

    # KASUS C: Muka terdeteksi tetapi BELUM terdaftar
    if not matched or user is None:
        reason_msg = "Akses ditolak: Wajah terdeteksi namun belum terdaftar di sistem Smart Classroom."
        lcd_l1 = "AKSES DITOLAK!"[:16]
        lcd_l2 = "WAJAH TDK DIKENAL"[:16]
        serial_msg = (
            f"[{wib_clock} WIB] [{resolved_room}] DENY (UNREGISTERED) | "
            f"Wajah tidak dikenal (L2={distance:.4f} >= {MATCH_THRESHOLD})"
            if distance is not None
            else f"[{wib_clock} WIB] [{resolved_room}] DENY (UNREGISTERED) | Database wajah kosong."
        )
        log_id = None
        if not is_simulation:
            log = AccessLog(
                user_id=None,
                room=resolved_room,
                user_name="Tidak Terdaftar",
                user_role="unknown",
                status="unregistered",
                reason=reason_msg,
                image_path=saved_filename,
                confidence_score=confidence_from_distance(distance),
            )
            db.add(log)
            db.commit()
            db.refresh(log)
            log_id = log.id

        return RecognizeResponse(
            status="invalid",
            decision="DENY",
            name="Tidak Terdaftar",
            room=resolved_room,
            day=wib_day,
            wib_time=wib_clock,
            lcd_line1=lcd_l1,
            lcd_line2=lcd_l2,
            serial_log=serial_msg,
            reason=reason_msg,
            distance=round(distance, 4) if distance is not None else None,
            faces_detected=1,
            box=box,
            all_boxes=all_boxes,
            frame=frame,
            threshold=MATCH_THRESHOLD,
            log_id=log_id,
            image_url=f"/api/logs/{log_id}/image" if log_id else None,
        )

    # KASUS D: Wajah terdaftar -> Pengecekan Privilege Berdasarkan Role
    user_role = (user.role or "mahasiswa").lower()
    active_sched: Optional[ClassSchedule] = None

    if user_role in ["dosen", "guru", "admin"]:
        status_result = "success"
        decision_result = "ACCEPT"
        active_sched = find_active_room_or_lecturer_schedule(
            db, room=resolved_room, lecturer_name=user.name, target_dt=wib_dt
        )
        role_title = "Admin Dashboard" if user_role == "admin" else "Dosen Pengampu"
        if active_sched:
            reason_msg = (
                f"Akses diberikan ({role_title}): {user.name} | "
                f"Kelas {active_sched.kelas} - {active_sched.subject} ({active_sched.start_time}-{active_sched.end_time} WIB di {resolved_room})."
            )
        else:
            reason_msg = f"Akses diberikan ({role_title}): {user.name} di ruang {resolved_room}."
    else:
        # Role Mahasiswa: Validasi Jadwal Kuliah & Ruangan (GSG210 / GSG211)
        has_schedule, active_sched, sched_reject_reason = check_class_schedule(
            db, user.kelas, room=resolved_room, target_dt=wib_dt
        )

        if has_schedule or bypass_schedule:
            if not active_sched and user.kelas:
                # Jika bypass_schedule aktif, ambil jadwal kelasnya di ruangan ini (jika ada) untuk info LCD/JSON
                active_sched = db.scalar(
                    select(ClassSchedule).where(
                        ClassSchedule.kelas == user.kelas,
                        ClassSchedule.room == resolved_room,
                    )
                ) or db.scalar(
                    select(ClassSchedule).where(ClassSchedule.kelas == user.kelas)
                )
            sched_info = (
                f" | Matkul: {active_sched.subject} ({active_sched.start_time}-{active_sched.end_time} WIB di {active_sched.room})"
                if active_sched
                else " (Bypass Jadwal Lab Aktif)"
            )
            status_result = "success"
            decision_result = "ACCEPT"
            reason_msg = f"Akses diberikan: {user.name} (Kelas {user.kelas or 'Mahasiswa'}){sched_info}."
        else:
            status_result = "out_of_schedule"
            decision_result = "DENY"
            reason_msg = f"Akses ditolak: {sched_reject_reason}"

    sched_kelas = (active_sched.kelas if active_sched else None) or user.kelas or "-"
    sched_subject = active_sched.subject if active_sched else "-"
    sched_lecturer = active_sched.lecturer if active_sched else (user.name if user_role == "dosen" else "-")
    sched_start = active_sched.start_time if active_sched else "--:--"
    sched_end = active_sched.end_time if active_sched else "--:--"
    sched_time_range = f"{sched_start}-{sched_end}" if active_sched else "Flexible/Bypass"

    # Format 2 baris LCD I2C 16x2 (masing-masing maksimal 16 karakter) dan Serial Monitor lengkap
    short_name = (user.name or "User").strip()[:16]
    if decision_result == "ACCEPT":
        lcd_l1 = short_name
        if active_sched:
            # Contoh: "TMJ5C 07:30-13:20" (16-17 char, dipadatkan agar pas di 16x2)
            compact_kelas = sched_kelas.replace(" ", "")[:5]
            lcd_l2 = f"{compact_kelas} {sched_start}-{sched_end}"[:16]
        else:
            compact_role = "DOSEN" if user_role == "dosen" else (user.kelas or "AKSES")[:8]
            lcd_l2 = f"{compact_role} [{resolved_room}]"[:16]
    else:
        lcd_l1 = f"TOLAK:{short_name[:10]}"[:16]
        lcd_l2 = f"BUKAN JADWAL {resolved_room[-3:]}"[:16]

    serial_msg = (
        f"[{wib_clock} WIB] [{resolved_room}] {decision_result} ({status_result.upper()}) | "
        f"Nama: {user.name} | Role: {user.role} | NIM/NIP: {user.nim or '-'} | "
        f"Kelas: {sched_kelas} | Matkul: {sched_subject} | Jam: {sched_start} - {sched_end} WIB | "
        f"Ruang: {resolved_room} | L2 Distance: {distance:.4f}"
    )
    logger.info(serial_msg)

    log_id = None
    if not is_simulation:
        log = AccessLog(
            user_id=user.id,
            room=resolved_room,
            user_name=user.name,
            user_role=user.role,
            user_nim=user.nim,
            user_kelas=user.kelas,
            status=status_result,
            reason=reason_msg,
            image_path=saved_filename,
            confidence_score=confidence_from_distance(distance),
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        log_id = log.id

    return RecognizeResponse(
        status=status_result,
        decision=decision_result,
        name=user.name,
        role=user.role,
        nim=user.nim,
        kelas=sched_kelas,
        room=resolved_room,
        subject=sched_subject if active_sched else None,
        lecturer=sched_lecturer if active_sched else None,
        start_time=sched_start if active_sched else None,
        end_time=sched_end if active_sched else None,
        schedule_time=sched_time_range if active_sched else None,
        day=active_sched.day if active_sched else wib_day,
        wib_time=wib_clock,
        lcd_line1=lcd_l1,
        lcd_line2=lcd_l2,
        serial_log=serial_msg,
        reason=reason_msg,
        distance=round(distance, 4) if distance is not None else None,
        faces_detected=1,
        box=box,
        all_boxes=all_boxes,
        frame=frame,
        threshold=MATCH_THRESHOLD,
        log_id=log_id,
        image_url=f"/api/logs/{log_id}/image" if log_id else None,
    )


# --------------------------------------------------------------------------- #
# Access Logs & Photo Proof
# --------------------------------------------------------------------------- #

@app.get("/api/logs/{log_id}/image")
def get_log_image(log_id: int, db: Session = Depends(get_db)):
    """Serve the captured photo associated with an access attempt."""
    log = db.get(AccessLog, log_id)
    if not log or not log.image_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Foto bukti tidak ditemukan untuk log ini.")

    full_path = os.path.join(CAPTURES_DIR, log.image_path)
    if not os.path.exists(full_path):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File foto tidak ditemukan pada server storage.")

    return FileResponse(full_path, media_type="image/jpeg")


@app.get("/api/rooms")
def get_rooms(db: Session = Depends(get_db)) -> list[str]:
    """Return active prototype rooms (strictly GSG210 and GSG211)."""
    return ["GSG210", "GSG211"]


@app.get("/api/lecturers")
def get_lecturers(db: Session = Depends(get_db)) -> list[dict]:
    """Return distinct GSG lecturers with their courses, rooms, and assigned classes."""
    schedules = db.scalars(select(ClassSchedule).order_by(ClassSchedule.lecturer.asc())).all()
    lecturers_map: dict[str, dict] = {}
    for s in schedules:
        name = (s.lecturer or "").strip()
        if not name:
            continue
        if name not in lecturers_map:
            lecturers_map[name] = {
                "name": name,
                "classes": set(),
                "rooms": set(),
                "subjects": set(),
            }
        if s.kelas:
            lecturers_map[name]["classes"].add(s.kelas)
        if s.room:
            lecturers_map[name]["rooms"].add(s.room)
        if s.subject:
            lecturers_map[name]["subjects"].add(s.subject)

    result = []
    for name, data in lecturers_map.items():
        sorted_rooms = sorted(list(data["rooms"]))
        sorted_classes = sorted(list(data["classes"]))
        result.append({
            "name": name,
            "classes": sorted_classes,
            "rooms": sorted_rooms,
            "subjects": sorted(list(data["subjects"])),
            "main_room": sorted_rooms[0] if sorted_rooms else "GSG",
            "main_class": ", ".join(sorted_classes)[:40],
        })
    return sorted(result, key=lambda x: x["name"])


@app.get("/api/logs", response_model=LogsResponse)
def get_logs(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    status_filter: Optional[str] = Query(None, alias="status"),
    room: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    db: Session = Depends(get_db),
) -> LogsResponse:
    conditions = []
    if status_filter:
        if status_filter == "success":
            conditions.append(AccessLog.status == "success")
        elif status_filter == "failed":
            conditions.append(AccessLog.status != "success")
        else:
            conditions.append(AccessLog.status == status_filter)

    if room:
        conditions.append(AccessLog.room == room)

    if role:
        conditions.append(AccessLog.user_role == role)

    total = db.scalar(select(func.count()).select_from(AccessLog).where(*conditions)) or 0
    logs = db.scalars(
        select(AccessLog)
        .options(joinedload(AccessLog.user))
        .where(*conditions)
        .order_by(AccessLog.timestamp.desc(), AccessLog.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()

    return LogsResponse(
        total=total,
        limit=limit,
        offset=offset,
        items=[serialize_log(l) for l in logs],
    )


@app.delete("/api/logs", status_code=status.HTTP_204_NO_CONTENT)
def clear_logs(db: Session = Depends(get_db)) -> None:
    db.execute(text("DELETE FROM access_logs"))
    db.commit()
    logger.info("Cleared all access logs.")


# --------------------------------------------------------------------------- #
# Class Schedules CRUD (Smart Classroom)
# --------------------------------------------------------------------------- #

@app.get("/api/schedules", response_model=list[ClassScheduleOut])
def list_schedules(
    kelas: Optional[str] = Query(None),
    day: Optional[str] = Query(None),
    db: Session = Depends(get_db),
) -> list[ClassScheduleOut]:
    query = select(ClassSchedule)
    if kelas:
        query = query.where(ClassSchedule.kelas == kelas)
    if day:
        query = query.where(ClassSchedule.day == day)

    # Order by day and start_time
    schedules = db.scalars(query.order_by(ClassSchedule.id.asc())).all()
    return [ClassScheduleOut.model_validate(s) for s in schedules]


@app.get("/api/schedules/current")
def get_current_schedule(
    kelas: str = Query("TMJ 5C"),
    room: Optional[str] = Query(None),
    db: Session = Depends(get_db),
) -> dict:
    wib_now = get_current_wib_datetime()
    current_day = INDONESIAN_DAYS.get(wib_now.weekday(), "")
    current_clock = wib_now.strftime("%H:%M")

    has_active, active_item, _ = check_class_schedule(db, kelas, room=room, target_dt=wib_now)
    return {
        "wib_time": current_clock,
        "wib_day": current_day,
        "kelas": kelas,
        "room": room,
        "has_active_lecture": has_active,
        "active_schedule": ClassScheduleOut.model_validate(active_item) if active_item else None,
    }


@app.post("/api/schedules", response_model=ClassScheduleOut, status_code=status.HTTP_201_CREATED)
def create_schedule(
    payload: ClassScheduleIn,
    db: Session = Depends(get_db),
) -> ClassScheduleOut:
    schedule = ClassSchedule(
        kelas=payload.kelas,
        day=payload.day,
        slot=payload.slot,
        start_time=payload.start_time,
        end_time=payload.end_time,
        subject=payload.subject,
        lecturer=payload.lecturer,
        room=payload.room,
        sks=payload.sks,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return ClassScheduleOut.model_validate(schedule)


@app.put("/api/schedules/{schedule_id}", response_model=ClassScheduleOut)
def update_schedule(
    schedule_id: int,
    payload: ClassScheduleIn,
    db: Session = Depends(get_db),
) -> ClassScheduleOut:
    schedule = db.get(ClassSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Jadwal kuliah tidak ditemukan.")

    schedule.kelas = payload.kelas
    schedule.day = payload.day
    schedule.slot = payload.slot
    schedule.start_time = payload.start_time
    schedule.end_time = payload.end_time
    schedule.subject = payload.subject
    schedule.lecturer = payload.lecturer
    schedule.room = payload.room
    schedule.sks = payload.sks

    db.commit()
    db.refresh(schedule)
    return ClassScheduleOut.model_validate(schedule)


@app.delete("/api/schedules/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_schedule(schedule_id: int, db: Session = Depends(get_db)) -> None:
    schedule = db.get(ClassSchedule, schedule_id)
    if not schedule:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Jadwal kuliah tidak ditemukan.")
    db.delete(schedule)
    db.commit()


# --------------------------------------------------------------------------- #
# User Management
# --------------------------------------------------------------------------- #

def serialize_user(u: User) -> UserOut:
    has_face = u.face_embedding is not None
    return UserOut(
        id=u.id,
        name=u.name,
        role=u.role or "mahasiswa",
        nim=u.nim,
        kelas=u.kelas,
        prodi=u.prodi,
        jurusan=u.jurusan,
        has_face=has_face,
        image_url=f"/api/users/{u.id}/image" if (has_face or u.image_path) else None,
        created_at=u.created_at,
    )


def ensure_schedule_lecturers_seeded(db: Session) -> None:
    """Pastikan seluruh dosen dari jadwal GSG 210 & 211 terdaftar di tabel users (role='dosen')."""
    existing_dosen_names = {
        (u.name or "").strip().lower()
        for u in db.scalars(select(User).where(User.role == "dosen")).all()
    }
    schedules = db.scalars(select(ClassSchedule)).all()
    lecturer_rooms_classes: dict[str, tuple[set[str], set[str]]] = {}
    for s in schedules:
        lec_name = (s.lecturer or "").strip()
        if not lec_name:
            continue
        if lec_name not in lecturer_rooms_classes:
            lecturer_rooms_classes[lec_name] = (set(), set())
        if s.room:
            lecturer_rooms_classes[lec_name][0].add(s.room)
        if s.kelas:
            lecturer_rooms_classes[lec_name][1].add(s.kelas)

    new_dosens = []
    for lec_name in sorted(lecturer_rooms_classes.keys()):
        if lec_name.lower() not in existing_dosen_names:
            rooms_set, classes_set = lecturer_rooms_classes[lec_name]
            rooms_str = "/".join(sorted(rooms_set))
            classes_str = ", ".join(sorted(classes_set))
            kelas_summary = f"{rooms_str} ({classes_str})"[:30] if rooms_str else classes_str[:30]
            new_dosens.append(
                User(
                    name=lec_name,
                    role="dosen",
                    nim=None,
                    kelas=kelas_summary,
                    prodi=None,
                    jurusan=None,
                    face_embedding=None,
                )
            )
    if new_dosens:
        db.add_all(new_dosens)
        db.commit()


@app.get("/api/users", response_model=list[UserOut])
def list_users(
    role: Optional[str] = Query(None),
    has_face: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
) -> list[UserOut]:
    if role and role.strip().lower() == "dosen":
        ensure_schedule_lecturers_seeded(db)

    stmt = select(User).order_by(User.created_at.desc(), User.id.asc())
    if role:
        stmt = stmt.where(User.role == role.strip().lower())
    if has_face is True:
        stmt = stmt.where(User.face_embedding.isnot(None))
    elif has_face is False:
        stmt = stmt.where(User.face_embedding.is_(None))
    if search:
        s = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                User.name.ilike(s),
                User.nim.ilike(s),
                User.kelas.ilike(s),
                User.prodi.ilike(s),
            )
        )
    users = db.scalars(stmt).all()
    return [serialize_user(u) for u in users]


@app.get("/api/users/{user_id}/image")
def get_user_face_image(user_id: int, db: Session = Depends(get_db)):
    """Serve the registered face photo for a user (or fallback to their latest access log photo)."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pengguna tidak ditemukan.")

    candidate_path = user.image_path
    if not candidate_path:
        latest_log = db.scalar(
            select(AccessLog)
            .where(AccessLog.user_id == user_id, AccessLog.image_path.isnot(None))
            .order_by(AccessLog.timestamp.desc())
            .limit(1)
        )
        if latest_log and latest_log.image_path:
            candidate_path = latest_log.image_path

    if not candidate_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Foto wajah pengguna belum tersedia.")

    full_path = os.path.join(CAPTURES_DIR, candidate_path)
    if not os.path.exists(full_path):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File foto wajah tidak ditemukan di server.")

    return FileResponse(full_path, media_type="image/jpeg")


@app.delete("/api/users/{user_id}/face", response_model=UserOut)
def reset_user_face(user_id: int, db: Session = Depends(get_db)) -> UserOut:
    """Reset / hapus rekaman embedding wajah dan foto wajah pengguna agar bisa direkam ulang."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pengguna tidak ditemukan.")

    user.face_embedding = None
    user.image_path = None
    db.commit()
    db.refresh(user)
    logger.info("Reset face embedding for user id=%d name=%r.", user.id, user.name)
    return serialize_user(user)


@app.post("/api/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_academic_user(payload: UserCreate, db: Session = Depends(get_db)) -> UserOut:
    clean_name = " ".join(payload.name.split())
    if not clean_name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nama lengkap pengguna wajib diisi.")
    
    clean_role = payload.role.strip().lower() if payload.role else "mahasiswa"
    if clean_role not in ["mahasiswa", "dosen", "admin"]:
        clean_role = "mahasiswa"
    
    clean_nim = " ".join(payload.nim.split()) if payload.nim and payload.nim.strip() else None
    clean_kelas = " ".join(payload.kelas.split()) if payload.kelas and payload.kelas.strip() else None
    clean_prodi = " ".join(payload.prodi.split()) if payload.prodi and payload.prodi.strip() else None
    clean_jurusan = " ".join(payload.jurusan.split()) if payload.jurusan and payload.jurusan.strip() else None

    # Check for duplicate NIM/NIP if provided
    if clean_nim:
        existing = db.scalar(select(User).where(User.nim == clean_nim))
        if existing:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"NIM / NIP '{clean_nim}' sudah terdaftar atas nama {existing.name}.",
            )

    user = User(
        name=clean_name,
        role=clean_role,
        nim=clean_nim,
        kelas=clean_kelas,
        prodi=clean_prodi,
        jurusan=clean_jurusan,
        face_embedding=None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("Created user record without face id=%d name=%r role=%r nim=%r.", user.id, user.name, user.role, user.nim)

    return serialize_user(user)


@app.put("/api/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db)) -> UserOut:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pengguna tidak ditemukan.")

    if payload.name is not None:
        clean_name = " ".join(payload.name.split())
        if clean_name:
            user.name = clean_name
    if payload.role is not None:
        clean_role = payload.role.strip().lower()
        if clean_role in ["mahasiswa", "dosen", "admin"]:
            user.role = clean_role
    if payload.nim is not None:
        clean_nim = " ".join(payload.nim.split()) if payload.nim.strip() else None
        if clean_nim and clean_nim != user.nim:
            existing = db.scalar(select(User).where(User.nim == clean_nim, User.id != user.id))
            if existing:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    f"NIM / NIP '{clean_nim}' sudah terdaftar atas nama {existing.name}.",
                )
        user.nim = clean_nim
    if payload.kelas is not None:
        user.kelas = " ".join(payload.kelas.split()) if payload.kelas.strip() else None
    if payload.prodi is not None:
        user.prodi = " ".join(payload.prodi.split()) if payload.prodi.strip() else None
    if payload.jurusan is not None:
        user.jurusan = " ".join(payload.jurusan.split()) if payload.jurusan.strip() else None
    if payload.reset_face is True:
        user.face_embedding = None
        user.image_path = None

    db.commit()
    db.refresh(user)
    logger.info("Updated user id=%d name=%r role=%r.", user.id, user.name, user.role)

    return serialize_user(user)


@app.delete("/api/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db)) -> None:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found.")
    db.delete(user)
    db.commit()
    logger.info("Deleted user id=%d.", user_id)


@app.delete("/api/users", status_code=status.HTTP_204_NO_CONTENT)
def delete_all_users(db: Session = Depends(get_db)) -> None:
    db.execute(text("DELETE FROM users"))
    db.commit()
    logger.info("Deleted all registered users.")


# --------------------------------------------------------------------------- #
# Stats & Metrics
# --------------------------------------------------------------------------- #

@app.get("/api/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)) -> StatsResponse:
    ensure_schedule_lecturers_seeded(db)
    since = datetime.now(timezone.utc) - timedelta(hours=24)

    def count_logs(*conditions) -> int:
        return db.scalar(select(func.count()).select_from(AccessLog).where(*conditions)) or 0

    def count_users(*conditions) -> int:
        return db.scalar(select(func.count()).select_from(User).where(*conditions)) or 0

    recent = db.scalars(
        select(AccessLog)
        .options(joinedload(AccessLog.user))
        .order_by(AccessLog.timestamp.desc(), AccessLog.id.desc())
        .limit(10)
    ).all()

    total_mhs = count_users(User.role == "mahasiswa")
    total_mhs_face = count_users(User.role == "mahasiswa", User.face_embedding.isnot(None))
    total_dsn = count_users(User.role == "dosen")
    total_dsn_face = count_users(User.role == "dosen", User.face_embedding.isnot(None))
    total_adm = count_users(User.role == "admin")
    total_face_all = count_users(User.face_embedding.isnot(None))

    return StatsResponse(
        total_users=total_mhs + total_dsn,
        total_with_face=total_face_all,
        total_mahasiswa=total_mhs,
        total_mahasiswa_with_face=total_mhs_face,
        total_dosen=total_dsn,
        total_dosen_with_face=total_dsn_face,
        total_admin=total_adm,
        total_attempts=count_logs(),
        success_24h=count_logs(AccessLog.status == "success", AccessLog.timestamp >= since),
        failed_24h=count_logs(AccessLog.status != "success", AccessLog.timestamp >= since),
        match_threshold=MATCH_THRESHOLD,
        detection_model=DETECTION_MODEL,
        recent_logs=[serialize_log(l) for l in recent],
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, reload_excludes=["*.db*"])

