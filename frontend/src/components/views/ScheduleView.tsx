"use client";

import { useCallback, useEffect, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import Icon from "@/components/Icon";
import PageHeader from "@/components/PageHeader";
import {
  api,
  errorMessage,
  type ClassSchedule,
  type ClassScheduleIn,
  type CurrentScheduleResponse,
} from "@/lib/api";

const DAYS = ["Semua", "Senin", "Selasa", "Rabu", "Kamis", "Jumat"];

export default function ScheduleView() {
  const [selectedDay, setSelectedDay] = useState("Semua");
  const [roomFilter, setRoomFilter] = useState("Semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [currentInfo, setCurrentInfo] = useState<CurrentScheduleResponse | null>(null);

  // Modal form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ClassSchedule | null>(null);
  const [saving, setSaving] = useState(false);

  // Form inputs
  const [formData, setFormData] = useState<ClassScheduleIn>({
    kelas: "TMJ 5C",
    day: "Rabu",
    slot: "1 - 6",
    start_time: "07:30",
    end_time: "13:20",
    subject: "",
    lecturer: "",
    room: "GSG210",
    sks: 3,
  });

  // Delete dialog states
  const [deleteTarget, setDeleteTarget] = useState<ClassSchedule | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.schedules({
        day: selectedDay === "Semua" ? undefined : selectedDay,
      });
      setSchedules(list);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [selectedDay]);

  useEffect(() => {
    loadData();
    const interval = window.setInterval(loadData, 15000);
    return () => window.clearInterval(interval);
  }, [loadData]);

  const handleOpenCreate = () => {
    setEditingSchedule(null);
    setFormData({
      kelas: "TMJ 5C",
      day: selectedDay === "Semua" ? "Senin" : selectedDay,
      slot: "1 - 6",
      start_time: "07:30",
      end_time: "13:20",
      subject: "",
      lecturer: "",
      room: "GSG210",
      sks: 3,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: ClassSchedule) => {
    setEditingSchedule(s);
    setFormData({
      kelas: s.kelas,
      day: s.day,
      slot: s.slot || "1 - 6",
      start_time: s.start_time,
      end_time: s.end_time,
      subject: s.subject,
      lecturer: s.lecturer,
      room: s.room,
      sks: s.sks,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject.trim() || !formData.lecturer.trim()) {
      setError("Silakan isi nama mata kuliah dan dosen pengampu.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingSchedule) {
        await api.updateSchedule(editingSchedule.id, formData);
        setNotice(`Jadwal "${formData.subject}" berhasil diperbarui.`);
      } else {
        await api.createSchedule(formData);
        setNotice(`Jadwal "${formData.subject}" berhasil ditambahkan.`);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteSchedule(deleteTarget.id);
      setNotice(`Jadwal "${deleteTarget.subject}" berhasil dihapus.`);
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Manajemen Kelas & Jadwal Perkuliahan"
        description="Pengaturan jadwal kuliah dan ruangan Smart Classroom untuk sinkronisasi hak akses door lock. Pintu ruang kelas hanya akan terbuka bagi mahasiswa terdaftar yang memiliki jadwal aktif pada ruangan dan jam tersebut."
        actions={
          <button
            type="button"
            onClick={handleOpenCreate}
            className="btn btn-primary"
          >
            <Icon name="userPlus" className="h-4 w-4" />
            Tambah Slot Jadwal
          </button>
        }
      />

      {error && <div className="alert alert-error mb-6">{error}</div>}
      {notice && <div className="alert alert-success mb-6">{notice}</div>}

      {/* Filter Bar: Day Tabs, Room Dropdown & Search Input */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-slate-200 pb-3">
        {/* Day Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {DAYS.map((day) => {
            const active = selectedDay === day;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  active
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Room & Search Inputs */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500">Ruangan:</span>
            <select
              className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-800"
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
            >
              <option value="Semua">Semua Ruangan</option>
              {Array.from(new Set(schedules.map((s) => s.room)))
                .sort()
                .map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
            </select>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Cari dosen, kelas, matkul..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-950 w-52"
            />
          </div>
        </div>
      </div>

      {/* Schedule Table / Cards Card */}
      <section className="card overflow-hidden" aria-labelledby="schedule-heading">
        <div className="card-header flex items-center justify-between">
          <div>
            <h2 id="schedule-heading" className="card-title">
              Daftar Jadwal Kuliah Gedung GSG ({selectedDay === "Semua" ? "Semua Hari" : `Hari ${selectedDay}`})
            </h2>
            <p className="card-subtitle">
              Menampilkan {
                schedules.filter((s) => {
                  if (roomFilter !== "Semua" && s.room !== roomFilter) return false;
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return (
                    s.kelas.toLowerCase().includes(q) ||
                    s.subject.toLowerCase().includes(q) ||
                    s.lecturer.toLowerCase().includes(q) ||
                    s.room.toLowerCase().includes(q)
                  );
                }).length
              } dari total {schedules.length} slot mata kuliah & ruangan terdaftar
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="th">Hari</th>
                <th scope="col" className="th">Kelas</th>
                <th scope="col" className="th">Slot / Jam Kuliah</th>
                <th scope="col" className="th">Mata Kuliah</th>
                <th scope="col" className="th">Dosen Pengampu</th>
                <th scope="col" className="th">Ruangan</th>
                <th scope="col" className="th text-center">SKS</th>
                <th scope="col" className="th text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {schedules
                .filter((s) => {
                  if (roomFilter !== "Semua" && s.room !== roomFilter) return false;
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return (
                    s.kelas.toLowerCase().includes(q) ||
                    s.subject.toLowerCase().includes(q) ||
                    s.lecturer.toLowerCase().includes(q) ||
                    s.room.toLowerCase().includes(q)
                  );
                })
                .map((s) => {
                return (
                  <tr
                    key={s.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="td">
                      <span className="inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                        {s.day}
                      </span>
                    </td>
                    <td className="td">
                      <span className="font-semibold text-xs text-slate-900 bg-secondary-50/80 border border-secondary-200/80 px-2 py-0.5 rounded">
                        {s.kelas || "Semua"}
                      </span>
                    </td>
                    <td className="td">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-semibold text-slate-900">
                          {s.start_time} - {s.end_time} WIB
                        </span>
                        {s.slot && (
                          <span className="text-[11px] text-slate-500">Slot {s.slot}</span>
                        )}
                      </div>
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{s.subject}</span>
                      </div>
                    </td>
                    <td className="td text-xs text-slate-700">{s.lecturer}</td>
                    <td className="td">
                      <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs font-bold text-slate-800">
                        {s.room}
                      </span>
                    </td>
                    <td className="td text-center font-mono text-xs text-slate-700">{s.sks} SKS</td>
                    <td className="td text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(s)}
                          className="btn btn-secondary btn-sm"
                          title="Edit Jadwal"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(s)}
                          className="btn btn-danger btn-sm"
                          title="Hapus Jadwal"
                        >
                          <Icon name="trash" className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {schedules.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">
                    Tidak ada jadwal kuliah terdaftar untuk filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal Add / Edit Schedule */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-neutral-950/60 backdrop-blur-xs"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
              <h3 className="font-display text-base font-semibold text-slate-900">
                {editingSchedule ? "Revisi Jadwal Perkuliahan" : "Tambah Jadwal Perkuliahan"}
              </h3>
              <p className="text-xs text-slate-500">Atur alokasi kelas dan ruangan Smart Classroom</p>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Kelas Mahasiswa *</label>
                  <input
                    type="text"
                    className="input font-semibold"
                    placeholder="Contoh: TMJ 5C, TI 3A, dll"
                    value={formData.kelas || ""}
                    onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Ruangan (Door Lock) *</label>
                  <select
                    className="input font-mono font-bold uppercase"
                    value={formData.room}
                    onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                    required
                  >
                    <option value="GSG210">GSG 210 (Pintu 1 - 192.168.30.2)</option>
                    <option value="GSG211">GSG 211 (Pintu 2 - 192.168.30.3)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Hari Perkuliahan</label>
                  <select
                    className="input"
                    value={formData.day}
                    onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                  >
                    {["Senin", "Selasa", "Rabu", "Kamis", "Jumat"].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Slot Pertemuan</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Contoh: 1 - 6"
                    value={formData.slot || ""}
                    onChange={(e) => setFormData({ ...formData, slot: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Jam Mulai (WIB)</label>
                  <input
                    type="time"
                    className="input"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Jam Selesai (WIB)</label>
                  <input
                    type="time"
                    className="input"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Nama Mata Kuliah *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Contoh: Perencanaan Jaringan"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label">Dosen Pengampu *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Contoh: Asep Kurniawan"
                  value={formData.lecturer}
                  onChange={(e) => setFormData({ ...formData, lecturer: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label">Bobot SKS</label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  className="input"
                  value={formData.sks}
                  onChange={(e) => setFormData({ ...formData, sks: Number(e.target.value) })}
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={saving}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? "Menyimpan..." : "Simpan Jadwal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Hapus Slot Jadwal"
        description={`Apakah Anda yakin ingin menghapus jadwal "${deleteTarget?.subject}" (${deleteTarget?.day}, ${deleteTarget?.start_time} - ${deleteTarget?.end_time})? Mahasiswa tidak akan lagi dapat membuka pintu di slot waktu ini.`}
        confirmText="Hapus Jadwal"
        cancelText="Batal"
        tone="danger"
        loading={deleting}
      />
    </>
  );
}
