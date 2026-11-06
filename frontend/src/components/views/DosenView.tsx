"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import ConfirmDialog from "@/components/ConfirmDialog";
import Icon from "@/components/Icon";
import PageHeader from "@/components/PageHeader";
import Webcam, { type WebcamHandle } from "@/components/Webcam";
import { API_BASE, api, errorMessage, type LecturerInfo, type User } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

type Notice = { type: "success" | "error"; text: string } | null;

export default function DosenView() {
  const [dosenList, setDosenList] = useState<User[]>([]);
  const [gsgLecturers, setGsgLecturers] = useState<LecturerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  // Form states for adding Dosen
  const [name, setName] = useState("");
  const [nim, setNim] = useState(""); // NIP / NIDN
  const [kelas, setKelas] = useState("GSG210, GSG211"); // Kelas / Ruangan diampu
  const [submitting, setSubmitting] = useState(false);

  // Filter & Search
  const [activeTab, setActiveTab] = useState<"all" | "with_face" | "no_face">("all");
  const [search, setSearch] = useState("");

  // Edit / Detail Dialog state
  const [editingDosen, setEditingDosen] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editNim, setEditNim] = useState("");
  const [editKelas, setEditKelas] = useState("");
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
      const [uData, lData] = await Promise.all([
        api.users({ role: "dosen" }),
        api.lecturers().catch(() => []),
      ]);
      setDosenList(uData);
      setGsgLecturers(lData);
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

  const openEditDialog = (dosen: User) => {
    setEditingDosen(dosen);
    setEditName(dosen.name || "");
    setEditNim(dosen.nim || "");
    setEditKelas(dosen.kelas || "GSG210, GSG211");
    setImageLoadFailed(false);
    setImageCacheBuster(Date.now());
    setCameraOpenInDialog(false);
    setCameraReady(false);
    setDialogMessage(null);
  };

  const closeEditDialog = () => {
    setCameraOpenInDialog(false);
    setEditingDosen(null);
    setDialogMessage(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setNotice({ type: "error", text: "Nama lengkap dosen wajib diisi." });
      return;
    }

    setSubmitting(true);
    setNotice(null);

    try {
      const newDosen = await api.createUser({
        name: cleanName,
        role: "dosen",
        nim: nim.trim() || undefined,
        kelas: kelas.trim() || "GSG210, GSG211",
      });

      setNotice({
        type: "success",
        text: `Data Dosen "${newDosen.name}" berhasil disimpan. Silakan klik tombol "Detail / Edit" atau "Rekam Wajah" pada tabel di samping untuk mendaftarkan biometrik wajahnya.`,
      });

      setName("");
      setNim("");
      setKelas("GSG210, GSG211");
      loadData();
    } catch (err) {
      setNotice({ type: "error", text: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingDosen) return;
    const cleanName = editName.trim();
    if (!cleanName) {
      setDialogMessage({ type: "error", text: "Nama lengkap dosen wajib diisi." });
      return;
    }

    setIsSavingEdit(true);
    setDialogMessage(null);
    try {
      const updated = await api.updateUser(editingDosen.id, {
        name: cleanName,
        nim: editNim.trim(),
        kelas: editKelas.trim() || "GSG210, GSG211",
      });
      setEditingDosen(updated);
      setDosenList((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setDialogMessage({ type: "success", text: "Biodata dosen berhasil diperbarui." });
      setNotice({ type: "success", text: `Data dosen "${updated.name}" berhasil diperbarui.` });
    } catch (err) {
      setDialogMessage({ type: "error", text: errorMessage(err) });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleResetFace = async () => {
    if (!editingDosen) return;
    setIsResettingFace(true);
    setDialogMessage(null);
    try {
      const updated = await api.resetUserFace(editingDosen.id);
      setEditingDosen(updated);
      setDosenList((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setImageLoadFailed(true);
      setDialogMessage({
        type: "success",
        text: "Capture wajah dosen berhasil di-reset. Status kembali menjadi Belum Rekam.",
      });
      setNotice({
        type: "success",
        text: `Rekaman wajah dosen "${updated.name}" berhasil di-reset.`,
      });
    } catch (err) {
      setDialogMessage({ type: "error", text: errorMessage(err) });
    } finally {
      setIsResettingFace(false);
    }
  };

  const handleCaptureFaceInDialog = async () => {
    if (!editingDosen) return;
    const frame = await webcamRef.current?.capture();
    if (!frame) {
      setDialogMessage({ type: "error", text: "Gagal mengambil frame dari kamera." });
      return;
    }

    setIsCapturingFace(true);
    setDialogMessage(null);
    try {
      const updated = await api.register({
        userId: editingDosen.id,
        name: editName.trim() || editingDosen.name,
        role: "dosen",
        nim: editNim.trim() || editingDosen.nim || undefined,
        kelas: editKelas.trim() || editingDosen.kelas || undefined,
        image: frame.blob,
      });
      setEditingDosen(updated);
      setDosenList((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setImageLoadFailed(false);
      setImageCacheBuster(Date.now());
      setCameraOpenInDialog(false);
      setDialogMessage({
        type: "success",
        text: `Capture wajah dosen "${updated.name}" berhasil diperbarui (${updated.faces_detected} wajah terdeteksi).`,
      });
      setNotice({
        type: "success",
        text: `Wajah dosen "${updated.name}" berhasil direkam.`,
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
      setDosenList((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setNotice({ type: "success", text: `Data dosen "${userToDelete.name}" berhasil dihapus.` });
      setUserToDelete(null);
    } catch (err) {
      setNotice({ type: "error", text: errorMessage(err) });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredDosen = dosenList.filter((u) => {
    if (activeTab === "with_face" && !u.has_face) return false;
    if (activeTab === "no_face" && u.has_face) return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      (u.nim && u.nim.toLowerCase().includes(q)) ||
      (u.kelas && u.kelas.toLowerCase().includes(q))
    );
  });

  const totalDosen = dosenList.length;
  const totalWithFace = dosenList.filter((u) => u.has_face).length;
  const totalPendingFace = dosenList.filter((u) => !u.has_face).length;

  return (
    <>
      <PageHeader
        title="Manajemen Data Dosen"
        description="Kelola biodata dosen pengampu pada ruang kelas GSG 210 & GSG 211. Seluruh dosen dari jadwal GSG 210 & 211 otomatis terdaftar di tabel dan siap dilengkapi NIP serta direkam wajahnya untuk hak akses prioritas pintu."
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
            <p className="text-xs font-medium text-slate-500">Total Dosen Terdaftar</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{totalDosen}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Terintegrasi jadwal GSG 210 & 211 ({gsgLecturers.length} dosen)</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <Icon name="shield" className="h-5 w-5" />
          </div>
        </div>

        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Sudah Rekam Wajah</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600 tabular-nums">{totalWithFace}</p>
            <p className="text-[11px] text-emerald-600/80 mt-0.5">Akses prioritas pintu aktif</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <Icon name="check" className="h-5 w-5" />
          </div>
        </div>

        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Belum Rekam Wajah</p>
            <p className="mt-1 text-2xl font-bold text-amber-600 tabular-nums">{totalPendingFace}</p>
            <p className="text-[11px] text-amber-600/80 mt-0.5">Menunggu kelengkapan NIP / foto wajah</p>
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

      {/* Main Two-Column Layout: LEFT = Daftar Dosen Pengampu (2 cols), RIGHT = Tambah Data Dosen (1 col) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
        {/* Dosen Table Card (LEFT - 2 cols) */}
        <section className="card lg:col-span-2" aria-labelledby="table-dosen-heading">
          <div className="card-header flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="table-dosen-heading" className="card-title">Daftar Dosen Pengampu</h2>
              <p className="card-subtitle">
                Menampilkan {filteredDosen.length} dari {dosenList.length} dosen terdaftar • Klik &ldquo;Detail / Edit&rdquo; untuk melengkapi NIP atau merekam wajah
              </p>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="border-b border-primary-100 bg-slate-50/50 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: "all", label: `Semua (${totalDosen})` },
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

            <div className="relative">
              <Icon
                name="search"
                className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                type="search"
                placeholder="Cari dosen berdasarkan nama, NIP/NIDN, atau ruang/kelas..."
                className="input pl-9 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading && dosenList.length === 0 ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-md bg-slate-100" />
                ))}
              </div>
            ) : filteredDosen.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Icon name="shield" className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">Belum ada data dosen yang cocok</p>
                <p className="mt-1 text-xs text-slate-500 max-w-xs">
                  Ubah filter pencarian atau tambahkan dosen baru melalui formulir di sebelah kanan.
                </p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="th">Nama Dosen & NIP</th>
                    <th className="th">Ruang / Kelas Diampu</th>
                    <th className="th">Status Wajah</th>
                    <th className="th text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredDosen.map((u) => {
                    const lecScheduleInfo = gsgLecturers.find(
                      (l) => l.name.toLowerCase() === u.name.toLowerCase()
                    );
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="td">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{u.name}</p>
                              <p className="font-mono text-[11px] text-slate-500">
                                NIP: {u.nim ? u.nim : <span className="italic text-amber-600">Belum dilengkapi</span>}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="td">
                          <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 font-semibold text-xs text-emerald-900">
                            {u.kelas || "GSG210, GSG211"}
                          </span>
                          {lecScheduleInfo && lecScheduleInfo.subjects.length > 0 && (
                            <p className="text-[11px] text-slate-500 mt-1">
                              Matkul: {lecScheduleInfo.subjects.join(", ")}
                            </p>
                          )}
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
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Form Card (RIGHT - 1 col) */}
        <section className="card lg:col-span-1" aria-labelledby="form-dosen-heading">
          <div className="card-header">
            <div>
              <h2 id="form-dosen-heading" className="card-title">Tambah Data Dosen</h2>
              <p className="card-subtitle">Input dosen baru di luar daftar yang sudah ada</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              Dosen
            </span>
          </div>

          <form onSubmit={handleSubmit} className="card-body space-y-4">
            <div>
              <label htmlFor="dosen-name" className="label">
                Nama Lengkap & Gelar Dosen *
              </label>
              <input
                id="dosen-name"
                type="text"
                maxLength={100}
                placeholder="Contoh: Dr. Indra Hermawan, S.Kom., M.Kom."
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                required
              />
            </div>

            <div>
              <label htmlFor="dosen-nip" className="label">
                NIP / NIDN (Opsional)
              </label>
              <input
                id="dosen-nip"
                type="text"
                maxLength={30}
                placeholder="Contoh: 198703132019031012"
                className="input font-mono"
                value={nim}
                onChange={(e) => setNim(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div>
              <label htmlFor="dosen-kelas" className="label">
                Ruangan / Kelas yang Diampu
              </label>
              <input
                id="dosen-kelas"
                type="text"
                maxLength={30}
                placeholder="Contoh: GSG210, GSG211 (TMJ 5C)"
                className="input font-semibold"
                value={kelas}
                onChange={(e) => setKelas(e.target.value)}
                disabled={submitting}
              />
            </div>

            <button
              id="submit-dosen-btn"
              type="submit"
              className="btn btn-primary w-full mt-2"
              disabled={submitting}
            >
              <Icon name="userPlus" className="h-4 w-4" />
              {submitting ? "Menyimpan..." : "Simpan Data Dosen"}
            </button>
          </form>
        </section>
      </div>

      {/* Modal Dialog: Detail / Edit Dosen & Face Capture Preview/Update/Reset */}
      {editingDosen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-dosen-modal-title"
        >
          <div
            className="fixed inset-0"
            onClick={() => !isSavingEdit && !isCapturingFace && closeEditDialog()}
          />
          <div className="relative z-10 w-full max-w-2xl rounded-xl bg-white shadow-xl border border-slate-200 overflow-hidden my-8">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div>
                <h3 id="edit-dosen-modal-title" className="text-base font-bold text-slate-900">
                  Detail & Edit Data Dosen Pengampu
                </h3>
                <p className="text-xs text-slate-500">
                  ID #{editingDosen.id} • Terdaftar {formatDateTime(editingDosen.created_at)}
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
                      {editingDosen.has_face && !imageLoadFailed ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${API_BASE}/api/users/${editingDosen.id}/image?t=${imageCacheBuster}`}
                          alt={`Foto wajah ${editingDosen.name}`}
                          className="h-full w-full object-cover"
                          onError={() => setImageLoadFailed(true)}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center p-2 text-slate-400">
                          <Icon name="camera" className="h-7 w-7 mb-1" />
                          <span className="text-[10px] font-medium leading-tight">
                            {editingDosen.has_face ? "Embedding Tersimpan" : "Belum Ada Foto"}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">Status Biometrik Wajah:</span>
                        {editingDosen.has_face ? (
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
                        {editingDosen.has_face
                          ? "Vektor 128-D wajah dosen telah tersimpan. Anda dapat mengupdate foto wajah langsung di bawah ini atau me-reset rekaman wajah."
                          : "Dosen ini belum memiliki rekaman wajah. Klik tombol Ambil / Update Capture Wajah di bawah untuk merekam."}
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
                        : editingDosen.has_face
                        ? "Update Capture Wajah"
                        : "Ambil Capture Wajah"}
                    </button>

                    {editingDosen.has_face && (
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
                        Ambil Foto Wajah Baru ({editingDosen.name})
                      </p>
                      <Link
                        href={`/register?userId=${editingDosen.id}`}
                        className="text-xs font-semibold text-emerald-700 hover:underline"
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

              {/* Section 2: Edit Metadata Form (Tanpa Prodi & Jurusan) */}
              <form id="edit-dosen-form" onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label htmlFor="edit-dosen-name" className="label">
                    Nama Lengkap & Gelar Dosen *
                  </label>
                  <input
                    id="edit-dosen-name"
                    type="text"
                    maxLength={100}
                    className="input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="edit-dosen-nim" className="label">
                      NIP / NIDN
                    </label>
                    <input
                      id="edit-dosen-nim"
                      type="text"
                      maxLength={30}
                      placeholder="Masukkan NIP / NIDN dosen"
                      className="input font-mono"
                      value={editNim}
                      onChange={(e) => setEditNim(e.target.value)}
                    />
                  </div>

                  <div>
                    <label htmlFor="edit-dosen-kelas" className="label">
                      Ruangan / Kelas yang Diampu
                    </label>
                    <input
                      id="edit-dosen-kelas"
                      type="text"
                      maxLength={30}
                      placeholder="Contoh: GSG210, GSG211 (TMJ 5C)"
                      className="input font-semibold"
                      value={editKelas}
                      onChange={(e) => setEditKelas(e.target.value)}
                    />
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
        title="Hapus Data Dosen"
        description={
          userToDelete
            ? `Apakah Anda yakin ingin menghapus dosen "${userToDelete.name}" beserta data biometrik wajahnya?`
            : ""
        }
        confirmText="Ya, Hapus"
        cancelText="Batal"
        tone="danger"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setUserToDelete(null)}
      />
    </>
  );
}
