// SaaSLanding.jsx - Public marketing landing page (eonsclover.com)
// Placeholder — full implementation in Fase 7

import { Routes, Route, Navigate } from 'react-router-dom';

function SaaSHome() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
      <h1>Crea tu tienda online en minutos</h1>
      <p style={{ fontSize: '1.2rem', color: '#666', margin: '1rem 0 2rem' }}>
        Plataforma e-commerce lista para vender. Sin código, sin complicaciones.
      </p>
      <a href="https://app.eonsclover.com/register" 
         style={{ padding: '0.75rem 2rem', background: '#4f46e5', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontSize: '1.1rem' }}>
        Comenzar gratis
      </a>
    </div>
  );
}

/** Routes shown on the root domain (eonsclover.com) */
export default function SaaSLandingRoutes() {
  return (
    <Routes>
      <Route path="/" element={<SaaSHome />} />
      <Route path="/pricing" element={<div style={{ padding: '2rem', textAlign: 'center' }}><h2>Planes y Precios</h2><p>Próximamente</p></div>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
