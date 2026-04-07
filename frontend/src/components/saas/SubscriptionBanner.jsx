// components/saas/SubscriptionBanner.jsx - Plan indicator for tenant admin panel
// Shows current plan, usage limits, and upgrade CTA. Only visible in SaaS tenant mode.

import { useTenant } from '../../hooks/useTenant.jsx';

/**
 * Banner showing subscription plan and usage for tenant admins.
 * Renders nothing outside SaaS tenant context.
 */
export default function SubscriptionBanner() {
  const tenantCtx = useTenant();

  // Only show in SaaS tenant mode with subscription data
  if (!tenantCtx?.isTenant || !tenantCtx?.subscription) return null;

  const { subscription } = tenantCtx;
  const plan = subscription.plan || {};
  const usage = subscription.usage || {};

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '1.5rem',
      padding: '0.75rem 1.25rem',
      background: '#f0f4ff',
      borderRadius: '8px',
      border: '1px solid #c7d2fe',
      marginBottom: '1rem',
      flexWrap: 'wrap',
      fontSize: '0.9rem'
    }}>
      {/* Plan badge */}
      <span style={{ fontWeight: 600, color: '#4338ca' }}>
        Plan: {plan.name || 'Trial'}
      </span>

      {/* Product usage */}
      {plan.max_products != null && (
        <span style={{ color: '#555' }}>
          Productos: {usage.products ?? 0}/{plan.max_products === -1 ? '∞' : plan.max_products}
        </span>
      )}

      {/* Order usage */}
      {plan.max_orders_month != null && (
        <span style={{ color: '#555' }}>
          Órdenes/mes: {usage.orders ?? 0}/{plan.max_orders_month === -1 ? '∞' : plan.max_orders_month}
        </span>
      )}

      {/* Upgrade CTA */}
      <button
        onClick={() => window.location.href = '/admin/subscription'}
        style={{
          marginLeft: 'auto',
          padding: '0.4rem 1rem',
          background: '#4f46e5',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '0.85rem'
        }}
      >
        Cambiar plan
      </button>
    </div>
  );
}
