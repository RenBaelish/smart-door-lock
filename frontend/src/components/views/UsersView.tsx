"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import ConfirmDialog from "@/components/ConfirmDialog";
import Icon from "@/components/Icon";
import PageHeader from "@/components/PageHeader";
import { api, errorMessage, type User } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

type Notice = { type: "success" | "error"; text: string } | null;

const ADMIN_ROLES = [
  "Super Admin",
  "Network Admin (MikroTik & Firewall)",
  "System Admin (Raspberry Pi Server)",
  "Operator Akademik (Jadwal & Log)",
];

export default function UsersView() {
  const [admins, setAdmins] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  // Form states for Admin Dashboard User
  const [name, setName] = useState("");
  const [nim, setNim] = useState(""); // NIP / NIM / ID Operator
  const [jabatan, setJabatan] = useState("Super Admin"); // Stored in `kelas`
  const [prodi, setProdi] = useState("Teknik Multimedia dan Jaringan");
  const [jurusan, setJurusan] = useState("Teknik Informatika dan Komputer");
  const [submitting, setSubmitting] = useState(false);

  // Search filter
  const [search, setSearch] = useState("");

  // Delete state
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadAdmins = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.users({ role: "admin" });
      setAdmins(data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setNotice({ type: "error", text: "Nama lengkap pengguna admin wajib diisi." });
      return;
    }

    setSubmitting(true);
    setNotice(null);

    try {
      const newAdmin = await api.createUser({
        name: cleanName,
        role: "admin",
        nim: nim.trim() || undefined,
        kelas: jabatan.trim() || "Admin Dashboard",
        prodi: prodi.trim() || undefined,
        jurusan: jurusan.trim() || undefined,
      });

      setNotice({
        type: "success",
        text: `Pengguna Admin Dashboard "${newAdmin.name}" (${newAdmin.kelas || "Admin"}) berhasil ditambahkan ke daftar hak akses konsol.`,
      });

      setName("");
      setNim("");
      loadAdmins();
    } catch (err) {
      setNotice({ type: "error", text: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteUser(userToDelete.id);
      setAdmins((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setNotice({ type: "success", text: `Pengguna admin "${userToDelete.name}" berhasil dihapus.` });
      setUserToDelete(null);
    } catch (err) {
      setNotice({ type: "error", text: errorMessage(err) });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredAdmins = admins.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      (u.nim && u.nim.toLowerCase().includes(q)) ||
      (u.kelas && u.kelas.toLowerCase().includes(q)) ||
      (u.prodi && u.prodi.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <PageHeader
        title="Data Pengguna (Pengelola Dashboard Admin)"
        description="Kelola daftar personel/administrator yang memiliki wewenang mengakses Web Dashboard Smart Classroom pada segmen jaringan Admin-Net (192.168.20.0/24). Untuk mengelola civitas akademika pintu kelas, silakan buka menu Data Mahasiswa atau Data Dosen."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/mahasiswa" className="btn btn-secondary btn-sm">
              <Icon name="academicCap" className="h-4 w-4" />
              Data Mahasiswa
            </Link>
            <Link href="/dosen" className="btn btn-secondary btn-sm">
              <Icon name="shield" className="h-4 w-4" />
              Data Dosen
            </Link>
          </div>
        }
      />

      {/* Info Banner Explaining Auth / Network Scope */}
      <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Icon name="key" className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-indigo-950">
              Otorisasi Akses Konsol Web Admin (Virtual-AP2: Admin-Net • 192.168.20.0/24)
            </h3>
            <p className="text-xs text-indigo-900/80 mt-0.5 leading-relaxed">
              Karena sistem prototipe saat ini menggunakan kontrol akses berbasis segmen jaringan <strong>Firewall MikroTik (Admin-Net → Server-Net)</strong> tanpa halaman login form, halaman <strong>Data Pengguna</strong> ini berfungsi mencatat daftar administrator resmi yang berhak mengakses dashboard manajemen serta dapat diintegrasikan dengan autentikasi login ke depannya.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Pengguna Admin</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{admins.length}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Pengelola terdaftar di sistem</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Icon name="key" className="h-5 w-5" />
          </div>
        </div>

        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Segmen Jaringan</p>
            <p className="mt-1 text-lg font-mono font-bold text-emerald-700">192.168.20.0/24</p>
            <p className="text-[11px] text-emerald-600/80 mt-0.5">SSID: Virtual-AP2 (Admin-Net)</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <Icon name="wifi" className="h-5 w-5" />
          </div>
        </div>

        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Target Server Lokal</p>
            <p className="mt-1 text-lg font-mono font-bold text-slate-800">192.168.10.2</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Raspberry Pi 4B (Server-Net)</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <Icon name="server" className="h-5 w-5" />
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

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
        {/* Form Card (1 col) */}
        <section className="card lg:col-span-1" aria-labelledby="form-admin-heading">
          <div className="card-header">
            <div>
              <h2 id="form-admin-heading" className="card-title">Tambah Pengguna Admin</h2>
              <p className="card-subtitle">Daftarkan pengelola yang dapat mengakses dashboard</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
              Admin
            </span>
          </div>

          <form onSubmit={handleSubmit} className="card-body space-y-4">
            <div>
              <label htmlFor="admin-name" className="label">
                Nama Lengkap Pengguna Admin *
              </label>
              <input
                id="admin-name"
                type="text"
                maxLength={100}
                placeholder="Contoh: Muhammad Iqbal Syarif"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                required
              />
            </div>

            <div>
              <label htmlFor="admin-id" className="label">
                NIM / NIP / ID Pengelola *
              </label>
              <input
                id="admin-id"
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
              <label htmlFor="admin-role" className="label">
                Peran / Hak Akses Dashboard *
              </label>
              <select
                id="admin-role"
                className="input font-semibold"
                value={jabatan}
                onChange={(e) => setJabatan(e.target.value)}
                disabled={submitting}
              >
                {ADMIN_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="admin-prodi" className="label">Program Studi / Unit</label>
              <input
                id="admin-prodi"
                type="text"
                maxLength={100}
                placeholder="Teknik Multimedia dan Jaringan"
                className="input text-xs"
                value={prodi}
                onChange={(e) => setProdi(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div>
              <label htmlFor="admin-jurusan" className="label">Jurusan / Departemen</label>
              <input
                id="admin-jurusan"
                type="text"
                maxLength={100}
                placeholder="Teknik Informatika dan Komputer"
                className="input text-xs"
                value={jurusan}
                onChange={(e) => setJurusan(e.target.value)}
                disabled={submitting}
              />
            </div>

            <button
              id="submit-admin-btn"
              type="submit"
              className="btn btn-primary w-full mt-2"
              disabled={submitting}
            >
              <Icon name="userPlus" className="h-4 w-4" />
              {submitting ? "Menyimpan..." : "Tambah Pengguna Admin"}
            </button>
          </form>
        </section>

        {/* Admin Users Table Card (2 cols) */}
        <section className="card lg:col-span-2" aria-labelledby="table-admin-heading">
          <div className="card-header flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="table-admin-heading" className="card-title">Daftar Pengguna Dashboard Admin</h2>
              <p className="card-subtitle">
                Menampilkan {filteredAdmins.length} dari {admins.length} administrator terdaftar
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Icon
                name="search"
                className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                type="search"
                placeholder="Cari nama, ID, atau peran..."
                className="input pl-9 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading && admins.length === 0 ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-md bg-slate-100" />
                ))}
              </div>
            ) : filteredAdmins.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Icon name="key" className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">Belum ada data pengguna admin</p>
                <p className="mt-1 text-xs text-slate-500 max-w-xs">
                  Tambahkan pengguna pengelola melalui formulir di sebelah kiri.
                </p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="th">Nama Pengelola</th>
                    <th className="th">ID / NIM / NIP</th>
                    <th className="th">Hak Akses / Peran</th>
                    <th className="th">Unit / Prodi</th>
                    <th className="th">Terdaftar Pada</th>
                    <th className="th text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredAdmins.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="td">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{u.name}</p>
                            <span className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.2 text-[10px] font-semibold text-indigo-700">
                              Akses Dashboard Aktif
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="td font-mono text-xs text-slate-700">{u.nim || "-"}</td>
                      <td className="td">
                        <span className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-800">
                          {u.kelas || "Admin Dashboard"}
                        </span>
                      </td>
                      <td className="td text-xs text-slate-600">
                        <p className="font-medium text-slate-800">{u.prodi || "-"}</p>
                        <p className="text-[11px] text-slate-400">{u.jurusan || ""}</p>
                      </td>
                      <td className="td text-xs text-slate-500">{formatDateTime(u.created_at)}</td>
                      <td className="td text-right">
                        <button
                          type="button"
                          onClick={() => setUserToDelete(u)}
                          className="btn btn-sm btn-danger px-2.5 py-1 text-xs"
                          title={`Hapus ${u.name}`}
                        >
                          <Icon name="trash" className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      <ConfirmDialog
        isOpen={Boolean(userToDelete)}
        title="Hapus Pengguna Admin"
        message={
          userToDelete
            ? `Apakah Anda yakin ingin menghapus "${userToDelete.name}" dari daftar pengelola Dashboard Admin?`
            : ""
        }
        confirmLabel="Ya, Hapus Admin"
        cancelLabel="Batal"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setUserToDelete(null)}
      />
    </>
  );
}
