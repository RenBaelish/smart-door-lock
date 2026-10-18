"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/Icon";
import LogsTable from "@/components/LogsTable";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { api, errorMessage, type Stats } from "@/lib/api";
import { formatTime } from "@/lib/format";

const REFRESH_MS = 10_000;

export default function DashboardView() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

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
        description="Overview of enrolled users and door access activity. Data refreshes every 10 seconds."
        actions={
          <>
            {updatedAt && <span className="hidden text-xs text-slate-500 sm:inline">Updated {formatTime(updatedAt)}</span>}
            <button id="dashboard-refresh" type="button" className="btn btn-secondary" onClick={load}>
              <Icon name="refresh" className="h-4 w-4" />
              Refresh
            </button>
          </>
        }
      />

      {error && <div className="alert alert-error mb-6">{error}</div>}

      <section aria-label="Key metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registered Users" value={stats?.total_users ?? null} icon="users" tone="primary" hint="Faces enrolled in the database" />
        <StatCard label="Total Attempts" value={stats?.total_attempts ?? null} icon="list" hint="All recognition attempts logged" />
        <StatCard
          label="Granted (24h)"
          value={stats?.success_24h ?? null}
          icon="check"
          tone="success"
          hint={successRate === null ? "No attempts in the last 24 hours" : `${successRate}% success rate in the last 24 hours`}
        />
        <StatCard label="Denied (24h)" value={stats?.failed_24h ?? null} icon="x" tone="danger" hint="Unknown or unmatched faces" />
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="card xl:col-span-2" aria-labelledby="recent-heading">
          <div className="card-header">
            <div>
              <h2 id="recent-heading" className="card-title">Recent Access Attempts</h2>
              <p className="card-subtitle">Latest 10 entries from the access log</p>
            </div>
            <Link href="/logs" className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800">
              View all
              <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          </div>
          <LogsTable logs={stats?.recent_logs ?? []} loading={loading} />
        </section>

        <div className="space-y-6">
          <section className="card" aria-labelledby="actions-heading">
            <div className="card-header">
              <h2 id="actions-heading" className="card-title">Quick Actions</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {[
                { href: "/register", icon: "userPlus" as const, title: "Enroll a new user", text: "Capture a face and assign a name" },
                { href: "/simulate", icon: "video" as const, title: "Run live simulation", text: "Test recognition with the webcam" },
                { href: "/logs", icon: "list" as const, title: "Audit access logs", text: "Review the full attempt history" },
              ].map((a) => (
                <Link key={a.href} href={a.href} className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-slate-50">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-700">
                    <Icon name={a.icon} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{a.title}</p>
                    <p className="text-xs text-slate-500">{a.text}</p>
                  </div>
                  <Icon name="arrowRight" className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </section>

          <section className="card" aria-labelledby="config-heading">
            <div className="card-header">
              <h2 id="config-heading" className="card-title">Recognition Parameters</h2>
            </div>
            <dl className="divide-y divide-slate-100 text-sm">
              <div className="flex justify-between px-5 py-3">
                <dt className="text-slate-500">Match threshold (L2)</dt>
                <dd className="font-mono text-slate-900">{stats ? `< ${stats.match_threshold.toFixed(2)}` : "--"}</dd>
              </div>
              <div className="flex justify-between px-5 py-3">
                <dt className="text-slate-500">Detection model</dt>
                <dd className="font-mono uppercase text-slate-900">{stats?.detection_model ?? "--"}</dd>
              </div>
              <div className="flex justify-between px-5 py-3">
                <dt className="text-slate-500">Multi-face policy</dt>
                <dd className="text-slate-900">Largest face only</dd>
              </div>
              <div className="flex justify-between px-5 py-3">
                <dt className="text-slate-500">Embedding size</dt>
                <dd className="font-mono text-slate-900">128-D</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}
