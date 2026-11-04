"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import Icon from "@/components/Icon";
import PageHeader from "@/components/PageHeader";
import Webcam, { type WebcamHandle } from "@/components/Webcam";
import { api, errorMessage, type LecturerInfo, type User } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

interface Captured {
  blob: Blob;
  url: string;
}

type Notice = { type: "success" | "error"; text: string } | null;

export default function RegisterView() {
  const searchParams = useSearchParams();
  const paramUserId = searchParams.get("userId");

  const webcamRef = useRef<WebcamHandle>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [captured, setCaptured] = useState<Captured | null>(null);

  // Selected User state (linking to existing user)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(
    paramUserId ? parseInt(paramUserId, 10) : null
  );

  const [role, setRole] = useState<"mahasiswa" | "dosen">("mahasiswa");
  const [name, setName] = useState("");
  const [nim, setNim] = useState("");
  const [kelas, setKelas] = useState("");
  const [prodi, setProdi] = useState("");
  const [jurusan, setJurusan] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [lecturers, setLecturers] = useState<LecturerInfo[]>([]);

  // Dialog confirmation states
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [isResetAllOpen, setIsResetAllOpen] = useState(false);
  const [isResettingAll, setIsResettingAll] = useState(false);

  // Release the preview object URL whenever it is replaced or unmounts
  useEffect(() => {
    if (!captured) return;
    return () => URL.revokeObjectURL(captured.url);
  }, [captured]);

  const loadUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const data = await api.users();
      setUsers(data.filter((u) => (u.role || "mahasiswa").toLowerCase() !== "admin"));
      setUsersError(null);
    } catch (err) {
      setUsersError(errorMessage(err));
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const loadLecturers = useCallback(async () => {
    try {
      const data = await api.lecturers();
      setLecturers(data);
    } catch {
      // Fallback
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadLecturers();
  }, [loadUsers, loadLecturers]);

  // If paramUserId changed or users loaded, auto-select user
  useEffect(() => {
    if (!users.length) return;
    const targetId = paramUserId ? parseInt(paramUserId, 10) : selectedUserId;
    if (targetId) {
      const found = users.find((u) => u.id === targetId);
      if (found) {
        setSelectedUserId(found.id);
        setName(found.name);
        setRole(found.role?.toLowerCase() === "dosen" ? "dosen" : "mahasiswa");
        setNim(found.nim || "");
        setKelas(found.kelas || "");
        setProdi(found.prodi || "");
        setJurusan(found.jurusan || "");
      }
    }
  }, [users, paramUserId, selectedUserId]);

  const handleSelectUser = (userIdStr: string) => {
    if (!userIdStr) {
      setSelectedUserId(null);
      setName("");
      setNim("");
      setKelas("");
      return;
    }
    const id = parseInt(userIdStr, 10);
    const found = users.find((u) => u.id === id);
    if (found) {
      setSelectedUserId(found.id);
      setName(found.name);
      setRole(found.role?.toLowerCase() === "dosen" ? "dosen" : "mahasiswa");
      setNim(found.nim || "");
      setKelas(found.kelas || "");
      setProdi(found.prodi || "");
      setJurusan(found.jurusan || "");
    }
  };

  const handleCapture = async () => {
    const frame = await webcamRef.current?.capture(800, 0.92);
    if (!frame) {
      setNotice({ type: "error", text: "Gagal mengambil foto. Pastikan kamera telah menyala dan memberikan izin akses." });
      return;
    }
    setCaptured({ blob: frame.blob, url: URL.createObjectURL(frame.blob) });
    setCameraOn(false);
    setNotice(null);
  };

  const handleRetake = () => {
    setCaptured(null);
    setCameraOn(true);
    setNotice(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNotice({ type: "error", text: "Silakan pilih pengguna atau masukkan nama lengkap pengguna." });
      return;
    }
    if (!captured) {
      setNotice({ type: "error", text: "Silakan ambil foto wajah terlebih dahulu sebelum mendaftar." });
      return;
    }

    setSubmitting(true);
    setNotice(null);
    try {
      const user = await api.register({
        userId: selectedUserId || undefined,
        name: trimmed,
        role: role,
        nim: nim.trim() || undefined,
        kelas: kelas.trim() || undefined,
        prodi: prodi.trim() || undefined,
        jurusan: jurusan.trim() || undefined,
        image: captured.blob,
      });
      const extra = user.faces_detected > 1 ? ` (${user.faces_detected} wajah terdeteksi; wajah terbesar yang disimpan).` : "";
      const roleLabel = role === "dosen" ? "Dosen/Guru" : "Mahasiswa/Siswa";
      setNotice({
        type: "success",
        text: `Foto wajah untuk ${roleLabel} "${user.name}" (ID #${user.id}) berhasil didaftarkan! Kunci pintu siap mengenali wajah.${extra}`,
      });
      setName("");
      setNim("");
      setKelas("");
      setProdi("");
      setJurusan("");
      setSelectedUserId(null);
      setCaptured(null);
      loadUsers();
    } catch (err) {
      setNotice({ type: "error", text: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      await api.deleteUser(userToDelete.id);
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      if (selectedUserId === userToDelete.id) {
        setSelectedUserId(null);
        setName("");
        setNim("");
      }
      setNotice({ type: "success", text: `Pengguna "${userToDelete.name}" berhasil dihapus dari sistem.` });
      setUserToDelete(null);
    } catch (err) {
      setNotice({ type: "error", text: errorMessage(err) });
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleConfirmResetAll = async () => {
    setIsResettingAll(true);
    try {
      await api.deleteAllUsers();
      setUsers([]);
      setSelectedUserId(null);
      setName("");
      setNotice({ type: "success", text: "Semua data pengguna berhasil di-reset (database kosong)." });
      setIsResetAllOpen(false);
    } catch (err) {
      setUsersError(errorMessage(err));
    } finally {
      setIsResettingAll(false);
    }
  };

  const pendingFaceUsers = users.filter((u) => !u.has_face);

  return (
    <>
      <PageHeader
        title="Pendaftaran Wajah & Akses Pintu Smart Classroom"
        description="Hubungkan foto biometrik wajah ke data civitas akademika (Mahasiswa / Dosen). Pastikan wajah tegak menghadap kamera dengan pencahayaan terang."
      />

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

      {/* Responsive Two-Column Grid: Camera Card (Left) and Data Pengguna Card (Right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-start mb-8">
        {/* Face Capture Card */}
        <section className="card" aria-labelledby="capture-heading">
          <div className="card-header">
            <div>
              <h2 id="capture-heading" className="card-title">Pengambilan Foto Wajah</h2>
              <p className="card-subtitle">Posisikan wajah tepat di area pemindaian kamera</p>
            </div>
            {cameraOn && cameraReady && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                Kamera Aktif
              </span>
            )}
          </div>

          <div className="card-body space-y-4">
            <div className="relative">
              <Webcam
                ref={webcamRef}
                active={cameraOn}
                onReadyChange={setCameraReady}
                inactiveLabel={captured ? "" : "Kamera mati. Klik tombol Nyalakan Kamera untuk memulai."}
              >
                <div className="absolute left-1/2 top-1/2 h-[72%] w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-dashed border-white/60 pointer-events-none shadow-sm" />
              </Webcam>

              {captured && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={captured.url}
                  alt="Pratinjau foto wajah"
                  className="absolute inset-0 h-full w-full rounded-md bg-slate-950 object-contain shadow-inner"
                  style={{ transform: "scaleX(-1)" }}
                />
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {!captured && !cameraOn && (
                <button
                  id="register-start-camera"
                  type="button"
                  className="btn btn-dark"
                  onClick={() => setCameraOn(true)}
                >
                  <Icon name="play" className="h-4 w-4" />
                  Nyalakan Kamera
                </button>
              )}

              {!captured && cameraOn && (
                <>
                  <button
                    id="register-capture"
                    type="button"
                    className="btn btn-primary"
                    onClick={handleCapture}
                    disabled={!cameraReady}
                  >
                    <Icon name="camera" className="h-4 w-4" />
                    Ambil Foto Wajah
                  </button>
                  <button
                    id="register-stop-camera"
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setCameraOn(false)}
                  >
                    <Icon name="stop" className="h-4 w-4" />
                    Matikan Kamera
                  </button>
                </>
              )}

              {captured && (
                <button
                  id="register-retake"
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleRetake}
                  disabled={submitting}
                >
                  <Icon name="refresh" className="h-4 w-4" />
                  Ambil Ulang Foto
                </button>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800">Petunjuk Pengambilan Foto Wajah:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-500">
                <li>Pastikan wajah berada di dalam garis panduan elips.</li>
                <li>Gunakan pencahayaan ruangan yang cukup dan hindari backlight.</li>
                <li>Hanya satu orang yang boleh berada di depan kamera.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* User Details Card */}
        <section className="card" aria-labelledby="details-heading">
          <div className="card-header">
            <div>
              <h2 id="details-heading" className="card-title">Data Pengguna & Hak Akses</h2>
              <p className="card-subtitle">Pilih pengguna yang sudah didaftarkan atau masukkan data baru</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Link href="/mahasiswa" className="btn btn-sm btn-secondary text-xs">
                <Icon name="academicCap" className="h-3.5 w-3.5" />
                Data Mahasiswa
              </Link>
              <Link href="/dosen" className="btn btn-sm btn-secondary text-xs">
                <Icon name="shield" className="h-3.5 w-3.5" />
                Data Dosen
              </Link>
            </div>
          </div>

          <form className="card-body space-y-4" onSubmit={handleSubmit} noValidate>
            {/* Quick Select from Unregistered Faces */}
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="user-select-preset" className="block text-xs font-bold text-amber-900">
                  Pilih Pengguna yang Belum Rekam Wajah:
                </label>
                <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
                  {pendingFaceUsers.length} Menunggu Foto
                </span>
              </div>
              <select
                id="user-select-preset"
                className="input text-xs bg-white text-slate-800 font-medium"
                value={selectedUserId ?? ""}
                onChange={(e) => handleSelectUser(e.target.value)}
              >
                <option value="">-- Pilih Mahasiswa / Dosen yang Belum Rekam Wajah --</option>
                {pendingFaceUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role === "dosen" ? "Dosen" : "Mhs"} • {u.kelas || "Tanpa Kelas"} • NIM: {u.nim || "-"})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-amber-800">
                Memilih nama dari daftar otomatis mengisi seluruh data identitas di bawah ini tanpa perlu mengetik ulang.
              </p>
            </div>

            {/* Role Selection Tabs */}
            <div>
              <label className="label">Kategori Pengguna *</label>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setRole("mahasiswa");
                    if (selectedUserId) setSelectedUserId(null);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-all ${
                    role === "mahasiswa"
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Icon name="academicCap" className="h-4 w-4 text-primary-500" />
                  Mahasiswa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRole("dosen");
                    if (selectedUserId) setSelectedUserId(null);
                  }}
                  className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-all ${
                    role === "dosen"
                      ? "bg-white text-emerald-800 shadow-sm border border-emerald-300"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Icon name="shield" className="h-4 w-4 text-emerald-600" />
                  Dosen / Pengajar
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {role === "dosen"
                  ? "✓ Dosen/Pengajar memiliki privilege akses ke seluruh ruangan perkuliahan yang diampu."
                  : "✓ Mahasiswa hanya dapat membuka pintu ruangan sesuai jadwal sesi perkuliahan aktif."}
              </p>
            </div>

            {/* Dosen GSG Preset Selector */}
            {role === "dosen" && !selectedUserId && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 space-y-1.5">
                <label htmlFor="dosen-preset" className="block text-xs font-semibold text-emerald-900">
                  Pilih Dosen GSG Terdaftar (Atau ketik manual di bawah):
                </label>
                <select
                  id="dosen-preset"
                  className="input text-xs bg-white text-slate-800 font-medium"
                  onChange={(e) => {
                    const selectedName = e.target.value;
                    if (!selectedName) return;
                    const found = lecturers.find((l) => l.name === selectedName);
                    if (found) {
                      setName(found.name);
                      setKelas(`Dosen ${found.classes.join(", ")}`);
                      setProdi("Teknik Informatika dan Komputer");
                      setJurusan("Teknik Informatika dan Komputer");
                    }
                  }}
                  defaultValue=""
                >
                  <option value="">-- Pilih dari {lecturers.length} Dosen GSG (Otomatis Terisi) --</option>
                  {lecturers.map((l) => (
                    <option key={l.name} value={l.name}>
                      {l.name} ({l.subjects.join(", ")})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Full Name */}
            <div>
              <label htmlFor="register-name" className="label">
                Nama Lengkap {role === "dosen" ? "(Dosen / Pengajar)" : "(Mahasiswa)"} *
              </label>
              <input
                id="register-name"
                name="name"
                type="text"
                autoComplete="name"
                maxLength={100}
                placeholder={role === "dosen" ? "Contoh: Dr. Ir. Budi Rahardjo, M.Kom" : "Contoh: Muhammad Farhan"}
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                required
              />
            </div>

            {/* NIM & Kelas */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="register-nim" className="label">
                  {role === "dosen" ? "NIP / NIDN (Opsional)" : "Nomor Induk Mahasiswa (NIM)"}
                </label>
                <input
                  id="register-nim"
                  name="nim"
                  type="text"
                  maxLength={30}
                  placeholder={role === "dosen" ? "198503152010121002" : "2207421001"}
                  className="input"
                  value={nim}
                  onChange={(e) => setNim(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div>
                <label htmlFor="register-kelas" className="label">
                  {role === "dosen" ? "Ruangan / Bidang" : "Kelas Akademik"}
                </label>
                <input
                  id="register-kelas"
                  name="kelas"
                  type="text"
                  maxLength={30}
                  placeholder={role === "dosen" ? "GSG210, GSG211" : "Contoh: TMJ 5C, TI 3A, dll"}
                  className="input font-semibold"
                  value={kelas}
                  onChange={(e) => setKelas(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            {/* Program Studi & Jurusan */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="register-prodi" className="label">Program Studi</label>
                <input
                  id="register-prodi"
                  name="prodi"
                  type="text"
                  maxLength={100}
                  placeholder="Contoh: Teknik Informatika / TMJ"
                  className="input text-xs"
                  value={prodi}
                  onChange={(e) => setProdi(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div>
                <label htmlFor="register-jurusan" className="label">Jurusan / Departemen</label>
                <input
                  id="register-jurusan"
                  name="jurusan"
                  type="text"
                  maxLength={100}
                  placeholder="Contoh: Teknik Elektro / TIK"
                  className="input text-xs"
                  value={jurusan}
                  onChange={(e) => setJurusan(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            {/* Photo Capture Status Indicator */}
            <div>
              <span className="label">Status Foto Wajah</span>
              <div
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${
                  captured
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                <Icon name={captured ? "check" : "camera"} className="h-4 w-4" />
                {captured
                  ? "Foto wajah siap disimpan ke database."
                  : "Belum ada foto wajah. Nyalakan kamera dan ambil foto."}
              </div>
            </div>

            <button
              id="register-submit"
              type="submit"
              className="btn btn-primary w-full mt-2"
              disabled={submitting || !captured}
            >
              <Icon name="check" className="h-4 w-4" />
              {submitting
                ? "Menyimpan ke Database..."
                : selectedUserId
                ? `Simpan Wajah untuk "${name}"`
                : "Daftarkan Pengguna & Wajah"}
            </button>
          </form>
        </section>
      </div>

      {/* Registered Users Table Card */}
      <section className="card" aria-labelledby="users-heading">
        <div className="card-header flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="users-heading" className="card-title">Daftar Pengguna Terdaftar ({users.length})</h2>
            <p className="card-subtitle">
              {users.filter((u) => u.has_face).length} wajah terdaftar aktif • {users.filter((u) => !u.has_face).length} belum rekam wajah
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/mahasiswa"
              className="btn btn-sm btn-secondary"
            >
              <Icon name="academicCap" className="h-3.5 w-3.5" />
              Data Mahasiswa
            </Link>
            <Link
              href="/dosen"
              className="btn btn-sm btn-secondary"
            >
              <Icon name="shield" className="h-3.5 w-3.5" />
              Data Dosen
            </Link>
            {users.length > 0 && (
              <button
                id="register-reset-all"
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() => setIsResetAllOpen(true)}
              >
                <Icon name="trash" className="h-3.5 w-3.5" />
                Reset Semua
              </button>
            )}
          </div>
        </div>

        {usersError && (
          <div className="p-5">
            <div className="alert alert-error">{usersError}</div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-primary-100 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3">ID</th>
                <th className="px-5 py-3">Nama Lengkap</th>
                <th className="px-5 py-3">Peran (Role)</th>
                <th className="px-5 py-3">NIM / NIP</th>
                <th className="px-5 py-3">Kelas</th>
                <th className="px-5 py-3">Status Wajah</th>
                <th className="px-5 py-3">Waktu Terdaftar</th>
                <th className="px-5 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usersLoading && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                      <span>Memuat data pengguna...</span>
                    </div>
                  </td>
                </tr>
              )}

              {!usersLoading && users.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                    <Icon name="users" className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="font-medium text-slate-700">Belum ada pengguna terdaftar.</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Silakan daftarkan mahasiswa atau dosen menggunakan form di atas.
                    </p>
                  </td>
                </tr>
              )}

              {!usersLoading &&
                users.map((u) => {
                  const isDosen = (u.role || "").toLowerCase() === "dosen";
                  return (
                    <tr key={u.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-mono text-xs tabular-nums text-slate-500">
                        #{u.id}
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-900">
                        {u.name}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            isDosen
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-blue-50 text-blue-800 border border-blue-200"
                          }`}
                        >
                          {isDosen ? "Dosen" : "Mahasiswa"}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs tabular-nums text-slate-700">
                        {u.nim || "--"}
                      </td>
                      <td className="px-5 py-3">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800">
                          {u.kelas || "--"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {u.has_face ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Wajah Terdaftar
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Belum Rekam Wajah
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500 tabular-nums">
                        {formatDateTime(u.created_at)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!u.has_face && (
                            <button
                              type="button"
                              className="rounded bg-secondary-500 px-2 py-1 text-xs font-semibold text-neutral-950 hover:bg-secondary-400"
                              onClick={() => {
                                handleSelectUser(String(u.id));
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                            >
                              Rekam Wajah
                            </button>
                          )}
                          <button
                            type="button"
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            onClick={() => setUserToDelete(u)}
                            title="Hapus Pengguna"
                          >
                            <Icon name="trash" className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Delete User Modal */}
      <ConfirmDialog
        isOpen={Boolean(userToDelete)}
        title="Hapus Pengguna"
        description={`Apakah Anda yakin ingin menghapus data pengguna "${userToDelete?.name}"? Tindakan ini akan menghapus data identitas dan embedding wajahnya dari sistem.`}
        confirmText={isDeletingUser ? "Menghapus..." : "Hapus"}
        loading={isDeletingUser}
        tone="danger"
        onConfirm={handleConfirmDeleteUser}
        onClose={() => setUserToDelete(null)}
      />

      {/* Reset All Modal */}
      <ConfirmDialog
        isOpen={isResetAllOpen}
        title="Reset Semua Pengguna"
        description="Tindakan ini akan MENGHAPUS SEMUA pengguna dan rekaman wajah dari database Smart Classroom. Tindakan ini tidak dapat dibatalkan!"
        confirmText={isResettingAll ? "Mereset..." : "Hapus Semua"}
        loading={isResettingAll}
        tone="danger"
        onConfirm={handleConfirmResetAll}
        onClose={() => setIsResetAllOpen(false)}
      />
    </>
  );
}
