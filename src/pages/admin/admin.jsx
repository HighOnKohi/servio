import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePOS } from "../../context/POSContext";
import "./admin.css";

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

const Admin = () => {
  const navigate = useNavigate();
  const {
    tables,
    menuItems,
    categories,
    orders,
    profiles,
    ingredients,
    getLowStockIngredients,
    loading,
  } = usePOS();

  const interfaceCanvas = useFixedInterfaceCanvas();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

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

  const totalOrders = orders.length;
  const completedOrders = orders.filter((o) => o.status === "COMPLETED").length;
  const activeOrders = orders.filter((o) => o.status === "PENDING" || o.status === "IN_PROGRESS").length;
  const cancelledOrders = orders.filter((o) => o.status === "CANCELLED").length;
  const occupiedTables = tables.filter((t) => t.status === "OCCUPIED").length;
  const lowStock = getLowStockIngredients();

  const todayRevenue = orders
    .filter((o) => o.status === "COMPLETED" && new Date(o.created_at).toDateString() === new Date().toDateString())
    .reduce((sum, o) => sum + Number(o.total), 0);

  if (loading) {
    return (
      <div
        className="admin-page"
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

  const cardStyle = {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "20px 24px",
    boxShadow: "0 7px 20px rgba(15, 23, 42, 0.05)",
  };
  const sectionStyle = {
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "16px 20px",
    overflow: "auto",
    boxShadow: "0 7px 20px rgba(15, 23, 42, 0.05)",
  };
  const labelStyle = {
    fontSize: "0.75rem",
    textTransform: "uppercase",
    color: "#64748b",
    marginBottom: 4,
    letterSpacing: "0.05em",
    fontWeight: 700,
  };
  const valueStyle = { fontSize: "1.6rem", fontWeight: 700, color: "#0f172a" };
  const mutedStyle = { fontSize: "0.75rem", marginTop: 6, color: "#64748b" };
  const tableHeadingStyle = {
    textAlign: "left",
    padding: "10px 12px",
    color: "#64748b",
    fontSize: "0.72rem",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };

  return (
    <div
      className="admin-page"
      style={{
        "--admin-scale": interfaceCanvas.scale,
        width: interfaceCanvas.width,
        height: interfaceCanvas.height,
        minHeight: interfaceCanvas.height,
        background: "#f8fafc",
        color: "#111827",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zoom: "var(--admin-scale)",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 24px",
          borderBottom: "1px solid #e5e7eb",
          background: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
          <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>Admin Dashboard</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: "0.82rem", color: "#64748b" }}>{date}, {time}</span>
          <button
            onClick={() => navigate("/")}
            style={{
              background: "none",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "6px 10px",
              color: "#374151",
              cursor: "pointer",
            }}
            aria-label="Return"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
          </button>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, padding: "20px 24px", flexShrink: 0 }}>
        <div style={cardStyle}>
          <div style={labelStyle}>Today&apos;s Revenue</div>
          <div style={{ ...valueStyle, color: "#16a34a" }}>P{todayRevenue.toFixed(2)}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Total Orders</div>
          <div style={valueStyle}>{totalOrders}</div>
          <div style={mutedStyle}>
            {activeOrders} active · {completedOrders} completed · {cancelledOrders} cancelled
          </div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Tables</div>
          <div style={valueStyle}>{tables.length}</div>
          <div style={mutedStyle}>
            {occupiedTables} occupied · {tables.length - occupiedTables} available
          </div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Menu Items</div>
          <div style={valueStyle}>{menuItems.length}</div>
          <div style={mutedStyle}>{categories.length} categories</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, padding: "0 24px 20px", flexShrink: 0 }}>
        <div
          style={{
            ...cardStyle,
            background: lowStock.length > 0 ? "#fff7ed" : "#ffffff",
            borderColor: lowStock.length > 0 ? "#fdba74" : "#e2e8f0",
          }}
        >
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

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, padding: "0 24px 24px", overflow: "hidden" }}>
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
                const statusColor = {
                  COMPLETED: "#16a34a",
                  CANCELLED: "#dc2626",
                  PENDING: "#ca8a04",
                  IN_PROGRESS: "#2563eb",
                  READY: "#7c3aed",
                }[order.status] || "#475569";

                return (
                  <tr key={order.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 500 }}>#{order.id.slice(0, 6)}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{order.table_number || "-"}</td>
                    <td style={{ padding: "8px 10px", color: "#64748b" }}>{order.server_name || "-"}</td>
                    <td style={{ padding: "8px 10px" }}>P{Number(order.total).toFixed(2)}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 20,
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          color: statusColor,
                          background: `${statusColor}18`,
                        }}
                      >
                        {order.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={sectionStyle}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0 0 12px", color: "#111827" }}>Staff Profiles</h2>
          {profiles.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>No profiles found.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {profiles.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "#e2e8f0",
                      color: "#334155",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                    }}
                  >
                    {(p.full_name || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: "0.85rem" }}>{p.full_name}</div>
                    <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{p.role} · {p.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
