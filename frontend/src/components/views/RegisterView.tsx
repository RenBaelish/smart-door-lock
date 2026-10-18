"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Icon from "@/components/Icon";
import PageHeader from "@/components/PageHeader";
import Webcam, { type WebcamHandle } from "@/components/Webcam";
import { api, errorMessage, type User } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

interface Captured {
  blob: Blob;
  url: string;
}

type Notice = { type: "success" | "error"; text: string } | null;

export default function RegisterView() {
  const webcamRef = useRef<WebcamHandle>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [captured, setCaptured] = useState<Captured | null>(null);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Release the preview object URL whenever it is replaced or the page unmounts.
  useEffect(() => {
    if (!captured) return;
    return () => URL.revokeObjectURL(captured.url);
  }, [captured]);

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await api.users());
      setUsersError(null);
    } catch (err) {
      setUsersError(errorMessage(err));
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCapture = async () => {
    const frame = await webcamRef.current?.capture(800, 0.92);
    if (!frame) {
      setNotice({ type: "error", text: "Could not capture a frame. Make sure the camera is running." });
      return;
    }
    setCaptured({ blob: frame.blob, url: URL.createObjectURL(frame.blob) });
    setCameraOn(false);
    setNotice(null);
  };

  const handleRetake = () => {
    setCaptured(null);
    setCameraOn(true);
    setNotice(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNotice({ type: "error", text: "Enter the full name of the user." });
      return;
    }
    if (!captured) {
      setNotice({ type: "error", text: "Capture a face photo before registering." });
      return;
    }

    setSubmitting(true);
    setNotice(null);
    try {
      const user = await api.register(trimmed, captured.blob);
      const extra = user.faces_detected > 1 ? ` ${user.faces_detected} faces were in frame; the largest one was enrolled.` : "";
      setNotice({ type: "success", text: `User "${user.name}" registered with ID ${user.id}.${extra}` });
      setName("");
      setCaptured(null);
      loadUsers();
    } catch (err) {
      setNotice({ type: "error", text: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (!window.confirm(`Delete "${user.name}"? Their face data will be removed and past logs will show as Unknown.`)) return;
    setDeletingId(user.id);
    try {
      await api.deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      setUsersError(errorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const step = captured ? (name.trim() ? 4 : 3) : cameraReady ? 2 : 1;
  const steps = ["Start camera", "Capture photo", "Enter name", "Register"];

  return (
    <>
      <PageHeader
        title="Register User"
        description="Enroll a new person. Use a well-lit, front-facing photo with only the subject close to the camera."
      />

      <ol className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Enrollment progress">
        {steps.map((label, i) => {
          const n = i + 1;
          const done = n < step;
          const current = n === step;
          return (
            <li
              key={label}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium ${
                current
                  ? "border-blue-200 bg-blue-50 text-blue-800"
                  : done
                    ? "border-slate-200 bg-white text-slate-700"
                    : "border-slate-200 bg-white text-slate-400"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                  current ? "bg-blue-700 text-white" : done ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {n}
              </span>
              {label}
            </li>
          );
        })}
      </ol>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section className="card lg:col-span-3" aria-labelledby="capture-heading">
          <div className="card-header">
            <div>
              <h2 id="capture-heading" className="card-title">Face Capture</h2>
              <p className="card-subtitle">Position the face in the center of the frame</p>
            </div>
            {cameraOn && cameraReady && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                Live
              </span>
            )}
          </div>
          <div className="card-body space-y-4">
            <div className="relative">
              <Webcam
                ref={webcamRef}
                active={cameraOn}
                onReadyChange={setCameraReady}
                inactiveLabel={captured ? "" : "Camera is off. Press Start Camera to begin."}
              >
                <div className="absolute left-1/2 top-1/2 h-[70%] w-[40%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-dashed border-white/50" />
              </Webcam>
              {captured && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={captured.url}
                  alt="Captured face preview"
                  className="absolute inset-0 h-full w-full rounded-md bg-slate-950 object-contain"
                  style={{ transform: "scaleX(-1)" }}
                />
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {!captured && !cameraOn && (
                <button id="register-start-camera" type="button" className="btn btn-dark" onClick={() => setCameraOn(true)}>
                  <Icon name="play" className="h-4 w-4" />
                  Start Camera
                </button>
              )}
              {!captured && cameraOn && (
                <>
                  <button
                    id="register-capture"
                    type="button"
                    className="btn btn-primary"
                    onClick={handleCapture}
                    disabled={!cameraReady}
                  >
                    <Icon name="camera" className="h-4 w-4" />
                    Capture Photo
                  </button>
                  <button id="register-stop-camera" type="button" className="btn btn-secondary" onClick={() => setCameraOn(false)}>
                    <Icon name="stop" className="h-4 w-4" />
                    Stop Camera
                  </button>
                </>
              )}
              {captured && (
                <button id="register-retake" type="button" className="btn btn-secondary" onClick={handleRetake} disabled={submitting}>
                  <Icon name="refresh" className="h-4 w-4" />
                  Retake Photo
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="card lg:col-span-2" aria-labelledby="details-heading">
          <div className="card-header">
            <div>
              <h2 id="details-heading" className="card-title">User Details</h2>
              <p className="card-subtitle">The name shown when access is granted</p>
            </div>
          </div>
          <form className="card-body space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="register-name" className="label">Full name</label>
              <input
                id="register-name"
                name="name"
                type="text"
                autoComplete="name"
                maxLength={100}
                placeholder="e.g. Jane Doe"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div>
              <span className="label">Photo</span>
              <div
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                  captured ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                <Icon name={captured ? "check" : "camera"} className="h-4 w-4" />
                {captured ? `Captured (${Math.round(captured.blob.size / 1024)} KB)` : "No photo captured yet"}
              </div>
            </div>

            {notice && (
              <div role="status" className={`alert ${notice.type === "success" ? "alert-success" : "alert-error"}`}>
                {notice.text}
              </div>
            )}

            <button
              id="register-submit"
              type="submit"
              className="btn btn-primary w-full"
              disabled={submitting || !captured || !name.trim()}
            >
              {submitting ? "Registering..." : "Register"}
            </button>
          </form>
        </section>
      </div>

      <section className="card mt-6" aria-labelledby="users-heading">
        <div className="card-header">
          <div>
            <h2 id="users-heading" className="card-title">Registered Users</h2>
            <p className="card-subtitle">{users.length} enrolled</p>
          </div>
        </div>
        {usersError && <div className="alert alert-error m-5">{usersError}</div>}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="th">ID</th>
                <th scope="col" className="th">Name</th>
                <th scope="col" className="th">Registered</th>
                <th scope="col" className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="td font-mono text-xs text-slate-500">#{u.id}</td>
                  <td className="td font-medium text-slate-900">{u.name}</td>
                  <td className="td tabular-nums">{formatDateTime(u.created_at)}</td>
                  <td className="td text-right">
                    <button
                      id={`delete-user-${u.id}`}
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(u)}
                      disabled={deletingId === u.id}
                    >
                      <Icon name="trash" className="h-3.5 w-3.5" />
                      {deletingId === u.id ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
              {!usersLoading && users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-500">
                    No users registered yet.
                  </td>
                </tr>
              )}
              {usersLoading && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-400">
                    Loading users...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
