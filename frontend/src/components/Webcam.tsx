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
        return "Camera permission was denied. Allow camera access in the browser settings.";
      case "NotFoundError":
        return "No camera device was found.";
      case "NotReadableError":
        return "The camera is already in use by another application.";
      default:
        return `Camera error: ${err.message}`;
    }
  }
  return "Unable to start the camera.";
}

const Webcam = forwardRef<WebcamHandle, WebcamProps>(function Webcam(
  { active, mirrored = true, onReadyChange, onError, inactiveLabel = "Camera is off", children },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const espImgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const callbacks = useRef({ onReadyChange, onError });

  const [cameraSource, setCameraSource] = useState<"local" | "esp32">("local");
  const [espIp, setEspIp] = useState("http://192.168.43.120/stream");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("esp32_cam_url");
    if (saved) setEspIp(saved);
    const savedSource = localStorage.getItem("camera_source") as "local" | "esp32";
    if (savedSource === "esp32" || savedSource === "local") setCameraSource(savedSource);
  }, []);

  const handleSourceChange = (src: "local" | "esp32") => {
    setCameraSource(src);
    localStorage.setItem("camera_source", src);
    setReady(false);
    setError(null);
  };

  const handleIpChange = (url: string) => {
    setEspIp(url);
    localStorage.setItem("esp32_cam_url", url);
  };

  useEffect(() => {
    callbacks.current = { onReadyChange, onError };
  }, [onReadyChange, onError]);

  useEffect(() => {
    callbacks.current.onReadyChange?.(ready);
  }, [ready]);

  // Handle local camera stream
  useEffect(() => {
    if (!active || cameraSource !== "local") return;

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
        fail("Camera API unavailable. Open the app via http://localhost or HTTPS.");
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
  }, [active, cameraSource]);

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

          if (cameraSource === "local") {
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
          } else {
            // ESP32-CAM stream image
            const img = espImgRef.current;
            if (!img || !img.naturalWidth || !img.naturalHeight) {
              resolve(null);
              return;
            }
            const scale = Math.min(1, maxWidth / img.naturalWidth);
            const width = Math.round(img.naturalWidth * scale);
            const height = Math.round(img.naturalHeight * scale);

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => resolve(blob ? { blob, width, height } : null), "image/jpeg", quality);
          }
        }),
    }),
    [cameraSource],
  );

  const showPlaceholder = !active || !ready;

  return (
    <div className="w-full space-y-3">
      {/* Source Selector Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-slate-700">
          <Icon name="camera" className="h-4 w-4 text-slate-500" />
          <span>Camera Source:</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSourceChange("local")}
            className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1 font-medium transition-colors ${
              cameraSource === "local"
                ? "bg-neutral-950 text-white shadow-sm"
                : "border border-primary-200 bg-white text-neutral-800 hover:bg-primary-50"
            }`}
          >
            <Icon name="laptop" className="h-3.5 w-3.5" />
            Laptop
          </button>
          <button
            type="button"
            onClick={() => handleSourceChange("esp32")}
            className={`inline-flex items-center gap-1.5 rounded-sm px-3 py-1 font-medium transition-colors ${
              cameraSource === "esp32"
                ? "bg-neutral-950 text-white shadow-sm"
                : "border border-primary-200 bg-white text-neutral-800 hover:bg-primary-50"
            }`}
          >
            <Icon name="camera" className="h-3.5 w-3.5" />
            ESP32-CAM
          </button>
        </div>
      </div>

      {cameraSource === "esp32" && (
        <div className="flex items-center gap-2 rounded-lg border border-primary-200 bg-white p-2.5 text-xs">
          <span className="shrink-0 font-medium text-neutral-700">Stream URL:</span>
          <input
            type="text"
            value={espIp}
            onChange={(e) => handleIpChange(e.target.value)}
            placeholder="http://192.168.30.2:81/stream"
            className="w-full rounded-sm border border-primary-200 px-2.5 py-1 font-mono text-xs text-neutral-900 focus:border-secondary-500 focus:outline-none"
          />
        </div>
      )}

      {/* Video Viewport */}
      <div className={`relative w-full overflow-hidden rounded-lg bg-slate-950 aspect-[4/3] max-h-[460px] flex items-center justify-center`}>
        {cameraSource === "local" ? (
          <video
            ref={videoRef}
            playsInline
            muted
            onLoadedMetadata={() => setReady(true)}
            className={showPlaceholder ? "absolute inset-0 h-full w-full opacity-0" : "block h-full w-full object-contain"}
            style={mirrored ? { transform: "scaleX(-1)" } : undefined}
          />
        ) : (
          /* ESP32-CAM MJPEG Stream */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            ref={espImgRef}
            src={active ? espIp : undefined}
            crossOrigin="anonymous"
            alt="ESP32-CAM Live Stream"
            onLoad={() => setReady(true)}
            onError={() => {
              setReady(false);
              setError(`Gagal memuat stream dari ${espIp}. Pastikan ESP32-CAM menyala dan satu WiFi.`);
            }}
            className={showPlaceholder ? "absolute inset-0 h-full w-full opacity-0" : "block h-full w-full object-contain"}
          />
        )}

        {active && ready && children && <div className="pointer-events-none absolute inset-0">{children}</div>}

        {showPlaceholder && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 text-slate-400">
              <Icon name="camera" className="h-6 w-6" />
            </div>
            {error ? (
              <p className="max-w-sm text-sm text-red-300">{error}</p>
            ) : (
              <p className="text-sm text-slate-400">
                {active
                  ? cameraSource === "esp32"
                    ? `Menghubungkan ke ${espIp}...`
                    : "Starting camera..."
                  : inactiveLabel}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default Webcam;
