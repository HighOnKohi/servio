import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePOS } from '../../context/POSContext';
import './kitchen.css';

function useFixedInterfaceCanvas() {
  const [, refreshScale] = useState(0);
  useEffect(() => {
    const updateScale = () => refreshScale((version) => version + 1);
    window.addEventListener('resize', updateScale);
    window.visualViewport?.addEventListener('resize', updateScale);
    return () => { window.removeEventListener('resize', updateScale); window.visualViewport?.removeEventListener('resize', updateScale); };
  }, []);
  if (typeof window === 'undefined') return { scale: 1, width: '100%', height: '100vh' };
  const pixelRatio = window.devicePixelRatio || 1;
  return { scale: 1 / pixelRatio, width: `${Math.round(window.innerWidth * pixelRatio)}px`, height: `${Math.round(window.innerHeight * pixelRatio)}px` };
}

function formatElapsed(createdAt, now) {
  const created = typeof createdAt === 'string' ? new Date(createdAt).getTime() : createdAt;
  const seconds = Math.max(0, Math.floor((now - created) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function Kitchen() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    orders,
    orderItems,
    getItemsForOrder,
    updateOrderStatus,
    loading,
  } = usePOS();

  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [currentPage, setCurrentPage] = useState(1);
  const interfaceCanvas = useFixedInterfaceCanvas();
  const viewFromPath = location.pathname.split('/').filter(Boolean).at(-1);
  // Kitchen interface only exposes Active Orders in this build
  const activeView = 'active-orders';

  // Map DB orders to kitchen tickets
  const tickets = useMemo(() => {
    return orders.map((order) => {
      const items = getItemsForOrder(order.id);
      // Map order status to kitchen view status
      let kitchenStatus;
      if (order.status === 'COMPLETED' || order.status === 'READY') {
        kitchenStatus = 'COMPLETED';
      } else if (order.status === 'CANCELLED') {
        kitchenStatus = 'CANCELLED';
      } else {
        kitchenStatus = 'ACTIVE'; // PENDING, IN_PROGRESS
      }

      return {
        id: order.id,
        displayId: order.id.slice(0, 4).toUpperCase(),
        table: order.table_number ? String(order.table_number).padStart(2, '0') : '--',
        server: order.server_name || 'Unknown',
        orderType: order.order_type || 'DINE-IN',
        createdAt: order.created_at,
        completedAt: order.updated_at,
        status: kitchenStatus,
        items: items.map((oi) => ({
          name: oi.item_name,
          qty: oi.quantity,
          notes: Array.isArray(oi.modifiers) && oi.modifiers.length > 0 ? oi.modifiers : undefined,
          cancelled: oi.status === 'CANCELLED',
        })),
      };
    });
  }, [orders, orderItems, getItemsForOrder]);

  // Only show active tickets in the kitchen interface
  const visibleTickets = useMemo(() => tickets.filter((ticket) => ticket.status === 'ACTIVE'), [tickets]);

  // Show 4 columns x 2 rows = 8 tickets per page
  const ticketsPerPage = 8;
  const totalPages = Math.max(1, Math.ceil(visibleTickets.length / ticketsPerPage));
  const activePage = Math.min(currentPage, totalPages);
  const ticketStart = (activePage - 1) * ticketsPerPage;
  const pagedTickets = visibleTickets.slice(ticketStart, ticketStart + ticketsPerPage);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    // Ensure the URL always points to the active orders view
    if (viewFromPath !== 'active-orders') navigate('/kitchen/active-orders', { replace: true });
  }, [viewFromPath, navigate]);

  const handleUpdateStatus = async (orderId, status) => {
    await updateOrderStatus(orderId, status);
  };

  const labelForView = 'Active orders';

  if (loading) {
    return <div className="kitchen-app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#fff', fontSize: '1.2rem' }}>Loading…</div>;
  }

  return (
    <div className="kitchen-app" style={{ '--kitchen-scale': interfaceCanvas.scale, width: interfaceCanvas.width, height: interfaceCanvas.height, minHeight: interfaceCanvas.height }}>
      <header className="kitchen-topbar">
        <div className="kitchen-brand"><span className="kitchen-brand-logo" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg></span><span>Kitchen Interface</span></div>
        <div className="kitchen-topbar-right"><span>{new Date(currentTime).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}, {new Date(currentTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}</span><button className="kitchen-return-button" onClick={() => navigate('/')} aria-label="Return to interface selector"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg></button></div>
      </header>
      <nav className="kitchen-tab-group" aria-label="Kitchen sections">
        {/* Only show Active Orders in the kitchen interface */}
        <button className={'active'} onClick={() => navigate('/kitchen/active-orders')}>ACTIVE ORDERS <span>{tickets.filter((ticket) => ticket.status === 'ACTIVE').length}</span></button>
      </nav>
      <main className="kitchen-workspace">
        <div className="kitchen-content">
          {visibleTickets.length === 0 ? <div className="kitchen-empty"><div>✓</div><h2>No {labelForView.toLowerCase()}</h2><p>{activeView === 'active-orders' ? 'The kitchen is all caught up.' : 'Tickets moved here will remain available for review.'}</p></div> : <section className="ticket-grid">{pagedTickets.map((ticket) => {
          const elapsedMs = currentTime - new Date(ticket.createdAt).getTime();
          const elapsedMinutes = Math.floor(elapsedMs / 60000);
          let urgency = 'normal';
          if (ticket.status === 'ACTIVE') {
            if (elapsedMinutes >= 20) urgency = 'overtime';
            else if (elapsedMinutes >= 10) urgency = 'warning';
          }
          return <article className={`kitchen-ticket ${urgency !== 'normal' ? urgency : ''} ${ticket.status.toLowerCase()}`} key={ticket.id}>
            <header className={`ticket-header ${urgency !== 'normal' ? urgency : ''}`}><div><strong>#{ticket.displayId}</strong><span>Table #{ticket.table}</span>{urgency === 'overtime' && <span className="overtime-badge">OVERTIME</span>}</div><time>◷ {formatElapsed(ticket.createdAt, ticket.status === 'COMPLETED' || ticket.status === 'CANCELLED' ? new Date(ticket.completedAt).getTime() : currentTime)}</time></header>
            <div className="ticket-meta"><span>{ticket.server}</span><span>{ticket.orderType}</span></div>
            <div className="ticket-items">{ticket.items.map((item, index) => <div className={`ticket-item ${item.cancelled ? 'cancelled' : ''}`} key={`${ticket.id}-${index}`}><div><strong>{item.name}</strong>{item.cancelled && <small>Item cancelled</small>}{item.notes?.map((note) => <em key={note}>{note}</em>)}</div><span>×{item.qty}</span></div>)}</div>
            <footer className="ticket-actions">{activeView === 'active-orders' ? <><button className="cancel-ticket" onClick={() => handleUpdateStatus(ticket.id, 'CANCELLED')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m8 8 8 8M16 8l-8 8" /><circle cx="12" cy="12" r="9" /></svg>Cancel</button><button className="complete-ticket" onClick={() => handleUpdateStatus(ticket.id, 'READY')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m5 12 4 4L19 6" /></svg>Complete</button></> : <span className={`ticket-status ${ticket.status.toLowerCase()}`}>{ticket.status === 'COMPLETED' ? '✓ Completed' : 'Cancelled'}</span>}</footer>
          </article>;
          })}</section>}
        </div>
        <footer className="kitchen-pagination"><span>{visibleTickets.length ? `${ticketStart + 1}–${Math.min(ticketStart + ticketsPerPage, visibleTickets.length)} of ${visibleTickets.length}` : '0 of 0'}</span><div className="kitchen-pagination-actions"><button disabled={activePage <= 1} onClick={() => setCurrentPage(activePage - 1)}>◀ Previous</button><span>{activePage} / {totalPages}</span><button disabled={activePage >= totalPages} onClick={() => setCurrentPage(activePage + 1)}>Next ▶</button></div></footer>
      </main>
    </div>
  );
}

export default Kitchen;
