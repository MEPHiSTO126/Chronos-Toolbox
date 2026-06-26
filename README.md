# ⚙️ Chronos Toolbox

A growing suite of clean, fast, free, and private web-based utility tools — all living in one monorepo.

- **Frontend** → Deployed on [Vercel](https://vercel.com)
- **Backend API** → Deployed on [Render](https://render.com) (Docker container)
- **Privacy-first** → Browser-only tools never upload your files. Backend tools process files ephemerally and never store them.

---

## 🗂️ Project Structure

```
Chronos-Toolbox/
├── apps/
│   ├── home/                   # Landing hub — lists all tool categories
│   ├── doc-converter/          # 11 document tools (PDF, Word, PPTX, Audio…)
│   │   └── tools/
│   │       ├── pdf-to-word/        ← Backend
│   │       ├── word-to-pdf/        ← Backend
│   │       ├── pptx-to-pdf/        ← Backend
│   │       ├── pdf-to-jpg/         ← Browser
│   │       ├── jpg-to-pdf/         ← Browser
│   │       ├── merge-pdf/          ← Browser
│   │       ├── split-pdf/          ← Browser
│   │       ├── rotate-pdf/         ← Browser
│   │       ├── page-deleter/       ← Browser
│   │       ├── rearrange-pdf/      ← Browser
│   │       └── pdf-to-audio/       ← Browser
│   ├── image-editor/           # 12 image tools (Convert, Resize, Filters...)
│   │   └── tools/
│   │       ├── image-converter/    ← Browser
│   │       ├── heic-to-jpg/        ← Browser
│   │       ├── crop-resize/        ← Browser
│   │       ├── filters-effects/    ← Browser
│   │       ├── rotate-flip/        ← Browser
│   │       ├── compress-image/     ← Browser
│   │       ├── add-text/           ← Browser
│   │       ├── add-border/         ← Browser
│   │       ├── round-crop/         ← Browser
│   │       ├── combine-images/     ← Browser
│   │       ├── add-watermark/      ← Browser
│   │       └── filter-adder/       ← Browser
│   ├── qr-generator/           # 🔜 Planned
│   └── media-converter/        # Media Tools (Video & Audio)
│       └── tools/
│           ├── video-to-audio/     ← Backend
│           ├── audio-to-text/      ← Backend
│           ├── multiply-audio/     ← Browser
│           ├── vocal-splitter/     ← Backend
│           ├── instrumental-extractor/ ← Backend
│           ├── social-downloader/  ← Backend
│           ├── compress-video/     ← Backend
│           ├── video-to-gif/       ← Backend
│           ├── video-converter/    ← Backend
│           └── audio-manipulator/  ← Browser
│
└── packages/
    └── images/                 # Shared brand assets (logos, icons)
```

> **Note:** The backend Python API has been moved to its own private repository (`Chronos-Backend`) to keep this frontend repository strictly client-side and clean.

---

## 🛠️ Tool Reference

### Doc Converter (`apps/doc-converter`)

| Tool | Processing | Multi-file |
|---|---|---|
| PDF to Word | 🖥️ Backend | ✅ |
| Word to PDF | 🖥️ Backend | ✅ |
| PowerPoint to PDF | 🖥️ Backend | ✅ |
| PDF to JPG | 🌐 Browser | ✅ |
| JPG to PDF | 🌐 Browser | ✅ |
| Merge PDF | 🌐 Browser | ✅ |
| Split PDF | 🌐 Browser | ✅ |
| Rotate PDF | 🌐 Browser | ✅ |
| PDF Page Deleter | 🌐 Browser | — |
| Rearrange PDF | 🌐 Browser | — |
| PDF to Audio | 🌐 Browser | ✅ Queue |

### Image Editor (`apps/image-editor`)

| Tool | Processing | Description |
|---|---|---|
| Image Converter | 🌐 Browser | Convert between PNG, JPG, and WEBP formats |
| HEIC to JPG | 🌐 Browser | Convert Apple HEIC/HEIF images to standard JPG |
| Crop & Resize | 🌐 Browser | Crop with drag handles & scale dimensions |
| Filters & Effects | 🌐 Browser | Custom adjustments (brightness, blur) + watermark |
| Rotate & Flip | 🌐 Browser | Rotate angles & mirror images |
| Compress Image | 🌐 Browser | Reduce file size via quality parameters |
| Add Text to Image | 🌐 Browser | Overlay custom drag-positionable text |
| Add Border / Frame | 🌐 Browser | Add colored border frame options |
| Round / Circle Crop| 🌐 Browser | Clip image to circles for avatars |
| Combine Images | 🌐 Browser | Layout multiple images in grids/vertical/horizontal |
| Add Watermark | 🌐 Browser | Apply repeating/single watermark stamps |
| Filter Adder | 🌐 Browser | Design custom color filters using a 4x5 color matrix |

### Media Converter (`apps/media-converter`)

| Tool | Processing | Description |
|---|---|---|
| Video to Audio | 🖥️ Backend | Extract audio tracks (MP3/WAV) from video files |
| Audio to Text | 🖥️ Backend | Transcribe spoken words in audio to text files |
| Multiply Audio | 🌐 Browser | Loop and overlay audio onto itself N times |
| Vocal Splitter | 🖥️ Backend | Separate vocals from background music/accompaniment |
| Instrumental Extractor | 🖥️ Backend | Extract background music/instrumentals from any song |
| Social Downloader | 🖥️ Backend | Download video/audio from Twitter, YouTube, TikTok, Instagram, etc. |
| Compress Video | 🖥️ Backend | Reduce video size by adjusting bitrate & resolution |
| Video ↔ GIF | 🖥️ Backend | Convert videos to GIF animations and vice versa |
| Video Converter | 🖥️ Backend | Convert between MP4, WebM, MKV, AVI, and MOV |
| Audio Manipulator | 🌐 Browser | Trim, fade, change amplitude (volume), and speed |

> **Browser tools** use client-side APIs (Canvas, `pdf-lib`, `PDF.js`, `heic2any`, Web Audio API) — files never leave your device.  
> **Backend tools** send the file to the FastAPI server, which converts and returns the result immediately. No files are stored.

---

## 🚀 Running Locally

### Frontend

Open any `index.html` directly in your browser. No build step needed — it's vanilla HTML/CSS/JS.

### Backend

The backend is housed in a separate private repository. If you have access, run it using Python/Uvicorn or Docker as detailed in its own `README.md`.

---

## ☁️ Deployment

### Frontend → Vercel

1. Import the repo from your [Vercel Dashboard](https://vercel.com/dashboard).
2. Set **Framework Preset** to `Other`.
3. Leave **Root Directory** as `./`.
4. Deploy. The `vercel.json` at the root handles routing.

### Backend → Render

The backend is deployed automatically to Render from the private `Chronos-Backend` repository.

---

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML, CSS, JavaScript |
| PDF manipulation | `pdf-lib`, `PDF.js`, `JSZip` |
| Image manipulation | HTML5 Canvas API, `heic2any` (HEIC decoder) |
| Backend | Python 3.11, FastAPI, Uvicorn |
| PDF → Word | `pdf2docx` |
| Word/PPTX → PDF | LibreOffice headless (Docker) / `docx2pdf` (Windows) |
| Video / Audio backend | FFmpeg, `yt-dlp`, Whisper, Spleeter/Demucs |
| Containerisation | Docker |
| Frontend hosting | Vercel |
| Backend hosting | Render |

---

## 📄 License

MIT — free to use, fork, and build on.
