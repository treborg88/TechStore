// ImpersonationBanner.jsx — Shows a top warning banner when admin impersonates a tenant
// Displays who is being impersonated and provides a "Stop impersonating" button

import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import './ImpersonationBanner.css';

export default function ImpersonationBanner() {
  const { user, isImpersonating, stopImpersonating } = useAuth();
  const navigate = useNavigate();

  if (!isImpersonating || !user) return null;

  const handleStop = () => {
    stopImpersonating();
    navigate('/');
  };

  return (
    <div className="impersonation-banner">
      <div className="impersonation-banner-content">
        <span className="impersonation-banner-icon">🔍</span>
        <span className="impersonation-banner-text">
          <strong>Impersonando</strong> — Estás viendo la tienda como <strong>{user.impersonatedSlug}</strong> (admin).
          Esta sesión expira en 1 hora.
        </span>
        <button className="impersonation-banner-btn" onClick={handleStop}>
          ✕ Salir de impersonación
        </button>
      </div>
    </div>
  );
}
