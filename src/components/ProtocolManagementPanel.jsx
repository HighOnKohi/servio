import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// ── Local protocol loader (mirrors ProtocolAssistant.jsx) ──────────────────────
const protocolModules = import.meta.glob("../../Protocols/*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
});

const localProtocols = Object.entries(protocolModules).map(([path, content]) => {
  const fileName = path.split("/").pop() || "Untitled";
  const title = fileName.replace(/\.txt$/i, "").replace(/[-_]+/g, " ").trim();
  return { title, content: typeof content === "string" ? content.trim() : "", source: "local" };
}).filter((p) => p.content);

// ── Shared styles ──────────────────────────────────────────────────────────────
const overlayStyle = {
  position: "fixed", inset: 0, zIndex: 1000,
  background: "rgba(0,0,0,0.48)",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const boxStyle = {
  background: "#fff", borderRadius: 16, padding: "28px 32px",
  width: 560, maxWidth: "calc(100vw - 32px)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  display: "flex", flexDirection: "column", gap: 16,
};
const inputStyle = {
  width: "100%", padding: "8px 10px",
  border: "1px solid #e2e8f0", borderRadius: 8,
  fontSize: "0.85rem", color: "#111827", background: "#f8fafc",
  boxSizing: "border-box",
};
const errStyle = {
  background: "#fef2f2", border: "1px solid #fca5a5",
  borderRadius: 8, padding: "9px 12px",
  fontSize: "0.82rem", color: "#dc2626",
};
const labelStyle = {
  display: "flex", flexDirection: "column", gap: 4,
  fontSize: "0.8rem", fontWeight: 600, color: "#374151",
};

// ── Edit / Create modal ────────────────────────────────────────────────────────
function ProtocolEditorModal({ protocol, onClose, onSaved }) {
  const isNew = !protocol;
  const [title, setTitle] = useState(protocol?.title || "");
  const [content, setContent] = useState(protocol?.content || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError("Both title and content are required.");
      return;
    }
    setSaving(true);
    setError("");

    const { error: dbErr } = await supabase
      .from("protocols")
      .upsert({ title: title.trim(), content: content.trim() }, { onConflict: "title" });

    setSaving(false);
    if (dbErr) { setError(dbErr.message); return; }
    onSaved({ title: title.trim(), content: content.trim() });
  }

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={boxStyle}>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#111827" }}>
          {isNew ? "Create New Protocol" : `Edit Protocol — ${protocol.title}`}
        </h2>

        {error && <div style={errStyle}>{error}</div>}

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={labelStyle}>
            Protocol Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Flood Emergency Protocol"
              required
              disabled={!isNew && protocol?.source !== "local"}
              style={{ ...inputStyle, opacity: !isNew && protocol?.source !== "local" ? 0.6 : 1 }}
            />
            {!isNew && protocol?.source === "local" && (
              <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 400 }}>
                Saving this will create an editable Supabase copy that overrides the local file.
              </span>
            )}
          </label>

          <label style={labelStyle}>
            Protocol Content
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write the step-by-step protocol here…"
              required
              rows={14}
              style={{
                ...inputStyle, resize: "vertical", minHeight: 200,
                fontFamily: "system-ui, sans-serif", lineHeight: 1.5,
              }}
            />
          </label>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button" onClick={onClose}
              style={{ flex: 1, padding: "9px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", cursor: "pointer", fontSize: "0.85rem" }}
            >
              Cancel
            </button>
            <button
              type="submit" disabled={saving}
              style={{ flex: 2, padding: "9px", border: "none", borderRadius: 8, background: saving ? "#93c5fd" : "#0f172a", color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "0.85rem" }}
            >
              {saving ? "Saving…" : isNew ? "Create Protocol" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete confirm modal ───────────────────────────────────────────────────────
function DeleteProtocolModal({ protocol, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setDeleting(true);
    const { error: dbErr } = await supabase
      .from("protocols")
      .delete()
      .eq("title", protocol.title);

    setDeleting(false);
    if (dbErr) { setError(dbErr.message); return; }
    onDeleted(protocol.title);
  }

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...boxStyle, width: 400, gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#111827" }}>
          Delete Protocol?
        </h2>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "#475569" }}>
          This will permanently delete <strong>{protocol.title}</strong> from the database.
          {protocol.source === "local" && (
            <span style={{ display: "block", marginTop: 6, color: "#b45309" }}>
              Note: This is a local file. Deleting the Supabase copy will not remove the .txt file from the project — it will reappear as a local entry.
            </span>
          )}
        </p>
        {error && <div style={errStyle}>{error}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button" onClick={onClose}
            style={{ flex: 1, padding: "9px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", cursor: "pointer", fontSize: "0.85rem" }}
          >
            Cancel
          </button>
          <button
            type="button" onClick={handleDelete} disabled={deleting}
            style={{ flex: 1, padding: "9px", border: "none", borderRadius: 8, background: deleting ? "#fca5a5" : "#dc2626", color: "#fff", cursor: deleting ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "0.85rem" }}
          >
            {deleting ? "Deleting…" : "Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Protocol Management Panel (main export) ────────────────────────────────────
export default function ProtocolManagementPanel({ onShowUpload, showToast }) {
  const [remoteProtocols, setRemoteProtocols] = useState([]);
  const [loadingRemote, setLoadingRemote] = useState(true);
  const [search, setSearch] = useState("");
  const [editingProtocol, setEditingProtocol] = useState(null); // null = closed, {} = new
  const [deletingProtocol, setDeletingProtocol] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch Supabase protocols
  const fetchRemote = useCallback(async () => {
    setLoadingRemote(true);
    const { data } = await supabase.from("protocols").select("title, content").order("title");
    setRemoteProtocols(data || []);
    setLoadingRemote(false);
  }, []);

  useEffect(() => { fetchRemote(); }, [fetchRemote]);

  // Merge: Supabase takes precedence (overrides local with same title)
  const remoteTitles = new Set(remoteProtocols.map((p) => p.title.toLowerCase()));
  const mergedProtocols = [
    ...remoteProtocols.map((p) => ({ ...p, source: "remote" })),
    ...localProtocols
      .filter((p) => !remoteTitles.has(p.title.toLowerCase()))
      .map((p) => ({ ...p, source: "local" })),
  ].sort((a, b) => a.title.localeCompare(b.title));

  const filtered = search.trim()
    ? mergedProtocols.filter((p) =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.content.toLowerCase().includes(search.toLowerCase())
      )
    : mergedProtocols;

  function handleSaved(saved) {
    setEditingProtocol(null);
    setIsCreating(false);
    fetchRemote();
    showToast(`✓ Protocol "${saved.title}" saved.`);
  }

  function handleDeleted(title) {
    setDeletingProtocol(null);
    fetchRemote();
    showToast(`✓ Protocol "${title}" deleted.`);
  }

  const sectionStyle = {
    background: "#ffffff", border: "1px solid #cbd5e1",
    borderRadius: 14, padding: "16px 20px",
    boxShadow: "0 7px 20px rgba(15, 23, 42, 0.05)",
    display: "flex", flexDirection: "column", gap: 12,
    overflow: "hidden",
  };

  return (
    <>
      <div style={sectionStyle}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 600, margin: 0, color: "#111827" }}>
            Protocol Management
            <span style={{ marginLeft: 8, fontSize: "0.75rem", fontWeight: 500, color: "#94a3b8" }}>
              {mergedProtocols.length} total
            </span>
          </h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onShowUpload}
              style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#f8fafc", cursor: "pointer", fontSize: "0.78rem", fontWeight: 600, color: "#374151", display: "flex", alignItems: "center", gap: 5 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload File
            </button>
            <button
              onClick={() => setIsCreating(true)}
              style={{ padding: "6px 12px", border: "none", borderRadius: 8, background: "#0f172a", cursor: "pointer", fontSize: "0.78rem", fontWeight: 600, color: "#fff", display: "flex", alignItems: "center", gap: 5 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Protocol
            </button>
          </div>
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search protocols by title or content…"
          style={{ ...inputStyle, flexShrink: 0 }}
        />

        {/* Protocol list */}
        {loadingRemote ? (
          <div style={{ padding: "24px 0", textAlign: "center", color: "#94a3b8", fontSize: "0.85rem" }}>
            Loading protocols…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "24px 0", textAlign: "center", color: "#94a3b8", fontSize: "0.85rem" }}>
            {search ? "No protocols match your search." : "No protocols found. Create one or upload a file."}
          </div>
        ) : (
          <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            {filtered.map((p) => (
              <div
                key={p.title}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "10px 12px", background: "#f8fafc",
                  border: "1px solid #e2e8f0", borderRadius: 10,
                }}
              >
                {/* Source badge */}
                <span style={{
                  flexShrink: 0, marginTop: 2,
                  fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase",
                  padding: "2px 6px", borderRadius: 4,
                  background: p.source === "remote" ? "#ede9fe" : "#f0f9ff",
                  color: p.source === "remote" ? "#6d28d9" : "#0369a1",
                }}>
                  {p.source === "remote" ? "DB" : "Local"}
                </span>

                {/* Title + preview */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.84rem", color: "#111827", marginBottom: 2 }}>
                    {p.title}
                  </div>
                  <div style={{
                    fontSize: "0.75rem", color: "#64748b",
                    overflow: "hidden", textOverflow: "ellipsis",
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    whiteSpace: "pre-wrap",
                  }}>
                    {p.content.slice(0, 140)}{p.content.length > 140 ? "…" : ""}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => setEditingProtocol(p)}
                    title="Edit"
                    style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontSize: "0.75rem", color: "#374151" }}
                  >
                    <span className="ms" style={{ fontSize: 16 }}>edit</span>
                  </button>
                  {p.source === "remote" && (
                    <button
                      onClick={() => setDeletingProtocol(p)}
                      title="Delete"
                      style={{ background: "none", border: "1px solid #fecaca", borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontSize: "0.75rem", color: "#dc2626" }}
                    >
                      <span className="ms" style={{ fontSize: 16 }}>delete</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor modal (edit or create) */}
      {(editingProtocol || isCreating) && (
        <ProtocolEditorModal
          protocol={isCreating ? null : editingProtocol}
          onClose={() => { setEditingProtocol(null); setIsCreating(false); }}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirm modal */}
      {deletingProtocol && (
        <DeleteProtocolModal
          protocol={deletingProtocol}
          onClose={() => setDeletingProtocol(null)}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
}
