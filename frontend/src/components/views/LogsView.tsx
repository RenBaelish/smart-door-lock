"use client";

import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import LogsTable from "@/components/LogsTable";
import PageHeader from "@/components/PageHeader";
import { api, errorMessage, type LogStatus, type LogsResponse } from "@/lib/api";

const PAGE_SIZE = 25;

const FILTERS: { value: LogStatus | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "success", label: "Granted" },
  { value: "failed", label: "Denied" },
];

export default function LogsView() {
  const [filter, setFilter] = useState<LogStatus | null>(null);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<LogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.logs({ limit: PAGE_SIZE, offset: page * PAGE_SIZE, status: filter });
      setData(res);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="Access Logs"
        description="Complete audit trail of recognition attempts. Unknown faces are recorded without a user reference."
        actions={
          <button id="logs-refresh" type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
            <Icon name="refresh" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      {error && <div className="alert alert-error mb-6">{error}</div>}

      <section className="card" aria-labelledby="logs-heading">
        <div className="card-header flex-col items-start sm:flex-row sm:items-center">
          <div>
            <h2 id="logs-heading" className="card-title">Attempt History</h2>
            <p className="card-subtitle">{total.toLocaleString()} records</p>
          </div>
          <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5" role="group" aria-label="Filter by status">
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
                    active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
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
          emptyMessage={filter ? "No records match this filter." : "No access attempts recorded yet."}
        />

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm text-slate-600 sm:flex-row">
          <span>
            Showing <span className="font-medium text-slate-900">{from}</span> to{" "}
            <span className="font-medium text-slate-900">{to}</span> of{" "}
            <span className="font-medium text-slate-900">{total.toLocaleString()}</span>
          </span>
          <div className="flex items-center gap-2">
            <button
              id="logs-prev"
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
            >
              Previous
            </button>
            <span className="tabular-nums text-xs text-slate-500">
              Page {page + 1} of {pageCount}
            </span>
            <button
              id="logs-next"
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page + 1 >= pageCount || loading}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
