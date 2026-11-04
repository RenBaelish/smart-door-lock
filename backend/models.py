import json
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, TypeDecorator, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base, IS_SQLITE

EMBEDDING_DIM = 128

if IS_SQLITE:
    class SQLiteVector(TypeDecorator):
        impl = Text
        cache_ok = True

        def process_bind_param(self, value, dialect):
            if value is not None:
                return json.dumps(value)
            return None

        def process_result_value(self, value, dialect):
            if value is not None:
                return json.loads(value)
            return None

    VectorType = SQLiteVector
else:
    from pgvector.sqlalchemy import Vector
    VectorType = Vector(EMBEDDING_DIM)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="mahasiswa")  # mahasiswa, dosen, tamu
    nim: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    kelas: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    prodi: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    jurusan: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    face_embedding = mapped_column(VectorType, nullable=True)
    image_path: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    access_logs: Mapped[list["AccessLog"]] = relationship(
        back_populates="user", passive_deletes=True
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} name={self.name!r} role={self.role!r} nim={self.nim!r} kelas={self.kelas!r}>"


class AccessLog(Base):
    __tablename__ = "access_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Status categories: 'success', 'out_of_schedule', 'unregistered', 'no_face', 'tailgating', 'failed'
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    image_path: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    room: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)  # e.g. "GSG212"
    
    # Snapshot metadata if user is deleted or for quick access
    user_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    user_role: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    user_nim: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    user_kelas: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    user: Mapped[Optional[User]] = relationship(back_populates="access_logs")

    def __repr__(self) -> str:
        return f"<AccessLog id={self.id} status={self.status} user_id={self.user_id}>"


class ClassSchedule(Base):
    __tablename__ = "class_schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kelas: Mapped[str] = mapped_column(String(30), nullable=False, default="TMJ 5C", index=True)
    day: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # Senin, Selasa, Rabu, Kamis, Jumat
    slot: Mapped[str] = mapped_column(String(30), nullable=True)             # e.g. "1 - 6"
    start_time: Mapped[str] = mapped_column(String(10), nullable=False)      # "07:30"
    end_time: Mapped[str] = mapped_column(String(10), nullable=False)        # "13:20"
    subject: Mapped[str] = mapped_column(String(100), nullable=False)        # "Perencanaan Jaringan"
    lecturer: Mapped[str] = mapped_column(String(100), nullable=False)       # "Asep Kurniawan"
    room: Mapped[str] = mapped_column(String(50), nullable=False)            # "GSG212"
    sks: Mapped[int] = mapped_column(Integer, nullable=False, default=3)

    def __repr__(self) -> str:
        return f"<ClassSchedule id={self.id} {self.day} {self.start_time}-{self.end_time} {self.subject} ({self.room})>"

