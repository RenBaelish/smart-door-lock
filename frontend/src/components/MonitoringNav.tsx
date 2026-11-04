"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/Icon";

const TABS: { href: string; label: string; icon: IconName; exact?: boolean }[] = [
  { href: "/monitoring", label: "Ringkasan Jaringan", icon: "activity", exact: true },
  { href: "/monitoring/topology", label: "Topologi Live", icon: "network" },
  { href: "/monitoring/performance", label: "Performa QoS", icon: "wifi" },
  { href: "/monitoring/packets", label: "Analisis Paket", icon: "layers" },
];

export default function MonitoringNav() {
  const pathname = usePathname();

  const isActive = (tab: (typeof TABS)[0]) =>
    tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-primary-200/80 pb-3">
      {TABS.map((tab) => {
        const active = isActive(tab);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`inline-flex items-center gap-2 rounded-sm px-3.5 py-2 text-xs font-medium transition-all ${
              active
                ? "bg-neutral-950 text-white shadow-sm font-semibold"
                : "border border-primary-200 bg-white text-neutral-700 hover:border-primary-300 hover:bg-primary-50"
            }`}
          >
            <Icon
              name={tab.icon}
              className={`h-4 w-4 ${active ? "text-secondary-400" : "text-sage"}`}
            />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
