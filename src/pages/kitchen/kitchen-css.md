/* KitchenView styles */

/* ---- Ticket list (kitchen) ---- */
.ticket-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
.ticket {
  border: 2px solid #d0d0d0;
  border-radius: 10px;
  background: #fff;
}
.ticket-header {
  padding: 14px 18px;
  border-bottom: 2px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
  font-size: 1.1rem;
}
.ticket-body {
  padding: 14px 18px;
}
.ticket-body li,
.ticket-body .ticket-item {
  padding: 6px 0;
  font-size: 1rem;
  border-bottom: 1px solid #f0f0f0;
}
.ticket-footer {
  padding: 14px 18px;
  border-top: 2px solid #e0e0e0;
}
.ticket-urgent {
  border-color: #dc2626;
  background: #fef2f2;
}
.ticket-ready {
  border-color: #16a34a;
  background: #f0fdf4;
}

/* ---- Responsive ---- */
@media (max-width: 768px) {
  .ticket-list {
    grid-template-columns: 1fr;
  }
}
