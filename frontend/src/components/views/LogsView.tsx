"use client";

import { useCallback, useEffect, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import Icon from "@/components/Icon";
import LogsTable from "@/components/LogsTable";
import PageHeader from "@/components/PageHeader";
import PhotoModal from "@/components/PhotoModal";
import { api, errorMessage, type AccessLog, type LogsResponse } from "@/lib/api";

const PAGE_SIZE = 25;

const FILTERS: { value: string | null; label: string }[] = [
  { value: null, label: "Semua" },
  { value: "success", label: "Diizinkan" },
  { value: "out_of_schedule", label: "Di Luar Jadwal" },
  { value: "tailgating", label: "Multi-Orang (>1)" },
  { value: "unregistered", label: "Belum Terdaftar" },
  { value: "no_face", label: "Wajah Tidak Terdeteksi" },
];

export default function LogsView() {
  const [filter, setFilter] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [rooms, setRooms] = useState<string[]>(["GSG210", "GSG211"]);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<LogsResponse | null>(null);
  const [stats, setStats] = useState<{ total_attempts: number; success_24h: number; failed_24h: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Photo preview modal state
  const [selectedPhotoLog, setSelectedPhotoLog] = useState<AccessLog | null>(null);

  // Clear logs confirmation dialog state
  const [isClearLogsOpen, setIsClearLogsOpen] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);

  const loadRooms = useCallback(async () => {
    try {
      const r = await api.rooms();
      if (r && r.length > 0) setRooms(r);
    } catch {
      // Keep defaults
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const s = await api.stats();
      setStats({
        total_attempts: s.total_attempts,
        success_24h: s.success_24h,
        failed_24h: s.failed_24h,
      });
    } catch {
      // Ignore stat error
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.logs({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        status: filter,
        room: selectedRoom,
      });
      setData(res);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, filter, selectedRoom]);

  useEffect(() => {
    loadRooms();
    loadStats();
  }, [loadRooms, loadStats]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh setiap 5 detik agar request dari ESP32-CAM langsung muncul di tabel
  useEffect(() => {
    const id = window.setInterval(() => {
      load();
      loadStats();
    }, 5000);
    return () => window.clearInterval(id);
  }, [load, loadStats]);

  const handleConfirmClearLogs = async () => {
    setClearingLogs(true);
    try {
      await api.clearLogs();
      setNotice("Seluruh riwayat log akses berhasil dibersihkan dari basis data.");
      setIsClearLogsOpen(false);
      setPage(0);
      load();
      loadStats();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setClearingLogs(false);
    }
  };

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);

  const success24 = stats?.success_24h ?? 0;
  const failed24 = stats?.failed_24h ?? 0;
  const total24 = success24 + failed24;
  const successRate = total24 > 0 ? Math.round((success24 / total24) * 100) : 100;

  return (
    <>
      <PageHeader
        title="Riwayat Log Akses"
        description="Audit lengkap seluruh riwayat percobaan akses pengenalan wajah pada Smart Classroom door lock per ruangan. Semua rekaman menyimpan foto capture dan waktu WIB."
        actions={
          <div className="flex items-center gap-2">
            {total > 0 && (
              <button
                id="logs-clear"
                type="button"
                className="btn btn-danger"
                onClick={() => setIsClearLogsOpen(true)}
                disabled={loading || clearingLogs}
              >
                <Icon name="trash" className="h-4 w-4" />
                Reset Riwayat Log
              </button>
            )}

            <button
              id="logs-refresh"
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                load();
                loadStats();
              }}
              disabled={loading}
            >
              <Icon name="refresh" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Perbarui
            </button>
          </div>
        }
      />

      {error && <div className="alert alert-error mb-6">{error}</div>}
      {notice && <div className="alert alert-success mb-6">{notice}</div>}

      {/* 4 Quick Stat Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Percobaan</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Icon name="activity" className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {(stats?.total_attempts ?? total).toLocaleString()}
          </p>
          <span className="text-[11px] text-slate-400">Total riwayat audit pintu</span>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Akses Diizinkan (24 Jam)</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Icon name="check" className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{success24.toLocaleString()}</p>
          <span className="text-[11px] text-emerald-700/80">Wajah & jadwal cocok</span>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Akses Ditolak (24 Jam)</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <Icon name="x" className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-600">{failed24.toLocaleString()}</p>
          <span className="text-[11px] text-rose-700/80">Luar jadwal / tak terdaftar</span>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Tingkat Keberhasilan</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary-50 text-secondary-600">
              <Icon name="check" className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{successRate}%</p>
          <span className="text-[11px] text-slate-400">Rasio akses lolos valid</span>
        </div>
      </div>

      {/* Room Selection Tabs */}
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => {
            setSelectedRoom(null);
            setPage(0);
          }}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
            selectedRoom === null
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
          }`}
        >
          <Icon name="dashboard" className="h-3.5 w-3.5" />
          <span>Semua Ruangan</span>
        </button>
        {rooms.map((r) => {
          const active = selectedRoom === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => {
                setSelectedRoom(r);
                setPage(0);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                active
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
              }`}
            >
              <Icon name="lock" className="h-3.5 w-3.5" />
              <span>Ruang {r}</span>
            </button>
          );
        })}
      </div>

      <section className="card" aria-labelledby="logs-heading">
        <div className="card-header flex-col items-start sm:flex-row sm:items-center">
          <div>
            <h2 id="logs-heading" className="card-title">
              Riwayat Percobaan Akses {selectedRoom ? `(Ruangan ${selectedRoom})` : "(Seluruh Ruangan)"}
            </h2>
            <p className="card-subtitle">{total.toLocaleString()} catatan tersimpan</p>
          </div>

          <div
            className="inline-flex rounded-md border border-slate-300 bg-white p-0.5"
            role="group"
            aria-label="Filter berdasarkan status"
          >
            {FILTERS.map((f) => {
              const active = filter === f.value;
              return (
                <button
                  key={f.label}
                  id={`logs-filter-${f.label.toLowerCase()}`}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setFilter(f.value);
                    setPage(0);
                  }}
                  className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                    active ? "bg-slate-900 text-white font-bold" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        <LogsTable
          logs={data?.items ?? []}
          loading={loading}
          onViewPhoto={(log) => setSelectedPhotoLog(log)}
          emptyMessage={filter ? "Tidak ada catatan log yang cocok dengan filter ini." : "Belum ada riwayat aktivitas akses yang tercatat."}
        />

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm text-slate-600 sm:flex-row">
          <span>
            Menampilkan <span className="font-medium text-slate-900">{from}</span> sampai{" "}
            <span className="font-medium text-slate-900">{to}</span> dari{" "}
            <span className="font-medium text-slate-900">{total.toLocaleString()}</span> entri
          </span>

          <div className="flex items-center gap-2">
            <button
              id="logs-prev"
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
            >
              Sebelumnya
            </button>
            <span className="tabular-nums text-xs text-slate-500 font-mono">
              Halaman {page + 1} dari {pageCount}
            </span>
            <button
              id="logs-next"
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page + 1 >= pageCount || loading}
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </section>

      {/* Confirmation Dialog: Clear All Logs */}
      <ConfirmDialog
        isOpen={isClearLogsOpen}
        onClose={() => setIsClearLogsOpen(false)}
        onConfirm={handleConfirmClearLogs}
        title="Konfirmasi Reset Riwayat Log"
        description={`Apakah Anda yakin ingin menghapus SELURUH riwayat log akses (${total.toLocaleString()} catatan)?\n\nData aktivitas audit akses akan dibersihkan dari basis data PostgreSQL dan statistik percobaan 24 jam akan kembali ke 0. Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Ya, Reset Riwayat Log"
        cancelText="Batal"
        tone="danger"
        icon="trash"
        loading={clearingLogs}
      />

      {/* Photo Capture Preview Modal Popup */}
      <PhotoModal
        log={selectedPhotoLog}
        onClose={() => setSelectedPhotoLog(null)}
      />
    </>
  );
}
