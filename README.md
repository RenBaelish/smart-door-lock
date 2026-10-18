# FaceLock - Face Recognition Smart Door Lock (Local Prototype)

Local prototype of a face recognition door lock. The laptop webcam stands in for
the ESP32 camera; the backend API is the same one the ESP32 client will call later.

```
face-lock-prototype/
  docker-compose.yml     PostgreSQL 16 + pgvector (host port 5433)
  init.sql               users / access_logs schema
  backend/               FastAPI + face_recognition (dlib) + SQLAlchemy
    main.py              API endpoints and recognition logic
    models.py            ORM models (pgvector Vector(128))
    database.py          engine, session, init
  frontend/              Next.js 15 + TypeScript + Tailwind CSS
    src/app/             /dashboard /register /simulate /logs
    src/components/      Sidebar, Webcam, LogsTable, StatCard, views/...
```

## 1. Database (Zero-Docker / SQLite)

Backend secara default sudah mendukung **SQLite** (`facelock.db`) sehingga Anda **tidak perlu menyalakan Docker sama sekali**.

*(Opsional) Jika di masa depan ingin beralih ke PostgreSQL + pgvector:*
```powershell
docker compose up -d
# Lalu ubah DATABASE_URL di backend/.env
```

## 2. Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# dlib + face_recognition
pip install dlib-bin                       # Windows: prebuilt dlib wheel
pip install face_recognition --no-deps     # avoids compiling dlib from source
# Linux / macOS instead:  pip install dlib face_recognition

copy .env.example .env
uvicorn main:app --reload --port 8000
```

Interactive API docs: http://localhost:8000/docs

## 3. Frontend

```powershell
cd frontend
npm install
copy .env.local.example .env.local
npm run dev
```

Open http://localhost:3000. The browser only allows webcam access on `localhost` or HTTPS.

## Recognition pipeline (`POST /api/recognize`)

1. Decode the uploaded JPEG, downscale it to at most `MAX_IMAGE_WIDTH` pixels wide.
2. `face_recognition.face_locations()` finds every face.
3. Compute `(bottom - top) * (right - left)` for each box and keep **only the largest**
   (the person closest to the camera). Smaller boxes are discarded and never encoded.
4. Extract the 128-D embedding of that face.
5. Find the nearest user with pgvector: `ORDER BY face_embedding <-> :embedding LIMIT 1` (L2 / Euclidean).
6. `distance < 0.6` means `success`, anything else is `invalid`.
7. Insert a row into `access_logs` (`confidence_score = 1 - distance`, clipped to 0..1).

Response:

```json
{
  "status": "success",
  "name": "Jane Doe",
  "distance": 0.4512,
  "faces_detected": 2,
  "box": { "top": 120, "right": 410, "bottom": 330, "left": 200 },
  "frame": { "width": 640, "height": 480 },
  "threshold": 0.6,
  "log_id": 42
}
```

When no face is found the API returns `"status": "no_face"` and **does not** write a log,
so an empty doorway does not flood the audit table.

## Endpoints

| Method | Path                   | Body / Query                                  |
| ------ | ---------------------- | --------------------------------------------- |
| POST   | `/api/register`        | multipart: `name`, `file` (image)             |
| POST   | `/api/recognize`       | multipart: `file` (image)                     |
| GET    | `/api/logs`            | `limit`, `offset`, `status=success\|failed`   |
| GET    | `/api/users`           |                                               |
| DELETE | `/api/users/{id}`      |                                               |
| GET    | `/api/stats`           |                                               |
| GET    | `/api/health`          |                                               |

`/api/register` rejects a face that is already enrolled (distance below `DUPLICATE_THRESHOLD`, default 0.45).

## Moving to the ESP32

The ESP32-CAM only has to send an HTTP `POST` to `/api/recognize` with the JPEG frame as
`multipart/form-data` (field name `file`), then check `status == "success"` to drive the lock relay.
