import React, { useState, useEffect } from 'react';
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

function formatMoney(value) {
  return `₱${value.toFixed(2)}`;
}

function cashier() {
  const [currentPage, setCurrentPage] = useState('login');
  const [tables, setTables] = useState(initialTables);
  const [selectedId, setSelectedId] = useState(initialTables[0].id);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [customDiscount, setCustomDiscount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [currentTime, setCurrentTime] = useState(Date.now());

  const selected = tables.find((table) => table.id === selectedId);

  const subtotal = selected
    ? selected.items.reduce((sum, item) => sum + item.price * item.qty, 0)
    : 0;
  const discount = selected?.discount || 0;
  const total = +(subtotal - discount).toFixed(2);

  function addItem(item) {
    setTables((prev) =>
      prev.map((table) => {
        if (table.id !== selectedId) return table;
        const existing = table.items.find((i) => i.name === item.name);
        const items = existing
          ? table.items.map((i) =>
              i.name === item.name ? { ...i, qty: i.qty + 1 } : i
            )
          : [...table.items, { ...item, qty: 1 }];
        return { ...table, occupied: true, items };
      })
    );
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
        };
      })
    );
  }

  function openDiscountModal() {
    setCustomDiscount('');
    setShowDiscountModal(true);
  }

  function applyDiscount(amount) {
    if (!selectedId) return;
    setTables((prev) =>
      prev.map((table) =>
        table.id === selectedId ? { ...table, discount: amount } : table
      )
    );
    setShowDiscountModal(false);
  }

  function openPaymentModal() {
    setPaymentMethod('cash');
    setShowPaymentModal(true);
  }

  function goLogin() {
    setCurrentPage('login');
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

  function printReceipt() {
    alert(
      `Receipt:\nTable ${selected?.label}\nPayment: ${paymentMethod}\nTotal: ${formatMoney(total)}`
    );
    completeBill();
  }

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  function updateTableTimers() {
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
  }

  useEffect(() => {
    updateTableTimers();
  }, [currentTime]);

  if (currentPage === 'login') {
    return <Login onLogin={() => setCurrentPage('dashboard')} />;
  }

  const now = new Date(currentTime);
  const formattedDate = now.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <div className="brand-logo">C</div>
          <div className="brand-text">CASHIER HUB</div>
        </div>
        <div className="tab-group">
          <button className="tab active">TABLE MANAGEMENT</button>
          <button className="tab">MENU ORDERING</button>
        </div>
        <div className="topbar-right">
          <span className="date-time">{formattedDate}</span>
          <button className="return-button" onClick={goLogin}><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#000000"><path d="M200-120q-33 0-56.5-23.5T120-200v-160h80v160h560v-560H200v160h-80v-160q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm220-160-56-58 102-102H120v-80h346L364-622l56-58 200 200-200 200Z"/></svg></button>
        </div>
      </div>

      <div className="action-row">
        <div>
          <h1>Active Tables</h1>
          <p>Real-time status of all occupied tables</p>
        </div>
      </div>

      <div className="main">
        <div className="table-grid">
          {tables.map((table) => {
            const billValue = table.items.reduce(
              (sum, item) => sum + item.price * item.qty,
              0
            );
            return (
              <div
                key={table.id}
                className={`table-card ${table.id === selectedId ? 'selected' : ''} ${
                  !table.occupied ? 'empty' : ''
                }`}
                onClick={() => setSelectedId(table.id)}
              >
                <div className="table-card-top">
                  <div className="table-number">{table.label}</div>
                  <div className="table-status">
                    {table.occupied ? table.minutes || 'ACTIVE' : 'EMPTY'}
                  </div>
                </div>
                <div className="table-card-body">
                  <span className="table-label">CURRENT BILL</span>
                  <span className="table-total">{formatMoney(billValue)}</span>
                </div>
                <div className="table-card-footer">
                  {table.occupied ? `${table.guests} GUESTS` : ''}
                </div>
              </div>
            );
          })}
        </div>

        <aside className="sidebar">
          {selected && (
            <>
              <div className="sidebar-header">
                <div>
                  <div className="bill-title">Table #{selected.label}</div>
                  <div className="bill-subtitle">DINE-IN</div>
                </div>
                <div className={`status-pill ${selected.occupied ? 'occupied' : 'empty'}`}>
                  {selected.occupied ? 'OCCUPIED' : 'EMPTY'}
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
                        >
                          -
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
                {discount > 0 && (
                  <div className="summary-row">
                    <span>Discount</span>
                    <span>-{formatMoney(discount)}</span>
                  </div>
                )}
                <div className="summary-total">
                  <span>Total</span>
                  <span>{formatMoney(total)}</span>
                </div>
              </div>

              <div className="sidebar-actions">
                <button className="discount-button" onClick={openDiscountModal}>
                  <span className="button-icon"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#000000"><path d="M856-390 570-104q-12 12-27 18t-30 6q-15 0-30-6t-27-18L103-457q-11-11-17-25.5T80-513v-287q0-33 23.5-56.5T160-880h287q16 0 31 6.5t26 17.5l352 353q12 12 17.5 27t5.5 30q0 15-5.5 29.5T856-390ZM513-160l286-286-353-354H160v286l353 354ZM260-640q25 0 42.5-17.5T320-700q0-25-17.5-42.5T260-760q-25 0-42.5 17.5T200-700q0 25 17.5 42.5T260-640Zm220 160Z"/></svg></span>
                  Add Discount
                </button>
                <button className="bill-button" onClick={openPaymentModal}>
                  <span className="button-icon"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#000000"><path d="M560-440q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35ZM280-320q-33 0-56.5-23.5T200-400v-320q0-33 23.5-56.5T280-800h560q33 0 56.5 23.5T920-720v320q0 33-23.5 56.5T840-320H280Zm80-80h400q0-33 23.5-56.5T840-480v-160q-33 0-56.5-23.5T760-720H360q0 33-23.5 56.5T280-640v160q33 0 56.5 23.5T360-400Zm440 240H120q-33 0-56.5-23.5T40-240v-440h80v440h680v80ZM280-400v-320 320Z"/></svg></span>
                  Bill Out
                </button>
              </div>
            </>
          )}
        </aside>
      </div>

      {showDiscountModal && (
        <div className="modal-backdrop" onClick={() => setShowDiscountModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Choose Discount</h2>
            <div className="discount-buttons">
              <button onClick={() => applyDiscount(20)}>PWD (20%)</button>
              <button onClick={() => applyDiscount(15)}>Senior (15%)</button>
            </div>
            <div className="custom-discount">
              <label>
                Manual discount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={customDiscount}
                  onChange={(e) => setCustomDiscount(e.target.value)}
                />
              </label>
              <button
                onClick={() => applyDiscount(Number(customDiscount) || 0)}
              >
                Apply
              </button>
            </div>
            <button className="modal-close" onClick={() => setShowDiscountModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="modal-backdrop" onClick={() => setShowPaymentModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Payment Method</h2>
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
              <button className="modal-remove" onClick={completeBill}>
                Remove
              </button>
              <button className="modal-print" onClick={printReceipt}>
                Print Receipt
              </button>
            </div>
            <button className="modal-close" onClick={() => setShowPaymentModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default cashier;