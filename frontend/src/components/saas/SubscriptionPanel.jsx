// SubscriptionPanel.jsx — Full subscription management page for tenant admins
// Shows current plan, usage bars, plan comparison, and change plan option.

import { useState, useEffect, useCallback } from 'react';
import { apiFetch, apiUrl } from '../../services/apiClient';
import { useTenant } from '../../hooks/useTenant.jsx';
import { PLATFORM_DOMAIN } from '../../config';

// Usage bar component
function UsageBar({ label, used, max, icon }) {
  const unlimited = max === -1;
  const pct = unlimited ? 0 : Math.min((used / max) * 100, 100);
  const color = pct >= 90 ? '#e74c3c' : pct >= 70 ? '#f39c12' : '#27ae60';

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.9rem' }}>
        <span>{icon} {label}</span>
        <span style={{ fontWeight: 600 }}>
          {used}{unlimited ? '' : `/${max}`}{unlimited ? ' (∞)' : ''}
        </span>
      </div>
      <div style={{ background: '#e9ecef', borderRadius: '6px', height: '10px', overflow: 'hidden' }}>
        <div style={{
          width: unlimited ? '0%' : `${pct}%`,
          background: unlimited ? '#ccc' : color,
          height: '100%',
          borderRadius: '6px',
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

export default function SubscriptionPanel() {
  const tenantCtx = useTenant();
  const [data, setData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPlans, setShowPlans] = useState(false);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  // Custom domain state
  const [domainData, setDomainData] = useState(null);
  const [domainInput, setDomainInput] = useState('');
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainError, setDomainError] = useState('');
  const [domainSuccess, setDomainSuccess] = useState('');

  // Fetch subscription info
  const loadSubscription = useCallback(async () => {
    try {
      const res = await apiFetch(apiUrl('/subscription'));
      if (res.ok) {
        const subscriptionData = await res.json();
        setData((prev) => ({ ...prev, ...subscriptionData }));
      }
    } catch { /* non-critical */ }
  }, []);

  const loadUsage = useCallback(async () => {
    try {
      const res = await apiFetch(apiUrl('/subscription/usage'));
      if (res.ok) {
        const usageData = await res.json();
        setData((prev) => ({
          ...prev,
          usage: usageData.usage,
          plan: {
            ...prev?.plan,
            ...usageData.limits,
          },
        }));
      }
    } catch { /* non-critical */ }
  }, []);

  // Fetch available plans
  const loadPlans = useCallback(async () => {
    try {
      const res = await apiFetch(apiUrl('/subscription/plans'));
      if (res.ok) {
        setPlans(await res.json());
      }
    } catch { /* non-critical */ }
  }, []);

  // Fetch custom domain info
  const loadDomain = useCallback(async () => {
    try {
      const res = await apiFetch(apiUrl('/subscription/custom-domain'));
      if (res.ok) {
        const d = await res.json();
        setDomainData(d);
        setDomainInput(d.custom_domain || '');
      }
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    Promise.all([loadSubscription(), loadUsage(), loadDomain()]).finally(() => setLoading(false));
  }, [loadSubscription, loadUsage, loadDomain]);

  // Change plan handler
  const handleChangePlan = async (planId) => {
    if (planId === data?.plan?.id) return;
    setChanging(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await apiFetch(apiUrl('/subscription/change-plan'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.message || 'Error al cambiar plan');
      } else {
        setSuccessMsg(result.message);
        setShowPlans(false);
        // Reload subscription data + usage counts, then refresh tenant context
        await Promise.all([loadSubscription(), loadUsage()]);
        tenantCtx?.refreshSubscription?.();
      }
    } catch {
      setError('Error de conexión');
    }
    setChanging(false);
  };

  // Open plan comparison modal and load plans
  const handleShowPlans = async () => {
    if (plans.length === 0) await loadPlans();
    setShowPlans(true);
  };

  // Save custom domain
  const handleSaveDomain = async () => {
    const trimmed = domainInput.trim().toLowerCase();
    if (!trimmed) return;
    setDomainSaving(true);
    setDomainError('');
    setDomainSuccess('');
    try {
      const res = await apiFetch(apiUrl('/subscription/custom-domain'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: trimmed }),
      });
      const result = await res.json();
      if (!res.ok) {
        setDomainError(result.message || 'Error al guardar dominio');
      } else {
        setDomainSuccess('Dominio guardado correctamente');
        await loadDomain();
      }
    } catch {
      setDomainError('Error de conexión');
    }
    setDomainSaving(false);
  };

  // Remove custom domain
  const handleRemoveDomain = async () => {
    setDomainSaving(true);
    setDomainError('');
    setDomainSuccess('');
    try {
      const res = await apiFetch(apiUrl('/subscription/custom-domain'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: null }),
      });
      const result = await res.json();
      if (!res.ok) {
        setDomainError(result.message || 'Error al eliminar dominio');
      } else {
        setDomainSuccess('Dominio eliminado');
        setDomainInput('');
        await loadDomain();
      }
    } catch {
      setDomainError('Error de conexión');
    }
    setDomainSaving(false);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
        Cargando suscripción...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
        No se pudo cargar la información de suscripción.
      </div>
    );
  }

  const { plan, usage = {}, subscription, tenant } = data;
  const isTrialExpiring = subscription.trial_ends_at
    && new Date(subscription.trial_ends_at) - Date.now() < 3 * 24 * 60 * 60 * 1000
    && subscription.status === 'trial';

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>📋 Suscripción</h2>

      {/* Trial expiry warning */}
      {isTrialExpiring && (
        <div style={{
          background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '8px',
          padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.9rem', color: '#856404',
        }}>
          ⚠️ Tu periodo de prueba termina pronto. Actualiza tu plan para no perder acceso.
        </div>
      )}

      {successMsg && (
        <div style={{
          background: '#d4edda', border: '1px solid #28a745', borderRadius: '8px',
          padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.9rem', color: '#155724',
        }}>
          ✓ {successMsg}
        </div>
      )}

      {/* Plan info card */}
      <div style={{
        background: '#fff', borderRadius: '12px', border: '1px solid #e0e0e0',
        padding: '1.5rem', marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <span style={{
              display: 'inline-block', background: '#eef2ff', color: '#4338ca',
              padding: '0.3rem 0.8rem', borderRadius: '6px', fontWeight: 700, fontSize: '0.9rem',
            }}>
              {plan.name}
            </span>
            {plan.price_monthly > 0 && (
              <span style={{ marginLeft: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
                ${plan.price_monthly}/mes
              </span>
            )}
          </div>
          <span style={{
            fontSize: '0.8rem',
            padding: '0.2rem 0.6rem',
            borderRadius: '4px',
            background: subscription.status === 'active' ? '#d4edda' : subscription.status === 'trial' ? '#fff3cd' : '#f8d7da',
            color: subscription.status === 'active' ? '#155724' : subscription.status === 'trial' ? '#856404' : '#721c24',
          }}>
            {subscription.status === 'active' ? 'Activo' : subscription.status === 'trial' ? 'Trial' : subscription.status}
          </span>
        </div>

        {/* Dates */}
        <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '1.25rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          {subscription.trial_ends_at && (
            <span>Trial expira: {new Date(subscription.trial_ends_at).toLocaleDateString()}</span>
          )}
          {subscription.period_end && (
            <span>Próxima renovación: {new Date(subscription.period_end).toLocaleDateString()}</span>
          )}
        </div>

        {/* Usage bars */}
        <UsageBar label="Productos" used={usage.products || 0} max={plan.max_products} icon="📦" />
        <UsageBar label="Órdenes este mes" used={usage.orders_month || 0} max={plan.max_orders_month} icon="📋" />
        <UsageBar label="Storage (MB)" used={usage.storage_mb || 0} max={plan.max_storage_mb} icon="💾" />

        <button
          onClick={handleShowPlans}
          style={{
            marginTop: '1rem', padding: '0.7rem 1.5rem',
            background: '#4f46e5', color: '#fff', border: 'none',
            borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem',
          }}
        >
          Cambiar plan
        </button>
      </div>

      {/* Tenant info */}
      <div style={{
        background: '#f8f9fa', borderRadius: '12px', padding: '1.25rem',
        fontSize: '0.9rem', color: '#555',
      }}>
        <div style={{ marginBottom: '0.4rem' }}><strong>Tienda:</strong> {tenant.name}</div>
        <div style={{ marginBottom: '0.4rem' }}><strong>Subdominio:</strong> {tenant.slug}.{PLATFORM_DOMAIN}</div>
        <div><strong>Estado:</strong> {tenant.status}</div>
      </div>

      {/* Custom domain section */}
      <div style={{
        background: '#fff', borderRadius: '12px', border: '1px solid #e0e0e0',
        padding: '1.5rem', marginTop: '1.5rem',
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>🌐 Dominio personalizado</h3>

        {/* Feature gate: show upgrade message if plan doesn't support it */}
        {domainData && !domainData.allowed ? (
          <div style={{
            background: '#f8f9fa', borderRadius: '8px', padding: '1rem',
            fontSize: '0.9rem', color: '#666', textAlign: 'center',
          }}>
            <p style={{ margin: '0 0 0.5rem' }}>Tu plan actual no incluye dominio personalizado.</p>
            <button
              onClick={handleShowPlans}
              style={{
                padding: '0.5rem 1rem', background: '#4f46e5', color: '#fff',
                border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Actualizar plan
            </button>
          </div>
        ) : (
          <>
            {/* Feedback messages */}
            {domainError && (
              <div style={{ background: '#fff3f3', color: '#c0392b', padding: '0.6rem', borderRadius: '6px', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                {domainError}
              </div>
            )}
            {domainSuccess && (
              <div style={{ background: '#d4edda', color: '#155724', padding: '0.6rem', borderRadius: '6px', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                ✓ {domainSuccess}
              </div>
            )}

            {/* Current domain display */}
            {domainData?.custom_domain && (
              <div style={{
                background: '#eef2ff', borderRadius: '8px', padding: '0.75rem 1rem',
                marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontWeight: 600, color: '#4338ca' }}>{domainData.custom_domain}</span>
                <button
                  onClick={handleRemoveDomain}
                  disabled={domainSaving}
                  style={{
                    background: '#e74c3c', color: '#fff', border: 'none',
                    borderRadius: '6px', padding: '0.35rem 0.75rem', fontSize: '0.8rem',
                    cursor: 'pointer', opacity: domainSaving ? 0.6 : 1,
                  }}
                >
                  Eliminar
                </button>
              </div>
            )}

            {/* Domain input + save */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <input
                type="text"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="mitienda.com"
                style={{
                  flex: 1, padding: '0.6rem 0.75rem', border: '1px solid #ccc',
                  borderRadius: '6px', fontSize: '0.9rem',
                }}
              />
              <button
                onClick={handleSaveDomain}
                disabled={domainSaving || !domainInput.trim()}
                style={{
                  padding: '0.6rem 1.2rem', background: '#4f46e5', color: '#fff',
                  border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer',
                  opacity: domainSaving || !domainInput.trim() ? 0.6 : 1,
                }}
              >
                {domainSaving ? '...' : 'Guardar'}
              </button>
            </div>

            {/* DNS instructions */}
            {domainData?.dns_instructions && (
              <div style={{
                background: '#f8f9fa', borderRadius: '8px', padding: '1rem',
                fontSize: '0.85rem', color: '#555',
              }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>📋 Configuración DNS requerida:</div>
                <div style={{ fontFamily: 'monospace', background: '#fff', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
                  {domainData.dns_instructions.type} → <strong>{domainData.dns_instructions.value}</strong>
                </div>
                <p style={{ margin: '0.5rem 0 0', color: '#888', fontSize: '0.8rem' }}>
                  Agrega este registro en tu proveedor de DNS. Los cambios pueden tardar hasta 48 horas.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Plan comparison modal */}
      {showPlans && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem',
        }}
          onClick={() => setShowPlans(false)}
        >
          <div
            style={{
              background: '#fff', borderRadius: '16px', padding: '2rem',
              maxWidth: '720px', width: '100%', maxHeight: '80vh', overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>Planes disponibles</h3>
              <button onClick={() => setShowPlans(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            {error && (
              <div style={{ background: '#fff3f3', color: '#c0392b', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
              {plans.map(p => {
                const isCurrent = p.id === plan.id;
                return (
                  <div key={p.id} style={{
                    border: isCurrent ? '2px solid #4f46e5' : '1px solid #e0e0e0',
                    borderRadius: '12px', padding: '1.25rem', textAlign: 'center',
                    background: isCurrent ? '#eef2ff' : '#fff',
                  }}>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>{p.name}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4f46e5', marginBottom: '0.5rem' }}>
                      {p.price_monthly > 0 ? `$${p.price_monthly}` : 'Gratis'}
                      {p.price_monthly > 0 && <span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#888' }}>/mes</span>}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#666', lineHeight: 1.6, marginBottom: '1rem' }}>
                      <div>Productos: {p.max_products === -1 ? '∞' : p.max_products}</div>
                      <div>Órdenes/mes: {p.max_orders_month === -1 ? '∞' : p.max_orders_month}</div>
                      <div>Storage: {p.max_storage_mb === -1 ? '∞' : `${p.max_storage_mb}MB`}</div>
                    </div>
                    <button
                      disabled={isCurrent || changing}
                      onClick={() => handleChangePlan(p.id)}
                      style={{
                        width: '100%', padding: '0.5rem',
                        background: isCurrent ? '#ccc' : '#4f46e5',
                        color: '#fff', border: 'none', borderRadius: '8px',
                        fontWeight: 600, cursor: isCurrent ? 'default' : 'pointer',
                        opacity: changing ? 0.6 : 1,
                      }}
                    >
                      {isCurrent ? 'Plan actual' : changing ? '...' : 'Seleccionar'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
