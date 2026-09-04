import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePOS } from '../../context/POSContext';
import './customer.css';

/* ── Order Status Panel ────────────────────────────────────────────── */
// Plain hoisted function declaration — no module-level `const`, no TDZ risk.
// The `entering` state (set once on mount, never reset) keeps the animation
// class on the element for all subsequent re-renders from polling, so the
// entry animation only ever plays once regardless of how often data refreshes.
function OrderStatusPanel({ tableOrders, orderItems, formatPrice }) {
  // All hooks must come before any early return (Rules of Hooks).
  const allItems = useMemo(() => {
    return tableOrders.flatMap((order) =>
      orderItems
        .filter((oi) => oi.order_id === order.id && oi.status !== 'CANCELLED')
        .map((oi) => ({ ...oi, orderStatus: order.status }))
    );
  }, [tableOrders, orderItems]);

  // Set to true on first mount; never resets — animation class stays applied.
  const [entering, setEntering] = useState(false);
  useEffect(() => { setEntering(true); }, []);

  if (allItems.length === 0) return null;

  const servedCount = allItems.filter(
    (i) => String(i.status || '').toUpperCase() === 'SERVED' || String(i.status || '').toUpperCase() === 'READY'
  ).length;
  const totalCount  = allItems.length;
  const allServed   = totalCount > 0 && servedCount === totalCount;

  return (
    <div
      className={`cos-panel${entering ? ' cos-panel--entered' : ''}`}
      aria-label="Your order status"
      role="region"
    >
      <div className="cos-header">
        <div className="cos-header-left">
          <span className="cos-icon">{allServed ? '🍽️' : '🍳'}</span>
          <div>
            <p className="cos-kicker">Live Tracking</p>
            <h3 className="cos-title">Order Status</h3>
          </div>
        </div>
        <div className="cos-progress-wrap">
          <div className="cos-progress-bar">
            <div
              className="cos-progress-fill"
              style={{ width: `${totalCount > 0 ? (servedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
          <span className="cos-progress-label">{servedCount}/{totalCount} ready</span>
        </div>
      </div>

      <div className="cos-items" role="list">
        {allItems.map((item) => {
          const statusUpper = String(item.status || '').toUpperCase();
          const isServed = statusUpper === 'SERVED' || statusUpper === 'READY';
          return (
            <div key={item.id} className={`cos-item ${isServed ? 'cos-item--ready' : 'cos-item--preparing'}`} role="listitem">
              <div className="cos-item-left">
                <span className="cos-item-dot" aria-hidden="true" />
                <div>
                  <span className="cos-item-name">{item.item_name}</span>
                  {item.quantity > 1 && <span className="cos-item-qty"> ×{item.quantity}</span>}
                </div>
              </div>
              <span className={`cos-item-badge ${isServed ? 'cos-badge--ready' : 'cos-badge--preparing'}`}>
                {isServed ? '✓ Ready' : '🍳 Preparing'}
              </span>
            </div>
          );
        })}
      </div>

      {allServed && (
        <div className="cos-all-ready" role="status">
          🎉 All dishes are ready — enjoy your meal!
        </div>
      )}
    </div>
  );
}

function MenuImagePlaceholderSVG() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m4 18 5-5 3 3 3-4 5 6" />
    </svg>
  );
}

/* ── Menu Image Display — real photo with shimmer skeleton + fallback ────── */
function MenuImageDisplay({ src, alt, soldOut = false, unavailable = false }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <span className={`customer-menu-image customer-menu-image--photo${loaded ? ' loaded' : ''}${!src || error ? ' placeholder' : ''}`}>
      {!src || error ? (
        <MenuImagePlaceholderSVG />
      ) : (
        <img
          src={src}
          alt={alt}
          className="customer-menu-img"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      )}
      {soldOut && (
        <span className="customer-image-soldout-overlay" aria-hidden="true">
          <span>SOLD OUT</span>
        </span>
      )}
      {!soldOut && unavailable && (
        <span className="customer-image-soldout-overlay unavail" aria-hidden="true">
          <span>UNAVAILABLE</span>
        </span>
      )}
    </span>
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

/* ── Customer Bill Out Payment Selection Modal ────────────────────────────── */
function CustomerBillOutModal({
  isOpen,
  onClose,
  onConfirm,
  selectedMethod,
  onSelectMethod,
  submitting,
  totalAmount,
  formatPrice,
}) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose, submitting]);

  if (!isOpen) return null;

  return (
    <div className="cbillout-overlay" onClick={() => !submitting && onClose()} role="dialog" aria-modal="true" aria-label="Select payment method">
      <div className="cbillout-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cbillout-header">
          <div className="cbillout-header-text">
            <span className="cbillout-kicker">BILL OUT REQUEST</span>
            <h2 className="cbillout-title">Select Payment Method</h2>
            <p className="cbillout-subtitle">Choose how you prefer to settle your bill with the cashier.</p>
          </div>
          <button className="cbillout-close-btn" onClick={onClose} disabled={submitting} aria-label="Close" type="button">×</button>
        </div>

        {totalAmount > 0 && (
          <div className="cbillout-amount-card">
            <span className="cbillout-amount-label">Current Total Bill</span>
            <span className="cbillout-amount-val">{formatPrice(totalAmount)}</span>
          </div>
        )}

        <div className="cbillout-options" role="radiogroup" aria-label="Payment methods">
          {/* Cash option */}
          <label className={`cbillout-option ${selectedMethod === 'cash' ? 'active' : ''}`}>
            <input
              type="radio"
              name="customer-payment"
              value="cash"
              checked={selectedMethod === 'cash'}
              onChange={() => onSelectMethod('cash')}
              className="cbillout-radio"
            />
            <div className="cbillout-option-icon cash-icon">💵</div>
            <div className="cbillout-option-details">
              <div className="cbillout-option-top">
                <span className="cbillout-option-title">Cash</span>
                {selectedMethod === 'cash' && <span className="cbillout-check">✓</span>}
              </div>
              <p className="cbillout-option-desc">Pay with cash at the counter or give to staff</p>
            </div>
          </label>

          {/* Credit Card option */}
          <label className={`cbillout-option ${selectedMethod === 'credit' ? 'active' : ''}`}>
            <input
              type="radio"
              name="customer-payment"
              value="credit"
              checked={selectedMethod === 'credit'}
              onChange={() => onSelectMethod('credit')}
              className="cbillout-radio"
            />
            <div className="cbillout-option-icon card-icon">💳</div>
            <div className="cbillout-option-details">
              <div className="cbillout-option-top">
                <span className="cbillout-option-title">Credit Card</span>
                {selectedMethod === 'credit' && <span className="cbillout-check">✓</span>}
              </div>
              <p className="cbillout-option-desc">Debit or Credit Card terminal (Visa / Mastercard)</p>
            </div>
          </label>

          {/* InstaPay QR option */}
          <label className={`cbillout-option ${selectedMethod === 'qr' ? 'active' : ''}`}>
            <input
              type="radio"
              name="customer-payment"
              value="qr"
              checked={selectedMethod === 'qr'}
              onChange={() => onSelectMethod('qr')}
              className="cbillout-radio"
            />
            <div className="cbillout-option-icon qr-icon">📱</div>
            <div className="cbillout-option-details">
              <div className="cbillout-option-top">
                <span className="cbillout-option-title">InstaPay QR</span>
                {selectedMethod === 'qr' && <span className="cbillout-check">✓</span>}
              </div>
              <p className="cbillout-option-desc">Scan to pay via GCash, Maya, or any banking app</p>
            </div>
          </label>
        </div>

        <div className="cbillout-actions">
          <button
            type="button"
            className="cbillout-cancel-btn"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="cbillout-confirm-btn"
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? 'Sending Request…' : 'Confirm & Request Bill'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Customer Ask for Assistance Modal ────────────────────────────── */
function CustomerAssistanceModal({
  isOpen,
  onClose,
  onConfirm,
  submitting,
  tableNumber,
  isAlreadyRequested,
  onCancelRequest,
}) {
  const [selectedType, setSelectedType] = useState('Call Waiter / Staff');
  const [note, setNote] = useState('');

  const assistanceTypes = [
    { id: 'Call Waiter / Staff', icon: '🙋‍♂️', label: 'Call Waiter / Staff', desc: 'A team member will come right to your table' },
    { id: 'Water Refill', icon: '💧', label: 'Water Refill', desc: 'Request complimentary drinking water' },
    { id: 'Utensils & Napkins', icon: '🍽️', label: 'Utensils & Napkins', desc: 'Extra forks, spoons, or napkins' },
    { id: 'Bill Inquiry', icon: '🧾', label: 'Bill Inquiry', desc: 'Question about your bill or payment' },
    { id: 'Other', icon: '💬', label: 'Other Request', desc: 'Custom note or assistance' },
  ];

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose, submitting]);

  if (!isOpen) return null;

  return (
    <div className="cbillout-overlay" onClick={() => !submitting && onClose()} role="dialog" aria-modal="true" aria-label="Ask for assistance">
      <div className="cbillout-modal cassistance-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cbillout-header">
          <div className="cbillout-header-text">
            <span className="cbillout-kicker" style={{ color: '#087f63' }}>TABLE #{String(tableNumber).padStart(2, '0')} ASSISTANCE</span>
            <h2 className="cbillout-title">Ask for Assistance</h2>
            <p className="cbillout-subtitle">How can our staff help you today? Tap an option below.</p>
          </div>
          <button className="cbillout-close-btn" onClick={onClose} disabled={submitting} aria-label="Close" type="button">×</button>
        </div>

        {isAlreadyRequested && (
          <div className="cassistance-active-alert">
            <div className="cassistance-active-pulse" />
            <div className="cassistance-active-text">
              <strong>Assistance Already Requested</strong>
              <p>Our team has been notified and is heading to your table.</p>
            </div>
            {onCancelRequest && (
              <button
                type="button"
                className="cassistance-cancel-btn"
                onClick={onCancelRequest}
                disabled={submitting}
              >
                Cancel Request
              </button>
            )}
          </div>
        )}

        <div className="cassistance-options" role="radiogroup" aria-label="Assistance types">
          {assistanceTypes.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`cassistance-option ${selectedType === item.id ? 'active' : ''}`}
              onClick={() => setSelectedType(item.id)}
            >
              <span className="cassistance-icon">{item.icon}</span>
              <div className="cassistance-details">
                <span className="cassistance-label">{item.label}</span>
                <span className="cassistance-desc">{item.desc}</span>
              </div>
              <span className="cassistance-radio-circle">
                {selectedType === item.id && <span className="cassistance-radio-dot" />}
              </span>
            </button>
          ))}
        </div>

        {selectedType === 'Other' && (
          <div className="cassistance-note-wrap">
            <label htmlFor="assistance-note">Special Instructions (optional):</label>
            <input
              id="assistance-note"
              type="text"
              className="cassistance-note-input"
              placeholder="e.g. Extra hot sauce, high chair needed, etc."
              maxLength={80}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        )}

        <div className="cbillout-actions">
          <button
            type="button"
            className="cbillout-cancel-btn"
            onClick={onClose}
            disabled={submitting}
          >
            Close
          </button>
          <button
            type="button"
            className="cbillout-confirm-btn"
            onClick={() => onConfirm({ type: selectedType, note: note.trim() })}
            disabled={submitting}
            style={{ background: '#087f63' }}
          >
            {submitting ? 'Sending Request…' : isAlreadyRequested ? 'Update Request' : '🛎️ Call Staff Now'}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ── Item Detail Modal ────────────────────────────────────────────────────── */
function ItemDetailModal({ item, formatPrice, onClose, onAdd }) {
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const total = item.price * qty;

  return (
    <div className="cdetail-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${item.name} details`}>
      <div className="cdetail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Hero image */}
        <div className="cdetail-hero">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.name} className="cdetail-hero-img" />
          ) : (
            <div className="cdetail-hero-placeholder" aria-hidden="true">
              <MenuImagePlaceholderSVG />
            </div>
          )}
          <button className="cdetail-close" onClick={onClose} aria-label="Close" type="button">×</button>
        </div>

        {/* Body */}
        <div className="cdetail-body">
          <div className="cdetail-meta">
            <h2 className="cdetail-name">{item.name}</h2>
            <span className="cdetail-price">{formatPrice(item.price)}</span>
          </div>

          {item.description && (
            <p className="cdetail-desc">{item.description}</p>
          )}

          {/* Quantity stepper */}
          <div className="cdetail-qty-row" role="group" aria-label="Quantity selector">
            <button
              className="cdetail-qty-btn"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
              type="button"
            >−</button>
            <span className="cdetail-qty-val" aria-label={`Quantity: ${qty}`}>{qty}</span>
            <button
              className="cdetail-qty-btn"
              onClick={() => setQty((q) => q + 1)}
              aria-label="Increase quantity"
              type="button"
            >+</button>
          </div>

          {/* Kitchen notes */}
          <label className="cdetail-notes-label" htmlFor="cdetail-notes-input">
            Special Instructions <span className="cdetail-notes-hint">(optional)</span>
          </label>
          <textarea
            id="cdetail-notes-input"
            className="cdetail-notes"
            placeholder="e.g. No onions, extra sauce on the side…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={200}
          />

          {/* Add to order */}
          <button
            className="cdetail-add-btn"
            onClick={() => onAdd(item, qty, notes.trim())}
            type="button"
            aria-label={`Add ${qty} ${item.name} to order`}
          >
            <PlusIcon />
            Add {qty > 1 ? `${qty} × ` : ''}to Order — {formatPrice(total)}
          </button>
        </div>
      </div>
    </div>
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

/* ── Pending Order Modal (supports minimized floating-chip mode) ─────── */
function CustomerPendingModal({ request, isMinimized, onToggleMinimize }) {
  const status = request?.status;
  const statusLabel =
    status === 'PENDING_KITCHEN' ? 'Waiting for kitchen to verify stock…' :
    status === 'PENDING_CASHIER' ? 'Waiting for cashier to confirm your order…' :
    'Your order is being processed…';

  // ── Minimized: floating non-blocking chip ──
  if (isMinimized) {
    return (
      <div className="cpending-chip" role="status" aria-label="Order pending — tap to expand">
        <span className="cpending-chip-pulse" aria-hidden="true" />
        <span className="cpending-chip-text">
          {status === 'PENDING_KITCHEN' ? '🍳 Kitchen verifying…' :
           status === 'PENDING_CASHIER' ? '💳 Awaiting cashier…' :
           '⏳ Order pending…'}
        </span>
        <button
          type="button"
          className="cpending-chip-expand"
          onClick={onToggleMinimize}
          aria-label="Expand order status"
        >
          ↑ Details
        </button>
      </div>
    );
  }

  // ── Full blocking modal ──
  return (
    <div className="cpending-overlay" role="dialog" aria-modal="true" aria-label="Order pending confirmation">
      <div className="cpending-card">
        <div className="cpending-header">
          <span className="cpending-icon">⏳</span>
          <h2>Order Pending Verification</h2>
          <p>{statusLabel}</p>
          <button
            type="button"
            className="cpending-minimize-btn"
            onClick={onToggleMinimize}
            aria-label="Minimize — continue browsing while we process your order"
          >
            − Minimize &amp; Keep Browsing
          </button>
        </div>

        <div className="cpending-notice">
          <span className="cpending-notice-icon">📌</span>
          <span>
            <strong>Keep this tab open.</strong> You can minimize this dialog and keep adding
            items while we verify your order. Do not close or refresh the page.
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

/* ── Sold-Out Cart Toast ────────────────────────────────────────────── */
function SoldOutToast({ items, onDismiss }) {
  // Auto-dismiss after 7 s
  useEffect(() => {
    const t = setTimeout(onDismiss, 7000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="csoldout-toast" role="alert" aria-live="assertive">
      <span className="csoldout-toast-icon">⚠️</span>
      <div className="csoldout-toast-body">
        <strong>Item{items.length > 1 ? 's' : ''} sold out!</strong>
        <span>
          {items.map((i) => i.name).join(', ')}
          {items.length === 1 ? ' is' : ' are'} no longer available.
          Please remove {items.length === 1 ? 'it' : 'them'} from your cart.
        </span>
      </div>
      <button
        type="button"
        className="csoldout-toast-close"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >×</button>
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
    orderItems,
    menuItems: dbMenuItems,
    categories: dbCategories,
    customerRequests,
    createCustomerRequest,
    cancelCustomerRequest,
    requestTableBillOut,
    tableAssistanceRequests,
    requestTableAssistance,
    resolveTableAssistance,
    formatPrice,
    itemSales,
    loading,
  } = usePOS();

  const safeOrderItems = Array.isArray(orderItems) ? orderItems : [];

  const safeTables = Array.isArray(tables) ? tables : [];
  const safeCustomerRequests = Array.isArray(customerRequests) ? customerRequests : [];
  const safeMenuItems = Array.isArray(dbMenuItems) ? dbMenuItems : [];
  const safeCategories = Array.isArray(dbCategories) ? dbCategories : [];
  const safeOrders = Array.isArray(orders) ? orders : [];

  const parsedTableId = Number(String(tableId || '').replace(/[^0-9]/g, ''));
  const selectedTable = safeTables.find((table) => table.table_number === parsedTableId);
  const dbTable = safeTables.find((t) => t.table_number === parsedTableId);
  const tableOrders = safeOrders.filter(
    (o) => o.table_number === parsedTableId && o.status !== 'CANCELLED',
  );

  const activeOrderDishes = useMemo(() => {
    return tableOrders.flatMap((order) =>
      safeOrderItems.filter((oi) => oi.order_id === order.id && oi.status !== 'CANCELLED')
    );
  }, [tableOrders, safeOrderItems]);

  const activeOrderServedCount = activeOrderDishes.filter(
    (i) => String(i.status || '').toUpperCase() === 'SERVED' || String(i.status || '').toUpperCase() === 'READY'
  ).length;

  // Show ALL items — SOLD OUT ones appear grayed out / disabled so customers
  // know the item exists but isn't available right now.
  const menuItems = useMemo(
    () => safeMenuItems.map((item) => {
      const statusUpper = String(item.status || 'ACTIVE').toUpperCase();
      const isSoldOut = statusUpper === 'SOLD OUT' || statusUpper === 'INACTIVE' || item.status !== 'ACTIVE';
      return {
        id: item.id,
        name: item.name,
        price: Number(item.price) || 0,
        description: item.description || '',
        imageUrl: item.image_url || null,
        category: item.category_id,
        status: item.status || (isSoldOut ? 'SOLD OUT' : 'ACTIVE'),
        soldOut: isSoldOut,
      };
    }),
    [safeMenuItems],
  );

  const BEST_SELLERS_CATEGORY = {
    id: 'best-sellers',
    name: '🔥 Best Sellers',
    isBestSeller: true,
  };

  const categories = useMemo(
    () => [
      BEST_SELLERS_CATEGORY,
      ...safeCategories.map((category) => ({ id: category.id, name: category.name })),
    ],
    [safeCategories],
  );

  // ── Unlock document scrolling on mobile/tablet while in the Customer interface ──
  useEffect(() => {
    document.documentElement.classList.add('customer-page-active');
    document.body.classList.add('customer-page-active');
    return () => {
      document.documentElement.classList.remove('customer-page-active');
      document.body.classList.remove('customer-page-active');
    };
  }, []);

  // ── sessionStorage keys scoped to this table so different tables don't collide ──
  const storageKey = (key) => `customer_t${parsedTableId}_${key}`;

  const [selectedCategory, setSelectedCategory] = useState(() => {
    try { return sessionStorage.getItem(storageKey('category')) || null; } catch { return null; }
  });

  const [cart, setCart] = useState(() => {
    try {
      const raw = sessionStorage.getItem(storageKey('cart'));
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const [unavailableItemIds, setUnavailableItemIds] = useState(() => {
    try {
      const raw = sessionStorage.getItem(storageKey('unavail'));
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });

  const [cartSoldOutIds, setCartSoldOutIds] = useState(new Set());  // cart items that went sold-out live
  const [soldOutToast, setSoldOutToast] = useState([]);             // [{id, name}] for the toast
  const alertedSoldOutRef     = useRef(new Set());   // prevent re-alerting same item
  const prevTableStatusRef    = useRef(null);         // track previous table status for transition detection
  const activeCategoryRef     = useRef(null);         // active category pill (for scroll-into-view on mobile)
  const [submitting, setSubmitting] = useState(false);
  const [billOutRequesting, setBillOutRequesting] = useState(false);
  const [billOutRequested, setBillOutRequested] = useState(() => {
    try { return sessionStorage.getItem(storageKey('billout')) === 'true'; } catch { return false; }
  });
  const [showBillOutModal, setShowBillOutModal] = useState(false);
  const [selectedBillOutMethod, setSelectedBillOutMethod] = useState(() => {
    try {
      return sessionStorage.getItem(storageKey('billout_method')) || 'cash';
    } catch {
      return 'cash';
    }
  });
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [menuSearch, setMenuSearch] = useState('');
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [detailItem, setDetailItem] = useState(null);        // item open in detail modal
  const [cartBadgePop, setCartBadgePop] = useState(false);   // triggers cart badge pop
  const [debouncedSearch, setDebouncedSearch] = useState(''); // debounced menu search text
  const [isPendingMinimized, setIsPendingMinimized] = useState(false); // pending modal minimize toggle
  const [showAssistanceModal, setShowAssistanceModal] = useState(false);
  const [assistanceSubmitting, setAssistanceSubmitting] = useState(false);
  const [assistanceFeedback, setAssistanceFeedback] = useState(null);

  const isAssistanceRequested = Boolean(
    tableAssistanceRequests?.[parsedTableId]?.requested ||
    (dbTable?.status === 'REQUEST' && !dbTable?.bill_out_requested)
  );
  const assistanceDetails = tableAssistanceRequests?.[parsedTableId] || null;

  // ── Persist state to sessionStorage whenever it changes ──
  useEffect(() => {
    try { sessionStorage.setItem(storageKey('cart'), JSON.stringify(cart)); } catch {}
  }, [cart, parsedTableId]);

  useEffect(() => {
    try { sessionStorage.setItem(storageKey('unavail'), JSON.stringify([...unavailableItemIds])); } catch {}
  }, [unavailableItemIds, parsedTableId]);

  useEffect(() => {
    if (selectedCategory) {
      try { sessionStorage.setItem(storageKey('category'), selectedCategory); } catch {}
    }
  }, [selectedCategory, parsedTableId]);

  useEffect(() => {
    try { sessionStorage.setItem(storageKey('billout'), String(billOutRequested)); } catch {}
  }, [billOutRequested, parsedTableId]);

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey('billout_method'), selectedBillOutMethod);
    } catch {}
  }, [selectedBillOutMethod, parsedTableId]);

  // Clear the stored cart once the request is ACCEPTED (kitchen is cooking — cart locked)
  useEffect(() => {
    const accepted = safeCustomerRequests.some(
      (r) => r.table_number === parsedTableId && r.status === 'ACCEPTED',
    );
    if (accepted) {
      try {
        sessionStorage.removeItem(storageKey('cart'));
        sessionStorage.removeItem(storageKey('unavail'));
      } catch {}
    }
  }, [safeCustomerRequests, parsedTableId]);

  // ── Scroll active category pill into view on mobile ──
  useEffect(() => {
    if (activeCategoryRef.current) {
      activeCategoryRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0].id);
    }
  }, [categories, selectedCategory]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Debounce menu search (150 ms) to avoid excessive re-renders ──
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(menuSearch.trim().toLowerCase()), 150);
    return () => clearTimeout(t);
  }, [menuSearch]);

  // Sync bill_out_requested from DB.
  // IMPORTANT: dbTable gets a new object reference every time tables is re-fetched (every 8 s
  // from polling). We must NOT clear the cart simply because dbTable.status is EMPTY — that
  // would wipe the cart before the customer has even placed their first order.
  // Only clear when the status TRANSITIONS from a non-EMPTY value to EMPTY (cashier billed out).
  useEffect(() => {
    if (!dbTable) return;
    if (!dbTable.bill_out_requested) {
      setBillOutRequested(false);
    }
    const prevStatus = prevTableStatusRef.current;
    prevTableStatusRef.current = dbTable.status;
    // prevStatus === null means this is the first render — don’t wipe on initial load.
    if (dbTable.status === 'EMPTY' && prevStatus !== null && prevStatus !== 'EMPTY') {
      ['cart', 'unavail', 'category', 'billout'].forEach((k) => {
        try { sessionStorage.removeItem(storageKey(k)); } catch {}
      });
      setCart([]);
      setUnavailableItemIds(new Set());
      setBillOutRequested(false);
    }
  }, [dbTable]);

  // ── Detect when cart items go sold-out while the customer is browsing ──
  // menuItems updates live via the Supabase subscription + polling in POSContext.
  // Use functional updaters so React bails out (no re-render) when the Set contents
  // haven’t actually changed — preventing an infinite render loop when polling refreshes
  // menuItems every 8 s but nothing in the cart has gone sold-out.
  useEffect(() => {
    if (cart.length === 0) {
      alertedSoldOutRef.current = new Set();
      // Bail out if already empty to prevent unnecessary re-render
      setCartSoldOutIds((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }

    const nowSoldOutSet = new Set();
    const newlyGoneSoldOut = [];

    cart.forEach((cartItem) => {
      const liveItem = menuItems.find((m) => m.id === cartItem.id);
      if (liveItem?.soldOut) {
        nowSoldOutSet.add(cartItem.id);
        if (!alertedSoldOutRef.current.has(cartItem.id)) {
          newlyGoneSoldOut.push({ id: cartItem.id, name: cartItem.name });
          alertedSoldOutRef.current.add(cartItem.id);
        }
      } else {
        alertedSoldOutRef.current.delete(cartItem.id);
      }
    });

    // Only update (and re-render) when the sold-out set has actually changed
    setCartSoldOutIds((prev) => {
      if (prev.size === nowSoldOutSet.size && [...nowSoldOutSet].every((id) => prev.has(id))) {
        return prev; // same contents — bail out
      }
      return nowSoldOutSet;
    });

    if (newlyGoneSoldOut.length > 0) {
      setSoldOutToast(newlyGoneSoldOut);
    }
  }, [menuItems, cart]);

  const activeCategory = selectedCategory || categories[0]?.id;
  const isBestSellerCategory = activeCategory === 'best-sellers';
  const normalizedMenuSearch = debouncedSearch;

  const visibleItems = useMemo(() => {
    if (isBestSellerCategory) {
      const top3PerCategory = [];
      const seenIds = new Set();

      // Collect top 3 of each category based on all-time sales
      safeCategories.forEach((cat) => {
        const catItems = menuItems
          .filter((item) => item.category === cat.id)
          .map((item) => ({
            ...item,
            soldCount: Number(itemSales?.[item.id] ?? itemSales?.[item.name] ?? 0),
          }))
          .filter((item) => item.soldCount > 0)
          .sort((a, b) => b.soldCount - a.soldCount)
          .slice(0, 3);

        catItems.forEach((item) => {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            top3PerCategory.push(item);
          }
        });
      });

      // Also include top 3 for any items not matching standard category IDs
      const uncategorizedItems = menuItems
        .filter((item) => !safeCategories.some((c) => c.id === item.category))
        .map((item) => ({
          ...item,
          soldCount: Number(itemSales?.[item.id] ?? itemSales?.[item.name] ?? 0),
        }))
        .filter((item) => item.soldCount > 0)
        .sort((a, b) => b.soldCount - a.soldCount)
        .slice(0, 3);

      uncategorizedItems.forEach((item) => {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          top3PerCategory.push(item);
        }
      });

      // Sort all combined top category items by sales descending
      top3PerCategory.sort((a, b) => b.soldCount - a.soldCount);

      // Identify the #1 overall best seller across all categories
      const topOverallId = top3PerCategory.length > 0 && top3PerCategory[0].soldCount > 0
        ? top3PerCategory[0].id
        : null;

      return top3PerCategory
        .map((item) => ({
          ...item,
          isTopBestSeller: item.id === topOverallId,
        }))
        .filter((item) => {
          if (normalizedMenuSearch && !item.name.toLowerCase().includes(normalizedMenuSearch)) {
            return false;
          }
          return true;
        });
    }
    // For standard categories: find the #1 best seller of this specific category
    const categoryItems = menuItems
      .filter((item) => item.category === activeCategory)
      .map((item) => ({
        ...item,
        soldCount: Number(itemSales?.[item.id] ?? itemSales?.[item.name] ?? 0),
      }));

    let topCategoryItemId = null;
    let maxCategorySold = 0;
    categoryItems.forEach((item) => {
      if (item.soldCount > maxCategorySold) {
        maxCategorySold = item.soldCount;
        topCategoryItemId = item.id;
      }
    });

    return categoryItems
      .map((item) => ({
        ...item,
        isTopBestSeller: maxCategorySold > 0 && item.id === topCategoryItemId,
      }))
      .filter((item) =>
        !normalizedMenuSearch || item.name.toLowerCase().includes(normalizedMenuSearch)
      );
  }, [menuItems, safeCategories, activeCategory, isBestSellerCategory, normalizedMenuSearch, itemSales]);
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
  const hasServedOrders = tableOrders.length > 0 && tableOrders.every(
    (o) => o.status === 'SERVED' || o.status === 'COMPLETED',
  );
  // Only show bill out if food is served and there are actually served orders
  const showBillOut = hasServedOrders && tableOrders.length > 0;

  function addItem(item, qty = 1, notes = '') {
    // Trigger cart badge pop animation
    setCartBadgePop(false);
    requestAnimationFrame(() => setCartBadgePop(true));
    setCart((previous) => {
      const existing = previous.find((entry) => entry.id === item.id);
      if (existing) {
        return previous.map((entry) =>
          entry.id === item.id
            ? { ...entry, qty: entry.qty + qty, notes: notes || entry.notes || '' }
            : entry,
        );
      }
      return [...previous, { ...item, qty, notes }];
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
        ...(item.notes ? { notes: item.notes } : {}),
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

  function openBillOutModal() {
    if (billOutRequesting || billOutRequested || !selectedTable) return;
    setShowBillOutModal(true);
  }

  async function handleConfirmBillOut() {
    if (billOutRequesting || !selectedTable) return;
    setBillOutRequesting(true);
    await requestTableBillOut(selectedTable.table_number, selectedBillOutMethod);
    setBillOutRequested(true);
    setBillOutRequesting(false);
    setShowBillOutModal(false);
  }

  async function handleConfirmAssistance(details) {
    if (assistanceSubmitting || !selectedTable) return;
    setAssistanceSubmitting(true);
    await requestTableAssistance(selectedTable.table_number, details);
    setAssistanceSubmitting(false);
    setShowAssistanceModal(false);
    setAssistanceFeedback('✓ Staff has been notified and is heading to your table!');
    setTimeout(() => setAssistanceFeedback(null), 4000);
  }

  async function handleCancelAssistance() {
    if (assistanceSubmitting || !selectedTable) return;
    setAssistanceSubmitting(true);
    await resolveTableAssistance(selectedTable.table_number);
    setAssistanceSubmitting(false);
    setShowAssistanceModal(false);
    setAssistanceFeedback('Assistance request cancelled.');
    setTimeout(() => setAssistanceFeedback(null), 3000);
  }

  function openDetailModal(item) {
    if (!item.soldOut && item.status !== 'SOLD OUT') setDetailItem(item);
  }

  // Auto-close detail modal if the item goes sold out while browsing
  useEffect(() => {
    if (detailItem) {
      const live = menuItems.find((m) => m.id === detailItem.id);
      if (live?.soldOut || live?.status === 'SOLD OUT') {
        setDetailItem(null);
      }
    }
  }, [menuItems, detailItem]);

  function closeDetailModal() {
    setDetailItem(null);
  }

  function addFromDetailModal(item, qty, notes) {
    addItem(item, qty, notes);
    closeDetailModal();
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
          <span
            key={cartCount}
            className={`customer-cart-count-badge${cartBadgePop ? ' badge-pop' : ''}`}
            aria-label={`${cartCount} items in cart`}
          >
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
            const isCartSoldOut  = cartSoldOutIds.has(item.id);
            const isProblematic  = isUnavailable || isCartSoldOut;
            return (
              <div
                key={item.id}
                className={`customer-cart-item ${isProblematic ? 'is-problematic' : ''} ${isCartSoldOut ? 'is-sold-out' : ''}`}
                style={isProblematic ? { border: '1.5px solid #fecaca', background: '#fef2f2', borderRadius: 8 } : {}}
              >
                <div className="customer-cart-item-info">
                  <span className="customer-cart-item-name">
                    {item.name}
                    {isCartSoldOut && (
                      <span style={{ marginLeft: 6, fontSize: '.72rem', color: '#dc2626', fontWeight: 700 }}>
                        SOLD OUT
                      </span>
                    )}
                    {!isCartSoldOut && isUnavailable && (
                      <span style={{ marginLeft: 6, fontSize: '.72rem', color: '#dc2626', fontWeight: 700 }}>
                        UNAVAILABLE
                      </span>
                    )}
                  </span>
                  <span className="customer-cart-item-price">{formatPrice(item.price)} each</span>
                  {item.notes && (
                    <span className="customer-cart-item-notes" title={item.notes}>📝 {item.notes}</span>
                  )}
                </div>
                <div className="customer-cart-controls" role="group" aria-label={`Quantity for ${item.name}`}>
                  <button onClick={() => removeItem(item.id)} aria-label={`Remove one ${item.name}`} type="button">−</button>
                  <span className="qty-display" aria-label={`${item.qty} of ${item.name}`}>{item.qty}</span>
                  <button onClick={() => addItem(item)} aria-label={`Add one more ${item.name}`} type="button" disabled={isCartSoldOut}>+</button>
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

      {/* Served state / Bill Out — hidden on mobile (mobile bar handles it) */}
      {showBillOut && (
        <div className={`customer-served-state${isInline ? ' customer-sidebar-mobile-hidden' : ''}`}>
          <span className="customer-served-emoji">🍽️</span>
          <p className="customer-served-title">Food has been served!</p>
          <p className="customer-served-subtitle">Enjoy your meal. Ready to pay?</p>
          {billOutRequested ? (
            <div className="customer-billout-requested" aria-live="polite">
              ✓ Bill requested ({selectedBillOutMethod === 'qr' ? 'InstaPay QR' : selectedBillOutMethod === 'credit' ? 'Credit Card' : 'Cash'}) — Staff is heading to your table
            </div>
          ) : (
            <button
              type="button"
              className="customer-billout-button"
              onClick={openBillOutModal}
              disabled={billOutRequesting}
              aria-label="Request bill out"
            >
              {billOutRequesting ? 'Sending…' : '🧾 Request Bill Out'}
            </button>
          )}
        </div>
      )}

      {/* Pending banner — hidden on mobile (mobile bar handles it) */}
      {hasPendingRequest && (
        <div className={`customer-request-banner${isInline ? ' customer-sidebar-mobile-hidden' : ''}`} role="status" aria-live="polite">
          ⏳ Your order is being verified — please wait.
        </div>
      )}

      {/* Submit button — hidden on mobile via customer-submit-button-inline (mobile bar handles it) */}
      <button
        className={`customer-submit-button ${isInline ? 'customer-submit-button-inline' : ''}`}
        onClick={submitRequest}
        disabled={cart.length === 0 || submitting || hasPendingRequest || cartSoldOutIds.size > 0}
        aria-label={submitting ? 'Sending order…' : 'Place order'}
        type="button"
      >
        {submitting ? 'Sending…' : hasPendingRequest ? '⏳ Order Pending…' : cartSoldOutIds.size > 0 ? '⚠ Remove Sold-Out Items' : '✓ Mark Pending'}
      </button>
    </div>
  );

  return (
    <div className="customer-app" aria-label={`Customer ordering interface for Table ${selectedTable?.table_number || parsedTableId}`}>

      {/* ── Sold-Out Toast Notification ── */}
      {soldOutToast.length > 0 && (
        <SoldOutToast
          items={soldOutToast}
          onDismiss={() => setSoldOutToast([])}
        />
      )}

      {/* ── Pending Verification Modal (minimizable) ── */}
      {hasPendingRequest && (
        <CustomerPendingModal
          request={activeRequest}
          isMinimized={isPendingMinimized}
          onToggleMinimize={() => setIsPendingMinimized((v) => !v)}
        />
      )}

      {/* ── Unavailable Alert Modal (blocks screen) ── */}
      {hasUnavailableRequest && (
        <CustomerUnavailableModal
          request={activeRequest}
          onModify={handleModifyAfterUnavailable}
        />
      )}

      {/* ── Bill Out Payment Method Modal ── */}
      <CustomerBillOutModal
        isOpen={showBillOutModal}
        onClose={() => setShowBillOutModal(false)}
        onConfirm={handleConfirmBillOut}
        selectedMethod={selectedBillOutMethod}
        onSelectMethod={setSelectedBillOutMethod}
        submitting={billOutRequesting}
        totalAmount={tableOrders.reduce((s, o) => s + Number(o.total || o.subtotal || 0), 0) || Number(dbTable?.total_bill ?? dbTable?.current_bill ?? 0)}
        formatPrice={formatPrice}
      />

      {/* ── Table Assistance Modal ── */}
      <CustomerAssistanceModal
        isOpen={showAssistanceModal}
        onClose={() => setShowAssistanceModal(false)}
        onConfirm={handleConfirmAssistance}
        submitting={assistanceSubmitting}
        tableNumber={selectedTable?.table_number || parsedTableId}
        isAlreadyRequested={isAssistanceRequested}
        onCancelRequest={handleCancelAssistance}
      />

      {/* ── Item Detail Modal ── */}
      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          formatPrice={formatPrice}
          onClose={closeDetailModal}
          onAdd={addFromDetailModal}
        />
      )}

      {/* ── Header ── */}
      <header className="customer-topbar">
        <div>
          <p className="customer-kicker">Customer Interface</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0 }}>Table #{String(selectedTable.table_number).padStart(2, '0')}</h1>
            {activeOrderDishes.length > 0 && (
              <button
                type="button"
                className="customer-topbar-order-badge"
                onClick={() => {
                  document.getElementById('customer-order-status')?.scrollIntoView({ behavior: 'smooth' });
                }}
                aria-label="View live order status"
              >
                🍳 {activeOrderServedCount}/{activeOrderDishes.length} ready ↓
              </button>
            )}
          </div>
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
                className={`customer-category-button ${category.isBestSeller ? 'customer-category-button--best-seller' : ''} ${activeCategory === category.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category.id)}
                ref={activeCategory === category.id ? activeCategoryRef : null}
                role="tab"
                aria-selected={activeCategory === category.id}
                aria-label={`Category: ${category.name}`}
                type="button"
              >
                {category.name}
              </button>
            ))}
          </nav>

          <div className="customer-menu-search-row">
            <input
              className="customer-menu-search"
              type="search"
              placeholder="Search menu items..."
              aria-label="Search menu items"
              value={menuSearch}
              onChange={(event) => setMenuSearch(event.target.value)}
            />
          </div>

          {/* Menu grid — key on activeCategory triggers stagger animation on category switch */}
          <div
            key={activeCategory}
            className="customer-menu-grid"
            role="list"
            aria-label={`Menu items in ${categories.find(c => c.id === activeCategory)?.name || 'selected category'}`}
          >
            {visibleItems.map((item, index) => {
              const isSoldOut   = item.soldOut || item.status === 'SOLD OUT';
              const isUnavail   = unavailableItemIds.has(item.id) || unavailableItemIds.has(item.name);
              const isDisabled  = isSoldOut || isUnavail;
              return (
                <article
                  key={item.id}
                  className={`customer-menu-card ${isDisabled ? 'is-disabled' : ''} ${isSoldOut ? 'is-sold-out' : ''} ${item.isTopBestSeller ? 'customer-menu-card--bestseller' : ''}`}
                  onClick={() => !isDisabled && openDetailModal(item)}
                  role="listitem"
                  aria-label={`${item.name}, ${formatPrice(item.price)}${isSoldOut ? ', sold out' : isUnavail ? ', unavailable' : ''}`}
                >
                  <MenuImageDisplay src={item.imageUrl} alt={item.name} soldOut={isSoldOut} unavailable={!isSoldOut && isUnavail} />
                  <div className="customer-menu-body">
                    {item.isTopBestSeller && item.soldCount > 0 && (
                      <div className="customer-menu-bestseller-rank">
                        🔥 #1 Best Seller · {item.soldCount} sold
                      </div>
                    )}
                    <span className="customer-menu-name">
                      {item.name}
                    </span>
                    <div className="customer-menu-meta-row">
                      <span className="customer-menu-price" aria-label={`Price: ${formatPrice(item.price)}`}>
                        {formatPrice(item.price)}
                      </span>
                      {isSoldOut && (
                        <span className="customer-menu-status-badge customer-menu-badge-soldout">
                          Sold Out
                        </span>
                      )}
                      {!isSoldOut && isUnavail && (
                        <span className="customer-menu-status-badge customer-menu-badge-unavail">
                          Unavailable
                        </span>
                      )}
                    </div>
                    <button
                      className="customer-menu-add-btn"
                      onClick={(event) => { event.stopPropagation(); addItem(item); }}
                      aria-label={isDisabled ? `${item.name} is ${isSoldOut ? 'sold out' : 'unavailable'}` : `Add ${item.name} to order`}
                      type="button"
                      disabled={isDisabled}
                    >
                      {isDisabled ? (isSoldOut ? '✕ Sold Out' : '⚠ Unavailable') : <><PlusIcon /> Add to Order</>}
                    </button>
                  </div>
                </article>
              );
            })}

            {visibleItems.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#64748b', padding: '48px 20px', background: '#fff', borderRadius: 16, border: '1px dashed #cbd5e1' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔥</div>
                <h3 style={{ margin: '0 0 6px', color: '#0f172a', fontSize: '1.15rem' }}>No Best Sellers Recorded Yet</h3>
                <p style={{ margin: 0, fontSize: '0.88rem' }}>Items will automatically appear here ranked by sales as orders are placed.</p>
              </div>
            )}
          </div>
        </section>

        {/* ── Sidebar (Desktop right column, Mobile stacked below menu) ── */}
        <aside className="customer-sidebar">
          {tableOrders.length > 0 && (
            <div className="customer-sidebar-order-status" id="customer-order-status">
              <OrderStatusPanel
                tableOrders={tableOrders}
                orderItems={safeOrderItems}
                formatPrice={formatPrice}
              />
            </div>
          )}
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
            onClick={openBillOutModal}
            disabled={billOutRequesting}
          >
            {billOutRequesting ? 'Sending…' : '🧾 Request Bill Out'}
          </button>
        )}
        {showBillOut && billOutRequested && (
          <div className="customer-billout-requested">
            ✓ Bill requested ({selectedBillOutMethod === 'qr' ? 'InstaPay QR' : selectedBillOutMethod === 'credit' ? 'Credit Card' : 'Cash'}) — Staff is heading to your table
          </div>
        )}

        <button
            className="customer-submit-button"
            onClick={submitRequest}
            disabled={cart.length === 0 || submitting || hasPendingRequest || cartSoldOutIds.size > 0}
            aria-label={submitting ? 'Sending order…' : 'Place order'}
            type="button"
          >
            {submitting
              ? 'Sending…'
              : hasPendingRequest
              ? '⏳ Order Pending…'
              : cartSoldOutIds.size > 0
              ? '⚠ Remove Sold-Out Items'
              : cartCount > 0
              ? `✓ Mark Pending (${cartCount})`
              : 'Select Items to Order'}
          </button>
      </div>

      {/* ── Floating Ask for Assistance Button ── */}
      <button
        type="button"
        className={`customer-assistance-fab ${isAssistanceRequested ? 'active' : ''} ${showBillOut && !billOutRequested ? 'has-billout' : ''}`}
        onClick={() => setShowAssistanceModal(true)}
        aria-label={isAssistanceRequested ? 'Assistance requested. Click to view or cancel' : 'Ask for assistance'}
        title={isAssistanceRequested ? 'Assistance requested · Staff notified' : 'Ask for assistance'}
      >
        <span className="customer-assistance-fab-bell">🛎️</span>
        <span className="customer-assistance-fab-text">
          {isAssistanceRequested ? 'Assistance Requested' : 'Ask for Assistance'}
        </span>
        {isAssistanceRequested && <span className="customer-assistance-fab-pulse" />}
      </button>

      {/* ── Assistance Toast Notification ── */}
      {assistanceFeedback && (
        <div className="customer-assistance-toast" role="status" aria-live="polite">
          {assistanceFeedback}
        </div>
      )}
    </div>
  );
}
