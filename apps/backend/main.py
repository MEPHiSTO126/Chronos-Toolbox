import os
import tempfile
import subprocess
import platform
import zipfile
import io
from typing import List

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pdf2docx import Converter

app = FastAPI(title="Chronos Toolbox Backend")

import os

frontend_url = os.environ.get("FRONTEND_URL")
origins = [frontend_url] if frontend_url else ["*"]
# Also allow local dev
if "http://localhost:5500" not in origins:
    origins.append("http://localhost:5500")
if "http://127.0.0.1:5500" not in origins:
    origins.append("http://127.0.0.1:5500")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Chronos Toolbox API is running"}


# ── Shared Helpers ───────────────────────────────────────────────

def _pdf_to_docx(pdf_bytes: bytes, original_name: str) -> tuple:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(pdf_bytes); pdf_path = tmp.name
    docx_path = pdf_path.replace(".pdf", ".docx")
    try:
        cv = Converter(pdf_path); cv.convert(docx_path); cv.close()
        with open(docx_path, "rb") as f:
            return f.read(), os.path.splitext(original_name)[0] + ".docx"
    finally:
        if os.path.exists(pdf_path):  os.unlink(pdf_path)
        if os.path.exists(docx_path): os.unlink(docx_path)


def _office_to_pdf(file_bytes: bytes, original_name: str, suffix: str) -> tuple:
    """Convert any LibreOffice-supported format (.docx, .pptx, etc.) to PDF."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file_bytes); src_path = tmp.name
    out_dir = os.path.dirname(src_path)
    pdf_path = None
    try:
        if platform.system() == "Windows" and suffix in (".doc", ".docx"):
            from docx2pdf import convert
            pdf_path = src_path.replace(suffix, ".pdf")
            convert(src_path, pdf_path)
        else:
            # Linux / Docker — LibreOffice handles all Office formats
            subprocess.run(
                ["soffice", "--headless", "--convert-to", "pdf", "--outdir", out_dir, src_path],
                check=True, capture_output=True
            )
            base = os.path.splitext(os.path.basename(src_path))[0]
            pdf_path = os.path.join(out_dir, base + ".pdf")
        with open(pdf_path, "rb") as f:
            return f.read(), os.path.splitext(original_name)[0] + ".pdf"
    finally:
        if os.path.exists(src_path): os.unlink(src_path)
        if pdf_path and os.path.exists(pdf_path): os.unlink(pdf_path)


def _make_zip(files: list, zip_name: str) -> Response:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for fname, data in files:
            zf.writestr(fname, data)
    return Response(buf.getvalue(), media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="{zip_name}"'})


def _single(data: bytes, filename: str, media_type: str) -> Response:
    return Response(data, media_type=media_type,
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


# ── Endpoints ────────────────────────────────────────────────────

@app.post("/convert/pdf-to-word")
async def pdf_to_word(files: List[UploadFile] = File(...)):
    results = []
    for upload in files:
        raw = await upload.read(); name = upload.filename or "file"
        if not name.lower().endswith(".pdf"):
            results.append((name, raw)); continue
        try:
            out, out_name = _pdf_to_docx(raw, name); results.append((out_name, out))
        except Exception as e:
            raise HTTPException(500, f"Failed on '{name}': {e}")
    if len(results) == 1:
        fname, data = results[0]
        mt = "application/vnd.openxmlformats-officedocument.wordprocessingml.document" if fname.endswith(".docx") else "application/octet-stream"
        return _single(data, fname, mt)
    return _make_zip(results, "converted_to_word.zip")


@app.post("/convert/word-to-pdf")
async def word_to_pdf(files: List[UploadFile] = File(...)):
    results = []
    for upload in files:
        raw = await upload.read(); name = upload.filename or "file"
        if not name.lower().endswith((".doc", ".docx")):
            results.append((name, raw)); continue
        suffix = ".docx" if name.lower().endswith(".docx") else ".doc"
        try:
            out, out_name = _office_to_pdf(raw, name, suffix); results.append((out_name, out))
        except Exception as e:
            raise HTTPException(500, f"Failed on '{name}': {e}")
    if len(results) == 1:
        fname, data = results[0]
        mt = "application/pdf" if fname.endswith(".pdf") else "application/octet-stream"
        return _single(data, fname, mt)
    return _make_zip(results, "converted_to_pdf.zip")


@app.post("/convert/pptx-to-pdf")
async def pptx_to_pdf(files: List[UploadFile] = File(...)):
    results = []
    for upload in files:
        raw = await upload.read(); name = upload.filename or "file"
        if not name.lower().endswith((".ppt", ".pptx")):
            results.append((name, raw)); continue
        suffix = ".pptx" if name.lower().endswith(".pptx") else ".ppt"
        try:
            out, out_name = _office_to_pdf(raw, name, suffix); results.append((out_name, out))
        except Exception as e:
            raise HTTPException(500, f"Failed on '{name}': {e}")
    if len(results) == 1:
        fname, data = results[0]
        mt = "application/pdf" if fname.endswith(".pdf") else "application/octet-stream"
        return _single(data, fname, mt)
    return _make_zip(results, "converted_presentations.zip")
