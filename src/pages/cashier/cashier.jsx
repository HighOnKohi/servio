import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePOS } from '../../context/POSContext';
import { useAuth } from '../../context/AuthContext';
import ScaleSelector, { useUIScale } from '../../components/ScaleSelector';
import ServioHeader from '../../components/ServioHeader';
import './cashier.css';
import Logo from "../../../public/Servio-Logo-B-Icon-Transparent.png"

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

// Isolated timer component — owns its own 1s tick so the parent never re-renders
const TableElapsedTimer = memo(function TableElapsedTimer({ occupiedSince, reservedSince, occupied, reserved }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  if (!occupied && !reserved) return null;
  const startedAt = occupied ? occupiedSince : reservedSince;
  if (!startedAt) return null;
  const elapsedMs = Date.now() - new Date(startedAt).getTime();
  if (elapsedMs < 0) return null;
  const minutes = Math.floor(elapsedMs / 60000);
  const seconds = Math.floor((elapsedMs % 60000) / 1000);
  return <span className="table-card-timer">{minutes}m {String(seconds).padStart(2, '0')}s</span>;
});

function useFixedInterfaceCanvas() {
  return { scale: 1, width: '100%', height: '100vh' };
}

/* ── Confirmation Modal for Cashier Logout / Exit ─────────────────────── */
function CashierLogoutModal({ onConfirmLogout, onSwitchInterface, onDismiss }) {
  return (
    <div className="kitchen-modal-overlay cashier-logout-overlay" onClick={onDismiss} role="dialog" aria-modal="true" aria-labelledby="cashier-logout-title">
      <div className="kitchen-modal-card kitchen-modal-card--lg" onClick={(e) => e.stopPropagation()}>
        <div className="kitchen-modal-header danger">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ width: 28, height: 28 }} aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <h2 id="cashier-logout-title">Exit Cashier Interface?</h2>
        </div>
        <p className="kitchen-modal-body">
          Are you sure you want to leave the Cashier interface? Any active tables and unbilled orders will remain saved.
        </p>
        <div className="kitchen-modal-actions kitchen-modal-actions--stacked">
          <button type="button" className="kitchen-modal-btn danger" onClick={onConfirmLogout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ width: 20, height: 20, marginRight: 8 }} aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Log Out Completely
          </button>
          <button type="button" className="kitchen-modal-btn switch-interface" onClick={onSwitchInterface}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ width: 20, height: 20, marginRight: 8 }} aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
            Switch to Interface Selector
          </button>
          <button type="button" className="kitchen-modal-btn secondary" onClick={onDismiss}>
            Stay on Cashier
          </button>
        </div>
      </div>
    </div>
  );
}

function Cashier() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const { scale: uiScale, changeScale: handleScaleChange, fontScale, elementScale } = useUIScale();

  const {
    tables: dbTables,
    menuItems: dbMenuItems,
    categories: dbCategories,
    orders,
    orderItems,
    getOrdersForTable,
    getItemsForOrder,
    createCustomerRequest,
    createOrder,
    addItemsToOrder,
    billOutTable,
    removeOrderItem,
    updateOrderStatus,
    reserveTable,
    applyTableDiscount,
    splitOrderItemUnit,
    applyItemDiscount,
    customerRequests,
    acceptCustomerRequest,
    cancelCustomerRequest,
    rejectCustomerRequestCashier,
    loading,
    formatPrice,
    tableBillOutPayments,
    tableAssistanceRequests,
    resolveTableAssistance,
    itemSales,
  } = usePOS();

  const BEST_SELLERS_CATEGORY = {
    id: 'best-sellers',
    name: 'Best Sellers',
    isBestSeller: true,
  };

  const menuCategories = useMemo(
    () => [
      BEST_SELLERS_CATEGORY,
      ...dbCategories.map((c) => ({ id: c.id, name: c.name })),
    ],
    [dbCategories]
  );

  const menuItems = useMemo(() =>
    dbMenuItems.map((m) => ({
      id: m.id,
      name: m.name,
      price: Number(m.price),
      category: m.category_id,
      image_url: m.image_url,
      status: m.status,
    })),
    [dbMenuItems]
  );

  const menuItemSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');

  const tables = useMemo(() =>
    dbTables.map((t) => ({
      id: t.table_number,
      label: String(t.table_number).padStart(2, '0'),
      dbId: t.id,
      status: t.status,
      capacity: Number(t.capacity) || 4,
      table_number: t.table_number,
      occupied: t.status === 'OCCUPIED',
      reserved: t.status === 'RESERVED' || t.reserved === true,
      request: t.status === 'REQUEST',
      occupiedSince: t.occupied_since,
      reservedSince: t.reserved_since,
      pwdDiscount: t.pwd_discount === true,
      seniorDiscount: t.senior_discount === true,
      percentDiscount: Number(t.percent_discount) || 0,
      floatDiscount: Number(t.float_discount) || 0,
      totalBill: Number(t.total_bill ?? t.current_bill ?? 0),
      currentBill: Number(t.current_bill ?? 0),
      billOutRequested: t.bill_out_requested === true,
      billOutPaymentMethod: tableBillOutPayments?.[t.table_number] || null,
      isAssistanceRequested: Boolean(
        tableAssistanceRequests?.[t.table_number]?.requested ||
        t.status === 'REQUEST'
      ),
      assistanceDetails: tableAssistanceRequests?.[t.table_number] || null,
    })),
    [dbTables, tableBillOutPayments, tableAssistanceRequests]
  );

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
  // Dismissed alert IDs for cancelled-order notifications — persisted to
  // sessionStorage so they don't reappear when the cashier page is refreshed.
  const [dismissedAlertIds, setDismissedAlertIds] = useState(() => {
    try {
      const stored = sessionStorage.getItem('cashier_dismissed_alerts');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [expandedItemIds, setExpandedItemIds] = useState(() => ({}));
  const [receipt, setReceipt] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [reservedTables, setReservedTables] = useState([]);
  const [punchingOrder, setPunchingOrder] = useState(false);
  const [pwdDiscount, setPwdDiscount] = useState(false);
  const [seniorDiscount, setSeniorDiscount] = useState(false);
  const [percentDiscountValue, setPercentDiscountValue] = useState('');
  const [floatDiscountValue, setFloatDiscountValue] = useState('');
  const [carts, setCarts] = useState({});
  const [showRequestsDrawer, setShowRequestsDrawer] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const requestsDrawerRef = useRef(null);
  const toggleButtonRef = useRef(null);

  const routeCategory = unquoteQueryValue(new URLSearchParams(location.search).get('category'));
  const routeItem = unquoteQueryValue(new URLSearchParams(location.search).get('item'));
  const routeMenuItem = menuItems.find((item) => menuItemSlug(item.name) === routeItem);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [menuSearch, setMenuSearch] = useState(() => routeMenuItem?.name ?? '');
  const [isMenuSearchOpen, setIsMenuSearchOpen] = useState(false);
  const interfaceCanvas = useFixedInterfaceCanvas();

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

  const selectedCustomerRequests = useMemo(
    () => customerRequests.filter(
      (request) => request.table_number === selected?.table_number && request.status === 'PENDING_CASHIER',
    ),
    [customerRequests, selected],
  );

  // Customer requests created by the cashier that are now pending kitchen verification
  const selectedPendingKitchenRequests = useMemo(
    () => customerRequests.filter(
      (request) => request.table_number === selected?.table_number && request.status === 'PENDING_KITCHEN',
    ),
    [customerRequests, selected],
  );

  // Merge pending items by menu_item_id to avoid duplicates
  const mergedPendingItems = useMemo(() => {
    const itemMap = new Map();
    selectedPendingKitchenRequests.forEach((request) => {
      (Array.isArray(request.items) ? request.items : []).forEach((item) => {
        const key = item.menu_item_id || item.id || item.name;
        const existing = itemMap.get(key);
        if (existing) {
          existing.quantity += Number(item.quantity) || 1;
        } else {
          itemMap.set(key, {
            ...item,
            quantity: Number(item.quantity) || 1,
          });
        }
      });
    });
    return Array.from(itemMap.values());
  }, [selectedPendingKitchenRequests]);

  // Customer requests flagged as UNAVAILABLE by kitchen for the selected table
  const selectedUnavailableRequests = useMemo(
    () => customerRequests.filter(
      (request) => request.table_number === selected?.table_number && request.status === 'UNAVAILABLE',
    ),
    [customerRequests, selected],
  );

  // Cancelled orders from Kitchen (across all tables) — show alerts
  const cancelledOrderAlerts = useMemo(
    () => orders.filter((o) => o.status === 'CANCELLED' && !dismissedAlertIds.has(o.id)),
    [orders, dismissedAlertIds],
  );

  // Tables with bill-out requested
  const billOutTables = useMemo(
    () => tables.filter((t) => t.billOutRequested),
    [tables],
  );

  const cart = carts[selectedId] || [];
  const existingSubtotal = existingItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const pendingSubtotal = mergedPendingItems.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const subtotal = existingSubtotal + pendingSubtotal + cartSubtotal;
  const getItemDiscountBreakdown = (entry) => {
    const entrySubtotal = (Number(entry.price) || 0) * (Number(entry.quantity) || 0);
    const tablePwdRate = selected?.pwdDiscount ? 20 : 0;
    const tableSeniorRate = selected?.seniorDiscount ? 15 : 0;
    const itemPwdRate = selected?.pwdDiscount ? 0 : (entry.pwd_discount ? 20 : 0);
    const itemSeniorRate = selected?.seniorDiscount ? 0 : (entry.senior_discount ? 15 : 0);
    const itemPercentRate = Math.min(100 - tablePwdRate - tableSeniorRate - itemPwdRate - itemSeniorRate, Math.max(0, Number(entry.percent_discount) || 0));
    const tablePwdAmount = entrySubtotal * (tablePwdRate / 100);
    const tableSeniorAmount = entrySubtotal * (tableSeniorRate / 100);
    const itemPwdAmount = entrySubtotal * (itemPwdRate / 100);
    const itemSeniorAmount = entrySubtotal * (itemSeniorRate / 100);
    const itemPercentAmount = entrySubtotal * (itemPercentRate / 100);
    const afterPercent = Math.max(0, entrySubtotal - tablePwdAmount - tableSeniorAmount - itemPwdAmount - itemSeniorAmount - itemPercentAmount);
    const itemFloatAmount = Math.min(afterPercent, Math.max(0, Number(entry.float_discount) || 0));
    return {
      total: Math.max(0, afterPercent - itemFloatAmount),
      itemOnlyDiscount: itemPwdAmount + itemSeniorAmount + itemPercentAmount + itemFloatAmount,
      tableCoveredDiscount: tablePwdAmount + tableSeniorAmount,
    };
  };
  const existingDiscountBreakdown = existingItems.reduce((sum, item) => {
    const breakdown = getItemDiscountBreakdown(item);
    return {
      total: sum.total + breakdown.total,
      itemOnlyDiscount: sum.itemOnlyDiscount + breakdown.itemOnlyDiscount,
      tableCoveredDiscount: sum.tableCoveredDiscount + breakdown.tableCoveredDiscount,
    };
  }, { total: 0, itemOnlyDiscount: 0, tableCoveredDiscount: 0 });
  const existingDiscountedTotal = existingDiscountBreakdown.total;
  const individualDiscount = +existingDiscountBreakdown.itemOnlyDiscount.toFixed(2);
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
  const tableDiscount = +(selectedDiscounts.reduce((sum, item) => sum + item.amount, 0) - existingDiscountBreakdown.tableCoveredDiscount).toFixed(2);
  const discount = +(individualDiscount + tableDiscount).toFixed(2);
  const total = +Math.max(0, subtotal - discount).toFixed(2);

  const tablesPerPage = 9;
  const totalTablePages = Math.max(1, Math.ceil(tables.length / tablesPerPage));
  const requestedPage = Number(new URLSearchParams(location.search).get('page')) || 1;
  const currentTablePage = Math.min(Math.max(requestedPage, 1), totalTablePages);
  const pageStart = (currentTablePage - 1) * tablesPerPage;
  const visibleTables = tables.slice(pageStart, pageStart + tablesPerPage);
  const menuSearchTerm = menuSearch.trim().toLowerCase();
  const menuKeywordMatches = menuSearchTerm
    ? menuItems.filter((item) => item.name.toLowerCase().includes(menuSearchTerm)).slice(0, 6)
    : [];
  const isBestSellerCategory = activeMenuCategory === 'best-sellers';
  const visibleMenuItems = useMemo(() => {
    if (isBestSellerCategory) {
      const top3PerCategory = [];
      const seenIds = new Set();

      // Collect top 3 of each category based on all-time sales
      dbCategories.forEach((cat) => {
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
        .filter((item) => !dbCategories.some((c) => c.id === item.category))
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
          if (menuSearchTerm && !item.name.toLowerCase().includes(menuSearchTerm)) {
            return false;
          }
          return true;
        });
    }
    // For standard categories: find the #1 best seller of this specific category
    const categoryItems = menuItems
      .filter((item) => item.category === activeMenuCategory)
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
        !menuSearchTerm || item.name.toLowerCase().includes(menuSearchTerm)
      );
  }, [menuItems, dbCategories, activeMenuCategory, isBestSellerCategory, menuSearchTerm, itemSales]);
  const menuItemsPerPage = 6;
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

  function addMenuItem(item) {
    if (item.status === 'SOLD OUT') return;
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

  async function punchOrder() {
    if (!selected || cart.length === 0 || punchingOrder) return;
    const availableCart = cart.filter((item) => item.status !== 'SOLD OUT');
    if (availableCart.length === 0) return;
    setPunchingOrder(true);
    try {
      // Check if there's an existing active order for this table
      const activeOrder = existingOrders.find(
        (order) => order.status !== 'COMPLETED' && order.status !== 'CANCELLED'
      );

      if (activeOrder) {
        // Add items to existing order
        await addItemsToOrder(activeOrder.id, availableCart.map((item) => ({
          id: item.id,
          menu_item_id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.qty,
        })));
      } else {
        // Create a new order directly (not a request)
        await createOrder(selected.table_number, 'Cashier', availableCart.map((item) => ({
          id: item.id,
          menu_item_id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.qty,
        })), 'DINE-IN');
      }

      // Clear the cart after successful punch
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
    const requestedMethod = selected?.billOutPaymentMethod || tableBillOutPayments?.[selected?.table_number];
    if (requestedMethod && ['cash', 'credit', 'qr'].includes(requestedMethod)) {
      setPaymentMethod(requestedMethod);
    } else {
      setPaymentMethod('cash');
    }
    setShowPaymentModal(true);
  }

  function goLogin() {
    setShowLogoutModal(true);
  }

  const handleConfirmLogout = useCallback(async () => {
    setShowLogoutModal(false);
    try {
      if (logout) await logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
    navigate('/login');
  }, [logout, navigate]);

  const handleSwitchInterface = useCallback(() => {
    setShowLogoutModal(false);
    navigate('/');
  }, [navigate]);

  async function completeBill() {
    if (!selected) return;
    try {
      await billOutTable(selected.table_number);
    } catch (err) {
      console.error('Error billing out table:', err);
    }
    setShowPaymentModal(false);
  }

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

  async function handleAcceptCustomerRequest(requestId) {
    const { error } = await acceptCustomerRequest(requestId);
    if (error) {
      console.error('Error accepting customer request:', error);
    }
  }

  async function printReceipt() {
    if (!selected) return;
    const printedAt = new Date();

    // Snapshot all order data BEFORE billOutTable deletes it
    const receiptItems = existingItems.map((entry) => {
      const entrySubtotal = (Number(entry.price) || 0) * (Number(entry.quantity) || 0);
      const entryPwdAmt = entry.pwd_discount ? entrySubtotal * 0.2 : 0;
      const entrySeniorAmt = entry.senior_discount ? entrySubtotal * 0.15 : 0;
      const entryPercentAmt = (Number(entry.percent_discount) || 0) / 100 * entrySubtotal;
      const afterPercent = Math.max(0, entrySubtotal - entryPwdAmt - entrySeniorAmt - entryPercentAmt);
      const entryFloatAmt = Math.min(afterPercent, Math.max(0, Number(entry.float_discount) || 0));
      const entryTotal = Math.max(0, afterPercent - entryFloatAmt);
      const discountLabels = [
        entry.pwd_discount && `PWD -${formatPrice(entryPwdAmt)}`,
        entry.senior_discount && `Senior -${formatPrice(entrySeniorAmt)}`,
        Number(entry.percent_discount) > 0 && `${entry.percent_discount}% off -${formatPrice(entryPercentAmt)}`,
        Number(entry.float_discount) > 0 && `Fixed -${formatPrice(entryFloatAmt)}`,
      ].filter(Boolean);
      return {
        name: entry.item_name,
        quantity: Number(entry.quantity) || 1,
        unitPrice: Number(entry.price) || 0,
        subtotalLine: entrySubtotal,
        totalLine: entryTotal,
        discountLabels,
      };
    });

    setReceipt({
      table: selected?.label,
      paymentMethod,
      subtotal,
      individualDiscount,
      tableDiscount,
      discount,
      total,
      selectedDiscounts,
      items: receiptItems,
      date: `${printedAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}, ${printedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}`,
    });

    // Bill out AFTER capturing snapshot
    await completeBill();
  }

  function triggerPrint() {
    if (!receipt) return;

    // Clean up any existing hidden thermal print iframe
    const oldFrame = document.getElementById('receipt-thermal-print-frame');
    if (oldFrame) {
      oldFrame.remove();
    }

    const printFrame = document.createElement('iframe');
    printFrame.id = 'receipt-thermal-print-frame';
    printFrame.setAttribute('aria-hidden', 'true');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.style.visibility = 'hidden';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow.document;
    const paymentLabel =
      receipt.paymentMethod === 'qr'
        ? 'InstaPay QR'
        : receipt.paymentMethod === 'credit'
        ? 'Credit Card'
        : 'Cash';

    const itemsHtml = (receipt.items || [])
      .map(
        (item) => `
      <div class="thermal-item-block">
        <div class="thermal-item-row">
          <span class="t-col-name">${item.name}</span>
          <span class="t-col-qty">${item.quantity}</span>
          <span class="t-col-price">${formatPrice(item.unitPrice)}</span>
          <span class="t-col-total">${formatPrice(item.subtotalLine)}</span>
        </div>
        ${(item.discountLabels || [])
          .map(
            (label) => `
          <div class="thermal-item-discount">  - ${label}</div>
        `
          )
          .join('')}
      </div>
    `
      )
      .join('');

    const discountsHtml = [
      receipt.individualDiscount > 0
        ? `<div class="thermal-total-row"><span>Item Discounts</span><span>-${formatPrice(receipt.individualDiscount)}</span></div>`
        : '',
      ...(receipt.selectedDiscounts || []).map(
        (d) => `<div class="thermal-total-row"><span>${d.label}</span><span>-${formatPrice(d.amount)}</span></div>`
      ),
      receipt.discount > 0
        ? `<div class="thermal-total-row"><span>Total Discount</span><span>-${formatPrice(receipt.discount)}</span></div>`
        : '',
    ].join('');

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt - Table #${receipt.table}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          html, body {
            width: 80mm;
            max-width: 80mm;
            background: #ffffff;
            color: #000000;
            font-family: 'Courier New', Courier, monospace, system-ui;
            font-size: 11px;
            line-height: 1.35;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .thermal-body {
            width: 80mm;
            max-width: 80mm;
            padding: 4mm 3mm;
            margin: 0 auto;
          }
          .thermal-header {
            text-align: center;
            margin-bottom: 2mm;
          }
          .thermal-brand {
            font-size: 17px;
            font-weight: 900;
            letter-spacing: 1px;
            text-transform: uppercase;
          }
          .thermal-tagline {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-top: 1px;
          }
          .thermal-dashed {
            border-top: 1px dashed #000000;
            margin: 2.5mm 0;
          }
          .thermal-double-dashed {
            border-top: 2px dashed #000000;
            margin: 2.5mm 0;
          }
          .thermal-meta-row {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            margin-bottom: 1.5px;
          }
          .thermal-meta-row strong {
            font-weight: 800;
          }
          .thermal-items-header {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 26px 50px 52px;
            font-weight: 900;
            font-size: 10px;
            letter-spacing: 0.5px;
            padding-bottom: 1mm;
            border-bottom: 1px dashed #000000;
            margin-bottom: 2mm;
            text-transform: uppercase;
          }
          .t-col-name {
            word-break: break-word;
            padding-right: 3px;
          }
          .t-col-qty { text-align: center; }
          .t-col-price { text-align: right; }
          .t-col-total { text-align: right; }
          .thermal-item-block {
            margin-bottom: 2mm;
          }
          .thermal-item-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 26px 50px 52px;
            align-items: baseline;
            font-size: 11px;
          }
          .thermal-item-discount {
            font-size: 10px;
            padding-left: 4px;
            margin-top: 1px;
          }
          .thermal-total-row {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            margin-bottom: 1.5px;
          }
          .thermal-grand-total {
            font-size: 14px;
            font-weight: 900;
            padding: 1mm 0;
          }
          .thermal-footer {
            text-align: center;
            font-size: 10px;
            line-height: 1.4;
            padding-top: 1mm;
          }
          .thermal-footer-bold {
            font-weight: 800;
          }
          .thermal-copy {
            font-size: 9px;
            margin-top: 2mm;
            letter-spacing: 1px;
          }
        </style>
      </head>
      <body>
        <div class="thermal-body">
          <div class="thermal-header">
            <div class="thermal-brand">SERVIO</div>
            <div class="thermal-tagline">Point of Sale System</div>
            <div class="thermal-tagline">Official Dining Receipt</div>
          </div>

          <div class="thermal-dashed"></div>

          <div class="thermal-meta-row"><span>Table:</span><strong>#${receipt.table}</strong></div>
          <div class="thermal-meta-row"><span>Date:</span><span>${receipt.date}</span></div>
          <div class="thermal-meta-row"><span>Payment:</span><strong>${paymentLabel}</strong></div>
          <div class="thermal-meta-row"><span>Status:</span><strong>COMPLETED / PAID</strong></div>

          <div class="thermal-dashed"></div>

          <div class="thermal-items-header">
            <span>ITEM</span>
            <span class="t-col-qty">QTY</span>
            <span class="t-col-price">PRICE</span>
            <span class="t-col-total">TOTAL</span>
          </div>

          <div>
            ${itemsHtml}
          </div>

          <div class="thermal-dashed"></div>

          <div class="thermal-total-row"><span>Subtotal</span><span>${formatPrice(receipt.subtotal)}</span></div>
          ${discountsHtml}

          <div class="thermal-double-dashed"></div>

          <div class="thermal-total-row thermal-grand-total">
            <span>TOTAL PAID</span>
            <span>${formatPrice(receipt.total)}</span>
          </div>
          <div class="thermal-total-row">
            <span>Payment Method</span>
            <strong>${paymentLabel}</strong>
          </div>

          <div class="thermal-dashed"></div>

          <div class="thermal-footer">
            <div class="thermal-footer-bold">THANK YOU FOR DINING WITH US!</div>
            <div>Please come again</div>
            <div class="thermal-copy">*** CUSTOMER COPY ***</div>
          </div>
        </div>
      </body>
      </html>
    `;

    doc.open();
    doc.write(receiptHtml);
    doc.close();

    setTimeout(() => {
      try {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
      } catch (err) {
        console.warn('Iframe print failed, falling back to window.print():', err);
        window.print();
      }
    }, 200);
  }

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

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selected) {
      if (selectedCustomerRequests.length > 0 || selectedUnavailableRequests.length > 0) {
        const timer = setTimeout(() => setShowRequestsDrawer(true), 150);
        return () => clearTimeout(timer);
      } else {
        setShowRequestsDrawer(false);
      }
    } else {
      setShowRequestsDrawer(false);
    }
  }, [selected?.id, selectedCustomerRequests.length, selectedUnavailableRequests.length]);

  // Close drawer when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showRequestsDrawer &&
        requestsDrawerRef.current &&
        toggleButtonRef.current &&
        !requestsDrawerRef.current.contains(event.target) &&
        !toggleButtonRef.current.contains(event.target)
      ) {
        setShowRequestsDrawer(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showRequestsDrawer]);

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
      className={`cashier-app cashier-app--scale-${uiScale}`}
      style={{
        '--servio-font-scale': fontScale,
        '--servio-elem-scale': elementScale,
        width: '100%',
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* ── Unified Kitchen-Style Header ── */}
      <ServioHeader
        title="Cashier Interface"
        group="FRONT OPS"
        uiScale={uiScale}
        onScaleChange={handleScaleChange}
      />
      {/* ── Kitchen Cancellation Alert Banners ── */}
      {cancelledOrderAlerts.length > 0 && (
        <div className="cashier-cancel-alerts" role="alert" aria-live="polite">
          {cancelledOrderAlerts.slice(0, 3).map((order) => (
            <div key={order.id} className="cashier-cancel-alert-banner">
              <span>
                🚫 <strong>Kitchen cancelled order</strong> for Table #{String(order.table_number).padStart(2, '0')}
              </span>
              <button
                type="button"
                className="cashier-cancel-alert-dismiss"
                onClick={() => setDismissedAlertIds((prev) => {
                  const next = new Set(prev).add(order.id);
                  try { sessionStorage.setItem('cashier_dismissed_alerts', JSON.stringify([...next])); } catch {}
                  return next;
                })}
                aria-label="Dismiss alert"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <nav className="tab-group" aria-label="Cashier sections">
        <button
          className={`tab ${!isMenuOrdering ? 'active' : ''}`}
          onClick={requestOverview}
        >
          TABLES
        </button>
        <button
          className={`tab ${isMenuOrdering ? 'active' : ''}`}
          onClick={() => navigate(menuOrderingPath())}
        >
          MENU ORDERING
        </button>
      </nav>

      <div className={`main ${isMenuOrdering ? 'menu-ordering-main' : ''}`}>
        {isMenuOrdering ? (
          <section className="menu-ordering-workspace">
            {/* ── Top bar: category pills + search ── */}
            <div className="menu-topbar">
              <div className="menu-topbar-left">
                {menuCategories.map((category) => (
                  <button
                    key={category.id}
                    className={`menu-pill ${category.isBestSeller ? 'menu-pill--best-seller' : ''} ${activeMenuCategory === category.id ? 'active' : ''}`}
                    onClick={() => selectCategory(category.id)}
                  >
                    {category.name}
                    <span className="menu-pill-count">
                      {category.isBestSeller
                        ? visibleMenuItems.length
                        : menuItems.filter((i) => i.category === category.id).length}
                    </span>
                  </button>
                ))}
              </div>
              <div className="menu-topbar-right">
                <div className="menu-search-field">
                  <svg className="menu-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <input
                    className="menu-search-input"
                    type="search"
                    placeholder="Search Menu"
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
                          <span className="menu-keyword-image">
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.name} className="menu-keyword-photo" />
                            ) : (
                              <MenuImagePlaceholder />
                            )}
                          </span>
                          <span className="menu-keyword-details"><strong>{item.name}</strong><small>{menuCategories.find((category) => category.id === item.category)?.name ?? 'Uncategorized'}</small></span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Menu grid (4 columns, photo cards) ── */}
            <div className="menu-catalog">
              <div className="menu-item-grid">
                {pagedMenuItems.map((item) => {
                  const inCart = cart.find((ci) => ci.id === item.id);
                  const isSoldOut = item.status === 'SOLD OUT';
                  return (
                    <div key={item.id} className={`menu-item-card ${isSoldOut ? 'is-sold-out' : ''}`}>
                      <div className="menu-item-image-wrap">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="menu-item-photo" />
                        ) : (
                          <div className="menu-item-photo-placeholder"><MenuImagePlaceholder /></div>
                        )}
                        <span className={`menu-item-availability ${isSoldOut ? 'unavailable' : 'available'}`}>
                          <span className="availability-dot" />
                          {isSoldOut ? 'Not Available' : 'Available'}
                        </span>
                        {item.isTopBestSeller && item.soldCount > 0 && (
                          <span className="menu-item-bestseller-badge">Best Seller</span>
                        )}
                      </div>
                      <div className="menu-item-footer">
                        <div className="menu-item-info">
                          <span className="menu-item-name">{item.name}</span>
                          <span className="menu-item-price">{formatPrice(item.price)}</span>
                        </div>
                        {isSoldOut ? (
                          <button className="menu-item-btn menu-item-btn--unavailable" disabled>
                            <span>✕</span> Not Available
                          </button>
                        ) : inCart ? (
                          <button className="menu-item-btn menu-item-btn--more" onClick={() => addMenuItem(item)}>
                            Add More ({inCart.qty})
                          </button>
                        ) : (
                          <button className="menu-item-btn menu-item-btn--add" onClick={() => addMenuItem(item)}>
                            <span>+</span> Add to Cart
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {visibleMenuItems.length === 0 && (
                  <div className="menu-empty-state">
                    <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔥</div>
                    <h3>No Best Sellers Recorded Yet</h3>
                    <p>Items will appear here ranked by sales as orders are placed.</p>
                  </div>
                )}
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
          {tables.some((t) => t.isAssistanceRequested) && (
            <div className="cashier-assistance-banner" role="alert">
              <div className="cashier-assistance-banner-left">
                <span className="cashier-assistance-bell-ring">🛎️</span>
                <div>
                  <strong>Assistance Requested ({tables.filter((t) => t.isAssistanceRequested).length} {tables.filter((t) => t.isAssistanceRequested).length === 1 ? 'Table' : 'Tables'})</strong>
                  <div className="cashier-assistance-banner-pills">
                    {tables.filter((t) => t.isAssistanceRequested).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="cashier-assistance-pill"
                        onClick={() => selectTable(t.id)}
                        title={`Go to Table #${t.id}`}
                      >
                        Table #{t.label}: {t.assistanceDetails?.type || 'Assistance'}
                        <span className="pill-action-arrow">→</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="action-row">
            <div className="table-summary">
              <span><strong>{tables.filter((table) => !table.occupied && !table.request && !table.reserved).length}</strong> available</span>
              <span><strong>{tables.filter((table) => table.occupied).length}</strong> occupied</span>
              <span><strong>{tables.filter((table) => table.reserved).length}</strong> reserved</span>
              <span><strong>{tables.filter((table) => table.request).length}</strong> requests</span>
            </div>
          </div>
          <div className="table-grid">
          {visibleTables.map((table) => {
            const isReserved = table.reserved;
            const isRequest = table.request;
            const elapsed = getElapsedTime(table);
            const tableStateClass = isRequest
              ? 'request'
              : table.occupied
                ? 'occupied'
                : isReserved
                  ? 'reserved'
                  : 'available';
            const tableStatusLabel = isRequest
              ? 'REQUESTS'
              : table.occupied
                ? 'OCCUPIED'
                : isReserved
                  ? 'RESERVED'
                  : 'AVAILABLE';
            return (
              <div
                key={table.id}
                className={`table-card ${table.id === selectedId ? 'selected' : ''} ${tableStateClass} ${table.billOutRequested ? 'bill-out-alert' : ''}`}
                onClick={() => selectTable(table.id)}
              >
                {table.billOutRequested && (
                  <div
                    className="table-card-billout-badge"
                    title={`Customer requested bill out${table.billOutPaymentMethod ? ` (${table.billOutPaymentMethod === 'qr' ? 'InstaPay QR' : table.billOutPaymentMethod === 'credit' ? 'Credit Card' : 'Cash'})` : ''}`}
                  >
                    🧾{table.billOutPaymentMethod ? ` ${table.billOutPaymentMethod === 'qr' ? 'QR' : table.billOutPaymentMethod === 'credit' ? 'Card' : 'Cash'}` : ''}
                  </div>
                )}
                {table.isAssistanceRequested && (
                  <div
                    className="table-card-assistance-badge"
                    title={`Assistance requested: ${table.assistanceDetails?.type || 'Staff Needed'}${table.assistanceDetails?.note ? ` - ${table.assistanceDetails.note}` : ''}`}
                  >
                    🛎️ {table.assistanceDetails?.type || 'Assistance'}
                  </div>
                )}
                <div className="table-card-center">
                  <div className="table-number">{table.label}</div>
                  <div className={`table-status ${isRequest ? 'request' : ''}`}>
                    {tableStatusLabel}
                  </div>
                  <div className="table-pax" title={`Seating Capacity: ${table.capacity} PAX`}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                    <span>{table.capacity} PAX</span>
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
          <div className="sidebar-title">Order Summary</div>
          {selected && (
            <>
              <div className="order-summary-items">
                {groupedExistingItems.map((item) => {
                  const calculateItemTotal = (entry) => {
                    const entrySubtotal = (Number(entry.price) || 0) * (Number(entry.quantity) || 0);
                    const entryDiscount = (entry.pwd_discount ? entrySubtotal * 0.2 : 0)
                      + (entry.senior_discount ? entrySubtotal * 0.15 : 0)
                      + ((Number(entry.percent_discount) || 0) / 100 * entrySubtotal);
                    const afterPercent = Math.max(0, entrySubtotal - entryDiscount);
                    return Math.max(0, afterPercent - Math.min(afterPercent, Number(entry.float_discount) || 0));
                  };
                  const itemTotal = item.rows.reduce((sum, entry) => sum + calculateItemTotal(entry), 0);
                  const menuItem = menuItems.find((m) => m.id === item.menu_item_id);
                  return (
                    <div key={item.id} className="order-summary-item">
                      <div className="order-summary-item-img">
                        {menuItem?.image_url ? (
                          <img src={menuItem.image_url} alt={item.item_name} />
                        ) : (
                          <div className="order-summary-item-img-placeholder"><MenuImagePlaceholder /></div>
                        )}
                      </div>
                      <div className="order-summary-item-info">
                        <span className="order-summary-item-name">{item.item_name} <span className="order-summary-item-qty">({item.quantity})</span></span>
                        {(item.notes || item.modifiers) && (
                          <span className="order-summary-item-notes">{[item.notes, item.modifiers].filter(Boolean).join(' · ')}</span>
                        )}
                        <span className="order-summary-item-price">{formatPrice(itemTotal)}</span>
                      </div>
                      <div className="order-summary-item-actions">
                        <button className="order-summary-icon-btn" onClick={() => openItemDiscountModal(item)} title="Discount">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m7 17 10-10M9 7h.01M15 17h.01"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></svg>
                        </button>
                        <button className="order-summary-icon-btn order-summary-icon-btn--delete" onClick={() => requestItemDecrease(item)} title="Remove">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
                {cart.map((item) => (
                  <div key={`cart-${item.id}`} className="order-summary-item order-summary-item--cart">
                    <div className="order-summary-item-img">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} />
                      ) : (
                        <div className="order-summary-item-img-placeholder"><MenuImagePlaceholder /></div>
                      )}
                    </div>
                    <div className="order-summary-item-info">
                      <span className="order-summary-item-name">{item.name} <span className="order-summary-item-qty">({item.qty})</span></span>
                      <span className="order-summary-item-price">{formatPrice(item.price * item.qty)}</span>
                    </div>
                    <div className="order-summary-item-actions">
                      <button className="order-summary-icon-btn order-summary-icon-btn--delete" onClick={() => removeItem(item.id)} title="Remove">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
                {!hasItems && (
                  <div className="order-summary-empty">No items added yet.</div>
                )}
              </div>

              <div className="order-summary-totals">
                <div className="summary-row"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
                <div className="summary-row"><span>Taxes</span><span>{formatPrice(subtotal * 0.1)}</span></div>
                {discount > 0 && (
                  <div className="summary-row summary-row--discount"><span>Discount</span><span>-{formatPrice(discount)}</span></div>
                )}
                <div className="summary-row summary-row--total"><span>Total Payment</span><span>{formatPrice(total)}</span></div>
              </div>

              <div className="order-summary-meta">
                <div className="order-meta-row">
                  <span>Order Type</span>
                  <span className="order-meta-value">Dine-in <span className="order-meta-chevron">▾</span></span>
                </div>
                <div className="order-meta-row">
                  <span>Select Table</span>
                  <span className="order-meta-value">
                    {selected ? `Table ${String(selected.label).padStart(2, '0')}` : '—'}
                    <span className="order-meta-chevron">▾</span>
                  </span>
                </div>
              </div>

              {discount > 0 && (
                <div className="order-discount-hint">
                  <span className="order-discount-dot" />
                  <span>{Math.round((discount / subtotal) * 100)}% Discount applied</span>
                </div>
              )}

              <div className="sidebar-actions">
                {isMenuOrdering ? (
                  <button className="confirm-payment-btn" onClick={requestPunchOrder} disabled={cart.length === 0 || punchingOrder}>
                    {punchingOrder ? 'Punching...' : 'Punch Order'}
                  </button>
                ) : (
                  <button className="confirm-payment-btn" onClick={openPaymentModal} disabled={!hasItems}>
                    Confirm Payment
                  </button>
                )}
              </div>
            </>
          )}
        </aside>

        {/* Floating Customer Requests Drawer */}
        {selected && !isMenuOrdering && (
          <>
            {/* Toggle button always visible */}
            <button 
              ref={toggleButtonRef}
              className={`requests-drawer-toggle-top ${showRequestsDrawer ? 'active' : ''}`}
              onClick={() => setShowRequestsDrawer(!showRequestsDrawer)}
              title={showRequestsDrawer ? 'Hide Requests' : 'Show Requests'}
            >
              {showRequestsDrawer ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                  </svg>
                  {(selectedCustomerRequests.length > 0 || selectedUnavailableRequests.length > 0) && (
                    <span className="requests-badge-top">!</span>
                  )}
                </>
              )}
            </button>
            
            <aside ref={requestsDrawerRef} className={`requests-drawer ${showRequestsDrawer ? 'open' : ''}`}>
              <div className="requests-drawer-header">
                <div>
                  <div className="requests-drawer-title">Customer Requests</div>
                  <div className="requests-drawer-subtitle">Pending cashier approval</div>
                </div>
              </div>
              
              <div className="requests-drawer-content">
                {selectedCustomerRequests.length === 0 && selectedUnavailableRequests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✓</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#475569', marginBottom: 6 }}>No Pending Requests</div>
                    <div style={{ fontSize: '0.85rem' }}>This table has no customer requests at the moment.</div>
                  </div>
                ) : (
                  <>
                    {selectedUnavailableRequests.map((request) => (
                      <div key={request.id} className="request-section">
                        <div className="request-message">{request.rejection_reason || 'Kitchen flagged some items as unavailable'}</div>
                        <div className="request-items">
                          {(Array.isArray(request.unavailable_items) ? request.unavailable_items : []).map((item, index) => (
                            <div key={`unavail-${request.id}-${item.id || item.name || index}`} className="request-item request-item--error">
                              <span className="request-item-icon">✕</span>
                              <span className="request-item-name">{item.name || item.item_name}</span>
                              <span className="request-item-qty">× {Number(item.quantity) || 1}</span>
                            </div>
                          ))}
                        </div>
                        <div className="request-divider"></div>
                      </div>
                    ))}
                    
                    {selectedCustomerRequests.map((request, idx) => (
                      <div key={request.id} className="request-section">
                        <div className="request-items">
                          {(Array.isArray(request.items) ? request.items : []).map((item, index) => (
                            <div key={`${request.id}-${item.id || item.name || index}`} className="request-item">
                              <span className="request-item-name">{item.name || item.item_name}</span>
                              <span className="request-item-qty">× {Number(item.quantity) || 1}</span>
                            </div>
                          ))}
                        </div>
                        {idx < selectedCustomerRequests.length - 1 && <div className="request-divider"></div>}
                      </div>
                    ))}
                  </>
                )}
              </div>
              
              {(selectedCustomerRequests.length > 0 || selectedUnavailableRequests.length > 0) && (
                <div className="requests-drawer-footer">
                  {selectedUnavailableRequests.length > 0 ? (
                    <button
                      className="request-footer-button request-footer-button--danger"
                      onClick={() => rejectCustomerRequestCashier(selectedUnavailableRequests[0].id, selectedUnavailableRequests[0].table_number)}
                    >
                      Notify Customer to Modify Order
                    </button>
                  ) : (
                    <>
                      <button
                        className="request-footer-button request-footer-button--accept"
                        onClick={() => handleAcceptCustomerRequest(selectedCustomerRequests[0].id)}
                      >
                        Accept Request
                      </button>
                      <button
                        className="request-footer-button request-footer-button--cancel"
                        onClick={() => cancelCustomerRequest(selectedCustomerRequests[0].id)}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              )}
            </aside>
          </>
        )}
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
                {selected?.billOutPaymentMethod === 'cash' && (
                  <span className="payment-customer-pick">Customer Choice</span>
                )}
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
                {selected?.billOutPaymentMethod === 'credit' && (
                  <span className="payment-customer-pick">Customer Choice</span>
                )}
              </label>
              <label>
                <input
                  type="radio"
                  name="payment"
                  value="qr"
                  checked={paymentMethod === 'qr'}
                  onChange={() => setPaymentMethod('qr')}
                />
                InstaPay QR
                {selected?.billOutPaymentMethod === 'qr' && (
                  <span className="payment-customer-pick">Customer Choice</span>
                )}
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
        <div className="modal-backdrop receipt-backdrop" onClick={() => setReceipt(null)}>
          <div className="modal receipt-modal" id="receipt-printable" onClick={(e) => e.stopPropagation()}>
            {/* ── Header ── */}
            <div className="receipt-header">
              <div className="receipt-brand">SERVIO</div>
              <p className="receipt-tagline">Point of Sale System</p>
              <p className="receipt-tagline">Official Dining Receipt</p>
            </div>

            {/* ── Meta ── */}
            <div className="receipt-meta">
              <div><span>Table</span><strong>#{receipt.table}</strong></div>
              <div><span>Date</span><strong>{receipt.date}</strong></div>
              <div><span>Payment</span><strong>{receipt.paymentMethod === 'qr' ? 'InstaPay QR' : receipt.paymentMethod === 'credit' ? 'Credit Card' : 'Cash'}</strong></div>
              <div><span>Status</span><strong>COMPLETED / PAID</strong></div>
            </div>

            {/* ── Itemized list ── */}
            <div className="receipt-items-section">
              <div className="receipt-items-header">
                <span>Item</span><span>Qty</span><span>Price</span><span>Total</span>
              </div>
              {(receipt.items || []).map((item, i) => (
                <div key={i} className="receipt-item-block">
                  <div className="receipt-item-row">
                    <span className="receipt-item-name">{item.name}</span>
                    <span className="receipt-item-qty">{item.quantity}</span>
                    <span className="receipt-item-price">{formatPrice(item.unitPrice)}</span>
                    <span className="receipt-item-total">{formatPrice(item.subtotalLine)}</span>
                  </div>
                  {item.discountLabels.length > 0 && (
                    <div className="receipt-item-discounts">
                      {item.discountLabels.map((label, di) => (
                        <span key={di} className="receipt-item-discount-tag">- {label}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* ── Totals ── */}
            <div className="receipt-totals">
              <div className="receipt-totals-row"><span>Subtotal</span><span>{formatPrice(receipt.subtotal)}</span></div>
              {receipt.individualDiscount > 0 && (
                <div className="receipt-totals-row receipt-totals-discount"><span>Item Discounts</span><span>-{formatPrice(receipt.individualDiscount)}</span></div>
              )}
              {(receipt.selectedDiscounts || []).map((d) => (
                <div key={d.label} className="receipt-totals-row receipt-totals-discount"><span>{d.label}</span><span>-{formatPrice(d.amount)}</span></div>
              ))}
              {receipt.discount > 0 && (
                <div className="receipt-totals-row receipt-totals-discount"><span>Total Discount</span><span>-{formatPrice(receipt.discount)}</span></div>
              )}
              <div className="receipt-totals-row receipt-grand-total"><span>Total Paid</span><span>{formatPrice(receipt.total)}</span></div>
            </div>

            <p className="receipt-footer-note">
              <strong>THANK YOU FOR DINING WITH US!</strong><br />
              Please come again<br />
              <small>*** CUSTOMER COPY ***</small>
            </p>

            {/* ── Actions (hidden on print) ── */}
            <div className="receipt-actions no-print">
              <button className="receipt-print-button" onClick={triggerPrint}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6 9V2h12v7" /><rect x="6" y="14" width="12" height="8" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <circle cx="18" cy="11.5" r=".5" fill="currentColor" />
                </svg>
                Print Receipt
              </button>
              <button className="receipt-done-button" onClick={() => setReceipt(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
      {showLogoutModal && (
        <CashierLogoutModal
          onConfirmLogout={handleConfirmLogout}
          onSwitchInterface={handleSwitchInterface}
          onDismiss={() => setShowLogoutModal(false)}
        />
      )}
    </div>
  );
}

export default Cashier;
