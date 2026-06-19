# ⚙️ Chronos Toolbox

A growing suite of clean, fast, everyday web-based utility tools — all living in one monorepo.

## 🗂️ Structure

```
chronos-toolbox/
├── apps/
│   ├── doc-converter/   # Word ↔ PDF, PDF → Audio, and more
│   ├── image-editor/    # Brightness, contrast, resize, filters
│   └── qr-generator/   # Generate QR codes from any text/URL
│
├── packages/
│   ├── ui/              # Shared UI components (buttons, navbar, modals…)
│   └── utils/           # Shared helper functions (file validation, etc.)
│
├── package.json         # Workspace root
└── README.md
```

## 🚀 Getting Started

Install all dependencies from the root:
```bash
npm install
```

Run a specific app in dev mode:
```bash
npm run dev:doc-converter
npm run dev:image-editor
npm run dev:qr-generator
```

## 🛠️ Apps

| App | Description | Status |
|-----|-------------|--------|
| `doc-converter` | Convert documents between formats | 🚧 In Progress |
| `image-editor` | Edit images in the browser | 🔜 Planned |
| `qr-generator` | Generate QR codes | 🔜 Planned |

## 📦 Shared Packages

| Package | Description |
|---------|-------------|
| `packages/ui` | Reusable UI components shared across all apps |
| `packages/utils` | Shared utility/helper functions |
