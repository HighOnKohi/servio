import React, { useState, useEffect, useCallback } from 'react';

export const UI_SCALE_KEY = 'servio_ui_scale';

export function useUIScale() {
  const [scale, setScale] = useState(() => {
    return localStorage.getItem(UI_SCALE_KEY) || localStorage.getItem('servio_kds_scale') || 'Large';
  });

  const changeScale = useCallback((newScale) => {
    setScale(newScale);
    localStorage.setItem(UI_SCALE_KEY, newScale);
    localStorage.setItem('servio_kds_scale', newScale);
    window.dispatchEvent(new Event('servio_scale_changed'));
  }, []);

  useEffect(() => {
    const handleStorage = () => {
      const current = localStorage.getItem(UI_SCALE_KEY) || 'Large';
      setScale(current);
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('servio_scale_changed', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('servio_scale_changed', handleStorage);
    };
  }, []);

  const fontScale = scale === 'Std' ? 1.0 : scale === 'XL' ? 1.22 : 1.1;
  const elementScale = scale === 'Std' ? 1.0 : scale === 'XL' ? 1.18 : 1.08;

  return { scale, changeScale, fontScale, elementScale };
}

export function ScaleSelector({ currentScale, onScaleChange, isDark = false, className = '' }) {
  return (
    <div className={`servio-scale-selector ${isDark ? 'dark' : ''} ${className}`} role="group" aria-label="Display Size">
      <span className="servio-scale-label">Size:</span>
      <button
        type="button"
        className={`servio-scale-btn ${currentScale === 'Std' ? 'active' : ''}`}
        onClick={() => onScaleChange('Std')}
        aria-label="Standard UI size"
      >
        Std
      </button>
      <button
        type="button"
        className={`servio-scale-btn ${currentScale === 'Large' ? 'active' : ''}`}
        onClick={() => onScaleChange('Large')}
        aria-label="Large UI size"
      >
        Large
      </button>
      <button
        type="button"
        className={`servio-scale-btn ${currentScale === 'XL' ? 'active' : ''}`}
        onClick={() => onScaleChange('XL')}
        aria-label="Extra Large UI size"
      >
        XL
      </button>
    </div>
  );
}

export default ScaleSelector;
