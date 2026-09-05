import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ScaleSelector, useUIScale } from './ScaleSelector';
import InterfaceSidebar from './InterfaceSidebar';
import Logo from '../../public/Servio-Logo-B-Icon-Transparent.png';
import './ServioHeader.css';

export default function ServioHeader({
  title = 'SERVIO POS',
  group,
  customActions = null,
  uiScale: propUiScale,
  onScaleChange: propOnScaleChange,
  onLogout,
  children,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { theme, isDark } = useTheme();
  const internalScale = useUIScale();

  const currentScale = propUiScale || internalScale.scale;
  const handleScaleChange = propOnScaleChange || internalScale.changeScale;

  // Clock state
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sidebar Open & Preview State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(4);
  const previewTimerRef = useRef(null);

  // Logout confirmation modal state
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Check if preview should trigger (on ?preview=true or first mount of session)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const hasPreviewParam = searchParams.get('preview') === 'true' || searchParams.get('preview') === '1';
    const hasPreviewedThisSession = sessionStorage.getItem('servio_preview_shown');

    if (hasPreviewParam || !hasPreviewedThisSession) {
      sessionStorage.setItem('servio_preview_shown', 'true');
      setIsSidebarOpen(true);
      setIsPreviewing(true);
      setSecondsRemaining(4);

      if (hasPreviewParam) {
        searchParams.delete('preview');
        const newSearch = searchParams.toString();
        const newUrl = location.pathname + (newSearch ? `?${newSearch}` : '');
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [location.pathname, location.search]);

  // Preview countdown effect
  useEffect(() => {
    if (!isPreviewing || !isSidebarOpen) {
      if (previewTimerRef.current) clearInterval(previewTimerRef.current);
      return;
    }

    previewTimerRef.current = setInterval(() => {
      if (!isPaused) {
        setSecondsRemaining((prev) => {
          if (prev <= 0.1) {
            clearInterval(previewTimerRef.current);
            setIsSidebarOpen(false);
            setIsPreviewing(false);
            return 0;
          }
          return parseFloat((prev - 0.1).toFixed(1));
        });
      }
    }, 100);

    return () => {
      if (previewTimerRef.current) clearInterval(previewTimerRef.current);
    };
  }, [isPreviewing, isSidebarOpen, isPaused]);

  // Toggle burger menu manually
  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      if (next) {
        // Manually opened by clicking logo -> no auto-collapse
        setIsPreviewing(false);
      }
      return next;
    });
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false);
    setIsPreviewing(false);
  }, []);

  const handlePausePreview = useCallback(() => {
    setIsPaused(true);
  }, []);

  const handleResumePreview = useCallback(() => {
    setIsPaused(false);
  }, []);

  // Logout handlers
  const handleConfirmLogout = async () => {
    setShowLogoutModal(false);
    try {
      if (onLogout) {
        await onLogout();
      } else if (logout) {
        await logout();
      }
    } catch (err) {
      console.error('Logout failed:', err);
    }
    navigate('/login');
  };

  const handleSwitchInterfaceFromModal = () => {
    setShowLogoutModal(false);
    setIsSidebarOpen(true);
    setIsPreviewing(false);
  };

  const formattedDate = new Date(currentTime).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const formattedTime = new Date(currentTime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <>
      <header className="servio-topbar" role="banner">
        {/* ── Left: Logo Burger Button & Interface Title ── */}
        <div className="servio-brand">
          <button
            type="button"
            className={`servio-brand-logo-btn ${isSidebarOpen ? 'active' : ''}`}
            onClick={handleToggleSidebar}
            aria-label="Toggle Interface Selector menu"
            aria-expanded={isSidebarOpen}
            title="Toggle Interface Menu (Click to switch)"
          >
            <img src={Logo} alt="SERVIO Logo" className="servio-brand-logo-img" />
            <span className="servio-burger-badge" aria-hidden="true">
              <span className="servio-burger-bar" />
              <span className="servio-burger-bar" />
              <span className="servio-burger-bar" />
            </span>
          </button>
          <div className="servio-brand-text">
            {group && <span className="servio-brand-badge">{group}</span>}
            <h1 className="servio-brand-title">{title}</h1>
          </div>
        </div>

        {/* ── Right: Scale Selector, Custom Actions, Clock, Logout ── */}
        <div className="servio-topbar-right">
          <ScaleSelector currentScale={currentScale} onScaleChange={handleScaleChange} isDark={isDark} />

          {customActions}
          {children}

          <div className="servio-clock" aria-label="Current date and time">
            <span className="servio-clock-date">{formattedDate}</span>
            <span className="servio-clock-time">{formattedTime}</span>
          </div>
        </div>
      </header>

      {/* ── Interface Selector Sidebar Overlay ── */}
      <InterfaceSidebar
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
        isPreviewing={isPreviewing}
        isPaused={isPaused}
        onPausePreview={handlePausePreview}
        onResumePreview={handleResumePreview}
        secondsRemaining={Math.ceil(secondsRemaining)}
        onTriggerLogout={() => setShowLogoutModal(true)}
      />

      {/* ── Unified Logout / Switch Confirmation Modal ── */}
      {showLogoutModal && (
        <div
          className="servio-logout-modal-overlay"
          onClick={() => setShowLogoutModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="servio-logout-modal-title"
        >
          <div className="servio-logout-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="servio-logout-modal-header danger">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <h2 id="servio-logout-modal-title">Leave Current Interface?</h2>
            </div>
            <p className="servio-logout-modal-body">
              Are you sure you want to exit <strong>{title}</strong>? You can switch to another interface or log out completely.
            </p>
            <div className="servio-logout-modal-actions">
              <button
                type="button"
                className="servio-modal-btn danger"
                onClick={handleConfirmLogout}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ width: 20, height: 20 }}>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Log Out Completely
              </button>
              <button
                type="button"
                className="servio-modal-btn switch-interface"
                onClick={handleSwitchInterfaceFromModal}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ width: 20, height: 20 }}>
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                </svg>
                Switch Interface (Menu)
              </button>
              <button
                type="button"
                className="servio-modal-btn secondary"
                onClick={() => setShowLogoutModal(false)}
              >
                Stay Here
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
