// components/cart/PayPalPayment.jsx - PayPal payment form component
import React, { useState, useEffect } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { apiFetch, apiUrl } from '../../services/apiClient';
import './StripePayment.css'; // Reuse Stripe styles for consistency

/**
 * PayPal Payment Component
 * Handles PayPal checkout flow with consistent styling
 */
const PayPalPayment = ({ 
    amount, 
    currency = 'USD', 
    orderId, 
    customerEmail,
    onSuccess, 
    onError, 
    onCancel 
}) => {
    const [clientId, setClientId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [processing, setProcessing] = useState(false);

    // Load PayPal client ID from backend
    useEffect(() => {
        const loadConfig = async () => {
            try {
                const res = await apiFetch(apiUrl('/payments/paypal/config'));
                if (res.ok) {
                    const data = await res.json();
                    setClientId(data.clientId);
                } else {
                    const errorData = await res.json();
                    setError(errorData.message || 'PayPal no está configurado');
                }
            } catch (err) {
                console.error('Error loading PayPal config:', err);
                setError('Error al cargar la configuración de PayPal');
            } finally {
                setLoading(false);
            }
        };
        loadConfig();
    }, []);

    // Create order handler for PayPal
    const createOrder = async () => {
        try {
            const res = await apiFetch(apiUrl('/payments/paypal/create-order'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    currency,
                    orderId,
                    description: `Orden #${orderId}`
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || 'Error al crear orden de PayPal');
            }

            const data = await res.json();
            return data.orderId;
        } catch (err) {
            console.error('Error creating PayPal order:', err);
            setError(err.message);
            throw err;
        }
    };

    // Capture order handler after approval
    const onApprove = async (data) => {
        setProcessing(true);
        setError('');

        try {
            const res = await apiFetch(apiUrl('/payments/paypal/capture-order'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paypalOrderId: data.orderID,
                    orderId
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || 'Error al procesar el pago');
            }

            const captureData = await res.json();

            if (captureData.success) {
                if (onSuccess) {
                    onSuccess({
                        id: data.orderID,
                        captureId: captureData.captureId,
                        status: captureData.status
                    });
                }
            } else {
                throw new Error(captureData.message || 'El pago no fue completado');
            }
        } catch (err) {
            console.error('Error capturing PayPal payment:', err);
            setError(err.message);
            if (onError) onError(err);
        } finally {
            setProcessing(false);
        }
    };

    // Handle PayPal errors
    const handleError = (err) => {
        console.error('PayPal error:', err);
        setError('Error en el proceso de pago con PayPal');
        if (onError) onError(err);
    };

    // Handle cancel
    const handleCancel = () => {
        setError('');
        if (onCancel) onCancel();
    };

    // Loading state
    if (loading) {
        return (
            <div className="stripe-payment-wrapper paypal-payment-wrapper">
                <div className="stripe-checkout-form">
                    <div className="payment-loading">
                        <div className="payment-spinner"></div>
                        <p>Cargando PayPal...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Error state - no config
    if (!clientId) {
        return (
            <div className="stripe-payment-wrapper paypal-payment-wrapper">
                <div className="stripe-checkout-form">
                    <div className="payment-error-state">
                        <div className="error-icon">⚠️</div>
                        <h4>PayPal no disponible</h4>
                        <p>{error || 'PayPal no está configurado en este momento.'}</p>
                        <button 
                            className="btn-back-payment"
                            onClick={onCancel}
                        >
                            Elegir otro método
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="stripe-payment-wrapper paypal-payment-wrapper">
            <div className="stripe-checkout-form">
                {/* Header with amount */}
                <div className="payment-header">
                    <div className="payment-amount-display">
                        <span className="amount-label">Total a pagar</span>
                        <span className="amount-value">
                            {currency} {amount?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                    <div className="card-brands paypal-brand">
                        <img 
                            src="https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_37x23.jpg" 
                            alt="PayPal" 
                            className="card-icon paypal-logo"
                        />
                    </div>
                </div>

                {/* PayPal buttons section */}
                <div className="payment-form-section">
                    <div className="section-header">
                        <div className="section-icon paypal-icon">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.77.77 0 0 1 .76-.655h7.922c2.593 0 4.41.627 5.407 1.867.947 1.18 1.152 2.76.611 4.698-.062.221-.132.442-.21.66-.076.218-.16.433-.254.647-.095.215-.198.427-.31.637-.113.21-.235.418-.365.622-.13.204-.27.405-.418.602-.147.197-.304.39-.47.579-.165.19-.34.376-.525.558-.184.182-.378.36-.581.534a7.03 7.03 0 0 1-.643.491c-.224.156-.456.307-.697.451-.24.144-.49.282-.746.412-.257.13-.522.253-.794.369-.273.115-.553.223-.84.323a15.86 15.86 0 0 1-.882.283c-.3.087-.605.167-.916.239a18.61 18.61 0 0 1-.936.19 21.08 21.08 0 0 1-.943.137 24.16 24.16 0 0 1-.936.082c-.308.02-.615.033-.92.04-.305.006-.609.01-.91.01H6.394l-.318 2.078z"/>
                            </svg>
                        </div>
                        <div className="section-title">
                            <h4>Pagar con PayPal</h4>
                            <p>Serás redirigido a PayPal para completar tu pago de forma segura</p>
                        </div>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="payment-error">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="8" x2="12" y2="12"/>
                                <line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Processing overlay */}
                    {processing && (
                        <div className="payment-processing-overlay">
                            <div className="payment-spinner"></div>
                            <p>Procesando tu pago...</p>
                        </div>
                    )}

                    {/* PayPal Buttons */}
                    <div className="paypal-buttons-container">
                        <PayPalScriptProvider options={{ 
                            "client-id": clientId,
                            currency: currency,
                            intent: "capture"
                        }}>
                            <PayPalButtons
                                style={{
                                    layout: 'vertical',
                                    color: 'blue',
                                    shape: 'rect',
                                    label: 'paypal',
                                    height: 45
                                }}
                                createOrder={createOrder}
                                onApprove={onApprove}
                                onError={handleError}
                                onCancel={handleCancel}
                                disabled={processing}
                            />
                        </PayPalScriptProvider>
                    </div>

                    {/* Cancel button */}
                    <button 
                        type="button" 
                        className="btn-cancel-payment"
                        onClick={onCancel}
                        disabled={processing}
                    >
                        Cancelar y elegir otro método
                    </button>
                </div>

                {/* Security badges */}
                <div className="payment-security-footer">
                    <div className="security-badges">
                        <div className="security-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            <span>Pago Seguro</span>
                        </div>
                        <div className="security-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                            <span>Protección al Comprador</span>
                        </div>
                    </div>
                    <p className="security-text">
                        Tu pago está protegido por la Garantía de PayPal
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PayPalPayment;
