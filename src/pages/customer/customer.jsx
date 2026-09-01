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

export default function Customer() {
  const navigate = useNavigate();
  const { tableId } = useParams();
  const {
    tables,
    menuItems: dbMenuItems,
    categories: dbCategories,
    customerRequests,
    createCustomerRequest,
    formatPrice,
    loading,
  } = usePOS();

  const safeTables = Array.isArray(tables) ? tables : [];
  const safeCustomerRequests = Array.isArray(customerRequests) ? customerRequests : [];
  const safeMenuItems = Array.isArray(dbMenuItems) ? dbMenuItems : [];
  const safeCategories = Array.isArray(dbCategories) ? dbCategories : [];

  const parsedTableId = Number(String(tableId || '').replace(/[^0-9]/g, ''));
  const selectedTable = safeTables.find((table) => table.table_number === parsedTableId);

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
  const [submitting, setSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  // Controls mobile cart panel visibility (cart slides up on mobile)
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

  const activeCategory = selectedCategory || categories[0]?.id;
  const visibleItems = menuItems.filter((item) => item.category === activeCategory);
  const hasPendingRequest = safeCustomerRequests.some(
    (request) => request.table_number === parsedTableId && request.status === 'PENDING',
  );
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const now = new Date(currentTime);

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
      setShowMobileCart(false);
    } else {
      console.error('Error creating customer request:', error);
    }
    setSubmitting(false);
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

  // ── Cart panel (shared between desktop sidebar and mobile bottom panel) ──────
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
          cart.map((item) => (
            <div key={item.id} className="customer-cart-item">
              <div className="customer-cart-item-info">
                <span className="customer-cart-item-name">{item.name}</span>
                <span className="customer-cart-item-price">{formatPrice(item.price)} each</span>
              </div>
              <div className="customer-cart-controls" role="group" aria-label={`Quantity for ${item.name}`}>
                <button
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove one ${item.name}`}
                  type="button"
                >
                  −
                </button>
                <span className="qty-display" aria-label={`${item.qty} of ${item.name}`}>
                  {item.qty}
                </span>
                <button
                  onClick={() => addItem(item)}
                  aria-label={`Add one more ${item.name}`}
                  type="button"
                >
                  +
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="customer-summary" aria-label="Order summary">
        <div className="customer-summary-row">
          <span className="customer-summary-label">Subtotal</span>
          <span className="customer-summary-value">{formatPrice(subtotal)}</span>
        </div>
      </div>

      {hasPendingRequest && (
        <div className="customer-request-banner" role="status" aria-live="polite">
          ⏳ A request for this table is already waiting for cashier approval.
        </div>
      )}

      <button
        className={`customer-submit-button ${isInline ? 'customer-submit-button-inline' : ''}`}
        onClick={submitRequest}
        disabled={cart.length === 0 || submitting || hasPendingRequest}
        aria-label={submitting ? 'Sending order…' : 'Place order'}
        type="button"
      >
        {submitting ? 'Sending…' : '✓ Complete Order'}
      </button>
    </div>
  );

  return (
    <div className="customer-app" aria-label={`Customer ordering interface for Table ${selectedTable.table_number}`}>

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
            {visibleItems.map((item) => (
              <article key={item.id} className="customer-menu-card" role="listitem" aria-label={`${item.name}, ${formatPrice(item.price)}`}>
                <span className="customer-menu-image" aria-hidden="true">
                  <MenuImagePlaceholder />
                </span>
                <div className="customer-menu-body">
                  <span className="customer-menu-name">{item.name}</span>
                  <span className="customer-menu-price" aria-label={`Price: ${formatPrice(item.price)}`}>
                    {formatPrice(item.price)}
                  </span>
                  <button
                    className="customer-menu-add-btn"
                    onClick={() => addItem(item)}
                    aria-label={`Add ${item.name} to order`}
                    type="button"
                  >
                    <PlusIcon /> Add to Order
                  </button>
                </div>
              </article>
            ))}

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
            ⏳ A request for this table is awaiting cashier approval.
          </div>
        )}
        <button
          className="customer-submit-button"
          onClick={submitRequest}
          disabled={cart.length === 0 || submitting || hasPendingRequest}
          aria-label={submitting ? 'Sending order…' : 'Place order'}
          type="button"
        >
          {submitting ? 'Sending…' : cartCount > 0 ? `✓ Place Order (${cartCount})` : 'Select Items to Order'}
        </button>
      </div>
    </div>
  );
}
