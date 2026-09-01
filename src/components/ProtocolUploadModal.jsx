import { useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import * as mammoth from "mammoth";
import * as XLSX from "xlsx";

// ── Accepted types ─────────────────────────────────────────────────────────────
const ACCEPTED = {
  "text/plain": ".txt",
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-excel": ".xls",
};
const ACCEPT_ATTR = Object.keys(ACCEPTED).join(",") + ",.txt,.pdf,.docx,.doc,.xlsx,.xls";

// ── File → plain text ──────────────────────────────────────────────────────────
async function extractText(file) {
  const name = file.name.toLowerCase();

  // Plain text
  if (name.endsWith(".txt")) {
    return await file.text();
  }

  // PDF — use pdfjs-dist
  if (name.endsWith(".pdf")) {
    const pdfjsLib = await import("pdfjs-dist");
    // Set worker source via CDN to avoid bundler issues
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item) => item.str).join(" ") + "\n";
    }
    return text.trim();
  }

  // DOCX / DOC via mammoth
  if (name.endsWith(".docx") || name.endsWith(".doc")) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  }

  // XLSX / XLS via SheetJS
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const lines = [];
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      lines.push(`--- Sheet: ${sheetName} ---`);
      lines.push(csv);
    });
    return lines.join("\n").trim();
  }

  throw new Error(`Unsupported file type: ${file.name}`);
}

// ── Overlay / modal styles ─────────────────────────────────────────────────────
const overlay = {
  position: "fixed", inset: 0, zIndex: 1000,
  background: "rgba(0,0,0,0.45)",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const box = {
  background: "#fff", borderRadius: 16, padding: "28px 32px",
  width: 480, maxWidth: "calc(100vw - 32px)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
};

// ── Component ──────────────────────────────────────────────────────────────────
export default function ProtocolUploadModal({ onClose, onSuccess }) {
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState([]); // [{name, ok, error}]
  const [done, setDone] = useState(false);

  function addFiles(incoming) {
    const valid = Array.from(incoming).filter((f) => {
      const n = f.name.toLowerCase();
      return n.endsWith(".txt") || n.endsWith(".pdf") || n.endsWith(".docx") ||
        n.endsWith(".doc") || n.endsWith(".xlsx") || n.endsWith(".xls");
    });
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...valid.filter((f) => !existing.has(f.name))];
    });
  }

  function removeFile(name) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  async function handleUpload() {
    if (!files.length) return;
    setUploading(true);
    const outcomes = [];

    for (const file of files) {
      try {
        const rawText = await extractText(file);
        const title = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();

        // Upsert by title so re-uploading a same-named file updates it
        const { error } = await supabase
          .from("protocols")
          .upsert({ title, content: rawText }, { onConflict: "title" });

        if (error) throw new Error(error.message);
        outcomes.push({ name: file.name, ok: true });
      } catch (err) {
        outcomes.push({ name: file.name, ok: false, error: err.message });
      }
    }

    setResults(outcomes);
    setUploading(false);
    setDone(true);
    const saved = outcomes.filter((o) => o.ok).length;
    if (saved > 0) onSuccess(saved);
  }

  const inputStyle = {
    width: "100%", padding: "8px 10px",
    border: "1px solid #e2e8f0", borderRadius: 8,
    fontSize: "0.85rem", color: "#111827", background: "transparent",
    boxSizing: "border-box",
  };

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={box}>
        <h2 style={{ margin: "0 0 4px", fontSize: "1rem", fontWeight: 700, color: "#111827" }}>
          Upload Protocols
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: "0.8rem", color: "#64748b" }}>
          Accepted formats: .txt, .pdf, .docx, .doc, .xlsx, .xls
        </p>

        {!done ? (
          <>
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? "#2563eb" : "#cbd5e1"}`,
                borderRadius: 12,
                padding: "32px 16px",
                textAlign: "center",
                cursor: "pointer",
                background: dragging ? "#eff6ff" : "#f8fafc",
                transition: "background 0.15s, border-color 0.15s",
                marginBottom: 16,
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={dragging ? "#2563eb" : "#94a3b8"} strokeWidth="1.5" style={{ margin: "0 auto 8px", display: "block" }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p style={{ margin: 0, fontSize: "0.85rem", color: dragging ? "#2563eb" : "#64748b", fontWeight: 500 }}>
                {dragging ? "Drop files here" : "Click or drag files here to upload"}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#94a3b8" }}>
                PDF, Word, Excel, Text
              </p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPT_ATTR}
                style={{ display: "none" }}
                onChange={(e) => addFiles(e.target.files)}
              />
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16, maxHeight: 180, overflowY: "auto" }}>
                {files.map((f) => (
                  <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 8, background: "#f1f5f9", borderRadius: 8, padding: "7px 10px" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "#e2e8f0", color: "#475569", textTransform: "uppercase", flexShrink: 0 }}>
                      {f.name.split(".").pop()}
                    </span>
                    <span style={{ flex: 1, fontSize: "0.82rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#111827" }}>
                      {f.name}
                    </span>
                    <span style={{ fontSize: "0.72rem", color: "#94a3b8", flexShrink: 0 }}>
                      {(f.size / 1024).toFixed(0)} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(f.name)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "0 2px", fontSize: "1rem", lineHeight: 1, flexShrink: 0 }}
                      aria-label={`Remove ${f.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                style={{ flex: 1, padding: "9px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", cursor: "pointer", fontSize: "0.85rem" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!files.length || uploading}
                style={{
                  flex: 2, padding: "9px", border: "none", borderRadius: 8,
                  background: !files.length ? "#cbd5e1" : uploading ? "#93c5fd" : "#2563eb",
                  color: "#fff", cursor: !files.length || uploading ? "not-allowed" : "pointer",
                  fontWeight: 600, fontSize: "0.85rem",
                }}
              >
                {uploading ? `Uploading ${files.length} file${files.length > 1 ? "s" : ""}…` : `Upload ${files.length} File${files.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </>
        ) : (
          /* Results */
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20, maxHeight: 220, overflowY: "auto" }}>
              {results.map((r) => (
                <div key={r.name} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", borderRadius: 8, background: r.ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${r.ok ? "#86efac" : "#fca5a5"}` }}>
                  <span className="ms" style={{ fontSize: 18, color: r.ok ? "#16a34a" : "#dc2626" }}>
                    {r.ok ? "check_circle" : "cancel"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: r.ok ? "#15803d" : "#dc2626" }}>
                      {r.name}
                    </div>
                    {!r.ok && <div style={{ fontSize: "0.75rem", color: "#b91c1c", marginTop: 2 }}>{r.error}</div>}
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{ width: "100%", padding: "9px", border: "none", borderRadius: 8, background: "#0f172a", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
