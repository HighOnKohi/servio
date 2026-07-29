import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './restaurant-management.css';

const INIT_CATEGORIES = [
  { id: 1, name: 'Meals' },
  { id: 2, name: 'Drinks' },
  { id: 3, name: 'Desserts' },
  { id: 4, name: 'Snacks' },
];

const INIT_ITEMS = [
  { id: 1, name: 'Chicken Burger', price: 120, description: 'Juicy chicken burger with fries', categoryId: 1 },
  { id: 2, name: 'Beef Burger', price: 145, description: 'Classic beef patty with lettuce and tomato', categoryId: 1 },
  { id: 3, name: 'Grilled Chicken', price: 180, description: 'Oven-grilled chicken with herb seasoning', categoryId: 1 },
  { id: 4, name: 'Strawberry Shake', price: 75, description: 'Fresh strawberry blended shake', categoryId: 2 },
  { id: 5, name: 'Coke', price: 40, description: 'Chilled Coca-Cola 330ml', categoryId: 2 },
  { id: 6, name: 'Iced Tea', price: 50, description: 'Sweetened iced tea with lemon', categoryId: 2 },
  { id: 7, name: 'Cheesecake Slice', price: 95, description: 'Creamy New York-style cheesecake', categoryId: 3 },
  { id: 8, name: 'Fries', price: 60, description: 'Crispy golden french fries', categoryId: 4 },
];

const STATUSES = ['Available', 'Occupied', 'Reserved'];
function makeInitTables(n) {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1, status: STATUSES[i % STATUSES.length] }));
}

const TABLES_PER_PAGE = 10;

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

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
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
  const [itemDesc, setItemDesc] = useState(mode?.type === 'editItem' ? mode.item.description : '');
  const [itemCat, setItemCat] = useState(mode?.type === 'editItem' ? String(mode.item.categoryId) : String(categories[0]?.id ?? ''));
  const [catName, setCatName] = useState(mode?.type === 'editCategory' ? mode.category.name : '');

  if (!mode) return null;

  const title = {
    addItem: 'Add Item',
    editItem: 'Edit Item',
    deleteItem: 'Delete Item',
    addCategory: 'Add Category',
    editCategory: 'Edit Category',
    deleteCategory: 'Delete Category',
  }[mode.type] || 'Panel';

  const handleAddOrSave = () => {
    if (mode.type === 'addItem') {
      if (!itemName.trim()) return;
      onAddItem({ id: Date.now(), name: itemName, price: parseFloat(itemPrice) || 0, description: itemDesc, categoryId: parseInt(itemCat) });
    } else if (mode.type === 'editItem') {
      onEditItem({ ...mode.item, name: itemName, price: parseFloat(itemPrice) || 0, description: itemDesc });
    } else if (mode.type === 'addCategory') {
      if (!catName.trim()) return;
      onAddCategory({ id: Date.now(), name: catName });
    } else if (mode.type === 'editCategory') {
      onEditCategory({ ...mode.category, name: catName });
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
              <input className="restaurant-management-input" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g. Chicken Burger" />
            </div>
            <div>
              <label className="rmc8">Price (₱)</label>
              <input type="number" className="restaurant-management-input" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} />
            </div>
            <div>
              <label className="rmc8">Description</label>
              <textarea className="restaurant-management-input restaurant-management-textarea" rows={3} value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} />
            </div>
            {mode.type === 'addItem' && (
              <div>
                <label className="rmc8">Category</label>
                <select className="restaurant-management-input" value={itemCat} onChange={(e) => setItemCat(e.target.value)}>
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
              <input className="restaurant-management-input" value={catName} onChange={(e) => setCatName(e.target.value)} />
            </div>
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
  const [categories, setCategories] = useState(INIT_CATEGORIES);
  const [items, setItems] = useState(INIT_ITEMS);
  const [activeCat, setActiveCat] = useState(INIT_CATEGORIES[0].id);
  const [search, setSearch] = useState('');
  const [panel, setPanel] = useState(null);
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const filtered = items.filter((it) => it.categoryId === activeCat && it.name.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
  const pageStart = filtered.length === 0 ? 0 : (currentPage - 1) * PER_PAGE + 1;
  const pageEnd = Math.min(currentPage * PER_PAGE, filtered.length);

  const addItem = (item) => setItems((prev) => [...prev, item]);
  const editItem = (updated) => setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  const deleteItem = (id) => setItems((prev) => prev.filter((i) => i.id !== id));
  const addCategory = (cat) => setCategories((prev) => [...prev, cat]);
  const editCategory = (updated) => setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  const deleteCategory = (id) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setItems((prev) => prev.filter((i) => i.categoryId !== id));
    if (activeCat === id) setActiveCat(categories.find((c) => c.id !== id)?.id ?? 0);
  };

  const selectCategory = (id) => { setActiveCat(id); setPage(1); };

  return (
    <div className="rmc22">
      <aside className="rmc29">
        <div className="rmc19">
          <p className="rmc20">Categories</p>
          <div className="rmc21">
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => selectCategory(cat.id)} className={`restaurant-management-category-button ${activeCat === cat.id ? 'restaurant-management-category-button-active' : 'restaurant-management-category-button-inactive'}`}>{cat.name}</button>
            ))}
          </div>
        </div>
      </aside>

      <main className="rmc30">
        <div className="rmc31">
          <div className="rmc33">
            <input className="rmc35" placeholder="Search menu items..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <button className="rmc36" onClick={() => setPanel({ type: 'addItem' })}>＋ New Item</button>
        </div>

        <div className="rmc38">
          <div>
            <h2 className="rmc39">{categories.find((c) => c.id === activeCat)?.name ?? 'All'}</h2>
            <p className="rmc40">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</p>
          </div>
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
                        <td className="rmc61"><span className="rmc65">Active</span></td>
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
            <button className="rmc106" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>◀ Previous</button>
            <span className="rmc107">{currentPage} / {totalPages}</span>
            <button className="rmc106" disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)}>Next ▶</button>
          </div>
        </div>

      </main>

      <aside className="rmc71">
        <div>
          <p className="rmc20">Quick Stats</p>
          <div className="rmc72">
            <div className="rmc73"><div className="rmc74">{items.length}</div><div className="rmc75">Total Items</div></div>
            <div className="rmc73"><div className="rmc74">{categories.length}</div><div className="rmc75">Categories</div></div>
          </div>
        </div>

        <div>
          <p className="rmc20">Categories</p>
          <div className="rmc21">
            {categories.map((cat) => (
              <div key={cat.id} className="rmc76"><span className="rmc77">{cat.name}</span><div className="rmc78"><button className="rmc79" onClick={() => setPanel({ type: 'editCategory', category: cat })}>✎</button><button className="rmc80" onClick={() => setPanel({ type: 'deleteCategory', category: cat })}>✕</button></div></div>
            ))}
            <button className="rmc81" onClick={() => setPanel({ type: 'addCategory' })}>＋ Add Category</button>
          </div>
        </div>
      </aside>

      {panel && (
        <MenuPanel mode={panel} categories={categories} onClose={() => setPanel(null)} onAddItem={(it) => { addItem(it); }} onEditItem={(it) => editItem(it)} onDeleteItem={(id) => deleteItem(id)} onAddCategory={(c) => addCategory(c)} onEditCategory={(c) => editCategory(c)} onDeleteCategory={(id) => deleteCategory(id)} />
      )}
    </div>
  );
}

/* Table Interface */
function TableInterface() {
  const [tableCount, setTableCount] = useState(20);
  const [tables, setTables] = useState(() => makeInitTables(20));
  const [tablePage, setTablePage] = useState(1);

  const updateCount = (n) => {
    const clamped = Math.max(1, Math.min(100, n));
    setTableCount(clamped);
    setTables((prev) => {
      if (clamped > prev.length) return [...prev, ...Array.from({ length: clamped - prev.length }, (_, i) => ({ id: prev.length + i + 1, status: 'Available' }))];
      return prev.slice(0, clamped);
    });
    setTablePage(1);
  };

  const cycleStatus = (id) => setTables((prev) => prev.map((t) => (t.id === id ? { ...t, status: STATUSES[(STATUSES.indexOf(t.status) + 1) % STATUSES.length] } : t)));
  const totalPages = Math.max(1, Math.ceil(tableCount / TABLES_PER_PAGE));
  const currentPage = Math.min(tablePage, totalPages);
  const visible = tables.slice((currentPage - 1) * TABLES_PER_PAGE, currentPage * TABLES_PER_PAGE);
  const countByStatus = (s) => tables.filter((t) => t.status === s).length;

  return (
    <div className="rmc90">

      <aside className="rmc92">
        <div className="rmc82">
          <div>
            <p className="rmc20">Table Counter</p>
            <div className="rmc69">
              <button className="rmc83" onClick={() => updateCount(tableCount - 1)}>◀</button>
              <input className="rmc84" type="number" value={tableCount} onChange={(e) => updateCount(parseInt(e.target.value) || 1)} min={1} max={100} />
              <button className="rmc83" onClick={() => updateCount(tableCount + 1)}>▶</button>
            </div>
          </div>
          <div className="rmc86">
            <p className="rmc20">Status Key</p>
            <div className="rmc87">{STATUSES.map((s) => (<div key={s} className="rmc88"><StatusBadge status={s} /><span className="rmc89">{countByStatus(s)}</span></div>))}</div>
          </div>
        </div>
      </aside>

      <main className="rmc30">
        <div className="rmc93">
          <div>
            <h2 className="rmc39">Restaurant Tables</h2>
            <p className="rmc40">{tableCount} table{tableCount !== 1 ? 's' : ''} configured</p>
          </div>
        </div>

        <div className="rmc41">
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
        </div>

        <div className="rmc105">
          <span className="rmc14">{Math.min((currentPage - 1) * TABLES_PER_PAGE + 1, tableCount)}–{Math.min(currentPage * TABLES_PER_PAGE, tableCount)} of {tableCount}</span>
          <div className="rmc69">
            <button className="rmc106" disabled={currentPage <= 1} onClick={() => setTablePage((p) => p - 1)}>◀ Previous</button>
            <span className="rmc107">{currentPage} / {totalPages}</span>
            <button className="rmc106" disabled={currentPage >= totalPages} onClick={() => setTablePage((p) => p + 1)}>Next ▶</button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function RestaurantManagement() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('menu');
  return (
    <div className="rmc108 restaurant-management-root">
      <header className="rmc109">
        <div className="rmc110"><div className="rmc111"><GridIcon /></div><span className="rmc112">Restaurant Management Interface</span></div>
        <div className="rmc113">
          <Link to="/" className="rmc114">← Switch Interface</Link>
          <div className="rmc69"><div className="rmc115"><UserIcon /></div><div className="rmc116"><div className="rmc117">Admin User</div><div className="rmc118">Administrator</div></div></div>
        </div>
      </header>

      <div className="rmc119">
        <div className="rmc120">{['menu', 'tables'].map((t) => (<button key={t} onClick={() => setTab(t)} className={`restaurant-management-tab ${tab === t ? 'restaurant-management-tab-active' : 'restaurant-management-tab-inactive'}`}>{t === 'menu' ? 'Menu Interface' : 'Table List Interface'}</button>))}</div>
      </div>

      <div className="rmc121">{tab === 'menu' ? <MenuInterface /> : <TableInterface />}</div>
    </div>
  );
}