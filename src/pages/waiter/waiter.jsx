import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './waiter.css';

const categories = [
  { id: 'meals', name: 'Meals' }, { id: 'drinks', name: 'Drinks' },
  { id: 'desserts', name: 'Desserts' }, { id: 'snacks', name: 'Snacks' },
];
const menuItems = [
  { id: 1, name: 'Chicken Burger', price: 120, category: 'meals' }, { id: 2, name: 'Beef Burger', price: 145, category: 'meals' },
  { id: 3, name: 'Grilled Chicken', price: 180, category: 'meals' }, { id: 4, name: 'Pork Sisig', price: 160, category: 'meals' },
  { id: 5, name: 'Strawberry Shake', price: 75, category: 'drinks' }, { id: 6, name: 'Coke', price: 40, category: 'drinks' },
  { id: 7, name: 'Iced Tea', price: 50, category: 'drinks' }, { id: 8, name: 'Lemonade', price: 55, category: 'drinks' },
  { id: 9, name: 'Cheesecake Slice', price: 95, category: 'desserts' }, { id: 10, name: 'Chocolate Cake', price: 90, category: 'desserts' },
  { id: 11, name: 'Fries', price: 60, category: 'snacks' }, { id: 12, name: 'Nachos', price: 110, category: 'snacks' },
];
const initialTables = Array.from({ length: 16 }, (_, index) => ({ id: index + 1, label: String(index + 1).padStart(2, '0'), items: [], punchedAt: null }));
const formatMoney = (value) => `₱${value.toFixed(2)}`;
const unquoteQueryValue = (value) => (value ?? '').replace(/^"|"$/g, '');

function MenuImagePlaceholder() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m4 18 5-5 3 3 3-4 5 6" /></svg>;
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

export default function Waiter() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tables, setTables] = useState(initialTables);
  const [selectedCategory, setSelectedCategory] = useState('meals');
  const [search, setSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showTableSwitcher, setShowTableSwitcher] = useState(false);
  const [pendingTableId, setPendingTableId] = useState(null);
  const [showUnsavedOrderModal, setShowUnsavedOrderModal] = useState(false);
  const [showClearOrderModal, setShowClearOrderModal] = useState(false);
  const [showPunchOrderModal, setShowPunchOrderModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const routeCategory = unquoteQueryValue(new URLSearchParams(location.search).get('category'));
  const activeCategory = categories.some((category) => category.id === routeCategory) ? routeCategory : selectedCategory;
  const tableFromRoute = Number(location.pathname.match(/\/table-(\d+)$/)?.[1]);
  const selectedId = tables.some((table) => table.id === tableFromRoute) ? tableFromRoute : 1;
  const selected = tables.find((table) => table.id === selectedId);
  const subtotal = selected.items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const visibleItems = menuItems.filter((item) => item.category === activeCategory && item.name.toLowerCase().includes(search.trim().toLowerCase()));
  const searchMatches = search.trim() ? menuItems.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 6) : [];
  const now = new Date(currentTime);
  const interfaceCanvas = useFixedInterfaceCanvas();

  const waiterPath = (category = activeCategory, tableId = selectedId) => `/waiter/menu-ordering/table-${tableId}?category="${category}"`;
  useEffect(() => {
    if (!location.pathname.startsWith('/waiter/menu-ordering/table-') || !routeCategory) {
      navigate(`/waiter/menu-ordering/table-${selectedId}?category="${activeCategory}"`, { replace: true });
    }
  }, [location.pathname, routeCategory, activeCategory, selectedId, navigate]);
  useEffect(() => { const timer = setInterval(() => setCurrentTime(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const isUnsaved = selected.items.length > 0 && !selected.punchedAt;
  function chooseCategory(categoryId) { setSelectedCategory(categoryId); setSearch(''); setIsSearchOpen(false); navigate(waiterPath(categoryId)); }
  function addItem(item) { setTables((previous) => previous.map((table) => { if (table.id !== selectedId) return table; const existing = table.items.find((orderItem) => orderItem.id === item.id); const items = existing ? table.items.map((orderItem) => orderItem.id === item.id ? { ...orderItem, qty: orderItem.qty + 1 } : orderItem) : [...table.items, { ...item, qty: 1 }]; return { ...table, items, punchedAt: null }; })); }
  function removeItem(itemId) { setTables((previous) => previous.map((table) => table.id === selectedId ? { ...table, items: table.items.filter((item) => item.id !== itemId), punchedAt: null } : table)); }
  function clearOrder() { setTables((previous) => previous.map((table) => table.id === selectedId ? { ...table, items: [], punchedAt: null } : table)); setShowClearOrderModal(false); }
  function punchOrder() { setTables((previous) => previous.map((table) => table.id === selectedId ? { ...table, punchedAt: Date.now() } : table)); setShowPunchOrderModal(false); }
  function requestTableSwitch(tableId) { setShowTableSwitcher(false); if (tableId === selectedId) return; if (isUnsaved) { setPendingTableId(tableId); setShowUnsavedOrderModal(true); return; } navigate(waiterPath(activeCategory, tableId)); }
  function dismissUnsavedOrder() { setShowUnsavedOrderModal(false); setPendingTableId(null); }
  function discardAndSwitch() { const nextTableId = pendingTableId; setTables((previous) => previous.map((table) => table.id === selectedId ? { ...table, items: [], punchedAt: null } : table)); dismissUnsavedOrder(); navigate(waiterPath(activeCategory, nextTableId)); }

  return <div
    className="cashier-app waiter-app"
    style={{
      '--cashier-scale': interfaceCanvas.scale,
      '--cashier-canvas-height': interfaceCanvas.height,
      width: interfaceCanvas.width,
      height: interfaceCanvas.height,
      minHeight: interfaceCanvas.height,
    }}
  >
    <header className="topbar"><div className="brand"><div className="brand-logo" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg></div><div className="brand-text">Waiter Interface</div></div><div className="topbar-right"><span className="date-time">{now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}, {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}</span><button className="return-button" onClick={() => navigate('/')} aria-label="Return to interface selector"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg></button></div></header>
    <nav className="tab-group" aria-label="Waiter section"><button className="tab active" type="button">MENU ORDERING</button></nav>
    <main className="main menu-ordering-main"><section className="menu-ordering-workspace"><aside className="menu-category-sidebar"><p className="menu-category-label">Categories</p>{categories.map((category) => <button key={category.id} className={`menu-category-button ${activeCategory === category.id ? 'active' : ''}`} onClick={() => chooseCategory(category.id)}>{category.name}</button>)}</aside><div className="menu-catalog"><div className="menu-search-row"><div className="menu-search-field"><input className="menu-search-input" type="search" value={search} placeholder="Search menu items..." aria-label="Search menu items" onFocus={() => setIsSearchOpen(true)} onChange={(event) => { setSearch(event.target.value); setIsSearchOpen(true); }} />{isSearchOpen && searchMatches.length > 0 && <div className="menu-keyword-dropdown" role="listbox">{searchMatches.map((item) => <button key={item.id} type="button" className="menu-keyword-option" onClick={() => { setSearch(item.name); setSelectedCategory(item.category); setIsSearchOpen(false); navigate(waiterPath(item.category)); }}><span className="menu-keyword-image"><MenuImagePlaceholder /></span><span className="menu-keyword-details"><strong>{item.name}</strong><small>{categories.find((category) => category.id === item.category)?.name}</small></span></button>)}</div>}</div></div><div className="menu-catalog-heading"><div><h1>{categories.find((category) => category.id === activeCategory)?.name}</h1><p>Tap an item to add it to Table #{selected.label}.</p></div></div><div className="menu-item-grid">{visibleItems.map((item) => <button key={item.id} className="menu-item-card" onClick={() => addItem(item)}><span className="menu-item-image"><MenuImagePlaceholder /></span><span className="menu-item-name">{item.name}</span><span className="menu-item-bottom"><span className="menu-item-price">{formatMoney(item.price)}</span><span className="menu-item-add" aria-hidden="true">+</span></span></button>)}</div><footer className="table-pagination menu-pagination"><span>{visibleItems.length ? `1–${visibleItems.length}` : '0'} of {visibleItems.length}</span><div className="pagination-actions"><button disabled>◀ Previous</button><span>1 / 1</span><button disabled>Next ▶</button></div></footer></div></section>
      <aside className="sidebar"><p className="sidebar-section-label">CURRENT BILL SELECTION</p><div className="sidebar-header"><div><div className="bill-title">Order details</div><div className="bill-subtitle">Table #{selected.label} · Dine-in</div></div><div className="bill-selection-controls"><div className={`status-pill ${selected.items.length ? 'occupied' : 'empty'}`}>{selected.items.length ? 'OCCUPIED' : 'EMPTY'}</div><div className="table-switcher"><button type="button" className="table-switcher-button" aria-label="Switch table" aria-expanded={showTableSwitcher} aria-haspopup="listbox" onClick={() => setShowTableSwitcher((isOpen) => !isOpen)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 7h11l-3-3" /><path d="m18 7-3 3" /><path d="M17 17H6l3 3" /><path d="m6 17 3-3" /></svg></button>{showTableSwitcher && <div className="table-switcher-dropdown" role="listbox"><p>Switch table</p><div className="table-switcher-options">{tables.map((table) => <button key={table.id} type="button" role="option" aria-selected={table.id === selectedId} className={table.id === selectedId ? 'selected' : ''} onClick={() => requestTableSwitch(table.id)}><span>Table #{table.label}</span><small>{table.items.length ? 'Occupied' : 'Empty'}</small></button>)}</div></div>}</div></div></div><div className="order-code">#ORD-2849</div><div className="items-list">{selected.items.length === 0 ? <div className="empty-items">No items yet. Add from below.</div> : selected.items.map((item) => <div key={item.id} className="item-row"><div><div className="item-name">{item.name} × {item.qty}</div><div className="item-note">Dine-in</div></div><div className="item-right"><span>{formatMoney(item.price * item.qty)}</span><button className="item-remove" onClick={() => removeItem(item.id)} aria-label={`Remove ${item.name}`}>−</button></div></div>)}</div><div className="summary"><div className="summary-row"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div><div className="summary-row"><span>Discount</span><span>-₱0.00</span></div><div className="summary-total"><span>Total</span><span>{formatMoney(subtotal)}</span></div></div><div className="sidebar-actions"><button className="clear-button" disabled={!selected.items.length} onClick={() => setShowClearOrderModal(true)}><span className="button-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 16 9-9 3 3-9 9H7v-3Zm10.7-10.7 1.1-1.1a1 1 0 0 1 1.4 0l.6.6a1 1 0 0 1 0 1.4L19.7 7l-2-1.7Z" /></svg></span>Clear</button><button className="punch-order-button" disabled={!selected.items.length} onClick={() => setShowPunchOrderModal(true)}><span className="button-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 2v5h10V5H7Zm0 9v5h10v-5H7Z" /></svg></span>Punch Order</button></div></aside></main>
    {showUnsavedOrderModal && <div className="modal-backdrop" onClick={dismissUnsavedOrder}><div className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="modal-kicker">UNSAVED ORDER</p><h2>Discard order changes?</h2></div><button className="modal-icon-close" onClick={dismissUnsavedOrder} aria-label="Close">×</button></div><p className="modal-description">This order has not been punched. Discard the items or keep ordering?</p><div className="modal-actions"><button onClick={dismissUnsavedOrder}>Keep Ordering</button><button className="modal-print" onClick={discardAndSwitch}>Discard Changes</button></div></div></div>}
    {showClearOrderModal && <div className="modal-backdrop" onClick={() => setShowClearOrderModal(false)}><div className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="modal-kicker">CLEAR ORDER</p><h2>Clear order details?</h2></div><button className="modal-icon-close" onClick={() => setShowClearOrderModal(false)} aria-label="Close">×</button></div><p className="modal-description">This removes all selected items for Table #{selected.label}.</p><div className="modal-actions"><button onClick={() => setShowClearOrderModal(false)}>Cancel</button><button className="modal-print" onClick={clearOrder}>Clear Order</button></div></div></div>}
    {showPunchOrderModal && <div className="modal-backdrop" onClick={() => setShowPunchOrderModal(false)}><div className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="modal-kicker">SAVE ORDER</p><h2>Punch this order?</h2></div><button className="modal-icon-close" onClick={() => setShowPunchOrderModal(false)} aria-label="Close">×</button></div><p className="modal-description">Save the current order for Table #{selected.label}?</p><div className="modal-actions"><button onClick={() => setShowPunchOrderModal(false)}>Cancel</button><button className="modal-print" onClick={punchOrder}>Punch Order</button></div></div></div>}
  </div>;
}
