"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Icon, { type IconName } from "@/components/Icon";
import LogsTable from "@/components/LogsTable";
import PageHeader from "@/components/PageHeader";
import PhotoModal from "@/components/PhotoModal";
import StatCard from "@/components/StatCard";
import { api, errorMessage, type AccessLog, type Stats } from "@/lib/api";
import { formatTime } from "@/lib/format";

const REFRESH_MS = 10_000;

const QUICK_ACTIONS: { href: string; icon: IconName; title: string; text: string }[] = [
  { href: "/mahasiswa", icon: "academicCap", title: "Data Mahasiswa", text: "Kelola biodata & kelas mahasiswa" },
  { href: "/dosen", icon: "shield", title: "Data Dosen", text: "Kelola dosen pengampu GSG 210 & 211" },
  { href: "/users", icon: "key", title: "Data Pengguna (Admin)", text: "Pengelola akses Web Dashboard" },
  { href: "/register", icon: "userPlus", title: "Pendaftaran Wajah", text: "Ambil foto wajah & embedding" },
  { href: "/simulate", icon: "video", title: "Simulasi Kamera", text: "Uji pintu GSG 210 & 211 + LCD I2C" },
  { href: "/schedule", icon: "calendar", title: "Jadwal Perkuliahan", text: "Jadwal ruang GSG 210 & GSG 211" },
];


/** Donut chart of granted vs denied attempts. */
function RatioDonut({ granted, denied }: { granted: number; denied: number }) {
  const total = granted + denied;
  const r = 52;
  const c = 2 * Math.PI * r;
  const grantedLen = total ? (granted / total) * c : 0;
  const rate = total ? Math.round((granted / total) * 100) : 0;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
          <circle cx="64" cy="64" r={r} fill="none" stroke="#eeeff1" strokeWidth="14" />
          {total > 0 && (
            <>
              <circle cx="64" cy="64" r={r} fill="none" stroke="#ef4444" strokeWidth="14" />
              <circle
                cx="64"
                cy="64"
                r={r}
                fill="none"
                stroke="#00cd8f"
                strokeWidth="14"
                strokeDasharray={`${grantedLen} ${c}`}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            </>
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-semibold text-neutral-950">{total ? `${rate}%` : "--"}</span>
          <span className="caps text-[10px] text-sage">Berhasil</span>
        </div>
      </div>
      <ul className="w-full space-y-3 text-sm">
        <li className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-graphite">
            <span className="h-2.5 w-2.5 rounded-full bg-mint" /> Diizinkan
          </span>
          <span className="font-mono font-semibold tabular-nums text-neutral-950">{granted}</span>
        </li>
        <li className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-graphite">
            <span className="h-2.5 w-2.5 rounded-full bg-error" /> Ditolak
          </span>
          <span className="font-mono font-semibold tabular-nums text-neutral-950">{denied}</span>
        </li>
        <li className="flex items-center justify-between gap-3 border-t border-primary-100 pt-3">
          <span className="text-graphite">Total 24 jam</span>
          <span className="font-mono font-semibold tabular-nums text-neutral-950">{total}</span>
        </li>
      </ul>
    </div>
  );
}

export default function DashboardView() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [selectedPhotoLog, setSelectedPhotoLog] = useState<AccessLog | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.stats();
      setStats(data);
      setError(null);
      setUpdatedAt(new Date());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const attempts24h = stats ? stats.success_24h + stats.failed_24h : 0;
  const successRate = stats && attempts24h > 0 ? Math.round((stats.success_24h / attempts24h) * 100) : null;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Ikhtisar pengguna terdaftar dan aktivitas akses pintu. Data diperbarui otomatis setiap 10 detik."
        actions={
          <>
            {updatedAt && (
              <span className="hidden text-xs text-graphite sm:inline">Diperbarui {formatTime(updatedAt)}</span>
            )}
            <button id="dashboard-refresh" type="button" className="btn btn-secondary" onClick={load}>
              <Icon name="refresh" className="h-4 w-4" />
              Refresh
            </button>
          </>
        }
      />

      {error && <div className="alert alert-error mb-6">{error}</div>}

      <section aria-label="Metrik utama" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pengguna Terdaftar"
          value={stats?.total_users ?? null}
          icon="users"
          tone="primary"
          hint={
            stats
              ? `${stats.total_mahasiswa ?? 0} Mahasiswa • ${stats.total_dosen ?? 0} Dosen (${stats.total_with_face ?? 0} Sudah Rekam Wajah)`
              : "Total Mahasiswa & Dosen terdaftar"
          }
        />
        <StatCard
          label="Total Percobaan"
          value={stats?.total_attempts ?? null}
          icon="list"
          hint="Seluruh aktivitas pengenalan wajah"
        />
        <StatCard
          label="Diizinkan (24 Jam)"
          value={stats?.success_24h ?? null}
          icon="check"
          tone="success"
          hint={successRate === null ? "Belum ada percobaan dalam 24 jam" : `Tingkat keberhasilan ${successRate}%`}
        />
        <StatCard
          label="Ditolak (24 Jam)"
          value={stats?.failed_24h ?? null}
          icon="x"
          tone="danger"
          hint="Wajah tidak cocok / pelanggaran"
        />
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card overflow-hidden lg:col-span-2" aria-labelledby="recent-heading">
          <div className="card-header">
            <div>
              <h2 id="recent-heading" className="card-title">
                Aktivitas Akses Terbaru
              </h2>
              <p className="card-subtitle">10 entri terakhir dari log akses (Waktu WIB)</p>
            </div>
            <Link
              href="/logs"
              className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-sm font-medium text-neutral-950 hover:bg-cream"
            >
              Lihat semua
              <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </div>
          <LogsTable
            logs={stats?.recent_logs ?? []}
            loading={loading}
            onViewPhoto={(log) => setSelectedPhotoLog(log)}
          />
        </section>


        <div className="space-y-6">
          <section className="card" aria-labelledby="ratio-heading">
            <div className="card-header">
              <div>
                <h2 id="ratio-heading" className="card-title">
                  Rasio Akses 24 Jam
                </h2>
                <p className="card-subtitle">Perbandingan diizinkan vs ditolak</p>
              </div>
            </div>
            <div className="card-body">
              <RatioDonut granted={stats?.success_24h ?? 0} denied={stats?.failed_24h ?? 0} />
            </div>
          </section>

          <section className="card" aria-labelledby="actions-heading">
            <div className="card-header">
              <h2 id="actions-heading" className="card-title">
                Aksi Cepat
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-1">
              {QUICK_ACTIONS.map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="group flex items-center gap-3 rounded-md px-3 py-3 transition-colors hover:bg-cream"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-100 text-neutral-800 transition-colors group-hover:bg-secondary-500 group-hover:text-neutral-950">
                    <Icon name={a.icon} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-950">{a.title}</p>
                    <p className="text-xs text-graphite">{a.text}</p>
                  </div>
                  <Icon
                    name="arrowRight"
                    className="h-4 w-4 text-primary-400 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-950"
                  />
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>

      <PhotoModal
        log={selectedPhotoLog}
        onClose={() => setSelectedPhotoLog(null)}
      />
    </>
  );
}
