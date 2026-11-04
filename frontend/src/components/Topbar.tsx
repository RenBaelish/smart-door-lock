"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  users: "Data Pengguna (Admin)",
  mahasiswa: "Data Mahasiswa",
  dosen: "Data Dosen",
  register: "Pendaftaran Wajah",
  simulate: "Simulasi Kamera",
  logs: "Log Akses",
  schedule: "Jadwal Perkuliahan",
  monitoring: "Monitoring",
  topology: "Topologi Live",
  performance: "Performa QoS",
  packets: "Analisis Paket",
};

export default function Topbar() {
  const pathname = usePathname();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const segments = pathname.split("/").filter(Boolean);

  return (
    <div className="sticky top-0 z-20 hidden h-16 items-center justify-between border-b border-primary-200/70 bg-white/80 px-6 backdrop-blur-md md:flex lg:px-8">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
        <span className="caps text-[11px] text-sage">FaceLock</span>
        {segments.map((seg, i) => (
          <span key={seg} className="flex items-center gap-2">
            <Icon name="chevronRight" className="h-3.5 w-3.5 text-primary-300" />
            <span className={i === segments.length - 1 ? "font-medium text-neutral-950" : "text-graphite"}>
              {LABELS[seg] ?? seg}
            </span>
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <span className="chip border-secondary-200 bg-cream text-neutral-800">
          <Icon name="laptop" className="h-3.5 w-3.5 text-accent-600" />
          Sesi: Admin Localhost
        </span>
        <span className="flex items-center gap-2 rounded-sm border border-primary-200 bg-white px-3 py-1.5 font-mono text-xs tabular-nums text-neutral-800">
          <Icon name="clock" className="h-3.5 w-3.5 text-sage" />
          {now
            ? now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
            : "--:--:--"}
        </span>
      </div>
    </div>
  );
}
