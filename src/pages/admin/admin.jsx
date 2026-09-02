import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import { usePOS } from "../../context/POSContext";
import { useAuth } from "../../context/AuthContext";
import ProtocolUploadModal from "../../components/ProtocolUploadModal";
import ProtocolManagementPanel from "../../components/ProtocolManagementPanel";
import "./admin.css";

// ─── Secondary Supabase client for registration ───────────────────────────────
const secondarySupabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "servio-registration-client",
    },
  }
);

const ROLES = ["ADMIN", "CASHIER", "WAITER", "KITCHEN"];
const STATUS_OPTIONS = ["Active", "Inactive"];
const REVENUE_FILTER_OPTIONS = ["today", "week", "all"];
const REVENUE_FILTER_LABELS = { today: "Today", week: "This Week", all: "All-Time" };
const LS_RESET_KEY = "servio_revenue_reset_ts";

function toLocalDateString(dateOrStr) {
  const d = dateOrStr instanceof Date ? dateOrStr : new Date(dateOrStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getStartOfLocalDay(date) { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; }
function getStartOfLocalWeek(date) { const d = new Date(date); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); return d; }

// ─── Shared modal styles ──────────────────────────────────────────────────────
const modalOverlayStyle = { position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" };
const modalBoxStyle = { background: "#fff", borderRadius: 16, padding: "28px 32px", width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" };
const inputStyle = { width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: "0.85rem", color: "#111827", background: "#f8fafc", boxSizing: "border-box" };
const labelStyle2 = { display: "flex", flexDirection: "column", gap: 4, fontSize: "0.8rem", fontWeight: 600, color: "#374151" };
const errorBannerStyle = { background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "9px 12px", marginBottom: 14, fontSize: "0.82rem", color: "#dc2626" };

// ─── Register Staff Modal ─────────────────────────────────────────────────────
function RegisterStaffModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "WAITER" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  const handleSubmit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    const { data: signUpData, error: signUpError } = await secondarySupabase.auth.signUp({ email: form.email, password: form.password });
    if (signUpError) { setError(signUpError.message); setLoading(false); return; }
    const newUserId = signUpData?.user?.id;
    if (!newUserId) { setError("Sign-up succeeded but no user ID was returned."); setLoading(false); return; }
    const { error: profileError } = await supabase.from("profiles").insert({ id: newUserId, full_name: form.full_name, role: form.role, status: "Active" });
    if (profileError) { setError(`Auth user created but profile insert failed: ${profileError.message}`); setLoading(false); return; }
    setLoading(false); onSuccess(form.full_name);
  };
  return (
    <div style={modalOverlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalBoxStyle}>
        <h2 style={{ margin: "0 0 20px", fontSize: "1rem", fontWeight: 700, color: "#111827" }}>Register New Staff</h2>
        {error && <div style={errorBannerStyle}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={labelStyle2}>Full Name<input name="full_name" value={form.full_name} onChange={handleChange} placeholder="e.g. Maria Santos" required style={inputStyle} /></label>
          <label style={labelStyle2}>Email Address<input name="email" type="email" value={form.email} onChange={handleChange} placeholder="staff@servio.com" required style={inputStyle} /></label>
          <label style={labelStyle2}>Password<input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Min. 8 characters" required minLength={8} style={inputStyle} /></label>
          <label style={labelStyle2}>Role<select name="role" value={form.role} onChange={handleChange} style={inputStyle}>{ROLES.map((r) => <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>)}</select></label>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: "9px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", cursor: "pointer", fontSize: "0.85rem" }}>Cancel</button>
            <button type="submit" disabled={loading} style={{ flex: 1, padding: "9px", border: "none", borderRadius: 8, background: loading ? "#93c5fd" : "#059669", color: "#fff", cursor: loading ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "0.85rem" }}>{loading ? "Registering…" : "Register"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Staff Modal ─────────────────────────────────────────────────────────
function EditStaffModal({ profile, onClose, onSave }) {
  const [form, setForm] = useState({ full_name: profile.full_name || "", role: profile.role || "WAITER", status: profile.status || "Active" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  const handleSubmit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    const { error: updateError } = await onSave(profile.id, form);
    if (updateError) { setError(updateError.message); setLoading(false); }
  };
  return (
    <div style={modalOverlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalBoxStyle}>
        <h2 style={{ margin: "0 0 20px", fontSize: "1rem", fontWeight: 700, color: "#111827" }}>Edit Staff — {profile.full_name}</h2>
        {error && <div style={errorBannerStyle}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={labelStyle2}>Full Name<input name="full_name" value={form.full_name} onChange={handleChange} required style={inputStyle} /></label>
          <label style={labelStyle2}>Role<select name="role" value={form.role} onChange={handleChange} style={inputStyle}>{ROLES.map((r) => <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>)}</select></label>
          <label style={labelStyle2}>Status<select name="status" value={form.status} onChange={handleChange} style={inputStyle}>{STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: "9px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", cursor: "pointer", fontSize: "0.85rem" }}>Cancel</button>
            <button type="submit" disabled={loading} style={{ flex: 1, padding: "9px", border: "none", borderRadius: 8, background: loading ? "#86efac" : "#059669", color: "#fff", cursor: loading ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "0.85rem" }}>{loading ? "Saving…" : "Save Changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteConfirmModal({ profile, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);
  return (
    <div style={modalOverlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modalBoxStyle, width: 380 }}>
        <h2 style={{ margin: "0 0 10px", fontSize: "1rem", fontWeight: 700, color: "#111827" }}>Remove Staff Member?</h2>
        <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "0 0 20px" }}>This will remove <strong>{profile.full_name}</strong>'s profile from the database. This action cannot be undone.</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: "9px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", cursor: "pointer", fontSize: "0.85rem" }}>Cancel</button>
          <button type="button" onClick={async () => { setLoading(true); await onConfirm(profile.id); }} disabled={loading} style={{ flex: 1, padding: "9px", border: "none", borderRadius: 8, background: loading ? "#fca5a5" : "#dc2626", color: "#fff", cursor: loading ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "0.85rem" }}>{loading ? "Removing…" : "Yes, Remove"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Reset Revenue Confirm Modal ──────────────────────────────────────────────
function ResetRevenueConfirmModal({ onClose, onConfirm }) {
  return (
    <div style={modalOverlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modalBoxStyle, width: 400 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#111827" }}>Reset Shift Revenue?</h2>
        </div>
        <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "0 0 6px" }}>This will set a new <strong>shift baseline</strong> to right now. The revenue counter will restart from <strong>₱0.00</strong>.</p>
        <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "0 0 22px" }}>All historical orders remain saved — this only changes what is counted in the revenue display.</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: "9px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", cursor: "pointer", fontSize: "0.85rem" }}>Cancel</button>
          <button type="button" onClick={onConfirm} style={{ flex: 1, padding: "9px", border: "none", borderRadius: 8, background: "#d97706", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}>Reset Shift</button>
        </div>
      </div>
    </div>
  );
}

// ─── useFixedInterfaceCanvas ──────────────────────────────────────────────────
function useFixedInterfaceCanvas() {
  const [, refreshScale] = useState(0);
  useEffect(() => { const u = () => refreshScale((v) => v + 1); window.addEventListener("resize", u); return () => window.removeEventListener("resize", u); }, []);
  if (typeof window === "undefined") return { scale: 1, width: "100%", height: "100vh" };
  const pr = window.devicePixelRatio || 1;
  return { scale: 1 / pr, width: `${Math.round(window.innerWidth * pr)}px`, height: `${Math.round(window.innerHeight * pr)}px` };
}

// ─── Admin Page ───────────────────────────────────────────────────────────────
const Admin = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { tables, menuItems, categories, orders, profiles, ingredients, getLowStockIngredients, loading, refetchProfiles, updateProfile, deleteProfile } = usePOS();
  const interfaceCanvas = useFixedInterfaceCanvas();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [deletingProfile, setDeletingProfile] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showResetRevenueModal, setShowResetRevenueModal] = useState(false);
  const [toast, setToast] = useState("");
  const [revenueFilter, setRevenueFilter] = useState("today");
  const [revenueResetTimestamp, setRevenueResetTimestamp] = useState(() => { const s = localStorage.getItem(LS_RESET_KEY); return s ? Number(s) : null; });

  useEffect(() => { const id = setInterval(() => setCurrentDateTime(new Date()), 1000); return () => clearInterval(id); }, []);
  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(""), 4000); }, []);
  const handleLogout = useCallback(async () => { await logout(); navigate("/login"); }, [logout, navigate]);
  const handleRegistrationSuccess = useCallback((name) => { setShowRegisterModal(false); refetchProfiles(); showToast(`✓ ${name} has been registered successfully.`); }, [refetchProfiles, showToast]);
  const handleUploadSuccess = useCallback((count) => { showToast(`✓ ${count} protocol${count !== 1 ? "s" : ""} uploaded successfully.`); }, [showToast]);
  const handleEditSave = useCallback(async (id, updates) => { const { error } = await updateProfile(id, updates); if (!error) { setEditingProfile(null); showToast("✓ Staff member updated successfully."); } return { error }; }, [updateProfile, showToast]);
  const handleDeleteConfirm = useCallback(async (id) => { const { error } = await deleteProfile(id); if (!error) { setDeletingProfile(null); showToast("✓ Staff member removed."); } }, [deleteProfile, showToast]);
  const handleRevenueReset = useCallback(() => { const now = Date.now(); setRevenueResetTimestamp(now); localStorage.setItem(LS_RESET_KEY, String(now)); setShowResetRevenueModal(false); showToast("✓ Shift revenue reset. Counter starts from ₱0.00."); }, [showToast]);
  const handleClearRevenueReset = useCallback(() => { setRevenueResetTimestamp(null); localStorage.removeItem(LS_RESET_KEY); showToast("✓ Shift baseline cleared. Showing full period revenue."); }, [showToast]);

  const time = currentDateTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });
  const date = currentDateTime.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const totalOrders = orders.length;
  const completedOrders = orders.filter((o) => o.status === "COMPLETED").length;
  const activeOrders = orders.filter((o) => o.status === "PENDING" || o.status === "IN_PROGRESS").length;
  const cancelledOrders = orders.filter((o) => o.status === "CANCELLED").length;
  const occupiedTables = tables.filter((t) => t.status === "OCCUPIED").length;
  const lowStock = getLowStockIngredients();

  const todayRevenue = useMemo(() => {
    const now = new Date();
    const todayStr = toLocalDateString(now);
    const weekStart = getStartOfLocalWeek(now);
    return orders.filter((o) => {
      if (o.status !== "COMPLETED") return false;
      const completedAt = new Date(o.updated_at || o.created_at);
      if (revenueResetTimestamp && completedAt.getTime() < revenueResetTimestamp) return false;
      if (revenueFilter === "today") return toLocalDateString(completedAt) === todayStr;
      if (revenueFilter === "week") return completedAt >= weekStart;
      return true;
    }).reduce((sum, o) => sum + Number(o.total), 0);
  }, [orders, revenueFilter, revenueResetTimestamp]);

  const revenuePeriodLabel = useMemo(() => {
    if (revenueResetTimestamp) {
      const r = new Date(revenueResetTimestamp);
      const ts = r.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      const ds = toLocalDateString(r) === toLocalDateString(new Date()) ? "Today" : r.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return `Since ${ds}, ${ts}`;
    }
    return REVENUE_FILTER_LABELS[revenueFilter];
  }, [revenueResetTimestamp, revenueFilter]);

  if (loading) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f8fafc", color: "#111827", fontSize: "1.2rem" }}>Loading…</div>;
  }

  // ── Style helpers ──
  const card = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 24px", boxShadow: "0 4px 16px rgba(15,23,42,0.06)" };
  const section = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 20px", boxShadow: "0 4px 16px rgba(15,23,42,0.06)" };
  const lbl = { fontSize: "0.72rem", textTransform: "uppercase", color: "#64748b", marginBottom: 6, letterSpacing: "0.06em", fontWeight: 700 };
  const val = { fontSize: "1.7rem", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em" };
  const muted = { fontSize: "0.72rem", marginTop: 6, color: "#94a3b8" };
  const th = { textAlign: "left", padding: "10px 12px", color: "#94a3b8", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.06em", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontWeight: 700 };
  const roleColor = { ADMIN: "#7c3aed", CASHIER: "#2563eb", WAITER: "#0891b2", KITCHEN: "#b45309" };
  const statusColor = { Active: "#16a34a", Inactive: "#9ca3af" };
  const filterPill = (key) => ({ padding: "3px 10px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 600, border: "1px solid", cursor: "pointer", transition: "all 0.15s", background: revenueFilter === key && !revenueResetTimestamp ? "#0f172a" : "transparent", color: revenueFilter === key && !revenueResetTimestamp ? "#fff" : "#64748b", borderColor: revenueFilter === key && !revenueResetTimestamp ? "#0f172a" : "#e2e8f0" });
  const statusPill = (status) => {
    const m = { COMPLETED: ["#d1fae5","#065f46","Served"], IN_PROGRESS: ["#dbeafe","#1e40af","Preparing"], PENDING: ["#fef3c7","#b45309","Pending Payment"], CANCELLED: ["#fee2e2","#b91c1c","Cancelled"], READY: ["#f3e8ff","#7c3aed","Ready"] };
    const [bg, color, label] = m[status] || ["#f1f5f9","#64748b", status];
    return <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: "0.72rem", fontWeight: 700, background: bg, color, whiteSpace: "nowrap" }}>{label}</span>;
  };

  return (
    <div className="admin-page" style={{ "--admin-scale": interfaceCanvas.scale, width: interfaceCanvas.width, height: interfaceCanvas.height, fontFamily: "'Inter', system-ui, sans-serif", display: "flex", overflow: "hidden", zoom: "var(--admin-scale)" }}>

      {toast && <div className="admin-toast">{toast}</div>}

      {/* ══ SIDEBAR ══ */}
      <aside style={{ width: 240, flexShrink: 0, background: "#0e131f", borderRight: "1px solid #1f2937", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 18px 16px", borderBottom: "1px solid #1f2937" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#059669", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </div>
          <div>
            <strong style={{ display: "block", fontSize: "0.95rem", fontWeight: 700, color: "#fff" }}>BistroAdmin</strong>
            <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Management Suite</span>
          </div>
        </div>
        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          {[
            { label: "Dashboard", active: true,  icon: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" },
            { label: "Tables",    active: false, icon: "M2 3h20v5H2zM2 10h20v5H2zM2 17h20v5H2z" },
            { label: "Menu",      active: false, icon: "M3 11l19-9-9 19-2-8-8-2z" },
            { label: "Staff",     active: false, icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
          ].map((item) => (
            <button key={item.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", background: item.active ? "#059669" : "transparent", color: item.active ? "#fff" : "#94a3b8", fontSize: "0.875rem", fontWeight: item.active ? 600 : 500, cursor: "pointer", width: "100%", textAlign: "left" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d={item.icon}/></svg>
              {item.label}
            </button>
          ))}
        </nav>
        {/* Bottom */}
        <div style={{ padding: "12px 10px", borderTop: "1px solid #1f2937", display: "flex", flexDirection: "column", gap: 4 }}>
          <button onClick={() => setShowRegisterModal(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "11px 16px", borderRadius: 10, border: "none", background: "#059669", color: "#fff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", marginBottom: 4 }}>
            + Register Staff
          </button>
          <button onClick={() => navigate("/")} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", borderRadius: 10, border: "none", background: "transparent", color: "#94a3b8", fontSize: "0.82rem", cursor: "pointer", width: "100%" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
            Back to Hub
          </button>
          <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", borderRadius: 10, border: "none", background: "transparent", color: "#ef4444", fontSize: "0.82rem", cursor: "pointer", width: "100%" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Logout
          </button>
        </div>
      </aside>

      {/* ══ MAIN CONTENT ══ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0, background: "#f8fafc" }}>

        {/* Top Bar */}
        <header style={{ height: 60, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", background: "#fff", borderBottom: "1px solid #e2e8f0", gap: 16 }}>
          <div style={{ flex: 1, maxWidth: 360, position: "relative" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="text" placeholder="Search orders, tables, staff…" style={{ width: "100%", height: 38, paddingLeft: 36, paddingRight: 14, border: "1px solid #e2e8f0", borderRadius: 999, background: "#f8fafc", fontSize: "0.82rem", color: "#0f172a", outline: "none" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8", marginRight: 6 }}>{date}, {time}</span>
            <button style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "none", background: "transparent", color: "#475569", cursor: "pointer", position: "relative" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <span style={{ position: "absolute", top: 6, right: 6, width: 7, height: 7, borderRadius: "50%", background: "#ef4444", border: "1.5px solid #fff" }} />
            </button>
            <button style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "none", background: "transparent", color: "#475569", cursor: "pointer" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
            </button>
            <button style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "none", background: "transparent", color: "#475569", cursor: "pointer" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </button>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#059669", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" }}>A</div>
          </div>
        </header>

        {/* Page Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>

          {/* Page Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em" }}>Overview</h1>
              <p style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: 2 }}>Live metrics and daily operations summary.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {REVENUE_FILTER_OPTIONS.map((key) => (
                <button key={key} onClick={() => { setRevenueFilter(key); if (revenueResetTimestamp) handleClearRevenueReset(); }} style={filterPill(key)}>{REVENUE_FILTER_LABELS[key]}</button>
              ))}
              {revenueResetTimestamp && <button onClick={handleClearRevenueReset} style={{ padding: "0 12px", height: 34, fontSize: "0.72rem", fontWeight: 600, border: "1px solid #bfdbfe", borderRadius: 8, background: "#eff6ff", color: "#2563eb", cursor: "pointer" }}>Clear Reset</button>}
              <button onClick={() => setShowResetRevenueModal(true)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 12px", height: 34, fontSize: "0.72rem", fontWeight: 600, border: "1px solid #fde68a", borderRadius: 8, background: "#fffbeb", color: "#d97706", cursor: "pointer" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                Reset Shift
              </button>
              <button style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 14px", height: 34, fontSize: "0.82rem", fontWeight: 600, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", color: "#374151", cursor: "pointer" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Today
              </button>
              <button style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 14px", height: 34, fontSize: "0.82rem", fontWeight: 600, border: "none", borderRadius: 8, background: "#059669", color: "#fff", cursor: "pointer" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export
              </button>
            </div>
          </div>

          {/* 4-Column Metric Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 20 }}>
            {/* Revenue */}
            <div style={{ ...card, borderColor: revenueResetTimestamp ? "#fde68a" : "#e2e8f0", background: revenueResetTimestamp ? "#fffbeb" : "#fff", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", right: -20, top: -20, width: 80, height: 80, borderRadius: "50%", background: "#d1fae5", opacity: 0.4, pointerEvents: "none" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  <span style={lbl}>Today's Revenue</span>
                </div>
                {revenueResetTimestamp && <span style={{ fontSize: "0.62rem", fontWeight: 600, color: "#d97706", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 20, padding: "1px 7px" }}>Shift Reset</span>}
              </div>
              <div style={{ ...val, color: "#059669" }}>₱{todayRevenue.toFixed(2)}</div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, background: "#d1fae5", color: "#065f46", padding: "2px 8px", borderRadius: 999 }}>↗ Revenue</span>
                <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{revenuePeriodLabel}</span>
              </div>
            </div>
            {/* Orders */}
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                <span style={lbl}>Total Orders</span>
              </div>
              <div style={val}>{totalOrders}</div>
              <div style={{ marginTop: 8 }}><span style={{ fontSize: "0.7rem", fontWeight: 700, background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: 999 }}>In Progress: {activeOrders}</span></div>
            </div>
            {/* Tables */}
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                <span style={lbl}>Active Tables</span>
              </div>
              <div style={val}>{occupiedTables}<span style={{ fontSize: "1rem", color: "#94a3b8", fontWeight: 500 }}>/{tables.length}</span></div>
              <div style={{ marginTop: 10, height: 6, borderRadius: 999, background: "#f1f5f9", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 999, background: "#0f172a", width: tables.length > 0 ? `${(occupiedTables / tables.length) * 100}%` : "0%" }} />
              </div>
            </div>
            {/* Low Stock */}
            <div style={{ ...card, background: lowStock.length > 0 ? "#fff7ed" : "#fff", borderColor: lowStock.length > 0 ? "#fdba74" : "#e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <span style={{ ...lbl, color: lowStock.length > 0 ? "#c2410c" : "#64748b" }}>Low Stock Alerts</span>
              </div>
              <div style={{ ...val, color: lowStock.length > 0 ? "#dc2626" : "#16a34a" }}>{lowStock.length}</div>
              {lowStock.length > 0
                ? <button onClick={() => navigate("/inventory")} style={{ marginTop: 8, fontSize: "0.72rem", fontWeight: 600, color: "#dc2626", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Review Inventory →</button>
                : <div style={muted}>All stocked</div>}
            </div>
          </div>

          {/* 2-column: Recent Orders + Right widgets */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>

            {/* Recent Orders */}
            <div style={section}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "#0f172a" }}>Recent Orders</h2>
                <button style={{ fontSize: "0.78rem", fontWeight: 600, color: "#059669", background: "none", border: "none", cursor: "pointer" }}>View All</button>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead><tr>{["Order ID","Table","Server","Status","Amount","Action"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {orders.slice(0, 10).map((order) => (
                    <tr key={order.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "11px 12px", fontWeight: 600, color: "#0f172a" }}>#{order.id.slice(0, 6).toUpperCase()}</td>
                      <td style={{ padding: "11px 12px", color: "#64748b" }}>T-{String(order.table_number || "-").padStart(2, "0")}</td>
                      <td style={{ padding: "11px 12px", color: "#64748b" }}>{order.server_name || "—"}</td>
                      <td style={{ padding: "11px 12px" }}>{statusPill(order.status)}</td>
                      <td style={{ padding: "11px 12px", fontWeight: 600, color: "#0f172a" }}>₱{Number(order.total).toFixed(2)}</td>
                      <td style={{ padding: "11px 12px" }}><button style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "1rem" }}>⋮</button></td>
                    </tr>
                  ))}
                  {orders.length === 0 && <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>No orders yet.</td></tr>}
                </tbody>
              </table>
            </div>

            {/* Right column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Active Protocols */}
              <div style={section}>
                <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "#0f172a", marginBottom: 14 }}>Active Protocols</h2>
                {[{ done: true, label: "Evening Shift Change", time: "16:00" }, { done: false, label: "Kitchen Deep Clean", time: "23:00" }].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: i === 0 ? 10 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: item.done ? "#d1fae5" : "#f1f5f9", color: item.done ? "#059669" : "#94a3b8", fontSize: "0.65rem", fontWeight: 700, flexShrink: 0 }}>{item.done ? "✓" : "○"}</span>
                      <span style={{ fontSize: "0.85rem", color: item.done ? "#374151" : "#64748b" }}>{item.label}</span>
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>{item.time}</span>
                  </div>
                ))}
              </div>

              {/* Staff on Shift — dark card */}
              <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14, padding: "20px 24px" }}>
                <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#fff", marginBottom: 10 }}>Staff on Shift</div>
                <div style={{ ...val, color: "#fff" }}>
                  {profiles.filter((p) => p.status === "Active").length}
                  <span style={{ fontSize: "1rem", color: "#94a3b8", fontWeight: 500 }}>/{profiles.length}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", marginTop: 14 }}>
                  {profiles.slice(0, 4).map((p, i) => (
                    <div key={p.id} style={{ width: 28, height: 28, borderRadius: "50%", background: roleColor[p.role] || "#475569", border: "2px solid #0f172a", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "0.65rem", fontWeight: 700, marginLeft: i > 0 ? -8 : 0, zIndex: 4 - i, position: "relative" }}>
                      {(p.full_name || "?")[0].toUpperCase()}
                    </div>
                  ))}
                  {profiles.length > 4 && <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1e293b", border: "2px solid #0f172a", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "0.6rem", fontWeight: 700, marginLeft: -8, position: "relative", zIndex: 0 }}>+{profiles.length - 4}</div>}
                </div>
              </div>

              {/* Mini stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ ...card, padding: "16px 18px" }}>
                  <div style={lbl}>Ingredients</div>
                  <div style={{ ...val, fontSize: "1.4rem" }}>{ingredients.length}</div>
                  <div style={{ ...muted, color: lowStock.length > 0 ? "#c2410c" : "#94a3b8" }}>{lowStock.length} low</div>
                </div>
                <div style={{ ...card, padding: "16px 18px" }}>
                  <div style={lbl}>Menu Items</div>
                  <div style={{ ...val, fontSize: "1.4rem" }}>{menuItems.length}</div>
                  <div style={muted}>{categories.length} categories</div>
                </div>
              </div>

              {/* Staff profiles list */}
              <div style={{ ...section, maxHeight: 260, overflowY: "auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h2 style={{ fontSize: "0.9rem", fontWeight: 600, color: "#0f172a" }}>Staff Profiles</h2>
                  <button onClick={() => setShowRegisterModal(true)} style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 7, padding: "4px 10px", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer" }}>+ Add</button>
                </div>
                {profiles.length === 0 ? <p style={{ color: "#94a3b8", fontSize: "0.82rem" }}>No profiles found.</p> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {profiles.map((p) => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: roleColor[p.role] || "#e2e8f0", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.75rem", flexShrink: 0 }}>{(p.full_name || "?")[0].toUpperCase()}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: "0.8rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#0f172a" }}>{p.full_name}</div>
                          <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                            <span style={{ fontSize: "0.62rem", fontWeight: 700, color: roleColor[p.role] || "#64748b", background: `${roleColor[p.role] || "#64748b"}22`, padding: "1px 5px", borderRadius: 999 }}>{p.role}</span>
                            <span style={{ fontSize: "0.62rem", fontWeight: 700, color: statusColor[p.status] || "#64748b", background: `${statusColor[p.status] || "#64748b"}22`, padding: "1px 5px", borderRadius: 999 }}>{p.status}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          <button onClick={() => setEditingProfile(p)} title="Edit" style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "3px 6px", cursor: "pointer", color: "#374151" }}><span className="ms" style={{ fontSize: 13 }}>edit</span></button>
                          <button onClick={() => setDeletingProfile(p)} title="Remove" style={{ background: "none", border: "1px solid #fecaca", borderRadius: 6, padding: "3px 6px", cursor: "pointer", color: "#dc2626" }}><span className="ms" style={{ fontSize: 13 }}>delete</span></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Protocol Management */}
          <div style={{ marginTop: 16 }}>
            <ProtocolManagementPanel onShowUpload={() => setShowUploadModal(true)} showToast={showToast} />
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {showRegisterModal && <RegisterStaffModal onClose={() => setShowRegisterModal(false)} onSuccess={handleRegistrationSuccess} />}
      {editingProfile && <EditStaffModal profile={editingProfile} onClose={() => setEditingProfile(null)} onSave={handleEditSave} />}
      {deletingProfile && <DeleteConfirmModal profile={deletingProfile} onClose={() => setDeletingProfile(null)} onConfirm={handleDeleteConfirm} />}
      {showUploadModal && <ProtocolUploadModal onClose={() => setShowUploadModal(false)} onSuccess={handleUploadSuccess} />}
      {showResetRevenueModal && <ResetRevenueConfirmModal onClose={() => setShowResetRevenueModal(false)} onConfirm={handleRevenueReset} />}
    </div>
  );
};

export default Admin;
