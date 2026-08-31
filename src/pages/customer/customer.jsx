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

function useFixedInterfaceCanvas() {
  const [, refreshScale] = useState(0);

  useEffect(() => {
    const updateScale = () => refreshScale((version) => version + 1);
    window.addEventListener('resize', updateScale);
    window.visualViewport?.addEventListener('resize', updateScale);
    return () => {
      window.removeEventListener('resize', updateScale);
      window.visualViewport?.removeEventListener('resize', updateScale);
    };
  }, []);

  if (typeof window === 'undefined') return { scale: 1, width: '100%', height: '100vh' };

  const pixelRatio = window.devicePixelRatio || 1;
  return {
    scale: 1 / pixelRatio,
    width: `${Math.round(window.innerWidth * pixelRatio)}px`,
    height: `${Math.round(window.innerHeight * pixelRatio)}px`,
  };
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

  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0].id);
    }
  }, [categories, selectedCategory]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const interfaceCanvas = useFixedInterfaceCanvas();
  const activeCategory = selectedCategory || categories[0]?.id;
  const visibleItems = menuItems.filter((item) => item.category === activeCategory);
  const hasPendingRequest = safeCustomerRequests.some(
    (request) => request.table_number === parsedTableId && request.status === 'PENDING',
  );
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
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
    } else {
      console.error('Error creating customer request:', error);
    }
    setSubmitting(false);
  }

  if (loading) {
    return <div className="customer-app customer-loading">Loading...</div>;
  }

  if (!selectedTable) {
    return (
      <div className="customer-app customer-loading">
        <div className="customer-invalid-card">
          <h1>Table not found</h1>
          <p>This QR code is not linked to an active restaurant table.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="customer-app"
      style={{
        '--customer-scale': interfaceCanvas.scale,
        width: interfaceCanvas.width,
        height: interfaceCanvas.height,
        minHeight: interfaceCanvas.height,
      }}
    >
      <header className="customer-topbar">
        <div>
          <p className="customer-kicker">Customer Interface</p>
          <h1>Table #{String(selectedTable.table_number).padStart(2, '0')}</h1>
        </div>
        <div className="customer-topbar-meta">
          <span>
            {now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
          <span>
            {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
          </span>
        </div>
      </header>

      <main className="customer-main">
        <section className="customer-menu-panel">
          <div className="customer-category-row">
            {categories.map((category) => (
              <button
                key={category.id}
                className={`customer-category-button ${activeCategory === category.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>

          <div className="customer-menu-grid">
            {visibleItems.map((item) => (
              <button key={item.id} className="customer-menu-card" onClick={() => addItem(item)}>
                <span className="customer-menu-image"><MenuImagePlaceholder /></span>
                <span className="customer-menu-name">{item.name}</span>
                <span className="customer-menu-price">{formatPrice(item.price)}</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="customer-sidebar">
          <div className="customer-sidebar-card">
            <div className="customer-sidebar-heading">
              <div>
                <p className="customer-kicker">Current Selection</p>
                <h2>Your Order</h2>
              </div>
              <button type="button" className="customer-back-button" onClick={() => navigate(-1)} aria-label="Exit customer interface">
                ×
              </button>
            </div>

            <div className="customer-cart-list">
              {cart.length === 0 ? (
                <div className="customer-empty-state">Select items from the menu.</div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="customer-cart-item">
                    <div>
                      <strong>{item.name}</strong>
                      <span>{formatPrice(item.price)} each</span>
                    </div>
                    <div className="customer-cart-controls">
                      <button onClick={() => removeItem(item.id)} aria-label={`Decrease ${item.name}`}>−</button>
                      <span>{item.qty}</span>
                      <button onClick={() => addItem(item)} aria-label={`Increase ${item.name}`}>+</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="customer-summary">
              <div>
                <span>Subtotal</span>
                <strong>{formatPrice(subtotal)}</strong>
              </div>
            </div>

            {hasPendingRequest && (
              <div className="customer-request-banner">
                A request for this table is already waiting for cashier approval.
              </div>
            )}

            <button
              className="customer-submit-button"
              onClick={submitRequest}
              disabled={cart.length === 0 || submitting || hasPendingRequest}
            >
              {submitting ? 'Sending...' : 'Complete Order'}
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}
