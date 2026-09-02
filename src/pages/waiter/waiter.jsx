/**
 * Waiter Interface (waiter.jsx)
 * 
 * This component provides the UI for floor staff to take customer orders.
 * It pulls live data (menu items, categories, and table statuses) from POSContext.
 * Orders taken here are kept in local state ("the cart") until they are punched.
 * Punching an order sends it to the Supabase database via POSContext.
 */

import { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePOS } from '../../context/POSContext';
import './waiter.css';

/** Helper to strip quotes from URL query parameters */
const unquoteQueryValue = (value) => (value ?? '').replace(/^"|"$/g, '');

/** SVG Placeholder for menu items without images */
function MenuImagePlaceholder() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m4 18 5-5 3 3 3-4 5 6" />
    </svg>
  );
}

/** 
 * Custom hook to calculate the exact viewport scale and dimensions.
 * This prevents UI breakage on devices with different pixel ratios.
 */
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

export default function Waiter() {
  const navigate = useNavigate();
  const location = useLocation();

  // --- Global State ---
  const {
    tables: dbTables,
    menuItems: dbMenuItems,
    categories: dbCategories,
    orders,
    orderItems,
    getOrdersForTable,
    getItemsForOrder,
    createOrder,
    loading,
    formatPrice,
  } = usePOS();

  // --- Data Mapping ---
  const categories = useMemo(() =>
    dbCategories.map((c) => ({ id: c.id, name: c.name })),
    [dbCategories]
  );

  const menuItemsMapped = useMemo(() =>
    dbMenuItems.map((m) => ({
      id: m.id,
      name: m.name,
      price: Number(m.price),
      category: m.category_id,
      image_url: m.image_url,
    })),
    [dbMenuItems]
  );

  const tableMappings = useMemo(() =>
    dbTables.map((t) => ({
      id: t.table_number,
      label: String(t.table_number).padStart(2, '0'),
      dbId: t.id,
      status: t.status,
      table_number: t.table_number,
    })),
    [dbTables]
  );

  // --- Local State ---
  const [carts, setCarts] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [search, setSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showTableSwitcher, setShowTableSwitcher] = useState(false);
  const [pendingTableId, setPendingTableId] = useState(null);
  const [showUnsavedOrderModal, setShowUnsavedOrderModal] = useState(false);
  const [showClearOrderModal, setShowClearOrderModal] = useState(false);
  const [showPunchOrderModal, setShowPunchOrderModal] = useState(false);
  const [punchingOrder, setPunchingOrder] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const routeCategory = unquoteQueryValue(new URLSearchParams(location.search).get('category'));

  // --- Category and Routing Sync ---
  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0].id);
    }
  }, [categories, selectedCategory]);

  const activeCategory = categories.find((c) => c.id === routeCategory)
    ? routeCategory
    : (selectedCategory || (categories[0]?.id ?? ''));

  const tableFromRoute = Number(location.pathname.match(/\/table-(\d+)$/)?.[1]);
  const selectedId = tableMappings.some((t) => t.id === tableFromRoute) ? tableFromRoute : (tableMappings[0]?.id ?? 1);
  const selected = tableMappings.find((t) => t.id === selectedId) || tableMappings[0];

  const cart = carts[selectedId] || [];

  // --- DB Order & Items Extraction ---
  const existingOrders = useMemo(() => {
    if (!selected) return [];
    return getOrdersForTable(selected.table_number);
  }, [selected, getOrdersForTable, orders]);

  const existingItems = useMemo(() => {
    return existingOrders.flatMap((o) => getItemsForOrder(o.id));
  }, [existingOrders, getItemsForOrder, orderItems]);

  // --- Total & Discount Calculations ---
  const existingItemsTotal = existingItems.reduce((sum, item) => {
    const price = Number(item.price ?? item.unit_price ?? item.item_price ?? 0);
    const qty = Number(item.quantity ?? item.qty ?? 1);
    return sum + (price * qty);
  }, 0);

  const cartItemsTotal = cart.reduce((sum, item) => sum + (Number(item.price) * Number(item.qty)), 0);
  const subtotal = existingItemsTotal + cartItemsTotal;

  // Extract total discounts applied to orders or individual order items with full fallbacks
  const discountAmount = useMemo(() => {
    const orderDiscounts = existingOrders.reduce((sum, order) => {
      // 1. Direct fixed discount amount on order
      const fixedDiscount = Number(
        order.discount ??
        order.discount_amount ??
        order.total_discount ??
        order.discount_val ??
        0
      );

      // 2. Percentage-based discount calculation on order
      const percentRate = Number(order.discount_percentage ?? order.discount_percent ?? order.discount_rate ?? 0);
      const calculatedPercentDiscount = percentRate > 0 ? (existingItemsTotal * (percentRate / 100)) : 0;

      return sum + fixedDiscount + calculatedPercentDiscount;
    }, 0);

    const itemDiscounts = existingItems.reduce((sum, item) => {
      return sum + Number(item.discount ?? item.discount_amount ?? 0);
    }, 0);

    return orderDiscounts + itemDiscounts;
  }, [existingOrders, existingItems, existingItemsTotal]);

  const finalTotal = Math.max(0, subtotal - discountAmount);

  // --- Filtering & Formatting ---
  const visibleItems = menuItemsMapped.filter(
    (item) => item.category === activeCategory && item.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  const searchMatches = search.trim()
    ? menuItemsMapped.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 6)
    : [];

  const now = new Date(currentTime);
  const interfaceCanvas = useFixedInterfaceCanvas();
  const isUnsaved = cart.length > 0;

  const waiterPath = (category = activeCategory, tableId = selectedId) => `/waiter/menu-ordering/table-${tableId}?category="${category}"`;

  useEffect(() => {
    if (!location.pathname.startsWith('/waiter/menu-ordering/table-') || !routeCategory) {
      navigate(`/waiter/menu-ordering/table-${selectedId}?category="${activeCategory}"`, { replace: true });
    }
  }, [location.pathname, routeCategory, activeCategory, selectedId, navigate]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Action Handlers ---
  function chooseCategory(categoryId) {
    setSelectedCategory(categoryId);
    setSearch('');
    setIsSearchOpen(false);
    navigate(waiterPath(categoryId));
  }

  function addItem(item) {
    setCarts((prev) => {
      const currentCart = prev[selectedId] || [];
      const existing = currentCart.find((ci) => ci.id === item.id);
      const updatedCart = existing
        ? currentCart.map((ci) => ci.id === item.id ? { ...ci, qty: ci.qty + 1 } : ci)
        : [...currentCart, { ...item, qty: 1 }];
      return { ...prev, [selectedId]: updatedCart };
    });
  }

  function removeItem(itemId) {
    setCarts((prev) => {
      const currentCart = prev[selectedId] || [];
      const updatedCart = currentCart.flatMap((item) => {
        if (item.id !== itemId) return item;
        if (item.qty <= 1) return [];
        return { ...item, qty: item.qty - 1 };
      });
      return { ...prev, [selectedId]: updatedCart };
    });
  }

  function clearOrder() {
    setCarts((prev) => ({ ...prev, [selectedId]: [] }));
    setShowClearOrderModal(false);
  }

  async function punchOrder() {
    if (!selected || cart.length === 0 || punchingOrder) return;
    setPunchingOrder(true);
    try {
      await createOrder(selected.table_number, 'Waiter', cart.map((item) => ({
        id: item.id,
        menu_item_id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.qty,
      })), 'DINE-IN');

      setCarts((prev) => ({ ...prev, [selectedId]: [] }));
    } catch (err) {
      console.error('Error punching order:', err);
    } finally {
      setPunchingOrder(false);
      setShowPunchOrderModal(false);
    }
  }

  function requestTableSwitch(tableId) {
    setShowTableSwitcher(false);
    if (tableId === selectedId) return;

    if (isUnsaved) {
      setPendingTableId(tableId);
      setShowUnsavedOrderModal(true);
      return;
    }
    navigate(waiterPath(activeCategory, tableId));
  }

  function dismissUnsavedOrder() {
    setShowUnsavedOrderModal(false);
    setPendingTableId(null);
  }

  function discardAndSwitch() {
    const nextTableId = pendingTableId;
    setCarts((prev) => ({ ...prev, [selectedId]: [] }));
    dismissUnsavedOrder();
    navigate(waiterPath(activeCategory, nextTableId));
  }

  if (loading) {
    return (
      <div className="cashier-app waiter-app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#fff', fontSize: '1.2rem' }}>
        Loading…
      </div>
    );
  }

  return (
    <div
      className="cashier-app waiter-app"
      style={{
        '--cashier-scale': interfaceCanvas.scale,
        '--cashier-canvas-height': interfaceCanvas.height,
        width: interfaceCanvas.width,
        height: interfaceCanvas.height,
        minHeight: interfaceCanvas.height,
      }}
    >
      {/* Header */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </div>
          <div className="brand-text">Waiter Interface</div>
        </div>
        <div className="topbar-right">
          <span className="date-time">
            {now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}, {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
          </span>
          <button className="return-button" onClick={() => navigate('/')} aria-label="Return to interface selector">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="tab-group" aria-label="Waiter section">
        <button className="tab active" type="button">MENU ORDERING</button>
      </nav>

      {/* Main Workspace */}
      <main className="main menu-ordering-main">
        <section className="menu-ordering-workspace">
          {/* Categories Sidebar */}
          <aside className="menu-category-sidebar">
            <p className="menu-category-label">Categories</p>
            {categories.map((category) => (
              <button
                key={category.id}
                className={`menu-category-button ${activeCategory === category.id ? 'active' : ''}`}
                onClick={() => chooseCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </aside>

          {/* Menu Catalog & Grid */}
          <div className="menu-catalog">
            <div className="menu-search-row">
              <div className="menu-search-field">
                <input
                  className="menu-search-input"
                  type="search"
                  value={search}
                  placeholder="Search menu items..."
                  aria-label="Search menu items"
                  onFocus={() => setIsSearchOpen(true)}
                  onChange={(event) => { setSearch(event.target.value); setIsSearchOpen(true); }}
                />
                {isSearchOpen && searchMatches.length > 0 && (
                  <div className="menu-keyword-dropdown" role="listbox">
                    {searchMatches.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="menu-keyword-option"
                        onClick={() => {
                          setSearch(item.name);
                          setSelectedCategory(item.category);
                          setIsSearchOpen(false);
                          navigate(waiterPath(item.category));
                        }}
                      >
                        <span className="menu-keyword-image"><MenuImagePlaceholder /></span>
                        <span className="menu-keyword-details">
                          <strong>{item.name}</strong>
                          <small>{categories.find((category) => category.id === item.category)?.name}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="menu-item-grid">
              {visibleItems.map((item) => (
                <button key={item.id} className="menu-item-card" onClick={() => addItem(item)}>
                  <span className="menu-item-image"><MenuImagePlaceholder /></span>
                  <span className="menu-item-name">{item.name}</span>
                  <span className="menu-item-bottom">
                    <span className="menu-item-price">{formatPrice(item.price)}</span>
                    <span className="menu-item-add" aria-hidden="true">+</span>
                  </span>
                </button>
              ))}
            </div>

            <footer className="table-pagination menu-pagination">
              <span>{visibleItems.length ? `1–${visibleItems.length}` : '0'} of {visibleItems.length}</span>
              <div className="pagination-actions">
                <button disabled>◀ Previous</button>
                <span>1 / 1</span>
                <button disabled>Next ▶</button>
              </div>
            </footer>
          </div>
        </section>

        {/* Sidebar Order Summary */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <div>
              <div className="bill-title">Order details</div>
              <div className="bill-subtitle">Table #{selected?.label} · Dine-in</div>
            </div>
            <div className="bill-selection-controls">
              <div className="table-switcher">
                <button
                  type="button"
                  className="table-switcher-button"
                  aria-label="Switch table"
                  aria-expanded={showTableSwitcher}
                  aria-haspopup="listbox"
                  onClick={() => setShowTableSwitcher((isOpen) => !isOpen)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 7h11l-3-3" />
                    <path d="m18 7-3 3" />
                    <path d="M17 17H6l3 3" />
                    <path d="m6 17 3-3" />
                  </svg>
                </button>
                {showTableSwitcher && (
                  <div className="table-switcher-dropdown" role="listbox">
                    <p>Switch table</p>
                    <div className="table-switcher-options">
                      {tableMappings.map((table) => (
                        <button
                          key={table.id}
                          type="button"
                          role="option"
                          aria-selected={table.id === selectedId}
                          className={table.id === selectedId ? 'selected' : ''}
                          onClick={() => requestTableSwitch(table.id)}
                        >
                          <span>Table #{table.label}</span>
                          <small>{table.status === 'OCCUPIED' ? 'Occupied' : 'Empty'}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cart & DB Order Items */}
          <div className="items-list">
            {/* DB Punched Items */}
            {existingItems.map((item) => {
              const itemPrice = Number(item.price ?? item.unit_price ?? item.item_price ?? 0);
              const itemQty = Number(item.quantity ?? item.qty ?? 1);
              return (
                <div key={item.id} className="item-row">
                  <div>
                    <div className="item-name">{item.item_name || item.name} × {itemQty} <small style={{ opacity: 0.5 }}>✓</small></div>
                    <div className="item-note">Dine-in</div>
                  </div>
                  <div className="item-right">
                    <span>{formatPrice(itemPrice * itemQty)}</span>
                  </div>
                </div>
              );
            })}

            {/* Local Unpunched Cart Items */}
            {cart.map((item) => (
              <div key={item.id} className="item-row">
                <div>
                  <div className="item-name">{item.name} × {item.qty}</div>
                  <div className="item-note">Dine-in</div>
                </div>
                <div className="item-right">
                  <span>{formatPrice(Number(item.price) * Number(item.qty))}</span>
                  <button className="item-remove" onClick={() => removeItem(item.id)} aria-label={`Remove ${item.name}`}>−</button>
                </div>
              </div>
            ))}

            {cart.length === 0 && existingItems.length === 0 && (
              <div className="empty-items">No items yet. Add from below.</div>
            )}
          </div>

          {/* Summary Panel */}
          <div className="summary">
            <div className="summary-row">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="summary-row">
              <span>Discount</span>
              <span>-{formatPrice(discountAmount)}</span>
            </div>
            <div className="summary-total">
              <span>Total</span>
              <span>{formatPrice(finalTotal)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="sidebar-actions">
            <button className="clear-button" disabled={!cart.length} onClick={() => setShowClearOrderModal(true)}>
              <span className="button-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m7 16 9-9 3 3-9 9H7v-3Zm10.7-10.7 1.1-1.1a1 1 0 0 1 1.4 0l.6.6a1 1 0 0 1 0 1.4L19.7 7l-2-1.7Z" />
                </svg>
              </span>
              Clear
            </button>
            <button className="punch-order-button" disabled={!cart.length || punchingOrder} onClick={() => setShowPunchOrderModal(true)}>
              <span className="button-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 2v5h10V5H7Zm0 9v5h10v-5H7Z" />
                </svg>
              </span>
              {punchingOrder ? 'Punching...' : 'Punch Order'}
            </button>
          </div>
        </aside>
      </main>

      {/* Modals */}
      {showUnsavedOrderModal && (
        <div className="modal-backdrop" onClick={dismissUnsavedOrder}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <p className="modal-kicker">UNSAVED ORDER</p>
                <h2>Discard order changes?</h2>
              </div>
              <button className="modal-icon-close" onClick={dismissUnsavedOrder} aria-label="Close">×</button>
            </div>
            <p className="modal-description">This order has not been punched. Discard the items or keep ordering?</p>
            <div className="modal-actions">
              <button onClick={dismissUnsavedOrder}>Keep Ordering</button>
              <button className="modal-print" onClick={discardAndSwitch}>Discard Changes</button>
            </div>
          </div>
        </div>
      )}

      {showClearOrderModal && (
        <div className="modal-backdrop" onClick={() => setShowClearOrderModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <p className="modal-kicker">CLEAR ORDER</p>
                <h2>Clear order details?</h2>
              </div>
              <button className="modal-icon-close" onClick={() => setShowClearOrderModal(false)} aria-label="Close">×</button>
            </div>
            <p className="modal-description">This removes all selected items for Table #{selected?.label}.</p>
            <div className="modal-actions">
              <button onClick={() => setShowClearOrderModal(false)}>Cancel</button>
              <button className="modal-print" onClick={clearOrder}>Clear Order</button>
            </div>
          </div>
        </div>
      )}

      {showPunchOrderModal && (
        <div className="modal-backdrop" onClick={() => setShowPunchOrderModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <p className="modal-kicker">SAVE ORDER</p>
                <h2>Punch this order?</h2>
              </div>
              <button className="modal-icon-close" onClick={() => setShowPunchOrderModal(false)} aria-label="Close">×</button>
            </div>
            <p className="modal-description">Save the current order for Table #{selected?.label}?</p>
            <div className="modal-actions">
              <button onClick={() => setShowPunchOrderModal(false)}>Cancel</button>
              <button className="modal-print" onClick={punchOrder}>{punchingOrder ? 'Punching...' : 'Punch Order'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}