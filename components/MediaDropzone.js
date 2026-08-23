"use client";
import { useRef, useState } from "react";
import { ref as sref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

function safeName(name) {
  return String(name || "file")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
}

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
    setProgress(0);
    try {
      const path = `rooms/${roomCode || "shared"}/${Date.now()}-${safeName(file.name)}`;
      const fileRef = sref(storage, path);
      const task = uploadBytesResumable(fileRef, file, {
        contentType: file.type || undefined,
      });

      await new Promise((resolve, reject) => {
        task.on(
          "state_changed",
          (snap) => {
            if (snap.totalBytes > 0) {
              setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
            }
          },
          reject,
          resolve
        );
      });

      const url = await getDownloadURL(task.snapshot.ref);
      onUploaded?.(url);
    } catch (e) {
      const msg = String(e?.code || e?.message || e);
      if (/cors|network|ERR_FAILED|storage\/unauthorized|permission/i.test(msg) || e?.name === "FirebaseError") {
        setErr(
          "Upload fail — Firebase Storage CORS / rules set nahi hain. Neeche URL paste karo, ya README mein Storage setup follow karo."
        );
      } else {
        setErr("Upload fail ho gaya. URL manually paste kar sakte ho.");
      }
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
