// components/cart/StripePayment.jsx - Stripe payment form component (redesigned for better UX)
import React, { useState, useEffect, useCallback } from 'react';
import {
    Elements,
    PaymentElement,
    useStripe,
    useElements
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { apiFetch, apiUrl } from '../../services/apiClient';
import './StripePayment.css';

// Stripe promise - will be initialized with publishable key
let stripePromise = null;

/**
 * Initialize Stripe with publishable key from backend
 */
const getStripePromise = async () => {
    if (stripePromise) return stripePromise;
    
    try {
        const res = await apiFetch(apiUrl('/payments/config'));
        if (res.ok) {
            const { publishableKey } = await res.json();
            if (publishableKey) {
                stripePromise = loadStripe(publishableKey);
                return stripePromise;
            }
        }
    } catch (error) {
        console.error('Error loading Stripe config:', error);
    }
    return null;
};

/**
 * Get card brand icon - Using Stripe's official icons
 */
const getCardBrandIcon = (brand) => {
    const icons = {
        visa: (
            <img 
                src="https://js.stripe.com/v3/fingerprinted/img/visa-729c05c240c4bdb47b03ac81d9945bfe.svg" 
                alt="Visa" 
                className="saved-card-brand-icon"
            />
        ),
        mastercard: (
            <img 
                src="https://js.stripe.com/v3/fingerprinted/img/mastercard-4d8844094130711885b5e41b28c9848f.svg" 
                alt="Mastercard" 
                className="saved-card-brand-icon"
            />
        ),
        amex: (
            <img 
                src="https://js.stripe.com/v3/fingerprinted/img/amex-a49b82f46c5cd6a96a6e418a6ca1717c.svg" 
                alt="American Express" 
                className="saved-card-brand-icon"
            />
        ),
        discover: (
            <img 
                src="https://js.stripe.com/v3/fingerprinted/img/discover-ac52cd46f89fa40a29a0bfb954e33173.svg" 
                alt="Discover" 
                className="saved-card-brand-icon"
            />
        ),
        jcb: (
            <img 
                src="https://js.stripe.com/v3/fingerprinted/img/jcb-271fd06e6e7a2c52692571f7f086eb6d.svg" 
                alt="JCB" 
                className="saved-card-brand-icon"
            />
        ),
        diners: (
            <img 
                src="https://js.stripe.com/v3/fingerprinted/img/diners-fbcbd3360f8e3f629cdaa80e93abdb8b.svg" 
                alt="Diners Club" 
                className="saved-card-brand-icon"
            />
        ),
        unionpay: (
            <img 
                src="https://js.stripe.com/v3/fingerprinted/img/unionpay-8a10aefc7571139ea942eceea8c5f0c3.svg" 
                alt="UnionPay" 
                className="saved-card-brand-icon"
            />
        )
    };
    
    // Default card icon for unknown brands
    return icons[brand?.toLowerCase()] || (
        <svg viewBox="0 0 32 21" fill="none" xmlns="http://www.w3.org/2000/svg" className="saved-card-brand-icon">
            <rect x="0.5" y="0.5" width="31" height="20" rx="3.5" fill="#F6F9FC" stroke="#DFE3E8"/>
            <rect x="4" y="8" width="24" height="5" rx="1" fill="#A3ACB9"/>
        </svg>
    );
};

/**
 * Saved Cards Management Component
 */
const SavedCardsManager = ({ onCardsChange }) => {
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState('');

    // Fetch saved cards
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

    useEffect(() => {
        fetchCards();
    }, [fetchCards]);

    // Delete a saved card
    const handleDeleteCard = async (cardId) => {
        if (deletingId) return; // Prevent multiple deletes
        
        setDeletingId(cardId);
        setError('');

        try {
            const res = await apiFetch(apiUrl(`/payments/saved-cards/${cardId}`), {
                method: 'DELETE'
            });

            if (res.ok) {
                const updatedCards = cards.filter(c => c.id !== cardId);
                setCards(updatedCards);
                if (onCardsChange) onCardsChange(updatedCards);
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

    // Don't show loading spinner - just return null while loading
    if (loading) {
        return null;
    }

    if (cards.length === 0) {
        return null; // Don't show anything if no saved cards
    }

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
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                    {error}
                </div>
            )}

            <div className="saved-cards-list">
                {cards.map(card => (
                    <div key={card.id} className={`saved-card-item ${deletingId === card.id ? 'deleting' : ''}`}>
                        <div className="saved-card-info">
                            {getCardBrandIcon(card.brand)}
                            <div className="saved-card-details">
                                <span className="saved-card-number">
                                    •••• •••• •••• {card.last4}
                                </span>
                                <span className="saved-card-expiry">
                                    Expira {String(card.expMonth).padStart(2, '0')}/{card.expYear}
                                </span>
                            </div>
                            {card.isDefault && (
                                <span className="default-badge">Predeterminada</span>
                            )}
                        </div>
                        <button
                            type="button"
                            className="delete-card-btn"
                            onClick={() => handleDeleteCard(card.id)}
                            disabled={deletingId === card.id}
                            title="Eliminar tarjeta"
                        >
                            {deletingId === card.id ? (
                                <div className="mini-spinner"></div>
                            ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                    <line x1="10" y1="11" x2="10" y2="17"/>
                                    <line x1="14" y1="11" x2="14" y2="17"/>
                                </svg>
                            )}
                        </button>
                    </div>
                ))}
            </div>

            <p className="saved-cards-hint">
                💡 Puedes eliminar tarjetas que ya no uses. Al pagar, puedes agregar nuevas tarjetas.
            </p>
        </div>
    );
};

/**
 * Card brand icons component - Using Stripe's official icons
 */
const CardBrands = () => (
    <div className="card-brands">
        <img 
            src="https://js.stripe.com/v3/fingerprinted/img/visa-729c05c240c4bdb47b03ac81d9945bfe.svg" 
            alt="Visa" 
            className="card-icon"
        />
        <img 
            src="https://js.stripe.com/v3/fingerprinted/img/mastercard-4d8844094130711885b5e41b28c9848f.svg" 
            alt="Mastercard" 
            className="card-icon"
        />
        <img 
            src="https://js.stripe.com/v3/fingerprinted/img/amex-a49b82f46c5cd6a96a6e418a6ca1717c.svg" 
            alt="American Express" 
            className="card-icon"
        />
    </div>
);

/**
 * Security badges component
 */
const SecurityBadges = () => (
    <div className="security-badges">
        <div className="security-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span>Encriptación SSL</span>
        </div>
        <div className="security-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4"/>
            </svg>
            <span>Pago Seguro</span>
        </div>
        <div className="security-item powered-by">
            <span>Powered by</span>
            <svg viewBox="0 0 60 25" fill="none" xmlns="http://www.w3.org/2000/svg" className="stripe-logo">
                <path d="M5 10.4C5 9.56 5.68 9.08 6.84 9.08C8.56 9.08 10.72 9.68 12.44 10.68V5.72C10.56 4.96 8.72 4.64 6.84 4.64C2.72 4.64 0 6.76 0 10.64C0 16.56 8.28 15.64 8.28 18.2C8.28 19.2 7.44 19.64 6.2 19.64C4.32 19.64 1.92 18.84 0 17.68V22.72C2.12 23.64 4.28 24.04 6.2 24.04C10.44 24.04 13.32 22 13.32 18.08C13.28 11.68 5 12.76 5 10.4Z" fill="#635BFF"/>
                <path d="M21.36 1.04L16.4 2.08V6.08H13.04V10.32H16.4V18.32C16.4 22.04 18.36 24.08 22.52 24.08C23.88 24.08 25.16 23.8 25.92 23.48V19.28C25.28 19.52 24.56 19.64 23.68 19.64C22.2 19.64 21.36 19.04 21.36 17.4V10.32H25.92V6.08H21.36V1.04Z" fill="#635BFF"/>
                <path d="M33.24 4.64C31.64 4.64 30.56 5.4 29.92 6.4L29.72 4.92H24.92V23.76H30V11.28C30.64 10.36 31.68 9.92 33.24 9.92C33.56 9.92 33.92 9.96 34.28 10.04V4.76C33.92 4.68 33.56 4.64 33.24 4.64Z" fill="#635BFF"/>
                <path d="M40.16 4.64C35.92 4.64 32.68 8.28 32.68 14.4C32.68 20.52 35.88 24.08 40.32 24.08C42.6 24.08 44.4 23.2 45.64 21.68L45.84 23.76H50.72V4.92H45.64V6.88C44.44 5.48 42.6 4.64 40.16 4.64ZM41.52 19.64C39.28 19.64 37.8 17.72 37.8 14.4C37.8 11.08 39.28 9.08 41.52 9.08C43.76 9.08 45.24 11.08 45.24 14.4C45.24 17.72 43.72 19.64 41.52 19.64Z" fill="#635BFF"/>
                <path d="M54.08 23.76H59.16V4.92H54.08V23.76Z" fill="#635BFF"/>
            </svg>
        </div>
    </div>
);

/**
 * Stripe checkout form component
 */
const CheckoutForm = ({ onSuccess, onError, amount, currency = 'DOP' }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState('');
    const [paymentStep, setPaymentStep] = useState(1);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setIsProcessing(true);
        setMessage('');
        setPaymentStep(2);

        try {
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: window.location.origin + '/order-confirmation',
                },
                redirect: 'if_required'
            });

            if (error) {
                setPaymentStep(1);
                setMessage(error.message || 'Error al procesar el pago');
                if (onError) onError(error);
            } else if (paymentIntent && paymentIntent.status === 'succeeded') {
                setPaymentStep(3);
                setMessage('¡Pago completado exitosamente!');
                // Small delay to show success state before callback
                setTimeout(() => {
                    if (onSuccess) onSuccess(paymentIntent);
                }, 1500);
            } else if (paymentIntent) {
                setMessage(`Estado del pago: ${paymentIntent.status}`);
            }
        } catch (err) {
            setPaymentStep(1);
            setMessage('Error inesperado al procesar el pago');
            if (onError) onError(err);
        }

        setIsProcessing(false);
    };

    return (
        <form onSubmit={handleSubmit} className="stripe-checkout-form">
            {/* Header with amount and accepted cards */}
            <div className="payment-header">
                <div className="payment-amount-display">
                    <span className="amount-label">Total a pagar</span>
                    <span className="amount-value">
                        {currency} {amount?.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </span>
                </div>
                <CardBrands />
            </div>

            {/* Payment form section */}
            <div className="payment-form-section">
                <div className="section-header">
                    <div className="section-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                            <line x1="1" y1="10" x2="23" y2="10"/>
                        </svg>
                    </div>
                    <div className="section-title">
                        <h4>Método de Pago</h4>
                        <p>Ingresa los datos de tu tarjeta</p>
                    </div>
                </div>

                {/* Stripe PaymentElement with accordion layout for better UX */}
                <div className="stripe-element-wrapper">
                    <PaymentElement 
                        options={{
                            layout: {
                                type: 'accordion',
                                defaultCollapsed: false,
                                radios: true,
                                spacedAccordionItems: true
                            },
                            paymentMethodOrder: ['card', 'apple_pay', 'google_pay'],
                            wallets: {
                                applePay: 'auto',
                                googlePay: 'auto'
                            }
                        }}
                    />
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
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                            <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="15" y1="9" x2="9" y2="15"/>
                            <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                    )}
                    <span>{message}</span>
                </div>
            )}
            
            {/* Submit button */}
            <button 
                type="submit" 
                disabled={!stripe || isProcessing || paymentStep === 3}
                className={`stripe-submit-btn ${isProcessing ? 'processing' : ''} ${paymentStep === 3 ? 'success' : ''}`}
            >
                {paymentStep === 3 ? (
                    <>
                        <svg className="success-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Pago Completado
                    </>
                ) : isProcessing ? (
                    <>
                        <span className="btn-spinner"></span>
                        Procesando pago...
                    </>
                ) : (
                    <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                        Pagar {currency} {amount?.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    </>
                )}
            </button>

            {/* Security info */}
            <SecurityBadges />
        </form>
    );
};

/**
 * Main Stripe Payment wrapper component
 */
const StripePayment = ({ 
    amount, 
    currency = 'dop',
    orderId,
    customerEmail,
    onSuccess, 
    onError,
    onCancel 
}) => {
    const [clientSecret, setClientSecret] = useState('');
    const [stripeReady, setStripeReady] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const initializePayment = async () => {
            setLoading(true);
            setError('');

            try {
                // Load Stripe
                const stripe = await getStripePromise();
                if (!stripe) {
                    setError('El servicio de pago no está disponible en este momento');
                    setLoading(false);
                    return;
                }
                setStripeReady(true);

                // Create PaymentIntent
                const res = await apiFetch(apiUrl('/payments/create-intent'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount,
                        currency,
                        orderId,
                        customerEmail
                    })
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
                if (onError) onError(err);
            }

            setLoading(false);
        };

        if (amount > 0) {
            initializePayment();
        }
    }, [amount, currency, orderId, customerEmail, onError]);

    // Loading state
    if (loading) {
        return (
            <div className="stripe-payment-wrapper">
                <div className="stripe-loading-state">
                    <div className="loading-animation">
                        <div className="loading-card">
                            <div className="card-shine"></div>
                        </div>
                    </div>
                    <h4>Preparando el formulario de pago</h4>
                    <p>Esto solo tomará un momento...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="stripe-payment-wrapper">
                <div className="stripe-error-state">
                    <div className="error-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                    </div>
                    <h4>No se pudo cargar el formulario de pago</h4>
                    <p>{error}</p>
                    <div className="error-actions">
                        <button onClick={() => window.location.reload()} className="retry-btn">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="23 4 23 10 17 10"/>
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                            </svg>
                            Reintentar
                        </button>
                        {onCancel && (
                            <button onClick={onCancel} className="back-btn">
                                Usar otro método de pago
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Not ready state
    if (!stripeReady || !clientSecret) {
        return (
            <div className="stripe-payment-wrapper">
                <div className="stripe-error-state">
                    <div className="error-icon warning">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/>
                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                    </div>
                    <h4>Servicio temporalmente no disponible</h4>
                    <p>El procesador de pagos no está disponible. Por favor, intenta otro método de pago.</p>
                    {onCancel && (
                        <button onClick={onCancel} className="back-btn">
                            ← Elegir otro método de pago
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Stripe appearance customization (only supported properties)
    const appearance = {
        theme: 'stripe',
        variables: {
            colorPrimary: '#2563eb',
            colorBackground: '#ffffff',
            colorText: '#1f2937',
            colorDanger: '#dc2626',
            colorSuccess: '#059669',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSizeBase: '15px',
            borderRadius: '10px',
            spacingUnit: '4px',
            spacingGridRow: '16px'
        },
        rules: {
            '.Label': {
                fontWeight: '500',
                color: '#374151'
            },
            '.Input': {
                padding: '12px 14px',
                border: '1.5px solid #d1d5db',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
            },
            '.Input:focus': {
                border: '1.5px solid #2563eb',
                boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)'
            },
            '.Input--invalid': {
                border: '1.5px solid #dc2626',
                boxShadow: '0 0 0 3px rgba(220, 38, 38, 0.1)'
            },
            '.Tab': {
                border: '1.5px solid #e5e7eb',
                borderRadius: '10px',
                padding: '12px 16px'
            },
            '.Tab--selected': {
                border: '1.5px solid #2563eb',
                backgroundColor: '#eff6ff'
            },
            '.Tab:hover': {
                border: '1.5px solid #93c5fd'
            },
            '.AccordionItem': {
                border: '1.5px solid #e5e7eb',
                borderRadius: '12px'
            },
            '.AccordionItem--selected': {
                border: '1.5px solid #2563eb',
                boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.08)'
            }
        }
    };

    const options = {
        clientSecret,
        appearance,
    };

    return (
        <div className="stripe-payment-wrapper">
            {/* Saved Cards Management Section */}
            <SavedCardsManager />
            
            {/* Key forces remount when clientSecret changes to avoid mutable prop warning */}
            <Elements key={clientSecret} stripe={stripePromise} options={options}>
                <CheckoutForm 
                    onSuccess={onSuccess}
                    onError={onError}
                    amount={amount}
                    currency={currency.toUpperCase()}
                />
            </Elements>
            
            {onCancel && (
                <button onClick={onCancel} className="change-payment-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="19" y1="12" x2="5" y2="12"/>
                        <polyline points="12 19 5 12 12 5"/>
                    </svg>
                    Cambiar método de pago
                </button>
            )}
        </div>
    );
};

export default StripePayment;
