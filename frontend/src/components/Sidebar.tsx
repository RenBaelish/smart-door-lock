"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Icon, { type IconName } from "@/components/Icon";
import { API_BASE, api } from "@/lib/api";

type NavItem = { href: string; label: string; icon: IconName; exact?: boolean };

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Operasional & Pintu",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/register", label: "Pendaftaran Wajah", icon: "userPlus" },
      { href: "/simulate", label: "Simulasi Kamera", icon: "video" },
      { href: "/logs", label: "Log Akses", icon: "list" },
    ],
  },
  {
    title: "Manajemen Pengguna",
    items: [
      { href: "/users", label: "Data Pengguna (Admin)", icon: "key" },
      { href: "/mahasiswa", label: "Data Mahasiswa", icon: "academicCap" },
      { href: "/dosen", label: "Data Dosen", icon: "shield" },
    ],
  },
  {
    title: "Akademik",
    items: [
      { href: "/schedule", label: "Jadwal Perkuliahan", icon: "calendar" },
    ],
  },
];


const STORAGE_KEY = "facelock.sidebar.collapsed";

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

/** Renders /asset/hamburger.svg as a mask so it inherits the current text colour. */
function HamburgerIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block bg-current ${className}`}
      style={{
        WebkitMask: "url(/asset/hamburger.svg) center / contain no-repeat",
        mask: "url(/asset/hamburger.svg) center / contain no-repeat",
      }}
    />
  );
}

function BrandMark() {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary-500 text-neutral-950 shadow-sm">
      <Icon name="shield" className="h-5 w-5" />
    </div>
  );
}

const API_STYLES: Record<ApiState, { dot: string; label: string }> = {
  checking: { dot: "bg-primary-400", label: "Memeriksa API" },
  online: { dot: "bg-mint", label: "API Online" },
  offline: { dot: "bg-error", label: "API Offline" },
};

export default function Sidebar() {
  const pathname = usePathname();
  const apiState = useApiStatus();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Restore the last collapsed state.
  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  // Close the mobile drawer when navigating.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggle = () => {
    setCollapsed((prev) => {
      window.localStorage.setItem(STORAGE_KEY, prev ? "0" : "1");
      return !prev;
    });
  };

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const api = API_STYLES[apiState];

  const renderNav = (compact: boolean) => (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Navigasi utama">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          {compact ? (
            <div className="mx-auto mb-2 h-px w-6 bg-neutral-800" />
          ) : (
            <div className="caps mb-2 px-3 text-[10px] text-neutral-500">{group.title}</div>
          )}
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = isActive(item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    id={`nav-${item.href.slice(1).replace(/\//g, "-")}`}
                    aria-current={active ? "page" : undefined}
                    title={compact ? item.label : undefined}
                    className={`group relative flex items-center gap-3 rounded-sm py-2.5 text-sm transition-colors ${
                      compact ? "justify-center px-0" : "px-3"
                    } ${
                      active
                        ? "bg-secondary-500 font-medium text-neutral-950"
                        : "text-neutral-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon name={item.icon} className="h-5 w-5 shrink-0" />
                    {!compact && <span className="truncate">{item.label}</span>}
                    {compact && (
                      <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-sm bg-neutral-950 px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg ring-1 ring-neutral-800 transition-opacity group-hover:opacity-100">
                        {item.label}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* ---------------- Desktop sidebar ---------------- */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-neutral-950 text-neutral-300 transition-[width] duration-300 ease-in-out md:flex ${
          collapsed ? "w-[76px]" : "w-64"
        }`}
      >
        {/* Brand: logo + name when open, hamburger only when closed */}
        <div
          className={`flex h-16 items-center border-b border-neutral-800 ${
            collapsed ? "justify-center px-0" : "justify-between gap-3 px-4"
          }`}
        >
          {!collapsed && (
            <div className="flex min-w-0 items-center gap-3">
              <BrandMark />
              <div className="min-w-0">
                <div className="truncate font-display text-base font-semibold leading-tight text-white">FaceLock</div>
                <div className="caps truncate text-[10px] text-neutral-500">Access &amp; Monitoring</div>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Buka sidebar" : "Tutup sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Buka sidebar" : "Tutup sidebar"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-neutral-300 transition-colors hover:bg-white/10 hover:text-secondary-400"
          >
            <HamburgerIcon className="h-5 w-5" />
          </button>
        </div>

        {renderNav(collapsed)}

        {/* Footer: API status */}
        <div className={`border-t border-neutral-800 ${collapsed ? "px-0 py-4" : "p-4"}`}>
          {collapsed ? (
            <div className="flex justify-center" title={`${api.label} - ${API_BASE || "Origin Host"}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${api.dot}`} />
            </div>
          ) : (
            <div className="rounded-sm bg-white/5 px-3 py-2.5">
              <div className="flex items-center gap-2 text-xs text-neutral-300">
                <span className={`h-2 w-2 rounded-full ${api.dot}`} />
                <span className="font-medium">{api.label}</span>
              </div>
              <div className="mt-1 truncate font-mono text-[10px] text-neutral-500">{API_BASE || "/api (Nginx Proxy)"}</div>
            </div>
          )}
        </div>
      </aside>

      {/* ---------------- Mobile header + drawer ---------------- */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 text-neutral-300 md:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Buka menu"
            className="flex h-9 w-9 items-center justify-center rounded-sm hover:bg-white/10"
          >
            <HamburgerIcon />
          </button>
          <span className="font-display text-base font-semibold text-white">FaceLock</span>
        </div>
        <span className={`h-2.5 w-2.5 rounded-full ${api.dot}`} title={api.label} />
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-72 animate-fade-up flex-col bg-neutral-950 text-neutral-300 shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-neutral-800 px-4">
              <div className="flex items-center gap-3">
                <BrandMark />
                <div>
                  <div className="font-display text-base font-semibold text-white">FaceLock</div>
                  <div className="caps text-[10px] text-neutral-500">Access &amp; Monitoring</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Tutup menu"
                className="flex h-9 w-9 items-center justify-center rounded-sm hover:bg-white/10"
              >
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>
            {renderNav(false)}
          </aside>
        </div>
      )}
    </>
  );
}
