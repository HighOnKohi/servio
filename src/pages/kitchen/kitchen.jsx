import { useEffect, useMemo, useState, useCallback } from 'react';
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
  const [ordersTabBlink, setOrdersTabBlink]   = useState(false);
  const prevPendingRef   = useRef(0);
  const prevOrdersRef    = useRef(0);
  const interfaceCanvas  = useFixedInterfaceCanvas();

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
    return <div className="kitchen-app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#fff', fontSize: '1.2rem' }}>Loading…</div>;
  }

  return (
    <div className="kitchen-app" style={{ '--kitchen-scale': interfaceCanvas.scale, width: interfaceCanvas.width, height: interfaceCanvas.height, minHeight: interfaceCanvas.height }}>
      {/* ── Modals ── */}
      {cancelTarget && (
        <CancelConfirmModal
          ticket={cancelTarget}
          onConfirm={handleCancelConfirm}
          onDismiss={() => setCancelTarget(null)}
        />
      )}
      {unavailableTarget && (
        <UnavailableItemModal
          request={unavailableTarget}
          onConfirm={handleUnavailableConfirm}
          onDismiss={() => setUnavailableTarget(null)}
        />
      )}
      {showStockDrawer && (
        <StockDrawer
          menuItems={Array.isArray(menuItems) ? menuItems : []}
          categories={Array.isArray(categories) ? categories : []}
          onToggle={toggleMenuItemStock}
          onClose={() => setShowStockDrawer(false)}
        />
      )}

      {/* ── Header ── */}
      <header className="kitchen-topbar">
        <div className="kitchen-brand">
          <span className="kitchen-brand-logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
          </span>
          <span>Kitchen Interface</span>
        </div>
        <div className="kitchen-topbar-right">
          <button
            type="button"
            className="kitchen-stock-manage-btn"
            onClick={() => setShowStockDrawer(true)}
            aria-label="Manage item stock"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3h18v4H3zM3 10h18v4H3zM3 17h18v4H3z" /></svg>
            Manage Stock
          </button>
          <span>{new Date(currentTime).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}, {new Date(currentTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}</span>
          <button className="kitchen-return-button" onClick={() => navigate('/')} aria-label="Return to interface selector">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
          </button>
        </div>
      </header>

      {/* ── Tab Navigation ── */}
      <nav className="kitchen-tab-group" aria-label="Kitchen sections">
        <button
          className={[
            activeTab === 'pending-verification' ? 'active' : '',
            pendingTabBlink ? 'tab-blink' : '',
          ].join(' ').trim()}
          onClick={() => { setActiveTab('pending-verification'); setPendingTabBlink(false); }}
        >
          PENDING VERIFICATION
          {pendingRequests.length > 0 && <span className="pending-badge">{pendingRequests.length}</span>}
        </button>
        <button
          className={[
            activeTab === 'active-orders' ? 'active' : '',
            ordersTabBlink ? 'tab-blink' : '',
          ].join(' ').trim()}
          onClick={() => { setActiveTab('active-orders'); navigate('/kitchen/active-orders'); setOrdersTabBlink(false); }}
        >
          ACTIVE ORDERS <span>{visibleTickets.length}</span>
        </button>
      </nav>

      {/* ── Main Workspace ── */}
      <main className="kitchen-workspace">
        <div className="kitchen-content">

          {/* ── Pending Verification Tab ── */}
          {activeTab === 'pending-verification' && (
            pendingRequests.length === 0 ? (
              <div className="kitchen-empty">
                <div>✓</div>
                <h2>No pending verifications</h2>
                <p>All customer requests have been reviewed.</p>
              </div>
            ) : (
              <section className="pending-request-grid">
                {pendingRequests.map((request) => {
                  const items = Array.isArray(request.items) ? request.items : [];
                  const isProcessing = processingIds.has(request.id);
                  return (
                    <article key={request.id} className="pending-request-card">
                      <header className="pending-request-header">
                        <div>
                          <strong>Table #{String(request.table_number).padStart(2, '0')}</strong>
                          <span className="pending-request-badge">Pending Stock Check</span>
                        </div>
                        <time>{new Date(request.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</time>
                      </header>
                      <div className="pending-request-items">
                        {items.map((item, idx) => (
                          <div key={`${request.id}-${idx}`} className="pending-request-item-row">
                            <span>{item.name}</span>
                            <span>×{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                      <footer className="pending-request-actions">
                        <button
                          type="button"
                          className="pending-btn unavailable"
                          onClick={() => setUnavailableTarget(request)}
                          disabled={isProcessing}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m8 8 8 8M16 8l-8 8" /><circle cx="12" cy="12" r="9" /></svg>
                          Item Unavailable
                        </button>
                        <button
                          type="button"
                          className="pending-btn confirm"
                          onClick={() => handleForwardToCashier(request.id)}
                          disabled={isProcessing}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m5 12 4 4L19 6" /></svg>
                          {isProcessing ? 'Forwarding…' : 'Confirm & Forward'}
                        </button>
                      </footer>
                    </article>
                  );
                })}
              </section>
            )
          )}

          {/* ── Active Orders Tab ── */}
          {activeTab === 'active-orders' && (
            visibleTickets.length === 0 ? (
              <div className="kitchen-empty">
                <div>✓</div>
                <h2>No active orders</h2>
                <p>The kitchen is all caught up.</p>
              </div>
            ) : (
              <section className="ticket-grid">
                {pagedTickets.map((ticket) => {
                  const elapsedMs = currentTime - new Date(ticket.createdAt).getTime();
                  const elapsedMinutes = Math.floor(elapsedMs / 60000);
                  let urgency = 'normal';
                  if (ticket.status === 'ACTIVE') {
                    if (elapsedMinutes >= 20) urgency = 'overtime';
                    else if (elapsedMinutes >= 10) urgency = 'warning';
                  }
                  const isProcessing = processingIds.has(ticket.id);
                  return (
                    <article className={`kitchen-ticket ${urgency !== 'normal' ? urgency : ''} ${ticket.status.toLowerCase()}`} key={ticket.id}>
                      <header className={`ticket-header ${urgency !== 'normal' ? urgency : ''}`}>
                        <div>
                          <strong>#{ticket.displayId}</strong>
                          <span>Table #{ticket.table}</span>
                          {urgency === 'overtime' && <span className="overtime-badge">OVERTIME</span>}
                        </div>
                        <time>◷ {formatElapsed(ticket.createdAt, ticket.status === 'COMPLETED' || ticket.status === 'CANCELLED' ? new Date(ticket.completedAt).getTime() : currentTime)}</time>
                      </header>
                      <div className="ticket-meta">
                        <span>{ticket.server}</span>
                        <span>{ticket.orderType}</span>
                      </div>
                      <div className="ticket-items">
                        {ticket.items.map((item, index) => (
                          <div className={`ticket-item ${item.cancelled ? 'cancelled' : ''}`} key={`${ticket.id}-${index}`}>
                            <div>
                              <strong>{item.name}</strong>
                              {item.cancelled && <small>Item cancelled</small>}
                              {item.notes?.map((note) => <em key={note}>{note}</em>)}
                            </div>
                            <span>×{item.qty}</span>
                          </div>
                        ))}
                      </div>
                      <footer className="ticket-actions">
                        <button
                          className="cancel-ticket"
                          onClick={() => setCancelTarget(ticket)}
                          disabled={isProcessing}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m8 8 8 8M16 8l-8 8" /><circle cx="12" cy="12" r="9" /></svg>
                          Cancel
                        </button>
                        <button
                          className="complete-ticket"
                          onClick={() => handleComplete(ticket.id)}
                          disabled={isProcessing}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m5 12 4 4L19 6" /></svg>
                          {isProcessing ? 'Saving…' : 'Complete'}
                        </button>
                      </footer>
                    </article>
                  );
                })}
              </section>
            )
          )}
        </div>

        {/* ── Pagination (only for active orders) ── */}
        {activeTab === 'active-orders' && (
          <footer className="kitchen-pagination">
            <span>{visibleTickets.length ? `${ticketStart + 1}–${Math.min(ticketStart + ticketsPerPage, visibleTickets.length)} of ${visibleTickets.length}` : '0 of 0'}</span>
            <div className="kitchen-pagination-actions">
              <button disabled={activePage <= 1} onClick={() => setCurrentPage(activePage - 1)}>◀ Previous</button>
              <span>{activePage} / {totalPages}</span>
              <button disabled={activePage >= totalPages} onClick={() => setCurrentPage(activePage + 1)}>Next ▶</button>
            </div>
          </footer>
        )}
      </main>
    </div>
  );
}

export default Kitchen;
