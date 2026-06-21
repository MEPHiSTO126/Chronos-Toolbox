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
│   ├── image-editor/           # 🔜 Planned
│   └── qr-generator/           # 🔜 Planned
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

> **Browser tools** use `pdf-lib` and `PDF.js` — files never leave your device.  
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
| Backend | Python 3.11, FastAPI, Uvicorn |
| PDF → Word | `pdf2docx` |
| Word/PPTX → PDF | LibreOffice headless (Docker) / `docx2pdf` (Windows) |
| Containerisation | Docker |
| Frontend hosting | Vercel |
| Backend hosting | Render |

---

## 📄 License

MIT — free to use, fork, and build on.
