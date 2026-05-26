// SuperAdminLoginPage.jsx - Super admin login UI
// Matches design: Saas/superAdminLogin.html

import { useState, useEffect, useRef } from 'react';
import { API_URL } from '../../config';

// ── Icons ─────────────────────────────────────────────────────────────────────
const EyeOff = () => (
    <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.477 10.477A3 3 0 0013.5 13.5M6.228 6.228A10.45 10.45 0 003 12c1.657 3.894 5.516 6.5 9 6.5a10.45 10.45 0 005.772-1.728M9.878 9.878C10.564 9.326 11.248 9 12 9a3 3 0 013 3c0 .752-.326 1.436-.878 2.122"/>
    </svg>
);

const EyeOn = () => (
    <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
    </svg>
);

// ── Logo ──────────────────────────────────────────────────────────────────────
const LogoSvg = () => (
    <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="19" stroke="#22d3ee" strokeWidth="1.5" fill="none" opacity="0.6"/>
        <path d="M20 20 Q10 18 10 10 Q10 2 18 4 Q22 5 20 12Z" fill="url(#sl1)" opacity="0.9"/>
        <path d="M20 20 Q22 10 30 10 Q38 10 36 18 Q35 22 28 20Z" fill="url(#sl2)" opacity="0.9"/>
        <path d="M20 20 Q10 22 10 30 Q10 38 18 36 Q22 35 20 28Z" fill="url(#sl1)" opacity="0.9"/>
        <path d="M20 20 Q22 30 30 30 Q38 30 36 22 Q35 18 28 20Z" fill="url(#sl2)" opacity="0.9"/>
        <path d="M20 30 Q19 35 17 37" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7"/>
        <defs>
            <linearGradient id="sl1" x1="10" y1="10" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#22d3ee"/><stop offset="100%" stopColor="#8b5cf6"/>
            </linearGradient>
            <linearGradient id="sl2" x1="30" y1="10" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#8b5cf6"/><stop offset="100%" stopColor="#22d3ee"/>
            </linearGradient>
        </defs>
    </svg>
);

// ── Component ─────────────────────────────────────────────────────────────────
export default function SuperAdminLoginPage({ onLogin }) {
    const [step, setStep]                 = useState('credentials'); // 'credentials' | 'otp'
    const [email, setEmail]               = useState('');
    const [password, setPassword]         = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [otp, setOtp]                   = useState(['', '', '', '', '', '']);
    const [rememberDevice, setRememberDevice] = useState(false);
    const [emailErr, setEmailErr]         = useState('');
    const [passErr, setPassErr]           = useState('');
    const [otpErr, setOtpErr]             = useState('');
    const [loginErr, setLoginErr]         = useState('');
    const [loading, setLoading]           = useState(false);
    const otpRefs = useRef([]);

    // Inject Inter font
    useEffect(() => {
        const id = 'inter-font-sa';
        if (!document.getElementById(id)) {
            const link = document.createElement('link');
            link.id   = id;
            link.rel  = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
            document.head.appendChild(link);
        }
    }, []);

    // OTP digit handler
    const handleOtp = (idx, value) => {
        const digit = value.replace(/\D/g, '').slice(-1);
        const next = [...otp];
        next[idx] = digit;
        setOtp(next);
        if (digit && idx < 5) otpRefs.current[idx + 1]?.focus();
    };

    const handleOtpKeyDown = (idx, e) => {
        if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
            otpRefs.current[idx - 1]?.focus();
        }
    };

    // Paste full OTP code
    const handlePaste = (e) => {
        const data = (e.clipboardData || window.clipboardData)
            .getData('text').replace(/\D/g, '').slice(0, 6);
        if (data.length === 6) {
            setOtp(data.split(''));
            otpRefs.current[5]?.focus();
        }
    };

    // Step 1: validate email + password; check trusted device or send OTP
    const handleCredentialsSubmit = async (e) => {
        e.preventDefault();
        let valid = true;
        setLoginErr('');

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            setEmailErr('Correo inválido.'); valid = false;
        } else { setEmailErr(''); }

        if (!password) {
            setPassErr('Ingresa tu contraseña.'); valid = false;
        } else { setPassErr(''); }

        if (!valid) return;
        setLoading(true);

        try {
            // Check if this device is already trusted
            const deviceToken = localStorage.getItem('superAdminDeviceToken');
            if (deviceToken) {
                const dvRes = await fetch(`${API_URL}/superadmin/verify-device`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deviceToken, email: email.trim(), password })
                });
                const dvData = await dvRes.json();
                if (dvData.valid) {
                    // Device trusted — store secret and proceed
                    localStorage.setItem('superAdminSecret', password);
                    onLogin();
                    return;
                }
                // Token expired or invalid — remove it
                localStorage.removeItem('superAdminDeviceToken');
            }

            // Send OTP to admin email
            const res = await fetch(`${API_URL}/superadmin/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password })
            });
            if (!res.ok) {
                const d = await res.json();
                setLoginErr(d.message || 'Credenciales incorrectas.');
                return;
            }
            setOtp(['', '', '', '', '', '']);
            setStep('otp');
        } catch {
            setLoginErr('Error de conexión. Intente de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    // Step 2: verify OTP; store secret + device token if requested
    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        setLoginErr('');

        const code = otp.join('');
        if (code.length < 6) { setOtpErr('Código incompleto.'); return; }
        setOtpErr('');
        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/superadmin/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), code, rememberDevice })
            });
            if (!res.ok) {
                const d = await res.json();
                setLoginErr(d.message || 'Código inválido.');
                return;
            }
            const data = await res.json();

            // Store secret (localStorage if rememberDevice, else sessionStorage)
            const storage = rememberDevice ? localStorage : sessionStorage;
            storage.setItem('superAdminSecret', password);

            // Persist device token if remember was checked
            if (rememberDevice && data.deviceToken) {
                localStorage.setItem('superAdminDeviceToken', data.deviceToken);
            }
            onLogin();
        } catch {
            setLoginErr('Error de conexión. Intente de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    // ── Shared style tokens ───────────────────────────────────────────────────
    const inputBase = {
        width: '100%', boxSizing: 'border-box',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '12px',
        padding: '12px 16px',
        color: 'white',
        fontFamily: "'Inter', sans-serif",
        fontSize: '0.875rem',
        outline: 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
    };
    const labelStyle = {
        display: 'block',
        fontSize: '0.75rem', fontWeight: 500,
        color: 'rgba(255,255,255,0.6)',
        marginBottom: '8px',
    };
    const errStyle = { marginTop: '6px', fontSize: '0.75rem', color: '#f87171' };
    const otpBox   = {
        width: '44px', height: '52px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '12px',
        color: 'white',
        fontSize: '1.3rem', fontWeight: 700, textAlign: 'center',
        fontFamily: "'Inter', sans-serif",
        outline: 'none',
    };

    return (
        <div style={{ fontFamily: "'Inter', sans-serif", background: '#050816', color: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

            {/* Glow blobs */}
            <div style={{ position: 'fixed', width: '560px', height: '560px', borderRadius: '999px', filter: 'blur(120px)', background: 'rgba(139,92,246,0.13)', top: '-100px', right: '-80px', pointerEvents: 'none', zIndex: 0 }} />
            <div style={{ position: 'fixed', width: '480px', height: '480px', borderRadius: '999px', filter: 'blur(120px)', background: 'rgba(34,211,238,0.10)', bottom: '-60px', left: '-80px', pointerEvents: 'none', zIndex: 0 }} />

            {/* Header */}
            <header style={{ position: 'relative', zIndex: 10, width: '100%', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(5,8,22,0.8)', backdropFilter: 'blur(20px)' }}>
                <div style={{ maxWidth: '900px', margin: '0 auto', padding: '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                    {/* Logo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', zIndex: 1 }}>
                        <LogoSvg />
                        <div>
                            <div style={{ fontSize: '1.125rem', fontWeight: 800, lineHeight: 1 }}>EonsClover</div>
                            <div style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500, marginTop: '2px' }}>Plataforma SaaS</div>
                        </div>
                    </div>
                    {/* Centered title */}
                    <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>Panel de </span>
                        <span style={{ fontSize: '0.875rem', fontWeight: 800, background: 'linear-gradient(to right,#22d3ee,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Super Admin</span>
                    </div>
                </div>
            </header>

            {/* Main */}
            <main style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
                <div style={{ width: '100%', maxWidth: '440px' }}>

                    {/* Glass card */}
                    <div style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '32px', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}>

                        {/* Card header */}
                        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                            {/* Shield icon */}
                            <div style={{ width: '56px', height: '56px', borderRadius: '16px', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,rgba(34,211,238,0.15),rgba(139,92,246,0.15))', border: '1px solid rgba(255,255,255,0.10)' }}>
                                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#22d3ee" strokeWidth="1.6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
                                </svg>
                            </div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                                {step === 'credentials' ? 'Iniciar sesión' : 'Verificación 2FA'}
                            </h2>
                            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px', marginBottom: 0 }}>
                                {step === 'credentials' ? 'Acceso exclusivo para administradores' : `Código enviado a ${email}`}
                            </p>
                        </div>

                        {step === 'credentials' ? (
                            /* ── Step 1: Email + Password ─────────────────────────────────── */
                            <form onSubmit={handleCredentialsSubmit} noValidate>

                                {/* Email */}
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={labelStyle}>Correo de administrador</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="admin@eonsclover.com"
                                        style={inputBase}
                                        autoComplete="username"
                                    />
                                    {emailErr && <p style={errStyle}>{emailErr}</p>}
                                </div>

                                {/* Password */}
                                <div style={{ marginBottom: '24px' }}>
                                    <label style={{ ...labelStyle, marginBottom: '8px' }}>Contraseña de acceso</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••••••"
                                            style={{ ...inputBase, paddingRight: '48px' }}
                                            autoComplete="current-password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(p => !p)}
                                            aria-label="Mostrar contraseña"
                                            style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', padding: 0 }}
                                        >
                                            {showPassword ? <EyeOn /> : <EyeOff />}
                                        </button>
                                    </div>
                                    {passErr && <p style={errStyle}>{passErr}</p>}
                                </div>

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{ width: '100%', padding: '14px', borderRadius: '16px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? 'rgba(34,211,238,0.5)' : '#22d3ee', color: '#050816', fontWeight: 700, fontFamily: "'Inter', sans-serif", fontSize: '0.875rem', letterSpacing: '0.01em', transition: 'background 0.15s' }}
                                >
                                    {loading ? 'Verificando…' : 'Continuar →'}
                                </button>

                                {/* SSL badge */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                                    <span style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                                        </svg>
                                        SSL 256-bit
                                    </span>
                                </div>
                            </form>
                        ) : (
                            /* ── Step 2: TOTP Verification ────────────────────────────────── */
                            <form onSubmit={handleOtpSubmit} noValidate onPaste={handlePaste}>

                                {/* OTP boxes */}
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ ...labelStyle, textAlign: 'center' }}>Código de autenticación</label>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                        {otp.map((digit, i) => (
                                            <input
                                                key={i}
                                                ref={(el) => { otpRefs.current[i] = el; }}
                                                type="text"
                                                maxLength={1}
                                                value={digit}
                                                inputMode="numeric"
                                                pattern="[0-9]"
                                                onChange={(e) => handleOtp(i, e.target.value)}
                                                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                                style={otpBox}
                                            />
                                        ))}
                                    </div>
                                    {otpErr && <p style={{ ...errStyle, textAlign: 'center' }}>{otpErr}</p>}
                                </div>

                                {/* Remember device */}
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={rememberDevice}
                                            onChange={(e) => setRememberDevice(e.target.checked)}
                                            style={{ width: '14px', height: '14px', accentColor: '#22d3ee' }}
                                        />
                                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>Recordar este dispositivo por 30 días</span>
                                    </label>
                                </div>

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{ width: '100%', padding: '14px', borderRadius: '16px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? 'rgba(34,211,238,0.5)' : '#22d3ee', color: '#050816', fontWeight: 700, fontFamily: "'Inter', sans-serif", fontSize: '0.875rem', letterSpacing: '0.01em', transition: 'background 0.15s' }}
                                >
                                    {loading ? 'Verificando…' : 'Acceder al panel'}
                                </button>

                                {/* Back + SSL */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px' }}>
                                    <button
                                        type="button"
                                        onClick={() => { setStep('credentials'); setLoginErr(''); setOtp(['', '', '', '', '', '']); }}
                                        style={{ background: 'none', border: 'none', color: '#22d3ee', fontSize: '0.75rem', cursor: 'pointer', padding: 0, fontFamily: "'Inter', sans-serif" }}
                                    >
                                        ← Cambiar credenciales
                                    </button>
                                    <span style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                                        </svg>
                                        SSL 256-bit
                                    </span>
                                </div>
                            </form>
                        )}

                        {/* Login error */}
                        {loginErr && (
                            <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 500, color: 'rgba(248,113,113,0.9)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}>
                                ⚠️ {loginErr}
                            </div>
                        )}
                    </div>

                    <p style={{ textAlign: 'center', fontSize: '0.6875rem', color: 'rgba(255,255,255,0.2)', marginTop: '20px', lineHeight: 1.6 }}>
                        Este sistema está protegido. El acceso no autorizado está<br/>prohibido y puede tener consecuencias legales.
                    </p>
                </div>
            </main>
        </div>
    );
}
