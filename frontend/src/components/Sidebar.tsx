"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Icon, { type IconName } from "@/components/Icon";
import { API_BASE, api } from "@/lib/api";

const NAV_ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/register", label: "Register User", icon: "userPlus" },
  { href: "/simulate", label: "Live Simulation", icon: "video" },
  { href: "/logs", label: "Access Logs", icon: "list" },
];

type ApiState = "checking" | "online" | "offline";

function useApiStatus(intervalMs = 10000): ApiState {
  const [state, setState] = useState<ApiState>("checking");

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        await api.health();
        if (active) setState("online");
      } catch {
        if (active) setState("offline");
      }
    };
    check();
    const id = window.setInterval(check, intervalMs);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [intervalMs]);

  return state;
}

function ApiIndicator({ state }: { state: ApiState }) {
  const styles: Record<ApiState, { dot: string; label: string }> = {
    checking: { dot: "bg-slate-400", label: "Checking API" },
    online: { dot: "bg-emerald-500", label: "API online" },
    offline: { dot: "bg-red-500", label: "API offline" },
  };
  const s = styles[state];
  return (
    <div className="flex items-center gap-2 text-xs text-slate-400" title={API_BASE}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      <span>{s.label}</span>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const apiState = useApiStatus();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-slate-900 text-slate-300 md:flex">
        <div className="flex items-center gap-3 border-b border-slate-800 px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-800 text-white">
            <Icon name="lock" className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">FaceLock</div>
            <div className="text-xs text-slate-400">Access Control Console</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Primary">
          <div className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Navigation
          </div>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                id={`nav-${item.href.slice(1)}`}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm transition-colors ${
                  active
                    ? "border-blue-500 bg-slate-800 font-medium text-white"
                    : "border-transparent hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                <Icon name={item.icon} className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-slate-800 px-6 py-4">
          <ApiIndicator state={apiState} />
          <div className="truncate font-mono text-[11px] text-slate-500">{API_BASE}</div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900 text-slate-300 md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Icon name="lock" className="h-5 w-5" />
            FaceLock
          </div>
          <ApiIndicator state={apiState} />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2" aria-label="Primary mobile">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs ${
                isActive(item.href) ? "bg-slate-800 font-medium text-white" : "hover:bg-slate-800/60"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}
