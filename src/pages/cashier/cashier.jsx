import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePOS } from '../../context/POSContext';
import './cashier.css';

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

  // --- Global State from POSContext (real-time Supabase data) ---
  const {
    tables: dbTables,
    menuItems: dbMenuItems,
    categories: dbCategories,
    orders,
    orderItems,
    getOrdersForTable,
    getItemsForOrder,
    addItemsToOrder,
    createOrder,
    billOutTable,
    removeOrderItem,
    updateOrderStatus,
    reserveTable,
    applyTableDiscount,
    splitOrderItemUnit,
    applyItemDiscount,
    loading,
    formatPrice,
  } = usePOS();

  // --- Data Mapping ---

  /** Maps raw DB categories into a simplified format for the UI sidebar. */
  const menuCategories = useMemo(() =>
    dbCategories.map((c) => ({ id: c.id, name: c.name })),
    [dbCategories]
  );

  /** Maps raw DB menu items into the format required by the product grid. */
  const menuItems = useMemo(() =>
    dbMenuItems.map((m) => ({
      id: m.id,
      name: m.name,
      price: Number(m.price),
      category: m.category_id,
      image_url: m.image_url,
    })),
    [dbMenuItems]
  );

  const menuItemSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');

  /** Maps raw DB tables into an array with computed status from active orders. */
  const tables = useMemo(() =>
    dbTables.map((t) => ({
      id: t.table_number,
      label: String(t.table_number).padStart(2, '0'),
      dbId: t.id,
      status: t.status,
      table_number: t.table_number,
      occupied: t.status === 'OCCUPIED',
      reserved: t.status === 'RESERVED' || t.reserved === true,
      occupiedSince: t.occupied_since,
      reservedSince: t.reserved_since,
      pwdDiscount: t.pwd_discount === true,
      seniorDiscount: t.senior_discount === true,
      percentDiscount: Number(t.percent_discount) || 0,
      floatDiscount: Number(t.float_discount) || 0,
      totalBill: Number(t.total_bill ?? t.current_bill ?? 0),
      currentBill: Number(t.current_bill ?? 0),
    })),
    [dbTables]
  );

  // --- Local State ---
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountTarget, setDiscountTarget] = useState('table');
  const [discountTargetItem, setDiscountTargetItem] = useState(null);
  const [discountTargetUnitIndex, setDiscountTargetUnitIndex] = useState(null);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPunchOrderModal, setShowPunchOrderModal] = useState(false);
  const [showClearOrderModal, setShowClearOrderModal] = useState(false);
  const [showDiscardOrderModal, setShowDiscardOrderModal] = useState(false);
  const [showTableSwitcher, setShowTableSwitcher] = useState(false);
  const [showCancelOrderModal, setShowCancelOrderModal] = useState(false);
  const [showDecreaseModal, setShowDecreaseModal] = useState(false);
  const [pendingTableId, setPendingTableId] = useState(null);
  const [pendingItem, setPendingItem] = useState(null);
  const [expandedItemIds, setExpandedItemIds] = useState(() => ({}));
  const [receipt, setReceipt] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [reservedTables, setReservedTables] = useState([]);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [punchingOrder, setPunchingOrder] = useState(false);
  const [pwdDiscount, setPwdDiscount] = useState(false);
  const [seniorDiscount, setSeniorDiscount] = useState(false);
  const [percentDiscountValue, setPercentDiscountValue] = useState('');
  const [floatDiscountValue, setFloatDiscountValue] = useState('');

  // Local cart for the cashier's menu-ordering (unpunched items), keyed by table ID
  const [carts, setCarts] = useState({});

  const routeCategory = unquoteQueryValue(new URLSearchParams(location.search).get('category'));
  const routeItem = unquoteQueryValue(new URLSearchParams(location.search).get('item'));
  const routeMenuItem = menuItems.find((item) => menuItemSlug(item.name) === routeItem);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [menuSearch, setMenuSearch] = useState(() => routeMenuItem?.name ?? '');
  const [isMenuSearchOpen, setIsMenuSearchOpen] = useState(false);
  const interfaceCanvas = useFixedInterfaceCanvas();

  // Default to the first category if none is selected
  useEffect(() => {
    if (menuCategories.length > 0 && !selectedCategory) {
      setSelectedCategory(menuCategories[0].id);
    }
  }, [menuCategories, selectedCategory]);

  const isMenuOrdering = location.pathname.startsWith('/cashier/menu-ordering');
  const activeMenuCategory = isMenuOrdering && menuCategories.some((category) => category.id === routeCategory)
    ? routeCategory
    : (selectedCategory || (menuCategories[0]?.id ?? ''));

  const requestedTableId = Number(location.pathname.match(/\/table-(\d+)$/)?.[1]);
  const selectedId = tables.some((table) => table.id === requestedTableId)
    ? requestedTableId
    : (tables[0]?.id ?? 1);
  const selected = tables.find((table) => table.id === selectedId);

  // Retrieve existing punched orders and items from DB for the selected table
  const existingOrders = useMemo(() => {
    if (!selected) return [];
    return getOrdersForTable(selected.table_number);
  }, [selected, getOrdersForTable, orders]);

  const existingItems = useMemo(() => {
    return existingOrders.flatMap((o) => getItemsForOrder(o.id));
  }, [existingOrders, getItemsForOrder, orderItems]);

  const groupedExistingItems = useMemo(() => {
    const groups = new Map();
    existingItems.forEach((entry) => {
      const key = `${entry.order_id}-${entry.menu_item_id || entry.item_name}`;
      const group = groups.get(key) || { ...entry, quantity: 0, rows: [] };
      group.quantity += Number(entry.quantity) || 0;
      group.rows.push(entry);
      groups.set(key, group);
    });
    return Array.from(groups.values());
  }, [existingItems]);

  // Local unpunched cart for the selected table
  const cart = carts[selectedId] || [];

  // Compute subtotal from existing DB items + local cart items
  const existingSubtotal = existingItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const existingDiscountedTotal = existingItems.reduce((sum, item) => {
    const itemSubtotal = (Number(item.price) || 0) * (Number(item.quantity) || 0);
    const reservedRate = (item.pwd_discount ? 20 : 0) + (item.senior_discount ? 15 : 0);
    const percentRate = Math.min(100 - reservedRate, Math.max(0, Number(item.percent_discount) || 0));
    const percentAmount = itemSubtotal * ((reservedRate + percentRate) / 100);
    const afterPercent = Math.max(0, itemSubtotal - percentAmount);
    return sum + Math.max(0, afterPercent - Math.min(afterPercent, Math.max(0, Number(item.float_discount) || 0)));
  }, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const subtotal = existingSubtotal + cartSubtotal;
  const discountSubtotal = discountTarget === 'item' && discountTargetItem
    ? Number(discountTargetItem.price) || 0
    : subtotal;
  const percentDiscountCap = Math.max(0, 100 - (pwdDiscount ? 20 : 0) - (seniorDiscount ? 15 : 0));
  const normalizedPercentDiscountValue = Math.min(percentDiscountCap, Math.max(0, Number(percentDiscountValue) || 0));
  const percentDiscountAmountPreview = discountSubtotal * (((pwdDiscount ? 20 : 0) + (seniorDiscount ? 15 : 0) + normalizedPercentDiscountValue) / 100);
  const floatDiscountCap = Math.max(0, discountSubtotal - percentDiscountAmountPreview);
  const normalizedFloatDiscountValue = Math.min(floatDiscountCap, Math.max(0, Number(floatDiscountValue) || 0));
  const selectedDiscounts = selected
    ? [
        selected.pwdDiscount ? { label: 'PWD Discount (20%)', amount: subtotal * 0.2 } : null,
        selected.seniorDiscount ? { label: 'Senior Discount (15%)', amount: subtotal * 0.15 } : null,
        selected.percentDiscount > 0 ? { label: `Percent Discount (${selected.percentDiscount}%)`, amount: subtotal * (selected.percentDiscount / 100) } : null,
        selected.floatDiscount > 0 ? { label: 'Specific Discount', amount: selected.floatDiscount } : null,
      ].filter(Boolean)
    : [];
  const discount = selectedDiscounts.reduce((sum, item) => sum + item.amount, 0);
  const displayedTotal = cart.length > 0
    ? existingDiscountedTotal + cartSubtotal
    : existingItems.length > 0
      ? existingDiscountedTotal
      : selected
        ? (() => {
            const percentTotal = subtotal * (((selected.pwdDiscount ? 20 : 0) + (selected.seniorDiscount ? 15 : 0) + selected.percentDiscount) / 100);
            const afterPercent = Math.max(0, subtotal - percentTotal);
            return Math.max(0, afterPercent - selected.floatDiscount);
          })()
        : subtotal;
  const total = +Math.max(0, Number.isFinite(displayedTotal) ? displayedTotal : subtotal).toFixed(2);

  const tablesPerPage = 12;
  const totalTablePages = Math.max(1, Math.ceil(tables.length / tablesPerPage));
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

  const hasItems = existingItems.length > 0 || cart.length > 0;
  const hasPunchedItems = existingItems.length > 0;
  const isUnsaved = cart.length > 0;

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

  /** Adds a menu item to the local cart for the currently selected table. */
  function addMenuItem(item) {
    setCarts((prev) => {
      const currentCart = prev[selectedId] || [];
      const existing = currentCart.find((ci) => ci.id === item.id);
      const updatedCart = existing
        ? currentCart.map((ci) => ci.id === item.id ? { ...ci, qty: ci.qty + 1 } : ci)
        : [...currentCart, { ...item, qty: 1 }];
      return { ...prev, [selectedId]: updatedCart };
    });
  }

  /** Decrements a specific menu item from the local cart. */
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

  function clearLocalCart() {
    setCarts((prev) => ({ ...prev, [selectedId]: [] }));
  }

  function requestClearOrder() {
    if (cart.length > 0) setShowClearOrderModal(true);
  }

  function openTableDiscountModal() {
    if (!selected) return;
    setDiscountTarget('table');
    setDiscountTargetItem(null);
    setPwdDiscount(selected.pwdDiscount);
    setSeniorDiscount(selected.seniorDiscount);
    setPercentDiscountValue(String(selected.percentDiscount || ''));
    setFloatDiscountValue(String(selected.floatDiscount || ''));
    setShowDiscountModal(true);
  }

  function openItemDiscountModal(item, unitIndex = null) {
    if (!selected) return;
    setDiscountTarget('item');
    setDiscountTargetItem(item);
    setDiscountTargetUnitIndex(unitIndex);
    const targetItem = item;
    setPwdDiscount(targetItem.pwd_discount === true);
    setSeniorDiscount(targetItem.senior_discount === true);
    setPercentDiscountValue(String(targetItem.percent_discount || ''));
    setFloatDiscountValue(String(targetItem.float_discount || ''));
    setExpandedItemIds((previous) => ({ ...previous, [item.id]: true }));
    setShowDiscountModal(true);
  }

  async function applyDiscount() {
    if (!selected) return;
    if (discountTarget === 'item') {
      let targetItemId = discountTargetItem?.id;
      if (discountTargetUnitIndex !== null && Number(discountTargetItem?.quantity) > 1) {
        const splitItem = await splitOrderItemUnit(discountTargetItem.id);
        if (!splitItem) return;
        targetItemId = splitItem.id;
      }
      const result = await applyItemDiscount(targetItemId, {
        pwdDiscount,
        seniorDiscount,
        percentDiscount: normalizedPercentDiscountValue,
        floatDiscount: normalizedFloatDiscountValue,
      });
      if (result !== null) setShowDiscountModal(false);
      return;
    }

    const result = await applyTableDiscount(selected.table_number, {
      pwdDiscount,
      seniorDiscount,
      percentDiscount: normalizedPercentDiscountValue,
      floatDiscount: normalizedFloatDiscountValue,
    });
    if (result !== null) setShowDiscountModal(false);
  }

  function toggleItemExpansion(itemId) {
    setExpandedItemIds((previous) => ({ ...previous, [itemId]: !previous[itemId] }));
  }

  function requestItemDecrease(item) {
    setPendingItem(item);
    setShowDecreaseModal(true);
  }

  function confirmItemDecrease() {
    if (!pendingItem) return;
    const itemToRemove = pendingItem;
    setShowDecreaseModal(false);
    setPendingItem(null);
    void removeOrderItem(itemToRemove.id, itemToRemove.order_id);
  }

  /** Punches the local cart to the database via POSContext. */
  async function punchOrder() {
    if (!selected || cart.length === 0 || punchingOrder) return;
    setPunchingOrder(true);
    try {
      if (selected?.occupied && existingOrders[0]) {
        await addItemsToOrder(existingOrders[0].id, cart.map((item) => ({
          id: item.id,
          menu_item_id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.qty,
        })));
      } else {
        await createOrder(selected.table_number, 'Cashier', cart.map((item) => ({
          id: item.id,
          menu_item_id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.qty,
        })), 'DINE-IN');
      }

      setCarts((prev) => ({ ...prev, [selectedId]: [] }));
    } catch (err) {
      console.error('Error punching order:', err);
    } finally {
      setPunchingOrder(false);
      setShowPunchOrderModal(false);
    }
  }

  function requestPunchOrder() {
    if (cart.length > 0) setShowPunchOrderModal(true);
  }

  function goToOverview() {
    navigate(cashierPath('overview', selectedId, Math.ceil(selectedId / tablesPerPage)));
  }

  function requestOverview() {
    if (isMenuOrdering && isUnsaved) {
      setShowDiscardOrderModal(true);
      return;
    }
    goToOverview();
  }

  function discardOrderAndGoToOverview() {
    clearLocalCart();
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

    if (isUnsaved) {
      setPendingTableId(tableId);
      setShowDiscardOrderModal(true);
      return;
    }

    navigate(menuOrderingPath(activeMenuCategory, routeMenuItem, currentMenuPage, tableId));
  }

  function discardOrderAndSwitchTable() {
    const nextTableId = pendingTableId;
    clearLocalCart();
    setShowDiscardOrderModal(false);
    setPendingTableId(null);
    if (nextTableId) navigate(menuOrderingPath(activeMenuCategory, routeMenuItem, currentMenuPage, nextTableId));
  }

  function openPaymentModal() {
    if (!hasItems) return;
    setPaymentMethod('cash');
    setShowPaymentModal(true);
  }

  function goLogin() {
    navigate('/');
  }

  /** Bills out the table via POSContext - marks orders as COMPLETED and resets table. */
  async function completeBill() {
    if (!selected) return;
    try {
      await billOutTable(selected.table_number);
    } catch (err) {
      console.error('Error billing out table:', err);
    }
    setShowPaymentModal(false);
  }

  /** Cancels all active orders for the selected table. */
  async function cancelOrder() {
    if (!selected || !hasItems) return;
    for (const order of existingOrders) {
      await updateOrderStatus(order.id, 'CANCELLED');
    }
    clearLocalCart();
    console.log(`Orders for Table ${selected?.label} have been canceled`);
    setShowCancelOrderModal(false);
  }

  function requestCancelOrder() {
    if (hasItems) setShowCancelOrderModal(true);
  }

  function toggleReservation() {
    if (!selectedId || !selected || selected.occupied) return;
    reserveTable(selected.table_number);
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

  // Compute elapsed time for occupied tables
  const getElapsedTime = useCallback((table) => {
    if (!table.occupied && !table.reserved) return '';
    const startedAt = table.occupied ? table.occupiedSince : table.reservedSince;
    if (!startedAt) return '';
    const elapsedMs = currentTime - new Date(startedAt).getTime();
    if (elapsedMs < 0) return '';
    const minutes = Math.floor(elapsedMs / 60000);
    const seconds = Math.floor((elapsedMs % 60000) / 1000);
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }, [currentTime]);

  // Clock tick for elapsed time
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
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

  if (loading) {
    return <div className="cashier-app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#fff', fontSize: '1.2rem' }}>Loading…</div>;
  }

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
              <div className="menu-item-grid">
                {pagedMenuItems.map((item) => (
                  <button key={item.id} className="menu-item-card" onClick={() => addMenuItem(item)}>
                    <span className="menu-item-image"><MenuImagePlaceholder /></span>
                    <span className="menu-item-name">{item.name}</span>
                    <span className="menu-item-bottom">
                      <span className="menu-item-price">{formatPrice(item.price)}</span>
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
            const isReserved = table.reserved;
            const elapsed = getElapsedTime(table);
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
                    {table.occupied ? 'OCCUPIED' : isReserved ? 'RESERVED' : 'AVAILABLE'}
                  </div>
                </div>
                <div className="table-card-footer">
                  {elapsed && <span className="table-card-timer">{elapsed}</span>}
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
              <div className="sidebar-header">
                <div>
                  <div className="bill-title">Order details</div>
                  <div className="bill-subtitle">Table #{selected.label}</div>
                </div>
              </div>

              <div className="items-list">
                {/* Show existing punched items from DB */}
                {groupedExistingItems.map((item) => {
                  const calculateItemTotal = (entry) => {
                    const entrySubtotal = (Number(entry.price) || 0) * (Number(entry.quantity) || 0);
                    const entryDiscount = (entry.pwd_discount ? entrySubtotal * 0.2 : 0)
                      + (entry.senior_discount ? entrySubtotal * 0.15 : 0)
                      + ((Number(entry.percent_discount) || 0) / 100 * entrySubtotal);
                    const afterPercent = Math.max(0, entrySubtotal - entryDiscount);
                    return Math.max(0, afterPercent - Math.min(afterPercent, Number(entry.float_discount) || 0));
                  };
                  const itemSubtotal = item.rows.reduce((sum, entry) => sum + (Number(entry.price) || 0) * (Number(entry.quantity) || 0), 0);
                  const itemTotal = item.rows.reduce((sum, entry) => sum + calculateItemTotal(entry), 0);
                  const isExpanded = expandedItemIds[item.id] || false;
                  const unitCount = Math.max(1, Number(item.quantity) || 1);
                  const itemUnits = item.rows.flatMap((entry) => Array.from({ length: Math.max(1, Number(entry.quantity) || 1) }, (_, index) => ({ entry, index })));
                  return (
                    <div key={item.id} className="item-group">
                      <div className="item-row">
                        <div className="item-content">
                          <div className="item-name">
                            {unitCount > 1 && (
                              <button className="item-expand-button" onClick={() => toggleItemExpansion(item.id)} title="Show individual items">
                                {isExpanded ? '▾' : '▸'}
                              </button>
                            )}
                            <span className="item-name-text">{item.item_name} × {item.quantity}</span>
                            <span className="item-status-pill" aria-label="Saved item" />
                          </div>
                        </div>
                        <div className="item-right">
                          <div className="item-right-main">
                            <span>{formatPrice(itemTotal)}</span>
                            <button className="item-discount-button" onClick={() => openItemDiscountModal(item)} title="Apply item discount">%</button>
                            <button
                              className="item-remove"
                              onClick={() => requestItemDecrease(item)}
                              title="Decrease quantity"
                            >
                              −
                            </button>
                          </div>
                        </div>
                      </div>
                      {isExpanded && unitCount > 1 && itemUnits.map(({ entry, index }, unitIndex) => (
                        <div key={`${entry.id}-unit-${index}`} className="item-row item-unit-row">
                          {(() => {
                            const unitEntry = { ...entry, quantity: 1 };
                            const unitTotal = calculateItemTotal(unitEntry);
                            const unitSubtotal = Number(entry.price) || 0;
                            const discountLines = [
                              entry.pwd_discount && { label: 'PWD discount', value: unitSubtotal * 0.2 },
                              entry.senior_discount && { label: 'Senior discount', value: unitSubtotal * 0.15 },
                              Number(entry.percent_discount) > 0 && { label: `${entry.percent_discount}% discount`, value: unitSubtotal * (Number(entry.percent_discount) / 100) },
                              Number(entry.float_discount) > 0 && { label: 'Fixed discount', value: Number(entry.float_discount) },
                            ].filter(Boolean);
                            return (
                              <>
                                <div className="item-content">
                                  <div className="item-name">
                                    <span className="item-name-text">{item.item_name}</span>
                                  </div>
                                  {discountLines.length > 0 && (
                                    <div className="item-discount-labels">
                                      {discountLines.map((discount) => (
                                        <div key={discount.label} className="item-discount-info">{discount.label}</div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="item-right">
                                  <div className="item-right-main">
                                    <span>{formatPrice(unitTotal)}</span>
                                    <button className="item-discount-button" onClick={() => openItemDiscountModal(entry, unitIndex)} title="Apply discount to this item">%</button>
                                    <button className="item-remove" onClick={() => requestItemDecrease(entry)} title="Remove this item">−</button>
                                  </div>
                                  {discountLines.length > 0 && (
                                    <div className="item-discount-values">
                                      {discountLines.map((discount) => (
                                        <div key={discount.label} className="item-discount-info">-{formatPrice(discount.value)}</div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  );
                })}
                {/* Show current unpunched cart items */}
                {cart.length === 0 && existingItems.length === 0 ? (
                  <div className="empty-items">No items yet. Add from below.</div>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="item-row pending">
                      <div>
                        <div className="item-name">{item.name} × {item.qty}</div>
                      </div>
                      <div className="item-right">
                        <span>{formatPrice(item.price * item.qty)}</span>
                        <button
                          className="item-remove"
                          onClick={() => removeItem(item.id)}
                          title="Decrease quantity"
                        >
                          −
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="summary">
                <div className="summary-row">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {selectedDiscounts.map((item) => (
                  <div className="summary-row" key={item.label}>
                    <span>{item.label}</span>
                    <span>-{formatPrice(item.amount)}</span>
                  </div>
                ))}
                <div className="summary-total">
                  <span>Total</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>

              <div className="sidebar-actions">
                {isMenuOrdering ? <>
                  <button className="clear-button" onClick={requestClearOrder} disabled={cart.length === 0}>
                    <span className="button-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 16 9-9 3 3-9 9H7v-3Zm10.7-10.7 1.1-1.1a1 1 0 0 1 1.4 0l.6.6a1 1 0 0 1 0 1.4L19.7 7l-2-1.7Z"/></svg></span>
                    Clear
                  </button>
                  <button className="punch-order-button" onClick={requestPunchOrder} disabled={cart.length === 0 || punchingOrder}>
                    <span className="button-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 2v5h10V5H7Zm0 9v5h10v-5H7Z"/></svg></span>
                    {punchingOrder ? 'Punching...' : 'Punch Order'}
                  </button>
                  <button className="cancel-order-button" onClick={requestCancelOrder} disabled={!(selected?.occupied && hasPunchedItems)}>
                    <span className="button-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4l5.6 5.6L5 17.6 6.4 19 12 13.4l5.6 5.6 1.4-1.4-5.6-5.6L19 6.4Z"/></svg></span>
                    Cancel Order
                  </button>
                </> : <>
                  <button className="discount-button" onClick={openTableDiscountModal}>
                    <span className="button-icon"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#000000"><path d="M856-390 570-104q-12 12-27 18t-30 6q-15 0-30-6t-27-18L103-457q-11-11-17-25.5T80-513v-287q0-33 23.5-56.5T160-880h287q16 0 31 6.5t26 17.5l352 353q12 12 17.5 27t5.5 30q0 15-5.5 29.5T856-390ZM513-160l286-286-353-354H160v286l353 354ZM260-640q25 0 42.5-17.5T320-700q0-25-17.5-42.5T260-760q-25 0-42.5 17.5T200-700q0 25 17.5 42.5T260-640Zm220 160Z"/></svg></span>
                    Discount
                  </button>
                  <button className="reserve-button" onClick={toggleReservation} disabled={selected?.occupied}>
                    <span className="button-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3-9H5V5h10v5z"/></svg></span>
                    {selected?.reserved ? 'Unreserve' : 'Reserve'}
                  </button>
                  <button className="bill-button" onClick={openPaymentModal} disabled={!hasItems}>
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
              <button className="modal-print" onClick={punchOrder}>{punchingOrder ? 'Punching...' : 'Punch Order'}</button>
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
              <button className="modal-print" onClick={() => { clearLocalCart(); setShowClearOrderModal(false); }}>Clear Order</button>
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
            <p className="modal-description">Toggle the discounts to apply for {discountTarget === 'item' ? `Item ${discountTargetItem?.item_name}` : `Table #${selected?.label}`}.</p>
            <div className="discount-toggles">
              <label className={`discount-toggle ${pwdDiscount ? 'active' : ''}`}>
                <input type="checkbox" checked={pwdDiscount} onChange={(e) => setPwdDiscount(e.target.checked)} />
                <span>PWD</span>
                <strong>20%</strong>
              </label>
              <label className={`discount-toggle ${seniorDiscount ? 'active' : ''}`}>
                <input type="checkbox" checked={seniorDiscount} onChange={(e) => setSeniorDiscount(e.target.checked)} />
                <span>Senior</span>
                <strong>15%</strong>
              </label>
            </div>
            <div className="custom-discount">
              <label>
                Percent discount
                <input
                  type="range"
                  min="0"
                  max={percentDiscountCap}
                  step="1"
                  value={normalizedPercentDiscountValue}
                  onChange={(e) => setPercentDiscountValue(e.target.value)}
                />
              </label>
              <div className="discount-caption">{normalizedPercentDiscountValue}% / max {percentDiscountCap}%</div>
            </div>
            <div className="custom-discount">
              <label>
                Specific Discount
                <input
                  type="number"
                  min="0"
                  max={floatDiscountCap}
                  step="0.01"
                  value={floatDiscountValue}
                  onChange={(e) => {
                    const rawValue = e.target.value;
                    if (rawValue === '') {
                      setFloatDiscountValue('');
                      return;
                    }
                    const clampedValue = Math.min(floatDiscountCap, Math.max(0, Number(rawValue) || 0));
                    setFloatDiscountValue(String(clampedValue));
                  }}
                />
              </label>
              <div className="discount-caption">Max {formatPrice(floatDiscountCap)}</div>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowDiscountModal(false)}>Cancel</button>
              <button className="modal-print" onClick={applyDiscount}>Apply</button>
            </div>
          </div>
        </div>
      )}

      {showDecreaseModal && pendingItem && (
        <div className="modal-backdrop" onClick={() => setShowDecreaseModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-heading">
              <div><p className="modal-kicker">DECREASE ITEM</p><h2>Remove one quantity?</h2></div>
              <button className="modal-icon-close" onClick={() => setShowDecreaseModal(false)} aria-label="Close">×</button>
            </div>
            <p className="modal-description">Decrease <strong>{pendingItem.item_name}</strong> by 1 from Table #{selected?.label}?</p>
            <div className="modal-actions">
              <button onClick={() => setShowDecreaseModal(false)}>Cancel</button>
              <button className="modal-print" onClick={confirmItemDecrease}>Confirm</button>
            </div>
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
            <p className="modal-description">Table #{selected?.label} · Total due <strong>{formatPrice(total)}</strong></p>
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
              <div><span>Subtotal</span><strong>{formatPrice(receipt.subtotal)}</strong></div>
              {receipt.discount > 0 && <div><span>Discount</span><strong>-{formatPrice(receipt.discount)}</strong></div>}
              <div className="receipt-total"><span>Total paid</span><strong>{formatPrice(receipt.total)}</strong></div>
            </div>
            <button className="modal-print receipt-done" onClick={() => setReceipt(null)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Cashier;
