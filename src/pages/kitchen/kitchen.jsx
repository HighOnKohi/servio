import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePOS } from '../../context/POSContext';
import './kitchen.css';

function useFixedInterfaceCanvas() {
  const [, refreshScale] = useState(0);
  useEffect(() => {
    const updateScale = () => refreshScale((version) => version + 1);
    window.addEventListener('resize', updateScale);
    window.visualViewport?.addEventListener('resize', updateScale);
    return () => { window.removeEventListener('resize', updateScale); window.visualViewport?.removeEventListener('resize', updateScale); };
  }, []);
  if (typeof window === 'undefined') return { scale: 1, width: '100%', height: '100vh' };
  const pixelRatio = window.devicePixelRatio || 1;
  return { scale: 1 / pixelRatio, width: `${Math.round(window.innerWidth * pixelRatio)}px`, height: `${Math.round(window.innerHeight * pixelRatio)}px` };
}

function formatElapsed(createdAt, now) {
  const created = typeof createdAt === 'string' ? new Date(createdAt).getTime() : createdAt;
  const seconds = Math.max(0, Math.floor((now - created) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

/* ── Confirmation Modal for cancel ─────────────────────────────────── */
function CancelConfirmModal({ ticket, onConfirm, onDismiss }) {
  const [reason, setReason] = useState('');
  return (
    <div className="kitchen-modal-overlay" onClick={onDismiss} role="dialog" aria-modal="true" aria-labelledby="cancel-modal-title">
      <div className="kitchen-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="kitchen-modal-header danger">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m8 8 8 8M16 8l-8 8" /><circle cx="12" cy="12" r="9" /></svg>
          <h2 id="cancel-modal-title">Cancel Order</h2>
        </div>
        <p className="kitchen-modal-body">
          You are about to cancel the order for <strong>Table #{ticket.table}</strong>. This will notify the cashier immediately.
        </p>
        <div className="kitchen-modal-field">
          <label htmlFor="cancel-reason">Reason (optional)</label>
          <select id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Select a reason…</option>
            <option value="Out of ingredients">Out of ingredients</option>
            <option value="Item temporarily unavailable">Item temporarily unavailable</option>
            <option value="Equipment issue">Equipment issue</option>
            <option value="Customer requested cancellation">Customer requested cancellation</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="kitchen-modal-actions">
          <button type="button" className="kitchen-modal-btn secondary" onClick={onDismiss}>Keep Order</button>
          <button type="button" className="kitchen-modal-btn danger" onClick={() => onConfirm(reason || 'No reason given')}>
            Confirm Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Item Unavailability Modal ──────────────────────────────────────── */
function UnavailableItemModal({ request, onConfirm, onDismiss }) {
  const items = Array.isArray(request?.items) ? request.items : [];
  const [selected, setSelected] = useState(() => new Set());
  const [reason, setReason] = useState('Out of stock');

  function toggleItem(itemId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  const unavailableItems = items.filter((item) => selected.has(item.id || item.name));

  return (
    <div className="kitchen-modal-overlay" onClick={onDismiss} role="dialog" aria-modal="true" aria-labelledby="unavail-modal-title">
      <div className="kitchen-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="kitchen-modal-header warning">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>
          <h2 id="unavail-modal-title">Mark Items Unavailable</h2>
        </div>
        <p className="kitchen-modal-body">
          Select which items from Table #{String(request?.table_number).padStart(2, '0')}'s order cannot be served:
        </p>
        <div className="kitchen-modal-item-list">
          {items.map((item) => {
            const key = item.id || item.name;
            const isSelected = selected.has(key);
            return (
              <button
                key={key}
                type="button"
                className={`kitchen-modal-item-toggle ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleItem(key)}
              >
                <span className="kitchen-modal-item-name">{item.name} ×{item.quantity}</span>
                <span className="kitchen-modal-item-check">{isSelected ? '✕ Unavailable' : 'Available'}</span>
              </button>
            );
          })}
        </div>
        <div className="kitchen-modal-field">
          <label htmlFor="unavail-reason">Reason</label>
          <input
            id="unavail-reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Out of stock, Equipment issue"
          />
        </div>
        <div className="kitchen-modal-actions">
          <button type="button" className="kitchen-modal-btn secondary" onClick={onDismiss}>Cancel</button>
          <button
            type="button"
            className="kitchen-modal-btn warning"
            disabled={selected.size === 0}
            onClick={() => onConfirm(unavailableItems, reason)}
          >
            Notify Customer ({selected.size} item{selected.size !== 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Stock Management Drawer ────────────────────────────────────────── */
function StockDrawer({ menuItems, categories, onToggle, onClose }) {
  const [search, setSearch] = useState('');
  const filteredItems = useMemo(() => {
    if (!search.trim()) return menuItems;
    const q = search.toLowerCase();
    return menuItems.filter((item) => item.name.toLowerCase().includes(q));
  }, [menuItems, search]);

  const grouped = useMemo(() => {
    const map = new Map();
    filteredItems.forEach((item) => {
      const cat = categories.find((c) => c.id === item.category_id);
      const catName = cat?.name || 'Uncategorised';
      if (!map.has(catName)) map.set(catName, []);
      map.get(catName).push(item);
    });
    return Array.from(map.entries());
  }, [filteredItems, categories]);

  return (
    <div className="kitchen-stock-drawer-overlay" onClick={onClose}>
      <aside className="kitchen-stock-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="kitchen-stock-drawer-header">
          <div>
            <h2>Manage Item Stock</h2>
            <p>Tap a card to toggle between In Stock and Sold Out.</p>
          </div>
          <button type="button" className="kitchen-stock-drawer-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="kitchen-stock-search">
          <input
            type="search"
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="kitchen-stock-list">
          {grouped.map(([catName, items]) => (
            <div key={catName} className="kitchen-stock-category">
              <div className="kitchen-stock-category-label">{catName}</div>
              <div className="kitchen-stock-grid">
                {items.map((item) => {
                  const isSoldOut = item.status === 'SOLD OUT';
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`kitchen-stock-card ${isSoldOut ? 'stock-card--out' : 'stock-card--in'}`}
                      onClick={() => onToggle(item.id, item.status)}
                      aria-pressed={!isSoldOut}
                      aria-label={`${item.name}: ${isSoldOut ? 'Sold Out, tap to mark in stock' : 'In Stock, tap to mark sold out'}`}
                    >
                      <span className="stock-card-status-dot" aria-hidden="true" />
                      <span className="stock-card-name">{item.name}</span>
                      <span className="stock-card-badge">
                        {isSoldOut ? '✕ Sold Out' : '✓ In Stock'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {grouped.length === 0 && (
            <div className="kitchen-stock-empty">No items found.</div>
          )}
        </div>
      </aside>
    </div>
  );
}

/* ── Main Kitchen Component ─────────────────────────────────────────── */
function Kitchen() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    orders,
    orderItems,
    customerRequests,
    menuItems,
    categories,
    getItemsForOrder,
    updateOrderStatus,
    forwardCustomerRequestToCashier,
    rejectCustomerRequestKitchen,
    toggleMenuItemStock,
    loading,
  } = usePOS();

  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('active-orders');
  const [showStockDrawer, setShowStockDrawer] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [unavailableTarget, setUnavailableTarget] = useState(null);
  const [processingIds, setProcessingIds] = useState(new Set());
  // Blink state for tabs when new items arrive
  const [pendingTabBlink, setPendingTabBlink] = useState(false);
  const [ordersTabBlink, setOrdersTabBlink] = useState(false);
  const prevPendingRef = useRef(0);
  const prevOrdersRef = useRef(0);
  const interfaceCanvas = useFixedInterfaceCanvas();

  // Sync tab to URL path on mount
  const viewFromPath = location.pathname.split('/').filter(Boolean).at(-1);
  useEffect(() => {
    if (viewFromPath !== 'active-orders') navigate('/kitchen/active-orders', { replace: true });
  }, [viewFromPath, navigate]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Active cooking tickets ─────────────────────────────────────────
  const tickets = useMemo(() => {
    return orders.map((order) => {
      const items = getItemsForOrder(order.id);
      let kitchenStatus;
      if (order.status === 'COMPLETED' || order.status === 'READY' || order.status === 'SERVED') {
        kitchenStatus = 'COMPLETED';
      } else if (order.status === 'CANCELLED') {
        kitchenStatus = 'CANCELLED';
      } else {
        kitchenStatus = 'ACTIVE'; // PENDING, IN_PROGRESS, IN_KITCHEN
      }
      return {
        id: order.id,
        displayId: order.id.slice(0, 4).toUpperCase(),
        table: order.table_number ? String(order.table_number).padStart(2, '0') : '--',
        tableNum: order.table_number,
        server: order.server_name || 'Unknown',
        orderType: order.order_type || 'DINE-IN',
        createdAt: order.created_at,
        completedAt: order.updated_at,
        status: kitchenStatus,
        items: items.map((oi) => ({
          name: oi.item_name,
          qty: oi.quantity,
          notes: Array.isArray(oi.modifiers) && oi.modifiers.length > 0 ? oi.modifiers : undefined,
          cancelled: oi.status === 'CANCELLED',
        })),
      };
    });
  }, [orders, orderItems, getItemsForOrder]);

  const visibleTickets = useMemo(() => tickets.filter((t) => t.status === 'ACTIVE'), [tickets]);

  // ── Pending verification requests (from customers, not yet forwarded) ─
  const pendingRequests = useMemo(() =>
    (Array.isArray(customerRequests) ? customerRequests : []).filter((r) => r.status === 'PENDING_KITCHEN'),
    [customerRequests]
  );

  // ── Blink tabs when their count increases ──
  useEffect(() => {
    const prev = prevPendingRef.current;
    prevPendingRef.current = pendingRequests.length;
    if (pendingRequests.length > prev && activeTab !== 'pending-verification') {
      setPendingTabBlink(true);
      const t = setTimeout(() => setPendingTabBlink(false), 2000);
      return () => clearTimeout(t);
    }
  }, [pendingRequests.length, activeTab]);

  useEffect(() => {
    const prev = prevOrdersRef.current;
    prevOrdersRef.current = visibleTickets.length;
    if (visibleTickets.length > prev && activeTab !== 'active-orders') {
      setOrdersTabBlink(true);
      const t = setTimeout(() => setOrdersTabBlink(false), 2000);
      return () => clearTimeout(t);
    }
  }, [visibleTickets.length, activeTab]);

  // ── Pagination ─────────────────────────────────────────────────────
  const ticketsPerPage = 8;
  const totalPages = Math.max(1, Math.ceil(visibleTickets.length / ticketsPerPage));
  const activePage = Math.min(currentPage, totalPages);
  const ticketStart = (activePage - 1) * ticketsPerPage;
  const pagedTickets = visibleTickets.slice(ticketStart, ticketStart + ticketsPerPage);

  // ── Handlers ───────────────────────────────────────────────────────
  const handleComplete = useCallback(async (orderId) => {
    if (processingIds.has(orderId)) return;
    setProcessingIds((prev) => new Set(prev).add(orderId));
    await updateOrderStatus(orderId, 'SERVED');
    setProcessingIds((prev) => { const next = new Set(prev); next.delete(orderId); return next; });
  }, [updateOrderStatus, processingIds]);

  const handleCancelConfirm = useCallback(async (reason) => {
    if (!cancelTarget) return;
    await updateOrderStatus(cancelTarget.id, 'CANCELLED');
    // Store reason on the order for cashier visibility (best-effort update)
    setCancelTarget(null);
  }, [cancelTarget, updateOrderStatus]);

  const handleForwardToCashier = useCallback(async (requestId) => {
    if (processingIds.has(requestId)) return;
    setProcessingIds((prev) => new Set(prev).add(requestId));
    await forwardCustomerRequestToCashier(requestId);
    setProcessingIds((prev) => { const next = new Set(prev); next.delete(requestId); return next; });
  }, [forwardCustomerRequestToCashier, processingIds]);

  const handleUnavailableConfirm = useCallback(async (unavailableItems, reason) => {
    if (!unavailableTarget) return;
    await rejectCustomerRequestKitchen(unavailableTarget.id, unavailableItems, reason);
    setUnavailableTarget(null);
  }, [unavailableTarget, rejectCustomerRequestKitchen]);

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0e131f', color: '#fff', fontSize: '1.2rem', fontFamily: "'Inter', sans-serif" }}>Loading…</div>;
  }

  const newTickets = pagedTickets.filter((t) => t.status === 'ACTIVE' && Math.floor((currentTime - new Date(t.createdAt).getTime()) / 60000) < 5);
  const preparingTickets = pagedTickets.filter((t) => t.status === 'ACTIVE' && Math.floor((currentTime - new Date(t.createdAt).getTime()) / 60000) >= 5);
  const readyTickets = pagedTickets.filter((t) => t.status === 'COMPLETED');

  return (
    <div className="kitchen-app" style={{ '--kitchen-scale': interfaceCanvas.scale, width: interfaceCanvas.width, height: interfaceCanvas.height, minHeight: interfaceCanvas.height, display: 'flex', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ── Modals ── */}
      {cancelTarget && <CancelConfirmModal ticket={cancelTarget} onConfirm={handleCancelConfirm} onDismiss={() => setCancelTarget(null)} />}
      {unavailableTarget && <UnavailableItemModal request={unavailableTarget} onConfirm={handleUnavailableConfirm} onDismiss={() => setUnavailableTarget(null)} />}
      {showStockDrawer && <StockDrawer menuItems={Array.isArray(menuItems) ? menuItems : []} categories={Array.isArray(categories) ? categories : []} onToggle={toggleMenuItemStock} onClose={() => setShowStockDrawer(false)} />}

      {/* ══ LEFT SIDEBAR ══ */}
      <aside style={{ width: 240, flexShrink: 0, background: '#0e131f', borderRight: '1px solid #1f2937', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 18px 16px', borderBottom: '1px solid #1f2937' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
          </div>
          <div>
            <strong style={{ display: 'block', fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>BistroAdmin</strong>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Kitchen Station</span>
          </div>
        </div>
        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[
            { label: 'Dashboard', active: false, icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
            { label: 'Live Orders', active: true, icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
            { label: 'Table Map', active: false, icon: 'M2 3h20v5H2zM2 10h20v5H2zM2 17h20v5H2z' },
            { label: 'Menu Editor', active: false, icon: 'M3 11l19-9-9 19-2-8-8-2z' },
            { label: 'Staff', active: false, icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' },
          ].map((item) => (
            <button key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: 'none', background: item.active ? '#059669' : 'transparent', color: item.active ? '#fff' : '#94a3b8', fontSize: '0.875rem', fontWeight: item.active ? 600 : 500, cursor: 'pointer', width: '100%', textAlign: 'left' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d={item.icon} /></svg>
              {item.label}
              {item.label === 'Live Orders' && visibleTickets.length > 0 && <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>{visibleTickets.length}</span>}
            </button>
          ))}
        </nav>
        {/* Bottom */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid #1f2937', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button onClick={() => setShowStockDrawer(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '11px 16px', borderRadius: 10, border: 'none', background: '#059669', color: '#fff', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', marginBottom: 4 }}>
            Manage Stock
          </button>
          <button onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 10, border: 'none', background: 'transparent', color: '#94a3b8', fontSize: '0.82rem', cursor: 'pointer', width: '100%' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
            Switch Station
          </button>
        </div>
      </aside>

      {/* ══ MAIN CONTENT ══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, background: '#f8fafc' }}>

        {/* Top Bar */}
        <header style={{ height: 60, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: '#fff', borderBottom: '1px solid #e2e8f0', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Sub-tabs */}
            {[
              { key: 'active-orders', label: 'Orders', count: visibleTickets.length },
              { key: 'pending-verification', label: 'Pending', count: pendingRequests.length },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); if (tab.key === 'active-orders') navigate('/kitchen/active-orders'); }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', height: 36, borderRadius: 8, border: '1px solid', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', background: activeTab === tab.key ? '#0f172a' : 'transparent', color: activeTab === tab.key ? '#fff' : '#64748b', borderColor: activeTab === tab.key ? '#0f172a' : '#e2e8f0' }}
              >
                {tab.label}
                {tab.count > 0 && <span style={{ background: activeTab === tab.key ? 'rgba(255,255,255,0.2)' : (tab.key === 'pending-verification' ? '#ef4444' : '#f1f5f9'), color: activeTab === tab.key ? '#fff' : (tab.key === 'pending-verification' ? '#fff' : '#64748b'), fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>{tab.count}</span>}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {new Date(currentTime).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}, {new Date(currentTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
            </span>
            <button onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', height: 36, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
              Back to Hub
            </button>
          </div>
        </header>

        {/* KDS Page Header */}
        <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>Kitchen Display System</h1>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 2 }}>Manage order flow · <strong style={{ color: '#059669' }}>{visibleTickets.length}</strong> Active Orders</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {[{ label: 'All', active: true }, { label: 'Dine-in', active: false }, { label: 'Takeout', active: false }].map((f) => (
                <button key={f.label} style={{ padding: '5px 14px', borderRadius: 999, border: '1px solid', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', background: f.active ? '#0f172a' : 'transparent', color: f.active ? '#fff' : '#64748b', borderColor: f.active ? '#0f172a' : '#e2e8f0' }}>{f.label}</button>
              ))}
              <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', height: 34, borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                New Order
              </button>
            </div>
          </div>
        </div>

        {/* ══ WORKSPACE ══ */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

          {/* Pending Verification tab */}
          {activeTab === 'pending-verification' && (
            pendingRequests.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: '#94a3b8', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>✓</div>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151' }}>No pending verifications</h2>
                <p style={{ fontSize: '0.85rem' }}>All customer requests have been reviewed.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
                {pendingRequests.map((request) => {
                  const items = Array.isArray(request.items) ? request.items : [];
                  const isProcessing = processingIds.has(request.id);
                  return (
                    <article key={request.id} style={{ background: '#fff', border: '2px solid #fcd34d', borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 14px rgba(245,158,11,0.1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                        <div>
                          <strong style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', display: 'block' }}>Table #{String(request.table_number).padStart(2, '0')}</strong>
                          <span style={{ display: 'inline-block', marginTop: 3, padding: '2px 8px', borderRadius: 999, background: '#f59e0b', color: '#fff', fontSize: '0.68rem', fontWeight: 800 }}>Pending Stock Check</span>
                        </div>
                        <time style={{ fontSize: '0.78rem', color: '#92400e', fontWeight: 600 }}>{new Date(request.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</time>
                      </div>
                      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {items.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#374151' }}>
                            <span>{item.name}</span>
                            <span style={{ fontWeight: 700, color: '#111827' }}>×{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '10px 12px', borderTop: '1px solid #fde68a', background: '#fffbeb' }}>
                        <button onClick={() => setUnavailableTarget(request)} disabled={isProcessing} style={{ height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 8, border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m8 8 8 8M16 8l-8 8" /><circle cx="12" cy="12" r="9" /></svg>
                          Item Unavailable
                        </button>
                        <button onClick={() => handleForwardToCashier(request.id)} disabled={isProcessing} style={{ height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 8, border: '1px solid #111827', background: '#111827', color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m5 12 4 4L19 6" /></svg>
                          {isProcessing ? 'Forwarding…' : 'Confirm & Forward'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )
          )}

          {/* Active Orders tab — 3-column KDS kanban */}
          {activeTab === 'active-orders' && (
            visibleTickets.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: '#94a3b8', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>✓</div>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151' }}>No active orders</h2>
                <p style={{ fontSize: '0.85rem' }}>The kitchen is all caught up.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, alignItems: 'start' }}>

                {/* Column: New */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563eb', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em' }}>New</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 700, background: '#dbeafe', color: '#1e40af', padding: '1px 8px', borderRadius: 999 }}>{newTickets.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {newTickets.map((ticket) => {
                      const isProcessing = processingIds.has(ticket.id);
                      return (
                        <article key={ticket.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <div>
                              <strong style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>#{ticket.displayId}</strong>
                              <span style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginTop: 1 }}>Table #{ticket.table}</span>
                            </div>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2563eb', background: '#dbeafe', padding: '3px 10px', borderRadius: 999 }}>◷ {formatElapsed(ticket.createdAt, currentTime)}</span>
                          </div>
                          <div style={{ padding: '10px 14px' }}>
                            {ticket.items.map((item, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderBottom: idx < ticket.items.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                <div>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#0f172a', display: 'block' }}>{item.name}</span>
                                  {item.notes?.map((n) => <em key={n} style={{ display: 'block', fontSize: '0.72rem', color: '#b91c1c', fontStyle: 'normal', marginTop: 2 }}>{n}</em>)}
                                </div>
                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e40af', background: '#eff6ff', padding: '2px 6px', borderRadius: 6 }}>×{item.qty}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '8px 10px', borderTop: '1px solid #f1f5f9' }}>
                            <button onClick={() => setCancelTarget(ticket)} disabled={isProcessing} style={{ height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 7, border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m8 8 8 8M16 8l-8 8" /><circle cx="12" cy="12" r="9" /></svg>
                              Cancel
                            </button>
                            <button onClick={() => handleComplete(ticket.id)} disabled={isProcessing} style={{ height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 7, border: 'none', background: '#0f172a', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m5 12 4 4L19 6" /></svg>
                              {isProcessing ? 'Saving…' : 'Complete'}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                    {newTickets.length === 0 && <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8', fontSize: '0.82rem', background: '#fff', borderRadius: 14, border: '1px dashed #e2e8f0' }}>No new orders</div>}
                  </div>
                </div>

                {/* Column: Preparing */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Preparing</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 700, background: '#fef3c7', color: '#b45309', padding: '1px 8px', borderRadius: 999 }}>{preparingTickets.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {preparingTickets.map((ticket) => {
                      const elapsedMs = currentTime - new Date(ticket.createdAt).getTime();
                      const elapsedMin = Math.floor(elapsedMs / 60000);
                      const overtime = elapsedMin >= 20;
                      const isProcessing = processingIds.has(ticket.id);
                      return (
                        <article key={ticket.id} style={{ background: '#fff', border: `1px solid ${overtime ? '#fca5a5' : '#e2e8f0'}`, borderLeft: `4px solid ${overtime ? '#dc2626' : '#f59e0b'}`, borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: overtime ? '#fff7f7' : '#fffbeb', borderBottom: `1px solid ${overtime ? '#fca5a5' : '#fde68a'}` }}>
                            <div>
                              <strong style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>#{ticket.displayId}</strong>
                              <span style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginTop: 1 }}>Table #{ticket.table}</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: overtime ? '#dc2626' : '#b45309', background: overtime ? '#fee2e2' : '#fef3c7', padding: '3px 10px', borderRadius: 999, display: 'block' }}>◷ {formatElapsed(ticket.createdAt, currentTime)}</span>
                              {overtime && <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#dc2626', marginTop: 2, display: 'block' }}>OVERTIME</span>}
                            </div>
                          </div>
                          <div style={{ padding: '10px 14px' }}>
                            {ticket.items.map((item, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderBottom: idx < ticket.items.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                <div>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#0f172a', display: 'block' }}>{item.name}</span>
                                  {item.notes?.map((n) => <em key={n} style={{ display: 'block', fontSize: '0.72rem', color: '#b91c1c', fontStyle: 'normal', marginTop: 2 }}>{n}</em>)}
                                </div>
                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '2px 6px', borderRadius: 6 }}>×{item.qty}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '8px 10px', borderTop: '1px solid #f1f5f9' }}>
                            <button onClick={() => setCancelTarget(ticket)} disabled={isProcessing} style={{ height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 7, border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m8 8 8 8M16 8l-8 8" /><circle cx="12" cy="12" r="9" /></svg>
                              Cancel
                            </button>
                            <button onClick={() => handleComplete(ticket.id)} disabled={isProcessing} style={{ height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 7, border: 'none', background: '#0f172a', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m5 12 4 4L19 6" /></svg>
                              {isProcessing ? 'Saving…' : 'Complete'}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                    {preparingTickets.length === 0 && <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8', fontSize: '0.82rem', background: '#fff', borderRadius: 14, border: '1px dashed #e2e8f0' }}>No orders preparing</div>}
                  </div>
                </div>

                {/* Column: Ready */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#059669', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ready</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 700, background: '#d1fae5', color: '#065f46', padding: '1px 8px', borderRadius: 999 }}>{readyTickets.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {readyTickets.map((ticket) => (
                      <article key={ticket.id} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(5,150,105,0.06)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #bbf7d0' }}>
                          <div>
                            <strong style={{ fontSize: '1rem', fontWeight: 700, color: '#065f46' }}>#{ticket.displayId}</strong>
                            <span style={{ display: 'block', fontSize: '0.72rem', color: '#6ee7b7', marginTop: 1 }}>Table #{ticket.table}</span>
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065f46', background: '#d1fae5', padding: '3px 10px', borderRadius: 999 }}>✓ Ready</span>
                        </div>
                        <div style={{ padding: '10px 14px' }}>
                          {ticket.items.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: idx < ticket.items.length - 1 ? '1px solid #d1fae5' : 'none' }}>
                              <span style={{ fontSize: '0.85rem', color: '#065f46' }}>{item.name}</span>
                              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#065f46' }}>×{item.qty}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ padding: '10px 14px', borderTop: '1px solid #bbf7d0' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#059669', background: '#ecfdf5', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                            ✓ Waiting Pickup
                          </div>
                        </div>
                      </article>
                    ))}
                    {readyTickets.length === 0 && <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8', fontSize: '0.82rem', background: '#fff', borderRadius: 14, border: '1px dashed #e2e8f0' }}>No orders ready</div>}
                  </div>
                </div>
              </div>
            )
          )}

          {/* Pagination */}
          {activeTab === 'active-orders' && totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, padding: '12px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
              <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                {visibleTickets.length > 0 ? `${ticketStart + 1}–${Math.min(ticketStart + ticketsPerPage, visibleTickets.length)} of ${visibleTickets.length}` : '0 of 0'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button disabled={activePage <= 1} onClick={() => setCurrentPage(activePage - 1)} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: activePage <= 1 ? '#f8fafc' : '#fff', color: activePage <= 1 ? '#94a3b8' : '#374151', fontSize: '0.82rem', fontWeight: 600, cursor: activePage <= 1 ? 'default' : 'pointer' }}>◀ Prev</button>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>{activePage} / {totalPages}</span>
                <button disabled={activePage >= totalPages} onClick={() => setCurrentPage(activePage + 1)} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: activePage >= totalPages ? '#f8fafc' : '#fff', color: activePage >= totalPages ? '#94a3b8' : '#374151', fontSize: '0.82rem', fontWeight: 600, cursor: activePage >= totalPages ? 'default' : 'pointer' }}>Next ▶</button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default Kitchen;
