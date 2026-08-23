"use client";
import { useRef, useState } from "react";

export default function MediaDropzone({ kind, onUploaded, roomCode, compact }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState("");

  const accept = kind === "image" ? "image/*,.gif" : "video/*,.mp4,.webm,.mov";
  const label = kind === "image" ? "Image / GIF" : "Video";
  const hint = kind === "image" ? "PNG, JPG, GIF" : "MP4, WebM, MOV";

  async function upload(file) {
    if (!file) return;
    setErr("");
    setBusy(true);
    setProgress(15);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("roomCode", roomCode || "shared");

      setProgress(40);
      const res = await fetch("/api/upload", { method: "POST", body });
      setProgress(85);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Upload failed (${res.status})`);
      }
      if (!data.url) throw new Error("No URL returned");
      setProgress(100);
      onUploaded?.(data.url);
    } catch (e) {
      setErr(
        e?.message ||
          "Upload failed. Paste a URL below instead (YouTube / image link works without Storage)."
      );
    } finally {
      setBusy(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  }

  return (
    <div className={`dropzone-wrap ${compact ? "compact" : ""}`}>
      <div
        className={`dropzone ${kind} ${dragOver ? "over" : ""} ${busy ? "busy" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !busy && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          hidden
          onChange={(e) => upload(e.target.files?.[0])}
        />
        {busy ? (
          <div className="dz-progress">
            <span>Uploading… {progress}%</span>
            <div className="dz-bar">
              <i style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <>
            <span className="dz-icon">{kind === "image" ? "🖼️" : "🎬"}</span>
            <span className="dz-title">Drop {label}</span>
            <span className="dz-hint">{hint} · or tap to browse</span>
          </>
        )}
      </div>
      {err && <p className="small dz-err">{err}</p>}
    </div>
  );
}
