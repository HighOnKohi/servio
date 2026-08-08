import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePOS } from "../../context/POSContext";
import "./inventory.css";

function useFixedInterfaceCanvas() {
  const [, refreshScale] = useState(0);
  useEffect(() => {
    const updateScale = () => refreshScale((v) => v + 1);
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);
  if (typeof window === "undefined") return { scale: 1, width: "100%", height: "100vh" };
  const pr = window.devicePixelRatio || 1;
  return { scale: 1 / pr, width: `${Math.round(window.innerWidth * pr)}px`, height: `${Math.round(window.innerHeight * pr)}px` };
}

// Dowell
const Inventory = () => {
  const navigate = useNavigate();
  const {
    ingredients,
    addIngredient,
    updateIngredient,
    deleteIngredient,
    getLowStockIngredients,
    loading,
  } = usePOS();

  const interfaceCanvas = useFixedInterfaceCanvas();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState("");

  // Form state
  const [formName, setFormName] = useState("");
  const [formUnit, setFormUnit] = useState("pcs");
  const [formStock, setFormStock] = useState("");
  const [formThreshold, setFormThreshold] = useState("10");
  const [formCost, setFormCost] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const id = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const lowStock = getLowStockIngredients();
  const searchTerm = search.trim().toLowerCase();
  const filtered = searchTerm
    ? ingredients.filter((i) => i.name.toLowerCase().includes(searchTerm))
    : ingredients;

  function resetForm() {
    setFormName(""); setFormUnit("pcs"); setFormStock(""); setFormThreshold("10"); setFormCost(""); setFormError("");
  }

  function openAdd() {
    resetForm();
    setShowAddModal(true);
  }

  function openEdit(item) {
    setFormName(item.name);
    setFormUnit(item.unit);
    setFormStock(String(item.stock));
    setFormThreshold(String(item.low_stock_threshold));
    setFormCost(String(item.cost_per_unit));
    setFormError("");
    setEditingItem(item);
  }

  async function handleSave() {
    if (!formName.trim()) { setFormError("Name is required."); return; }
    if (!formStock || Number(formStock) < 0) { setFormError("Stock must be 0 or more."); return; }

    if (editingItem) {
      await updateIngredient(editingItem.id, {
        name: formName.trim(),
        unit: formUnit,
        stock: Number(formStock),
        low_stock_threshold: Number(formThreshold),
        cost_per_unit: Number(formCost) || 0,
      });
      setEditingItem(null);
    } else {
      const { error } = await addIngredient({
        name: formName.trim(),
        unit: formUnit,
        stock: Number(formStock),
        low_stock_threshold: Number(formThreshold),
        cost_per_unit: Number(formCost) || 0,
      });
      if (error) { setFormError(error.message || "Failed to add ingredient."); return; }
      setShowAddModal(false);
    }
    resetForm();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteIngredient(deleteTarget.id);
    setDeleteTarget(null);
  }

  const time = currentDateTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });
  const date = currentDateTime.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  if (loading) {
    return <div className="inventory-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#fff", fontSize: "1.2rem" }}>Loading…</div>;
  }

  return (
    <div
      className="inventory-page"
      style={{
        "--inv-scale": interfaceCanvas.scale,
        width: interfaceCanvas.width,
        height: interfaceCanvas.height,
        minHeight: interfaceCanvas.height,
        background: "#0b0f1a",
        color: "#e2e8f0",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 24px", borderBottom: "1px solid #1e293b", background: "#0f1525" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
          <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>Inventory Interface</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: "0.82rem", opacity: 0.7 }}>{date}, {time}</span>
          <button onClick={() => navigate("/")} style={{ background: "none", border: "1px solid #334155", borderRadius: 6, padding: "6px 10px", color: "#e2e8f0", cursor: "pointer" }} aria-label="Return">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
          </button>
        </div>
      </header>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 16, padding: "16px 24px", flexShrink: 0 }}>
        <div style={{ flex: 1, background: "#1e293b", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ fontSize: "0.75rem", textTransform: "uppercase", opacity: 0.5, marginBottom: 4 }}>Total Ingredients</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{ingredients.length}</div>
        </div>
        <div style={{ flex: 1, background: lowStock.length > 0 ? "#7f1d1d" : "#1e293b", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ fontSize: "0.75rem", textTransform: "uppercase", opacity: 0.5, marginBottom: 4 }}>Low Stock Items</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: lowStock.length > 0 ? "#fca5a5" : "#e2e8f0" }}>{lowStock.length}</div>
        </div>
        <div style={{ flex: 1, background: "#1e293b", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ fontSize: "0.75rem", textTransform: "uppercase", opacity: 0.5, marginBottom: 4 }}>Total Stock Value</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>₱{ingredients.reduce((s, i) => s + Number(i.stock) * Number(i.cost_per_unit), 0).toFixed(2)}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px 12px", flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: "1.15rem", fontWeight: 600, margin: 0 }}>Ingredients</h1>
          <p style={{ fontSize: "0.8rem", opacity: 0.5, margin: "2px 0 0" }}>Manage your inventory stock levels.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            type="search"
            placeholder="Search ingredients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #334155", background: "#1e293b", color: "#e2e8f0", fontSize: "0.85rem", width: 220 }}
          />
          <button onClick={openAdd} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#3b82f6", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: "0.85rem" }}>＋ Add Ingredient</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: "auto", padding: "0 24px 24px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1e293b", textAlign: "left" }}>
              <th style={{ padding: "10px 12px", fontWeight: 600, opacity: 0.6, fontSize: "0.75rem", textTransform: "uppercase" }}>Name</th>
              <th style={{ padding: "10px 12px", fontWeight: 600, opacity: 0.6, fontSize: "0.75rem", textTransform: "uppercase" }}>Unit</th>
              <th style={{ padding: "10px 12px", fontWeight: 600, opacity: 0.6, fontSize: "0.75rem", textTransform: "uppercase" }}>Stock</th>
              <th style={{ padding: "10px 12px", fontWeight: 600, opacity: 0.6, fontSize: "0.75rem", textTransform: "uppercase" }}>Threshold</th>
              <th style={{ padding: "10px 12px", fontWeight: 600, opacity: 0.6, fontSize: "0.75rem", textTransform: "uppercase" }}>Cost/Unit</th>
              <th style={{ padding: "10px 12px", fontWeight: 600, opacity: 0.6, fontSize: "0.75rem", textTransform: "uppercase" }}>Status</th>
              <th style={{ padding: "10px 12px", fontWeight: 600, opacity: 0.6, fontSize: "0.75rem", textTransform: "uppercase" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", opacity: 0.4 }}>No ingredients found.</td></tr>
            ) : filtered.map((item) => {
              const isLow = Number(item.stock) <= Number(item.low_stock_threshold);
              return (
                <tr key={item.id} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "12px", fontWeight: 500 }}>{item.name}</td>
                  <td style={{ padding: "12px", opacity: 0.7 }}>{item.unit}</td>
                  <td style={{ padding: "12px", fontWeight: 600, color: isLow ? "#fca5a5" : "#4ade80" }}>{Number(item.stock).toFixed(1)}</td>
                  <td style={{ padding: "12px", opacity: 0.7 }}>{Number(item.low_stock_threshold).toFixed(1)}</td>
                  <td style={{ padding: "12px" }}>₱{Number(item.cost_per_unit).toFixed(2)}</td>
                  <td style={{ padding: "12px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 600, background: isLow ? "#7f1d1d" : "#14532d", color: isLow ? "#fca5a5" : "#4ade80" }}>
                      {isLow ? "LOW" : "OK"}
                    </span>
                  </td>
                  <td style={{ padding: "12px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEdit(item)} style={{ background: "none", border: "1px solid #334155", borderRadius: 6, padding: "4px 10px", color: "#93c5fd", cursor: "pointer", fontSize: "0.8rem" }}>✎</button>
                      <button onClick={() => setDeleteTarget(item)} style={{ background: "none", border: "1px solid #334155", borderRadius: 6, padding: "4px 10px", color: "#fca5a5", cursor: "pointer", fontSize: "0.8rem" }}>✕</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowAddModal(false)}>
          <div style={{ background: "#1e293b", borderRadius: 12, padding: 28, width: 400, maxWidth: "90vw" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 16px", fontSize: "1.1rem" }}>Add Ingredient</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input placeholder="Name" value={formName} onChange={(e) => setFormName(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #334155", background: "#0f1525", color: "#e2e8f0" }} />
              <input placeholder="Unit (e.g. pcs, kg, ml)" value={formUnit} onChange={(e) => setFormUnit(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #334155", background: "#0f1525", color: "#e2e8f0" }} />
              <input placeholder="Stock" type="number" min="0" value={formStock} onChange={(e) => setFormStock(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #334155", background: "#0f1525", color: "#e2e8f0" }} />
              <input placeholder="Low Stock Threshold" type="number" min="0" value={formThreshold} onChange={(e) => setFormThreshold(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #334155", background: "#0f1525", color: "#e2e8f0" }} />
              <input placeholder="Cost per Unit" type="number" min="0" step="0.01" value={formCost} onChange={(e) => setFormCost(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #334155", background: "#0f1525", color: "#e2e8f0" }} />
              {formError && <p style={{ color: "#fca5a5", fontSize: "0.82rem", margin: 0 }}>{formError}</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={handleSave} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "#3b82f6", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Add</button>
                <button onClick={() => { setShowAddModal(false); resetForm(); }} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #334155", background: "transparent", color: "#e2e8f0", cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => { setEditingItem(null); resetForm(); }}>
          <div style={{ background: "#1e293b", borderRadius: 12, padding: 28, width: 400, maxWidth: "90vw" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 16px", fontSize: "1.1rem" }}>Edit Ingredient</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input placeholder="Name" value={formName} onChange={(e) => setFormName(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #334155", background: "#0f1525", color: "#e2e8f0" }} />
              <input placeholder="Unit" value={formUnit} onChange={(e) => setFormUnit(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #334155", background: "#0f1525", color: "#e2e8f0" }} />
              <input placeholder="Stock" type="number" min="0" value={formStock} onChange={(e) => setFormStock(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #334155", background: "#0f1525", color: "#e2e8f0" }} />
              <input placeholder="Low Stock Threshold" type="number" min="0" value={formThreshold} onChange={(e) => setFormThreshold(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #334155", background: "#0f1525", color: "#e2e8f0" }} />
              <input placeholder="Cost per Unit" type="number" min="0" step="0.01" value={formCost} onChange={(e) => setFormCost(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #334155", background: "#0f1525", color: "#e2e8f0" }} />
              {formError && <p style={{ color: "#fca5a5", fontSize: "0.82rem", margin: 0 }}>{formError}</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={handleSave} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "#3b82f6", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Save</button>
                <button onClick={() => { setEditingItem(null); resetForm(); }} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #334155", background: "transparent", color: "#e2e8f0", cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setDeleteTarget(null)}>
          <div style={{ background: "#1e293b", borderRadius: 12, padding: 28, width: 380, maxWidth: "90vw", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>Delete Ingredient</h2>
            <p style={{ opacity: 0.7, fontSize: "0.9rem" }}>Are you sure you want to delete <strong>{deleteTarget.name}</strong>?</p>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={handleDelete} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Delete</button>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #334155", background: "transparent", color: "#e2e8f0", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
