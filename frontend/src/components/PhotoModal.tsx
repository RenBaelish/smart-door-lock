"use client";

import { useEffect } from "react";
import Icon from "@/components/Icon";
import StatusBadge from "@/components/StatusBadge";
import { API_BASE, type AccessLog } from "@/lib/api";
import { formatDateTime, formatScore } from "@/lib/format";

interface PhotoModalProps {
  log: AccessLog | null;
  onClose: () => void;
}

export default function PhotoModal({ log, onClose }: PhotoModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!log) return null;

  const imageUrl = log.image_url
    ? `${API_BASE}${log.image_url}`
    : `${API_BASE}/api/logs/${log.id}/image`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neutral-950/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-neutral-900/10 transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary-100 text-secondary-800">
              <Icon name="camera" className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Bukti Foto Capture Akses #{log.id}
              </h3>
              <p className="text-xs text-slate-500">Smart Classroom Door Lock</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
            aria-label="Tutup modal"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5">
          {/* Photo Preview Container */}
          <div className="group relative mb-5 flex aspect-4/3 w-full items-center justify-center overflow-hidden rounded-lg bg-neutral-950 ring-1 ring-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={`Capture log #${log.id}`}
              className="h-full w-full object-contain"
              onError={(e) => {
                // Fallback placeholder if image not found on disk
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            {/* Overlay Timestamp watermark */}
            <div className="absolute bottom-2 left-2 rounded bg-black/65 px-2 py-1 font-mono text-[11px] text-white backdrop-blur-xs">
              {formatDateTime(log.timestamp)}
            </div>
          </div>

          {/* Details Grid */}
          <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/60 p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="block text-slate-400">Nama Pengguna</span>
                <span className="font-semibold text-slate-900">
                  {log.user_name || "Tidak Terdaftar"}
                </span>
              </div>
              <div>
                <span className="block text-slate-400">Peran / Kategori</span>
                <span className="font-medium text-slate-800 capitalize">
                  {log.user_role || "Mahasiswa"}
                </span>
              </div>
              <div>
                <span className="block text-slate-400">Ruangan (Door Lock)</span>
                <span className="font-mono font-bold text-slate-900">
                  {log.room || "GSG210"}
                </span>
              </div>
              <div>
                <span className="block text-slate-400">NIM / Identitas</span>
                <span className="font-mono text-slate-800">
                  {log.user_nim || "--"}
                </span>
              </div>
              <div>
                <span className="block text-slate-400">Kelas / Unit</span>
                <span className="font-medium text-slate-800">
                  {log.user_kelas || "--"}
                </span>
              </div>
              <div>
                <span className="block text-slate-400">Waktu Verifikasi (WIB)</span>
                <span className="font-medium text-slate-900">
                  {formatDateTime(log.timestamp)}
                </span>
              </div>
            </div>

            <div className="border-t border-slate-200/70 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Status Verifikasi</span>
                <StatusBadge status={log.status} reason={log.reason} />
              </div>
              <div className="mt-2 text-xs text-slate-600">
                <span className="font-medium text-slate-700">Rincian: </span>
                {log.reason || "-"}
              </div>
              {log.confidence_score !== null && (
                <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                  <span>Tingkat Kemiripan Wajah:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {formatScore(log.confidence_score)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
          <a
            href={imageUrl}
            download={`capture_log_${log.id}.jpg`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary text-xs"
          >
            <Icon name="download" className="h-3.5 w-3.5" />
            Unduh Foto
          </a>
          <button type="button" onClick={onClose} className="btn btn-primary text-xs">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
