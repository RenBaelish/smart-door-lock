"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Icon from "@/components/Icon";

export interface CapturedFrame {
  blob: Blob;
  width: number;
  height: number;
}

export interface WebcamHandle {
  /** Grab the current frame as JPEG, downscaled so its width is at most maxWidth. */
  capture: (maxWidth?: number, quality?: number) => Promise<CapturedFrame | null>;
}

interface WebcamProps {
  /** When true the camera stream is opened; when false it is fully released. */
  active: boolean;
  /** Mirror the preview like a selfie view. Captured frames are never mirrored. */
  mirrored?: boolean;
  onReadyChange?: (ready: boolean) => void;
  onError?: (message: string) => void;
  inactiveLabel?: string;
  /** Overlay content, rendered absolutely on top of the live video. */
  children?: ReactNode;
}

function describeError(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case "NotAllowedError":
        return "Izin kamera ditolak. Berikan izin akses kamera pada pengaturan browser.";
      case "NotFoundError":
        return "Perangkat kamera tidak ditemukan.";
      case "NotReadableError":
        return "Kamera sedang digunakan oleh aplikasi lain.";
      default:
        return `Kesalahan kamera: ${err.message}`;
    }
  }
  return "Tidak dapat memulai kamera.";
}

const Webcam = forwardRef<WebcamHandle, WebcamProps>(function Webcam(
  { active, mirrored = true, onReadyChange, onError, inactiveLabel = "Kamera mati", children },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const callbacks = useRef({ onReadyChange, onError });

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    callbacks.current = { onReadyChange, onError };
  }, [onReadyChange, onError]);

  useEffect(() => {
    callbacks.current.onReadyChange?.(ready);
  }, [ready]);

  // Handle device camera stream (laptop / smartphone)
  useEffect(() => {
    if (!active) return;

    const video = videoRef.current;
    let stream: MediaStream | null = null;
    let cancelled = false;
    setError(null);

    const fail = (message: string) => {
      setError(message);
      callbacks.current.onError?.(message);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        fail("Kamera web dinonaktifkan oleh browser karena halaman dibuka via HTTP IP (bukan localhost/HTTPS). Silakan gunakan tombol 'Upload Foto / Galeri' atau izinkan IP di chrome://flags/#unsafely-treat-insecure-origin-as-secure.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
      } catch (err) {
        if (!cancelled) fail(describeError(err));
      }
    })();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      if (video) video.srcObject = null;
      setReady(false);
    };
  }, [active]);

  // Expose capture method
  useImperativeHandle(
    ref,
    () => ({
      capture: (maxWidth = 640, quality = 0.85) =>
        new Promise<CapturedFrame | null>((resolve) => {
          const canvas = canvasRef.current ?? document.createElement("canvas");
          canvasRef.current = canvas;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(null);
            return;
          }

          const video = videoRef.current;
          if (!video || video.readyState < 2 || !video.videoWidth) {
            resolve(null);
            return;
          }
          const scale = Math.min(1, maxWidth / video.videoWidth);
          const width = Math.round(video.videoWidth * scale);
          const height = Math.round(video.videoHeight * scale);

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(video, 0, 0, width, height);
          canvas.toBlob((blob) => resolve(blob ? { blob, width, height } : null), "image/jpeg", quality);
        }),
    }),
    [],
  );

  const showPlaceholder = !active || !ready;

  return (
    <div className="w-full space-y-3">
      {/* Video Viewport */}
      <div className="relative w-full overflow-hidden rounded-lg bg-slate-950 aspect-[4/3] max-h-[460px] flex items-center justify-center">
        <video
          ref={videoRef}
          playsInline
          muted
          onLoadedMetadata={() => setReady(true)}
          className={showPlaceholder ? "absolute inset-0 h-full w-full opacity-0" : "block h-full w-full object-contain"}
          style={mirrored ? { transform: "scaleX(-1)" } : undefined}
        />

        {active && ready && children && <div className="pointer-events-none absolute inset-0">{children}</div>}

        {showPlaceholder && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 text-slate-400">
              <Icon name="camera" className="h-6 w-6" />
            </div>
            {error ? (
              <p className="max-w-sm text-xs leading-relaxed text-red-300">{error}</p>
            ) : (
              <p className="text-sm text-slate-400">
                {active ? "Memulai kamera..." : inactiveLabel}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default Webcam;
