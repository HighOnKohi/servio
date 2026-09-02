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
// persistSession: false  → never writes to localStorage, so the admin's
//                          active session is NEVER overwritten or logged out.
// autoRefreshToken: false → no background token refresh that could interfere.
// detectSessionInUrl: false → don't read OAuth tokens from the URL.
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

// ─── Revenue helpers ──────────────────────────────────────────────────────────
/**
 * Returns a YYYY-MM-DD string in LOCAL time for a given Date or ISO string.
 * This prevents UTC-vs-local-midnight mismatches.
 */
function toLocalDateString(dateOrStr) {
  const d = dateOrStr instanceof Date ? dateOrStr : new Date(dateOrStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getStartOfLocalDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfLocalWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  return d;
}

// ─── Shared modal styles ──────────────────────────────────────────────────────
const modalOverlayStyle = {
  position: "fixed", inset: 0, zIndex: 1000,
  background: "rgba(0,0,0,0.45)",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const modalBoxStyle = {
  background: "#fff", borderRadius: 16, padding: "28px 32px",
  width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
};
const inputStyle = {
  width: "100%", padding: "8px 10px",
  border: "1px solid #e2e8f0", borderRadius: 8,
  fontSize: "0.85rem", color: "#111827", background: "#f8fafc",
  boxSizing: "border-box",
};
const labelStyle2 = {
  display: "flex", flexDirection: "column", gap: 4,
  fontSize: "0.8rem", fontWeight: 600, color: "#374151",
};
const errorBannerStyle = {
  background: "#fef2f2", border: "1px solid #fca5a5",
  borderRadius: 8, padding: "9px 12px", marginBottom: 14,
  fontSize: "0.82rem", color: "#dc2626",
};

// ─── Register Staff Modal ─────────────────────────────────────────────────────
function RegisterStaffModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "WAITER" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Step 1: Create the auth user with the secondary (isolated) client.
    // Because persistSession: false, this never touches localStorage and
    // the admin's active session is completely unaffected.
    const { data: signUpData, error: signUpError } = await secondarySupabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    const newUserId = signUpData?.user?.id;
    if (!newUserId) {
      setError("Sign-up succeeded but no user ID was returned. If email confirmation is enabled in Supabase, the user must confirm before an ID is returned — consider disabling it for staff accounts.");
      setLoading(false);
      return;
    }

    // Step 2: Insert the profile row using the primary admin client.
    // This runs as the currently logged-in admin, so it has the right permissions.
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({ id: newUserId, full_name: form.full_name, role: form.role, status: "Active" });

    if (profileError) {
      setError(`Auth user created but profile insert failed: ${profileError.message}`);
      setLoading(false);
      return;
    }

    setLoading(false);
    onSuccess(form.full_name);
  };

  return (
    <div style={modalOverlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalBoxStyle}>
        <h2 style={{ margin: "0 0 20px", fontSize: "1rem", fontWeight: 700, color: "#111827" }}>
          Register New Staff
        </h2>

        {error && <div style={errorBannerStyle}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={labelStyle2}>
            Full Name
            <input name="full_name" value={form.full_name} onChange={handleChange}
              placeholder="e.g. Maria Santos" required style={inputStyle} />
          </label>
          <label style={labelStyle2}>
            Email Address
            <input name="email" type="email" value={form.email} onChange={handleChange}
              placeholder="staff@servio.com" required style={inputStyle} />
          </label>
          <label style={labelStyle2}>
            Password
            <input name="password" type="password" value={form.password} onChange={handleChange}
              placeholder="Min. 8 characters" required minLength={8} style={inputStyle} />
          </label>
          <label style={labelStyle2}>
            Role
            <select name="role" value={form.role} onChange={handleChange} style={inputStyle}>
              {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>)}
            </select>
          </label>

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: "9px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", cursor: "pointer", fontSize: "0.85rem" }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              style={{ flex: 1, padding: "9px", border: "none", borderRadius: 8, background: loading ? "#93c5fd" : "#2563eb", color: "#fff", cursor: loading ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "0.85rem" }}>
              {loading ? "Registering…" : "Register"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Staff Modal ─────────────────────────────────────────────────────────
function EditStaffModal({ profile, onClose, onSave }) {
  const [form, setForm] = useState({
    full_name: profile.full_name || "",
    role: profile.role || "WAITER",
    status: profile.status || "Active",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: updateError } = await onSave(profile.id, form);
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
    }
    // onSave closes the modal on success
  };

  return (
    <div style={modalOverlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalBoxStyle}>
        <h2 style={{ margin: "0 0 20px", fontSize: "1rem", fontWeight: 700, color: "#111827" }}>
          Edit Staff — {profile.full_name}
        </h2>

        {error && <div style={errorBannerStyle}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={labelStyle2}>
            Full Name
            <input name="full_name" value={form.full_name} onChange={handleChange}
              required style={inputStyle} />
          </label>
          <label style={labelStyle2}>
            Role
            <select name="role" value={form.role} onChange={handleChange} style={inputStyle}>
              {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>)}
            </select>
          </label>
          <label style={labelStyle2}>
            Status
            <select name="status" value={form.status} onChange={handleChange} style={inputStyle}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: "9px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", cursor: "pointer", fontSize: "0.85rem" }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              style={{ flex: 1, padding: "9px", border: "none", borderRadius: 8, background: loading ? "#86efac" : "#16a34a", color: "#fff", cursor: loading ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "0.85rem" }}>
              {loading ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteConfirmModal({ profile, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm(profile.id);
  };

  return (
    <div style={modalOverlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modalBoxStyle, width: 380 }}>
        <h2 style={{ margin: "0 0 10px", fontSize: "1rem", fontWeight: 700, color: "#111827" }}>
          Remove Staff Member?
        </h2>
        <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "0 0 20px" }}>
          This will remove <strong>{profile.full_name}</strong>'s profile from the database.
          Their login account will still exist in Supabase Auth but they will no longer
          appear in the system. This action cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onClose}
            style={{ flex: 1, padding: "9px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", cursor: "pointer", fontSize: "0.85rem" }}>
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} disabled={loading}
            style={{ flex: 1, padding: "9px", border: "none", borderRadius: 8, background: loading ? "#fca5a5" : "#dc2626", color: "#fff", cursor: loading ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "0.85rem" }}>
            {loading ? "Removing…" : "Yes, Remove"}
          </button>
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#111827" }}>
            Reset Shift Revenue?
          </h2>
        </div>
        <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "0 0 6px" }}>
          This will set a new <strong>shift baseline</strong> to right now. The revenue counter
          will restart from <strong>₱0.00</strong>.
        </p>
        <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "0 0 22px" }}>
          All historical orders remain saved — this only changes what is counted in the
          revenue display. The reset is stored locally and will persist through page refreshes.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onClose}
            style={{ flex: 1, padding: "9px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", cursor: "pointer", fontSize: "0.85rem" }}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm}
            style={{ flex: 1, padding: "9px", border: "none", borderRadius: 8, background: "#d97706", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}>
            Reset Shift
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── useFixedInterfaceCanvas ──────────────────────────────────────────────────
function useFixedInterfaceCanvas() {
  const [, refreshScale] = useState(0);

  useEffect(() => {
    const updateScale = () => refreshScale((v) => v + 1);
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  if (typeof window === "undefined") return { scale: 1, width: "100%", height: "100vh" };

  const pr = window.devicePixelRatio || 1;
  return {
    scale: 1 / pr,
    width: `${Math.round(window.innerWidth * pr)}px`,
    height: `${Math.round(window.innerHeight * pr)}px`,
  };
}

// ─── Admin Page ───────────────────────────────────────────────────────────────
const Admin = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const {
    tables, menuItems, categories, orders, profiles, ingredients,
    getLowStockIngredients, loading, refetchProfiles,
    updateProfile, deleteProfile,
  } = usePOS();

  const interfaceCanvas = useFixedInterfaceCanvas();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  // Modal state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [deletingProfile, setDeletingProfile] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showResetRevenueModal, setShowResetRevenueModal] = useState(false);
  const [toast, setToast] = useState("");

  // ── Revenue filter & reset state ──────────────────────────────────────────
  const [revenueFilter, setRevenueFilter] = useState("today"); // "today" | "week" | "all"
  const [revenueResetTimestamp, setRevenueResetTimestamp] = useState(() => {
    const saved = localStorage.getItem(LS_RESET_KEY);
    return saved ? Number(saved) : null;
  });

  useEffect(() => {
    const id = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate("/login");
  }, [logout, navigate]);

  const handleRegistrationSuccess = useCallback((name) => {
    setShowRegisterModal(false);
    refetchProfiles();
    showToast(`✓ ${name} has been registered successfully.`);
  }, [refetchProfiles, showToast]);

  const handleUploadSuccess = useCallback((count) => {
    showToast(`✓ ${count} protocol${count !== 1 ? "s" : ""} uploaded successfully.`);
  }, [showToast]);

  const handleEditSave = useCallback(async (id, updates) => {
    const { error } = await updateProfile(id, updates);
    if (!error) {
      setEditingProfile(null);
      showToast("✓ Staff member updated successfully.");
    }
    return { error };
  }, [updateProfile, showToast]);

  const handleDeleteConfirm = useCallback(async (id) => {
    const { error } = await deleteProfile(id);
    if (!error) {
      setDeletingProfile(null);
      showToast("✓ Staff member removed.");
    }
  }, [deleteProfile, showToast]);

  const handleRevenueReset = useCallback(() => {
    const now = Date.now();
    setRevenueResetTimestamp(now);
    localStorage.setItem(LS_RESET_KEY, String(now));
    setShowResetRevenueModal(false);
    showToast("✓ Shift revenue reset. Counter starts from ₱0.00.");
  }, [showToast]);

  const handleClearRevenueReset = useCallback(() => {
    setRevenueResetTimestamp(null);
    localStorage.removeItem(LS_RESET_KEY);
    showToast("✓ Shift baseline cleared. Showing full period revenue.");
  }, [showToast]);

  const time = currentDateTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });
  const date = currentDateTime.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // ── Computed stats ──────────────────────────────────────────────────────────
  const totalOrders = orders.length;
  const completedOrders = orders.filter((o) => o.status === "COMPLETED").length;
  const activeOrders = orders.filter((o) => o.status === "PENDING" || o.status === "IN_PROGRESS").length;
  const cancelledOrders = orders.filter((o) => o.status === "CANCELLED").length;
  const occupiedTables = tables.filter((t) => t.status === "OCCUPIED").length;
  const lowStock = getLowStockIngredients();

  // Revenue calculation — uses updated_at (accurate completion time) instead of
  // created_at, and compares local date strings to avoid UTC/local-time mismatches.
  const todayRevenue = useMemo(() => {
    const now = new Date();
    const todayStr = toLocalDateString(now);
    const weekStart = getStartOfLocalWeek(now);
    const dayStart = getStartOfLocalDay(now);

    return orders
      .filter((o) => {
        if (o.status !== "COMPLETED") return false;

        // Use updated_at as the completion timestamp; fall back to created_at if missing.
        const completedAt = new Date(o.updated_at || o.created_at);

        // Apply shift reset baseline — only count orders completed after the reset.
        if (revenueResetTimestamp && completedAt.getTime() < revenueResetTimestamp) {
          return false;
        }

        if (revenueFilter === "today") {
          return toLocalDateString(completedAt) === todayStr;
        }
        if (revenueFilter === "week") {
          return completedAt >= weekStart;
        }
        // "all" — no date restriction
        return true;
      })
      .reduce((sum, o) => sum + Number(o.total), 0);
  }, [orders, revenueFilter, revenueResetTimestamp]);

  // Label shown under revenue amount
  const revenuePeriodLabel = useMemo(() => {
    if (revenueResetTimestamp) {
      const resetDate = new Date(revenueResetTimestamp);
      const timeStr = resetDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      const dateStr = toLocalDateString(resetDate) === toLocalDateString(new Date()) ? "Today" : resetDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return `Since ${dateStr}, ${timeStr}`;
    }
    return REVENUE_FILTER_LABELS[revenueFilter];
  }, [revenueResetTimestamp, revenueFilter]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f8fafc", color: "#111827", fontSize: "1.2rem" }}>
        Loading…
      </div>
    );
  }

  const cardStyle = { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 24px", boxShadow: "0 7px 20px rgba(15, 23, 42, 0.05)" };
  const sectionStyle = { background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 14, padding: "16px 20px", overflow: "auto", boxShadow: "0 7px 20px rgba(15, 23, 42, 0.05)" };
  const labelStyle = { fontSize: "0.75rem", textTransform: "uppercase", color: "#64748b", marginBottom: 4, letterSpacing: "0.05em", fontWeight: 700 };
  const valueStyle = { fontSize: "1.6rem", fontWeight: 700, color: "#0f172a" };
  const mutedStyle = { fontSize: "0.75rem", marginTop: 6, color: "#64748b" };
  const tableHeadingStyle = { textAlign: "left", padding: "10px 12px", color: "#64748b", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.04em" };

  const roleColor = { ADMIN: "#7c3aed", CASHIER: "#2563eb", WAITER: "#0891b2", KITCHEN: "#b45309" };
  const statusColor = { Active: "#16a34a", Inactive: "#9ca3af" };

  // Revenue filter pill style helper
  const filterPillStyle = (key) => ({
    padding: "3px 10px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 600,
    border: "1px solid",
    cursor: "pointer",
    transition: "all 0.15s",
    background: revenueFilter === key && !revenueResetTimestamp ? "#0f172a" : "transparent",
    color: revenueFilter === key && !revenueResetTimestamp ? "#fff" : "#64748b",
    borderColor: revenueFilter === key && !revenueResetTimestamp ? "#0f172a" : "#e2e8f0",
  });

  return (
    <div
      className="admin-page"
      style={{
        "--admin-scale": interfaceCanvas.scale,
        width: interfaceCanvas.width, height: interfaceCanvas.height, minHeight: interfaceCanvas.height,
        background: "#f8fafc", color: "#111827",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex", flexDirection: "column", overflow: "hidden",
        zoom: "var(--admin-scale)",
      }}
    >
      {/* ── Header ── */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 24px", borderBottom: "1px solid #e5e7eb", background: "#ffffff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
          </svg>
          <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>Admin Dashboard</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "0.82rem", color: "#64748b" }}>{date}, {time}</span>
          <button onClick={() => navigate("/")} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", color: "#374151", cursor: "pointer" }} aria-label="Return to Interface Selector">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
            </svg>
          </button>
          <button onClick={handleLogout} style={{ background: "none", border: "1px solid #fca5a5", borderRadius: 8, padding: "6px 10px", color: "#dc2626", cursor: "pointer", fontSize: "0.78rem", fontWeight: 600 }}>
            Logout
          </button>
        </div>
      </header>

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#0f172a", color: "#fff", padding: "10px 20px", borderRadius: 10, fontSize: "0.85rem", zIndex: 2000, boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}>
          {toast}
        </div>
      )}

      {/* ── Revenue filter + reset bar ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 4 }}>Revenue Period:</span>
          {REVENUE_FILTER_OPTIONS.map((key) => (
            <button
              key={key}
              onClick={() => { setRevenueFilter(key); if (revenueResetTimestamp) handleClearRevenueReset(); }}
              style={filterPillStyle(key)}
              aria-pressed={revenueFilter === key && !revenueResetTimestamp}
            >
              {REVENUE_FILTER_LABELS[key]}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {revenueResetTimestamp && (
            <button
              onClick={handleClearRevenueReset}
              style={{ padding: "3px 10px", fontSize: "0.72rem", fontWeight: 600, border: "1px solid #bfdbfe", borderRadius: 20, background: "#eff6ff", color: "#2563eb", cursor: "pointer" }}
              aria-label="Clear shift reset baseline"
            >
              Clear Reset
            </button>
          )}
          <button
            onClick={() => setShowResetRevenueModal(true)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 12px 3px 8px", fontSize: "0.72rem", fontWeight: 600, border: "1px solid #fde68a", borderRadius: 20, background: "#fffbeb", color: "#d97706", cursor: "pointer" }}
            aria-label="Reset shift revenue baseline"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Reset Shift
          </button>
        </div>
      </div>

      {/* ── Stats Row 1 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, padding: "12px 24px 0", flexShrink: 0 }}>
        {/* Revenue card */}
        <div style={{ ...cardStyle, borderColor: revenueResetTimestamp ? "#fde68a" : "#e2e8f0", background: revenueResetTimestamp ? "#fffbeb" : "#ffffff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={labelStyle}>Today&apos;s Revenue</div>
            {revenueResetTimestamp && (
              <span style={{ fontSize: "0.62rem", fontWeight: 600, color: "#d97706", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 20, padding: "1px 7px", whiteSpace: "nowrap" }}>
                Shift Reset
              </span>
            )}
          </div>
          <div style={{ ...valueStyle, color: "#16a34a" }}>₱{todayRevenue.toFixed(2)}</div>
          <div style={mutedStyle}>{revenuePeriodLabel}</div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>Total Orders</div>
          <div style={valueStyle}>{totalOrders}</div>
          <div style={mutedStyle}>{activeOrders} active · {completedOrders} completed · {cancelledOrders} cancelled</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Tables</div>
          <div style={valueStyle}>{tables.length}</div>
          <div style={mutedStyle}>{occupiedTables} occupied · {tables.length - occupiedTables} available</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Menu Items</div>
          <div style={valueStyle}>{menuItems.length}</div>
          <div style={mutedStyle}>{categories.length} categories</div>
        </div>
      </div>

      {/* ── Stats Row 2 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, padding: "16px 24px 20px", flexShrink: 0 }}>
        <div style={{ ...cardStyle, background: lowStock.length > 0 ? "#fff7ed" : "#ffffff", borderColor: lowStock.length > 0 ? "#fdba74" : "#e2e8f0" }}>
          <div style={labelStyle}>Low Stock Alerts</div>
          <div style={{ ...valueStyle, color: lowStock.length > 0 ? "#c2410c" : "#16a34a" }}>{lowStock.length}</div>
          {lowStock.length > 0 && (
            <div style={{ ...mutedStyle, color: "#9a3412" }}>
              {lowStock.slice(0, 3).map((i) => i.name).join(", ")}
              {lowStock.length > 3 ? ` +${lowStock.length - 3} more` : ""}
            </div>
          )}
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Ingredients</div>
          <div style={valueStyle}>{ingredients.length}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Staff Profiles</div>
          <div style={valueStyle}>{profiles.length}</div>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr", gap: 16, padding: "0 24px 24px", overflow: "hidden" }}>

        {/* Recent Orders */}
        <div style={sectionStyle}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 12px", color: "#111827" }}>Recent Orders</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                <th style={tableHeadingStyle}>Order</th>
                <th style={tableHeadingStyle}>Table</th>
                <th style={tableHeadingStyle}>Server</th>
                <th style={tableHeadingStyle}>Total</th>
                <th style={tableHeadingStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 15).map((order) => {
                const sc = { COMPLETED: "#16a34a", CANCELLED: "#dc2626", PENDING: "#ca8a04", IN_PROGRESS: "#2563eb", READY: "#7c3aed" }[order.status] || "#475569";
                return (
                  <tr key={order.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 500 }}>#{order.id.slice(0, 6)}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{order.table_number || "-"}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{order.server_name || "-"}</td>
                    <td style={{ padding: "8px 10px" }}>₱{Number(order.total).toFixed(2)}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 600, color: sc, background: `${sc}18` }}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>No orders yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Staff Profiles */}
        <div style={{ ...sectionStyle, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ fontSize: "0.95rem", fontWeight: 600, margin: 0, color: "#111827" }}>Staff Profiles</h2>
            <button
              onClick={() => setShowRegisterModal(true)}
              style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
            >
              + Register Staff
            </button>
          </div>

          {profiles.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>No profiles found.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", flex: 1 }}>
              {profiles.map((p) => (
                <div
                  key={p.id}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10 }}
                >
                  {/* Avatar */}
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: roleColor[p.role] || "#e2e8f0", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.82rem", flexShrink: 0 }}>
                    {(p.full_name || "?")[0].toUpperCase()}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: "0.84rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.full_name}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: "0.68rem", fontWeight: 600, color: roleColor[p.role] || "#64748b", background: `${roleColor[p.role] || "#64748b"}18`, padding: "1px 6px", borderRadius: 20 }}>
                        {p.role}
                      </span>
                      <span style={{ fontSize: "0.68rem", fontWeight: 600, color: statusColor[p.status] || "#64748b", background: `${statusColor[p.status] || "#64748b"}18`, padding: "1px 6px", borderRadius: 20 }}>
                        {p.status}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={() => setEditingProfile(p)}
                      title="Edit"
                      style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: "0.75rem", color: "#374151" }}
                    >
                      <span className="ms" style={{ fontSize: 16 }}>edit</span>
                    </button>
                    <button
                      onClick={() => setDeletingProfile(p)}
                      title="Remove"
                      style={{ background: "none", border: "1px solid #fecaca", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: "0.75rem", color: "#dc2626" }}
                    >
                      <span className="ms" style={{ fontSize: 16 }}>delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Protocol Management */}
        <ProtocolManagementPanel
          onShowUpload={() => setShowUploadModal(true)}
          showToast={showToast}
        />
      </div>

      {/* ── Modals ── */}
      {showRegisterModal && (
        <RegisterStaffModal
          onClose={() => setShowRegisterModal(false)}
          onSuccess={handleRegistrationSuccess}
        />
      )}
      {editingProfile && (
        <EditStaffModal
          profile={editingProfile}
          onClose={() => setEditingProfile(null)}
          onSave={handleEditSave}
        />
      )}
      {deletingProfile && (
        <DeleteConfirmModal
          profile={deletingProfile}
          onClose={() => setDeletingProfile(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
      {showUploadModal && (
        <ProtocolUploadModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={handleUploadSuccess}
        />
      )}
      {showResetRevenueModal && (
        <ResetRevenueConfirmModal
          onClose={() => setShowResetRevenueModal(false)}
          onConfirm={handleRevenueReset}
        />
      )}
    </div>
  );
};

export default Admin;
