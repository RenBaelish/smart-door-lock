"use client";

import { useEffect, useRef } from "react";
import Icon, { type IconName } from "@/components/Icon";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  message?: string;
  confirmText?: string;
  confirmLabel?: string;
  cancelText?: string;
  cancelLabel?: string;
  tone?: "danger" | "warning" | "primary";
  variant?: "danger" | "warning" | "primary" | string;
  loading?: boolean;
  isLoading?: boolean;
  icon?: IconName;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title,
  description,
  message,
  confirmText,
  confirmLabel,
  cancelText,
  cancelLabel,
  tone,
  variant,
  loading,
  isLoading,
  icon = "trash",
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleClose = onClose || onCancel || (() => {});
  const resolvedDesc = description ?? message ?? "";
  const resolvedConfirmText = confirmText ?? confirmLabel ?? "Konfirmasi";
  const resolvedCancelText = cancelText ?? cancelLabel ?? "Batal";
  const rawTone = (tone ?? variant ?? "danger") as "danger" | "warning" | "primary";
  const resolvedTone: "danger" | "warning" | "primary" =
    rawTone === "warning" || rawTone === "primary" ? rawTone : "danger";
  const isBusy = loading ?? isLoading ?? false;

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isBusy) {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isBusy, handleClose]);

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
  }[resolvedTone];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) handleClose();
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
              {resolvedDesc}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-primary-100">
          <button
            type="button"
            className="btn btn-secondary text-xs"
            onClick={handleClose}
            disabled={isBusy}
          >
            {resolvedCancelText}
          </button>
          <button
            type="button"
            className={`btn text-xs shadow-md transition-all ${toneConfig.btnClass}`}
            onClick={onConfirm}
            disabled={isBusy}
          >
            {isBusy ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Memproses...
              </span>
            ) : (
              resolvedConfirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
