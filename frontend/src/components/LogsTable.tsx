import Icon from "@/components/Icon";
import StatusBadge from "@/components/StatusBadge";
import type { AccessLog } from "@/lib/api";
import { formatDateTime, formatScore } from "@/lib/format";

interface LogsTableProps {
  logs: AccessLog[];
  loading?: boolean;
  emptyMessage?: string;
  onViewPhoto?: (log: AccessLog) => void;
}

export default function LogsTable({
  logs,
  loading = false,
  emptyMessage = "Belum ada riwayat aktivitas akses.",
  onViewPhoto,
}: LogsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th scope="col" className="th">ID</th>
            <th scope="col" className="th">Waktu Akses (WIB)</th>
            <th scope="col" className="th">Ruangan</th>
            <th scope="col" className="th">Identitas Mahasiswa / Pengguna</th>
            <th scope="col" className="th">Status</th>
            <th scope="col" className="th">Rincian Aktivitas</th>
            <th scope="col" className="th text-right">Akurasi</th>
            <th scope="col" className="th text-center">Foto</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {loading && logs.length === 0
            ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} className="td">
                      <span className="block h-4 w-full max-w-[8rem] animate-pulse rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))
            : logs.map((log) => {
                const userRole = (log.user_role || "").toLowerCase();
                const roleBadgeClass =
                  userRole === "dosen" || userRole === "guru"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                    : userRole === "tamu" || userRole === "vip"
                    ? "bg-purple-100 text-purple-800 border-purple-200"
                    : "bg-sky-100 text-sky-800 border-sky-200";
                const roleLabel =
                  userRole === "dosen" || userRole === "guru"
                    ? "Dosen"
                    : userRole === "tamu" || userRole === "vip"
                    ? "Tamu"
                    : userRole === "mahasiswa"
                    ? "Mhs"
                    : null;

                return (
                  <tr key={log.id} className="transition-colors hover:bg-slate-50">
                    <td className="td font-mono text-xs text-slate-500">#{log.id}</td>
                    <td className="td whitespace-nowrap tabular-nums text-xs font-medium text-slate-700">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="td">
                      <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-800">
                        {log.room || "GSG210"}
                      </span>
                    </td>
                    <td className="td">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900">
                            {log.user_name || "Tidak Terdaftar"}
                          </span>
                          {roleLabel && (
                            <span className={`inline-flex items-center rounded-full border px-1.5 py-0.2 text-[10px] font-medium ${roleBadgeClass}`}>
                              {roleLabel}
                            </span>
                          )}
                        </div>
                        {(log.user_nim || log.user_kelas) && (
                          <span className="text-[11px] text-slate-500">
                            {log.user_nim ? `ID: ${log.user_nim}` : ""}
                            {log.user_nim && log.user_kelas ? " • " : ""}
                            {log.user_kelas ? `Kelas: ${log.user_kelas}` : ""}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="td">
                      <StatusBadge status={log.status} reason={log.reason} />
                    </td>
                    <td className="td max-w-xs text-xs text-slate-600">
                      <span className="line-clamp-2" title={log.reason || undefined}>
                        {log.reason || (log.status === "success" ? "Akses diizinkan" : "Akses ditolak")}
                      </span>
                    </td>
                    <td className="td text-right font-mono text-xs tabular-nums text-slate-700">
                      {formatScore(log.confidence_score)}
                    </td>
                  <td className="td text-center">
                    <button
                      type="button"
                      onClick={() => onViewPhoto?.(log)}
                      title="Lihat foto capture"
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-colors"
                    >
                      <Icon name="camera" className="h-3.5 w-3.5 text-slate-500" />
                      <span>Foto</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          {!loading && logs.length === 0 && (
            <tr>
              <td colSpan={8} className="px-5 py-12 text-center text-sm text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

