# Buzz-In Live — Real-Time Team Buzzer Quiz

Kahoot-style quiz library + live PIN. Buzz window **10s** (sabko dikhe), jawab **20s**;
miss/timeout/wrong → #2 buzz, phir #3… Media items unlimited.

---

## 🚨 Pehli baar? Firebase pe YE sab karo (abhi kuch nahi kiya toh yahan se)

### A) Project + Realtime Database
1. https://console.firebase.google.com → **Add project**
2. **Build → Realtime Database → Create** → test mode → Enable
3. ⚙️ **Project settings → Your apps → Web (`</>`)** → Register
4. Jo config dikhe (`apiKey`, `authDomain`, `databaseURL`, `projectId`,
   `storageBucket`, `messagingSenderId`, `appId`) — **copy**

### B) Database Rules (Publish zaroori)
Realtime Database → **Rules** → ye paste → **Publish**:

```json
{
  "rules": {
    "rooms": { "$code": { ".read": true, ".write": true } },
    "hosts": { "$hostId": { ".read": true, ".write": true } },
    ".read": false,
    ".write": false
  }
}
```

### C) Storage (image/video upload ke liye)
1. **Build → Storage → Get started**
2. Storage → **Rules** → repo wali `storage.rules` paste → Publish
3. PC pe [gcloud SDK](https://cloud.google.com/sdk/docs/install) →:

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gsutil cors set cors.json gs://YOUR_STORAGE_BUCKET
```

(`cors.json` repo mein hai. Bucket = settings wali `storageBucket` value.)

### D) Vercel env (deploy)
Vercel project → Environment Variables mein ye 7 daalo:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_DATABASE_URL`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Phir Redeploy. Bina iske app Firebase se baat nahi karegi.

---

## Step 1: Firebase project banao (detail)

1. https://console.firebase.google.com par jao, Google account se login karo
2. "Add project" → koi bhi naam do (jaise "buzz-quiz") → Create
3. Left sidebar mein "Build" → "Realtime Database" → "Create Database"
   → koi bhi region choose karo → **"Start in test mode"** select karo → Enable
4. Ab left sidebar mein gear icon (⚙️) → "Project settings"
5. Neeche scroll karo "Your apps" section tak → web icon `</>` pe click karo
6. App ka koi naam do → "Register app"
7. Ab tumhe ek `firebaseConfig` object dikhega jisme ye cheezein hongi:
   `apiKey`, `authDomain`, `databaseURL`, `projectId`, `storageBucket`,
   `messagingSenderId`, `appId` — **ye saari values copy kar lo**, agle step mein chahiye

## Step 2: Realtime Database security rules set karo

Realtime Database → "Rules" tab mein jaake ye paste karo (`/rooms` live games,
`/hosts` quiz library — Kahoot-style saved quizzes):

```json
{
  "rules": {
    "rooms": {
      "$code": {
        ".read": true,
        ".write": true
      }
    },
    "hosts": {
      "$hostId": {
        ".read": true,
        ".write": true
      }
    },
    ".read": false,
    ".write": false
  }
}
```

**Zaroori:** Purani rules mein sirf `rooms` tha — ab `hosts` bhi add karo, warna
My Quizzes save nahi hogi.

"Publish" dabao.

## Step 2b: Firebase Storage enable + CORS (uploads ke liye ZAROORI)

Console errors jaise `CORS policy` / `firebasestorage.googleapis.com` / `ERR_FAILED`
tab aate hain jab Storage on nahi hai, rules lock hain, ya CORS set nahi hai.
Uploads **code se fix nahi hote** — Firebase side pe ye 3 steps karo:

### A) Storage enable karo
1. Firebase Console → left sidebar **Build → Storage → Get started**
2. Start in **test mode** (baad mein rules set karenge) → region choose → Done
3. Project Settings → General → `storageBucket` check karo
   (usually `YOUR_PROJECT_ID.appspot.com` ya `YOUR_PROJECT_ID.firebasestorage.app`)
4. Vercel / `.env.local` mein `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` **bilkul same** value hona chahiye

### B) Storage Rules publish karo
Storage → **Rules** tab → ye paste karke **Publish**:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /rooms/{roomId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.resource.size < 50 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*|video/.*');
    }
  }
}
```

(Repo mein `storage.rules` file bhi hai — wahi copy kar sakte ho.)

### C) CORS set karo (Vercel domain se upload ke liye)
Computer pe [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) install karo, phir:

```bash
# login + project select
gcloud auth login
gcloud config set project YOUR_FIREBASE_PROJECT_ID

# repo ke root se (jahan cors.json hai)
gsutil cors set cors.json gs://YOUR_STORAGE_BUCKET
```

`YOUR_STORAGE_BUCKET` = env wali `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` value
(example: `gs://buzz-quiz.appspot.com`).

`cors.json` already repo mein hai — saari origins allow karta hai (quiz host uploads ke liye).

**Bina CORS ke temporary workaround:** image/video ko Google Drive / Imgur / YouTube pe rakho
aur app mein **URL paste** karo — dropzone upload ke bina bhi kaam karega.

## Step 3: Code ko GitHub par daalo

1. https://github.com par account banao (agar nahi hai)
2. Naya repository banao (jaise "buzz-quiz-app")
3. Is poori folder ka content us repo mein push karo (GitHub Desktop app
   use kar sakte ho agar command line se comfortable nahi ho — bas
   folder select karke "Publish repository" dabao)

## Step 4: Vercel par deploy karo (free)

1. https://vercel.com par jao, "Continue with GitHub" se sign up karo
2. "Add New" → "Project" → apna GitHub repo select karo → "Import"
3. Deploy karne se pehle, "Environment Variables" section kholo aur
   Step 1 mein copy ki hui saari 7 values yahan daalo:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_DATABASE_URL`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
4. "Deploy" dabao — 1-2 minute mein tumhara app live ho jayega
5. Vercel tumhe ek URL dega (jaise `buzz-quiz-app.vercel.app`) — **yehi
   link sabke saath share karo**

## Kaise khelein (Kahoot-style)

1. **Host:** site → **Host — My Quizzes** → **Create Quiz**
2. Kitne chahe rounds / questions / media items add karo (auto-save)
3. **Host** → bada **6-digit PIN** (lobby)
4. Teams: **Enter PIN to Join**
5. Host **Start** → har question pe:
   - **10s buzz** (sab screens pe same timer) → queue #1, #2, #3…
   - **#1 ko 20s** jawab; miss/wrong/timeout → **#2**, phir **#3**
6. Agli baar: **My Quizzes** — quizzes wahi milengi; naya Host = naya PIN

## Local testing (optional, deploy karne se pehle test karna ho toh)

```bash
npm install
cp .env.local.example .env.local   # fir isme Firebase values bhar do
npm run dev
```

Phir http://localhost:3000 kholo.
