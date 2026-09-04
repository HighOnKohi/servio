import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePOS } from "../../context/POSContext";
import ScaleSelector, { useUIScale } from "../../components/ScaleSelector";
import ServioHeader from "../../components/ServioHeader";
import "./inventory.css";

function useFixedInterfaceCanvas() {
  return { scale: 1, width: "100%", height: "100vh" };
}

const Inventory = () => {
  const navigate = useNavigate();
  const { scale: uiScale, changeScale: handleScaleChange, fontScale, elementScale } = useUIScale();
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
    setFormName("");
    setFormUnit("pcs");
    setFormStock("");
    setFormThreshold("10");
    setFormCost("");
    setFormError("");
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
    if (!formName.trim()) {
      setFormError("Name is required.");
      return;
    }

    if (!formStock || Number(formStock) < 0) {
      setFormError("Stock must be 0 or more.");
      return;
    }

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

      if (error) {
        setFormError(error.message || "Failed to add ingredient.");
        return;
      }

      setShowAddModal(false);
    }

    resetForm();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteIngredient(deleteTarget.id);
    setDeleteTarget(null);
  }

  const time = currentDateTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
  const date = currentDateTime.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (loading) {
    return (
      <div
        className="inventory-page"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#f8fafc",
          color: "#111827",
          fontSize: "1.2rem",
        }}
      >
        Loading...
      </div>
    );
  }

  const summaryCardStyle = {
    flex: 1,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "16px 20px",
    boxShadow: "0 7px 20px rgba(15, 23, 42, 0.05)",
  };
  const tableShellStyle = {
    flex: 1,
    overflow: "auto",
    padding: "0 24px 24px",
  };
  const tableCardStyle = {
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "0 7px 20px rgba(15, 23, 42, 0.05)",
  };
  const modalOverlayStyle = {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.34)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  };
  const modalCardStyle = {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 28,
    boxShadow: "0 20px 48px rgba(15, 23, 42, 0.20)",
  };
  const inputStyle = {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    fontSize: "0.92rem",
  };
  const secondaryButtonStyle = {
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    background: "#ffffff",
    color: "#374151",
    cursor: "pointer",
  };

  return (
    <div
      className={`inventory-page inventory-page--scale-${uiScale}`}
      style={{
        "--servio-font-scale": fontScale,
        "--servio-elem-scale": elementScale,
        width: "100%",
        height: "100vh",
        maxHeight: "100vh",
        background: "#f8fafc",
        color: "#111827",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ── Unified Kitchen-Style Header ── */}
      <ServioHeader
        title="Inventory Interface"
        group="ADMIN"
        uiScale={uiScale}
        onScaleChange={handleScaleChange}
      />

      <div style={{ display: "flex", gap: 16, padding: "16px 24px", flexShrink: 0 }}>
        <div style={summaryCardStyle}>
          <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#64748b", marginBottom: 4, fontWeight: 700 }}>Total Ingredients</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>{ingredients.length}</div>
        </div>
        <div
          style={{
            ...summaryCardStyle,
            background: lowStock.length > 0 ? "#fff7ed" : "#ffffff",
            borderColor: lowStock.length > 0 ? "#fdba74" : "#e2e8f0",
          }}
        >
          <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#64748b", marginBottom: 4, fontWeight: 700 }}>Low Stock Items</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: lowStock.length > 0 ? "#c2410c" : "#111827" }}>{lowStock.length}</div>
        </div>
        <div style={summaryCardStyle}>
          <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#64748b", marginBottom: 4, fontWeight: 700 }}>Total Stock Value</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700 }}>P{ingredients.reduce((s, i) => s + Number(i.stock) * Number(i.cost_per_unit), 0).toFixed(2)}</div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px 12px", flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: "1.15rem", fontWeight: 600, margin: 0 }}>Ingredients</h1>
          <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "2px 0 0" }}>Manage your inventory stock levels.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            type="search"
            placeholder="Search ingredients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, width: 220 }}
          />
          <button
            onClick={openAdd}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "#111827",
              color: "#ffffff",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            + Add Ingredient
          </button>
        </div>
      </div>

      <div style={tableShellStyle}>
        <div style={tableCardStyle}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", background: "#f8fafc" }}>
                <th style={{ padding: "10px 12px", fontWeight: 700, color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase" }}>Name</th>
                <th style={{ padding: "10px 12px", fontWeight: 700, color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase" }}>Unit</th>
                <th style={{ padding: "10px 12px", fontWeight: 700, color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase" }}>Stock</th>
                <th style={{ padding: "10px 12px", fontWeight: 700, color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase" }}>Threshold</th>
                <th style={{ padding: "10px 12px", fontWeight: 700, color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase" }}>Cost/Unit</th>
                <th style={{ padding: "10px 12px", fontWeight: 700, color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase" }}>Status</th>
                <th style={{ padding: "10px 12px", fontWeight: 700, color: "#64748b", fontSize: "0.75rem", textTransform: "uppercase" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
                    No ingredients found.
                  </td>
                </tr>
              ) : filtered.map((item) => {
                const isLow = Number(item.stock) <= Number(item.low_stock_threshold);

                return (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px", fontWeight: 500 }}>{item.name}</td>
                    <td style={{ padding: "12px", color: "#64748b" }}>{item.unit}</td>
                    <td style={{ padding: "12px", fontWeight: 600, color: isLow ? "#dc2626" : "#16a34a" }}>{Number(item.stock).toFixed(1)}</td>
                    <td style={{ padding: "12px", color: "#64748b" }}>{Number(item.low_stock_threshold).toFixed(1)}</td>
                    <td style={{ padding: "12px" }}>P{Number(item.cost_per_unit).toFixed(2)}</td>
                    <td style={{ padding: "12px" }}>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: 20,
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          background: isLow ? "#fef2f2" : "#ecfdf5",
                          color: isLow ? "#b91c1c" : "#15803d",
                          border: `1px solid ${isLow ? "#fecaca" : "#bbf7d0"}`,
                        }}
                      >
                        {isLow ? "LOW" : "OK"}
                      </span>
                    </td>
                    <td style={{ padding: "12px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => openEdit(item)}
                          style={{
                            ...secondaryButtonStyle,
                            padding: "4px 10px",
                            color: "#2563eb",
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(item)}
                          style={{
                            ...secondaryButtonStyle,
                            padding: "4px 10px",
                            color: "#dc2626",
                            borderColor: "#fecaca",
                            background: "#fff1f2",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div style={modalOverlayStyle} onClick={() => setShowAddModal(false)}>
          <div style={{ ...modalCardStyle, width: 400, maxWidth: "90vw" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 16px", fontSize: "1.1rem", color: "#111827" }}>Add Ingredient</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input placeholder="Name" value={formName} onChange={(e) => setFormName(e.target.value)} style={inputStyle} />
              <input placeholder="Unit (e.g. pcs, kg, ml)" value={formUnit} onChange={(e) => setFormUnit(e.target.value)} style={inputStyle} />
              <input placeholder="Stock" type="number" min="0" value={formStock} onChange={(e) => setFormStock(e.target.value)} style={inputStyle} />
              <input placeholder="Low Stock Threshold" type="number" min="0" value={formThreshold} onChange={(e) => setFormThreshold(e.target.value)} style={inputStyle} />
              <input placeholder="Cost per Unit" type="number" min="0" step="0.01" value={formCost} onChange={(e) => setFormCost(e.target.value)} style={inputStyle} />
              {formError && <p style={{ color: "#dc2626", fontSize: "0.82rem", margin: 0 }}>{formError}</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  onClick={handleSave}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: 8,
                    border: "1px solid #087f63",
                    background: "#087f63",
                    color: "#ffffff",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  style={{ ...secondaryButtonStyle, flex: 1, padding: "10px" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingItem && (
        <div
          style={modalOverlayStyle}
          onClick={() => {
            setEditingItem(null);
            resetForm();
          }}
        >
          <div style={{ ...modalCardStyle, width: 400, maxWidth: "90vw" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 16px", fontSize: "1.1rem", color: "#111827" }}>Edit Ingredient</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input placeholder="Name" value={formName} onChange={(e) => setFormName(e.target.value)} style={inputStyle} />
              <input placeholder="Unit" value={formUnit} onChange={(e) => setFormUnit(e.target.value)} style={inputStyle} />
              <input placeholder="Stock" type="number" min="0" value={formStock} onChange={(e) => setFormStock(e.target.value)} style={inputStyle} />
              <input placeholder="Low Stock Threshold" type="number" min="0" value={formThreshold} onChange={(e) => setFormThreshold(e.target.value)} style={inputStyle} />
              <input placeholder="Cost per Unit" type="number" min="0" step="0.01" value={formCost} onChange={(e) => setFormCost(e.target.value)} style={inputStyle} />
              {formError && <p style={{ color: "#dc2626", fontSize: "0.82rem", margin: 0 }}>{formError}</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  onClick={handleSave}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: 8,
                    border: "none",
                    background: "#111827",
                    color: "#ffffff",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingItem(null);
                    resetForm();
                  }}
                  style={{ ...secondaryButtonStyle, flex: 1, padding: "10px" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div style={modalOverlayStyle} onClick={() => setDeleteTarget(null)}>
          <div style={{ ...modalCardStyle, width: 380, maxWidth: "90vw", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.1rem", color: "#111827" }}>Delete Ingredient</h2>
            <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                onClick={handleDelete}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: 8,
                  border: "none",
                  background: "#dc2626",
                  color: "#ffffff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
              <button onClick={() => setDeleteTarget(null)} style={{ ...secondaryButtonStyle, flex: 1, padding: "10px" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
