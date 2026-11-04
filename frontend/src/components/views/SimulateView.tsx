"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import PageHeader from "@/components/PageHeader";
import Webcam, { type WebcamHandle } from "@/components/Webcam";
import { api, errorMessage, type FaceBox, type RecognizeResponse, type RecognizeStatus } from "@/lib/api";
import { formatScore, formatTime } from "@/lib/format";

const CAPTURE_INTERVAL_MS = 1500;
const UNLOCK_DURATION_MS = 5000;
const CAPTURE_MAX_WIDTH = 640;
const MIRRORED = true;

interface SessionEvent {
  key: number;
  at: Date;
  status: RecognizeStatus;
  name: string | null;
  role?: string | null;
  reason: string | null;
  distance: number | null;
  room?: string | null;
  kelas?: string | null;
  scheduleTime?: string | null;
}

function FaceBoxesOverlay({
  result,
  boxes,
  frameWidth,
  frameHeight,
}: {
  result: RecognizeResponse | null;
  boxes: FaceBox[];
  frameWidth: number;
  frameHeight: number;
}) {
  if (!result || !boxes || boxes.length === 0 || result.status === "no_face") return null;

  const isMultiPerson = result.status === "tailgating" || result.faces_detected > 1;
  const isOutOfSchedule = result.status === "out_of_schedule";
  const granted = result.status === "success";

  const borderColor = granted
    ? "border-emerald-400"
    : isOutOfSchedule
    ? "border-amber-400"
    : isMultiPerson
    ? "border-purple-400"
    : "border-red-400";

  const tagColor = granted
    ? "bg-emerald-600"
    : isOutOfSchedule
    ? "bg-amber-600"
    : isMultiPerson
    ? "bg-purple-600"
    : "bg-red-600";

  return (
    <>
      {boxes.map((b, idx) => {
        // The preview is mirrored: flip the x coordinate.
        const x = MIRRORED ? frameWidth - b.right : b.left;
        const boxWidth = b.right - b.left;
        const boxHeight = b.bottom - b.top;

        const isMain = idx === 0;
        let label = "Wajah Terdeteksi";
        if (isMultiPerson) {
          label = `Orang #${idx + 1} (${isMain ? "Utama" : "Sekunder"})`;
        } else if (granted) {
          label = `${result.name || "Terdaftar"} (${result.role === "dosen" ? "Dosen" : "Mahasiswa"})`;
        } else if (isOutOfSchedule) {
          label = `${result.name || "Mahasiswa"} (Di Luar Jadwal)`;
        } else {
          label = "Wajah Belum Terdaftar";
        }

        return (
          <div
            key={idx}
            className={`absolute rounded-sm border-2 transition-all duration-200 pointer-events-none ${borderColor}`}
            style={{
              left: `${(x / frameWidth) * 100}%`,
              top: `${(b.top / frameHeight) * 100}%`,
              width: `${(boxWidth / frameWidth) * 100}%`,
              height: `${(boxHeight / frameHeight) * 100}%`,
            }}
          >
            {/* Box Header Label */}
            <div
              className={`absolute -top-7 left-[-2px] whitespace-nowrap rounded-t px-2 py-0.5 text-[11px] font-bold text-white shadow-sm flex items-center gap-1.5 ${tagColor}`}
            >
              <span>{label}</span>
              {isMain && result.distance !== null && (
                <span className="font-mono font-normal opacity-90 text-[10px]">
                  (L2: {result.distance.toFixed(3)})
                </span>
              )}
            </div>

            {/* Grid corner markers for high-tech HUD look */}
            <div className="absolute top-0 left-0 h-2 w-2 border-t-2 border-l-2 border-white" />
            <div className="absolute top-0 right-0 h-2 w-2 border-t-2 border-r-2 border-white" />
            <div className="absolute bottom-0 left-0 h-2 w-2 border-b-2 border-l-2 border-white" />
            <div className="absolute bottom-0 right-0 h-2 w-2 border-b-2 border-r-2 border-white" />
          </div>
        );
      })}
    </>
  );
}

function StatusPanel({
  active,
  result,
  error,
  room,
}: {
  active: boolean;
  result: RecognizeResponse | null;
  error: string | null;
  room: string;
}) {
  let tone = "border-slate-200 bg-slate-50 text-slate-700";
  let title = "Kamera Standby";
  let subtitle = "Nyalakan kamera atau lakukan Ambil Foto Uji untuk memulai simulasi pengenalan wajah.";
  let icon: "lock" | "check" | "x" | "camera" | "alertTriangle" | "clock" = "lock";

  if (active && error) {
    tone = "border-amber-200 bg-amber-50 text-amber-800";
    title = "Koneksi Bermasalah";
    subtitle = error;
    icon = "alertTriangle";
  } else if (active && !result) {
    title = "Memindai Frame...";
    subtitle = "Menunggu evaluasi wajah dari model AI...";
    icon = "camera";
  } else if (active && result?.status === "no_face") {
    tone = "border-red-200 bg-red-50 text-red-800";
    title = "Wajah Tidak Terdeteksi (LED Merah)";
    subtitle = result.reason || "Posisikan wajah tepat di depan kamera pintu dan pastikan pencahayaan cukup.";
    icon = "camera";
  } else if (active && result?.status === "tailgating") {
    tone = "border-purple-300 bg-purple-50 text-purple-900";
    title = "Deteksi Multi-Orang (>1 Orang) • LED Merah";
    subtitle = result.reason || "Terdeteksi lebih dari satu orang di depan kamera. Harap masuk satu per satu.";
    icon = "alertTriangle";
  } else if (active && result?.status === "out_of_schedule") {
    tone = "border-amber-300 bg-amber-50 text-amber-900";
    title = "Akses Ditolak (Di Luar Jadwal) • LED Merah";
    subtitle = result.reason || "Mahasiswa terdaftar, namun tidak memiliki jadwal perkuliahan aktif di ruangan ini.";
    icon = "clock";
  } else if (active && result?.status === "success") {
    tone = "border-emerald-200 bg-emerald-50 text-emerald-800";
    title = "Akses Diizinkan (LED Hijau Menyala)";
    subtitle = result.reason || `Selamat datang, ${result.name}. Indikator LED Hijau menyala (pintu terbuka).`;
    icon = "check";
  } else if (active && result?.status === "invalid") {
    tone = "border-red-200 bg-red-50 text-red-800";
    title = "Akses Ditolak (Belum Terdaftar) • LED Merah";
    subtitle = result.reason || "Wajah tidak cocok dengan basis data civitas akademika terdaftar.";
    icon = "x";
  }

  // Format 16x2 I2C LCD lines from backend response or fallback
  const lcdLine1 =
    active && result?.lcd_line1
      ? result.lcd_line1
      : active && error
      ? "ERROR SERVER!"
      : active && !result
      ? `[${room}] SCAN...`
      : `[PINTU ${room}]`;

  const lcdLine2 =
    active && result?.lcd_line2
      ? result.lcd_line2
      : active && result?.status === "success"
      ? `${result.kelas || "MHS"} ${result.schedule_time || "OPEN"}`
      : active && !result
      ? "TUNGGU VERIF..."
      : "SIAP PINDAI...";

  const serialRows: { label: string; value: string }[] = result
    ? [
        { label: "Waktu Verifikasi", value: `${result.wib_time || "--:--:--"} WIB (${result.day || "-"})` },
        { label: "Keputusan & Status", value: `${result.decision || "DENY"} (${result.status})` },
        {
          label: "Indikator Pintu",
          value: result.status === "success" ? "LED Hijau Menyala (Kondisi 1)" : "LED Merah Menyala (Kondisi 2–5)",
        },
        { label: "Ruangan Pintu", value: result.room || room },
        { label: "Nama Terverifikasi", value: result.name || "Tidak Terdeteksi / Tidak Terdaftar" },
        { label: "Peran / NIM", value: `${result.role || "-"} / ${result.nim || "-"}` },
        { label: "Kelas Akademik", value: result.kelas || "-" },
        { label: "Mata Kuliah", value: result.subject || "-" },
        {
          label: "Jam Perkuliahan",
          value:
            result.start_time && result.end_time
              ? `${result.start_time} s/d ${result.end_time} WIB`
              : result.schedule_time || "-",
        },
        {
          label: "Jarak L2 / Threshold",
          value: result.distance !== null ? `${result.distance.toFixed(4)} (< ${result.threshold.toFixed(2)})` : "-",
        },
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* Visual Status Banner */}
      <div
        className={`flex items-start gap-4 rounded-xl border p-4 transition-colors duration-300 ${tone}`}
        role="status"
        aria-live="polite"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/80 shadow-sm mt-0.5">
          <Icon name={icon} className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm sm:text-base font-bold tracking-wide break-words">{title}</p>
          <p className="mt-1 text-xs opacity-90 break-words whitespace-normal leading-relaxed">{subtitle}</p>
        </div>
      </div>

      {/* Hardware LCD I2C 16x2 Preview Simulation */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-3">
          <span className="text-xs font-bold text-emerald-800">
            Simulasi Layar LCD I2C 16x2 (ESP32)
          </span>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono font-semibold text-slate-600 shrink-0">
            I2C 0x27 • {room}
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50/70">
          <table className="w-full text-left font-mono text-xs text-emerald-950 border-collapse">
            <tbody className="divide-y divide-emerald-200/70">
              <tr>
                <th className="w-20 bg-emerald-100/70 px-3 py-2 font-semibold text-emerald-800">Baris 1</th>
                <td className="px-3 py-2 font-bold break-words whitespace-normal">{lcdLine1}</td>
              </tr>
              <tr>
                <th className="w-20 bg-emerald-100/70 px-3 py-2 font-semibold text-emerald-800">Baris 2</th>
                <td className="px-3 py-2 font-bold break-words whitespace-normal">{lcdLine2}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Serial Monitor & JSON Output Preview (Clean Table Format + Raw JSON) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-3">
          <span className="text-xs font-bold text-slate-900">
            Serial Monitor (115200 baud) & JSON Payload
          </span>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono font-semibold text-slate-600 shrink-0">
            ESP32-CAM
          </span>
        </div>

        {!result ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
            Menunggu tangkapan frame kamera dari pintu <strong>{room}</strong> untuk menampilkan tabel hasil Serial Monitor & JSON...
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <tbody className="divide-y divide-slate-200 bg-white">
                {serialRows.map((row) => (
                  <tr key={row.label} className="hover:bg-slate-50/80">
                    <th className="w-36 bg-slate-50 px-3 py-2 font-medium text-slate-600 align-top">
                      {row.label}
                    </th>
                    <td className="px-3 py-2 font-mono font-semibold text-slate-900 break-words whitespace-normal">
                      {row.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result && (
          <details className="mt-3 text-xs font-mono text-slate-700">
            <summary className="cursor-pointer font-sans text-xs font-semibold text-indigo-700 hover:text-indigo-900 select-none">
              Lihat Raw JSON Payload (/api/recognize)
            </summary>
            <pre className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-800 whitespace-pre-wrap break-words leading-relaxed">
              {JSON.stringify(
                {
                  status: result.status,
                  decision: result.decision,
                  name: result.name,
                  role: result.role,
                  nim: result.nim,
                  kelas: result.kelas,
                  room: result.room || room,
                  subject: result.subject,
                  lecturer: result.lecturer,
                  start_time: result.start_time,
                  end_time: result.end_time,
                  schedule_time: result.schedule_time,
                  day: result.day,
                  wib_time: result.wib_time,
                  lcd_line1: result.lcd_line1,
                  lcd_line2: result.lcd_line2,
                  distance: result.distance,
                  threshold: result.threshold,
                  reason: result.reason,
                },
                null,
                2
              )}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

export default function SimulateView() {
  const webcamRef = useRef<WebcamHandle>(null);
  const inFlight = useRef(false);
  const eventKey = useRef(0);

  // Modes: "stream" (continuous) vs "capture" (single photo test)
  const [mode, setMode] = useState<"stream" | "capture">("stream");
  const [runningStream, setRunningStream] = useState(false);
  const [captureCameraOn, setCaptureCameraOn] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);

  // Single captured frame test state
  const [capturedImage, setCapturedImage] = useState<{ url: string; blob: Blob } | null>(null);
  const [isEvaluatingCapture, setIsEvaluatingCapture] = useState(false);

  // Room & Testing flags
  const [room, setRoom] = useState("GSG210");
  const [bypassSchedule, setBypassSchedule] = useState(false);

  // Results
  const [result, setResult] = useState<RecognizeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [framesSent, setFramesSent] = useState(0);

  // Local in-memory simulation events (NEVER pollutes /logs)
  const [simulationEvents, setSimulationEvents] = useState<SessionEvent[]>([]);

  // Door LED state (Green = Unlocked/Approved, Red = Locked/Denied)
  const [unlocked, setUnlocked] = useState(false);
  const unlockTimer = useRef<number | null>(null);

  // Release object URL
  useEffect(() => {
    if (!capturedImage) return;
    return () => URL.revokeObjectURL(capturedImage.url);
  }, [capturedImage]);

  // Continuous stream loop (mode === "stream")
  useEffect(() => {
    if (!runningStream || !cameraReady || mode !== "stream") return;

    const controller = new AbortController();
    let disposed = false;

    const tick = async () => {
      if (inFlight.current || disposed) return;
      inFlight.current = true;
      try {
        const frame = await webcamRef.current?.capture(CAPTURE_MAX_WIDTH, 0.8);
        if (!frame || disposed) return;

        const started = performance.now();
        // Simpan ke audit log agar tersinkron ke Dashboard (/dashboard) dan Riwayat Akses (/logs)
        const res = await api.recognize(frame.blob, {
          room,
          bypassSchedule,
          isSimulation: false,
          signal: controller.signal,
        });

        if (disposed) return;

        setResult(res);
        setLatency(Math.round(performance.now() - started));
        setLastUpdate(new Date());
        setFramesSent((n) => n + 1);
        setError(null);

        // Catat semua 5 kondisi (success, out_of_schedule, invalid, tailgating, no_face) ke log sesi simulasi
        setSimulationEvents((prev) =>
          [
            {
              key: ++eventKey.current,
              at: new Date(),
              status: res.status,
              name: res.name,
              role: res.role,
              reason: res.reason || null,
              distance: res.distance,
              room: res.room || room,
              kelas: res.kelas,
              scheduleTime: res.schedule_time,
            },
            ...prev,
          ].slice(0, 30),
        );

        if (res.status === "success") {
          setUnlocked(true);
          if (unlockTimer.current) window.clearTimeout(unlockTimer.current);
          unlockTimer.current = window.setTimeout(() => setUnlocked(false), UNLOCK_DURATION_MS);
        } else {
          setUnlocked(false);
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
  }, [runningStream, cameraReady, mode, bypassSchedule, room]);

  useEffect(
    () => () => {
      if (unlockTimer.current) window.clearTimeout(unlockTimer.current);
    },
    [],
  );

  const startStream = () => {
    setCapturedImage(null);
    setResult(null);
    setError(null);
    setRunningStream(true);
  };

  const stopStream = () => {
    setRunningStream(false);
    setResult(null);
    setError(null);
    setLatency(null);
  };

  // Single Frame Capture Test
  const handleSingleCapture = async () => {
    try {
      setIsEvaluatingCapture(true);
      setError(null);
      const frame = await webcamRef.current?.capture(CAPTURE_MAX_WIDTH, 0.92);
      if (!frame) {
        setError("Gagal mengambil gambar dari kamera. Pastikan kamera sudah menyala.");
        setIsEvaluatingCapture(false);
        return;
      }

      const blobUrl = URL.createObjectURL(frame.blob);
      setCapturedImage({ blob: frame.blob, url: blobUrl });

      const started = performance.now();
      // Simpan ke audit log agar tersinkron ke Dashboard (/dashboard) dan Riwayat Akses (/logs)
      const res = await api.recognize(frame.blob, {
        room,
        bypassSchedule,
        isSimulation: false,
      });

      setResult(res);
      setLatency(Math.round(performance.now() - started));
      setLastUpdate(new Date());
      setFramesSent((n) => n + 1);

      // Catat semua 5 kondisi (termasuk no_face) ke dalam Aktivitas Sesi Simulasi
      setSimulationEvents((prev) =>
        [
          {
            key: ++eventKey.current,
            at: new Date(),
            status: res.status,
            name: res.name,
            role: res.role,
            reason: res.reason || null,
            distance: res.distance,
            room: res.room || room,
            kelas: res.kelas,
            scheduleTime: res.schedule_time,
          },
          ...prev,
        ].slice(0, 30),
      );

      if (res.status === "success") {
        setUnlocked(true);
        if (unlockTimer.current) window.clearTimeout(unlockTimer.current);
        unlockTimer.current = window.setTimeout(() => setUnlocked(false), UNLOCK_DURATION_MS);
      } else {
        setUnlocked(false);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsEvaluatingCapture(false);
    }
  };

  // Determine boxes to render
  const boxesToRender: FaceBox[] =
    result?.all_boxes && result.all_boxes.length > 0
      ? result.all_boxes
      : result?.box
      ? [result.box]
      : [];

  const frameWidth = result?.frame.width || 640;
  const frameHeight = result?.frame.height || 480;

  const isCameraActive = mode === "stream" ? runningStream : captureCameraOn;

  const metrics: { label: string; value: string }[] = [
    {
      label: "Status Indikator LED",
      value: unlocked ? "LED Hijau Menyala (Kondisi 1 - Disetujui)" : "LED Merah Menyala (Kondisi 2–5 / Terkunci)",
    },
    {
      label: "Teridentifikasi Sebagai",
      value:
        result?.status === "success"
          ? `${result.name ?? "--"} (${result.role === "dosen" ? "Dosen" : "Mahasiswa"})`
          : result?.status === "invalid"
          ? "Belum Terdaftar"
          : result?.status === "tailgating"
          ? `Multi-Orang (${result.faces_detected} Wajah)`
          : result?.status === "out_of_schedule"
          ? `${result.name || "Mhs"} (Di Luar Jadwal)`
          : result?.status === "no_face"
          ? "Wajah Tidak Terdeteksi"
          : "--",
    },
    { label: "Ruangan Door Lock", value: room },
    { label: "Jarak Euclidean (L2)", value: formatScore(result?.distance) },
    { label: "Ambang Batas (Threshold)", value: result ? `< ${result.threshold.toFixed(2)}` : "< 0.48" },
    { label: "Jumlah Wajah", value: result ? `${result.faces_detected} orang` : "--" },
    { label: "Latensi Inferensi AI", value: latency !== null ? `${latency} ms` : "--" },
    { label: "Pembaruan Terakhir", value: lastUpdate ? formatTime(lastUpdate) : "--" },
  ];

  return (
    <>
      <PageHeader
        title="Simulasi Kamera & Door Lock Smart Classroom"
        description="Simulator live kamera pemindai wajah ESP32-CAM untuk ruang GSG 210 & GSG 211. Uji seluruh kondisi keamanan pintu (indikator LED Hijau / LED Merah & layar LCD I2C 16x2) yang otomatis tercatat ke Dashboard dan Riwayat Akses."
      />

      {/* Top Grid: Left (Camera Feed) & Right (Status, LCD I2C 16x2 & Serial Monitor) */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 mb-6 items-start">
        {/* Left Card: Camera / Capture Feed (2 cols) */}
        <section className="card xl:col-span-2" aria-labelledby="feed-heading">
          <div className="card-header flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="feed-heading" className="card-title">Pemindaian Wajah Kamera</h2>
              <p className="card-subtitle">
                Mode: {mode === "stream" ? "Realtime Streaming (tiap 1.5s)" : "Ambil Foto Uji (Single Capture)"} • Frame: {framesSent}
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setMode("stream");
                  setCapturedImage(null);
                }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition-all ${
                  mode === "stream"
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon name="video" className="h-3.5 w-3.5" />
                Live Stream
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("capture");
                  stopStream();
                  setCaptureCameraOn(true);
                }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition-all ${
                  mode === "capture"
                    ? "bg-white text-indigo-900 shadow-sm border border-indigo-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon name="camera" className="h-3.5 w-3.5" />
                Ambil Foto Uji
              </button>
            </div>
          </div>

          <div className="card-body space-y-4">
            {/* Status Bar for Stream/Capture & Room */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-mono font-semibold text-slate-800">
                <span
                  className={`h-2 w-2 rounded-full ${
                    (mode === "stream" && runningStream) || (mode === "capture" && (capturedImage || captureCameraOn))
                      ? "bg-emerald-500"
                      : "bg-slate-400"
                  }`}
                />
                {mode === "stream"
                  ? runningStream
                    ? "STREAM AKTIF (1.5s)"
                    : "STANDBY"
                  : capturedImage
                  ? "FRAME TERTANGKAP"
                  : captureCameraOn
                  ? "SIAP CAPTURE"
                  : "KAMERA NONAKTIF"}
              </span>

              <span className="rounded-full bg-secondary-50 border border-secondary-200 px-3 py-1 text-xs font-mono font-bold text-slate-900">
                Pintu Ruang {room}
              </span>
            </div>

            {/* Camera View (Responsive Full Width) */}
            {capturedImage ? (
              <div className="relative overflow-hidden rounded-lg bg-slate-950 aspect-[4/3] max-h-[460px] w-full flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={capturedImage.url}
                  alt="Captured frame test"
                  className="h-full w-full object-contain"
                  style={{ transform: MIRRORED ? "scaleX(-1)" : "none" }}
                />
                {result && (
                  <FaceBoxesOverlay
                    result={result}
                    boxes={boxesToRender}
                    frameWidth={frameWidth}
                    frameHeight={frameHeight}
                  />
                )}
              </div>
            ) : (
              <Webcam
                ref={webcamRef}
                active={isCameraActive}
                mirrored={MIRRORED}
                onReadyChange={setCameraReady}
                inactiveLabel="Kamera nonaktif. Klik Nyalakan Kamera untuk memulai simulasi."
              >
                {result && (
                  <FaceBoxesOverlay
                    result={result}
                    boxes={boxesToRender}
                    frameWidth={frameWidth}
                    frameHeight={frameHeight}
                  />
                )}
              </Webcam>
            )}

            {/* Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                {mode === "stream" ? (
                  <>
                    <button
                      id="simulate-start"
                      type="button"
                      className="btn btn-primary"
                      onClick={startStream}
                      disabled={runningStream}
                    >
                      <Icon name="play" className="h-4 w-4" />
                      Nyalakan Kamera
                    </button>
                    <button
                      id="simulate-stop"
                      type="button"
                      className="btn btn-secondary"
                      onClick={stopStream}
                      disabled={!runningStream}
                    >
                      <Icon name="stop" className="h-4 w-4" />
                      Matikan Kamera
                    </button>
                  </>
                ) : (
                  <>
                    {!captureCameraOn ? (
                      <button
                        id="simulate-capture-start-cam"
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          setCapturedImage(null);
                          setResult(null);
                          setCaptureCameraOn(true);
                        }}
                      >
                        <Icon name="play" className="h-4 w-4" />
                        Nyalakan Kamera
                      </button>
                    ) : (
                      <button
                        id="simulate-capture-btn"
                        type="button"
                        className="btn btn-primary bg-indigo-600 hover:bg-indigo-700 text-white"
                        onClick={handleSingleCapture}
                        disabled={isEvaluatingCapture || !cameraReady}
                      >
                        <Icon name="camera" className="h-4 w-4" />
                        {isEvaluatingCapture ? "Mengevaluasi Wajah..." : "Ambil Foto Uji (Capture)"}
                      </button>
                    )}

                    <button
                      id="simulate-capture-stop-cam"
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setCaptureCameraOn(false);
                        setCapturedImage(null);
                        setResult(null);
                      }}
                      disabled={!captureCameraOn && !capturedImage}
                    >
                      <Icon name="stop" className="h-4 w-4" />
                      Matikan Kamera
                    </button>

                    {capturedImage && (
                      <button
                        type="button"
                        className="btn btn-secondary text-xs"
                        onClick={() => {
                          setCapturedImage(null);
                          setResult(null);
                          setCaptureCameraOn(true);
                        }}
                      >
                        <Icon name="refresh" className="h-3.5 w-3.5" />
                        Ambil Ulang Foto
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Room & Bypass Selector */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="simulate-room" className="text-xs font-semibold text-slate-600">
                    Pintu:
                  </label>
                  <select
                    id="simulate-room"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    className="input py-1 text-xs font-semibold bg-white w-28"
                  >
                    <option value="GSG210">GSG 210</option>
                    <option value="GSG211">GSG 211</option>
                  </select>
                </div>

                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bypassSchedule}
                    onChange={(e) => setBypassSchedule(e.target.checked)}
                    className="rounded border-slate-300 text-secondary-500 focus:ring-secondary-400"
                  />
                  <span>Bypass Jadwal (Lab)</span>
                </label>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              * Setiap hasil pemindaian pada halaman ini otomatis tersinkron ke metrik Dashboard (/dashboard) dan Riwayat Akses (/logs).
            </p>
          </div>
        </section>

        {/* Right Column: Status Banner, LCD I2C 16x2 & Serial Monitor */}
        <div className="space-y-6">
          <StatusPanel
            active={
              mode === "stream"
                ? runningStream
                : Boolean(captureCameraOn || capturedImage || isEvaluatingCapture)
            }
            result={result}
            error={error}
            room={room}
          />
        </div>
      </div>

      {/* Bottom Grid (Below Camera Feed): Status Kunci Pintu (Indikator LED) & Aktivitas Sesi Simulasi */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-8 items-start">
        {/* Door Lock LED Status Card */}
        <section className="card" aria-labelledby="lock-heading">
          <div className="card-header">
            <div>
              <h2 id="lock-heading" className="card-title">Status Kunci Pintu (Indikator LED)</h2>
              <p className="card-subtitle">Representasi pintu menggunakan LED Hijau (Disetujui) & LED Merah (Ditolak)</p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1 ${
                unlocked
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              <Icon name={unlocked ? "unlock" : "lock"} className="h-3.5 w-3.5" />
              {unlocked ? "LED Hijau (Terbuka)" : "LED Merah (Terkunci)"}
            </span>
          </div>
          <dl className="divide-y divide-slate-100 text-sm">
            {metrics.map((m) => (
              <div key={m.label} className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4 px-5 py-2.5">
                <dt className="text-slate-500 text-xs shrink-0">{m.label}</dt>
                <dd className="font-semibold tabular-nums text-slate-900 text-xs sm:text-right break-words whitespace-normal">
                  {m.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Session Simulation Events (Local) */}
        <section className="card" aria-labelledby="events-heading">
          <div className="card-header">
            <div>
              <h2 id="events-heading" className="card-title">Aktivitas Sesi Simulasi</h2>
              <p className="card-subtitle">Log lokal sesi uji coba ini ({simulationEvents.length} event)</p>
            </div>
            {simulationEvents.length > 0 && (
              <button
                type="button"
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                onClick={() => setSimulationEvents([])}
              >
                Bersihkan
              </button>
            )}
          </div>

          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {simulationEvents.length === 0 && (
              <li className="px-5 py-8 text-center text-xs text-slate-400">
                Belum ada aktivitas pemindaian pada sesi ini.
              </li>
            )}
            {simulationEvents.map((ev) => {
              const isMultiPerson = ev.status === "tailgating";
              const isSuccess = ev.status === "success";
              const isOutOfSchedule = ev.status === "out_of_schedule";
              const isNoFace = ev.status === "no_face";

              const eventIcon: "check" | "clock" | "alertTriangle" | "camera" | "x" = isSuccess
                ? "check"
                : isOutOfSchedule
                ? "clock"
                : isMultiPerson
                ? "alertTriangle"
                : isNoFace
                ? "camera"
                : "x";

              const textColor = isSuccess
                ? "text-emerald-800"
                : isMultiPerson
                ? "text-purple-700"
                : isOutOfSchedule
                ? "text-amber-700"
                : isNoFace
                ? "text-slate-700"
                : "text-red-700";

              const titleLabel = isSuccess
                ? `${ev.name} • LED Hijau (Disetujui)`
                : isMultiPerson
                ? "Deteksi Multi-Orang (>1 Orang) • LED Merah"
                : isOutOfSchedule
                ? `${ev.name || "Mahasiswa"} (Di Luar Jadwal) • LED Merah`
                : isNoFace
                ? "Wajah Tidak Terdeteksi • LED Merah"
                : "Wajah Belum Terdaftar • LED Merah";

              return (
                <li key={ev.key} className="flex flex-col gap-1 px-4 py-3 text-xs transition-colors hover:bg-slate-50">
                  <div className="flex flex-wrap items-center gap-2">
                    <Icon name={eventIcon} className={`h-4 w-4 shrink-0 ${textColor}`} />
                    <span className="font-mono text-[11px] tabular-nums text-slate-500">{formatTime(ev.at)}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
                      {ev.room || room}
                    </span>
                    <span className={`min-w-0 flex-1 font-semibold break-words whitespace-normal ${textColor}`}>
                      {titleLabel}
                    </span>
                    {ev.distance !== null && (
                      <span className="font-mono text-[10px] tabular-nums text-slate-400">
                        L2: {formatScore(ev.distance)}
                      </span>
                    )}
                  </div>
                  {ev.reason && (
                    <p className="pl-6 text-[11px] text-slate-600 break-words whitespace-normal leading-relaxed">
                      {ev.reason}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* 5 Comprehensive Smart Classroom Door Lock Scenarios Reference */}
      <section className="card p-6" aria-labelledby="scenarios-heading">
        <div className="mb-4">
          <h3 id="scenarios-heading" className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Icon name="shield" className="h-5 w-5 text-secondary-500 shrink-0" />
            <span>5 Skenario Evaluasi Akses Pintu Smart Classroom (Indikator LED Hijau & Merah)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Panduan kondisi verifikasi biometrik wajah dan respons indikator LED pintu pada ESP32-CAM:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* Kondisi 1 */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 rounded-md px-2 py-0.5 shrink-0">
                Kondisi 1
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs">
                <Icon name="unlock" className="h-3.5 w-3.5 shrink-0" />
                LED Hijau (Disetujui)
              </span>
            </div>
            <p className="font-bold text-xs text-emerald-950">Wajah Terdaftar & Sesuai Jadwal</p>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              Mahasiswa/Dosen terdaftar dan sedang ada jadwal perkuliahan aktif di ruangan tersebut. LED Hijau menyala (akses pintu dibuka).
            </p>
          </div>

          {/* Kondisi 2 */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 rounded-md px-2 py-0.5 shrink-0">
                Kondisi 2
              </span>
              <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-xs">
                <Icon name="lock" className="h-3.5 w-3.5 shrink-0" />
                LED Merah (Ditolak)
              </span>
            </div>
            <p className="font-bold text-xs text-amber-950">Di Luar Jadwal / Bukan Kelasnya</p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Mahasiswa terdaftar, namun ruangan ini tidak ada jadwal kelasnya saat ini. LED Merah menyala & LCD menampilkan info penolakan.
            </p>
          </div>

          {/* Kondisi 3 */}
          <div className="rounded-xl border border-red-200 bg-red-50/60 p-4 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-red-800 bg-red-100 rounded-md px-2 py-0.5 shrink-0">
                Kondisi 3
              </span>
              <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-xs">
                <Icon name="lock" className="h-3.5 w-3.5 shrink-0" />
                LED Merah (Ditolak)
              </span>
            </div>
            <p className="font-bold text-xs text-red-950">Wajah Belum Terdaftar</p>
            <p className="text-[11px] text-red-800 leading-relaxed">
              Wajah terdeteksi 1 orang tetapi fitur embedding tidak cocok dengan basis data terdaftar. LED Merah menyala (pintu terkunci).
            </p>
          </div>

          {/* Kondisi 4 */}
          <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-4 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-purple-800 bg-purple-100 rounded-md px-2 py-0.5 shrink-0">
                Kondisi 4
              </span>
              <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-xs">
                <Icon name="lock" className="h-3.5 w-3.5 shrink-0" />
                LED Merah (Ditolak)
              </span>
            </div>
            <p className="font-bold text-xs text-purple-950">Deteksi Multi-Orang (&gt;1)</p>
            <p className="text-[11px] text-purple-800 leading-relaxed">
              Terdeteksi 2 atau lebih wajah sekaligus di depan kamera. LED Merah menyala untuk mencegah masuk bersamaan.
            </p>
          </div>

          {/* Kondisi 5 */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-700 bg-slate-200 rounded-md px-2 py-0.5 shrink-0">
                Kondisi 5
              </span>
              <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-xs">
                <Icon name="lock" className="h-3.5 w-3.5 shrink-0" />
                LED Merah (Ditolak)
              </span>
            </div>
            <p className="font-bold text-xs text-slate-900">Wajah Tidak Terdeteksi</p>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Foto gelap, blur, atau tidak ada orang di depan frame. LED Merah menyala dan LCD meminta pengguna berdiri tepat di depan kamera.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
