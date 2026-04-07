// Onboarding.jsx - Tenant registration and setup flow (app.eonsclover.com)
// Routes the user through the OnboardingWizard for tenant creation.

import { Routes, Route, Navigate } from 'react-router-dom';
import OnboardingWizard from './OnboardingWizard';

/** Routes shown on app.eonsclover.com (onboarding subdomain) */
export default function OnboardingRoutes() {
  return (
    <Routes>
      <Route path="/register" element={<OnboardingWizard />} />
      <Route path="/" element={<Navigate to="/register" replace />} />
      <Route path="*" element={<Navigate to="/register" replace />} />
    </Routes>
  );
}
