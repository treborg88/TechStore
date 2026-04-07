// OnboardingWizard.jsx — 3-step tenant registration wizard
// Step 1: Business name + subdomain (real-time availability check)
// Step 2: Admin credentials (email + password)
// Step 3: Confirm + create tenant

import { useState, useCallback, useRef, useEffect } from 'react';
import { apiFetch, apiUrl } from '../../services/apiClient';

// Auto-generate slug from business name
function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

// Password validation (min 8, uppercase, lowercase, number)
function validatePassword(pw) {
  if (pw.length < 8) return 'Mínimo 8 caracteres';
  if (!/[A-Z]/.test(pw)) return 'Debe incluir al menos una mayúscula';
  if (!/[a-z]/.test(pw)) return 'Debe incluir al menos una minúscula';
  if (!/[0-9]/.test(pw)) return 'Debe incluir al menos un número';
  return '';
}

export default function OnboardingWizard() {
  const [step, setStep] = useState(1);

  // Step 1 — Business
  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugStatus, setSlugStatus] = useState(null); // null | 'checking' | { available, reason }

  // Step 2 — Credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 3 — Submit
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null); // { storeUrl }

  // Debounce timer for slug check
  const slugTimer = useRef(null);

  // --- Slug availability check (debounced 500ms) ---
  const checkSlug = useCallback(async (value) => {
    if (!value || value.length < 3) {
      setSlugStatus(null);
      return;
    }
    setSlugStatus('checking');
    try {
      const res = await apiFetch(apiUrl(`/saas/check-slug/${encodeURIComponent(value)}`));
      const data = await res.json();
      setSlugStatus(data);
    } catch {
      setSlugStatus({ available: false, reason: 'Error de conexión' });
    }
  }, []);

  // Auto-generate slug when business name changes (unless user edited slug manually)
  const handleBusinessNameChange = (value) => {
    setBusinessName(value);
    if (!slugEdited) {
      const generated = slugify(value);
      setSlug(generated);
      // Debounce check
      clearTimeout(slugTimer.current);
      slugTimer.current = setTimeout(() => checkSlug(generated), 500);
    }
  };

  // Manual slug edit
  const handleSlugChange = (value) => {
    const clean = value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 63);
    setSlug(clean);
    setSlugEdited(true);
    clearTimeout(slugTimer.current);
    slugTimer.current = setTimeout(() => checkSlug(clean), 500);
  };

  // Cleanup timer on unmount
  useEffect(() => () => clearTimeout(slugTimer.current), []);

  // --- Step validation ---
  const step1Valid = businessName.trim().length >= 2
    && slug.length >= 3
    && slugStatus?.available === true;

  const passwordError = password ? validatePassword(password) : '';
  const passwordsMatch = password && confirmPassword && password === confirmPassword;
  const step2Valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    && !passwordError
    && passwordsMatch;

  // --- Submit registration ---
  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await apiFetch(apiUrl('/saas/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          businessName: businessName.trim(),
          ownerEmail: email.trim(),
          ownerPassword: password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Error al crear la tienda');
        setSubmitting(false);
        return;
      }
      setSuccess({ storeUrl: data.storeUrl });
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
      setSubmitting(false);
    }
  };

  // --- Styles ---
  const styles = {
    wrapper: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '1rem',
    },
    card: {
      background: '#fff',
      borderRadius: '16px',
      padding: '2.5rem',
      maxWidth: '480px',
      width: '100%',
      boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
    },
    title: { fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.25rem', color: '#1a1a2e' },
    subtitle: { color: '#666', margin: '0 0 2rem', fontSize: '0.95rem' },
    label: { display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.9rem', color: '#333' },
    input: {
      width: '100%',
      padding: '0.75rem 1rem',
      border: '2px solid #e0e0e0',
      borderRadius: '10px',
      fontSize: '1rem',
      outline: 'none',
      transition: 'border-color 0.2s',
      boxSizing: 'border-box',
    },
    inputFocus: { borderColor: '#667eea' },
    fieldGroup: { marginBottom: '1.25rem' },
    btn: {
      width: '100%',
      padding: '0.85rem',
      border: 'none',
      borderRadius: '10px',
      fontSize: '1rem',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'opacity 0.2s',
    },
    btnPrimary: { background: '#667eea', color: '#fff' },
    btnSecondary: { background: 'transparent', color: '#667eea', border: '2px solid #667eea', marginTop: '0.75rem' },
    btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
    preview: {
      background: '#f0f0ff',
      borderRadius: '8px',
      padding: '0.6rem 1rem',
      fontSize: '0.85rem',
      color: '#444',
      marginTop: '0.5rem',
    },
    slugBadge: (ok) => ({
      display: 'inline-block',
      padding: '0.2rem 0.6rem',
      borderRadius: '6px',
      fontSize: '0.8rem',
      fontWeight: 600,
      marginTop: '0.35rem',
      background: ok ? '#d4edda' : '#f8d7da',
      color: ok ? '#155724' : '#721c24',
    }),
    error: {
      background: '#fff3f3',
      color: '#c0392b',
      padding: '0.75rem 1rem',
      borderRadius: '8px',
      marginBottom: '1rem',
      fontSize: '0.9rem',
    },
    steps: {
      display: 'flex',
      justifyContent: 'center',
      gap: '0.5rem',
      marginBottom: '2rem',
    },
    stepDot: (active) => ({
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      background: active ? '#667eea' : '#ddd',
      transition: 'background 0.3s',
    }),
    passwordToggle: {
      position: 'absolute',
      right: '12px',
      top: '50%',
      transform: 'translateY(-50%)',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: '1.1rem',
      color: '#888',
    },
  };

  // --- Success screen ---
  if (success) {
    return (
      <div style={styles.wrapper}>
        <div style={{ ...styles.card, textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
          <h1 style={{ ...styles.title, fontSize: '1.5rem' }}>¡Tu tienda está lista!</h1>
          <p style={{ color: '#666', margin: '1rem 0 2rem' }}>
            Accede a tu nueva tienda y comienza a vender.
          </p>
          <a
            href={success.storeUrl}
            style={{ ...styles.btn, ...styles.btnPrimary, display: 'block', textDecoration: 'none', textAlign: 'center' }}
          >
            Ir a mi tienda →
          </a>
        </div>
      </div>
    );
  }

  // --- Loading screen (while creating) ---
  if (submitting) {
    return (
      <div style={styles.wrapper}>
        <div style={{ ...styles.card, textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem', animation: 'spin 1s linear infinite' }}>⚙️</div>
          <h2 style={{ color: '#333', margin: '0 0 0.5rem' }}>Estamos preparando tu tienda...</h2>
          <p style={{ color: '#888' }}>Esto toma solo unos segundos.</p>
          {/* Inline keyframe for spinner */}
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        {/* Step indicator dots */}
        <div style={styles.steps}>
          {[1, 2, 3].map(n => <div key={n} style={styles.stepDot(n <= step)} />)}
        </div>

        {/* --- Step 1: Business --- */}
        {step === 1 && (
          <>
            <h1 style={styles.title}>Crea tu tienda</h1>
            <p style={styles.subtitle}>Elige un nombre y subdominio para tu negocio.</p>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Nombre del negocio</label>
              <input
                style={styles.input}
                type="text"
                placeholder="Ej: Mi Tienda LED"
                value={businessName}
                onChange={(e) => handleBusinessNameChange(e.target.value)}
                maxLength={100}
                autoFocus
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Subdominio</label>
              <input
                style={styles.input}
                type="text"
                placeholder="mi-tienda-led"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                maxLength={63}
              />
              {/* Availability indicator */}
              {slugStatus === 'checking' && (
                <span style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.35rem', display: 'inline-block' }}>
                  Verificando...
                </span>
              )}
              {slugStatus && slugStatus !== 'checking' && (
                <span style={styles.slugBadge(slugStatus.available)}>
                  {slugStatus.available ? '✓ Disponible' : slugStatus.reason || 'No disponible'}
                </span>
              )}
              {/* Live preview */}
              {slug && (
                <div style={styles.preview}>
                  Tu tienda: <strong>{slug}.eonsclover.com</strong>
                </div>
              )}
            </div>

            <button
              style={{ ...styles.btn, ...styles.btnPrimary, ...(step1Valid ? {} : styles.btnDisabled) }}
              disabled={!step1Valid}
              onClick={() => setStep(2)}
            >
              Continuar
            </button>
          </>
        )}

        {/* --- Step 2: Credentials --- */}
        {step === 2 && (
          <>
            <h1 style={styles.title}>Tu cuenta de admin</h1>
            <p style={styles.subtitle}>Estas credenciales son para acceder al panel de tu tienda.</p>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Email</label>
              <input
                style={styles.input}
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={styles.input}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  style={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {passwordError && (
                <span style={{ fontSize: '0.8rem', color: '#c0392b', marginTop: '0.25rem', display: 'block' }}>
                  {passwordError}
                </span>
              )}
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Confirmar contraseña</label>
              <input
                style={styles.input}
                type={showPassword ? 'text' : 'password'}
                placeholder="Repite la contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {confirmPassword && !passwordsMatch && (
                <span style={{ fontSize: '0.8rem', color: '#c0392b', marginTop: '0.25rem', display: 'block' }}>
                  Las contraseñas no coinciden
                </span>
              )}
            </div>

            <button
              style={{ ...styles.btn, ...styles.btnPrimary, ...(step2Valid ? {} : styles.btnDisabled) }}
              disabled={!step2Valid}
              onClick={() => setStep(3)}
            >
              Continuar
            </button>
            <button
              style={{ ...styles.btn, ...styles.btnSecondary }}
              onClick={() => setStep(1)}
            >
              ← Volver
            </button>
          </>
        )}

        {/* --- Step 3: Confirm --- */}
        {step === 3 && (
          <>
            <h1 style={styles.title}>Confirma tu tienda</h1>
            <p style={styles.subtitle}>Revisa los datos antes de crear.</p>

            <div style={{ background: '#f8f9fa', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <span style={{ color: '#888', fontSize: '0.85rem' }}>Negocio</span>
                <div style={{ fontWeight: 600 }}>{businessName}</div>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <span style={{ color: '#888', fontSize: '0.85rem' }}>URL de tu tienda</span>
                <div style={{ fontWeight: 600 }}>{slug}.eonsclover.com</div>
              </div>
              <div>
                <span style={{ color: '#888', fontSize: '0.85rem' }}>Email del admin</span>
                <div style={{ fontWeight: 600 }}>{email}</div>
              </div>
            </div>

            {error && <div style={styles.error}>{error}</div>}

            <button
              style={{ ...styles.btn, ...styles.btnPrimary }}
              onClick={handleSubmit}
            >
              Crear mi tienda — 14 días gratis
            </button>
            <button
              style={{ ...styles.btn, ...styles.btnSecondary }}
              onClick={() => { setError(''); setStep(2); }}
            >
              ← Volver
            </button>
          </>
        )}
      </div>
    </div>
  );
}
