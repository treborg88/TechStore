// OnboardingWizard.jsx — 2-step registration wizard
// Step 1 matches enter email and pass step.html
// Step 2 matches signup1-crea nombre y dominio de tu tienda.html
// API is called only on step 2 submit.

import { useState, useRef, useEffect } from 'react';
import { apiFetch, apiUrl } from '../../services/apiClient';
import { PLATFORM_DOMAIN, PLATFORM_PROTOCOL } from '../../config';

// ── Design tokens ──────────────────────────────────────────────────────────────
const glass = {
    background: 'rgba(255,255,255,0.05)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    border: '1px solid rgba(255,255,255,0.08)',
};

const inputBase = {
    display: 'block', width: '100%', padding: '0.75rem 1rem',
    borderRadius: '12px', background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)', color: '#fff',
    fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'Inter, sans-serif', transition: 'border-color 0.2s, box-shadow 0.2s',
};

const socialBtn = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
    padding: '12px', borderRadius: '12px',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
    color: 'rgba(255,255,255,0.80)', fontSize: '0.875rem', fontWeight: 500,
    cursor: 'pointer', fontFamily: 'Inter, sans-serif',
};

const eyeBtn = {
    position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'rgba(255,255,255,0.40)', padding: 0, display: 'flex', alignItems: 'center',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function slugify(text) {
    return text
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 30);
}

function sanitizeDomain(value) {
    return value
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-/, '');
}

function getStrength(val) {
    if (!val) return null;
    let score = 0;
    if (val.length >= 8)  score++;
    if (val.length >= 12) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    const levels = [
        { pct: '20%', color: '#ef4444', text: 'Muy débil' },
        { pct: '40%', color: '#f97316', text: 'Débil' },
        { pct: '60%', color: '#eab308', text: 'Regular' },
        { pct: '80%', color: '#22d3ee', text: 'Buena' },
        { pct: '100%', color: '#22c55e', text: 'Excelente' },
    ];
    return levels[Math.min(score - 1, 4)] || levels[0];
}

// ── Sub-components ─────────────────────────────────────────────────────────────
const EyeOff = () => (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.477 10.477A3 3 0 0013.5 13.5M6.228 6.228A10.45 10.45 0 003 12c1.657 3.894 5.516 6.5 9 6.5a10.45 10.45 0 005.772-1.728M9.878 9.878C10.564 9.326 11.248 9 12 9a3 3 0 013 3c0 .752-.326 1.436-.878 2.122" />
    </svg>
);
const EyeOn = () => (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
);

function LogoSvg() {
    return (
        <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="19" stroke="#22d3ee" strokeWidth="1.5" fill="none" opacity="0.6" />
            <path d="M20 20 Q10 18 10 10 Q10 2 18 4 Q22 5 20 12Z" fill="url(#onb1)" opacity="0.9" />
            <path d="M20 20 Q22 10 30 10 Q38 10 36 18 Q35 22 28 20Z" fill="url(#onb2)" opacity="0.9" />
            <path d="M20 20 Q10 22 10 30 Q10 38 18 36 Q22 35 20 28Z" fill="url(#onb1)" opacity="0.9" />
            <path d="M20 20 Q22 30 30 30 Q38 30 36 22 Q35 18 28 20Z" fill="url(#onb2)" opacity="0.9" />
            <path d="M20 30 Q19 35 17 37" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
            <defs>
                <linearGradient id="onb1" x1="10" y1="10" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
                <linearGradient id="onb2" x1="30" y1="10" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
            </defs>
        </svg>
    );
}

// Step dots: renders 4 dots where n < step = done, n === step = active, rest = inactive
function StepDots({ step }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '2.5rem' }}>
            {[1, 2, 3, 4].map(n => (
                <div key={n} style={{
                    height: '10px',
                    borderRadius: n === step ? '6px' : '50%',
                    width: n === step ? '28px' : '10px',
                    background: n < step
                        ? 'rgba(34,211,238,0.5)'
                        : n === step
                            ? '#22d3ee'
                            : 'rgba(255,255,255,0.18)',
                    transition: 'all 0.3s',
                }} />
            ))}
        </div>
    );
}

// Shared page shell (blobs + navbar + centered main)
function PageShell({ step, loginUrl, children }) {
    // Blobs differ per step (step 1: purple top-right, step 2: cyan top-left)
    const blob1 = step === 1
        ? { width: '500px', height: '500px', background: 'rgba(139,92,246,0.13)', top: '-100px', right: '-120px' }
        : { width: '480px', height: '480px', background: 'rgba(34,211,238,0.12)', top: '-80px', left: '-120px' };
    const blob2 = step === 1
        ? { width: '420px', height: '420px', background: 'rgba(34,211,238,0.11)', bottom: '40px', left: '-100px' }
        : { width: '400px', height: '400px', background: 'rgba(139,92,246,0.14)', bottom: '60px', right: '-100px' };

    return (
        <div style={{ minHeight: '100vh', background: '#050816', color: '#fff', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div style={{ position: 'fixed', borderRadius: '999px', filter: 'blur(110px)', pointerEvents: 'none', zIndex: 0, ...blob1 }} />
            <div style={{ position: 'fixed', borderRadius: '999px', filter: 'blur(110px)', pointerEvents: 'none', zIndex: 0, ...blob2 }} />

            <header style={{ position: 'relative', zIndex: 20, width: '100%', borderBottom: '1px solid rgba(255,255,255,0.10)', background: 'rgba(5,8,22,0.80)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
                <div style={{ maxWidth: '1024px', margin: '0 auto', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#fff', textDecoration: 'none' }}>
                        <LogoSvg />
                        <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>EonsClover</span>
                    </a>
                    <a href={loginUrl} style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>
                        ¿Ya tienes cuenta? <span style={{ color: '#22d3ee', fontWeight: 500 }}>Inicia sesión</span>
                    </a>
                </div>
            </header>

            <main style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1.5rem' }}>
                <div style={{ width: '100%', maxWidth: '512px' }}>
                    {children}
                </div>
            </main>
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function OnboardingWizard() {
    const [step, setStep] = useState(1);

    // Step 1 state
    const [email, setEmail]                     = useState('');
    const [password, setPassword]               = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword]       = useState(false);
    const [showConfirm, setShowConfirm]         = useState(false);
    const [termsAccepted, setTermsAccepted]     = useState(false);
    const [emailError, setEmailError]           = useState('');
    const [matchError, setMatchError]           = useState('');
    const [step1Error, setStep1Error]           = useState('');

    // Step 2 state
    const [storeName, setStoreName]     = useState('');
    const [domain, setDomain]           = useState('');
    const [domainEdited, setDomainEdited] = useState(false);
    const [domainFocused, setDomainFocused] = useState(false);
    const [storeError, setStoreError]   = useState('');
    const [submitting, setSubmitting]   = useState(false);
    const [success, setSuccess]         = useState(null);

    const strength = getStrength(password);
    const loginUrl = `${PLATFORM_PROTOCOL}//${PLATFORM_DOMAIN}/login`;
    const domainRef = useRef(null);

    // Inject Inter font
    useEffect(() => {
        const id = 'onboarding-inter';
        if (!document.getElementById(id)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
            link.id = id;
            document.head.appendChild(link);
        }
    }, []);

    // ── Step 1: advance ────────────────────────────────────────────────────────
    const handleStep1 = (e) => {
        e.preventDefault();

        // TODO: re-enable validation before production
        // let valid = true;
        // if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        //     setEmailError('Ingresa un correo válido.');
        //     valid = false;
        // } else {
        //     setEmailError('');
        // }
        // if (password.length < 8) {
        //     setStep1Error('La contraseña debe tener al menos 8 caracteres.');
        //     valid = false;
        // } else if (password !== confirmPassword) {
        //     setMatchError('Las contraseñas no coinciden.');
        //     valid = false;
        // } else {
        //     setMatchError('');
        //     setStep1Error('');
        // }
        // if (!termsAccepted) {
        //     setStep1Error('Debes aceptar los términos y condiciones para continuar.');
        //     valid = false;
        // }
        // if (!valid) return;

        window.scrollTo({ top: 0, behavior: 'smooth' });
        setStep(2);
    };

    // ── Step 2: store name auto-generates domain ───────────────────────────────
    const handleStoreNameChange = (value) => {
        setStoreName(value);
        if (!domainEdited) {
            setDomain(slugify(value));
        }
    };

    const handleDomainChange = (value) => {
        const clean = sanitizeDomain(value);
        setDomain(clean);
        setDomainEdited(true);
    };

    const showPreview = storeName.trim() || domain;

    // ── Step 2: submit to API ──────────────────────────────────────────────────
    const handleStep2 = async (e) => {
        e.preventDefault();

        if (!storeName.trim() || storeName.trim().length < 3) {
            setStoreError('El nombre de tu tienda debe tener al menos 3 caracteres.');
            return;
        }
        if (!domain || domain.length < 2) {
            setStoreError('Ingresa una dirección web válida.');
            return;
        }
        setStoreError('');
        setSubmitting(true);

        try {
            const res = await apiFetch(apiUrl('/saas/register'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ownerEmail: email.trim(),
                    ownerPassword: password,
                    businessName: storeName.trim(),
                    slug: domain,
                }),
            });
            const data = await res.json();
            if (!res.ok) { setStoreError(data.message || 'Error al crear la tienda'); setSubmitting(false); return; }
            setSuccess({ storeUrl: data.storeUrl });
        } catch {
            setStoreError('Error de conexión. Intenta de nuevo.');
            setSubmitting(false);
        }
    };

    // ── Success screen ─────────────────────────────────────────────────────────
    if (success) {
        return (
            <div style={{ minHeight: '100vh', background: '#050816', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', color: '#fff' }}>
                <div style={{ ...glass, borderRadius: '24px', padding: '3rem', maxWidth: '480px', width: '100%', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 1rem', background: 'linear-gradient(to right, #22d3ee, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                        ¡Tu tienda está lista!
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)', margin: '0 0 2rem', lineHeight: 1.6 }}>
                        Accede a tu nueva tienda y comienza a vender hoy mismo.
                    </p>
                    <a href={success.storeUrl} style={{ display: 'block', padding: '14px 32px', borderRadius: '14px', background: '#22d3ee', color: '#050816', fontWeight: 700, fontSize: '1rem', textAlign: 'center', textDecoration: 'none' }}>
                        Ir a mi tienda →
                    </a>
                </div>
            </div>
        );
    }

    // ── STEP 1 ─────────────────────────────────────────────────────────────────
    if (step === 1) return (
        <PageShell step={1} loginUrl={loginUrl}>
            <StepDots step={1} />

            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                <p style={{ fontSize: '0.75rem', color: 'rgba(34,211,238,0.8)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 0.75rem' }}>
                    Paso 1 de 4
                </p>
                <h1 style={{ fontSize: '2.25rem', fontWeight: 800, lineHeight: 1.25, margin: '0 0 0.75rem', color: '#fff' }}>
                    Crea tu{' '}
                    <span style={{ background: 'linear-gradient(to right, #22d3ee, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                        cuenta
                    </span>
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '1rem', lineHeight: 1.625, maxWidth: '360px', margin: '0 auto' }}>
                    Empieza gratis. Sin tarjeta de crédito, sin compromisos.
                </p>
            </div>

            <div style={{ ...glass, borderRadius: '24px', padding: '2rem', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>

                {/* OAuth buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '0.5rem' }}>
                    <button type="button" style={socialBtn}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Google
                    </button>
                    <button type="button" style={socialBtn}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                        </svg>
                        GitHub
                    </button>
                </div>

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'rgba(255,255,255,0.20)', fontSize: '0.75rem', margin: '24px 0' }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.10)' }} />
                    o continúa con tu correo
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.10)' }} />
                </div>

                <form onSubmit={handleStep1} autoComplete="off" noValidate>

                    {/* Email */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'rgba(255,255,255,0.75)', marginBottom: '0.5rem' }}>
                            Correo electrónico
                        </label>
                        <input type="email" style={inputBase} placeholder="tu@correo.com"
                            value={email} onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
                            autoComplete="email" autoFocus />
                        {emailError && <p style={{ marginTop: '6px', fontSize: '0.75rem', color: '#f87171' }}>{emailError}</p>}
                    </div>

                    {/* Password */}
                    <div style={{ marginBottom: '0.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'rgba(255,255,255,0.75)', marginBottom: '0.5rem' }}>
                            Contraseña
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input type={showPassword ? 'text' : 'password'}
                                style={{ ...inputBase, paddingRight: '3rem' }}
                                placeholder="Mínimo 8 caracteres" value={password}
                                onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                            <button type="button" onClick={() => setShowPassword(v => !v)} aria-label="Ver contraseña" style={eyeBtn}>
                                {showPassword ? <EyeOn /> : <EyeOff />}
                            </button>
                        </div>
                        <div style={{ height: '4px', borderRadius: '99px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: '8px' }}>
                            <div style={{ height: '100%', borderRadius: '99px', width: strength?.pct || '0%', background: strength?.color || 'transparent', transition: 'width 0.3s, background 0.3s' }} />
                        </div>
                        {strength && <p style={{ marginTop: '6px', fontSize: '0.75rem', color: strength.color }}>{strength.text}</p>}
                    </div>

                    {/* Confirm password */}
                    <div style={{ marginBottom: '1.5rem', marginTop: '1.25rem' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'rgba(255,255,255,0.75)', marginBottom: '0.5rem' }}>
                            Confirmar contraseña
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input type={showConfirm ? 'text' : 'password'}
                                style={{ ...inputBase, paddingRight: '3rem' }}
                                placeholder="Repite tu contraseña" value={confirmPassword}
                                onChange={(e) => { setConfirmPassword(e.target.value); if (matchError) setMatchError(''); }}
                                autoComplete="new-password" />
                            <button type="button" onClick={() => setShowConfirm(v => !v)} aria-label="Ver contraseña" style={eyeBtn}>
                                {showConfirm ? <EyeOn /> : <EyeOff />}
                            </button>
                        </div>
                        {matchError && <p style={{ marginTop: '6px', fontSize: '0.75rem', color: '#f87171' }}>{matchError}</p>}
                    </div>

                    {/* Terms */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1.75rem' }}>
                        <input id="onb-terms" type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)}
                            style={{ marginTop: '2px', width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer', accentColor: '#22d3ee' }} />
                        <label htmlFor="onb-terms" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.50)', lineHeight: 1.6, cursor: 'pointer' }}>
                            Acepto los <a href="#" style={{ color: '#22d3ee', textDecoration: 'none' }}>Términos de Servicio</a> y la{' '}
                            <a href="#" style={{ color: '#22d3ee', textDecoration: 'none' }}>Política de Privacidad</a> de EonsClover.
                        </label>
                    </div>

                    {step1Error && (
                        <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: '12px', fontSize: '0.875rem', marginBottom: '1rem' }}>
                            {step1Error}
                        </div>
                    )}

                    <button type="submit" style={{ background: '#22d3ee', color: '#050816', fontWeight: 700, borderRadius: '14px', padding: '14px 32px', fontSize: '1rem', width: '100%', border: 'none', cursor: 'pointer', letterSpacing: '0.01em', fontFamily: 'Inter, sans-serif', transition: 'transform 0.15s, box-shadow 0.15s, background 0.15s' }}>
                        Crear cuenta →
                    </button>
                </form>
            </div>

            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'rgba(255,255,255,0.30)', marginTop: '1.5rem' }}>
                🔒 Tus datos están protegidos con cifrado SSL de extremo a extremo.
            </p>
        </PageShell>
    );

    // ── STEP 2 ─────────────────────────────────────────────────────────────────
    return (
        <PageShell step={2} loginUrl={loginUrl}>
            <StepDots step={2} />

            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                <p style={{ fontSize: '0.75rem', color: 'rgba(34,211,238,0.8)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 0.75rem' }}>
                    Paso 2 de 4
                </p>
                <h1 style={{ fontSize: '2.25rem', fontWeight: 800, lineHeight: 1.25, margin: '0 0 0.75rem', color: '#fff' }}>
                    Dale un nombre a<br />
                    <span style={{ background: 'linear-gradient(to right, #22d3ee, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                        tu tienda
                    </span>
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '1rem', lineHeight: 1.625, maxWidth: '360px', margin: '0 auto' }}>
                    Este será el nombre que verán tus clientes. Puedes cambiarlo después.
                </p>
            </div>

            <div style={{ ...glass, borderRadius: '24px', padding: '2rem', boxShadow: '0 25px 50px rgba(0,0,0,0.4)' }}>
                <form onSubmit={handleStep2} autoComplete="off">

                    {/* Store name */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'rgba(255,255,255,0.75)', marginBottom: '0.5rem' }}>
                            Nombre de tu tienda
                        </label>
                        <input type="text" style={inputBase} placeholder="ej. Tech Paradise"
                            maxLength={60} autoFocus
                            value={storeName}
                            onChange={(e) => handleStoreNameChange(e.target.value)} />
                        <p style={{ marginTop: '8px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
                            Entre 3 y 60 caracteres. Puede incluir espacios.
                        </p>
                    </div>

                    {/* Domain */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'rgba(255,255,255,0.75)', marginBottom: '0.5rem' }}>
                            Dirección web de tu tienda
                        </label>
                        <div style={{ display: 'flex' }}>
                            <input
                                ref={domainRef}
                                type="text"
                                style={{ ...inputBase, borderRadius: '12px 0 0 12px', borderRight: 'none', flex: 1, ...(domainFocused ? { borderColor: 'rgba(34,211,238,0.6)' } : {}) }}
                                placeholder="tu-tienda"
                                maxLength={30}
                                spellCheck={false}
                                value={domain}
                                onChange={(e) => handleDomainChange(e.target.value)}
                                onFocus={() => setDomainFocused(true)}
                                onBlur={() => setDomainFocused(false)}
                            />
                            <div style={{ background: 'rgba(34,211,238,0.08)', border: `1px solid ${domainFocused ? 'rgba(34,211,238,0.6)' : 'rgba(34,211,238,0.2)'}`, borderLeft: 'none', color: 'rgba(34,211,238,0.8)', fontSize: '0.875rem', padding: '0 14px', borderRadius: '0 12px 12px 0', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', userSelect: 'none', transition: 'border-color 0.2s' }}>
                                .eonsclover.com
                            </div>
                        </div>
                        <p style={{ marginTop: '8px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
                            Solo letras minúsculas, números y guiones.
                        </p>
                    </div>

                    {/* URL preview badge */}
                    {showPreview && (
                        <div style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)', marginBottom: '2rem' }}>
                            Tu tienda estará en:{' '}
                            <span style={{ color: '#c4b5fd', fontWeight: 600 }}>
                                {domain || 'tu-tienda'}.eonsclover.com
                            </span>
                        </div>
                    )}

                    {storeError && (
                        <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: '12px', fontSize: '0.875rem', marginBottom: '1rem' }}>
                            {storeError}
                        </div>
                    )}

                    <button type="submit" disabled={submitting} style={{ background: submitting ? 'rgba(34,211,238,0.4)' : '#22d3ee', color: submitting ? 'rgba(5,8,22,0.5)' : '#050816', fontWeight: 700, borderRadius: '14px', padding: '14px 32px', fontSize: '1rem', width: '100%', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', letterSpacing: '0.01em', fontFamily: 'Inter, sans-serif', transition: 'transform 0.15s, box-shadow 0.15s, background 0.15s' }}>
                        {submitting ? 'Creando tu tienda...' : 'Continuar →'}
                    </button>

                </form>
            </div>

            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'rgba(255,255,255,0.30)', marginTop: '1.5rem' }}>
                🔒 Tus datos están protegidos con cifrado SSL de extremo a extremo.
            </p>
        </PageShell>
    );
}
