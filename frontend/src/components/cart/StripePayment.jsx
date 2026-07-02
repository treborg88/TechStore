// components/cart/StripePayment.jsx - Custom card form with Stripe Elements
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Elements,
    CardNumberElement,
    CardExpiryElement,
    CardCvcElement,
    useStripe,
    useElements
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { apiFetch, apiUrl } from '../../services/apiClient';
import ProcessingOverlay from '../common/ProcessingOverlay';
import './StripePayment.css';

// ── Module-level stripe promise cache ──────────────────────────────────────────
let stripeCache = { key: null, promise: null, fetchedAt: 0 };
let stripePromise = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

const getStripePromise = async () => {
    const now = Date.now();
    if (stripeCache.promise && (now - stripeCache.fetchedAt) < CACHE_TTL_MS) {
        stripePromise = stripeCache.promise;
        return stripeCache.promise;
    }
    try {
        const res = await apiFetch(apiUrl('/payments/config'));
        if (res.ok) {
            const { publishableKey } = await res.json();
            if (publishableKey && (publishableKey !== stripeCache.key || !stripeCache.promise)) {
                const promise = loadStripe(publishableKey);
                stripeCache = { key: publishableKey, promise, fetchedAt: Date.now() };
                stripePromise = promise;
            }
            return stripeCache.promise;
        }
    } catch (error) {
        console.error('Error loading Stripe config:', error);
    }
    stripePromise = stripeCache.promise;
    return stripeCache.promise;
};

// ── Shared Stripe element base styles ──────────────────────────────────────────
const STRIPE_ELEMENT_STYLES = {
    base: {
        fontSize: '16px',
        fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
        color: '#1e293b',
        fontWeight: 500,
        letterSpacing: '0.3px',
        '::placeholder': { color: '#94a3b8', fontWeight: 400 },
        ':-webkit-autofill': { color: '#1e293b' },
    },
    complete: { color: '#059669' },
    empty: { color: '#1e293b' },
    invalid: { color: '#dc2626' },
};

// ── Card brand icon resolver ───────────────────────────────────────────────────
const CARD_BRANDS = {
    visa:       { src: 'https://js.stripe.com/v3/fingerprinted/img/visa-729c05c240c4bdb47b03ac81d9945bfe.svg', label: 'Visa' },
    mastercard: { src: 'https://js.stripe.com/v3/fingerprinted/img/mastercard-4d8844094130711885b5e41b28c9848f.svg', label: 'Mastercard' },
    amex:       { src: 'https://js.stripe.com/v3/fingerprinted/img/amex-a49b82f46c5cd6a96a6e418a6ca1717c.svg', label: 'Amex' },
    discover:   { src: 'https://js.stripe.com/v3/fingerprinted/img/discover-ac52cd46f89fa40a29a0bfb954e33173.svg', label: 'Discover' },
    jcb:        { src: 'https://js.stripe.com/v3/fingerprinted/img/jcb-271fd06e6e7a2c52692571f7f086eb6d.svg', label: 'JCB' },
    diners:     { src: 'https://js.stripe.com/v3/fingerprinted/img/diners-fbcbd3360f8e3f629cdaa80e93abdb8b.svg', label: 'Diners' },
    unionpay:   { src: 'https://js.stripe.com/v3/fingerprinted/img/unionpay-8a10aefc7571139ea942eceea8c5f0c3.svg', label: 'UnionPay' },
};

const BRAND_ORDER = ['visa', 'mastercard', 'amex', 'discover', 'jcb', 'diners', 'unionpay'];

const CardBrandIcon = ({ brand, className = 'card-brand-icon' }) => {
    const info = CARD_BRANDS[brand?.toLowerCase()];
    if (info) return <img src={info.src} alt={info.label} className={className} />;
    return (
        <svg viewBox="0 0 32 21" fill="none" className={className}>
            <rect x="0.5" y="0.5" width="31" height="20" rx="3.5" fill="#F6F9FC" stroke="#DFE3E8"/>
            <rect x="4" y="8" width="24" height="5" rx="1" fill="#A3ACB9"/>
        </svg>
    );
};

const AcceptedBrands = () => (
    <div className="accepted-brands">
        {BRAND_ORDER.map(b => {
            const info = CARD_BRANDS[b];
            return <img key={b} src={info.src} alt={info.label} className="accepted-brand-icon" title={info.label} />;
        })}
    </div>
);

// ── Stripe field wrapper (label + element + error) — memoized ──────────────────
const StripeField = React.memo(({ label, element: Element, options, error, required = true, onChange }) => {
    const [focused, setFocused] = useState(false);
    const [filled, setFilled] = useState(false);
    const hasError = !!error;

    // Stable callbacks — prevent Stripe Element iframe reconnections
    const handleFocus = useCallback(() => setFocused(true), []);
    const handleBlur = useCallback(() => setFocused(false), []);
    const handleChange = useCallback((e) => {
        setFilled(e.complete || (e.value && e.value.length > 0));
        if (onChange) onChange(e);
    }, [onChange]);

    const cls = [
        'custom-card-field',
        focused ? 'focused' : '',
        filled ? 'filled' : '',
        hasError ? 'has-error' : '',
    ].filter(Boolean).join(' ');

    return (
        <div className={cls}>
            <label className="card-field-label">{label}{required && <span className="required-mark">*</span>}</label>
            <div className="card-element-wrap">
                <Element
                    options={options}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onChange={handleChange}
                />
            </div>
            {hasError && <span className="card-field-error">{error}</span>}
        </div>
    );
});

// ── Saved cards manager ────────────────────────────────────────────────────────
const SavedCardsManager = ({ onCardsChange, onSelectCard }) => {
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState('');

    const fetchCards = useCallback(async () => {
        try {
            setLoading(true);
            const res = await apiFetch(apiUrl('/payments/saved-cards'));
            if (res.ok) {
                const data = await res.json();
                setCards(data.cards || []);
                if (onCardsChange) onCardsChange(data.cards || []);
            } else {
                setCards([]);
            }
        } catch (err) {
            console.error('Error fetching saved cards:', err);
            setCards([]);
        } finally {
            setLoading(false);
        }
    }, [onCardsChange]);

    useEffect(() => { fetchCards(); }, [fetchCards]);

    const handleDeleteCard = async (cardId) => {
        if (deletingId) return;
        setDeletingId(cardId);
        setError('');
        try {
            const res = await apiFetch(apiUrl(`/payments/saved-cards/${cardId}`), { method: 'DELETE' });
            if (res.ok) {
                const updated = cards.filter(c => c.id !== cardId);
                setCards(updated);
                if (onCardsChange) onCardsChange(updated);
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.message || 'Error al eliminar la tarjeta');
            }
        } catch (err) {
            console.error('Error deleting card:', err);
            setError('Error de conexión al eliminar la tarjeta');
        } finally {
            setDeletingId(null);
        }
    };

    if (loading || cards.length === 0) return null;

    return (
        <div className="saved-cards-section">
            <div className="saved-cards-header">
                <h5>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                        <line x1="1" y1="10" x2="23" y2="10"/>
                    </svg>
                    Tarjetas Guardadas
                </h5>
                <span className="saved-cards-count">{cards.length}</span>
            </div>

            {error && (
                <div className="saved-cards-error">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                    {error}
                </div>
            )}

            <div className="saved-cards-list">
                {cards.map(card => (
                    <div key={card.id} className={`saved-card-item ${deletingId === card.id ? 'deleting' : ''}`}>
                        <div className="saved-card-info">
                            <CardBrandIcon brand={card.brand} className="saved-card-brand-icon" />
                            <div className="saved-card-details">
                                <span className="saved-card-number">•••• •••• •••• {card.last4}</span>
                                <span className="saved-card-expiry">Expira {String(card.expMonth).padStart(2, '0')}/{card.expYear}</span>
                            </div>
                            {card.isDefault && <span className="default-badge">Predeterminada</span>}
                        </div>
                        <button type="button" className="delete-card-btn" onClick={() => handleDeleteCard(card.id)} disabled={deletingId === card.id} title="Eliminar tarjeta">
                            {deletingId === card.id ? <div className="mini-spinner"></div> : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                    <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
                                </svg>
                            )}
                        </button>
                    </div>
                ))}
            </div>
            <p className="saved-cards-hint">💡 Puedes eliminar tarjetas que ya no uses. Al pagar, puedes agregar nuevas tarjetas.</p>
        </div>
    );
};

// ── Security badges ────────────────────────────────────────────────────────────
const SecurityBadges = () => (
    <div className="security-badges">
        <div className="security-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span>Encriptación SSL</span>
        </div>
        <div className="security-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>
            </svg>
            <span>Pago Seguro</span>
        </div>
        <div className="security-item powered-by">
            <span>Powered by</span>
            <svg viewBox="0 0 60 25" className="stripe-logo">
                <path d="M5 10.4C5 9.56 5.68 9.08 6.84 9.08C8.56 9.08 10.72 9.68 12.44 10.68V5.72C10.56 4.96 8.72 4.64 6.84 4.64C2.72 4.64 0 6.76 0 10.64C0 16.56 8.28 15.64 8.28 18.2C8.28 19.2 7.44 19.64 6.2 19.64C4.32 19.64 1.92 18.84 0 17.68V22.72C2.12 23.64 4.28 24.04 6.2 24.04C10.44 24.04 13.32 22 13.32 18.08C13.28 11.68 5 12.76 5 10.4Z" fill="#635BFF"/>
                <path d="M21.36 1.04L16.4 2.08V6.08H13.04V10.32H16.4V18.32C16.4 22.04 18.36 24.08 22.52 24.08C23.88 24.08 25.16 23.8 25.92 23.48V19.28C25.28 19.52 24.56 19.64 23.68 19.64C22.2 19.64 21.36 19.04 21.36 17.4V10.32H25.92V6.08H21.36V1.04Z" fill="#635BFF"/>
                <path d="M33.24 4.64C31.64 4.64 30.56 5.4 29.92 6.4L29.72 4.92H24.92V23.76H30V11.28C30.64 10.36 31.68 9.92 33.24 9.92C33.56 9.92 33.92 9.96 34.28 10.04V4.76C33.92 4.68 33.56 4.64 33.24 4.64Z" fill="#635BFF"/>
                <path d="M40.16 4.64C35.92 4.64 32.68 8.28 32.68 14.4C32.68 20.52 35.88 24.08 40.32 24.08C42.6 24.08 44.4 23.2 45.64 21.68L45.84 23.76H50.72V4.92H45.64V6.88C44.44 5.48 42.6 4.64 40.16 4.64ZM41.52 19.64C39.28 19.64 37.8 17.72 37.8 14.4C37.8 11.08 39.28 9.08 41.52 9.08C43.76 9.08 45.24 11.08 45.24 14.4C45.24 17.72 43.72 19.64 41.52 19.64Z" fill="#635BFF"/>
                <path d="M54.08 23.76H59.16V4.92H54.08V23.76Z" fill="#635BFF"/>
            </svg>
        </div>
    </div>
);

// ── Checkout form — custom Stripe elements ─────────────────────────────────────
const CheckoutForm = ({
    onSuccess,
    onError,
    amount,
    currency = 'DOP',
    onProcessingStart,
    onProcessingComplete,
    onProcessingError
}) => {
    const stripe = useStripe();
    const elements = useElements();
    const cardholderRef = useRef(null);

    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState('');
    const [cardholderName, setCardholderName] = useState('');
    const [cardBrand, setCardBrand] = useState(null);
    const [errors, setErrors] = useState({});

    // Pre-merged stable options so Stripe Elements never see a new object reference.
    // This keeps their internal iframes alive instead of reconnecting on every keystroke.
    const cardNumberOptions = useMemo(() => ({
        placeholder: '1234 5678 9012 3456',
        style: STRIPE_ELEMENT_STYLES,
        disableLink: true,
    }), []);

    const expiryOptions = useMemo(() => ({
        placeholder: 'MM / AA',
        style: STRIPE_ELEMENT_STYLES,
    }), []);

    const cvcOptions = useMemo(() => ({
        placeholder: '123',
        style: STRIPE_ELEMENT_STYLES,
    }), []);

    // Stable callbacks — use functional updater so they never change reference.
    // This prevents Stripe Elements from detecting new props and reconnecting iframes.
    const handleCardNumberChange = useCallback((e) => {
        setCardBrand(e.brand || null);
        setErrors(prev => prev.card ? { ...prev, card: undefined } : prev);
    }, []);

    const handleExpiryChange = useCallback(() => {
        setErrors(prev => prev.expiry ? { ...prev, expiry: undefined } : prev);
    }, []);

    const handleCvcChange = useCallback(() => {
        setErrors(prev => prev.cvc ? { ...prev, cvc: undefined } : prev);
    }, []);

    // Validate fields before submit
    const validate = () => {
        const newErrors = {};
        if (!cardholderName.trim()) newErrors.name = 'Nombre del titular requerido';
        if (!stripe || !elements) newErrors._general = 'Stripe no está listo';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!stripe || !elements) return;
        if (!validate()) {
            // Focus the card number element if validation fails visually
            elements.getElement(CardNumberElement)?.focus();
            return;
        }

        setIsProcessing(true);
        setMessage('');
        if (onProcessingStart) onProcessingStart();

        try {
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    payment_method_data: {
                        billing_details: {
                            name: cardholderName.trim(),
                        },
                    },
                    return_url: window.location.origin + '/order-confirmation',
                },
                redirect: 'if_required',
            });

            if (error) {
                setMessage(error.message || 'Error al procesar el pago');
                // Map Stripe errors to specific fields
                if (error.code === 'incomplete_number' || error.code === 'invalid_number') {
                    setErrors(prev => ({ ...prev, card: error.message }));
                } else if (error.code === 'incomplete_expiry' || error.code === 'invalid_expiry') {
                    setErrors(prev => ({ ...prev, expiry: error.message }));
                } else if (error.code === 'incomplete_cvc' || error.code === 'invalid_cvc') {
                    setErrors(prev => ({ ...prev, cvc: error.message }));
                }
                if (onProcessingError) onProcessingError();
                if (onError) onError(error);
            } else if (paymentIntent && paymentIntent.status === 'succeeded') {
                if (onProcessingComplete) onProcessingComplete(paymentIntent);
            } else if (paymentIntent) {
                setMessage(`Estado del pago: ${paymentIntent.status}`);
            }
        } catch (err) {
            setMessage('Error inesperado al procesar el pago');
            if (onProcessingError) onProcessingError();
            if (onError) onError(err);
        }

        setIsProcessing(false);
    };

    return (
        <form onSubmit={handleSubmit} className="stripe-checkout-form" noValidate>
            {/* Header */}
            <div className="payment-header">
                <div className="payment-amount-display">
                    <span className="amount-label">Total a pagar</span>
                    <span className="amount-value">
                        {currency} {amount?.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </span>
                </div>
                <AcceptedBrands />
            </div>

            {/* Card preview */}
            <div className="card-preview">
                <div className="card-preview-inner">
                    <div className="card-preview-brand">
                        <CardBrandIcon brand={cardBrand} className="card-preview-brand-icon" />
                    </div>
                    <div className="card-preview-number">
                        {cardBrand === 'amex' ? '•••• •••••• •••••' : '•••• •••• •••• ••••'}
                    </div>
                    <div className="card-preview-bottom">
                        <div className="card-preview-holder">
                            <span className="card-preview-label">Titular</span>
                            <span className="card-preview-value">{cardholderName || 'Tu nombre'}</span>
                        </div>
                        <div className="card-preview-expiry">
                            <span className="card-preview-label">Vence</span>
                            <span className="card-preview-value">MM/AA</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Card fields */}
            <div className="card-fields-section">
                {/* Cardholder name */}
                <div className={`custom-card-field ${cardholderName ? 'filled' : ''}`}>
                    <label className="card-field-label">Nombre del titular <span className="required-mark">*</span></label>
                    <div className="card-element-wrap cardholder-input-wrap">
                        <input
                            ref={cardholderRef}
                            type="text"
                            value={cardholderName}
                            onChange={(e) => { setCardholderName(e.target.value); if (errors.name) setErrors(prev => ({ ...prev, name: undefined })); }}
                            placeholder="Nombre como aparece en la tarjeta"
                            className="cardholder-input"
                            autoComplete="cc-name"
                            disabled={isProcessing}
                        />
                    </div>
                    {errors.name && <span className="card-field-error">{errors.name}</span>}
                </div>

                {/* Card number */}
                <StripeField
                    label="Número de tarjeta"
                    element={CardNumberElement}
                    error={errors.card}
                    onChange={handleCardNumberChange}
                    options={cardNumberOptions}
                />

                {/* Expiry + CVC side by side */}
                <div className="card-fields-row">
                    <div style={{ flex: 1 }}>
                        <StripeField
                            label="Fecha de vencimiento"
                            element={CardExpiryElement}
                            error={errors.expiry}
                            onChange={handleExpiryChange}
                            options={expiryOptions}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <StripeField
                            label="CVC"
                            element={CardCvcElement}
                            error={errors.cvc}
                            onChange={handleCvcChange}
                            options={cvcOptions}
                        />
                    </div>
                </div>
            </div>

            {/* Status message */}
            {message && (
                <div className={`payment-status-message ${
                    message.includes('exitosamente') || message.includes('completado')
                        ? 'success'
                        : 'error'
                }`}>
                    {message.includes('exitosamente') || message.includes('completado') ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                    )}
                    <span>{message}</span>
                </div>
            )}

            {/* Submit button */}
            <button
                type="submit"
                disabled={!stripe || isProcessing || !cardholderName.trim()}
                className={`stripe-submit-btn ${isProcessing ? 'processing' : ''}`}
            >
                {isProcessing ? (
                    <>
                        <span className="btn-spinner"></span>
                        Procesando pago...
                    </>
                ) : (
                    <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                        Pagar {currency} {amount?.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </>
                )}
            </button>

            <SecurityBadges />
        </form>
    );
};

// ── Main StripePayment wrapper ─────────────────────────────────────────────────
const StripePayment = ({
    amount,
    currency = 'dop',
    orderId,
    customerEmail,
    onSuccess,
    onError,
    onCancel,
    parentProcessing = false,
}) => {
    const [clientSecret, setClientSecret] = useState('');
    const [stripeReady, setStripeReady] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [overlayState, setOverlayState] = useState('idle');

    // ── Stable refs for callback props to prevent effect re-runs ────────────────
    // Inline callbacks from parent (Checkout.jsx) change on every render.
    // Without refs, the initialization effect would re-run on every change,
    // creating a new PaymentIntent and reloading the form continuously.
    const onErrorRef = useRef(onError);
    const onSuccessRef = useRef(onSuccess);
    onErrorRef.current = onError;
    onSuccessRef.current = onSuccess;

    // ── All hooks before early returns ─────────────────────────────────────────
    useEffect(() => {
        const initialize = async () => {
            setLoading(true);
            setError('');
            try {
                const stripe = await getStripePromise();
                if (!stripe) {
                    setError('El servicio de pago no está disponible en este momento');
                    setLoading(false);
                    return;
                }
                setStripeReady(true);

                const res = await apiFetch(apiUrl('/payments/create-intent'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount, currency, orderId, customerEmail }),
                });

                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.message || 'Error al preparar el pago');
                }

                const { clientSecret: secret } = await res.json();
                setClientSecret(secret);
            } catch (err) {
                console.error('Error initializing payment:', err);
                setError(err.message || 'No se pudo inicializar el formulario de pago');
                if (onErrorRef.current) onErrorRef.current(err);
            }
            setLoading(false);
        };
        if (amount > 0) initialize();
        // Intentionally omit onError/onSuccess — they change reference on every
        // parent render and would cause an infinite reload loop. Refs keep them
        // accessible without triggering re-initialization.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [amount, currency, orderId, customerEmail]);

    const handleProcessingStart = useCallback(() => setOverlayState('processing'), []);
    const handleProcessingError = useCallback(() => setOverlayState('idle'), []);
    const handleProcessingComplete = useCallback((paymentIntent) => {
        setOverlayState('success');
        if (onSuccessRef.current) onSuccessRef.current(paymentIntent);
    }, []);

    const overlayVisible = overlayState !== 'idle' || parentProcessing;
    const overlayStatus = (overlayState === 'success' && !parentProcessing) ? 'success' : 'running';
    const overlayTitle = overlayState === 'processing'
        ? 'Procesando pago...'
        : overlayState === 'success' && parentProcessing
            ? 'Creando tu orden...'
            : overlayState === 'success'
                ? '¡Pago completado!'
                : 'Procesando...';
    const overlaySubtitle = overlayState === 'processing'
        ? 'Estamos confirmando tu pago con Stripe. No cierres esta ventana.'
        : overlayState === 'success' && parentProcessing
            ? 'Finalizando los detalles de tu orden.'
            : overlayState === 'success'
                ? 'Todo listo. Redirigiendo...'
                : 'No cierres esta ventana, estamos procesando tu pago.';

    // ── Early returns (hooks already executed) ─────────────────────────────────
    if (loading) {
        return (
            <>
                <ProcessingOverlay visible={overlayVisible} status={overlayStatus} title={overlayTitle} subtitle={overlaySubtitle} />
                <div className="stripe-payment-wrapper">
                    <div className="stripe-loading-state">
                        <div className="loading-animation">
                            <div className="loading-card"><div className="card-shine"></div></div>
                        </div>
                        <h4>Preparando el formulario de pago</h4>
                        <p>Esto solo tomará un momento...</p>
                    </div>
                </div>
            </>
        );
    }

    if (error) {
        return (
            <>
                <ProcessingOverlay visible={overlayVisible} status={overlayStatus} title={overlayTitle} subtitle={overlaySubtitle} />
                <div className="stripe-payment-wrapper">
                    <div className="stripe-error-state">
                        <div className="error-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                        </div>
                        <h4>No se pudo cargar el formulario de pago</h4>
                        <p>{error}</p>
                        <div className="error-actions">
                            <button onClick={() => window.location.reload()} className="retry-btn">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                                </svg>
                                Reintentar
                            </button>
                            {onCancel && <button onClick={onCancel} className="back-btn">Usar otro método de pago</button>}
                        </div>
                    </div>
                </div>
            </>
        );
    }

    if (!stripeReady || !clientSecret) {
        return (
            <>
                <ProcessingOverlay visible={overlayVisible} status={overlayStatus} title={overlayTitle} subtitle={overlaySubtitle} />
                <div className="stripe-payment-wrapper">
                    <div className="stripe-error-state">
                        <div className="error-icon warning">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                        </div>
                        <h4>Servicio temporalmente no disponible</h4>
                        <p>El procesador de pagos no está disponible. Por favor, intenta otro método de pago.</p>
                        {onCancel && <button onClick={onCancel} className="back-btn">← Elegir otro método de pago</button>}
                    </div>
                </div>
            </>
        );
    }

    const elementsOptions = useMemo(() => ({ clientSecret }), [clientSecret]);

    return (
        <div className="stripe-payment-wrapper">
            <ProcessingOverlay visible={overlayVisible} status={overlayStatus} title={overlayTitle} subtitle={overlaySubtitle} />
            <SavedCardsManager />
            <Elements stripe={stripePromise} options={elementsOptions}>
                <CheckoutForm
                    onSuccess={handleProcessingComplete}
                    onError={onError}
                    amount={amount}
                    currency={currency.toUpperCase()}
                    onProcessingStart={handleProcessingStart}
                    onProcessingComplete={handleProcessingComplete}
                    onProcessingError={handleProcessingError}
                />
            </Elements>

            {onCancel && (
                <button onClick={onCancel} className="change-payment-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
                    </svg>
                    Cambiar método de pago
                </button>
            )}
        </div>
    );
};

export default StripePayment;
