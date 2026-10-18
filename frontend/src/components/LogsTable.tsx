import StatusBadge from "@/components/StatusBadge";
import type { AccessLog } from "@/lib/api";
import { formatDateTime, formatScore } from "@/lib/format";

interface LogsTableProps {
  logs: AccessLog[];
  loading?: boolean;
  emptyMessage?: string;
}

export default function LogsTable({ logs, loading = false, emptyMessage = "No access attempts recorded yet." }: LogsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th scope="col" className="th">Log ID</th>
            <th scope="col" className="th">Timestamp</th>
            <th scope="col" className="th">User</th>
            <th scope="col" className="th">Status</th>
            <th scope="col" className="th">Activity Details</th>
            <th scope="col" className="th text-right">Confidence</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {loading && logs.length === 0
            ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="td">
                      <span className="block h-4 w-full max-w-[8rem] animate-pulse rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))
            : logs.map((log) => (
                <tr key={log.id} className="transition-colors hover:bg-slate-50">
                  <td className="td font-mono text-xs text-slate-500">#{log.id}</td>
                  <td className="td tabular-nums">{formatDateTime(log.timestamp)}</td>
                  <td className="td">
                    {log.user_name ? (
                      <span className="font-medium text-slate-900">{log.user_name}</span>
                    ) : (
                      <span className="italic text-slate-400">Unknown</span>
                    )}
                  </td>
                  <td className="td">
                    <StatusBadge status={log.status} reason={log.reason} />
                  </td>
                  <td className="td text-xs text-slate-600">
                    {log.reason || (log.status === "success" ? "Access granted" : "Access denied")}
                  </td>
                  <td className="td text-right font-mono text-xs tabular-nums">{formatScore(log.confidence_score)}</td>
                </tr>
              ))}
          {!loading && logs.length === 0 && (
            <tr>
              <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
