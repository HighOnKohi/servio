import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProtocolAssistant from "../../components/ProtocolAssistant";
import { usePOS } from "../../context/POSContext";
import { useAuth } from "../../context/AuthContext";
import ScaleSelector, { useUIScale } from "../../components/ScaleSelector";
import "./interface-selector.css";
import Logo from "../../../public/Servio-Logo-B-Icon-Transparent.png"

const INTERFACE_GROUPS = {
  "FRONT OPS": [
    { id: "kitchen", label: "Kitchen Interface", desc: "View live orders and start cooking.", route: "/kitchen/active-orders", icon: "kitchen" },
    { id: "cashier", label: "Cashier Interface", desc: "Check out customers and print receipts quickly.", route: "/cashier/overview", icon: "cashier" },
    { id: "customer", label: "Customer Interface (Debug)", desc: "Preview the QR ordering flow from the customer's side.", route: null, icon: "customer" },
  ],
  MANAGEMENT: [
    { id: "table-manager", label: "Table Manager Interface", desc: "Manage restaurant tables, statuses, capacity, and QR codes.", route: "/table-manager", icon: "table" },
    { id: "menu-manager", label: "Menu Manager Interface", desc: "Manage menu items, categories, prices, and availability.", route: "/menu-manager", icon: "menu" },
    { id: "analytics", label: "Analytics Interface", desc: "Review sales, operations, inventory, and performance insights.", route: "/admin", icon: "analytics" },
  ],
  ADMIN: [
    { id: "account-manager", label: "Account Manager Interface", desc: "Manage staff accounts and access permissions.", route: "/admin", icon: "account" },
    { id: "order-logs", label: "Order Logs Interface", desc: "Review completed, active, and historical order activity.", route: "/admin", icon: "logs" },
  ],
};

function GridIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function InterfaceIcon({ type }) {
  const icons = {
    tray: <><path d="M4 13h16" /><path d="M5 13a7 7 0 0 0 14 0" /><path d="M8 9V5m4 4V5m4 4V5" /></>,
    kitchen: <><rect x="4" y="3" width="16" height="5" rx="1" /><path d="M6 8v3m4-3v3m4-3v3m4-3v3" /><path d="M4 14h16v5H4z" /></>,
    cashier: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9h10M7 13h2m3 0h2m3 0h0M7 16h10" /></>,
    customer: <><path d="M3 7h13v10H3z" /><path d="M16 10h5v8h-5z" /><path d="M6 4h7M7 11h5m-5 3h3" /></>,
    table: <><path d="M4 8h16v5H4z" /><path d="M6 13v6m12-6v6M8 8V5h8v3" /></>,
    menu: <><path d="M6 3v18M6 3c3 0 4 2 4 5s-1 5-4 5" /><path d="M14 3v18M18 3v18M14 3c4 2 4 7 0 9" /></>,
    analytics: <><path d="M4 19V5m0 14h16" /><path d="m7 15 3-4 3 2 5-7" /></>,
    account: <><circle cx="12" cy="7" r="3" /><path d="M5 21a7 7 0 0 1 14 0M19 8v5m-2.5-2.5h5" /></>,
    logs: <><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  };

  return <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[type] || icons.analytics}</svg>;
}

function UserIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ArrowIcon({ direction = "right" }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {direction === "left" ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
    </svg>
  );
}

function useFixedInterfaceCanvas() {
  return { scale: 1, width: "100%", height: "100vh" };
}

/* ── Confirmation Modal for Logout ──────────────────────────────────── */
function SelectorLogoutModal({ onConfirm, onDismiss }) {
  return (
    <div className="kitchen-modal-overlay" onClick={onDismiss} role="dialog" aria-modal="true" aria-labelledby="selector-logout-title">
      <div className="kitchen-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="kitchen-modal-header danger">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ width: 28, height: 28 }} aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <h2 id="selector-logout-title">Log Out of SERVIO?</h2>
        </div>
        <p className="kitchen-modal-body">
          Are you sure you want to log out of your session?
        </p>
        <div className="kitchen-modal-actions">
          <button type="button" className="kitchen-modal-btn secondary" onClick={onDismiss}>
            Cancel
          </button>
          <button type="button" className="kitchen-modal-btn danger" onClick={onConfirm}>
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InterfaceSelector() {
  const navigate = useNavigate();
  const { tables, loading } = usePOS();
  const { logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const { scale: uiScale, changeScale: handleScaleChange, fontScale, elementScale } = useUIScale();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [activeGroup, setActiveGroup] = useState("FRONT OPS");
  const [showTablePicker, setShowTablePicker] = useState(false);
  const interfaceCanvas = useFixedInterfaceCanvas();

  const handleLogoutConfirm = async () => {
    setShowLogoutModal(false);
    try {
      if (logout) await logout();
    } catch (err) {
      console.error("Logout error:", err);
    }
    navigate("/login");
  };

  const safeTables = Array.isArray(tables) ? tables : [];
  const sortedTables = useMemo(
    () => [...safeTables].sort((a, b) => a.table_number - b.table_number),
    [safeTables],
  );
  const visibleInterfaces = INTERFACE_GROUPS[activeGroup];

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

  useEffect(() => {
    const id = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(id);
  }, []);

  function handleInterfaceSelect(iface) {
    if (iface.id === "customer") {
      setShowTablePicker(true);
      return;
    }

    if (iface.route) {
      navigate(iface.route);
    }
  }

  function openCustomerTable(tableNumber) {
    setShowTablePicker(false);
    navigate(`/customer/${tableNumber}`);
  }

  return (
    <div
      className={`interface-selector-page interface-selector-page--scale-${uiScale}`}
      style={{
        "--servio-font-scale": fontScale,
        "--servio-elem-scale": elementScale,
        width: "100%",
        height: "100vh",
        maxHeight: "100vh",
        overflow: "hidden",
      }}
    >
      <header className="interface-selector-header">
        <div className="interface-selector-brand">
          <div className="interface-selector-brand-mark"> 
            <img src={Logo} alt="SERVIO Logo" />
          </div>
          <span>Servio POS</span>
        </div>
        <nav className="interface-selector-group-nav" aria-label="Interface categories">
          {Object.keys(INTERFACE_GROUPS).map((group) => (
            <button
              key={group}
              type="button"
              className={`interface-selector-group-tab ${activeGroup === group ? "active" : ""}`}
              onClick={() => setActiveGroup(group)}
            >
              <span className="interface-selector-group-icon"><GridIcon /></span>
              {group}
            </button>
          ))}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <ScaleSelector currentScale={uiScale} onScaleChange={handleScaleChange} isDark />
          <div className="interface-selector-account">
            <div>
              <strong>Admin User</strong>
              <span>System Administrator</span>
            </div>
            <div className="interface-selector-account-avatar"><UserIcon /></div>
          </div>
        </div>
      </header>

      <main className="interface-selector-center">
        <div key={`heading-${activeGroup}`} className="interface-selector-section-heading interface-selector-category-transition">
          <span className="interface-selector-section-kicker">Operational Suite</span>
          <h1>{activeGroup}</h1>
        </div>
        <div key={`grid-${activeGroup}`} className="interface-selector-grid-frame interface-selector-category-transition">
          <div className="interface-selector-grid">
            {visibleInterfaces.map((iface) => (
              <button key={iface.id} onClick={() => handleInterfaceSelect(iface)} className="interface-card interface-card-enabled">
                <div className="interface-card-topline">
                  <div className={`interface-card-icon interface-card-icon-${iface.icon}`}><InterfaceIcon type={iface.icon} /></div>
                </div>
                <div className="interface-card-body">
                  <div className="interface-card-label">{iface.label}</div>
                  <div className="interface-card-desc">{iface.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>

      <div className="interface-selector-assistant-wrap">
        <ProtocolAssistant />
      </div>

      <footer className="interface-selector-footer">
        <div className="interface-selector-user">
          <div className="interface-selector-user-avatar">
            <UserIcon />
          </div>

          <div>
            <div className="interface-selector-user-name">Admin User</div>
            <div className="interface-selector-user-role">Administrator</div>
          </div>
        </div>

        <div className="interface-selector-status">{date}, {time}</div>

        <button
          className="interface-selector-logout"
          type="button"
          onClick={() => setShowLogoutModal(true)}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16,17 21,12 16,7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </footer>

      {showLogoutModal && (
        <SelectorLogoutModal
          onConfirm={handleLogoutConfirm}
          onDismiss={() => setShowLogoutModal(false)}
        />
      )}

      {showTablePicker && (
        <div className="interface-selector-overlay" onClick={() => setShowTablePicker(false)}>
          <section className="interface-selector-modal" onClick={(event) => event.stopPropagation()}>
            <div className="interface-selector-modal-header">
              <div>
                <div className="interface-selector-modal-kicker">Customer Preview</div>
                <h2>Choose Table</h2>
              </div>
              <button
                type="button"
                className="interface-selector-modal-close"
                onClick={() => setShowTablePicker(false)}
                aria-label="Close table picker"
              >
                ×
              </button>
            </div>

            <div className="interface-selector-table-grid">
              {loading ? (
                <div className="interface-selector-table-empty">Loading tables...</div>
              ) : sortedTables.length === 0 ? (
                <div className="interface-selector-table-empty">No tables available.</div>
              ) : (
                sortedTables.map((table) => (
                  <button
                    key={table.id || table.table_number}
                    type="button"
                    className="interface-selector-table-card"
                    onClick={() => openCustomerTable(table.table_number)}
                  >
                    <span className="interface-selector-table-label">Table {String(table.table_number).padStart(2, "0")}</span>
                    <span className="interface-selector-table-status">{table.status}</span>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
