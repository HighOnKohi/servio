import { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePOS } from '../context/POSContext';
import { useAuth } from '../context/AuthContext';
import Logo from '../../public/Servio-Logo-B-Icon-Transparent.png';

const INTERFACE_GROUPS = {
  'FRONT OPS': [
    { id: 'kitchen', label: 'Kitchen Interface', desc: 'View live orders & start cooking queue.', route: '/kitchen/active-orders', icon: 'kitchen' },
    { id: 'cashier', label: 'Cashier Interface', desc: 'Check out tables, manage bills & print receipts.', route: '/cashier/overview', icon: 'cashier' },
    { id: 'customer', label: 'Customer Interface (Debug)', desc: 'Preview the diner QR ordering experience.', route: null, icon: 'customer' },
  ],
  MANAGEMENT: [
    { id: 'table-manager', label: 'Table Manager Interface', desc: 'Restaurant layout, tables & QR code generator.', route: '/table-manager', icon: 'table' },
    { id: 'menu-manager', label: 'Menu Manager Interface', desc: 'Menu items, categories, pricing & recipes.', route: '/menu-manager', icon: 'menu' },
    { id: 'analytics', label: 'Analytics Interface', desc: 'Revenue, order volumes & sales insights.', route: '/admin', icon: 'analytics' },
  ],
  ADMIN: [
    { id: 'account-manager', label: 'Account Manager Interface', desc: 'Staff credentials and access permissions.', route: '/admin', icon: 'account' },
    { id: 'order-logs', label: 'Order Logs Interface', desc: 'Audit trails of completed and active orders.', route: '/admin', icon: 'logs' },
    { id: 'inventory', label: 'Inventory Interface', desc: 'Track raw ingredients, stock & low-stock alerts.', route: '/inventory', icon: 'inventory' },
  ],
};

function SidebarIcon({ type }) {
  const icons = {
    kitchen: (
      <>
        <rect x="4" y="3" width="16" height="5" rx="1" />
        <path d="M6 8v3m4-3v3m4-3v3m4-3v3" />
        <path d="M4 14h16v5H4z" />
      </>
    ),
    cashier: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 9h10M7 13h2m3 0h2m3 0h0M7 16h10" />
      </>
    ),
    customer: (
      <>
        <path d="M3 7h13v10H3z" />
        <path d="M16 10h5v8h-5z" />
        <path d="M6 4h7M7 11h5m-5 3h3" />
      </>
    ),
    table: (
      <>
        <path d="M4 8h16v5H4z" />
        <path d="M6 13v6m12-6v6M8 8V5h8v3" />
      </>
    ),
    menu: (
      <>
        <path d="M6 3v18M6 3c3 0 4 2 4 5s-1 5-4 5" />
        <path d="M14 3v18M18 3v18M14 3c4 2 4 7 0 9" />
      </>
    ),
    analytics: (
      <>
        <path d="M4 19V5m0 14h16" />
        <path d="m7 15 3-4 3 2 5-7" />
      </>
    ),
    account: (
      <>
        <circle cx="12" cy="7" r="3" />
        <path d="M5 21a7 7 0 0 1 14 0M19 8v5m-2.5-2.5h5" />
      </>
    ),
    logs: (
      <>
        <path d="M5 4h14v16H5z" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
    inventory: (
      <>
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[type] || icons.analytics}
    </svg>
  );
}

export default function InterfaceSidebar({
  isOpen,
  onClose,
  isPreviewing,
  isPaused,
  onPausePreview,
  onResumePreview,
  secondsRemaining,
  onTriggerLogout,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  const { tables, loading: tablesLoading } = usePOS();
  const [showTablePicker, setShowTablePicker] = useState(false);

  // Filter interfaces based on admin vs employee role
  const displayedGroups = useMemo(() => {
    if (isAdmin) {
      return INTERFACE_GROUPS;
    }

    // Default / employee accounts: only show the 3 main pages, hide admin and debug
    return {
      'MAIN PAGES': [
        { id: 'kitchen', label: 'Kitchen Interface', desc: 'View live orders & cooking queue.', route: '/kitchen/active-orders', icon: 'kitchen' },
        { id: 'table-manager', label: 'Table Manager Interface', desc: 'Restaurant floor layout & tables.', route: '/table-manager', icon: 'table' },
        { id: 'cashier', label: 'Cashier Interface', desc: 'Check out tables, manage bills & receipts.', route: '/cashier/overview', icon: 'cashier' },
      ],
    };
  }, [isAdmin]);

  // Close with escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        if (showTablePicker) {
          setShowTablePicker(false);
        } else {
          onClose();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showTablePicker, onClose]);

  const safeTables = Array.isArray(tables) ? tables : [];
  const sortedTables = useMemo(
    () => [...safeTables].sort((a, b) => a.table_number - b.table_number),
    [safeTables]
  );

  function isItemActive(iface) {
    const p = location.pathname;
    if (iface.id === 'kitchen') return p.startsWith('/kitchen');
    if (iface.id === 'cashier') return p.startsWith('/cashier');
    if (iface.id === 'table-manager') return p.startsWith('/table-manager');
    if (iface.id === 'menu-manager') return p.startsWith('/menu-manager');
    if (iface.id === 'inventory') return p.startsWith('/inventory');
    if (iface.id === 'analytics' || iface.id === 'account-manager' || iface.id === 'order-logs') {
      return p === '/admin';
    }
    return false;
  }

  function handleSelect(iface) {
    if (iface.id === 'customer') {
      setShowTablePicker(true);
      return;
    }

    if (iface.route) {
      try {
        localStorage.setItem('servio_last_interface', iface.route);
      } catch {}
      navigate(iface.route);
      onClose();
    }
  }

  function handleOpenCustomerTable(tableNumber) {
    setShowTablePicker(false);
    onClose();
    navigate(`/customer/${tableNumber}`);
  }

  const staffName = profile?.full_name || user?.email?.split('@')[0] || 'Admin User';
  const staffRole = profile?.role || 'Administrator';

  return (
    <>
      {/* ── Overlay Backdrop (never pushes layout) ── */}
      <div
        className={`servio-sidebar-backdrop ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── Fixed Sidebar Overlay ── */}
      <aside
        className={`servio-sidebar-drawer ${isOpen ? 'open' : ''}`}
        aria-label="SERVIO Interface Selector Sidebar"
        aria-hidden={!isOpen}
        onMouseEnter={onPausePreview}
        onMouseLeave={onResumePreview}
      >
        {/* ── Preview Auto-Collapse Progress ── */}
        {isPreviewing && (
          <div className="servio-sidebar-preview-bar">
            <div className="servio-sidebar-preview-meta">
              <strong>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Previewing Interface Selector
              </strong>
              <span>
                {isPaused ? 'Paused (hovering)' : `Closing in ${secondsRemaining}s`}
              </span>
            </div>
            <div className="servio-sidebar-preview-track">
              <div
                className="servio-sidebar-preview-fill"
                style={{
                  width: `${Math.max(0, Math.min(100, (secondsRemaining / 4) * 100))}%`,
                  transition: isPaused ? 'none' : 'width 0.1s linear',
                }}
              />
            </div>
          </div>
        )}

        {/* ── Drawer Header ── */}
        <div className="servio-sidebar-header">
          <div className="servio-sidebar-brand">
            <div className="servio-sidebar-brand-icon" aria-hidden="true">
              <img src={Logo} alt="SERVIO Logo" />
            </div>
            <div className="servio-sidebar-title-wrap">
              <span className="servio-sidebar-kicker">SERVIO POS</span>
              <h2 className="servio-sidebar-title">Interface Menu</h2>
            </div>
          </div>
          <button
            type="button"
            className="servio-sidebar-close-btn"
            onClick={onClose}
            aria-label="Close interface menu"
            title="Close menu (Esc)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Scrollable Content ── */}
        <div className="servio-sidebar-content">
          {Object.entries(displayedGroups).map(([groupName, items]) => (
            <div key={groupName} className="servio-sidebar-group">
              <div className="servio-sidebar-group-title">{groupName}</div>
              <div className="servio-sidebar-items">
                {items.map((iface) => {
                  const active = isItemActive(iface);
                  return (
                    <button
                      key={iface.id}
                      type="button"
                      className={`servio-sidebar-item ${active ? 'active' : ''}`}
                      onClick={() => handleSelect(iface)}
                      aria-current={active ? 'page' : undefined}
                    >
                      <div className="servio-sidebar-item-icon">
                        <SidebarIcon type={iface.icon} />
                      </div>
                      <div className="servio-sidebar-item-body">
                        <div className="servio-sidebar-item-name">
                          <span>{iface.label}</span>
                          {active && <span className="servio-sidebar-item-badge">Active</span>}
                        </div>
                        <div className="servio-sidebar-item-desc">{iface.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── Drawer Footer ── */}
        <div className="servio-sidebar-footer">
          <div className="servio-sidebar-user">
            <div className="servio-sidebar-avatar" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="servio-sidebar-user-info">
              <span className="servio-sidebar-user-name" title={staffName}>{staffName}</span>
              <span className="servio-sidebar-user-role">{staffRole}</span>
            </div>
          </div>
          <button
            type="button"
            className="servio-sidebar-logout-btn"
            onClick={() => {
              onClose();
              if (onTriggerLogout) onTriggerLogout();
            }}
            title="Log out of SERVIO"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* ── Customer Debug Table Picker Modal ── */}
      {showTablePicker && (
        <div className="servio-logout-modal-overlay" onClick={() => setShowTablePicker(false)}>
          <section className="servio-logout-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="servio-logout-modal-header" style={{ justifyContent: 'space-between', width: '100%' }}>
              <div>
                <span className="servio-sidebar-kicker">Customer Interface Preview</span>
                <h2 style={{ margin: 0, marginTop: 4 }}>Select Table</h2>
              </div>
              <button
                type="button"
                className="servio-sidebar-close-btn"
                onClick={() => setShowTablePicker(false)}
                aria-label="Close table picker"
              >
                ✕
              </button>
            </div>
            <p className="servio-logout-modal-body">
              Choose which table to preview from the customer's QR view perspective:
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: 10,
                maxHeight: 280,
                overflowY: 'auto',
                padding: '4px 2px',
              }}
            >
              {tablesLoading ? (
                <div style={{ color: '#94a3b8', padding: 20, textAlign: 'center', gridColumn: '1 / -1' }}>
                  Loading tables…
                </div>
              ) : sortedTables.length === 0 ? (
                <div style={{ color: '#94a3b8', padding: 20, textAlign: 'center', gridColumn: '1 / -1' }}>
                  No tables configured.
                </div>
              ) : (
                sortedTables.map((table) => (
                  <button
                    key={table.id || table.table_number}
                    type="button"
                    className="servio-modal-btn secondary"
                    style={{
                      height: 'auto',
                      padding: '12px 10px',
                      flexDirection: 'column',
                      gap: 4,
                      textAlign: 'center',
                    }}
                    onClick={() => handleOpenCustomerTable(table.table_number)}
                  >
                    <strong style={{ fontSize: 16 }}>Table {String(table.table_number).padStart(2, '0')}</strong>
                    <span style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>
                      {table.status || 'Available'}
                    </span>
                  </button>
                ))
              )}
            </div>
            <button
              type="button"
              className="servio-modal-btn secondary"
              onClick={() => setShowTablePicker(false)}
            >
              Cancel
            </button>
          </section>
        </div>
      )}
    </>
  );
}
