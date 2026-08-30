import { useEffect, useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { usePOS } from '../../context/POSContext';
import { supabase } from '../../lib/supabaseClient';
import './restaurant-management.css';

const STATUSES = ['Available', 'Occupied', 'Reserved'];
const STATUS_MAP = { EMPTY: 'Available', OCCUPIED: 'Occupied', RESERVED: 'Reserved' };
const REVERSE_STATUS_MAP = { Available: 'EMPTY', Occupied: 'OCCUPIED', Reserved: 'RESERVED' };
const TABLES_PER_PAGE = 12;
const categorySlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const menuItemSlug = (item) => item.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
const menuPath = (category, item = null) => `/restaurant-management/edit-menu?category="${categorySlug(category.name)}"${item ? `&item="${menuItemSlug(item)}"` : ''}`;
const withPage = (path, page) => (page > 1 ? `${path}${path.includes('?') ? '&' : '?'}page=${page}` : path);
const unquoteQueryValue = (value) => (value ?? '').replace(/^"|"$/g, '');
const normalizeName = (name) => categorySlug(name);
const toTitleCase = (name) => name.trim().replace(/\s+/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const toSentenceCase = (text) => text.trim().replace(/\s+/g, ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());

function useFixedInterfaceCanvas() {
  const [, refreshScale] = useState(0);

  useEffect(() => {
    const updateScale = () => refreshScale((version) => version + 1);
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  if (typeof window === 'undefined') return { scale: 1, width: '100%', height: '100vh' };

  const pixelRatio = window.devicePixelRatio || 1;
  return {
    scale: 1 / pixelRatio,
    width: `${Math.round(window.innerWidth * pixelRatio)}px`,
    height: `${Math.round(window.innerHeight * pixelRatio)}px`,
  };
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
function MenuPanel({ mode, categories, onClose, onAddItem, onEditItem, onDeleteItem, onAddCategory, onEditCategory, onDeleteCategory }) {
  const [itemName, setItemName] = useState(mode?.type === 'editItem' ? mode.item.name : '');
  const [itemPrice, setItemPrice] = useState(mode?.type === 'editItem' ? String(mode.item.price) : '');
  const [itemDesc, setItemDesc] = useState(mode?.type === 'editItem' ? (mode.item.description || '') : '');
  const [itemCat, setItemCat] = useState(mode?.type === 'editItem' ? String(mode.item.categoryId) : String(categories[0]?.id ?? ''));
  const [catName, setCatName] = useState(mode?.type === 'editCategory' ? mode.category.name : '');
  const [formError, setFormError] = useState('');

  if (!mode) return null;

  const title = {
    addItem: 'Add Item',
    editItem: 'Edit Item',
    deleteItem: 'Delete Item',
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

  return (
    <div className="rmc2" onClick={onClose}>
      <div className="rmc3" onClick={(e) => e.stopPropagation()}>
        <div className="rmc4">
          <h2 className="rmc5">{title}</h2>
          <button className="rmc6" onClick={onClose}>✕</button>
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
            {mode.type === 'addItem' && (
              <div>
                <label className="rmc8">Category</label>
                <select required className="restaurant-management-input" value={itemCat} onChange={(e) => setItemCat(e.target.value)}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

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
              <button className="restaurant-management-button-secondary" onClick={onClose}>Cancel</button>
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
  const PER_PAGE = 5;

  const categorySlugFromRoute = unquoteQueryValue(new URLSearchParams(location.search).get('category'));
  const activeCategory = categories.find((cat) => categorySlug(cat.name) === categorySlugFromRoute) ?? categories[0];
  const activeCat = activeCategory?.id ?? '';

  const searchTerm = search.trim().toLowerCase();
  const selectedItemSlug = unquoteQueryValue(new URLSearchParams(location.search).get('item'));
  const selectedItem = selectedItemSlug ? items.find((item) => item.categoryId === activeCat && menuItemSlug(item) === selectedItemSlug) : null;
  const keywordMatches = searchTerm ? items.filter((item) => item.name.toLowerCase().includes(searchTerm)).slice(0, 6) : [];
  const filtered = selectedItem ? [selectedItem] : items.filter((it) => it.categoryId === activeCat);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const requestedPage = Number.parseInt(new URLSearchParams(location.search).get('page') || '1', 10);
  const currentPage = Math.min(Math.max(requestedPage || 1, 1), totalPages);
  const visible = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
  const pageStart = filtered.length === 0 ? 0 : (currentPage - 1) * PER_PAGE + 1;
  const pageEnd = Math.min(currentPage * PER_PAGE, filtered.length);

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
    if (activeCat === id) navigate(remaining[0] ? menuPath(remaining[0]) : '/restaurant-management/edit-menu');
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
  const goToMenuPage = (nextPage) => {
    const category = categories.find((cat) => cat.id === activeCat);
    if (!category) return;
    const safePage = Math.min(Math.max(nextPage, 1), totalPages);
    navigate(withPage(menuPath(category), safePage));
  };

  return (
    <div className="rmc22">
      <aside className="rmc29 restaurant-management-sidebar">
        <div className="rmc19 restaurant-management-sidebar-inner">
          <p className="rmc20">Categories</p>
          <div className="restaurant-management-category-divider" />
          <div className="rmc21 restaurant-management-category-list">
            {categories.map((cat) => (
              <div key={cat.id} className={`restaurant-management-category-row ${activeCat === cat.id ? 'restaurant-management-category-row-active' : ''}`}>
                <Link to={menuPath(cat)} onClick={selectCategory} className={`restaurant-management-category-button ${activeCat === cat.id ? 'restaurant-management-category-button-active' : 'restaurant-management-category-button-inactive'}`}>
                  {cat.name}
                </Link>
                <div className="restaurant-management-category-actions">
                  <button type="button" className="restaurant-management-category-action" onClick={() => setPanel({ type: 'editCategory', category: cat })} aria-label={`Edit ${cat.name}`}>
                    ✎
                  </button>
                  <button type="button" className="restaurant-management-category-action restaurant-management-category-action--delete" onClick={() => setPanel({ type: 'deleteCategory', category: cat })} aria-label={`Delete ${cat.name}`}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="restaurant-management-add-category" onClick={() => setPanel({ type: 'addCategory' })}>＋ Add Category</button>
        </div>
      </aside>

      <main className="rmc30">
        <div className="rmc31">
          <div className="rmc33">
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
          <button className="rmc36" onClick={() => setPanel({ type: 'addItem' })}>＋ New Item</button>
        </div>

        <div className="rmc41">
          {visible.length === 0 ? (
            <div className="rmc42"><GridIcon /><p className="rmc43">No items found</p></div>
          ) : (
            <>
              <div className="rmc53">
                <table className="rmc54">
                  <thead>
                    <tr className="rmc55">
                      <th className="rmc56">Image</th>
                      <th className="rmc57">Item Details</th>
                      <th className="rmc58">Price</th>
                      <th className="rmc59">Status</th>
                      <th className="rmc60">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((item, idx) => (
                      <tr key={item.id} className={`restaurant-management-table-row ${idx === visible.length - 1 ? 'restaurant-management-table-row-last' : ''}`}>
                        <td className="rmc61"><div className="rmc62"><ImageIcon /></div></td>
                        <td className="rmc61"><div className="rmc63">{item.name}</div><div className="rmc40">{item.description}</div></td>
                        <td className="rmc64">₱{item.price.toFixed(2)}</td>
                        <td className="rmc61"><span className="rmc65">{item.status || 'Active'}</span></td>
                        <td className="rmc66"><div className="rmc67"><button className="rmc51" onClick={() => setPanel({ type: 'editItem', item })} aria-label="Edit item">✎</button><button className="rmc52" onClick={() => setPanel({ type: 'deleteItem', item })} aria-label="Delete item">✕</button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="rmc105">
          <span className="rmc14">{pageStart}–{pageEnd} of {filtered.length}</span>
          <div className="rmc69">
            <button className="rmc106" disabled={currentPage <= 1} onClick={() => goToMenuPage(currentPage - 1)}>◀ Previous</button>
            <span className="rmc107">{currentPage} / {totalPages}</span>
            <button className="rmc106" disabled={currentPage >= totalPages} onClick={() => goToMenuPage(currentPage + 1)}>Next ▶</button>
          </div>
        </div>

      </main>

      {panel && (
        <MenuPanel mode={panel} categories={categories} onClose={() => setPanel(null)} onAddItem={addItem} onEditItem={editItem} onDeleteItem={deleteItem} onAddCategory={addCategory} onEditCategory={editCategory} onDeleteCategory={handleDeleteCategory} />
      )}
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
  } = usePOS();



  const [statusFilter, setStatusFilter] = useState('All');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const tables = useMemo(() =>
    dbTables.map((t) => ({
      id: t.table_number,
      dbId: t.id,
      status: STATUS_MAP[t.status] || 'Available',
      dbStatus: t.status,
    })),
    [dbTables]
  );

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
    navigate('/restaurant-management/table-list');
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
    navigate(withPage('/restaurant-management/table-list', safePage));
  };
  const selectStatusFilter = (status) => {
    setStatusFilter(status);
    setIsFilterOpen(false);
    navigate('/restaurant-management/table-list');
  };

  return (
    <div className="rmc90 table-management-layout">

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
              <div key={table.id} className={`table-management-card ${statusClass}`} title={normalizedStatus}>
                <div className="table-management-card-center">
                  <div className="table-management-number">{table.id}</div>
                  <div className="table-management-status-text">{normalizedStatus}</div>
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
          <button type="button" className="table-management-qr-button">Generate Customer QR Codes</button>
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
    </div>
  );
}

export default function RestaurantManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const interfaceCanvas = useFixedInterfaceCanvas();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const tab = location.pathname.includes('/table-list') ? 'tables' : 'menu';
  const menuRoute = location.pathname.includes('/edit-menu')
    ? `/restaurant-management/edit-menu${location.search || '?category="meals"'}`
    : '/restaurant-management/edit-menu?category="meals"';

  useEffect(() => {
    const intervalId = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(intervalId);
  }, []);

  const time = currentDateTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: "2-digit" });
  const date = currentDateTime.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return (
    <div className="rmc108 restaurant-management-root" style={{ '--restaurant-scale': interfaceCanvas.scale, '--restaurant-canvas-height': interfaceCanvas.height, width: interfaceCanvas.width, height: interfaceCanvas.height, minHeight: interfaceCanvas.height }}>
      <header className="rmc109">
        <div className="rmc110"><div className="rmc111"><GridIcon /></div><span className="rmc112">Restaurant Management Interface</span></div>
        <div className="rmc113">
          <div className="restaurant-management-date-time">{date}, {time}</div>
          <Link to="/" className="rmc114" aria-label="Return to interface selector" title="Return to interface selector"><ReturnIcon /></Link>
        </div>
      </header>

      <div className="rmc119">
        <div className="rmc120">{['menu', 'tables'].map((t) => (<button key={t} onClick={() => navigate(t === 'menu' ? menuRoute : '/restaurant-management/table-list')} className={`restaurant-management-tab ${tab === t ? 'restaurant-management-tab-active' : 'restaurant-management-tab-inactive'}`}>{t === 'menu' ? 'EDIT MENU' : 'MANAGE TABLES'}</button>))}</div>
      </div>

      <div className="rmc121">{tab === 'menu' ? <MenuInterface /> : <TableInterface />}</div>
    </div>
  );
}
