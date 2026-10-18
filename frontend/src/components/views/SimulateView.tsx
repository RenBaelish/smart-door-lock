"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import PageHeader from "@/components/PageHeader";
import Webcam, { type WebcamHandle } from "@/components/Webcam";
import { api, errorMessage, type RecognizeResponse, type RecognizeStatus } from "@/lib/api";
import { formatScore, formatTime } from "@/lib/format";

const CAPTURE_INTERVAL_MS = 1500;
const UNLOCK_DURATION_MS = 5000;
const CAPTURE_MAX_WIDTH = 640;
const MIRRORED = true;

interface SessionEvent {
  key: number;
  at: Date;
  status: Exclude<RecognizeStatus, "no_face">;
  name: string | null;
  reason: string | null;
  distance: number | null;
}

function FaceOverlay({ result }: { result: RecognizeResponse }) {
  if (!result.box || result.status === "no_face") return null;
  const { top, right, bottom, left } = result.box;
  const { width, height } = result.frame;
  // The preview is mirrored, the analysed frame is not: flip the x coordinate.
  const x = MIRRORED ? width - right : left;
  const isTailgating = result.status === "tailgating";
  const granted = result.status === "success";

  const borderColor = granted ? "border-emerald-400" : isTailgating ? "border-amber-400" : "border-red-400";
  const tagColor = granted ? "bg-emerald-600" : isTailgating ? "bg-amber-600" : "bg-red-600";
  const label = granted ? result.name : isTailgating ? "⚠️ Tailgating Detected" : "Unknown Face";

  return (
    <div
      className={`absolute rounded-sm border-2 transition-all duration-300 ${borderColor}`}
      style={{
        left: `${(x / width) * 100}%`,
        top: `${(top / height) * 100}%`,
        width: `${((right - left) / width) * 100}%`,
        height: `${((bottom - top) / height) * 100}%`,
      }}
    >
      <div
        className={`absolute -top-7 left-[-2px] whitespace-nowrap rounded-t px-2 py-1 text-xs font-semibold text-white ${tagColor}`}
      >
        {label}
        {result.distance !== null && <span className="ml-2 font-mono font-normal opacity-80">{result.distance.toFixed(3)}</span>}
      </div>
    </div>
  );
}

function StatusPanel({ running, result, error }: { running: boolean; result: RecognizeResponse | null; error: string | null }) {
  let tone = "border-slate-200 bg-slate-50 text-slate-700";
  let title = "Standby";
  let subtitle = "Start the camera to begin scanning.";
  let icon: "lock" | "check" | "x" | "camera" = "lock";

  if (running && error) {
    tone = "border-amber-200 bg-amber-50 text-amber-800";
    title = "Connection Error";
    subtitle = error;
  } else if (running && !result) {
    title = "Scanning";
    subtitle = "Waiting for the first frame result...";
    icon = "camera";
  } else if (running && result?.status === "no_face") {
    title = "No Face Detected";
    subtitle = result.reason || "Step in front of the camera.";
    icon = "camera";
  } else if (running && result?.status === "tailgating") {
    tone = "border-amber-300 bg-amber-50 text-amber-900";
    title = "Tailgating Blocked";
    subtitle = result.reason || "Multiple people detected. Access denied for security.";
    icon = "x";
  } else if (running && result?.status === "success") {
    tone = "border-emerald-200 bg-emerald-50 text-emerald-800";
    title = "Access Granted";
    subtitle = result.reason || `Welcome, ${result.name}.`;
    icon = "check";
  } else if (running && result?.status === "invalid") {
    tone = "border-red-200 bg-red-50 text-red-800";
    title = "Access Denied";
    subtitle = result.reason || "Face not recognized in database.";
    icon = "x";
  }

  return (
    <div className={`flex items-center gap-4 rounded-lg border p-5 transition-colors duration-300 ${tone}`} role="status" aria-live="polite">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/70">
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-semibold uppercase tracking-wide">{title}</p>
        <p className="truncate text-sm opacity-80">{subtitle}</p>
      </div>
    </div>
  );
}

export default function SimulateView() {
  const webcamRef = useRef<WebcamHandle>(null);
  const inFlight = useRef(false);
  const eventKey = useRef(0);

  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);
  const [result, setResult] = useState<RecognizeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [framesSent, setFramesSent] = useState(0);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const unlockTimer = useRef<number | null>(null);

  // Capture loop: one frame every CAPTURE_INTERVAL_MS, never overlapping requests.
  useEffect(() => {
    if (!running || !ready) return;

    const controller = new AbortController();
    let disposed = false;

    const tick = async () => {
      if (inFlight.current || disposed) return;
      inFlight.current = true;
      try {
        const frame = await webcamRef.current?.capture(CAPTURE_MAX_WIDTH, 0.8);
        if (!frame || disposed) return;

        const started = performance.now();
        const res = await api.recognize(frame.blob, controller.signal);
        if (disposed) return;

        setResult(res);
        setLatency(Math.round(performance.now() - started));
        setLastUpdate(new Date());
        setFramesSent((n) => n + 1);
        setError(null);

        if (res.status !== "no_face") {
          const status = res.status;
          setEvents((prev) =>
            [
              {
                key: ++eventKey.current,
                at: new Date(),
                status,
                name: res.name,
                reason: res.reason || null,
                distance: res.distance,
              },
              ...prev,
            ].slice(0, 25),
          );
        }

        if (res.status === "success") {
          setUnlocked(true);
          if (unlockTimer.current) window.clearTimeout(unlockTimer.current);
          unlockTimer.current = window.setTimeout(() => setUnlocked(false), UNLOCK_DURATION_MS);
        }
      } catch (err) {
        if (!disposed && !controller.signal.aborted) setError(errorMessage(err));
      } finally {
        inFlight.current = false;
      }
    };

    tick();
    const id = window.setInterval(tick, CAPTURE_INTERVAL_MS);

    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(id);
      inFlight.current = false;
    };
  }, [running, ready]);

  useEffect(
    () => () => {
      if (unlockTimer.current) window.clearTimeout(unlockTimer.current);
    },
    [],
  );

  const start = () => {
    setResult(null);
    setError(null);
    setRunning(true);
  };

  const stop = () => {
    setRunning(false);
    setResult(null);
    setError(null);
    setLatency(null);
  };

  const metrics: { label: string; value: string }[] = [
    { label: "Identified as", value: running && result?.status === "success" ? result.name ?? "--" : running && result?.status === "invalid" ? "Unknown" : "--" },
    { label: "L2 distance", value: running ? formatScore(result?.distance) : "--" },
    { label: "Threshold", value: result ? `< ${result.threshold.toFixed(2)}` : "< 0.60" },
    { label: "Faces in frame", value: running && result ? String(result.faces_detected) : "--" },
    { label: "Round-trip latency", value: running && latency !== null ? `${latency} ms` : "--" },
    { label: "Last update", value: running && lastUpdate ? formatTime(lastUpdate) : "--" },
  ];

  return (
    <>
      <PageHeader
        title="Live Simulation"
        description="Simulates the door camera. While running, a frame is sent to the recognition API every 1.5 seconds. Only the largest face in the frame is evaluated."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="card xl:col-span-2" aria-labelledby="feed-heading">
          <div className="card-header">
            <div>
              <h2 id="feed-heading" className="card-title">Camera Feed</h2>
              <p className="card-subtitle">Interval {CAPTURE_INTERVAL_MS / 1000}s, frames sent this session: {framesSent}</p>
            </div>
            {running && ready ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                Scanning
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                Idle
              </span>
            )}
          </div>
          <div className="card-body space-y-4">
            <Webcam
              ref={webcamRef}
              active={running}
              mirrored={MIRRORED}
              onReadyChange={setReady}
              inactiveLabel="Camera is off. Press Start Camera to begin the simulation."
            >
              {result && <FaceOverlay result={result} />}
            </Webcam>

            <div className="flex flex-wrap items-center gap-2">
              <button id="simulate-start" type="button" className="btn btn-primary" onClick={start} disabled={running}>
                <Icon name="play" className="h-4 w-4" />
                Start Camera
              </button>
              <button id="simulate-stop" type="button" className="btn btn-secondary" onClick={stop} disabled={!running}>
                <Icon name="stop" className="h-4 w-4" />
                Stop Camera
              </button>
              <p className="ml-auto text-xs text-slate-500">Every evaluated face is written to the access log.</p>
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <StatusPanel running={running} result={result} error={error} />

          <section className="card" aria-labelledby="lock-heading">
            <div className="card-header">
              <h2 id="lock-heading" className="card-title">Door Lock</h2>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${
                  unlocked ? "text-emerald-700" : "text-slate-600"
                }`}
              >
                <Icon name={unlocked ? "unlock" : "lock"} className="h-4 w-4" />
                {unlocked ? "Unlocked" : "Locked"}
              </span>
            </div>
            <dl className="divide-y divide-slate-100 text-sm">
              {metrics.map((m) => (
                <div key={m.label} className="flex justify-between gap-4 px-5 py-2.5">
                  <dt className="text-slate-500">{m.label}</dt>
                  <dd className="truncate font-medium tabular-nums text-slate-900">{m.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card" aria-labelledby="events-heading">
            <div className="card-header">
              <div>
                <h2 id="events-heading" className="card-title">Session Activity</h2>
                <p className="card-subtitle">Evaluated faces in this session</p>
              </div>
              {events.length > 0 && (
                <button id="simulate-clear-events" type="button" className="text-xs font-medium text-slate-500 hover:text-slate-800" onClick={() => setEvents([])}>
                  Clear
                </button>
              )}
            </div>
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
              {events.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-500">No activity yet.</li>}
              {events.map((ev) => {
                const isTailgating = ev.status === "tailgating";
                const isSuccess = ev.status === "success";
                const dotColor = isSuccess ? "bg-emerald-500" : isTailgating ? "bg-amber-500" : "bg-red-500";
                return (
                  <li key={ev.key} className="flex flex-col gap-0.5 px-5 py-2.5 text-sm transition-colors hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
                      <span className="font-mono text-xs tabular-nums text-slate-500">{formatTime(ev.at)}</span>
                      <span
                        className={`min-w-0 flex-1 truncate ${
                          isSuccess
                            ? "font-medium text-slate-900"
                            : isTailgating
                            ? "font-semibold text-amber-700"
                            : "italic text-slate-600"
                        }`}
                      >
                        {isSuccess ? ev.name : isTailgating ? "Tailgating Blocked" : "Unknown Face"}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-slate-500">{formatScore(ev.distance)}</span>
                    </div>
                    {ev.reason && (
                      <p className="ml-5 text-xs text-slate-500">{ev.reason}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
