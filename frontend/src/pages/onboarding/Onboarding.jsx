// Onboarding.jsx - Tenant registration and setup flow (app.eonsclover.com)
// Placeholder — full implementation in Fase 4

import { Routes, Route, Navigate } from 'react-router-dom';

function RegisterPage() {
  return (
    <div style={{ maxWidth: '480px', margin: '4rem auto', padding: '2rem' }}>
      <h1>Crea tu tienda</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Registra tu cuenta y configura tu tienda en minutos.
      </p>
      <p style={{ color: '#999' }}>Formulario de registro — Próximamente</p>
    </div>
  );
}

/** Routes shown on app.eonsclover.com (onboarding subdomain) */
export default function OnboardingRoutes() {
  return (
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<Navigate to="/register" replace />} />
      <Route path="*" element={<Navigate to="/register" replace />} />
    </Routes>
  );
}
