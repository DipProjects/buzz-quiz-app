import { NextResponse } from "next/server";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

export const runtime = "nodejs";

function storage() {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getStorage(app);
}

function safeName(name) {
  return String(name || "file")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
}

export async function POST(request) {
  try {
    if (!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
      return NextResponse.json({ error: "Storage bucket not configured" }, { status: 500 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const roomCode = String(form.get("roomCode") || "shared").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "shared";

    if (!file || typeof file === "string" || !file.arrayBuffer) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const type = file.type || "application/octet-stream";
    if (!type.startsWith("image/") && !type.startsWith("video/")) {
      return NextResponse.json({ error: "Only image or video files allowed" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
    }

    const path = `rooms/${roomCode}/${Date.now()}-${safeName(file.name)}`;
    const fileRef = ref(storage(), path);
    await uploadBytes(fileRef, buf, { contentType: type });
    const url = await getDownloadURL(fileRef);
    return NextResponse.json({ url });
  } catch (e) {
    console.error("upload error", e);
    return NextResponse.json(
      { error: e?.message || "Upload failed. Check Storage rules / bucket." },
      { status: 500 }
    );
  }
}
