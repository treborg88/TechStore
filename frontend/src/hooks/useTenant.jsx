// hooks/useTenant.js - Multi-tenant context provider and hook
// Provides tenant context to the app. In single-tenant/localhost mode,
// isTenant is false and the app behaves exactly as before.

import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { TENANT_SLUG, IS_TENANT } from '../config';
import { apiFetch, apiUrl } from '../services/apiClient';

const TenantContext = createContext(null);

/**
 * Wraps the app to provide tenant context via React context.
 * Only fetches subscription data when running on a tenant subdomain.
 */
export function TenantProvider({ children }) {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(IS_TENANT);

  // Fetch tenant subscription/plan info (only in SaaS tenant mode)
  const fetchSubscription = useCallback(async () => {
    if (!IS_TENANT) return;
    try {
      const res = await apiFetch(apiUrl('/settings/public'));
      if (res.ok) {
        const data = await res.json();
        // Extract subscription data if present in public settings
        const sub = data.subscription || null;
        setSubscription(sub);
      }
    } catch (_err) {
      // Non-critical — tenant works without subscription display
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const value = {
    slug: TENANT_SLUG,
    isTenant: IS_TENANT,
    subscription,
    loading,
    refreshSubscription: fetchSubscription
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

/** Access current tenant context. Returns { slug, isTenant, subscription, loading } */
export const useTenant = () => useContext(TenantContext);
