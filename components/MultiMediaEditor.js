"use client";
import { useState } from "react";
import MediaDropzone from "@/components/MediaDropzone";
import { resolveMedia } from "@/lib/questions";

export default function MultiMediaEditor({ media = [], onChange, roomCode }) {
  const [urlDraft, setUrlDraft] = useState("");
  const [urlKind, setUrlKind] = useState("image");

  function addItem(kind, url) {
    const clean = String(url || "").trim();
    if (!clean) return;
    onChange([...(media || []), { kind, url: clean }]);
  }

  function removeAt(i) {
    onChange((media || []).filter((_, idx) => idx !== i));
  }

  function addFromUrl() {
    addItem(urlKind, urlDraft);
    setUrlDraft("");
  }

  return (
    <div className="media-editor">
      <div className="media-editor-head">
        <span className="media-editor-title">Media attachments</span>
        <span className="media-editor-count">{(media || []).length} added</span>
      </div>
      <p className="small media-editor-sub">
        Kitni bhi images aur videos add kar sakte ho — pehle upload / URL, fir list mein aa jayegi.
      </p>

      {(media || []).length > 0 && (
        <ul className="media-chip-list">
          {media.map((m, i) => (
            <li key={`${m.kind}-${i}-${m.url}`} className={`media-chip ${m.kind}`}>
              <MediaThumb kind={m.kind} url={m.url} />
              <div className="media-chip-meta">
                <span className="media-chip-kind">{m.kind === "image" ? "Image / GIF" : "Video / Reel"}</span>
                <span className="media-chip-url" title={m.url}>{shortUrl(m.url)}</span>
              </div>
              <button type="button" className="media-chip-x" onClick={() => removeAt(i)} aria-label="Remove">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="media-add-grid">
        <MediaDropzone
          kind="image"
          roomCode={roomCode}
          compact
          onUploaded={(url) => addItem("image", url)}
        />
        <MediaDropzone
          kind="video"
          roomCode={roomCode}
          compact
          onUploaded={(url) => addItem("video", url)}
        />
      </div>

      <div className="media-url-row">
        <div className="media-kind-toggle" role="group" aria-label="URL type">
          <button
            type="button"
            className={urlKind === "image" ? "on" : ""}
            onClick={() => setUrlKind("image")}
          >
            Image URL
          </button>
          <button
            type="button"
            className={urlKind === "video" ? "on" : ""}
            onClick={() => setUrlKind("video")}
          >
            Video / Reel URL
          </button>
        </div>
        <div className="media-url-input">
          <input
            type="text"
            placeholder={
              urlKind === "image"
                ? "Paste image / GIF link…"
                : "Paste YouTube, Instagram Reel, or .mp4 link…"
            }
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addFromUrl();
              }
            }}
          />
          <button type="button" className="btn primary media-url-add" onClick={addFromUrl} disabled={!urlDraft.trim()}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function shortUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 28 ? u.pathname.slice(0, 28) + "…" : u.pathname;
    return u.hostname + path;
  } catch {
    return url.length > 40 ? url.slice(0, 40) + "…" : url;
  }
}

function MediaThumb({ kind, url }) {
  if (kind === "image") {
    return (
      <div className="media-thumb">
        <img src={url} alt="" />
      </div>
    );
  }
  const resolved = resolveMedia(url);
  if (resolved?.type === "youtube") {
    return <div className="media-thumb placeholder">▶ YT</div>;
  }
  if (resolved?.type === "instagram") {
    return <div className="media-thumb placeholder">IG</div>;
  }
  return <div className="media-thumb placeholder">▶</div>;
}
