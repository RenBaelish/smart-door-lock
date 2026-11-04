"use client";

import Icon from "@/components/Icon";

export default function StatusBadge({
  status,
  reason,
}: {
  status: string;
  reason?: string | null;
}) {
  const normalized = (status || "").toLowerCase();
  const reasonText = (reason || "").toLowerCase();

  if (normalized === "tailgating" || normalized === "multi_face" || reasonText.includes("tailgating") || reasonText.includes("multi-orang")) {
    return (
      <span className="chip border-purple-200 bg-purple-50 font-semibold text-purple-800">
        <Icon name="alertTriangle" className="h-3.5 w-3.5 text-purple-600" />
        Deteksi Multi-Orang
      </span>
    );
  }

  if (normalized === "out_of_schedule" || reasonText.includes("jadwal perkuliahan")) {
    return (
      <span className="chip border-amber-200 bg-amber-50 font-semibold text-amber-800">
        <Icon name="clock" className="h-3.5 w-3.5 text-amber-600" />
        Di Luar Jadwal
      </span>
    );
  }

  if (normalized === "no_face" || reasonText.includes("tidak ada wajah") || reasonText.includes("wajah tidak terdeteksi")) {
    return (
      <span className="chip border-slate-200 bg-slate-100 font-medium text-slate-700">
        <Icon name="camera" className="h-3.5 w-3.5 text-slate-500" />
        Wajah Tidak Terdeteksi
      </span>
    );
  }

  if (normalized === "unregistered" || normalized === "invalid" || reasonText.includes("belum terdaftar") || reasonText.includes("tidak terdaftar")) {
    return (
      <span className="chip border-red-200 bg-red-50 font-semibold text-red-700">
        <Icon name="x" className="h-3.5 w-3.5 text-red-600" />
        Belum Terdaftar
      </span>
    );
  }

  const granted = normalized === "success";

  return (
    <span
      className={`chip ${
        granted
          ? "border-mint-100 bg-mint-50 font-semibold text-mint-700"
          : "border-red-200 bg-red-50 font-medium text-red-700"
      }`}
    >
      <Icon name={granted ? "check" : "x"} className="h-3.5 w-3.5" />
      {granted ? "Diizinkan" : "Ditolak"}
    </span>
  );
}

