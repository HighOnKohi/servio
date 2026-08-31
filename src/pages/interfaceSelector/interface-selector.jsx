import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProtocolAssistant from "../../components/ProtocolAssistant";
import { usePOS } from "../../context/POSContext";
import "./interface-selector.css";

const MAX_INTERFACES_PER_PAGE = 6;

const INTERFACES = [
  {
    id: "resto",
    label: "Restaurant Management Interface",
    desc: "Manage menu items, categories, and restaurant tables.",
    route: "/restaurant-management/edit-menu",
  },
  {
    id: "cashier",
    label: "Cashier Interface",
    desc: "Check out customers and print receipts quickly.",
    route: "/cashier/overview",
  },
  {
    id: "waiter",
    label: "Waiter Interface",
    desc: "Send orders to the kitchen from the floor.",
    route: "/waiter/menu-ordering",
  },
  {
    id: "kitchen",
    label: "Kitchen Interface",
    desc: "View live orders and start cooking.",
    route: "/kitchen/active-orders",
  },
  {
    id: "admin",
    label: "Admin Interface",
    desc: "Gain administrative access to the system.",
    route: "/admin",
  },
  {
    id: "inventory",
    label: "Inventory Interface",
    desc: "Manage and track inventory levels.",
    route: "/inventory",
  },
  {
    id: "customer",
    label: "Customer Interface",
    desc: "Preview the QR ordering flow from the customer's side.",
    route: null,
  },
];

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
  const [, refreshScale] = useState(0);

  useEffect(() => {
    const updateScale = () => refreshScale((version) => version + 1);
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  if (typeof window === "undefined") return { scale: 1, width: "100%", height: "100vh" };

  const pixelRatio = window.devicePixelRatio || 1;
  return {
    scale: 1 / pixelRatio,
    width: `${Math.round(window.innerWidth * pixelRatio)}px`,
    height: `${Math.round(window.innerHeight * pixelRatio)}px`,
  };
}

export default function InterfaceSelector() {
  const navigate = useNavigate();
  const { tables, loading } = usePOS();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [page, setPage] = useState(0);
  const [slideDirection, setSlideDirection] = useState("right");
  const [isAnimating, setIsAnimating] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const animationTimeoutRef = useRef(null);
  const interfaceCanvas = useFixedInterfaceCanvas();

  const safeTables = Array.isArray(tables) ? tables : [];
  const sortedTables = useMemo(
    () => [...safeTables].sort((a, b) => a.table_number - b.table_number),
    [safeTables],
  );
  const totalPages = Math.max(1, Math.ceil(INTERFACES.length / MAX_INTERFACES_PER_PAGE));
  const visibleInterfaces = INTERFACES.slice(
    page * MAX_INTERFACES_PER_PAGE,
    (page + 1) * MAX_INTERFACES_PER_PAGE,
  );

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

  useEffect(() => {
    if (page > totalPages - 1) {
      setPage(totalPages - 1);
    }
  }, [page, totalPages]);

  function handleInterfaceSelect(iface) {
    if (iface.id === "customer") {
      setShowTablePicker(true);
      return;
    }

    if (iface.route) {
      navigate(iface.route);
    }
  }

  useEffect(() => () => {
    if (animationTimeoutRef.current) {
      window.clearTimeout(animationTimeoutRef.current);
    }
  }, []);

  function changePage(nextPage, direction) {
    if (isAnimating || nextPage === page) return;
    setSlideDirection(direction);
    setIsAnimating(true);
    setPage(nextPage);

    if (animationTimeoutRef.current) {
      window.clearTimeout(animationTimeoutRef.current);
    }

    animationTimeoutRef.current = window.setTimeout(() => {
      setIsAnimating(false);
      animationTimeoutRef.current = null;
    }, 320);
  }

  function openCustomerTable(tableNumber) {
    setShowTablePicker(false);
    navigate(`/customer/${tableNumber}`);
  }

  return (
    <div
      className="interface-selector-page"
      style={{
        "--interface-selector-scale": interfaceCanvas.scale,
        width: interfaceCanvas.width,
        height: interfaceCanvas.height,
        minHeight: interfaceCanvas.height,
      }}
    >
      {totalPages > 1 && (
        <>
          <button
            type="button"
            className="interface-selector-page-arrow left"
            onClick={() => changePage((page - 1 + totalPages) % totalPages, "left")}
            aria-label="Previous interface page"
          >
            <ArrowIcon direction="left" />
          </button>
          <button
            type="button"
            className="interface-selector-page-arrow right"
            onClick={() => changePage((page + 1) % totalPages, "right")}
            aria-label="Next interface page"
          >
            <ArrowIcon direction="right" />
          </button>
        </>
      )}

      <div className="interface-selector-center">
        <h1 className="interface-selector-title">
          What would you like to{" "}
          <span className="interface-selector-title-mark">do</span>
          <br />
          <span className="interface-selector-title-mark">today</span>?
        </h1>

        <div className={`interface-selector-grid-frame ${isAnimating ? `is-animating slide-${slideDirection}` : ""}`}>
          <div className="interface-selector-grid">
          {visibleInterfaces.map((iface) => (
            <button
              key={iface.id}
              onClick={() => handleInterfaceSelect(iface)}
              className="interface-card interface-card-enabled"
            >
              <div className="interface-card-icon">
                <GridIcon />
              </div>

              <div className="interface-card-label">{iface.label}</div>

              <div className="interface-card-desc">{iface.desc}</div>
            </button>
          ))}
          </div>
        </div>

        {totalPages > 1 && (
          <div className="interface-selector-pagination">
            {Array.from({ length: totalPages }, (_, index) => (
              <button
                key={index}
                type="button"
                className={`interface-selector-page-dot ${index === page ? "active" : ""}`}
                onClick={() => changePage(index, index > page ? "right" : "left")}
                aria-label={`Go to interface page ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>

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
          onClick={() => navigate("/login")}
        >
          <svg
            width="14"
            height="14"
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
