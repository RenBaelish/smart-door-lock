"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import ConfirmDialog from "@/components/ConfirmDialog";
import Icon from "@/components/Icon";
import PageHeader from "@/components/PageHeader";
import Webcam, { type WebcamHandle } from "@/components/Webcam";
import { API_BASE, api, errorMessage, type ClassSchedule, type User } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

type Notice = { type: "success" | "error"; text: string } | null;

const DEFAULT_CLASSES = [
  "TMJ 5C",
  "TMJ-CCIT 1A",
  "TI 1B",
  "TI 3A",
  "TI 3B",
  "TI 3C",
  "TMD 1A",
  "TMD 1B",
  "TMD 3A",
  "TMD 3B",
  "TMD 3C",
];

const PRODI_OPTIONS = [
  { value: "Teknik Informatika", label: "Teknik Informatika (TI)" },
  { value: "Teknik Multimedia dan Jaringan", label: "Teknik Multimedia dan Jaringan (TMJ)" },
  { value: "Teknik Multimedia Digital", label: "Teknik Multimedia dan Digital (TMD)" },
];

const JURUSAN_OPTIONS = [
  { value: "Teknik Informatika dan Komputer", label: "Teknik Informatika dan Komputer" },
];

export default function MahasiswaView() {
  const [students, setStudents] = useState<User[]>([]);
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  // Form states for adding Mahasiswa (no pre-filled default for kelas and prodi)
  const [name, setName] = useState("");
  const [nim, setNim] = useState("");
  const [kelas, setKelas] = useState("");
  const [prodi, setProdi] = useState("");
  const [jurusan, setJurusan] = useState("Teknik Informatika dan Komputer");
  const [submitting, setSubmitting] = useState(false);

  // Filter & Search
  const [activeTab, setActiveTab] = useState<"all" | "with_face" | "no_face">("all");
  const [kelasFilter, setKelasFilter] = useState<string>("Semua");
  const [search, setSearch] = useState("");

  // Edit / Detail Dialog state
  const [editingStudent, setEditingStudent] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editNim, setEditNim] = useState("");
  const [editKelas, setEditKelas] = useState("");
  const [editProdi, setEditProdi] = useState("");
  const [editJurusan, setEditJurusan] = useState("Teknik Informatika dan Komputer");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isResettingFace, setIsResettingFace] = useState(false);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [imageCacheBuster, setImageCacheBuster] = useState(0);

  // Inline Webcam capture inside Edit Dialog
  const webcamRef = useRef<WebcamHandle>(null);
  const [cameraOpenInDialog, setCameraOpenInDialog] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isCapturingFace, setIsCapturingFace] = useState(false);
  const [dialogMessage, setDialogMessage] = useState<Notice>(null);

  // Delete state
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [uData, sData] = await Promise.all([
        api.users({ role: "mahasiswa" }),
        api.schedules().catch(() => []),
      ]);
      setStudents(uData);
      setSchedules(sData);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const availableClasses = Array.from(
    new Set([
      ...DEFAULT_CLASSES,
      ...schedules.map((s) => s.kelas).filter(Boolean),
      ...students.map((u) => u.kelas || "").filter(Boolean),
    ])
  ).sort();

  const openEditDialog = (student: User) => {
    setEditingStudent(student);
    setEditName(student.name || "");
    setEditNim(student.nim || "");
    setEditKelas(student.kelas || "");
    setEditProdi(student.prodi || "");
    setEditJurusan(student.jurusan || "Teknik Informatika dan Komputer");
    setImageLoadFailed(false);
    setImageCacheBuster(Date.now());
    setCameraOpenInDialog(false);
    setCameraReady(false);
    setDialogMessage(null);
  };

  const closeEditDialog = () => {
    setCameraOpenInDialog(false);
    setEditingStudent(null);
    setDialogMessage(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setNotice({ type: "error", text: "Nama lengkap mahasiswa wajib diisi." });
      return;
    }
    if (!kelas.trim()) {
      setNotice({ type: "error", text: "Silakan pilih Kelas Akademik terlebih dahulu." });
      return;
    }
    if (!prodi.trim()) {
      setNotice({ type: "error", text: "Silakan pilih Program Studi terlebih dahulu." });
      return;
    }

    setSubmitting(true);
    setNotice(null);

    try {
      const newStudent = await api.createUser({
        name: cleanName,
        role: "mahasiswa",
        nim: nim.trim() || undefined,
        kelas: kelas.trim(),
        prodi: prodi.trim(),
        jurusan: jurusan.trim() || "Teknik Informatika dan Komputer",
      });

      setNotice({
        type: "success",
        text: `Data Mahasiswa "${newStudent.name}" (Kelas ${newStudent.kelas || "-"}) berhasil ditambahkan. Silakan klik tombol "Detail / Edit" atau "Rekam Wajah" untuk mendaftarkan biometrik wajahnya.`,
      });

      setName("");
      setNim("");
      setKelas("");
      setProdi("");
      setJurusan("Teknik Informatika dan Komputer");
      loadData();
    } catch (err) {
      setNotice({ type: "error", text: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingStudent) return;
    const cleanName = editName.trim();
    if (!cleanName) {
      setDialogMessage({ type: "error", text: "Nama lengkap mahasiswa wajib diisi." });
      return;
    }

    setIsSavingEdit(true);
    setDialogMessage(null);
    try {
      const updated = await api.updateUser(editingStudent.id, {
        name: cleanName,
        nim: editNim.trim(),
        kelas: editKelas.trim(),
        prodi: editProdi.trim(),
        jurusan: editJurusan.trim() || "Teknik Informatika dan Komputer",
      });
      setEditingStudent(updated);
      setStudents((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setDialogMessage({ type: "success", text: "Biodata mahasiswa berhasil diperbarui." });
      setNotice({ type: "success", text: `Data mahasiswa "${updated.name}" berhasil diperbarui.` });
    } catch (err) {
      setDialogMessage({ type: "error", text: errorMessage(err) });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleResetFace = async () => {
    if (!editingStudent) return;
    setIsResettingFace(true);
    setDialogMessage(null);
    try {
      const updated = await api.resetUserFace(editingStudent.id);
      setEditingStudent(updated);
      setStudents((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setImageLoadFailed(true);
      setDialogMessage({
        type: "success",
        text: "Capture wajah mahasiswa berhasil di-reset. Status kembali menjadi Belum Rekam.",
      });
      setNotice({
        type: "success",
        text: `Rekaman wajah "${updated.name}" berhasil di-reset.`,
      });
    } catch (err) {
      setDialogMessage({ type: "error", text: errorMessage(err) });
    } finally {
      setIsResettingFace(false);
    }
  };

  const handleCaptureFaceInDialog = async () => {
    if (!editingStudent) return;
    const frame = await webcamRef.current?.capture();
    if (!frame) {
      setDialogMessage({ type: "error", text: "Gagal mengambil frame dari kamera." });
      return;
    }

    setIsCapturingFace(true);
    setDialogMessage(null);
    try {
      const updated = await api.register({
        userId: editingStudent.id,
        name: editName.trim() || editingStudent.name,
        role: "mahasiswa",
        nim: editNim.trim() || editingStudent.nim || undefined,
        kelas: editKelas.trim() || editingStudent.kelas || undefined,
        prodi: editProdi.trim() || editingStudent.prodi || undefined,
        jurusan: editJurusan.trim() || editingStudent.jurusan || undefined,
        image: frame.blob,
      });
      setEditingStudent(updated);
      setStudents((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setImageLoadFailed(false);
      setImageCacheBuster(Date.now());
      setCameraOpenInDialog(false);
      setDialogMessage({
        type: "success",
        text: `Capture wajah "${updated.name}" berhasil diperbarui (${updated.faces_detected} wajah terdeteksi).`,
      });
      setNotice({
        type: "success",
        text: `Wajah mahasiswa "${updated.name}" berhasil direkam.`,
      });
    } catch (err) {
      setDialogMessage({ type: "error", text: errorMessage(err) });
    } finally {
      setIsCapturingFace(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteUser(userToDelete.id);
      setStudents((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setNotice({ type: "success", text: `Data mahasiswa "${userToDelete.name}" berhasil dihapus.` });
      setUserToDelete(null);
    } catch (err) {
      setNotice({ type: "error", text: errorMessage(err) });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredStudents = students.filter((u) => {
    if (activeTab === "with_face" && !u.has_face) return false;
    if (activeTab === "no_face" && u.has_face) return false;
    if (kelasFilter !== "Semua" && (u.kelas || "") !== kelasFilter) return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      (u.nim && u.nim.toLowerCase().includes(q)) ||
      (u.kelas && u.kelas.toLowerCase().includes(q)) ||
      (u.prodi && u.prodi.toLowerCase().includes(q))
    );
  });

  const totalStudents = students.length;
  const totalWithFace = students.filter((u) => u.has_face).length;
  const totalPendingFace = students.filter((u) => !u.has_face).length;

  return (
    <>
      <PageHeader
        title="Manajemen Data Mahasiswa"
        description="Kelola biodata akademik mahasiswa (Nama, NIM, Kelas, Prodi) untuk validasi jadwal perkuliahan pada ruang kelas GSG 210 & GSG 211. Mahasiswa hanya dapat membuka kunci pintu apabila kelasnya sedang memiliki jadwal aktif di ruangan tersebut."
        actions={
          <Link href="/register" className="btn btn-primary">
            <Icon name="camera" className="h-4 w-4" />
            Ke Pendaftaran Wajah
          </Link>
        }
      />

      {/* Stats Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Mahasiswa</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{totalStudents}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Terdaftar di database akademik</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
            <Icon name="academicCap" className="h-5 w-5" />
          </div>
        </div>

        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Sudah Rekam Wajah</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600 tabular-nums">{totalWithFace}</p>
            <p className="text-[11px] text-emerald-600/80 mt-0.5">Siap verifikasi di GSG 210 & 211</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <Icon name="check" className="h-5 w-5" />
          </div>
        </div>

        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Belum Rekam Wajah</p>
            <p className="mt-1 text-2xl font-bold text-amber-600 tabular-nums">{totalPendingFace}</p>
            <p className="text-[11px] text-amber-600/80 mt-0.5">Menunggu pendaftaran foto wajah</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <Icon name="camera" className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Global Alerts */}
      {notice && (
        <div
          role="alert"
          className={`alert mb-6 flex items-start justify-between gap-3 ${
            notice.type === "success" ? "alert-success" : "alert-error"
          }`}
        >
          <div className="flex items-center gap-2">
            <Icon name={notice.type === "success" ? "check" : "alertTriangle"} className="h-5 w-5 shrink-0" />
            <span>{notice.text}</span>
          </div>
          <button
            type="button"
            className="text-xs font-semibold opacity-70 hover:opacity-100"
            onClick={() => setNotice(null)}
          >
            Tutup
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="alert alert-error mb-6 flex items-center gap-2">
          <Icon name="alertTriangle" className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Two-Column Layout: LEFT = Daftar Mahasiswa (2 cols), RIGHT = Tambah Data Mahasiswa (1 col) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
        {/* Students Table Card (LEFT - 2 cols) */}
        <section className="card lg:col-span-2" aria-labelledby="table-mhs-heading">
          <div className="card-header flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="table-mhs-heading" className="card-title">Daftar Mahasiswa Terdaftar</h2>
              <p className="card-subtitle">
                Menampilkan {filteredStudents.length} dari {students.length} mahasiswa • Klik &ldquo;Detail / Edit&rdquo; untuk melihat foto wajah atau mengubah data
              </p>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="border-b border-primary-100 bg-slate-50/50 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: "all", label: `Semua (${totalStudents})` },
                  { id: "with_face", label: `Sudah Rekam Wajah (${totalWithFace})` },
                  { id: "no_face", label: `Belum Rekam Wajah (${totalPendingFace})` },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id as typeof activeTab)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                      activeTab === t.id
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <select
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                value={kelasFilter}
                onChange={(e) => setKelasFilter(e.target.value)}
              >
                <option value="Semua">Semua Kelas</option>
                {availableClasses.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Icon
                name="search"
                className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                type="search"
                placeholder="Cari mahasiswa berdasarkan nama, NIM, atau kelas..."
                className="input pl-9 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading && students.length === 0 ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-md bg-slate-100" />
                ))}
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Icon name="academicCap" className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">Tidak ada data mahasiswa</p>
                <p className="mt-1 text-xs text-slate-500 max-w-xs">
                  Silakan tambahkan biodata mahasiswa baru melalui formulir di sebelah kanan.
                </p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="th">Nama & NIM</th>
                    <th className="th">Kelas</th>
                    <th className="th">Program Studi</th>
                    <th className="th">Status Wajah</th>
                    <th className="th text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredStudents.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="td">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-800 text-xs font-bold">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{u.name}</p>
                            <p className="font-mono text-[11px] text-slate-500">NIM: {u.nim || "-"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="td">
                        <span className="rounded bg-secondary-50 border border-secondary-200 px-2 py-0.5 font-semibold text-xs text-slate-900">
                          {u.kelas || "-"}
                        </span>
                      </td>
                      <td className="td text-xs text-slate-600">
                        <p className="font-medium text-slate-800">{u.prodi || "-"}</p>
                        <p className="text-[11px] text-slate-400">{formatDateTime(u.created_at)}</p>
                      </td>
                      <td className="td">
                        {u.has_face ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            <Icon name="check" className="h-3.5 w-3.5" />
                            Terdaftar
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                            <Icon name="clock" className="h-3.5 w-3.5" />
                            Belum Rekam
                          </span>
                        )}
                      </td>
                      <td className="td text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditDialog(u)}
                            className="btn btn-sm btn-secondary text-xs py-1 px-2.5"
                          >
                            <Icon name="info" className="h-3.5 w-3.5" />
                            Detail / Edit
                          </button>
                          <Link
                            href={`/register?userId=${u.id}`}
                            className={`btn btn-sm text-xs py-1 px-2.5 ${
                              u.has_face ? "btn-secondary" : "btn-accent"
                            }`}
                          >
                            <Icon name="camera" className="h-3.5 w-3.5" />
                            {u.has_face ? "Update Wajah" : "Rekam Wajah"}
                          </Link>
                          <button
                            type="button"
                            onClick={() => setUserToDelete(u)}
                            className="btn btn-sm btn-danger px-2 py-1 text-xs"
                            title={`Hapus ${u.name}`}
                          >
                            <Icon name="trash" className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Form Card (RIGHT - 1 col) */}
        <section className="card lg:col-span-1" aria-labelledby="form-mhs-heading">
          <div className="card-header">
            <div>
              <h2 id="form-mhs-heading" className="card-title">Tambah Data Mahasiswa</h2>
              <p className="card-subtitle">Input biodata mahasiswa sebelum rekam wajah</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
              Mahasiswa
            </span>
          </div>

          <form onSubmit={handleSubmit} className="card-body space-y-4">
            <div>
              <label htmlFor="mhs-name" className="label">
                Nama Lengkap Mahasiswa *
              </label>
              <input
                id="mhs-name"
                type="text"
                maxLength={100}
                placeholder="Contoh: Muhammad Farhan"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                required
              />
            </div>

            <div>
              <label htmlFor="mhs-nim" className="label">
                Nomor Induk Mahasiswa (NIM) *
              </label>
              <input
                id="mhs-nim"
                type="text"
                maxLength={30}
                placeholder="Contoh: 2407421059"
                className="input font-mono"
                value={nim}
                onChange={(e) => setNim(e.target.value)}
                disabled={submitting}
                required
              />
            </div>

            <div>
              <label htmlFor="mhs-kelas-select" className="label">
                Kelas Akademik (Terhubung Jadwal GSG 210/211) *
              </label>
              <select
                id="mhs-kelas-select"
                className="input"
                value={kelas}
                onChange={(e) => setKelas(e.target.value)}
                disabled={submitting}
                required
              >
                <option value="">-- Pilih Kelas Jadwal GSG 210 / 211 --</option>
                {availableClasses.map((k) => (
                  <option key={k} value={k}>
                    Kelas {k}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="mhs-prodi" className="label">
                Program Studi *
              </label>
              <select
                id="mhs-prodi"
                className="input"
                value={prodi}
                onChange={(e) => setProdi(e.target.value)}
                disabled={submitting}
                required
              >
                <option value="">-- Pilih Program Studi --</option>
                {PRODI_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="mhs-jurusan" className="label">
                Jurusan *
              </label>
              <select
                id="mhs-jurusan"
                className="input"
                value={jurusan}
                onChange={(e) => setJurusan(e.target.value)}
                disabled={submitting}
                required
              >
                {JURUSAN_OPTIONS.map((j) => (
                  <option key={j.value} value={j.value}>
                    {j.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              id="submit-mhs-btn"
              type="submit"
              className="btn btn-primary w-full mt-2"
              disabled={submitting}
            >
              <Icon name="userPlus" className="h-4 w-4" />
              {submitting ? "Menyimpan..." : "Simpan Data Mahasiswa"}
            </button>
          </form>
        </section>
      </div>

      {/* Modal Dialog: Detail / Edit Mahasiswa & Face Capture Preview/Update/Reset */}
      {editingStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-mhs-modal-title"
        >
          <div
            className="fixed inset-0"
            onClick={() => !isSavingEdit && !isCapturingFace && closeEditDialog()}
          />
          <div className="relative z-10 w-full max-w-2xl rounded-xl bg-white shadow-xl border border-slate-200 overflow-hidden my-8">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div>
                <h3 id="edit-mhs-modal-title" className="text-base font-bold text-slate-900">
                  Detail & Edit Data Mahasiswa
                </h3>
                <p className="text-xs text-slate-500">
                  ID #{editingStudent.id} • Terdaftar {formatDateTime(editingStudent.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditDialog}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
              >
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 max-h-[82vh] overflow-y-auto space-y-5">
              {dialogMessage && (
                <div
                  className={`alert flex items-center gap-2 text-xs ${
                    dialogMessage.type === "success" ? "alert-success" : "alert-error"
                  }`}
                >
                  <Icon
                    name={dialogMessage.type === "success" ? "check" : "alertTriangle"}
                    className="h-4 w-4 shrink-0"
                  />
                  <span>{dialogMessage.text}</span>
                </div>
              )}

              {/* Section 1: Current Face Capture Preview & Update/Reset Controls */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="relative h-24 w-24 shrink-0 rounded-xl overflow-hidden border border-slate-300 bg-white flex items-center justify-center shadow-xs">
                      {editingStudent.has_face && !imageLoadFailed ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${API_BASE}/api/users/${editingStudent.id}/image?t=${imageCacheBuster}`}
                          alt={`Foto wajah ${editingStudent.name}`}
                          className="h-full w-full object-cover"
                          onError={() => setImageLoadFailed(true)}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center p-2 text-slate-400">
                          <Icon name="camera" className="h-7 w-7 mb-1" />
                          <span className="text-[10px] font-medium leading-tight">
                            {editingStudent.has_face ? "Embedding Tersimpan" : "Belum Ada Foto"}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">Status Biometrik Wajah:</span>
                        {editingStudent.has_face ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            <Icon name="check" className="h-3.5 w-3.5" />
                            Sudah Rekam Wajah
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                            <Icon name="clock" className="h-3.5 w-3.5" />
                            Belum Rekam Wajah
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500 max-w-sm">
                        {editingStudent.has_face
                          ? "Vektor 128-D wajah telah tersimpan. Anda dapat mengupdate foto wajah langsung di bawah ini atau me-reset rekaman wajah."
                          : "Mahasiswa ini belum memiliki rekaman wajah. Klik tombol Ambil / Update Capture Wajah di bawah untuk merekam."}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap sm:flex-col gap-2 w-full sm:w-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => setCameraOpenInDialog((prev) => !prev)}
                      className="btn btn-sm btn-primary text-xs justify-center"
                    >
                      <Icon name="camera" className="h-3.5 w-3.5" />
                      {cameraOpenInDialog
                        ? "Tutup Kamera"
                        : editingStudent.has_face
                        ? "Update Capture Wajah"
                        : "Ambil Capture Wajah"}
                    </button>

                    {editingStudent.has_face && (
                      <button
                        type="button"
                        onClick={handleResetFace}
                        disabled={isResettingFace}
                        className="btn btn-sm btn-danger text-xs justify-center"
                      >
                        <Icon name="refresh" className="h-3.5 w-3.5" />
                        {isResettingFace ? "Me-reset..." : "Reset Capture Wajah"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Webcam Capture Box inside Modal */}
                {cameraOpenInDialog && (
                  <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-800">
                        Ambil Foto Wajah Baru ({editingStudent.name})
                      </p>
                      <Link
                        href={`/register?userId=${editingStudent.id}`}
                        className="text-xs font-semibold text-sky-600 hover:underline"
                      >
                        Buka di Halaman Penuh Pendaftaran &rarr;
                      </Link>
                    </div>
                    <Webcam
                      ref={webcamRef}
                      active={cameraOpenInDialog}
                      onReadyChange={setCameraReady}
                      inactiveLabel="Kamera belum aktif"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setCameraOpenInDialog(false)}
                        className="btn btn-sm btn-secondary text-xs"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleCaptureFaceInDialog}
                        disabled={!cameraReady || isCapturingFace}
                        className="btn btn-sm btn-accent text-xs"
                      >
                        <Icon name="camera" className="h-3.5 w-3.5" />
                        {isCapturingFace ? "Memproses Wajah..." : "Tangkap & Simpan Wajah"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Edit Metadata Form */}
              <form id="edit-mhs-form" onSubmit={handleSaveEdit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="edit-mhs-name" className="label">
                      Nama Lengkap Mahasiswa *
                    </label>
                    <input
                      id="edit-mhs-name"
                      type="text"
                      maxLength={100}
                      className="input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="edit-mhs-nim" className="label">
                      Nomor Induk Mahasiswa (NIM) *
                    </label>
                    <input
                      id="edit-mhs-nim"
                      type="text"
                      maxLength={30}
                      className="input font-mono"
                      value={editNim}
                      onChange={(e) => setEditNim(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="edit-mhs-kelas" className="label">
                      Kelas Akademik *
                    </label>
                    <select
                      id="edit-mhs-kelas"
                      className="input"
                      value={editKelas}
                      onChange={(e) => setEditKelas(e.target.value)}
                      required
                    >
                      <option value="">-- Pilih Kelas --</option>
                      {availableClasses.map((k) => (
                        <option key={k} value={k}>
                          Kelas {k}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="edit-mhs-prodi" className="label">
                      Program Studi *
                    </label>
                    <select
                      id="edit-mhs-prodi"
                      className="input"
                      value={editProdi}
                      onChange={(e) => setEditProdi(e.target.value)}
                      required
                    >
                      <option value="">-- Pilih Program Studi --</option>
                      {PRODI_OPTIONS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="edit-mhs-jurusan" className="label">
                      Jurusan *
                    </label>
                    <select
                      id="edit-mhs-jurusan"
                      className="input"
                      value={editJurusan}
                      onChange={(e) => setEditJurusan(e.target.value)}
                      required
                    >
                      {JURUSAN_OPTIONS.map((j) => (
                        <option key={j.value} value={j.value}>
                          {j.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={closeEditDialog}
                    className="btn btn-secondary text-xs"
                    disabled={isSavingEdit}
                  >
                    Tutup
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary text-xs"
                    disabled={isSavingEdit}
                  >
                    <Icon name="check" className="h-4 w-4" />
                    {isSavingEdit ? "Menyimpan..." : "Simpan Perubahan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(userToDelete)}
        title="Hapus Data Mahasiswa"
        message={
          userToDelete
            ? `Apakah Anda yakin ingin menghapus mahasiswa "${userToDelete.name}" (NIM: ${userToDelete.nim || "-"}) beserta data biometrik wajahnya?`
            : ""
        }
        confirmLabel="Ya, Hapus"
        cancelLabel="Batal"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setUserToDelete(null)}
      />
    </>
  );
}
