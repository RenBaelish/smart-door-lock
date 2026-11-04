"use client";

import { useEffect, useRef } from "react";
import Icon, { type IconName } from "@/components/Icon";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  tone?: "danger" | "warning" | "primary";
  loading?: boolean;
  icon?: IconName;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Konfirmasi",
  cancelText = "Batal",
  tone = "danger",
  loading = false,
  icon = "trash",
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const toneConfig = {
    danger: {
      iconBg: "bg-red-100 text-red-600",
      btnClass: "bg-red-600 hover:bg-red-700 text-white font-bold",
    },
    warning: {
      iconBg: "bg-secondary-100 text-secondary-700",
      btnClass: "bg-secondary-500 hover:bg-secondary-600 text-neutral-950 font-bold",
    },
    primary: {
      iconBg: "bg-primary-100 text-neutral-900",
      btnClass: "bg-neutral-950 hover:bg-neutral-800 text-white font-bold",
    },
  }[tone];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-2xl border border-primary-200 bg-white p-6 shadow-2xl transition-all animate-scaleUp"
      >
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${toneConfig.iconBg}`}>
            <Icon name={icon} className="h-6 w-6" />
          </div>
          <div className="space-y-1.5 min-w-0 flex-1">
            <h3 id="confirm-dialog-title" className="font-display text-base font-bold text-neutral-950">
              {title}
            </h3>
            <p className="text-xs text-graphite leading-relaxed whitespace-pre-line">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-primary-100">
          <button
            type="button"
            className="btn btn-secondary text-xs"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn text-xs shadow-md transition-all ${toneConfig.btnClass}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Memproses...
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
