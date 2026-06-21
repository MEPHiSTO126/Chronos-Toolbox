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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Chronos Toolbox API is running"}


# ── Helpers ─────────────────────────────────────────────────────

def _pdf_to_docx(pdf_bytes: bytes, original_name: str) -> tuple[bytes, str]:
    """Convert PDF bytes → DOCX bytes. Returns (bytes, output_filename)."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(pdf_bytes)
        pdf_path = tmp.name
    docx_path = pdf_path.replace(".pdf", ".docx")
    try:
        cv = Converter(pdf_path)
        cv.convert(docx_path)
        cv.close()
        with open(docx_path, "rb") as f:
            return f.read(), os.path.splitext(original_name)[0] + ".docx"
    finally:
        if os.path.exists(pdf_path):  os.unlink(pdf_path)
        if os.path.exists(docx_path): os.unlink(docx_path)


def _docx_to_pdf(docx_bytes: bytes, original_name: str) -> tuple[bytes, str]:
    """Convert DOCX bytes → PDF bytes. Returns (bytes, output_filename)."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as tmp:
        tmp.write(docx_bytes)
        docx_path = tmp.name
    out_dir = os.path.dirname(docx_path)
    pdf_path = None
    try:
        if platform.system() == "Windows":
            from docx2pdf import convert
            pdf_path = docx_path.replace(".docx", ".pdf")
            convert(docx_path, pdf_path)
        else:
            subprocess.run(
                ["soffice", "--headless", "--convert-to", "pdf", "--outdir", out_dir, docx_path],
                check=True, capture_output=True
            )
            pdf_path = docx_path.replace(".docx", ".pdf")
        with open(pdf_path, "rb") as f:
            return f.read(), os.path.splitext(original_name)[0] + ".pdf"
    finally:
        if os.path.exists(docx_path): os.unlink(docx_path)
        if pdf_path and os.path.exists(pdf_path): os.unlink(pdf_path)


def _make_zip(files: list[tuple[str, bytes]], zip_name: str) -> Response:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for fname, data in files:
            zf.writestr(fname, data)
    return Response(
        buf.getvalue(), media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_name}"'}
    )


def _single_response(data: bytes, filename: str, media_type: str) -> Response:
    return Response(
        data, media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ── Endpoints ────────────────────────────────────────────────────

@app.post("/convert/pdf-to-word")
async def convert_pdf_to_word(files: List[UploadFile] = File(...)):
    results: list[tuple[str, bytes]] = []

    for upload in files:
        raw = await upload.read()
        name = upload.filename or "file"

        if not name.lower().endswith(".pdf"):
            # Wrong type — return as-is, no conversion
            results.append((name, raw))
            continue

        try:
            out_bytes, out_name = _pdf_to_docx(raw, name)
            results.append((out_name, out_bytes))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed on '{name}': {e}")

    if len(results) == 1:
        fname, data = results[0]
        mt = ("application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              if fname.lower().endswith(".docx") else "application/octet-stream")
        return _single_response(data, fname, mt)

    return _make_zip(results, "converted_to_word.zip")


@app.post("/convert/word-to-pdf")
async def convert_word_to_pdf(files: List[UploadFile] = File(...)):
    results: list[tuple[str, bytes]] = []

    for upload in files:
        raw = await upload.read()
        name = upload.filename or "file"

        if not name.lower().endswith((".doc", ".docx")):
            # Wrong type — return as-is
            results.append((name, raw))
            continue

        try:
            out_bytes, out_name = _docx_to_pdf(raw, name)
            results.append((out_name, out_bytes))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed on '{name}': {e}")

    if len(results) == 1:
        fname, data = results[0]
        mt = "application/pdf" if fname.lower().endswith(".pdf") else "application/octet-stream"
        return _single_response(data, fname, mt)

    return _make_zip(results, "converted_to_pdf.zip")
