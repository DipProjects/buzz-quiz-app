"use client";
import { resolveMedia, normalizeMediaList } from "@/lib/questions";

function MediaBlock({ kind, url }) {
  if (kind === "image") {
    return (
      <div className="qmedia">
        <img src={url} alt="" />
      </div>
    );
  }

  const media = resolveMedia(url);
  if (!media) return null;

  if (media.type === "youtube") {
    return (
      <div className="qmedia">
        <iframe src={media.src} allowFullScreen allow="autoplay; encrypted-media" title="YouTube" />
      </div>
    );
  }

  if (media.type === "instagram") {
    return (
      <div className="qmedia insta">
        <iframe src={media.src} allowFullScreen scrolling="no" title="Instagram" />
      </div>
    );
  }

  if (media.type === "file-video") {
    return (
      <div className="qmedia">
        <video src={media.src} controls playsInline />
      </div>
    );
  }

  return (
    <div className="qmedia link">
      <a className="btn ghost" href={media.src} target="_blank" rel="noreferrer">
        ▶ Open video / reel
      </a>
    </div>
  );
}

// Renders all attached images + videos/reels for a question or media item.
// Supports legacy { img, video } and new { media: [{ kind, url }] }.
export default function QuestionMedia({ img, video, media }) {
  const list = normalizeMediaList({ img, video, media });
  if (list.length === 0) return null;

  return (
    <div className="qmedia-stack">
      {list.map((m, i) => (
        <MediaBlock key={`${m.kind}-${i}-${m.url}`} kind={m.kind} url={m.url} />
      ))}
    </div>
  );
}
