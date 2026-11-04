import os
from collections.abc import Generator

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Store facelock.db outside backend/ so uvicorn --reload does not restart when SQLite updates
DEFAULT_DB_PATH = os.path.abspath(os.path.join(BASE_DIR, "..", "facelock.db"))

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{DEFAULT_DB_PATH}",
)

IS_SQLITE = DATABASE_URL.startswith("sqlite")

if IS_SQLITE:
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
    )

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Base class for all ORM models."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


CAPTURES_DIR = os.path.abspath(os.path.join(BASE_DIR, "captures"))
os.makedirs(CAPTURES_DIR, exist_ok=True)


def init_db() -> None:
    """Ensure database tables, extensions, directories, and seed data exist."""
    import models  # noqa: F401  (registers the models on Base.metadata)

    if not IS_SQLITE:
        with engine.begin() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.create_all(bind=engine)

    # Database schema migration for existing SQLite / Postgres tables
    # Each statement runs in its own transaction so a single failure on PostgreSQL
    # does not abort the transaction block for subsequent migrations.
    for col, col_type in [
        ("role", "VARCHAR(20) DEFAULT 'mahasiswa'"),
        ("nim", "VARCHAR(30)"),
        ("kelas", "VARCHAR(30)"),
        ("prodi", "VARCHAR(100)"),
        ("jurusan", "VARCHAR(100)"),
        ("image_path", "VARCHAR(255)"),
    ]:
        try:
            with engine.begin() as conn:
                if IS_SQLITE:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {col_type}"))
                else:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col} {col_type}"))
        except Exception:
            pass

    if not IS_SQLITE:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ALTER COLUMN face_embedding DROP NOT NULL"))
        except Exception:
            pass

    try:
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM users WHERE role IN ('tamu', 'vip')"))
    except Exception:
        pass

    # 2. Update access_logs table columns
    for col, col_type in [
        ("reason", "VARCHAR(255)"),
        ("image_path", "VARCHAR(255)"),
        ("room", "VARCHAR(50)"),
        ("user_name", "VARCHAR(100)"),
        ("user_role", "VARCHAR(20)"),
        ("user_nim", "VARCHAR(30)"),
        ("user_kelas", "VARCHAR(30)"),
    ]:
        try:
            with engine.begin() as conn:
                if IS_SQLITE:
                    conn.execute(text(f"ALTER TABLE access_logs ADD COLUMN {col} {col_type}"))
                else:
                    conn.execute(text(f"ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS {col} {col_type}"))
        except Exception:
            pass

    # 3. Drop legacy check constraint on access_logs if old one restricts statuses
    #    (supports statuses: 'success', 'out_of_schedule', 'unregistered', 'no_face', 'tailgating', 'failed')
    if IS_SQLITE:
        try:
            with engine.begin() as conn:
                # Check if table definition has restrictive check
                table_sql = conn.execute(
                    text("SELECT sql FROM sqlite_master WHERE type='table' AND name='access_logs'")
                ).scalar()
                if table_sql and "access_logs_status_check" in table_sql:
                    # Migrate to table without status restriction
                    conn.execute(text("CREATE TABLE access_logs_new AS SELECT * FROM access_logs"))
                    conn.execute(text("DROP TABLE access_logs"))
                    conn.execute(text("""
                        CREATE TABLE access_logs (
                            id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                            user_id INTEGER,
                            status VARCHAR(32) NOT NULL,
                            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                            confidence_score FLOAT,
                            reason VARCHAR(255),
                            image_path VARCHAR(255),
                            room VARCHAR(50),
                            user_name VARCHAR(100),
                            user_role VARCHAR(20),
                            user_nim VARCHAR(30),
                            user_kelas VARCHAR(30),
                            FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL
                        )
                    """))
                    conn.execute(text("""
                        INSERT INTO access_logs (id, user_id, status, timestamp, confidence_score, reason, image_path, user_name, user_nim, user_kelas)
                        SELECT id, user_id, status, timestamp, confidence_score, reason, 
                               CASE WHEN typeof(image_path) != 'null' THEN image_path ELSE NULL END,
                               NULL, NULL, NULL
                        FROM access_logs_new
                    """))
                    conn.execute(text("DROP TABLE access_logs_new"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_access_logs_status ON access_logs (status)"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_access_logs_timestamp ON access_logs (timestamp)"))
        except Exception:
            pass
    else:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE access_logs DROP CONSTRAINT IF EXISTS access_logs_status_check"))
        except Exception:
            pass

    # 4. Seed initial TMJ 5C schedule data if class_schedules is empty,
    #    and ensure only GSG210 & GSG211 rooms exist in class_schedules.
    with SessionLocal() as db:
        from models import ClassSchedule
        # Remove schedules from rooms outside GSG210 and GSG211
        db.query(ClassSchedule).filter(~ClassSchedule.room.in_(["GSG210", "GSG211"])).delete(synchronize_session=False)
        db.commit()

        count = db.query(ClassSchedule).count()
        if count == 0:
            initial_schedules = [
                # Senin
                ClassSchedule(
                    kelas="TI 3C",
                    day="Senin",
                    slot="1 - 4",
                    start_time="07:30",
                    end_time="10:50",
                    subject="Desain UI/UX",
                    lecturer="Iwan Sonjaya",
                    room="GSG210",
                    sks=2,
                ),
                ClassSchedule(
                    kelas="TMD 1B",
                    day="Senin",
                    slot="1 - 6",
                    start_time="07:30",
                    end_time="13:20",
                    subject="Menggambar",
                    lecturer="Yulianto Hadiprawiro",
                    room="GSG211",
                    sks=3,
                ),
                ClassSchedule(
                    kelas="TI 1B",
                    day="Senin",
                    slot="7 - 12",
                    start_time="13:20",
                    end_time="18:55",
                    subject="Sistem Operasi",
                    lecturer="Dr. Defiana",
                    room="GSG210",
                    sks=3,
                ),
                ClassSchedule(
                    kelas="TI 3B",
                    day="Senin",
                    slot="7 - 10",
                    start_time="13:20",
                    end_time="16:55",
                    subject="Manajemen Proyek TIK",
                    lecturer="Abdul Hadi",
                    room="GSG211",
                    sks=2,
                ),
                # Selasa
                ClassSchedule(
                    kelas="TI 3A",
                    day="Selasa",
                    slot="1 - 4",
                    start_time="07:30",
                    end_time="10:50",
                    subject="Kecerdasan Buatan",
                    lecturer="Dr. Dewi",
                    room="GSG210",
                    sks=2,
                ),
                ClassSchedule(
                    kelas="TMJ-CCIT 1A",
                    day="Selasa",
                    slot="5 - 8",
                    start_time="10:50",
                    end_time="15:00",
                    subject="Algoritma dan Pemrograman",
                    lecturer="Ariawan Andi",
                    room="GSG210",
                    sks=2,
                ),
                ClassSchedule(
                    kelas="TMD 3B",
                    day="Selasa",
                    slot="1 - 4",
                    start_time="07:30",
                    end_time="10:50",
                    subject="Kewarganegaraan",
                    lecturer="Dinda Kadarwati",
                    room="GSG211",
                    sks=2,
                ),
                ClassSchedule(
                    kelas="TMD 3B",
                    day="Selasa",
                    slot="7 - 10",
                    start_time="13:20",
                    end_time="16:55",
                    subject="Bahasa Indonesia",
                    lecturer="Rahmatia Ayu",
                    room="GSG211",
                    sks=2,
                ),
                # Rabu
                ClassSchedule(
                    kelas="TMJ 5C",
                    day="Rabu",
                    slot="1 - 6",
                    start_time="07:30",
                    end_time="13:20",
                    subject="Analisis Permintaan Jaringan",
                    lecturer="Dr. Defiana",
                    room="GSG210",
                    sks=3,
                ),
                ClassSchedule(
                    kelas="TMD 1A",
                    day="Rabu",
                    slot="7 - 12",
                    start_time="13:20",
                    end_time="18:55",
                    subject="Menggambar",
                    lecturer="Ibnu Mulyana",
                    room="GSG210",
                    sks=3,
                ),
                ClassSchedule(
                    kelas="TI 3B",
                    day="Rabu",
                    slot="1 - 4",
                    start_time="07:30",
                    end_time="10:50",
                    subject="Pemrograman Visual",
                    lecturer="Chairul Fikri",
                    room="GSG211",
                    sks=2,
                ),
                ClassSchedule(
                    kelas="TMJ 5C",
                    day="Rabu",
                    slot="7 - 12",
                    start_time="13:20",
                    end_time="18:55",
                    subject="Komunikasi Profesional",
                    lecturer="Dr. Indra",
                    room="GSG211",
                    sks=3,
                ),
                # Kamis
                ClassSchedule(
                    kelas="TMD 3A",
                    day="Kamis",
                    slot="1 - 4",
                    start_time="07:30",
                    end_time="10:50",
                    subject="Grafika Komputer",
                    lecturer="Sinantya Feranti",
                    room="GSG210",
                    sks=2,
                ),
                ClassSchedule(
                    kelas="TMJ 5C",
                    day="Kamis",
                    slot="1 - 6",
                    start_time="07:30",
                    end_time="13:20",
                    subject="Dokumentasi Jaringan",
                    lecturer="Dwi Ermawati / Chandra Wirawan",
                    room="GSG211",
                    sks=3,
                ),
                ClassSchedule(
                    kelas="TI 3C",
                    day="Kamis",
                    slot="7 - 11",
                    start_time="13:20",
                    end_time="17:45",
                    subject="Grafika Komputer",
                    lecturer="Anggi Mardiyono",
                    room="GSG211",
                    sks=2,
                ),
                # Jumat
                ClassSchedule(
                    kelas="TMD 3B",
                    day="Jumat",
                    slot="1 - 4",
                    start_time="07:30",
                    end_time="10:50",
                    subject="Grafika Komputer",
                    lecturer="Mahbubul Wathoni",
                    room="GSG210",
                    sks=2,
                ),
                ClassSchedule(
                    kelas="TMD 3C",
                    day="Jumat",
                    slot="6 - 9",
                    start_time="13:20",
                    end_time="16:55",
                    subject="Grafika Komputer",
                    lecturer="Mahbubul Wathoni",
                    room="GSG210",
                    sks=2,
                ),
                ClassSchedule(
                    kelas="TI 3C",
                    day="Jumat",
                    slot="1 - 4",
                    start_time="07:30",
                    end_time="10:50",
                    subject="Metode Numerik",
                    lecturer="Fajar Septian",
                    room="GSG211",
                    sks=2,
                ),
            ]
            db.add_all(initial_schedules)
            db.commit()

        # 5. Seed initial Admin Dashboard users (team PBL) if no admin exists yet
        from models import User
        admin_count = db.query(User).filter(User.role == "admin").count()
        if admin_count == 0:
            initial_admins = [
                User(
                    name="Muhammad Iqbal Syarif",
                    role="admin",
                    nim="2407421059",
                    kelas="Super Admin",
                    prodi="Teknik Multimedia dan Jaringan",
                    jurusan="Teknik Informatika dan Komputer",
                    face_embedding=None,
                ),
                User(
                    name="Muhammad Iqbal Haysami",
                    role="admin",
                    nim="2407421069",
                    kelas="Network Admin",
                    prodi="Teknik Multimedia dan Jaringan",
                    jurusan="Teknik Informatika dan Komputer",
                    face_embedding=None,
                ),
                User(
                    name="Raffi Rabbani Widyputra",
                    role="admin",
                    nim="2407421077",
                    kelas="System Admin",
                    prodi="Teknik Multimedia dan Jaringan",
                    jurusan="Teknik Informatika dan Komputer",
                    face_embedding=None,
                ),
                User(
                    name="Muhammad Imam Syuhada",
                    role="admin",
                    nim="2407421081",
                    kelas="Security Admin",
                    prodi="Teknik Multimedia dan Jaringan",
                    jurusan="Teknik Informatika dan Komputer",
                    face_embedding=None,
                ),
            ]
            db.add_all(initial_admins)
            db.commit()

        # 6. Auto-seed all lecturers from GSG210 & GSG211 schedules into users (role='dosen')
        existing_dosen_names = {
            (u.name or "").strip().lower()
            for u in db.query(User).filter(User.role == "dosen").all()
        }
        all_schedules = db.query(ClassSchedule).all()
        lecturer_rooms_classes: dict[str, tuple[set[str], set[str]]] = {}
        for s in all_schedules:
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



