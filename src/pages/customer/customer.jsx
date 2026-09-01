import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePOS } from '../../context/POSContext';
import './customer.css';

function MenuImagePlaceholder() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m4 18 5-5 3 3 3-4 5 6" />
    </svg>
  );
}

function ReturnIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/* ── Step progress bar shown inside the pending modal ─────────────── */
const STEPS = [
  { label: 'Order\nSubmitted' },
  { label: 'Kitchen\nStock Check' },
  { label: 'Cashier\nConfirmation' },
  { label: 'Cooking &\nServing' },
];

function stepClassFor(stepIndex, requestStatus) {
  // Map statuses to which step is currently active
  // PENDING_KITCHEN = step 2 active (step 1 done)
  // PENDING_CASHIER = step 3 active (steps 1-2 done)
  // ACCEPTED = step 4 active (steps 1-3 done)
  const activeStep =
    requestStatus === 'PENDING_KITCHEN' ? 1 :
    requestStatus === 'PENDING_CASHIER' ? 2 :
    requestStatus === 'ACCEPTED' ? 3 : 1;

  if (stepIndex < activeStep) return 'done';
  if (stepIndex === activeStep) return 'active';
  return '';
}

/* ── Pending Order Modal ───────────────────────────────────────────── */
function CustomerPendingModal({ request }) {
  const status = request?.status;
  const statusLabel =
    status === 'PENDING_KITCHEN' ? 'Waiting for kitchen to verify stock…' :
    status === 'PENDING_CASHIER' ? 'Waiting for cashier to confirm your order…' :
    'Your order is being processed…';

  return (
    <div className="cpending-overlay" role="dialog" aria-modal="true" aria-label="Order pending confirmation">
      <div className="cpending-card">
        <div className="cpending-header">
          <span className="cpending-icon">⏳</span>
          <h2>Order Pending Verification</h2>
          <p>{statusLabel}</p>
        </div>

        <div className="cpending-notice">
          <span className="cpending-notice-icon">📌</span>
          <span>
            <strong>Please keep this tab open!</strong> The kitchen is checking ingredient availability,
            and the cashier will confirm your order shortly. Do not close or refresh this page.
          </span>
        </div>

        <div className="cpending-steps" role="list" aria-label="Order progress">
          {STEPS.map((step, idx) => {
            const cls = stepClassFor(idx, status);
            return (
              <div key={idx} className={`cpending-step ${cls}`} role="listitem">
                <div className="cpending-step-dot">
                  {cls === 'done' ? '✓' : idx + 1}
                </div>
                <div className="cpending-step-label" style={{ whiteSpace: 'pre-line' }}>{step.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Unavailable Items Alert Modal ─────────────────────────────────── */
function CustomerUnavailableModal({ request, onModify }) {
  const unavailableItems = Array.isArray(request?.unavailable_items) ? request.unavailable_items : [];
  const reason = request?.rejection_reason || '';

  return (
    <div className="cunavail-overlay" role="alertdialog" aria-modal="true" aria-label="Items unavailable alert">
      <div className="cunavail-card">
        <div className="cunavail-header">
          <span className="cunavail-header-icon">⚠️</span>
          <h2>Items Cannot Be Served</h2>
          <p>{reason || 'Some items in your order are currently unavailable.'}</p>
        </div>

        <div className="cunavail-items">
          {unavailableItems.length > 0 ? (
            unavailableItems.map((item, idx) => (
              <div key={idx} className="cunavail-item">
                <span className="cunavail-item-x">✕</span>
                <span className="cunavail-item-name">
                  {item.name || item.item_name}
                  {item.quantity > 1 ? ` ×${item.quantity}` : ''}
                </span>
              </div>
            ))
          ) : (
            <div className="cunavail-item">
              <span className="cunavail-item-x">✕</span>
              <span className="cunavail-item-name">One or more items in your order</span>
            </div>
          )}
        </div>

        <p className="cunavail-instructions">
          Please keep this tab open. Click the button below to modify your order
          — remove the unavailable items and re-submit.
        </p>

        <div className="cunavail-action">
          <button type="button" className="cunavail-modify-btn" onClick={onModify}>
            Modify My Order
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Customer Component ────────────────────────────────────────── */
export default function Customer() {
  const navigate = useNavigate();
  const { tableId } = useParams();
  const {
    tables,
    orders,
    menuItems: dbMenuItems,
    categories: dbCategories,
    customerRequests,
    createCustomerRequest,
    cancelCustomerRequest,
    requestTableBillOut,
    formatPrice,
    loading,
  } = usePOS();

  const safeTables = Array.isArray(tables) ? tables : [];
  const safeCustomerRequests = Array.isArray(customerRequests) ? customerRequests : [];
  const safeMenuItems = Array.isArray(dbMenuItems) ? dbMenuItems : [];
  const safeCategories = Array.isArray(dbCategories) ? dbCategories : [];
  const safeOrders = Array.isArray(orders) ? orders : [];

  const parsedTableId = Number(String(tableId || '').replace(/[^0-9]/g, ''));
  const selectedTable = safeTables.find((table) => table.table_number === parsedTableId);
  const dbTable = safeTables.find((t) => t.table_number === parsedTableId);

  // Only show ACTIVE items on menu
  const menuItems = useMemo(
    () => safeMenuItems.filter((item) => item.status === 'ACTIVE').map((item) => ({
      id: item.id,
      name: item.name,
      price: Number(item.price) || 0,
      category: item.category_id,
    })),
    [safeMenuItems],
  );

  const categories = useMemo(
    () => safeCategories.map((category) => ({ id: category.id, name: category.name })),
    [safeCategories],
  );

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [unavailableItemIds, setUnavailableItemIds] = useState(new Set()); // IDs flagged as unavailable
  const [submitting, setSubmitting] = useState(false);
  const [billOutRequesting, setBillOutRequesting] = useState(false);
  const [billOutRequested, setBillOutRequested] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [showMobileCart, setShowMobileCart] = useState(false);

  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0].id);
    }
  }, [categories, selectedCategory]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync bill_out_requested from DB in case cashier resets it
  useEffect(() => {
    if (dbTable && !dbTable.bill_out_requested) {
      setBillOutRequested(false);
    }
  }, [dbTable]);

  const activeCategory = selectedCategory || categories[0]?.id;
  const visibleItems = menuItems.filter((item) => item.category === activeCategory);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const now = new Date(currentTime);

  // ── Active request for this table (any non-completed, non-cancelled status) ──
  const activeRequest = safeCustomerRequests.find(
    (r) =>
      r.table_number === parsedTableId &&
      !['ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED'].includes(r.status),
  );

  const hasPendingRequest = !!activeRequest && ['PENDING_KITCHEN', 'PENDING_CASHIER'].includes(activeRequest?.status);
  const hasUnavailableRequest = !!activeRequest && activeRequest.status === 'UNAVAILABLE';

  // ── Check if food is served (table has orders in SERVED/COMPLETED state) ──
  // Only consider non-cancelled orders; a stale CANCELLED row must not block the button.
  const tableOrders = safeOrders.filter(
    (o) => o.table_number === parsedTableId && o.status !== 'CANCELLED',
  );
  const hasServedOrders = tableOrders.length > 0 && tableOrders.every(
    (o) => o.status === 'SERVED' || o.status === 'COMPLETED',
  );
  // Only show bill out if food is served and there are actually served orders
  const showBillOut = hasServedOrders && tableOrders.length > 0;

  function addItem(item) {
    setCart((previous) => {
      const existing = previous.find((entry) => entry.id === item.id);
      if (existing) {
        return previous.map((entry) =>
          entry.id === item.id ? { ...entry, qty: entry.qty + 1 } : entry,
        );
      }
      return [...previous, { ...item, qty: 1 }];
    });
  }

  function removeItem(itemId) {
    setCart((previous) => previous.flatMap((entry) => {
      if (entry.id !== itemId) return entry;
      if (entry.qty <= 1) return [];
      return { ...entry, qty: entry.qty - 1 };
    }));
  }

  // When customer modifies order after unavailable alert:
  // cancel the UNAVAILABLE request in DB (which hides the modal),
  // restore the available items into the cart, and mark unavailable ones.
  async function handleModifyAfterUnavailable() {
    if (!activeRequest) return;
    const unavailableIds = new Set(
      (Array.isArray(activeRequest.unavailable_items) ? activeRequest.unavailable_items : []).map(
        (item) => item.id || item.name,
      ),
    );
    // Restore cart from previous request items, minus the unavailable ones
    const prevItems = Array.isArray(activeRequest.items) ? activeRequest.items : [];
    const restoredCart = prevItems
      .filter((item) => !unavailableIds.has(item.id || item.name))
      .map((item) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price) || 0,
        category: menuItems.find((m) => m.id === item.id)?.category || null,
        qty: Number(item.quantity) || 1,
      }));
    setCart(restoredCart);
    setUnavailableItemIds(unavailableIds);
    // Cancel the UNAVAILABLE request in DB so the modal dismisses
    await cancelCustomerRequest(activeRequest.id);
  }

  async function submitRequest() {
    if (!selectedTable || cart.length === 0 || submitting || hasPendingRequest) return;
    setSubmitting(true);
    const { error } = await createCustomerRequest(
      selectedTable.table_number,
      cart.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.qty,
      })),
    );

    if (!error) {
      setCart([]);
      setUnavailableItemIds(new Set());
      setShowMobileCart(false);
    } else {
      console.error('Error creating customer request:', error);
    }
    setSubmitting(false);
  }

  async function handleBillOut() {
    if (billOutRequesting || billOutRequested || !selectedTable) return;
    setBillOutRequesting(true);
    await requestTableBillOut(selectedTable.table_number);
    setBillOutRequested(true);
    setBillOutRequesting(false);
  }

  if (loading) {
    return <div className="customer-app customer-loading" role="status" aria-live="polite">Loading menu…</div>;
  }

  if (!selectedTable) {
    return (
      <div className="customer-app customer-loading">
        <div className="customer-invalid-card" role="alert">
          <h1>Table not found</h1>
          <p>This QR code is not linked to an active restaurant table. Please scan again or ask a staff member for help.</p>
        </div>
      </div>
    );
  }

  // ── Cart panel (shared between desktop sidebar and mobile bottom panel) ──
  const CartPanel = ({ isInline = false }) => (
    <div className="customer-sidebar-card" role="complementary" aria-label="Your order">
      <div className="customer-sidebar-heading">
        <div>
          <p className="customer-kicker">Current Selection</p>
          <h2>Your Order</h2>
        </div>
        {cartCount > 0 && (
          <span style={{
            minWidth: 28, height: 28, background: '#0f172a', color: '#fff',
            borderRadius: 28, display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '0.82rem', fontWeight: 800, padding: '0 8px',
          }} aria-label={`${cartCount} items in cart`}>
            {cartCount}
          </span>
        )}
      </div>

      <div className="customer-cart-list" aria-label="Cart items" aria-live="polite">
        {cart.length === 0 ? (
          <div className="customer-empty-state" aria-label="Cart is empty">
            Select items from the menu to start your order.
          </div>
        ) : (
          cart.map((item) => {
            const isUnavailable = unavailableItemIds.has(item.id) || unavailableItemIds.has(item.name);
            return (
              <div
                key={item.id}
                className="customer-cart-item"
                style={isUnavailable ? { border: '1.5px solid #fecaca', background: '#fef2f2', borderRadius: 8 } : {}}
              >
                <div className="customer-cart-item-info">
                  <span className="customer-cart-item-name">
                    {item.name}
                    {isUnavailable && (
                      <span style={{ marginLeft: 6, fontSize: '.72rem', color: '#dc2626', fontWeight: 700 }}>
                        UNAVAILABLE
                      </span>
                    )}
                  </span>
                  <span className="customer-cart-item-price">{formatPrice(item.price)} each</span>
                </div>
                <div className="customer-cart-controls" role="group" aria-label={`Quantity for ${item.name}`}>
                  <button onClick={() => removeItem(item.id)} aria-label={`Remove one ${item.name}`} type="button">−</button>
                  <span className="qty-display" aria-label={`${item.qty} of ${item.name}`}>{item.qty}</span>
                  <button onClick={() => addItem(item)} aria-label={`Add one more ${item.name}`} type="button">+</button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="customer-summary" aria-label="Order summary">
        <div className="customer-summary-row">
          <span className="customer-summary-label">Subtotal</span>
          <span className="customer-summary-value">{formatPrice(subtotal)}</span>
        </div>
      </div>

      {/* Served state / Bill Out */}
      {showBillOut && (
        <div className="customer-served-state">
          <span className="customer-served-emoji">🍽️</span>
          <p className="customer-served-title">Food has been served!</p>
          <p className="customer-served-subtitle">Enjoy your meal. Ready to pay?</p>
          {billOutRequested ? (
            <div className="customer-billout-requested" aria-live="polite">
              ✓ Bill requested — Staff is heading to your table
            </div>
          ) : (
            <button
              type="button"
              className="customer-billout-button"
              onClick={handleBillOut}
              disabled={billOutRequesting}
              aria-label="Request bill out"
            >
              {billOutRequesting ? 'Sending…' : '🧾 Request Bill Out'}
            </button>
          )}
        </div>
      )}

      {/* Pending banner when not in bill-out state */}
      {hasPendingRequest && !showBillOut && (
        <div className="customer-request-banner" role="status" aria-live="polite">
          ⏳ Your order is being verified — please wait.
        </div>
      )}

      {/* Submit button — hidden when bill-out is visible or a pending request exists */}
      {!showBillOut && (
        <button
          className={`customer-submit-button ${isInline ? 'customer-submit-button-inline' : ''}`}
          onClick={submitRequest}
          disabled={cart.length === 0 || submitting || hasPendingRequest}
          aria-label={submitting ? 'Sending order…' : 'Place order'}
          type="button"
        >
          {submitting ? 'Sending…' : hasPendingRequest ? '⏳ Order Pending…' : '✓ Mark Pending'}
        </button>
      )}
    </div>
  );

  return (
    <div className="customer-app" aria-label={`Customer ordering interface for Table ${selectedTable.table_number}`}>

      {/* ── Pending Verification Modal (blocks screen) ── */}
      {hasPendingRequest && <CustomerPendingModal request={activeRequest} />}

      {/* ── Unavailable Alert Modal (blocks screen) ── */}
      {hasUnavailableRequest && (
        <CustomerUnavailableModal
          request={activeRequest}
          onModify={handleModifyAfterUnavailable}
        />
      )}

      {/* ── Header ── */}
      <header className="customer-topbar">
        <div>
          <p className="customer-kicker">Customer Interface</p>
          <h1>Table #{String(selectedTable.table_number).padStart(2, '0')}</h1>
        </div>
        <div className="customer-topbar-actions">
          <button
            type="button"
            className="customer-return-button"
            onClick={() => navigate('/')}
            aria-label="Return to interface selector"
          >
            <ReturnIcon />
          </button>
          <div className="customer-topbar-meta" aria-label="Current date and time">
            <span>
              {now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
            <span>
              {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
            </span>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="customer-main">

        {/* ── Menu Panel ── */}
        <section className="customer-menu-panel" aria-label="Menu">

          {/* Category selector */}
          <nav className="customer-category-row" aria-label="Menu categories" role="tablist">
            {categories.map((category) => (
              <button
                key={category.id}
                className={`customer-category-button ${activeCategory === category.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category.id)}
                role="tab"
                aria-selected={activeCategory === category.id}
                aria-label={`Category: ${category.name}`}
                type="button"
              >
                {category.name}
              </button>
            ))}
          </nav>

          {/* Menu grid */}
          <div
            className="customer-menu-grid"
            role="list"
            aria-label={`Menu items in ${categories.find(c => c.id === activeCategory)?.name || 'selected category'}`}
          >
            {visibleItems.map((item) => {
              const isUnavailable = unavailableItemIds.has(item.id) || unavailableItemIds.has(item.name);
              return (
                <article
                  key={item.id}
                  className="customer-menu-card"
                  role="listitem"
                  aria-label={`${item.name}, ${formatPrice(item.price)}`}
                  style={isUnavailable ? { opacity: .5 } : {}}
                >
                  <span className="customer-menu-image" aria-hidden="true">
                    <MenuImagePlaceholder />
                  </span>
                  <div className="customer-menu-body">
                    <span className="customer-menu-name">
                      {item.name}
                      {isUnavailable && (
                        <span style={{ display: 'block', fontSize: '.7rem', color: '#dc2626', fontWeight: 700, marginTop: 2 }}>
                          Unavailable
                        </span>
                      )}
                    </span>
                    <span className="customer-menu-price" aria-label={`Price: ${formatPrice(item.price)}`}>
                      {formatPrice(item.price)}
                    </span>
                    <button
                      className="customer-menu-add-btn"
                      onClick={() => addItem(item)}
                      aria-label={`Add ${item.name} to order`}
                      type="button"
                      disabled={isUnavailable}
                    >
                      <PlusIcon /> Add to Order
                    </button>
                  </div>
                </article>
              );
            })}

            {visibleItems.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#94a3b8', padding: '40px 20px' }}>
                No items in this category yet.
              </div>
            )}
          </div>
        </section>

        {/* ── Desktop Sidebar ── */}
        <aside className="customer-sidebar">
          <CartPanel isInline />
        </aside>
      </main>

      {/* ── Mobile Sticky Bottom Bar ── */}
      <div className="customer-mobile-bar" role="region" aria-label="Order summary and checkout">
        <div className="customer-mobile-bar-summary">
          <span>{cartCount > 0 ? `${cartCount} item${cartCount !== 1 ? 's' : ''} in order` : 'No items yet'}</span>
          <span className="customer-mobile-bar-total">{formatPrice(subtotal)}</span>
        </div>
        {hasPendingRequest && (
          <div className="customer-request-banner" role="status" aria-live="polite" style={{ fontSize: '0.82rem' }}>
            ⏳ Order pending verification — please keep this tab open.
          </div>
        )}
        {showBillOut && !billOutRequested && (
          <button
            type="button"
            className="customer-billout-button"
            onClick={handleBillOut}
            disabled={billOutRequesting}
          >
            {billOutRequesting ? 'Sending…' : '🧾 Request Bill Out'}
          </button>
        )}
        {showBillOut && billOutRequested && (
          <div className="customer-billout-requested">
            ✓ Bill requested — Staff is heading to your table
          </div>
        )}
        {!showBillOut && (
          <button
            className="customer-submit-button"
            onClick={submitRequest}
            disabled={cart.length === 0 || submitting || hasPendingRequest}
            aria-label={submitting ? 'Sending order…' : 'Place order'}
            type="button"
          >
            {submitting ? 'Sending…' : hasPendingRequest ? '⏳ Order Pending…' : cartCount > 0 ? `✓ Mark Pending (${cartCount})` : 'Select Items to Order'}
          </button>
        )}
      </div>
    </div>
  );
}
