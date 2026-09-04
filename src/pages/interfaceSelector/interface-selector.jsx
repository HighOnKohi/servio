import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useUIScale } from '../../components/ScaleSelector';
import ServioHeader from '../../components/ServioHeader';
import './interface-selector.css';

export default function InterfaceSelector() {
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  const { theme, isDark } = useTheme();
  const { scale: uiScale, changeScale: handleScaleChange, fontScale, elementScale } = useUIScale();

  const staffName = profile?.full_name || user?.email?.split('@')[0] || 'Staff User';
  const staffRole = isAdmin ? 'System Administrator' : (profile?.role || 'Staff Employee');

  // Main operational pages
  const mainCards = useMemo(() => {
    const cards = [
      {
        id: 'kitchen',
        title: 'Kitchen Interface',
        badge: 'Food Ops',
        desc: 'Live incoming orders, kitchen ticket queue, food preparation & ready notifications.',
        route: '/kitchen/active-orders',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="3" width="16" height="5" rx="1" />
            <path d="M6 8v3m4-3v3m4-3v3" />
            <path d="M4 14h16v5H4z" />
          </svg>
        ),
        color: '#10b981',
      },
      {
        id: 'table-manager',
        title: 'Table Management',
        badge: 'Floor Ops',
        desc: 'Restaurant floor plan, table status tracking, customer capacity & QR code generation.',
        route: '/table-manager',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8h16v5H4z" />
            <path d="M6 13v6m12-6v6M8 8V5h8v3" />
          </svg>
        ),
        color: '#38bdf8',
      },
      {
        id: 'cashier',
        title: 'Cashier Interface',
        badge: 'POS Terminal',
        desc: 'Order billing, PWD/Senior discounts, table checkout, receipt printing & cash drawer.',
        route: '/cashier/overview',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M7 9h10M7 13h2m3 0h2m3 0h0M7 16h10" />
          </svg>
        ),
        color: '#f59e0b',
      },
    ];

    // Admin accounts only: reveal the 4th main card (Admin Dashboard)
    if (isAdmin) {
      cards.push({
        id: 'admin',
        title: 'Admin Dashboard',
        badge: 'Admin Only',
        desc: 'Staff account management, revenue reporting, order history audit logs & protocols.',
        route: '/admin',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="7" r="3" />
            <path d="M5 21a7 7 0 0 1 14 0M19 8v5m-2.5-2.5h5" />
          </svg>
        ),
        color: '#a855f7',
      });
    }

    return cards;
  }, [isAdmin]);

  return (
    <div
      className={`servio-welcome-page servio-welcome-page--${theme} servio-welcome-page--scale-${uiScale}`}
      style={{
        '--servio-font-scale': fontScale,
        '--servio-elem-scale': elementScale,
      }}
    >
      <ServioHeader
        title="SERVIO POS"
        group="SYSTEM PORTAL"
        uiScale={uiScale}
        onScaleChange={handleScaleChange}
      />

      <main className="servio-welcome-main">
        <div className="servio-welcome-hero">
          <div className="servio-welcome-kicker-row">
            <span className="servio-welcome-kicker">Operational Suite</span>
            <span className={`servio-role-tag ${isAdmin ? 'admin' : 'employee'}`}>
              {isAdmin ? '👑 Administrator' : '👤 Staff Employee'}
            </span>
          </div>
          <h1 className="servio-welcome-title">
            Welcome back, <span className="servio-welcome-name">{staffName}</span>
          </h1>
          <p className="servio-welcome-desc">
            Select one of the {mainCards.length} operational interfaces below to begin your shift, or toggle the logo burger menu at any time.
          </p>
        </div>

        <div className={`servio-welcome-grid ${isAdmin ? 'cols-4' : 'cols-3'}`}>
          {mainCards.map((card) => (
            <button
              key={card.id}
              type="button"
              className="servio-main-card"
              onClick={() => {
                try {
                  localStorage.setItem('servio_last_interface', card.route);
                } catch {}
                navigate(card.route);
              }}
              style={{ '--card-accent': card.color }}
            >
              <div className="servio-main-card-top">
                <div className="servio-main-card-icon">{card.icon}</div>
                <span className="servio-main-card-badge">{card.badge}</span>
              </div>
              <div className="servio-main-card-body">
                <h2 className="servio-main-card-title">{card.title}</h2>
                <p className="servio-main-card-desc">{card.desc}</p>
              </div>
              <div className="servio-main-card-footer">
                <span>Launch Interface</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
