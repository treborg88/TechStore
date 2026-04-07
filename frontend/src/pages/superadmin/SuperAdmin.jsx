// SuperAdmin.jsx - Platform super admin panel (admin.eonsclover.com)
// Placeholder — full implementation in Fase 6

import { Routes, Route, Navigate } from 'react-router-dom';

function SuperAdminDashboard() {
  return (
    <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '2rem' }}>
      <h1>Super Admin Panel</h1>
      <p style={{ color: '#666' }}>Gestión de tenants, planes y plataforma.</p>
      <p style={{ color: '#999', marginTop: '2rem' }}>Panel completo — Próximamente (Fase 6)</p>
    </div>
  );
}

/** Routes shown on admin.eonsclover.com (super admin subdomain) */
export default function SuperAdminRoutes() {
  return (
    <Routes>
      <Route path="/" element={<SuperAdminDashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
