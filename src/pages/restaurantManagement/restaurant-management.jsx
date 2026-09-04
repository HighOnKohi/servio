import { useEffect, useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { usePOS } from '../../context/POSContext';
import { supabase } from '../../lib/supabaseClient';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import ScaleSelector, { useUIScale } from '../../components/ScaleSelector';
import ServioHeader from '../../components/ServioHeader';
import './restaurant-management.css';

const STATUSES = ['Available', 'Occupied', 'Reserved', 'Request'];
const STATUS_MAP = { EMPTY: 'Available', OCCUPIED: 'Occupied', RESERVED: 'Reserved', REQUEST: 'Request' };

function CustomerQrCodeModal({ tables, onClose }) {
  const [enabledTableNumbers, setEnabledTableNumbers] = useState(() => new Set(tables.map((table) => table.table_number)));
  const [generating, setGenerating] = useState(false);

  const toggleTable = (tableNumber) => {
    setEnabledTableNumbers((previous) => {
      const next = new Set(previous);
      if (next.has(tableNumber)) next.delete(tableNumber);
      else next.add(tableNumber);
      return next;
    });
  };

  const generatePdf = async () => {
    const selectedTables = tables.filter((table) => enabledTableNumbers.has(table.table_number));
    if (selectedTables.length === 0 || generating) return;

    setGenerating(true);
    try {
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const cardWidth = 84;
      const cardHeight = 84;
      const gap = 10;
      const startX = (pageWidth - (cardWidth * 2 + gap)) / 2;
      const startY = 30;

      pdf.setFontSize(18);
      pdf.text('Customer Table QR Codes', pageWidth / 2, 18, { align: 'center' });

      for (let index = 0; index < selectedTables.length; index += 1) {
        const table = selectedTables[index];
        const position = index % 4;
        if (index > 0 && position === 0) pdf.addPage();
        const column = position % 2;
        const row = Math.floor(position / 2);
        const x = startX + column * (cardWidth + gap);
        const y = startY + row * (cardHeight + gap);
        const customerUrl = `${CUSTOMER_INTERFACE_ORIGIN}/customer/${table.table_number}`;
        const qrDataUrl = await QRCode.toDataURL(customerUrl, { margin: 1, width: 640, errorCorrectionLevel: 'M' });

        pdf.setDrawColor(210, 218, 230);
        pdf.roundedRect(x, y, cardWidth, cardHeight, 3, 3);
        pdf.addImage(qrDataUrl, 'PNG', x + 12, y + 8, 60, 60);
        pdf.setFontSize(14);
        pdf.setTextColor(15, 23, 42);
        pdf.text(`Table ${String(table.table_number).padStart(2, '0')}`, x + cardWidth / 2, y + 75, { align: 'center' });
      }

      pdf.save('customer-table-qr-codes.pdf');
      onClose();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="customer-qr-modal-overlay" onClick={onClose}>
      <section className="customer-qr-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="customer-qr-modal-title">
        <div className="customer-qr-modal-header">
          <div>
            <p className="customer-qr-modal-kicker">Table setup</p>
            <h2 id="customer-qr-modal-title">Generate Customer QR Codes</h2>
            <p>Select the tables to include in the downloadable PDF.</p>
          </div>
          <button type="button" className="customer-qr-modal-close" onClick={onClose} aria-label="Close QR code generator">×</button>
        </div>
        <div className="customer-qr-table-list">
          {tables.map((table) => {
            const enabled = enabledTableNumbers.has(table.table_number);
            return (
              <button key={table.id} type="button" className={`customer-qr-table-toggle ${enabled ? 'enabled' : 'disabled'}`} onClick={() => toggleTable(table.table_number)} aria-pressed={enabled}>
                <span>Table {String(table.table_number).padStart(2, '0')}</span>
                <small>{enabled ? 'Included' : 'Excluded'}</small>
              </button>
            );
          })}
        </div>
        <div className="customer-qr-modal-footer">
          <span>{enabledTableNumbers.size} of {tables.length} tables selected</span>
          <button type="button" className="customer-qr-generate-button" onClick={generatePdf} disabled={enabledTableNumbers.size === 0 || generating}>
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </section>
    </div>
  );
}

const TABLES_PER_PAGE = 12;
const CUSTOMER_INTERFACE_ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';
const categorySlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const menuItemSlug = (item) => item.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
const menuPath = (category, item = null) => `/menu-manager?category="${categorySlug(category.name)}"${item ? `&item="${menuItemSlug(item)}"` : ''}`;
const withPage = (path, page) => (page > 1 ? `${path}${path.includes('?') ? '&' : '?'}page=${page}` : path);
const unquoteQueryValue = (value) => (value ?? '').replace(/^"|"$/g, '');
const normalizeName = (name) => categorySlug(name);
const toTitleCase = (name) => name.trim().replace(/\s+/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const toSentenceCase = (text) => text.trim().replace(/\s+/g, ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());

function useFixedInterfaceCanvas() {
  return { scale: 1, width: '100%', height: '100vh' };
}

/* Simple SVG icons (kept inline for clarity) */
function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
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

function HelpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.7 9a2.5 2.5 0 1 1 3.8 2.1c-.9.55-1.5 1-1.5 2.2" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21,15 16,10 5,21" />
    </svg>
  );
}

function StatusBadge({ status }) {
  const cls = `restaurant-management-status-badge restaurant-management-status-badge--${status.toLowerCase()}`;
  return <span className={cls}>{status}</span>;
}

/* Panel used for Add/Edit/Delete of items and categories */
function MenuPanel({ mode, categories, activeCategoryId, onClose, onAddItem, onEditItem, onDeleteItem, onAddCategory, onEditCategory, onDeleteCategory }) {
  const [itemName, setItemName] = useState(mode?.type === 'editItem' ? mode.item.name : '');
  const [itemPrice, setItemPrice] = useState(mode?.type === 'editItem' ? String(mode.item.price) : '');
  const [itemDesc, setItemDesc] = useState(mode?.type === 'editItem' ? (mode.item.description || '') : '');
  const itemCat = mode?.type === 'editItem' ? String(mode.item.categoryId) : String(activeCategoryId ?? '');
  const [catName, setCatName] = useState(mode?.type === 'editCategory' ? mode.category.name : '');
  const [formError, setFormError] = useState('');

  if (!mode) return null;

  const title = {
    addItem: 'Add Menu Item',
    editItem: 'Edit Menu Item',
    deleteItem: 'Delete Menu Item',
    addCategory: 'Add Category',
    editCategory: 'Edit Category',
    deleteCategory: 'Delete Category',
  }[mode.type] || 'Panel';

  const handleAddOrSave = async () => {
    if (mode.type === 'addItem') {
      if (!itemName.trim() || !itemPrice.trim() || !itemDesc.trim() || !itemCat) {
        setFormError('Please complete every item field.');
        return;
      }
      if (itemDesc.trim().length < 20) {
        setFormError('Description must contain at least 20 characters.');
        return;
      }
      if (itemDesc.trim().length > 120) {
        setFormError('Description cannot exceed 120 characters.');
        return;
      }
      if (Number(itemPrice) <= 0 || Number(itemPrice) > 10000) {
        setFormError('Price must be between ₱0.01 and ₱10,000.00.');
        return;
      }
      const formattedName = toTitleCase(itemName);
      const result = await onAddItem({ name: formattedName, price: parseFloat(itemPrice), description: toSentenceCase(itemDesc), category_id: itemCat });
      if (result === false) {
        setFormError('An item with this name already exists.');
        return;
      }
    } else if (mode.type === 'editItem') {
      if (!itemName.trim() || !itemPrice.trim() || !itemDesc.trim()) {
        setFormError('Please complete every item field.');
        return;
      }
      if (itemDesc.trim().length < 20) {
        setFormError('Description must contain at least 20 characters.');
        return;
      }
      if (itemDesc.trim().length > 120) {
        setFormError('Description cannot exceed 120 characters.');
        return;
      }
      if (Number(itemPrice) <= 0 || Number(itemPrice) > 10000) {
        setFormError('Price must be between ₱0.01 and ₱10,000.00.');
        return;
      }
      const result = await onEditItem(mode.item.id, { name: toTitleCase(itemName), price: parseFloat(itemPrice), description: toSentenceCase(itemDesc) });
      if (result === false) {
        setFormError('An item with this name already exists.');
        return;
      }
    } else if (mode.type === 'addCategory') {
      if (!catName.trim()) {
        setFormError('Please enter a category name.');
        return;
      }
      const formattedName = toTitleCase(catName);
      const result = await onAddCategory(formattedName);
      if (result === false) {
        setFormError('A category with this name already exists.');
        return;
      }
    } else if (mode.type === 'editCategory') {
      if (!catName.trim()) {
        setFormError('Please enter a category name.');
        return;
      }
      const result = await onEditCategory(mode.category.id, { name: toTitleCase(catName) });
      if (result === false) {
        setFormError('A category with this name already exists.');
        return;
      }
    }
    onClose();
  };

  const isItemPanel = mode.type.includes('Item');
  const isDeletePanel = mode.type.startsWith('delete');

  return (
    <div className="rmc2 menu-manager-modal-overlay" onClick={onClose}>
      <div className={`rmc3 menu-manager-modal ${isItemPanel ? 'menu-manager-modal--item' : 'menu-manager-modal--category'} ${isDeletePanel ? 'menu-manager-modal--danger' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="rmc4 menu-manager-modal-header">
          <div>
            <span className="menu-manager-modal-kicker">Menu Manager</span>
            <h2 className="rmc5">{title}</h2>
          </div>
          <button type="button" className="rmc6 menu-manager-modal-close" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        {(mode.type === 'addItem' || mode.type === 'editItem') && (
          <div className="rmc7">
            <div>
              <label className="rmc8">Item Name</label>
              <input required className="restaurant-management-input" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g. Chicken Burger" />
            </div>
            <div>
              <label className="rmc8">Price (₱)</label>
              <input required type="number" min="0.01" max="10000" step="0.01" className="restaurant-management-input" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} />
            </div>
            <div>
              <label className="rmc8">Description</label>
              <textarea required maxLength={120} className="restaurant-management-input restaurant-management-textarea" rows={3} value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} />
            </div>
            <div>
              <label className="rmc8">Upload Picture</label>
              <div className="restaurant-management-image-placeholder restaurant-management-image-placeholder--md">
                <ImageIcon />
                <span className="rmc1">Image</span>
              </div>
            </div>

            {formError && <p className="restaurant-management-form-error">{formError}</p>}
            <div className="rmc9">
              <button className="restaurant-management-button-primary" onClick={handleAddOrSave}>{mode.type === 'addItem' ? 'Add Item' : 'Save Changes'}</button>
              {mode.type === 'editItem' ? (
                <button className="restaurant-management-button-danger" onClick={() => { onDeleteItem(mode.item.id); onClose(); }}>Delete</button>
              ) : (
                <button className="restaurant-management-button-secondary" onClick={onClose}>Cancel</button>
              )}
            </div>
          </div>
        )}

        {mode.type === 'deleteItem' && (
          <div className="rmc7">
            <p className="rmc10">Are you sure you want to delete this item?</p>
            <div className="rmc11">
              <div className="rmc12"><ImageIcon /></div>
              <div>
                <div className="rmc13">{mode.item.name}</div>
                <div className="rmc14">₱{mode.item.price}</div>
              </div>
            </div>
            <div className="rmc15">
              <button className="restaurant-management-button-primary" onClick={() => { onDeleteItem(mode.item.id); onClose(); }}>Delete</button>
              <button className="restaurant-management-button-secondary" onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}

        {(mode.type === 'addCategory' || mode.type === 'editCategory') && (
          <div className="rmc7">
            <div>
              <label className="rmc8">Category Name</label>
              <input required className="restaurant-management-input" value={catName} onChange={(e) => setCatName(e.target.value)} />
            </div>
            {formError && <p className="restaurant-management-form-error">{formError}</p>}
            <div className="rmc9">
              <button className="restaurant-management-button-primary" onClick={handleAddOrSave}>{mode.type === 'addCategory' ? 'Add Category' : 'Save'}</button>
              <button className="restaurant-management-button-secondary" onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}

        {mode.type === 'deleteCategory' && (
          <div className="rmc7">
            <p className="rmc10">Are you sure you want to delete this category?</p>
            <div className="rmc16">
              <div className="rmc13">{mode.category.name}</div>
              <div className="rmc17">All items in this category will be removed.</div>
            </div>
            <div className="rmc15">
              <button className="restaurant-management-button-primary" onClick={() => { onDeleteCategory(mode.category.id); onClose(); }}>Delete</button>
              <button className="restaurant-management-button-secondary" onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MenuInterface() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    categories: dbCategories,
    menuItems: dbMenuItems,
    addMenuItem: posAddMenuItem,
    updateMenuItem: posUpdateMenuItem,
    deleteMenuItem: posDeleteMenuItem,
    addCategory: posAddCategory,
    updateCategory: posUpdateCategory,
    deleteCategory: posDeleteCategory,
  } = usePOS();

  // Map DB data to component-friendly shapes
  const categories = useMemo(() =>
    dbCategories.map((c) => ({ id: c.id, name: c.name })),
    [dbCategories]
  );

  const items = useMemo(() =>
    dbMenuItems.map((m) => ({
      id: m.id,
      name: m.name,
      price: Number(m.price),
      description: m.description || '',
      categoryId: m.category_id,
      status: m.status,
    })),
    [dbMenuItems]
  );

  const [search, setSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [panel, setPanel] = useState(null);

  const categorySlugFromRoute = unquoteQueryValue(new URLSearchParams(location.search).get('category'));
  const activeCategory = categories.find((cat) => categorySlug(cat.name) === categorySlugFromRoute) ?? categories[0];
  const activeCat = activeCategory?.id ?? '';

  const searchTerm = search.trim().toLowerCase();
  const selectedItemSlug = unquoteQueryValue(new URLSearchParams(location.search).get('item'));
  const selectedItem = selectedItemSlug ? items.find((item) => item.categoryId === activeCat && menuItemSlug(item) === selectedItemSlug) : null;
  const keywordMatches = searchTerm ? items.filter((item) => item.name.toLowerCase().includes(searchTerm)).slice(0, 6) : [];
  const filtered = selectedItem ? [selectedItem] : items.filter((it) => it.categoryId === activeCat);
  const visible = filtered;

  // CRUD wired to POSContext
  const addItem = async (item) => {
    if (items.some((existing) => normalizeName(existing.name) === normalizeName(item.name))) return false;
    await posAddMenuItem(item);
    return true;
  };
  const editItem = async (id, updates) => {
    if (items.some((existing) => existing.id !== id && normalizeName(existing.name) === normalizeName(updates.name))) return false;
    await posUpdateMenuItem(id, updates);
    return true;
  };
  const deleteItem = async (id) => {
    await posDeleteMenuItem(id);
  };
  const addCategory = async (name) => {
    if (categories.some((existing) => normalizeName(existing.name) === normalizeName(name))) return false;
    await posAddCategory(name);
    return true;
  };
  const editCategory = async (id, updates) => {
    if (categories.some((existing) => existing.id !== id && normalizeName(existing.name) === normalizeName(updates.name))) return false;
    await posUpdateCategory(id, updates);
    return true;
  };
  const handleDeleteCategory = async (id) => {
    await posDeleteCategory(id);
    const remaining = categories.filter((c) => c.id !== id);
    if (activeCat === id) navigate(remaining[0] ? menuPath(remaining[0]) : '/menu-manager');
  };

  const selectCategory = () => {
    setSearch('');
    setIsSearchOpen(false);
  };
  const selectKeyword = (item) => {
    const category = categories.find((cat) => cat.id === item.categoryId);
    if (!category) return;
    setSearch(item.name);
    setIsSearchOpen(false);
    navigate(menuPath(category, item));
  };
  return (
    <div className="rmc22 menu-manager-layout">
      <aside className="rmc29 restaurant-management-sidebar menu-manager-sidebar">
        <div className="rmc19 restaurant-management-sidebar-inner">
          <div className="menu-manager-sidebar-heading">
            <p className="rmc20">Categories</p>
            <button type="button" className="menu-manager-add-category-icon" onClick={() => setPanel({ type: 'addCategory' })} aria-label="Add category">＋</button>
          </div>
          <div className="rmc21 restaurant-management-category-list">
            {categories.map((cat) => (
              <div key={cat.id} className={`restaurant-management-category-row ${activeCat === cat.id ? 'restaurant-management-category-row-active' : ''}`}>
                <Link to={menuPath(cat)} onClick={selectCategory} className="restaurant-management-category-button">
                  <span>{cat.name}</span>
                </Link>
                <div className="restaurant-management-category-actions">
                  <button type="button" className="restaurant-management-category-action" onClick={() => setPanel({ type: 'editCategory', category: cat })} aria-label={`Edit ${cat.name}`}>✎</button>
                  <button type="button" className="restaurant-management-category-action restaurant-management-category-action--delete" onClick={() => setPanel({ type: 'deleteCategory', category: cat })} aria-label={`Delete ${cat.name}`}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="rmc30 menu-manager-main">
        <div className="menu-manager-content-header">
          <h1>{activeCategory?.name || 'Menu Items'}</h1>
        </div>

        <div className="menu-manager-toolbar">
          <div className="rmc33 menu-manager-search">
            <span className="menu-manager-search-icon" aria-hidden="true">⌕</span>
            <input
              className="rmc35"
              placeholder="Search menu items..."
              value={search}
              onFocus={() => setIsSearchOpen(true)}
              onChange={(e) => {
                setSearch(e.target.value);
                setIsSearchOpen(true);
                if (activeCategory) navigate(menuPath(activeCategory));
              }}
            />
            {isSearchOpen && keywordMatches.length > 0 && (
              <div className="restaurant-management-keyword-dropdown" role="listbox" aria-label="Matching menu items">
                {keywordMatches.map((item) => {
                  const category = categories.find((cat) => cat.id === item.categoryId);
                  return (
                    <button key={item.id} type="button" className="restaurant-management-keyword-option" onClick={() => selectKeyword(item)}>
                      <span className="restaurant-management-keyword-image"><ImageIcon /></span>
                      <span className="restaurant-management-keyword-details"><strong>{item.name}</strong><small>{category?.name ?? 'Uncategorized'}</small></span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <span className="menu-manager-result-count">{filtered.length} {filtered.length === 1 ? 'item' : 'items'}</span>
          <button className="rmc36 menu-manager-new-item" onClick={() => setPanel({ type: 'addItem' })}>＋ New Item</button>
        </div>

        <div className="menu-manager-items-area">
          <div key={activeCat} className="menu-manager-category-transition">
            {visible.length === 0 ? (
              <div className="rmc42 menu-manager-empty"><GridIcon /><p className="rmc43">No items found</p></div>
            ) : (
              <div className="menu-manager-card-grid">
              {visible.map((item) => {
                const isInactive = String(item.status || '').toUpperCase() === 'INACTIVE';
                return (
                  <article
                    key={item.id}
                    className={`menu-manager-card ${isInactive ? 'inactive' : ''}`}
                    onClick={() => setPanel({ type: 'editItem', item })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setPanel({ type: 'editItem', item });
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Edit ${item.name}`}
                  >
                    <div className="menu-manager-card-image">
                      <ImageIcon />
                      <span className={`menu-manager-status ${isInactive ? 'inactive' : 'active'}`}>{isInactive ? 'Inactive' : 'Active'}</span>
                    </div>
                    <div className="menu-manager-card-body">
                      <div className="menu-manager-card-title-row">
                        <h2>{item.name}</h2>
                      </div>
                      <p>{item.description || 'No description provided.'}</p>
                      <div className="menu-manager-card-footer">
                        <span className="menu-manager-card-price">₱{item.price.toFixed(2)}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          </div>
        </div>
      </main>

      {panel && (
        <MenuPanel mode={panel} categories={categories} activeCategoryId={activeCat} onClose={() => setPanel(null)} onAddItem={addItem} onEditItem={editItem} onDeleteItem={deleteItem} onAddCategory={addCategory} onEditCategory={editCategory} onDeleteCategory={handleDeleteCategory} />
      )}
    </div>
  );
}

/* Edit Table Form (used inside the Edit Table Modal) */
function EditTableForm({ table, onSave, onCancel }) {
  const [capacity, setCapacity] = useState(table.capacity || 4);
  const [status, setStatus] = useState(table.dbStatus || 'EMPTY');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ capacity: Number(capacity), status });
    setSaving(false);
  };

  return (
    <div className="edit-table-form">
      <div className="edit-table-form-row">
        <label htmlFor={`edit-capacity-${table.id}`}>Seating Capacity (Pax)</label>
        <div className="edit-table-capacity-control">
          <button type="button" onClick={() => setCapacity((c) => Math.max(1, c - 1))} aria-label="Decrease capacity">−</button>
          <input
            id={`edit-capacity-${table.id}`}
            type="number"
            value={capacity}
            min={1}
            max={30}
            onChange={(e) => setCapacity(Math.min(30, Math.max(1, Number(e.target.value) || 1)))}
            aria-label="Seating capacity"
          />
          <button type="button" onClick={() => setCapacity((c) => Math.min(30, c + 1))} aria-label="Increase capacity">+</button>
        </div>
      </div>
      <div className="edit-table-form-row">
        <label htmlFor={`edit-status-${table.id}`}>Table Status</label>
        <select
          id={`edit-status-${table.id}`}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="EMPTY">Available (Empty)</option>
          <option value="OCCUPIED">Occupied</option>
          <option value="RESERVED">Reserved</option>
        </select>
      </div>
      <div className="edit-table-form-actions">
        <button type="button" className="edit-table-btn secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="edit-table-btn primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

/* Table Interface */
function TableInterface() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    tables: dbTables,
    addTable: posAddTable,
    removeTable: posRemoveTable,
    refetchTables,
    updateTableDetails,
  } = usePOS();



  const [statusFilter, setStatusFilter] = useState('All');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  const tables = useMemo(() =>
    dbTables.map((t) => ({
      id: t.table_number,
      dbId: t.id,
      status: STATUS_MAP[t.status] || 'Available',
      dbStatus: t.status,
      capacity: Number(t.capacity) || 4,
    })),
    [dbTables]
  );

  const [editTableTarget, setEditTableTarget] = useState(null); // { table } | null

  const tableCount = tables.length;

  const updateCount = async (n) => {
    const clamped = Math.max(0, Math.min(100, n));
    if (clamped > tableCount) {
      for (let i = tableCount + 1; i <= clamped; i++) {
        await posAddTable(i, 4);
      }
    } else if (clamped < tableCount) {
      const sorted = [...dbTables].sort((a, b) => b.table_number - a.table_number);
      for (let i = 0; i < tableCount - clamped; i++) {
        if (sorted[i]) await posRemoveTable(sorted[i].id);
      }
    }
    navigate('/table-manager');
  };

  const cycleStatus = async (tableNum) => {
    const table = dbTables.find((t) => t.table_number === tableNum);
    if (!table) return;
    const currentIdx = ['EMPTY', 'OCCUPIED', 'RESERVED'].indexOf(table.status);
    const nextStatus = ['EMPTY', 'OCCUPIED', 'RESERVED'][(currentIdx + 1) % 3];
    await supabase.from('restaurant_tables').update({ status: nextStatus }).eq('id', table.id);
    await refetchTables();
  };

  const filteredTables = statusFilter === 'All' ? tables : tables.filter((t) => t.status === statusFilter);
  const totalPages = Math.max(1, Math.ceil(filteredTables.length / TABLES_PER_PAGE));
  const requestedPage = Number.parseInt(new URLSearchParams(location.search).get('page') || '1', 10);
  const currentPage = Math.min(Math.max(requestedPage || 1, 1), totalPages);
  const visible = filteredTables.slice((currentPage - 1) * TABLES_PER_PAGE, currentPage * TABLES_PER_PAGE);
  const countByStatus = (s) => tables.filter((t) => t.status === s).length;
  const goToTablePage = (nextPage) => {
    const safePage = Math.min(Math.max(nextPage, 1), totalPages);
    navigate(withPage('/table-manager', safePage));
  };
  const selectStatusFilter = (status) => {
    setStatusFilter(status);
    setIsFilterOpen(false);
    navigate('/table-manager');
  };

  return (
    <div className="rmc90 table-management-layout">

      {/* ── Edit Table Modal ── */}
      {editTableTarget && (
        <div className="edit-table-modal-overlay" onClick={() => setEditTableTarget(null)}>
          <div className="edit-table-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="edit-table-title">
            <div className="edit-table-modal-header">
              <h2 id="edit-table-title">Edit Table #{editTableTarget.id}</h2>
              <button type="button" className="edit-table-modal-close" onClick={() => setEditTableTarget(null)} aria-label="Close">×</button>
            </div>
            <EditTableForm
              table={editTableTarget}
              onSave={async (updates) => {
                await updateTableDetails(editTableTarget.dbId, updates);
                setEditTableTarget(null);
              }}
              onCancel={() => setEditTableTarget(null)}
            />
          </div>
        </div>
      )}

      <aside className="rmc92">
        <div className="rmc82">
          <div className="rmc86">
            <p className="rmc20">Status Key</p>
            <div className="rmc87 status-key">
              {STATUSES.map((s) => (
                <div key={s} className="status-key-row">
                  <span className="status-key-label">{s}</span>
                  <span className={`status-key-count status-key-count--${s.toLowerCase()}`}>{countByStatus(s)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
      <main className="rmc30 table-management-area">
        <div className="rmc93">
          <div className="table-management-summary" aria-label="Table status summary">
            {STATUSES.map((status) => <span key={status}><strong>{countByStatus(status)}</strong> {status.toLowerCase()}</span>)}
          </div>
        </div>

        <div className="table-management-grid">
          {visible.length === 0 ? (
            <div className="table-management-empty"><GridIcon /><p>No tables found</p></div>
          ) : visible.map((table) => {
            const normalizedStatus = table.status === 'EMPTY' ? 'AVAILABLE' : table.status;
            const statusClass = normalizedStatus.toLowerCase();
            return (
              <div
                key={table.id}
                className={`table-management-card ${statusClass}`}
                title={`Table ${table.id} — ${normalizedStatus}`}
                onClick={() => setEditTableTarget(table)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setEditTableTarget(table)}
              >
                <div className="table-management-card-center">
                  <div className="table-management-number">{table.id}</div>
                  <div className="table-management-status-text">{normalizedStatus}</div>
                  <div className="table-management-pax">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                    {table.capacity} pax
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rmc41">
          {visible.length === 0 ? (
            <div className="rmc42"><GridIcon /><p className="rmc43">No tables found</p></div>
          ) : (
            <div className="rmc53">
              <table className="rmc54">
                <thead>
                  <tr className="rmc98"><th className="rmc99">#</th><th className="rmc100">Table</th><th className="rmc101">Status</th></tr>
                </thead>
                <tbody>
                  {visible.map((table) => (
                    <tr key={table.id} className="restaurant-management-table-row"><td className="rmc102">{table.id}</td><td className="rmc103">Table {table.id}</td><td className="rmc104"><button onClick={() => cycleStatus(table.id)} title="Click to cycle status"><StatusBadge status={table.status} /></button></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rmc105">
          <span className="rmc14">{filteredTables.length ? Math.min((currentPage - 1) * TABLES_PER_PAGE + 1, filteredTables.length) : 0}–{Math.min(currentPage * TABLES_PER_PAGE, filteredTables.length)} of {filteredTables.length}</span>
          <div className="rmc69">
            <button className="rmc106" disabled={currentPage <= 1} onClick={() => goToTablePage(currentPage - 1)}>◀ Previous</button>
            <span className="rmc107">{currentPage} / {totalPages}</span>
            <button className="rmc106" disabled={currentPage >= totalPages} onClick={() => goToTablePage(currentPage + 1)}>Next ▶</button>
          </div>
        </div>
      </main>

      <aside className="table-counter-panel">
        <div className="table-counter-heading table-counter-heading-actions">
          <button type="button" className="table-management-qr-button" onClick={() => setIsQrModalOpen(true)}>Generate Customer QR Codes</button>
        </div>
        <div className="table-counter-control">
          <button onClick={() => updateCount(tableCount - 1)} aria-label="Remove table">−</button>
          <input type="number" value={tableCount} onChange={(e) => { const count = parseInt(e.target.value, 10); updateCount(Number.isNaN(count) ? 0 : count); }} min={0} max={100} aria-label="Table count" />
          <button onClick={() => updateCount(tableCount + 1)} aria-label="Add table">+</button>
        </div>
        <div className="table-filter-control">
          <button className="table-filter-toggle" onClick={() => setIsFilterOpen((open) => !open)} aria-expanded={isFilterOpen}>
            <span aria-hidden="true">⌕</span> Filter <small>{statusFilter}</small>
          </button>
          {isFilterOpen && (
            <div className="table-filter-options" role="menu" aria-label="Filter tables by status">
              {['All', ...STATUSES].map((status) => (
                <button key={status} className={statusFilter === status ? 'active' : ''} onClick={() => selectStatusFilter(status)} role="menuitem">{status}</button>
              ))}
            </div>
          )}
        </div>
      </aside>
      {isQrModalOpen && <CustomerQrCodeModal tables={dbTables} onClose={() => setIsQrModalOpen(false)} />}
    </div>
  );
}

export default function RestaurantManagement({ managerType = 'menu' }) {
  const interfaceCanvas = useFixedInterfaceCanvas();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const { scale: uiScale, changeScale: handleScaleChange, fontScale, elementScale } = useUIScale();
  const isTableManager = managerType === 'tables';

  useEffect(() => {
    const intervalId = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(intervalId);
  }, []);

  const time = currentDateTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: "2-digit" });
  const date = currentDateTime.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return (
    <div className={`rmc108 restaurant-management-root ${isTableManager ? 'table-manager-root' : 'menu-manager-root'} restaurant-management-root--scale-${uiScale}`} style={{ '--servio-font-scale': fontScale, '--servio-elem-scale': elementScale, width: '100%', height: '100vh', maxHeight: '100vh', overflow: 'hidden' }}>
      <ServioHeader
        title={isTableManager ? 'Table Manager' : 'Menu Manager'}
        group="MANAGEMENT"
        uiScale={uiScale}
        onScaleChange={handleScaleChange}
        customActions={
          !isTableManager ? (
            <button
              type="button"
              className="restaurant-management-help"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid #475569',
                borderRadius: 10,
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                width: 44,
                height: 44,
              }}
              aria-label="Menu Manager help"
              title="Help"
            >
              <HelpIcon />
            </button>
          ) : null
        }
      />

      <div className="rmc121">{isTableManager ? <TableInterface /> : <MenuInterface />}</div>
    </div>
  );
}
