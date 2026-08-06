import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './kitchen.css';

const initialTickets = [
  { id: '842', table: '01', server: 'Cashier', createdAt: Date.now() - 24 * 60000, status: 'ACTIVE', bumped: true, items: [{ name: 'Wagyu Burger', qty: 2, notes: ['No onions', 'Extra aioli'] }, { name: 'Mac & Cheese', qty: 1 }] },
  { id: '845', table: '04', server: 'Waiter', createdAt: Date.now() - 9 * 60000, status: 'ACTIVE', items: [{ name: 'Caesar Salad', qty: 1 }, { name: 'Pan Salmon', qty: 1 }, { name: 'Hibiscus Tea', qty: 2 }] },
  { id: '846', table: '07', server: 'Cashier', createdAt: Date.now() - 5 * 60000, status: 'ACTIVE', items: [{ name: 'Porterhouse', qty: 2 }, { name: 'Dirty Martini', qty: 3, cancelled: true }] },
  { id: '848', table: '10', server: 'Waiter', createdAt: Date.now() - 2 * 60000, status: 'ACTIVE', items: [{ name: 'Fries', qty: 4 }, { name: 'Cola', qty: 4 }, { name: 'Wings', qty: 2 }] },
  ...Array.from({ length: 8 }, (_, index) => ({
    id: String(850 + index), table: String(11 + index).padStart(2, '0'), server: index % 2 ? 'Waiter' : 'Cashier',
    createdAt: Date.now() - (index + 3) * 60000, status: 'ACTIVE',
    items: [{ name: ['Chicken Alfredo', 'Beef Tapa', 'Carbonara', 'Club Sandwich'][index % 4], qty: (index % 3) + 1 }, { name: ['Iced Tea', 'Coke', 'Lemonade', 'Fries'][index % 4], qty: 1 }],
  })),
];

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
  const seconds = Math.max(0, Math.floor((now - createdAt) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function Kitchen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tickets, setTickets] = useState(initialTickets);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [currentPage, setCurrentPage] = useState(1);
  const interfaceCanvas = useFixedInterfaceCanvas();
  const viewFromPath = location.pathname.split('/').filter(Boolean).at(-1);
  const activeView = ['active-orders', 'completed-orders', 'cancelled-orders'].includes(viewFromPath) ? viewFromPath : 'active-orders';
  const visibleTickets = useMemo(() => tickets.filter((ticket) => {
    if (activeView === 'completed-orders') return ticket.status === 'COMPLETED';
    if (activeView === 'cancelled-orders') return ticket.status === 'CANCELLED';
    return ticket.status === 'ACTIVE';
  }), [tickets, activeView]);
  const ticketsPerPage = 12;
  const totalPages = Math.max(1, Math.ceil(visibleTickets.length / ticketsPerPage));
  const activePage = Math.min(currentPage, totalPages);
  const ticketStart = (activePage - 1) * ticketsPerPage;
  const pagedTickets = visibleTickets.slice(ticketStart, ticketStart + ticketsPerPage);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!['active-orders', 'completed-orders', 'cancelled-orders'].includes(viewFromPath)) navigate('/kitchen/active-orders', { replace: true });
  }, [viewFromPath, navigate]);
  const navigateToView = (view) => { setCurrentPage(1); navigate(`/kitchen/${view}`); };
  const updateTicketStatus = (ticketId, status) => setTickets((previous) => previous.map((ticket) => ticket.id === ticketId ? { ...ticket, status, completedAt: Date.now() } : ticket));
  const labelForView = activeView === 'active-orders' ? 'Active orders' : activeView === 'completed-orders' ? 'Completed orders' : 'Cancelled orders';

  return (
    <div className="kitchen-app" style={{ '--kitchen-scale': interfaceCanvas.scale, width: interfaceCanvas.width, height: interfaceCanvas.height, minHeight: interfaceCanvas.height }}>
      <header className="kitchen-topbar">
        <div className="kitchen-brand"><span className="kitchen-brand-logo" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg></span><span>Kitchen Interface</span></div>
        <div className="kitchen-topbar-right"><span>{new Date(currentTime).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}, {new Date(currentTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}</span><button className="kitchen-return-button" onClick={() => navigate('/')} aria-label="Return to interface selector"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg></button></div>
      </header>
      <nav className="kitchen-tab-group" aria-label="Kitchen sections">
        <button className={activeView === 'active-orders' ? 'active' : ''} onClick={() => navigateToView('active-orders')}>ACTIVE ORDERS <span>{tickets.filter((ticket) => ticket.status === 'ACTIVE').length}</span></button>
        <button className={activeView === 'completed-orders' ? 'active' : ''} onClick={() => navigateToView('completed-orders')}>COMPLETED ORDERS <span>{tickets.filter((ticket) => ticket.status === 'COMPLETED').length}</span></button>
        <button className={activeView === 'cancelled-orders' ? 'active' : ''} onClick={() => navigateToView('cancelled-orders')}>CANCELLED ORDERS <span>{tickets.filter((ticket) => ticket.status === 'CANCELLED').length}</span></button>
      </nav>
      <main className="kitchen-workspace">
        <div className="kitchen-content">
          <div className="kitchen-heading"><div><h1>{labelForView}</h1><p>{activeView === 'active-orders' ? 'Review new tickets and update their kitchen status.' : 'Review tickets that have already been processed.'}</p></div></div>
          {visibleTickets.length === 0 ? <div className="kitchen-empty"><div>✓</div><h2>No {labelForView.toLowerCase()}</h2><p>{activeView === 'active-orders' ? 'The kitchen is all caught up.' : 'Tickets moved here will remain available for review.'}</p></div> : <section className="ticket-grid">{pagedTickets.map((ticket) => {
          const urgent = ticket.status === 'ACTIVE' && currentTime - ticket.createdAt > 15 * 60000;
          return <article className={`kitchen-ticket ${urgent ? 'urgent' : ''} ${ticket.status.toLowerCase()}`} key={ticket.id}>
            <header className="ticket-header"><div><strong>#{ticket.id}</strong><span>Table #{ticket.table}</span></div><time>◷ {formatElapsed(ticket.createdAt, ticket.completedAt ?? currentTime)}</time></header>
            <div className="ticket-meta"><span>{ticket.server}</span><span>DINE-IN</span></div>
            <div className="ticket-items">{ticket.items.map((item, index) => <div className={`ticket-item ${item.cancelled ? 'cancelled' : ''}`} key={`${ticket.id}-${index}`}><div><strong>{item.name}</strong>{item.cancelled && <small>Item cancelled</small>}{item.notes?.map((note) => <em key={note}>{note}</em>)}</div><span>×{item.qty}</span></div>)}</div>
            <footer className="ticket-actions">{activeView === 'active-orders' ? <><button className="cancel-ticket" onClick={() => updateTicketStatus(ticket.id, 'CANCELLED')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m8 8 8 8M16 8l-8 8" /><circle cx="12" cy="12" r="9" /></svg>Cancel</button><button className="complete-ticket" onClick={() => updateTicketStatus(ticket.id, 'COMPLETED')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m5 12 4 4L19 6" /></svg>Complete</button></> : <span className={`ticket-status ${ticket.status.toLowerCase()}`}>{ticket.status === 'COMPLETED' ? '✓ Completed' : 'Cancelled'}</span>}</footer>
          </article>;
          })}</section>}
        </div>
        <footer className="kitchen-pagination"><span>{visibleTickets.length ? `${ticketStart + 1}–${Math.min(ticketStart + ticketsPerPage, visibleTickets.length)} of ${visibleTickets.length}` : '0 of 0'}</span><div className="kitchen-pagination-actions"><button disabled={activePage <= 1} onClick={() => setCurrentPage(activePage - 1)}>◀ Previous</button><span>{activePage} / {totalPages}</span><button disabled={activePage >= totalPages} onClick={() => setCurrentPage(activePage + 1)}>Next ▶</button></div></footer>
      </main>
    </div>
  );
}

export default Kitchen;
