import { useMemo, useState } from 'react';
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
  const [activeCategory, setActiveCategory] = useState('front-ops');

  const staffName = profile?.full_name || user?.email?.split('@')[0] || 'Staff User';
  const staffRole = isAdmin ? 'System Administrator' : (profile?.role || 'Staff Employee');

  // Categories
  const categories = [
    { id: 'front-ops', label: 'FRONT OPS' },
    { id: 'management', label: 'MANAGEMENT' },
    { id: 'admin', label: 'ADMIN' },
  ];

  // All interface cards organized by category
  const allCards = useMemo(() => ({
    'front-ops': [
      {
        id: 'kitchen',
        title: 'Kitchen Interface',
        desc: 'High-density ticket display, timing orchestration, and station routing.',
        route: '/kitchen/active-orders',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
          </svg>
        ),
        color: '#10b981',
      },
      {
        id: 'cashier',
        title: 'Cashier Interface',
        desc: 'Rapid transaction processing, split-tender handling, and receipt printing.',
        route: '/cashier/overview',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2"/>
            <path d="M7 15h0M12 15h0M17 15h0M7 11h10M7 8h10"/>
          </svg>
        ),
        color: '#10b981',
      },
      {
        id: 'customer',
        title: 'Customer Interface',
        desc: 'Self-service kiosk mode, digital menus, and patron loyalty access.',
        route: '/customer',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ),
        color: '#10b981',
      },
    ],
    'management': [
      {
        id: 'table-manager',
        title: 'Table Management',
        desc: 'Restaurant floor plan, table status tracking, and QR generation.',
        route: '/table-manager',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="8" width="18" height="12" rx="2"/>
            <path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M7 20v2M17 20v2"/>
          </svg>
        ),
        color: '#0284c7',
      },
      {
        id: 'inventory',
        title: 'Inventory Management',
        desc: 'Stock tracking, supplier orders, waste logging, and ingredient costing.',
        route: '/inventory',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        ),
        color: '#0284c7',
      },
      {
        id: 'reports',
        title: 'Reports & Analytics',
        desc: 'Sales trends, peak hours analysis, and revenue forecasting.',
        route: '/reports',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="20" x2="12" y2="10" />
            <line x1="18" y1="20" x2="18" y2="4" />
            <line x1="6" y1="20" x2="6" y2="16" />
          </svg>
        ),
        color: '#0284c7',
      },
    ],
    'admin': isAdmin ? [
      {
        id: 'admin',
        title: 'Admin Dashboard',
        desc: 'Staff management, revenue reporting, and order history audit logs.',
        route: '/admin',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        ),
        color: '#0284c7',
      },
    ] : [],
  }), [isAdmin]);

  const currentCards = allCards[activeCategory] || [];

  return (
    <div
      className={`servio-welcome-page servio-welcome-page--${theme} servio-welcome-page--scale-${uiScale}`}
      style={{
        '--servio-font-scale': fontScale,
        '--servio-elem-scale': elementScale,
      }}
    >
      <ServioHeader
        title="Servio"
        group="SYSTEM PORTAL"
        uiScale={uiScale}
        onScaleChange={handleScaleChange}
      />

      <main className="servio-welcome-main">
        {/* Category Navigation */}
        <div className="servio-category-nav">
          <div className="servio-category-container">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`servio-category-btn ${activeCategory === category.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(category.id)}
              >
                <span className="servio-category-label">{category.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Cards Grid with Animation */}
        <div className="servio-welcome-grid" key={activeCategory}>
          {currentCards.map((card, index) => (
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
              style={{ 
                '--card-accent': card.color,
                '--animation-delay': `${index * 0.1}s`
              }}
            >
              <div className="servio-main-card-icon-area">
                <div className="servio-main-card-icon">{card.icon}</div>
              </div>
              <div className="servio-main-card-content">
                <h2 className="servio-main-card-title">{card.title}</h2>
                <p className="servio-main-card-desc">{card.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
