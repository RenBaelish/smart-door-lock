"""Seed GSG210 and GSG211 schedules and distinct lecturers into the smart classroom database."""
import os
import sys

# Ensure backend folder in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, init_db
from models import ClassSchedule, User

GSG_SCHEDULES = [
    # ================= RUANG GSG210 (Pintu 1 / IP: 192.168.30.2) =================
    {"kelas": "TI 3C", "day": "Senin", "slot": "1 - 4", "start_time": "07:30", "end_time": "10:50", "subject": "Desain UI/UX", "lecturer": "Iwan Sonjaya", "room": "GSG210", "sks": 2},
    {"kelas": "TI 1B", "day": "Senin", "slot": "7 - 12", "start_time": "13:20", "end_time": "18:55", "subject": "Sistem Operasi", "lecturer": "Dr. Defiana", "room": "GSG210", "sks": 3},
    {"kelas": "TI 3A", "day": "Selasa", "slot": "1 - 4", "start_time": "07:30", "end_time": "10:50", "subject": "Kecerdasan Buatan", "lecturer": "Dr. Dewi", "room": "GSG210", "sks": 2},
    {"kelas": "TMJ-CCIT 1A", "day": "Selasa", "slot": "5 - 8", "start_time": "10:50", "end_time": "15:00", "subject": "Algoritma dan Pemrograman", "lecturer": "Ariawan Andi", "room": "GSG210", "sks": 2},
    {"kelas": "TMJ 5C", "day": "Rabu", "slot": "1 - 6", "start_time": "07:30", "end_time": "13:20", "subject": "Analisis Permintaan Jaringan", "lecturer": "Dr. Defiana", "room": "GSG210", "sks": 3},
    {"kelas": "TMD 1A", "day": "Rabu", "slot": "7 - 12", "start_time": "13:20", "end_time": "18:55", "subject": "Menggambar", "lecturer": "Ibnu Mulyana", "room": "GSG210", "sks": 3},
    {"kelas": "TMD 3A", "day": "Kamis", "slot": "1 - 4", "start_time": "07:30", "end_time": "10:50", "subject": "Grafika Komputer", "lecturer": "Sinantya Feranti", "room": "GSG210", "sks": 2},
    {"kelas": "TMD 3B", "day": "Jumat", "slot": "1 - 4", "start_time": "07:30", "end_time": "10:50", "subject": "Grafika Komputer", "lecturer": "Mahbubul Wathoni", "room": "GSG210", "sks": 2},
    {"kelas": "TMD 3C", "day": "Jumat", "slot": "6 - 9", "start_time": "13:20", "end_time": "16:55", "subject": "Grafika Komputer", "lecturer": "Mahbubul Wathoni", "room": "GSG210", "sks": 2},

    # ================= RUANG GSG211 (Pintu 2 / IP: 192.168.30.3) =================
    {"kelas": "TMD 1B", "day": "Senin", "slot": "1 - 6", "start_time": "07:30", "end_time": "13:20", "subject": "Menggambar", "lecturer": "Yulianto Hadiprawiro", "room": "GSG211", "sks": 3},
    {"kelas": "TI 3B", "day": "Senin", "slot": "7 - 10", "start_time": "13:20", "end_time": "16:55", "subject": "Manajemen Proyek TIK", "lecturer": "Abdul Hadi", "room": "GSG211", "sks": 2},
    {"kelas": "TMD 3B", "day": "Selasa", "slot": "1 - 4", "start_time": "07:30", "end_time": "10:50", "subject": "Kewarganegaraan", "lecturer": "Dinda Kadarwati", "room": "GSG211", "sks": 2},
    {"kelas": "TMD 3B", "day": "Selasa", "slot": "7 - 10", "start_time": "13:20", "end_time": "16:55", "subject": "Bahasa Indonesia", "lecturer": "Rahmatia Ayu", "room": "GSG211", "sks": 2},
    {"kelas": "TI 3B", "day": "Rabu", "slot": "1 - 4", "start_time": "07:30", "end_time": "10:50", "subject": "Pemrograman Visual", "lecturer": "Chairul Fikri", "room": "GSG211", "sks": 2},
    {"kelas": "TMJ 5C", "day": "Rabu", "slot": "7 - 12", "start_time": "13:20", "end_time": "18:55", "subject": "Komunikasi Profesional", "lecturer": "Dr. Indra", "room": "GSG211", "sks": 3},
    {"kelas": "TMJ 5C", "day": "Kamis", "slot": "1 - 6", "start_time": "07:30", "end_time": "13:20", "subject": "Dokumentasi Jaringan", "lecturer": "Dwi Ermawati / Chandra Wirawan", "room": "GSG211", "sks": 3},
    {"kelas": "TI 3C", "day": "Kamis", "slot": "7 - 11", "start_time": "13:20", "end_time": "17:45", "subject": "Grafika Komputer", "lecturer": "Anggi Mardiyono", "room": "GSG211", "sks": 2},
    {"kelas": "TI 3C", "day": "Jumat", "slot": "1 - 4", "start_time": "07:30", "end_time": "10:50", "subject": "Metode Numerik", "lecturer": "Fajar Septian", "room": "GSG211", "sks": 2},
]

def seed():
    init_db()
    db = SessionLocal()
    try:
        # Clear existing schedules to avoid duplicates
        db.query(ClassSchedule).delete()
        db.commit()

        count = 0
        for item in GSG_SCHEDULES:
            sched = ClassSchedule(
                kelas=item["kelas"],
                day=item["day"],
                slot=item["slot"],
                start_time=item["start_time"],
                end_time=item["end_time"],
                subject=item["subject"],
                lecturer=item["lecturer"],
                room=item["room"],
                sks=item["sks"],
            )
            db.add(sched)
            count += 1

        db.commit()
        print(f"Successfully seeded {count} GSG210 & GSG211 schedule slots into database.")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
