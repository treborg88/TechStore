// ProcessingOverlay.jsx — Reusable cool loading overlay
// Used for store creation, restore/backup, and other long operations
// Animates for at least `minDurationMs` (default 5000ms) before showing success

import { useEffect, useRef } from 'react';

export default function ProcessingOverlay({
  visible,
  status = 'running', // 'running' | 'success'
  title = 'Procesando...',
  subtitle = 'No cierres esta ventana, estamos finalizando detalles.',
  onComplete,
  minDurationMs = 5000,
}) {
  // Keep onComplete in a ref so the effect doesn't depend on a changing function reference
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const startedAt = useRef(null);

  useEffect(() => {
    if (!visible) return;
    if (status === 'running') {
      startedAt.current = Date.now();
    }
    if (status === 'success') {
      const elapsed = Date.now() - (startedAt.current || Date.now());
      const wait = Math.max(0, minDurationMs - elapsed);
      const timer = setTimeout(() => {
        onCompleteRef.current?.();
      }, wait);
      return () => clearTimeout(timer);
    }
  }, [visible, status, minDurationMs]);

  if (!visible) return null;

  const overlay = {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    backdropFilter: 'blur(10px)',
    background: 'radial-gradient(circle at 20% 20%, rgba(245, 158, 11, 0.25), transparent 40%), radial-gradient(circle at 80% 30%, rgba(16, 185, 129, 0.2), transparent 45%), rgba(15, 23, 42, 0.68)',
  };

  const card = {
    width: 'min(560px, 100%)',
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'linear-gradient(165deg, rgba(255,255,255,0.16), rgba(255,255,255,0.06))',
    color: '#f8fafc',
    boxShadow: '0 25px 60px rgba(2, 6, 23, 0.45)',
    padding: '26px 24px',
    textAlign: 'center',
    position: 'relative',
    overflow: 'hidden',
  };

  const orbFieldStyle = {
    position: 'relative',
    width: '220px',
    height: '220px',
    margin: '12px auto 8px',
  };

  const fadeUp = {
    animation: 'proc-fade-up 500ms ease-out both',
  };
  const fadeUpDelay = {
    animation: 'proc-fade-up 650ms ease-out both',
  };

  return (
    <>
      <style>{`
        @keyframes proc-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes proc-pulse {
          0%, 100% { transform: scale(0.92); opacity: 0.55; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes proc-wave {
          0% { transform: scale(0.4); opacity: 0.75; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        @keyframes proc-fade-up {
          from { transform: translateY(8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <div style={overlay}>
        <div style={card}>
          {/* Background orbs */}
          <div style={{
            position: 'absolute', inset: '-35% auto auto -20%', width: '260px', height: '260px',
            borderRadius: '999px',
            background: 'radial-gradient(circle, rgba(245, 158, 11, 0.38), transparent 70%)',
            animation: 'proc-pulse 3s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', inset: 'auto -18% -40% auto', width: '260px', height: '260px',
            borderRadius: '999px',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.34), transparent 72%)',
            animation: 'proc-pulse 3.7s ease-in-out infinite',
          }} />

          <h3 style={{
            fontSize: 'clamp(22px, 4vw, 34px)', fontWeight: 800, margin: '0 0 8px', ...fadeUp,
          }}>
            {title}
          </h3>
          <p style={{
            margin: '0 auto 18px', maxWidth: '460px', color: '#e2e8f0', fontSize: '14px',
            lineHeight: 1.45, ...fadeUpDelay,
          }}>
            {subtitle}
          </p>

          {/* Animated orb */}
          <div style={orbFieldStyle}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '999px',
              border: '2px solid rgba(255,255,255,0.25)',
              animation: 'proc-spin 4s linear infinite',
            }} />
            <div style={{
              position: 'absolute', inset: '16px', borderRadius: '999px',
              border: '1px dashed rgba(255,255,255,0.4)',
              animation: 'proc-spin 6s linear reverse infinite',
            }} />
            <div style={{
              position: 'absolute', inset: '44px', borderRadius: '999px',
              background: 'radial-gradient(circle, rgba(255,255,255,0.96), rgba(209,250,229,0.75) 55%, rgba(16,185,129,0.35) 100%)',
              boxShadow: '0 0 42px rgba(209, 250, 229, 0.8)',
              animation: 'proc-pulse 2.2s ease-in-out infinite',
            }} />
            <div style={{
              position: 'absolute', inset: '26px', borderRadius: '999px',
              border: '2px solid rgba(255,255,255,0.22)',
              animation: 'proc-wave 2.6s ease-out infinite',
            }} />
            <div style={{
              position: 'absolute', inset: '26px', borderRadius: '999px',
              border: '2px solid rgba(255,255,255,0.22)',
              animation: 'proc-wave 2.6s ease-out infinite 1.3s',
            }} />
          </div>

          <p style={{
            margin: '8px 0 0', fontSize: '13px', letterSpacing: '0.02em',
            color: status === 'success' ? '#d1fae5' : '#94a3b8',
          }}>
            {status === 'success'
              ? 'Todo listo. Redirigiendo...'
              : 'No cierres esta ventana, estamos finalizando detalles.'}
          </p>
        </div>
      </div>
    </>
  );
}
