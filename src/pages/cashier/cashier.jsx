import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './cashier.css';

const initialTables = Array.from({ length: 16 }, (_, index) => {
  const id = index + 1;
  const label = String(id).padStart(2, '0');
  const activeData = {
  };
  return {
    id,
    label,
    occupied: activeData[id]?.occupied || false,
    startedAt: activeData[id]?.startedAt || null,
    minutes: activeData[id]?.minutes || '',
    guests: activeData[id]?.guests || 0,
    items: activeData[id]?.items || [],
    discount: activeData[id]?.discount || 0,
  };
});

const menuCategories = [
  { id: 'meals', name: 'Meals' },
  { id: 'drinks', name: 'Drinks' },
  { id: 'desserts', name: 'Desserts' },
  { id: 'snacks', name: 'Snacks' },
];

const menuItems = [
  { id: 1, name: 'Chicken Burger', price: 120, category: 'meals' },
  { id: 2, name: 'Beef Burger', price: 145, category: 'meals' },
  { id: 3, name: 'Grilled Chicken', price: 180, category: 'meals' },
  { id: 4, name: 'Pork Sisig', price: 160, category: 'meals' },
  { id: 5, name: 'Strawberry Shake', price: 75, category: 'drinks' },
  { id: 6, name: 'Coke', price: 40, category: 'drinks' },
  { id: 7, name: 'Iced Tea', price: 50, category: 'drinks' },
  { id: 8, name: 'Lemonade', price: 55, category: 'drinks' },
  { id: 9, name: 'Cheesecake Slice', price: 95, category: 'desserts' },
  { id: 10, name: 'Chocolate Cake', price: 90, category: 'desserts' },
  { id: 11, name: 'Fries', price: 60, category: 'snacks' },
  { id: 12, name: 'Nachos', price: 110, category: 'snacks' },
];

const menuItemSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
const unquoteQueryValue = (value) => (value ?? '').replace(/^"|"$/g, '');

function MenuImagePlaceholder() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m4 18 5-5 3 3 3-4 5 6" />
    </svg>
  );
}

function formatMoney(value) {
  return `₱${value.toFixed(2)}`;
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

function Cashier() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tables, setTables] = useState(initialTables);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPunchOrderModal, setShowPunchOrderModal] = useState(false);
  const [showClearOrderModal, setShowClearOrderModal] = useState(false);
  const [showDiscardOrderModal, setShowDiscardOrderModal] = useState(false);
  const [showTableSwitcher, setShowTableSwitcher] = useState(false);
  const [showCancelOrderModal, setShowCancelOrderModal] = useState(false);
  const [pendingTableId, setPendingTableId] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [customDiscount, setCustomDiscount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [canceledOrders, setCanceledOrders] = useState([]);
  const [reservedTables, setReservedTables] = useState([]);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const routeCategory = unquoteQueryValue(new URLSearchParams(location.search).get('category'));
  const routeItem = unquoteQueryValue(new URLSearchParams(location.search).get('item'));
  const routeMenuItem = menuItems.find((item) => menuItemSlug(item.name) === routeItem);
  const [selectedCategory, setSelectedCategory] = useState(() =>
    menuCategories.some((category) => category.id === routeCategory) ? routeCategory : menuCategories[0].id
  );
  const [menuSearch, setMenuSearch] = useState(() => routeMenuItem?.name ?? '');
  const [isMenuSearchOpen, setIsMenuSearchOpen] = useState(false);
  const interfaceCanvas = useFixedInterfaceCanvas();

  const isMenuOrdering = location.pathname.startsWith('/cashier/menu-ordering');
  const activeMenuCategory = isMenuOrdering && menuCategories.some((category) => category.id === routeCategory)
    ? routeCategory
    : selectedCategory;
  const requestedTableId = Number(location.pathname.match(/\/table-(\d+)$/)?.[1]);
  const selectedId = tables.some((table) => table.id === requestedTableId)
    ? requestedTableId
    : initialTables[0].id;
  const selected = tables.find((table) => table.id === selectedId);

  const subtotal = selected
    ? selected.items.reduce((sum, item) => sum + item.price * item.qty, 0)
    : 0;
  const discount = selected?.discount || 0;
  const total = +(subtotal - discount).toFixed(2);
  const tablesPerPage = 12;
  const totalTablePages = Math.ceil(tables.length / tablesPerPage);
  const requestedPage = Number(new URLSearchParams(location.search).get('page')) || 1;
  const currentTablePage = Math.min(Math.max(requestedPage, 1), totalTablePages);
  const pageStart = (currentTablePage - 1) * tablesPerPage;
  const visibleTables = tables.slice(pageStart, pageStart + tablesPerPage);
  const menuSearchTerm = menuSearch.trim().toLowerCase();
  const menuKeywordMatches = menuSearchTerm
    ? menuItems.filter((item) => item.name.toLowerCase().includes(menuSearchTerm)).slice(0, 6)
    : [];
  const visibleMenuItems = menuItems.filter((item) =>
    item.category === activeMenuCategory &&
    (!menuSearchTerm || item.name.toLowerCase().includes(menuSearchTerm))
  );
  const menuItemsPerPage = 8;
  const totalMenuPages = Math.max(1, Math.ceil(visibleMenuItems.length / menuItemsPerPage));
  const requestedMenuPage = Number(new URLSearchParams(location.search).get('page')) || 1;
  const currentMenuPage = Math.min(Math.max(requestedMenuPage, 1), totalMenuPages);
  const menuPageStart = (currentMenuPage - 1) * menuItemsPerPage;
  const pagedMenuItems = visibleMenuItems.slice(menuPageStart, menuPageStart + menuItemsPerPage);

  function cashierPath(section, tableId = selectedId, page = 1) {
    const path = `/cashier/${section}/table-${tableId}`;
    return page > 1 ? `${path}?page=${page}` : path;
  }

  function menuOrderingPath(categoryId = activeMenuCategory, item = null, page = 1, tableId = selectedId) {
    const path = `/cashier/menu-ordering/table-${tableId}`;
    const params = [`category="${categoryId}"`];
    if (item) params.push(`item="${menuItemSlug(item.name)}"`);
    if (page > 1) params.push(`page=${page}`);
    return `${path}?${params.join('&')}`;
  }

  function goToTablePage(page) {
    navigate(cashierPath('overview', selectedId, page));
  }

  function selectTable(tableId) {
    const page = Math.ceil(tableId / tablesPerPage);
    navigate(cashierPath('overview', tableId, page));
  }

  function goToMenuPage(page) {
    const exactItem = menuItems.find((item) => item.name.toLowerCase() === menuSearch.trim().toLowerCase());
    navigate(menuOrderingPath(activeMenuCategory, exactItem, page));
  }

  function selectCategory(categoryId) {
    setSelectedCategory(categoryId);
    setMenuSearch('');
    setIsMenuSearchOpen(false);
    navigate(menuOrderingPath(categoryId));
  }

  function selectMenuKeyword(item) {
    setSelectedCategory(item.category);
    setMenuSearch(item.name);
    setIsMenuSearchOpen(false);
    navigate(menuOrderingPath(item.category, item));
  }

  function addMenuItem(item) {
    setTables((prev) => prev.map((table) => {
      if (table.id !== selectedId) return table;
      const existing = table.items.find((orderItem) => orderItem.id === item.id);
      const items = existing
        ? table.items.map((orderItem) => orderItem.id === item.id ? { ...orderItem, qty: orderItem.qty + 1 } : orderItem)
        : [...table.items, { ...item, qty: 1 }];
      return { ...table, items, occupied: true, startedAt: table.startedAt || Date.now(), guests: table.guests || 1, punchedAt: null };
    }));
  }

  function removeItem(itemName) {
    setTables((prev) =>
      prev.map((table) => {
        if (table.id !== selectedId) return table;
        const items = table.items.filter((item) => item.name !== itemName);
        return {
          ...table,
          items,
          occupied: items.length > 0,
          minutes: items.length > 0 ? table.minutes : '',
          guests: items.length > 0 ? table.guests : 0,
          punchedAt: null,
        };
      })
    );
  }

  function openDiscountModal() {
    setCustomDiscount('');
    setShowDiscountModal(true);
  }

  function clearSelectedOrder() {
    if (!selectedId) return;
    setTables((prev) => prev.map((table) =>
      table.id === selectedId
        ? { ...table, occupied: false, startedAt: null, minutes: '', guests: 0, items: [], discount: 0, punchedAt: null }
        : table
    ));
  }

  function requestClearOrder() {
    if (selected?.items.length) setShowClearOrderModal(true);
  }

  function punchOrder() {
    if (!selectedId || !selected?.items.length) return;
    setTables((prev) => prev.map((table) =>
      table.id === selectedId ? { ...table, punchedAt: Date.now() } : table
    ));
  }

  function requestPunchOrder() {
    if (selected?.items.length) setShowPunchOrderModal(true);
  }

  function goToOverview() {
    navigate(cashierPath('overview', selectedId, Math.ceil(selectedId / tablesPerPage)));
  }

  function requestOverview() {
    if (isMenuOrdering && selected?.items.length && !selected.punchedAt) {
      setShowDiscardOrderModal(true);
      return;
    }
    goToOverview();
  }

  function discardOrderAndGoToOverview() {
    clearSelectedOrder();
    setShowDiscardOrderModal(false);
    setPendingTableId(null);
    goToOverview();
  }

  function dismissDiscardOrderModal() {
    setShowDiscardOrderModal(false);
    setPendingTableId(null);
  }

  function requestTableSwitch(tableId) {
    setShowTableSwitcher(false);
    if (tableId === selectedId) return;

    if (selected?.items.length && !selected.punchedAt) {
      setPendingTableId(tableId);
      setShowDiscardOrderModal(true);
      return;
    }

    navigate(menuOrderingPath(activeMenuCategory, routeMenuItem, currentMenuPage, tableId));
  }

  function discardOrderAndSwitchTable() {
    const nextTableId = pendingTableId;
    clearSelectedOrder();
    setShowDiscardOrderModal(false);
    setPendingTableId(null);
    if (nextTableId) navigate(menuOrderingPath(activeMenuCategory, routeMenuItem, currentMenuPage, nextTableId));
  }

  function applyDiscount(amount) {
    if (!selectedId) return;
    const safeAmount = Math.min(Math.max(Number(amount) || 0, 0), subtotal);
    setTables((prev) =>
      prev.map((table) =>
        table.id === selectedId ? { ...table, discount: safeAmount } : table
      )
    );
    setShowDiscountModal(false);
  }

  function openPaymentModal() {
    if (!selected?.items.length) return;
    setPaymentMethod('cash');
    setShowPaymentModal(true);
  }

  function goLogin() {
    navigate('/');
  }

  function completeBill() {
    if (!selectedId) return;
    setTables((prev) =>
      prev.map((table) =>
        table.id === selectedId
          ? { ...table, occupied: false, startedAt: null, minutes: '', guests: 0, items: [], discount: 0 }
          : table
      )
    );
    setShowPaymentModal(false);
  }

  function cancelOrder() {
    if (!selectedId || !selected?.items.length) return;
    setCanceledOrders((prev) => [...prev, { tableId: selectedId, orderId: '#ORD-2849', canceledAt: Date.now() }]);
    // Send ping to kitchen
    console.log(`Order #ORD-2849 for Table ${selected?.label} has been canceled`);
    setShowCancelOrderModal(false);
  }

  function requestCancelOrder() {
    if (selected?.items.length) setShowCancelOrderModal(true);
  }

  function toggleReservation() {
    if (!selectedId) return;
    setReservedTables((prev) =>
      prev.includes(selectedId)
        ? prev.filter((id) => id !== selectedId)
        : [...prev, selectedId]
    );
  }

  function printReceipt() {
    const printedAt = new Date();
    setReceipt({
      table: selected?.label,
      paymentMethod,
      subtotal,
      discount,
      total,
      date: `${printedAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}, ${printedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}`,
    });
    completeBill();
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
      setTables((prev) =>
        prev.map((table) => {
          if (!table.occupied || !table.startedAt) return table;
          const elapsedMs = Date.now() - table.startedAt;
          const minutes = Math.floor(elapsedMs / 60000);
          const seconds = Math.floor((elapsedMs % 60000) / 1000);
          return {
            ...table,
            minutes: `${minutes}m ${String(seconds).padStart(2, '0')}s`,
          };
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const now = new Date(currentTime);
  const formattedDate = now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <div
      className="cashier-app"
      style={{
        '--cashier-scale': interfaceCanvas.scale,
        '--cashier-canvas-height': interfaceCanvas.height,
        width: interfaceCanvas.width,
        height: interfaceCanvas.height,
        minHeight: interfaceCanvas.height,
      }}
    >
      <div className="topbar">
        <div className="brand">
          <div className="brand-logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </div>
          <div className="brand-text">Cashier Interface</div>
        </div>
        <div className="topbar-right">
          <span className="date-time">{formattedDate}, {formattedTime}</span>
          <button className="return-button" onClick={goLogin} aria-label="Return to interface selector"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg></button>
        </div>
      </div>
      <nav className="tab-group" aria-label="Cashier sections">
        <button
          className={`tab ${!isMenuOrdering ? 'active' : ''}`}
          onClick={requestOverview}
        >
          OVERVIEW
        </button>
        <button
          className={`tab ${isMenuOrdering ? 'active' : ''}`}
          onClick={() => navigate(menuOrderingPath())}
        >
          MENU ORDERING
        </button>
      </nav>

      {!isMenuOrdering && <div className="action-row">
        <div>
          <h1>Active Tables</h1>
          <p>Choose a table to review its order and bill.</p>
        </div>
        <div className="table-summary">
          <span><strong>{tables.filter((table) => !table.occupied && !reservedTables.includes(table.id)).length}</strong> available</span>
          <span><strong>{tables.filter((table) => table.occupied).length}</strong> occupied</span>
          <span><strong>{reservedTables.length}</strong> reserved</span>
        </div>
      </div>}

      <div className={`main ${isMenuOrdering ? 'menu-ordering-main' : ''}`}>
        {isMenuOrdering ? (
          <section className="menu-ordering-workspace">
            <aside className="menu-category-sidebar">
              <p className="menu-category-label">Categories</p>
              {menuCategories.map((category) => (
                <button key={category.id} className={`menu-category-button ${activeMenuCategory === category.id ? 'active' : ''}`} onClick={() => selectCategory(category.id)}>{category.name}</button>
              ))}
            </aside>
            <div className="menu-catalog">
              <div className="menu-search-row">
                <div className="menu-search-field">
                  <input
                    className="menu-search-input"
                    type="search"
                    placeholder="Search menu items..."
                    aria-label="Search menu items"
                    value={menuSearch}
                    onFocus={() => setIsMenuSearchOpen(true)}
                    onChange={(event) => {
                      const nextSearch = event.target.value;
                      const exactItem = menuItems.find((item) => item.name.toLowerCase() === nextSearch.trim().toLowerCase());
                      setMenuSearch(nextSearch);
                      setIsMenuSearchOpen(true);
                      if (exactItem) {
                        setSelectedCategory(exactItem.category);
                        navigate(menuOrderingPath(exactItem.category, exactItem));
                      }
                    }}
                  />
                  {isMenuSearchOpen && menuKeywordMatches.length > 0 && (
                    <div className="menu-keyword-dropdown" role="listbox" aria-label="Matching menu items">
                      {menuKeywordMatches.map((item) => (
                        <button key={item.id} type="button" className="menu-keyword-option" onClick={() => selectMenuKeyword(item)}>
                          <span className="menu-keyword-image"><MenuImagePlaceholder /></span>
                          <span className="menu-keyword-details"><strong>{item.name}</strong><small>{menuCategories.find((category) => category.id === item.category)?.name ?? 'Uncategorized'}</small></span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="menu-catalog-heading">
                <div>
                  <h1>{menuCategories.find((category) => category.id === activeMenuCategory)?.name}</h1>
                  <p>Tap an item to add it to Table #{selected.label}.</p>
                </div>
              </div>
              <div className="menu-item-grid">
                {pagedMenuItems.map((item) => (
                  <button key={item.id} className="menu-item-card" onClick={() => addMenuItem(item)}>
                    <span className="menu-item-image"><MenuImagePlaceholder /></span>
                    <span className="menu-item-name">{item.name}</span>
                    <span className="menu-item-bottom">
                      <span className="menu-item-price">{formatMoney(item.price)}</span>
                    </span>
                  </button>
                ))}
              </div>
              <footer className="table-pagination menu-pagination">
                <span>{visibleMenuItems.length ? `${menuPageStart + 1}–${Math.min(menuPageStart + menuItemsPerPage, visibleMenuItems.length)}` : '0'} of {visibleMenuItems.length}</span>
                <div className="pagination-actions">
                  <button disabled={currentMenuPage <= 1} onClick={() => goToMenuPage(currentMenuPage - 1)}>◀ Previous</button>
                  <span>{currentMenuPage} / {totalMenuPages}</span>
                  <button disabled={currentMenuPage >= totalMenuPages} onClick={() => goToMenuPage(currentMenuPage + 1)}>Next ▶</button>
                </div>
              </footer>
            </div>
          </section>
        ) : (
        <section className="cashier-table-area">
          <div className="table-grid">
          {visibleTables.map((table) => {
            const billValue = table.items.reduce(
              (sum, item) => sum + item.price * item.qty,
              0
            );
            const isReserved = reservedTables.includes(table.id);
            return (
              <div
                key={table.id}
                className={`table-card ${table.id === selectedId ? 'selected' : ''} ${
                  !table.occupied && !isReserved ? 'available' : ''
                } ${table.occupied ? 'occupied' : ''} ${isReserved ? 'reserved' : ''}`}
                onClick={() => selectTable(table.id)}
              >
                <div className="table-card-center">
                  <div className="table-number">{table.label}</div>
                  <div className="table-status">
                    {isReserved ? 'RESERVED' : table.occupied ? table.minutes || 'ACTIVE' : 'AVAILABLE'}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
          <footer className="table-pagination">
            <span>{pageStart + 1}–{Math.min(pageStart + tablesPerPage, tables.length)} of {tables.length}</span>
            <div className="pagination-actions">
              <button disabled={currentTablePage <= 1} onClick={() => goToTablePage(currentTablePage - 1)}>◀ Previous</button>
              <span>{currentTablePage} / {totalTablePages}</span>
              <button disabled={currentTablePage >= totalTablePages} onClick={() => goToTablePage(currentTablePage + 1)}>Next ▶</button>
            </div>
          </footer>
        </section>
        )}

        <aside className="sidebar">
          {selected && (
            <>
              <p className="sidebar-section-label">CURRENT BILL SELECTION</p>
              <div className="sidebar-header">
                <div>
                  <div className="bill-title">Order details</div>
                  <div className="bill-subtitle">Table #{selected.label} · Dine-in</div>
                </div>
                <div className="bill-selection-controls">
                  {isMenuOrdering && (
                    <div className="table-switcher">
                      <button
                        type="button"
                        className="table-switcher-button"
                        aria-label="Switch table"
                        aria-expanded={showTableSwitcher}
                        aria-haspopup="listbox"
                        title="Switch table"
                        onClick={() => setShowTableSwitcher((isOpen) => !isOpen)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M7 7h11l-3-3" /><path d="m18 7-3 3" /><path d="M17 17H6l3 3" /><path d="m6 17 3-3" /></svg>
                      </button>
                      {showTableSwitcher && (
                        <div className="table-switcher-dropdown" role="listbox" aria-label="Switch to another table">
                          <p>Switch table</p>
                          <div className="table-switcher-options">
                            {tables.map((table) => (
                              <button
                                key={table.id}
                                type="button"
                                role="option"
                                aria-selected={table.id === selectedId}
                                className={table.id === selectedId ? 'selected' : ''}
                                onClick={() => requestTableSwitch(table.id)}
                              >
                                <span>Table #{table.label}</span>
                                <small>{table.occupied ? 'Occupied' : 'Empty'}</small>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="order-code">#ORD-2849</div>

              <div className="items-list">
                {selected.items.length === 0 ? (
                  <div className="empty-items">No items yet. Add from below.</div>
                ) : (
                  selected.items.map((item) => (
                    <div key={item.name} className="item-row">
                      <div>
                        <div className="item-name">{item.name}</div>
                        <div className="item-note">Extra ice</div>
                      </div>
                      <div className="item-right">
                        <span>{formatMoney(item.price * item.qty)}</span>
                        <button
                          className="item-remove"
                          onClick={() => removeItem(item.name)}
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="summary">
                <div className="summary-row">
                  <span>Subtotal</span>
                  <span>{formatMoney(subtotal)}</span>
                </div>
                <div className="summary-row">
                  <span>Discount</span>
                  <span>-{formatMoney(discount)}</span>
                </div>
                <div className="summary-total">
                  <span>Total</span>
                  <span>{formatMoney(total)}</span>
                </div>
              </div>

              <div className="sidebar-actions">
                {isMenuOrdering ? <>
                  <button className="clear-button" onClick={requestClearOrder} disabled={selected.items.length === 0}>
                    <span className="button-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 16 9-9 3 3-9 9H7v-3Zm10.7-10.7 1.1-1.1a1 1 0 0 1 1.4 0l.6.6a1 1 0 0 1 0 1.4L19.7 7l-2-1.7Z"/></svg></span>
                    Clear
                  </button>
                  <button className="punch-order-button" onClick={requestPunchOrder} disabled={selected.items.length === 0}>
                    <span className="button-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 2v5h10V5H7Zm0 9v5h10v-5H7Z"/></svg></span>
                    Punch Order
                  </button>
                  <button className="cancel-order-button" onClick={requestCancelOrder} disabled={selected.items.length === 0}>
                    <span className="button-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4l5.6 5.6L5 17.6 6.4 19 12 13.4l5.6 5.6 1.4-1.4-5.6-5.6L19 6.4Z"/></svg></span>
                    Cancel Order
                  </button>
                </> : <>
                  <button className="discount-button" onClick={openDiscountModal}>
                    <span className="button-icon"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#000000"><path d="M856-390 570-104q-12 12-27 18t-30 6q-15 0-30-6t-27-18L103-457q-11-11-17-25.5T80-513v-287q0-33 23.5-56.5T160-880h287q16 0 31 6.5t26 17.5l352 353q12 12 17.5 27t5.5 30q0 15-5.5 29.5T856-390ZM513-160l286-286-353-354H160v286l353 354ZM260-640q25 0 42.5-17.5T320-700q0-25-17.5-42.5T260-760q-25 0-42.5 17.5T200-700q0 25 17.5 42.5T260-640Zm220 160Z"/></svg></span>
                    Discount
                  </button>
                  <button className="reserve-button" onClick={toggleReservation}>
                    <span className="button-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3-9H5V5h10v5z"/></svg></span>
                    {reservedTables.includes(selectedId) ? 'Unreserve' : 'Reserve'}
                  </button>
                  <button className="bill-button" onClick={openPaymentModal} disabled={selected.items.length === 0}>
                    <span className="button-icon"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#000000"><path d="M560-440q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35ZM280-320q-33 0-56.5-23.5T200-400v-320q0-33 23.5-56.5T280-800h560q33 0 56.5 23.5T920-720v320q0 33-23.5 56.5T840-320H280Zm80-80h400q0-33 23.5-56.5T840-480v-160q-33 0-56.5-23.5T760-720H360q0 33-23.5 56.5T280-640v160q33 0 56.5 23.5T360-400Zm440 240H120q-33 0-56.5-23.5T40-240v-440h80v440h680v80ZM280-400v-320 320Z"/></svg></span>
                    Bill Out
                  </button>
                </>}
              </div>
            </>
          )}
        </aside>
      </div>

      {showPunchOrderModal && (
        <div className="modal-backdrop" onClick={() => setShowPunchOrderModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div><p className="modal-kicker">SAVE ORDER</p><h2>Punch this order?</h2></div>
              <button className="modal-icon-close" onClick={() => setShowPunchOrderModal(false)} aria-label="Close">×</button>
            </div>
            <p className="modal-description">Save the current order for Table #{selected?.label}?</p>
            <div className="modal-actions">
              <button onClick={() => setShowPunchOrderModal(false)}>Cancel</button>
              <button className="modal-print" onClick={() => { punchOrder(); setShowPunchOrderModal(false); }}>Punch Order</button>
            </div>
          </div>
        </div>
      )}

      {showClearOrderModal && (
        <div className="modal-backdrop" onClick={() => setShowClearOrderModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div><p className="modal-kicker">CLEAR ORDER</p><h2>Clear order details?</h2></div>
              <button className="modal-icon-close" onClick={() => setShowClearOrderModal(false)} aria-label="Close">×</button>
            </div>
            <p className="modal-description">This removes all selected items for Table #{selected?.label}.</p>
            <div className="modal-actions">
              <button onClick={() => setShowClearOrderModal(false)}>Cancel</button>
              <button className="modal-print" onClick={() => { clearSelectedOrder(); setShowClearOrderModal(false); }}>Clear Order</button>
            </div>
          </div>
        </div>
      )}

      {showDiscardOrderModal && (
        <div className="modal-backdrop" onClick={dismissDiscardOrderModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div><p className="modal-kicker">UNSAVED ORDER</p><h2>Discard order changes?</h2></div>
              <button className="modal-icon-close" onClick={dismissDiscardOrderModal} aria-label="Close">×</button>
            </div>
            <p className="modal-description">This order has not been punched. Discard the items or keep ordering?</p>
            <div className="modal-actions">
              <button onClick={dismissDiscardOrderModal}>Keep Ordering</button>
              <button className="modal-print" onClick={pendingTableId ? discardOrderAndSwitchTable : discardOrderAndGoToOverview}>Discard Changes</button>
            </div>
          </div>
        </div>
      )}

      {showDiscountModal && (
        <div className="modal-backdrop" onClick={() => setShowDiscountModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <div><p className="modal-kicker">ORDER ADJUSTMENT</p><h2>Apply discount</h2></div>
              <button className="modal-icon-close" onClick={() => setShowDiscountModal(false)} aria-label="Close">×</button>
            </div>
            <p className="modal-description">Choose a preset discount or enter a peso amount for Table #{selected?.label}.</p>
            <div className="discount-buttons">
              <button onClick={() => applyDiscount(subtotal * 0.2)}><span>PWD</span><strong>20%</strong></button>
              <button onClick={() => applyDiscount(subtotal * 0.15)}><span>Senior</span><strong>15%</strong></button>
            </div>
            <div className="custom-discount">
              <label>
                Discount amount
                <input
                  type="number"
                  min="0"
                  max={subtotal}
                  step="0.01"
                  value={customDiscount}
                  onChange={(e) => setCustomDiscount(e.target.value)}
                />
              </label>
              <button
                onClick={() => applyDiscount(Number(customDiscount) || 0)}
              >
                Apply amount
              </button>
            </div>
            {discount > 0 && <button className="modal-text-button" onClick={() => applyDiscount(0)}>Remove current discount</button>}
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="modal-backdrop" onClick={() => setShowPaymentModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <div><p className="modal-kicker">BILL OUT</p><h2>Payment method</h2></div>
              <button className="modal-icon-close" onClick={() => setShowPaymentModal(false)} aria-label="Close">×</button>
            </div>
            <p className="modal-description">Table #{selected?.label} · Total due <strong>{formatMoney(total)}</strong></p>
            <div className="payment-options">
              <label>
                <input
                  type="radio"
                  name="payment"
                  value="cash"
                  checked={paymentMethod === 'cash'}
                  onChange={() => setPaymentMethod('cash')}
                />
                Cash
              </label>
              <label>
                <input
                  type="radio"
                  name="payment"
                  value="credit"
                  checked={paymentMethod === 'credit'}
                  onChange={() => setPaymentMethod('credit')}
                />
                Credit Card
              </label>
              <label>
                <input
                  type="radio"
                  name="payment"
                  value="qr"
                  checked={paymentMethod === 'qr'}
                  onChange={() => setPaymentMethod('qr')}
                />
                QR Code
              </label>
            </div>
            <div className="modal-actions">
              <button className="modal-remove" onClick={() => setShowPaymentModal(false)}>
                Cancel
              </button>
              <button className="modal-print" onClick={printReceipt}>
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelOrderModal && (
        <div className="modal-backdrop" onClick={() => setShowCancelOrderModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div><p className="modal-kicker">CANCEL ORDER</p><h2>Cancel this order?</h2></div>
              <button className="modal-icon-close" onClick={() => setShowCancelOrderModal(false)} aria-label="Close">×</button>
            </div>
            <p className="modal-description">This will cancel the order for Table #{selected?.label} and notify the kitchen.</p>
            <div className="modal-actions">
              <button onClick={() => setShowCancelOrderModal(false)}>Keep Order</button>
              <button className="modal-print modal-remove" onClick={cancelOrder}>Cancel Order</button>
            </div>
          </div>
        </div>
      )}

      {receipt && (
        <div className="modal-backdrop" onClick={() => setReceipt(null)}>
          <div className="modal receipt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="receipt-check" aria-hidden="true">✓</div>
            <p className="modal-kicker">PAYMENT COMPLETE</p>
            <h2>Receipt ready</h2>
            <p className="modal-description">The bill for Table #{receipt.table} has been completed.</p>
            <div className="receipt-details">
              <div><span>Date</span><strong>{receipt.date}</strong></div>
              <div><span>Payment</span><strong>{receipt.paymentMethod === 'qr' ? 'QR Code' : receipt.paymentMethod === 'credit' ? 'Credit Card' : 'Cash'}</strong></div>
              <div><span>Subtotal</span><strong>{formatMoney(receipt.subtotal)}</strong></div>
              {receipt.discount > 0 && <div><span>Discount</span><strong>-{formatMoney(receipt.discount)}</strong></div>}
              <div className="receipt-total"><span>Total paid</span><strong>{formatMoney(receipt.total)}</strong></div>
            </div>
            <button className="modal-print receipt-done" onClick={() => setReceipt(null)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Cashier;