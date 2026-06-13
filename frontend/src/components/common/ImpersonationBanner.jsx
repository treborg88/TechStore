// ImpersonationBanner.jsx — Shows a top warning banner when admin impersonates a tenant
// Displays who is being impersonated and provides a "Stop impersonating" button
// Uses sessionStorage directly (not useAuth) to avoid dependency on parent props.

import { useState } from 'react';
import { logout } from '../../services/authService';
import './ImpersonationBanner.css';

export default function ImpersonationBanner() {
  const [visible, setVisible] = useState(
    sessionStorage.getItem('isImpersonating') === 'true' &&
    !!localStorage.getItem('authToken')
  );

  if (!visible) return null;

  // Read tenant slug from JWT payload
  const getTenantSlug = () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return '—';
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.tenantSlug || payload.impersonatedSlug || '—';
    } catch {
      return '—';
    }
  };

  const handleStop = () => {
    sessionStorage.removeItem('isImpersonating');
    logout();
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    setVisible(false);
    window.location.href = '/';
  };

  return (
    <div className="impersonation-banner">
      <div className="impersonation-banner-content">
        <span className="impersonation-banner-icon">🔍</span>
        <span className="impersonation-banner-text">
          <strong>Impersonando</strong> — Estás viendo la tienda como <strong>{getTenantSlug()}</strong> (admin).
          Esta sesión expira en 1 hora.
        </span>
        <button className="impersonation-banner-btn" onClick={handleStop}>
          ✕ Salir de impersonación
        </button>
      </div>
    </div>
  );
}
