import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL, BASE_URL } from '../../config';
import { apiFetch, apiUrl } from '../../services/apiClient';
import { getCurrentUser } from '../../services/authService';
import Invoice from '../common/Invoice';
import { buildInvoiceData, generateInvoicePdfBlob } from '../../utils/invoiceUtils';
import EmailVerification from '../auth/EmailVerification';
import LoginPage from '../auth/LoginPage';
import DeliveryMap from './DeliveryMap';
import StripePayment from './StripePayment';
import PayPalPayment from './PayPalPayment';
import '../products/ProductDetail.css';
import './Checkout.css';
import { formatCurrency } from '../../utils/formatCurrency';

function Checkout({ cartItems: propCartItems, total: propTotal, onSubmit, onClose, onClearCart, onOrderComplete, siteName, siteIcon, onLoginSuccess, currencyCode }) {
    const navigate = useNavigate();
    
    // Use internal cart items state that can be recovered from pending payment
    const [internalCartItems, setInternalCartItems] = useState(() => {
        // First try to use prop items
        if (propCartItems && propCartItems.length > 0) {
            return propCartItems;
        }
        // Fallback: recover from pending payment state
        try {
            const savedStripe = localStorage.getItem('pending_stripe_payment');
            if (savedStripe) {
                const parsed = JSON.parse(savedStripe);
                if (parsed.cartItems && parsed.cartItems.length > 0) {
                    return parsed.cartItems;
                }
            }
            const savedPayPal = localStorage.getItem('pending_paypal_payment');
            if (savedPayPal) {
                const parsed = JSON.parse(savedPayPal);
                if (parsed.cartItems && parsed.cartItems.length > 0) {
                    return parsed.cartItems;
                }
            }
        } catch (e) {
            console.error('Error recovering cart items from pending payment:', e);
        }
        return [];
    });
    
    // Effective cart items: use props if available, otherwise internal state
    const cartItems = (propCartItems && propCartItems.length > 0) ? propCartItems : internalCartItems;
    
    // Calculate total from effective cart items
    const total = (propCartItems && propCartItems.length > 0) 
        ? propTotal 
        : internalCartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const [formData, setFormData] = useState({
firstName: '',
lastName: '',
email: '',
address: '',
sector: '',
city: '',
phone: '',
notes: '',
paymentMethod: ''
});

const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [mapData, setMapData] = useState({
        selectedLocation: null,
        distance: null,
        shippingCost: 0
    });
    const [error, setError] = useState('');
    const [orderCreated, setOrderCreated] = useState(null);
    const [confirmedItems, setConfirmedItems] = useState([]);
    const [isEmailVerified, setIsEmailVerified] = useState(false);
    const [showVerification, setShowVerification] = useState(false);
    const [_emailExists, setEmailExists] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [friendlyLoginMessage, setFriendlyLoginMessage] = useState('');
    // Initialize pending payment states from localStorage to survive page reloads
    const [showStripePayment, setShowStripePayment] = useState(() => {
        try {
            const saved = localStorage.getItem('pending_stripe_payment');
            return saved ? JSON.parse(saved).showPayment : false;
        } catch { return false; }
    });
    const [pendingStripeOrder, setPendingStripeOrder] = useState(() => {
        try {
            const saved = localStorage.getItem('pending_stripe_payment');
            if (!saved) return null;
            const parsed = JSON.parse(saved);
            // Use pendingData (new format) or order (legacy format)
            return parsed.pendingData || parsed.order || null;
        } catch { return null; }
    });
    const [showPayPalPayment, setShowPayPalPayment] = useState(() => {
        try {
            const saved = localStorage.getItem('pending_paypal_payment');
            return saved ? JSON.parse(saved).showPayment : false;
        } catch { return false; }
    });
    const [pendingPayPalOrder, setPendingPayPalOrder] = useState(() => {
        try {
            const saved = localStorage.getItem('pending_paypal_payment');
            if (!saved) return null;
            const parsed = JSON.parse(saved);
            // Use pendingData (new format) or order (legacy format)
            return parsed.pendingData || parsed.order || null;
        } catch { return null; }
    });
    
    // Payment methods configuration from settings
    const [paymentMethods, setPaymentMethods] = useState({
        cash: { enabled: true, name: 'Pago Contra Entrega', description: 'Paga en efectivo cuando recibas tu pedido', icon: '💵' },
        transfer: { enabled: true, name: 'Transferencia Bancaria', description: 'Transferencia o depósito bancario', icon: '🏦', bankName: '', bankHolder: '', bankAccount: '', transferNote: '' },
        stripe: { enabled: true, name: 'Tarjeta de Crédito/Débito', description: 'Visa, MasterCard, American Express', icon: '💳' },
        paypal: { enabled: false, name: 'PayPal', description: 'Paga con tu cuenta PayPal', icon: '🅿️' }
    });

    // Restore pending payment state on mount (recovers from page reload during payment)
    useEffect(() => {
        // Restore Stripe pending payment
        const savedStripe = localStorage.getItem('pending_stripe_payment');
        if (savedStripe) {
            try {
                const parsed = JSON.parse(savedStripe);
                if (parsed.formData) setFormData(parsed.formData);
                if (parsed.mapData) setMapData(parsed.mapData);
                if (parsed.cartItems && parsed.cartItems.length > 0) {
                    setInternalCartItems(parsed.cartItems);
                }
                // Set step to payment step
                setStep(4);
            } catch (e) {
                console.error('Error restoring Stripe payment state:', e);
            }
        }
        // Restore PayPal pending payment
        const savedPayPal = localStorage.getItem('pending_paypal_payment');
        if (savedPayPal) {
            try {
                const parsed = JSON.parse(savedPayPal);
                if (parsed.formData) setFormData(parsed.formData);
                if (parsed.mapData) setMapData(parsed.mapData);
                if (parsed.cartItems && parsed.cartItems.length > 0) {
                    setInternalCartItems(parsed.cartItems);
                }
                // Set step to payment step
                setStep(4);
            } catch (e) {
                console.error('Error restoring PayPal payment state:', e);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only on mount

    // Validate cart has items - redirect if empty and no order/pending payment exists
    useEffect(() => {
        // Don't redirect if order is created or there's a pending payment in progress
        const hasPendingPayment = pendingStripeOrder || pendingPayPalOrder;
        if (!orderCreated && !hasPendingPayment && (!cartItems || cartItems.length === 0)) {
            setError('Tu carrito está vacío. Agrega productos antes de continuar.');
            // Redirect to cart after a brief delay to show message
            const timer = setTimeout(() => {
                navigate('/cart');
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [cartItems, orderCreated, pendingStripeOrder, pendingPayPalOrder, navigate]);

    // Load payment methods configuration on mount
    useEffect(() => {
        const loadPaymentMethods = async () => {
            try {
                const res = await apiFetch(apiUrl('/settings/public'));
                if (res.ok) {
                    const data = await res.json();
                    if (data.paymentMethodsConfig) {
                        const config = typeof data.paymentMethodsConfig === 'string' 
                            ? JSON.parse(data.paymentMethodsConfig) 
                            : data.paymentMethodsConfig;
                        
                        const updatedMethods = {
                            cash: { ...paymentMethods.cash, ...(config.cash || {}) },
                            transfer: { ...paymentMethods.transfer, ...(config.transfer || {}) },
                            stripe: { ...paymentMethods.stripe, ...(config.stripe || {}) },
                            paypal: { ...paymentMethods.paypal, ...(config.paypal || {}) }
                        };
                        
                        setPaymentMethods(updatedMethods);
                        
                        // Auto-select first enabled payment method if none selected
                        const methodOrder = ['cash', 'transfer', 'stripe', 'paypal'];
                        const firstEnabled = methodOrder.find(m => updatedMethods[m]?.enabled);
                        if (firstEnabled && !formData.paymentMethod) {
                            setFormData(prev => ({ ...prev, paymentMethod: firstEnabled }));
                        }
                    }
                }
            } catch (err) {
                console.error('Error loading payment methods:', err);
            }
        };
        loadPaymentMethods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Helper: Convert blob to base64 for PDF attachment
    const blobToBase64 = (blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result || '';
            const base64 = String(result).split(',')[1] || '';
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

    /**
     * Send invoice email with PDF attachment
     * Handles errors gracefully without blocking order completion
     * @param {Object} order - The created order
     * @param {Array} orderItems - Items to include in invoice
     * @param {Object} customerFormData - Customer form data (optional, uses formData if not provided)
     */
    const sendInvoiceEmail = useCallback(async (order, orderItems, customerFormData = null) => {
        const customerData = customerFormData || formData;
        // Validate email before attempting to send
        const email = customerData.email?.trim();
        if (!email) {
            console.warn('sendInvoiceEmail: No email provided, skipping');
            return false;
        }

        // Validate items exist
        if (!orderItems || orderItems.length === 0) {
            console.warn('sendInvoiceEmail: No items provided, skipping');
            return false;
        }

        try {
            // Generate invoice PDF
            const invoiceData = buildInvoiceData({
                order,
                customerInfo: customerData,
                items: orderItems,
                siteName,
                siteIcon,
                currencyCode
            });
            const pdfBlob = await generateInvoicePdfBlob(invoiceData);
            const pdfBase64 = await blobToBase64(pdfBlob);
            
            // Send invoice email
            const res = await apiFetch(apiUrl(`/orders/${order.id}/invoice-email`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pdfBase64,
                    email
                })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                const errorMsg = errorData.detail || errorData.message || res.statusText;
                console.error('Invoice email API error:', errorMsg);
                return false;
            }

            // Invoice email sent successfully
            return true;
        } catch (error) {
            console.error('Error sending invoice email:', error.message || error);
            return false;
        }
    }, [formData, siteName, siteIcon, currencyCode]);

    const getSavedAddressDefaults = useCallback(() => {
        const savedAddr = localStorage.getItem('user_default_address');
        if (!savedAddr) return { address: '', sector: '', city: '' };
        try {
            const parsed = JSON.parse(savedAddr);
            return {
                address: parsed.street || '',
                sector: parsed.sector || '',
                city: parsed.city || ''
            };
        } catch (e) {
            console.error('Error parsing saved address', e);
            return { address: '', sector: '', city: '' };
        }
    }, []);

    const getUserDefaults = useCallback((userData) => {
        if (!userData) return { firstName: '', lastName: '', email: '', phone: '', address: '', sector: '', city: '' };
        const nameParts = userData.name ? userData.name.trim().split(' ').filter(Boolean) : [];
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        const addressFromProfile = userData.street || userData.address || '';
        const savedAddress = getSavedAddressDefaults();
        return {
            firstName,
            lastName,
            email: userData.email || '',
            phone: userData.phone || '',
            address: addressFromProfile || savedAddress.address,
            sector: userData.sector || savedAddress.sector || '',
            city: userData.city || savedAddress.city || ''
        };
    }, [getSavedAddressDefaults]);

    const applyDefaultsToForm = useCallback((defaults) => {
        setFormData((prev) => ({
            ...prev,
            firstName: prev.firstName || defaults.firstName,
            lastName: prev.lastName || defaults.lastName,
            email: prev.email || defaults.email,
            phone: prev.phone || defaults.phone,
            address: prev.address || defaults.address,
            sector: prev.sector || defaults.sector,
            city: prev.city || defaults.city
        }));
    }, []);

    // Cargar y guardar progreso del checkout
    useEffect(() => {
        const user = getCurrentUser();
        const savedProgress = localStorage.getItem('checkout_progress');
        let hasSavedProgress = false;

        if (savedProgress) {
            try {
                const parsed = JSON.parse(savedProgress);
                // Si hay progreso guardado, lo restauramos
                // Si el usuario está logueado, solo restauramos si el email coincide o si estaba vacío
                if (!user || !parsed.formData.email || user.email === parsed.formData.email) {
                    setFormData(parsed.formData);
                    setStep(parsed.step || 1);
                    setIsEmailVerified(parsed.isEmailVerified || false);
                    setShowVerification(parsed.showVerification || false);
                    hasSavedProgress = true;
                }
            } catch (e) {
                console.error('Error al cargar progreso de checkout:', e);
            }
        }

        if (user) {
            const defaults = getUserDefaults(user);
            applyDefaultsToForm(defaults);
            setIsEmailVerified(true);
            setShowVerification(false);
            setShowLogin(false);
            setEmailExists(false);
            setFriendlyLoginMessage('');
            if (!hasSavedProgress) {
                setStep(1);
            }
        }
    }, [getUserDefaults, applyDefaultsToForm]);

    // Guardar progreso cada vez que cambie algo relevante
    useEffect(() => {
        if (!orderCreated) {
            localStorage.setItem('checkout_progress', JSON.stringify({
                formData,
                step,
                isEmailVerified,
                showVerification
            }));
        }
    }, [formData, step, isEmailVerified, showVerification, orderCreated]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });
        if (name === 'email') {
            setIsEmailVerified(false);
            setShowLogin(false);
            setEmailExists(false);
            setFriendlyLoginMessage('');
        }
        setError(''); // Limpiar errores al escribir
    };


const handleSubmit = async (e) => {
e.preventDefault();

    try {
        setIsSubmitting(true);
        setError('');

        // Validar que hay productos en el carrito
        if (!cartItems || cartItems.length === 0) {
            setError('Tu carrito está vacío. Agrega al menos un producto para continuar.');
            setIsSubmitting(false);
            return;
        }

        // Validar que se haya seleccionado un método de pago
        if (!formData.paymentMethod) {
            setError('Por favor selecciona un método de pago');
            setIsSubmitting(false);
            return;
        }

        // Validar si el método de pago está disponible
        if (!['cash', 'transfer', 'stripe', 'paypal'].includes(formData.paymentMethod)) {
            setError('Método de pago no válido');
            setIsSubmitting(false);
            return;
        }

        // For Stripe payments - show payment form BEFORE creating order
        // Order will be created after payment is confirmed
        if (formData.paymentMethod === 'stripe') {
            const orderTotal = total + (mapData.shippingCost || 0);
            // Store pending data (no order yet, just preparation data)
            const pendingData = { 
                total: orderTotal,
                items: cartItems,
                formData: formData,
                mapData: mapData
            };
            setPendingStripeOrder(pendingData);
            setShowStripePayment(true);
            // Persist pending payment state and cart items to survive page reloads
            localStorage.setItem('pending_stripe_payment', JSON.stringify({
                showPayment: true,
                pendingData: pendingData,
                cartItems: cartItems,
                formData: formData,
                mapData: mapData
            }));
            setIsSubmitting(false);
            return; // Wait for Stripe payment to complete, then create order
        }

        // For PayPal payments - show payment form BEFORE creating order
        // Order will be created after payment is confirmed
        if (formData.paymentMethod === 'paypal') {
            const orderTotal = total + (mapData.shippingCost || 0);
            // Store pending data (no order yet, just preparation data)
            const pendingData = { 
                total: orderTotal,
                items: cartItems,
                formData: formData,
                mapData: mapData
            };
            setPendingPayPalOrder(pendingData);
            setShowPayPalPayment(true);
            // Persist pending payment state and cart items to survive page reloads
            localStorage.setItem('pending_paypal_payment', JSON.stringify({
                showPayment: true,
                pendingData: pendingData,
                cartItems: cartItems,
                formData: formData,
                mapData: mapData
            }));
            setIsSubmitting(false);
            return; // Wait for PayPal payment to complete, then create order
        }

        // For cash/transfer payments - create order immediately (no payment gateway)
        const isAuthenticated = !!getCurrentUser();

        // Preparar items para el backend
        const orderItems = cartItems.map(item => ({
            product_id: item.id,
            quantity: item.quantity
        }));

        let response;

        if (isAuthenticated) {
            // Usuario autenticado - enviar datos estructurados
            response = await apiFetch(apiUrl('/orders'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    items: orderItems,
                    payment_method: formData.paymentMethod,
                    customer_name: `${formData.firstName} ${formData.lastName}`,
                    customer_email: formData.email,
                    customer_phone: formData.phone,
                    shipping_street: formData.address,
                    shipping_city: formData.city,
                    shipping_sector: formData.sector,
                    notes: formData.notes,
                    shipping_cost: mapData.shippingCost,
                    shipping_distance: mapData.distance,
                    shipping_coordinates: mapData.selectedLocation,
                    skipEmail: true
                })
            });
        } else {
            // Usuario invitado - enviar datos estructurados
            response = await apiFetch(apiUrl('/orders/guest'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    items: orderItems,
                    payment_method: formData.paymentMethod,
                    shipping_street: formData.address,
                    shipping_city: formData.city,
                    shipping_sector: formData.sector,
                    notes: formData.notes,
                    shipping_cost: mapData.shippingCost,
                    shipping_distance: mapData.distance,
                    shipping_coordinates: mapData.selectedLocation,
                    skipEmail: true,
                    customer_info: {
                        name: `${formData.firstName} ${formData.lastName}`,
                        email: formData.email,
                        phone: formData.phone
                    }
                })
            });
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Error al crear la orden');
        }

        const order = await response.json();
    
    // Guardar items confirmados para la factura antes de limpiar el carrito
    const itemsForInvoice = [...cartItems];
    setConfirmedItems(itemsForInvoice);

    // Mostrar confirmación
    setOrderCreated(order);
    localStorage.removeItem('checkout_progress');

    // Send invoice email with saved items (before cart is cleared)
    await sendInvoiceEmail(order, itemsForInvoice);

    if (onOrderComplete) {
        onOrderComplete(cartItems);
    }
    
    // Vaciar carrito después de confirmar pedido
    if (onClearCart) {
        onClearCart();
    }

    // Llamar callback original si existe
    if (onSubmit) {
        onSubmit({ orderDetails: formData, items: cartItems, total, orderId: order.id });
    }

} catch (err) {
    console.error('Error al procesar la orden:', err);
    setError(err.message || 'Error al procesar la orden. Inténtalo de nuevo.');
} finally {
    setIsSubmitting(false);
}
};

const checkEmailExists = async (email) => {
    try {
        const response = await fetch(`${API_URL}/auth/check-email?email=${encodeURIComponent(email)}`);
        if (!response.ok) return false;
        const data = await response.json();
        return !!data.exists;
    } catch (err) {
        console.error('Error checking email:', err);
        return false;
    }
};

const applyUserToForm = (userData) => {
    if (!userData) return;
    const defaults = getUserDefaults(userData);
    applyDefaultsToForm(defaults);
};

return (
        <div className="checkout-page product-detail-page">
            <section className="hero-section">
                <div className="container hero-container">
                    <div className="hero-content">
                        <button 
                            className="back-btn-new hero-back-btn" 
                            onClick={onClose}
                        >
                            ← Volver
                        </button>
                        <h2 className="hero-title">
                            {step === 1 && 'Información Personal'}
                            {step === 2 && 'Información de Envío'}
                            {step === 3 && 'Revisión del Pedido'}
                            {step === 4 && 'Método de Pago'}
                        </h2>
                        <p className="hero-text">
                            <span className="hero-category-badge">CHECKOUT</span>
                            {step === 1 && 'Completa tu información personal y de contacto.'}
                            {step === 2 && 'Agrega la dirección de envío y puedes seleccionar tu ubicación en el mapa en 📍 Mi Ubicación o pinchando en el mapa.'}
                            {step === 3 && 'Verifica que los datos y productos del pedido estén correctos para continuar.'}
                            {step === 4 && 'Selecciona tu método de pago preferido.'}
                        </p>
                    </div>
                </div>
            </section>

            <div className="checkout-content container">
    
            {orderCreated ? (
                <Invoice 
                    order={{
                        ...orderCreated,
                        subtotal: total,
                        shipping_cost: mapData.shippingCost,
                        shipping_distance: mapData.distance,
                        shipping_coordinates: mapData.selectedLocation,
                        total: total + mapData.shippingCost
                    }}
                    customerInfo={{
                        ...formData,
                        // Use payment_method from order if available (more reliable after Stripe/PayPal payments)
                        paymentMethod: orderCreated.payment_method || formData.paymentMethod,
                        shippingCost: mapData.shippingCost,
                        shippingDistance: mapData.distance,
                        shippingCoordinates: mapData.selectedLocation
                    }}
                    items={confirmedItems}
                    onClose={() => {
                        window.scrollTo(0, 0);
                        navigate('/');
                    }}
                    siteName={siteName}
                    siteIcon={siteIcon}
                    currencyCode={currencyCode}
                />
            ) : (
        <div className="checkout-flow-container">
            {/* Indicador de pasos */}
            <div className="checkout-steps">
                <div className={`step ${step >= 1 ? 'active' : ''}`}>1. Datos</div>
                <div className={`step ${step >= 2 ? 'active' : ''}`}>2. Envió</div>
                <div className={`step ${step >= 3 ? 'active' : ''}`}>3. Revisión</div>
                <div className={`step ${step >= 4 ? 'active' : ''}`}>4. Pago</div>
            </div>

            {error && (
                <div className="checkout-error-banner">
                    ⚠️ {error}
                </div>
            )}

            <div className="cart-layout">
                <div className="checkout-form-column">
                    <div className="form-card-container">
                        {step === 1 && (
                            showLogin ? (
                                <div className="verification-step-wrapper">
                                    {friendlyLoginMessage && (
                                        <div style={{ marginBottom: '12px', color: '#2f855a', fontWeight: 600, textAlign: 'center' }}>
                                            {friendlyLoginMessage}
                                        </div>
                                    )}
                                    <LoginPage
                                        embedded={true}
                                        hideRegister={true}
                                        prefillEmail={formData.email}
                                        lockEmail={true}
                                        onLoginSuccess={async (userData) => {
                                            setIsEmailVerified(true);
                                            setShowLogin(false);
                                            setShowVerification(false);
                                            applyUserToForm(userData);
                                            if (onLoginSuccess) {
                                                await onLoginSuccess(userData);
                                            }
                                            setStep(2);
                                        }}
                                        onBackToHome={() => setShowLogin(false)}
                                    />
                                    <button 
                                        className="back-link" 
                                        onClick={() => setShowLogin(false)}
                                        style={{marginTop: '15px', background: 'none', border: 'none', color: 'var(--gray-500)', textDecoration: 'underline', width: '100%', cursor: 'pointer'}}
                                    >
                                        Regresar a editar datos
                                    </button>
                                </div>
                            ) : showVerification ? (
                                <div className="verification-step-wrapper">
                                    <EmailVerification
                                        initialEmail={formData.email}
                                        lockEmail={true}
                                        purpose="guest_checkout"
                                        onBeforeSend={async (email) => {
                                            const exists = await checkEmailExists(email);
                                            setEmailExists(exists);
                                            if (exists) {
                                                setFriendlyLoginMessage('Ya está registrado. Inicia sesión para continuar.');
                                                setShowLogin(true);
                                                setShowVerification(false);
                                                setError('');
                                                return false;
                                            }
                                            setError('');
                                            return true;
                                        }}
                                        onVerified={() => {
                                            setIsEmailVerified(true);
                                            setShowVerification(false);
                                            setStep(2);
                                        }}
                                        onCancel={() => setShowVerification(false)}
                                    />
                                    <button 
                                        className="back-link" 
                                        onClick={() => setShowVerification(false)}
                                        style={{marginTop: '15px', background: 'none', border: 'none', color: 'var(--gray-500)', textDecoration: 'underline', width: '100%', cursor: 'pointer'}}
                                    >
                                        Regresar a editar datos
                                    </button>
                                </div>
                            ) : (
                                <form id="step1-form" className="step-form" onSubmit={(e) => {
                                    e.preventDefault();
                                    // Validate cart has items before proceeding
                                    if (!cartItems || cartItems.length === 0) {
                                        setError('Tu carrito está vacío. Agrega productos antes de continuar.');
                                        return;
                                    }
                                    const user = getCurrentUser();
                                    if (user || isEmailVerified) {
                                        setStep(2);
                                        return;
                                    }
                                    setEmailExists(false);
                                    setShowLogin(false);
                                    checkEmailExists(formData.email).then((exists) => {
                                        if (exists) {
                                            setEmailExists(true);
                                            setShowLogin(true);
                                            setShowVerification(false);
                                            setFriendlyLoginMessage('Ya está registrado. Inicia sesión para continuar.');
                                            setError('');
                                        } else {
                                            setError('');
                                            setShowVerification(true);
                                        }
                                    });
                                }}>
                                    <h3>Información Personal</h3>
                                    <div className="form-grid">
                                        <div className="form-group">
                                            <label>Nombre *</label>
                                            <input
                                                type="text"
                                                name="firstName"
                                                placeholder="Ej. Juan"
                                                value={formData.firstName}
                                                onChange={handleInputChange}
                                                required
                                                disabled={isSubmitting}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Apellidos *</label>
                                            <input
                                                type="text"
                                                name="lastName"
                                                placeholder="Ej. Pérez"
                                                value={formData.lastName}
                                                onChange={handleInputChange}
                                                required
                                                disabled={isSubmitting}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-grid" style={{marginBottom: '20px'}}>
                                        <div className="form-group">
                                            <label>Correo Electrónico *</label>
                                            <input
                                                type="email"
                                                name="email"
                                                placeholder="correo@ejemplo.com"
                                                value={formData.email}
                                                onChange={(e) => {
                                                    handleInputChange(e);
                                                    const user = getCurrentUser();
                                                    if (!user) {
                                                        setIsEmailVerified(false);
                                                    }
                                                }}
                                                required
                                                disabled={isSubmitting}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Teléfono de Contacto *</label>
                                            <input
                                                type="tel"
                                                name="phone"
                                                placeholder="Ej. 809-555-0123"
                                                value={formData.phone}
                                                onChange={handleInputChange}
                                                required
                                                disabled={isSubmitting}
                                            />
                                        </div>
                                    </div>
                                </form>
                            )
                        )}

                        {step === 2 && (
                            <form id="step2-form" className="step-form step-form-shipping" onSubmit={(e) => {
                                e.preventDefault();
                                // Validate cart has items before proceeding
                                if (!cartItems || cartItems.length === 0) {
                                    setError('Tu carrito está vacío. Agrega productos antes de continuar.');
                                    return;
                                }
                                setError('');
                                setStep(3);
                            }}>
                                <h3>Detalles de Entrega</h3>
                                
                                {/* Address Form Fields - First */}
                                <div className="shipping-address-fields">
                                    <div className="form-group" style={{marginBottom: '15px'}}>
                                        <label>Calle y Número *</label>
                                        <input
                                            type="text"
                                            name="address"
                                            placeholder="Ej. Calle 5, Casa #10"
                                            value={formData.address}
                                            onChange={handleInputChange}
                                            required
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                    <div className="form-grid">
                                        <div className="form-group">
                                            <label>Sector *</label>
                                            <input
                                                type="text"
                                                name="sector"
                                                placeholder="Sector / Barrio"
                                                value={formData.sector}
                                                onChange={handleInputChange}
                                                required
                                                disabled={isSubmitting}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Ciudad *</label>
                                            <input
                                                type="text"
                                                name="city"
                                                placeholder="Ciudad"
                                                value={formData.city}
                                                onChange={handleInputChange}
                                                required
                                                disabled={isSubmitting}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group" style={{marginBottom: '20px'}}>
                                        <label>Notas de Entrega (Opcional)</label>
                                        <textarea
                                            name="notes"
                                            placeholder="Referencias, puntos de referencia, instrucciones especiales..."
                                            className="checkout-textarea"
                                            value={formData.notes}
                                            onChange={handleInputChange}
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                </div>

                                <DeliveryMap
                                    mapData={mapData}
                                    setMapData={setMapData}
                                    onAddressSelect={(address) => {
                                        setFormData(prev => ({ ...prev, address }));
                                    }}
                                    onError={setError}
                                    currencyCode={currencyCode}
                                    addressFields={{
                                        address: formData.address,
                                        sector: formData.sector,
                                        city: formData.city
                                    }}
                                />
                            </form>
                        )}

                        {step === 3 && (
                            <div className="step-form">
                                <h3>Revisión de Pedido</h3>
                                <div className="review-card">
                                    <div className="review-item">
                                        <label>Enviar a:</label>
                                        <p>{formData.firstName} {formData.lastName}</p>
                                    </div>
                                    <div className="review-item">
                                        <label>Correo Electrónico:</label>
                                        <p>{formData.email}</p>
                                    </div>
                                    <div className="review-item">
                                        <label>Teléfono de Contacto:</label>
                                        <p>{formData.phone}</p>
                                    </div>
                                    <div className="review-item">
                                        <label>Dirección:</label>
                                        <p>{formData.address}, {formData.sector}, {formData.city}</p>
                                    </div>
                                    {mapData.selectedLocation && (
                                        <div className="review-item">
                                            <label>📍 Coordenadas GPS:</label>
                                            <p>{mapData.selectedLocation.lat.toFixed(6)}, {mapData.selectedLocation.lng.toFixed(6)}</p>
                                        </div>
                                    )}
                                    {mapData.distance && (
                                        <div className="review-item">
                                            <label>📏 Distancia de envío:</label>
                                            <p>{mapData.distance.toFixed(2)} km</p>
                                        </div>
                                    )}
                                    {formData.notes && (
                                        <div className="review-item">
                                            <label>Notas:</label>
                                            <p>{formData.notes}</p>
                                        </div>
                                    )}
                                </div>
                                {mapData.shippingCost > 0 && (
                                    <div className="review-shipping-cost">
                                        <span>💵 Costo de Envío:</span>
                                        <span className="shipping-total">{formatCurrency(mapData.shippingCost, currencyCode)}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {step === 4 && (
                            <div className="step-form">
                                <h3>Método de Pago</h3>
                                
                                {/* Show Stripe payment form when selected */}
                                {showStripePayment && pendingStripeOrder ? (
                                    <StripePayment
                                        amount={pendingStripeOrder.total}
                                        currency="dop"
                                        orderId={null}
                                        customerEmail={formData.email}
                                        onSuccess={async (paymentIntent) => {
                                            // Payment confirmed - NOW create the order
                                            try {
                                                setIsSubmitting(true);
                                                
                                                // Get data from pending state or localStorage
                                                let orderFormData = formData;
                                                let orderMapData = mapData;
                                                let orderCartItems = cartItems.length > 0 ? cartItems : [];
                                                
                                                // Recover from localStorage if needed (page reload scenario)
                                                if (orderCartItems.length === 0) {
                                                    try {
                                                        const savedPayment = localStorage.getItem('pending_stripe_payment');
                                                        if (savedPayment) {
                                                            const parsed = JSON.parse(savedPayment);
                                                            orderCartItems = parsed.cartItems || [];
                                                            orderFormData = parsed.formData || formData;
                                                            orderMapData = parsed.mapData || mapData;
                                                        }
                                                    } catch (e) { console.error('Error recovering data:', e); }
                                                }
                                                
                                                const isAuthenticated = !!getCurrentUser();
                                                const orderItems = orderCartItems.map(item => ({
                                                    product_id: item.id,
                                                    quantity: item.quantity
                                                }));
                                                
                                                // Create order with payment already confirmed
                                                let response;
                                                if (isAuthenticated) {
                                                    response = await apiFetch(apiUrl('/orders'), {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            items: orderItems,
                                                            payment_method: 'stripe',
                                                            payment_status: 'paid',
                                                            payment_intent_id: paymentIntent.id,
                                                            customer_name: `${orderFormData.firstName} ${orderFormData.lastName}`,
                                                            customer_email: orderFormData.email,
                                                            customer_phone: orderFormData.phone,
                                                            shipping_street: orderFormData.address,
                                                            shipping_city: orderFormData.city,
                                                            shipping_sector: orderFormData.sector,
                                                            notes: orderFormData.notes,
                                                            shipping_cost: orderMapData.shippingCost,
                                                            shipping_distance: orderMapData.distance,
                                                            shipping_coordinates: orderMapData.selectedLocation,
                                                            skipEmail: true
                                                        })
                                                    });
                                                } else {
                                                    response = await apiFetch(apiUrl('/orders/guest'), {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            items: orderItems,
                                                            payment_method: 'stripe',
                                                            payment_status: 'paid',
                                                            payment_intent_id: paymentIntent.id,
                                                            shipping_street: orderFormData.address,
                                                            shipping_city: orderFormData.city,
                                                            shipping_sector: orderFormData.sector,
                                                            notes: orderFormData.notes,
                                                            shipping_cost: orderMapData.shippingCost,
                                                            shipping_distance: orderMapData.distance,
                                                            shipping_coordinates: orderMapData.selectedLocation,
                                                            skipEmail: true,
                                                            customer_info: {
                                                                name: `${orderFormData.firstName} ${orderFormData.lastName}`,
                                                                email: orderFormData.email,
                                                                phone: orderFormData.phone
                                                            }
                                                        })
                                                    });
                                                }
                                                
                                                if (!response.ok) {
                                                    const errorData = await response.json().catch(() => ({}));
                                                    throw new Error(errorData.message || 'Error al crear la orden');
                                                }
                                                
                                                const order = await response.json();
                                                const paidOrder = { 
                                                    ...order, 
                                                    total: pendingStripeOrder.total,
                                                    status: 'paid',
                                                    payment_status: 'paid',
                                                    payment_method: 'stripe'
                                                };
                                                
                                                setShowStripePayment(false);
                                                setOrderCreated(paidOrder);
                                                setConfirmedItems(orderCartItems);
                                                
                                                // Clear all persisted payment/checkout state
                                                localStorage.removeItem('checkout_progress');
                                                localStorage.removeItem('pending_stripe_payment');
                                                
                                                // Send invoice email
                                                await sendInvoiceEmail(paidOrder, orderCartItems, orderFormData);
                                                
                                                // Clear cart AFTER order is created
                                                if (onClearCart) onClearCart();
                                                if (onOrderComplete) onOrderComplete(paidOrder);
                                                setStep(5);
                                                
                                            } catch (err) {
                                                console.error('Error creating order after payment:', err);
                                                setError('Pago confirmado pero hubo un error creando la orden. Contacta soporte con tu ID de pago: ' + paymentIntent.id);
                                            } finally {
                                                setIsSubmitting(false);
                                            }
                                        }}
                                        onError={(error) => {
                                            console.error('Stripe payment error:', error);
                                            setError('Error en el pago: ' + (error.message || 'Intenta de nuevo'));
                                        }}
                                        onCancel={() => {
                                            setShowStripePayment(false);
                                            setPendingStripeOrder(null);
                                            localStorage.removeItem('pending_stripe_payment');
                                        }}
                                    />
                                ) : showPayPalPayment && pendingPayPalOrder ? (
                                    /* Show PayPal payment form when selected */
                                    <PayPalPayment
                                        amount={pendingPayPalOrder.total}
                                        currency="USD"
                                        orderId={null}
                                        customerEmail={formData.email}
                                        onSuccess={async (paymentResult) => {
                                            // Payment confirmed - NOW create the order
                                            try {
                                                setIsSubmitting(true);
                                                
                                                // Get data from pending state or localStorage
                                                let orderFormData = formData;
                                                let orderMapData = mapData;
                                                let orderCartItems = cartItems.length > 0 ? cartItems : [];
                                                
                                                // Recover from localStorage if needed (page reload scenario)
                                                if (orderCartItems.length === 0) {
                                                    try {
                                                        const savedPayment = localStorage.getItem('pending_paypal_payment');
                                                        if (savedPayment) {
                                                            const parsed = JSON.parse(savedPayment);
                                                            orderCartItems = parsed.cartItems || [];
                                                            orderFormData = parsed.formData || formData;
                                                            orderMapData = parsed.mapData || mapData;
                                                        }
                                                    } catch (e) { console.error('Error recovering data:', e); }
                                                }
                                                
                                                const isAuthenticated = !!getCurrentUser();
                                                const orderItems = orderCartItems.map(item => ({
                                                    product_id: item.id,
                                                    quantity: item.quantity
                                                }));
                                                
                                                // Create order with payment already confirmed
                                                let response;
                                                if (isAuthenticated) {
                                                    response = await apiFetch(apiUrl('/orders'), {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            items: orderItems,
                                                            payment_method: 'paypal',
                                                            payment_status: 'paid',
                                                            paypal_order_id: paymentResult.id,
                                                            customer_name: `${orderFormData.firstName} ${orderFormData.lastName}`,
                                                            customer_email: orderFormData.email,
                                                            customer_phone: orderFormData.phone,
                                                            shipping_street: orderFormData.address,
                                                            shipping_city: orderFormData.city,
                                                            shipping_sector: orderFormData.sector,
                                                            notes: orderFormData.notes,
                                                            shipping_cost: orderMapData.shippingCost,
                                                            shipping_distance: orderMapData.distance,
                                                            shipping_coordinates: orderMapData.selectedLocation,
                                                            skipEmail: true
                                                        })
                                                    });
                                                } else {
                                                    response = await apiFetch(apiUrl('/orders/guest'), {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            items: orderItems,
                                                            payment_method: 'paypal',
                                                            payment_status: 'paid',
                                                            paypal_order_id: paymentResult.id,
                                                            shipping_street: orderFormData.address,
                                                            shipping_city: orderFormData.city,
                                                            shipping_sector: orderFormData.sector,
                                                            notes: orderFormData.notes,
                                                            shipping_cost: orderMapData.shippingCost,
                                                            shipping_distance: orderMapData.distance,
                                                            shipping_coordinates: orderMapData.selectedLocation,
                                                            skipEmail: true,
                                                            customer_info: {
                                                                name: `${orderFormData.firstName} ${orderFormData.lastName}`,
                                                                email: orderFormData.email,
                                                                phone: orderFormData.phone
                                                            }
                                                        })
                                                    });
                                                }
                                                
                                                if (!response.ok) {
                                                    const errorData = await response.json().catch(() => ({}));
                                                    throw new Error(errorData.message || 'Error al crear la orden');
                                                }
                                                
                                                const order = await response.json();
                                                const paidOrder = { 
                                                    ...order, 
                                                    total: pendingPayPalOrder.total,
                                                    status: 'paid',
                                                    payment_status: 'paid',
                                                    payment_method: 'paypal'
                                                };
                                                
                                                setShowPayPalPayment(false);
                                                setOrderCreated(paidOrder);
                                                setConfirmedItems(orderCartItems);
                                                
                                                // Clear all persisted payment/checkout state
                                                localStorage.removeItem('checkout_progress');
                                                localStorage.removeItem('pending_paypal_payment');
                                                
                                                // Send invoice email
                                                await sendInvoiceEmail(paidOrder, orderCartItems, orderFormData);
                                                
                                                // Clear cart AFTER order is created
                                                if (onClearCart) onClearCart();
                                                if (onOrderComplete) onOrderComplete(paidOrder);
                                                setStep(5);
                                                
                                            } catch (err) {
                                                console.error('Error creating order after payment:', err);
                                                setError('Pago confirmado pero hubo un error creando la orden. Contacta soporte con tu ID de pago: ' + paymentResult.id);
                                            } finally {
                                                setIsSubmitting(false);
                                            }
                                        }}
                                        onError={(error) => {
                                            console.error('PayPal payment error:', error);
                                            setError('Error en el pago con PayPal: ' + (error.message || 'Intenta de nuevo'));
                                        }}
                                        onCancel={() => {
                                            setShowPayPalPayment(false);
                                            setPendingPayPalOrder(null);
                                            localStorage.removeItem('pending_paypal_payment');
                                        }}
                                    />
                                ) : (
                                    <div className="payment-methods">
                                        {/* Dynamically render enabled payment methods */}
                                        {paymentMethods.cash?.enabled && (
                                            <div 
                                                className={`payment-option ${formData.paymentMethod === 'cash' ? 'selected' : ''}`}
                                                onClick={() => setFormData({...formData, paymentMethod: 'cash'})}
                                            >
                                                <div className="payment-icon">{paymentMethods.cash.icon || '💵'}</div>
                                                <div className="payment-info">
                                                    <h4>{paymentMethods.cash.name || 'Pago Contra Entrega'}</h4>
                                                    <p>{paymentMethods.cash.description || 'Paga en efectivo cuando recibas tu pedido'}</p>
                                                </div>
                                                <div className="payment-check">
                                                    {formData.paymentMethod === 'cash' && '✓'}
                                                </div>
                                            </div>
                                        )}

                                        {paymentMethods.transfer?.enabled && (
                                            <div 
                                                className={`payment-option ${formData.paymentMethod === 'transfer' ? 'selected' : ''}`}
                                                onClick={() => setFormData({...formData, paymentMethod: 'transfer'})}
                                            >
                                                <div className="payment-icon">{paymentMethods.transfer.icon || '🏦'}</div>
                                                <div className="payment-info">
                                                    <h4>{paymentMethods.transfer.name || 'Transferencia Bancaria'}</h4>
                                                    <p>{paymentMethods.transfer.description || 'Transferencia o depósito bancario'}</p>
                                                    {paymentMethods.transfer.bankName && (
                                                        <div className="bank-info-preview">
                                                            <small>{paymentMethods.transfer.bankName} — {paymentMethods.transfer.bankAccount}</small>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="payment-check">
                                                    {formData.paymentMethod === 'transfer' && '✓'}
                                                </div>
                                            </div>
                                        )}

                                        {paymentMethods.stripe?.enabled && (
                                            <div 
                                                className={`payment-option ${formData.paymentMethod === 'stripe' ? 'selected' : ''}`}
                                                onClick={() => setFormData({...formData, paymentMethod: 'stripe'})}
                                            >
                                                <div className="payment-icon">{paymentMethods.stripe.icon || '💳'}</div>
                                                <div className="payment-info">
                                                    <h4>{paymentMethods.stripe.name || 'Tarjeta de Crédito/Débito'}</h4>
                                                    <p>{paymentMethods.stripe.description || 'Visa, MasterCard, American Express'}</p>
                                                </div>
                                                <div className="payment-check">
                                                    {formData.paymentMethod === 'stripe' && '✓'}
                                                </div>
                                            </div>
                                        )}

                                        {paymentMethods.paypal?.enabled && (
                                            <div 
                                                className={`payment-option ${formData.paymentMethod === 'paypal' ? 'selected' : ''}`}
                                                onClick={() => setFormData({...formData, paymentMethod: 'paypal'})}
                                            >
                                                <div className="payment-icon">{paymentMethods.paypal.icon || '🅿️'}</div>
                                                <div className="payment-info">
                                                    <h4>{paymentMethods.paypal.name || 'PayPal'}</h4>
                                                    <p>{paymentMethods.paypal.description || 'Paga con tu cuenta PayPal'}</p>
                                                </div>
                                                <div className="payment-check">
                                                    {formData.paymentMethod === 'paypal' && '✓'}
                                                </div>
                                            </div>
                                        )}

                                        {/* Show message if no payment methods available */}
                                        {!paymentMethods.cash?.enabled && !paymentMethods.transfer?.enabled && !paymentMethods.stripe?.enabled && !paymentMethods.paypal?.enabled && (
                                            <div className="no-payment-methods">
                                                <p>⚠️ No hay métodos de pago disponibles en este momento.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                        <div className="checkout-summary-column">
                            <div className="summary-card">
                                <h3>Tu Carrito</h3>
                                {(!cartItems || cartItems.length === 0) ? (
                                    <div className="empty-cart-warning">
                                        <p>⚠️ Tu carrito está vacío</p>
                                        <button 
                                            type="button" 
                                            className="btn-back-to-store"
                                            onClick={() => navigate('/')}
                                        >
                                            Volver a la tienda
                                        </button>
                                    </div>
                                ) : (
                                <>
                                <div className="mini-item-list">
                                    {cartItems.map(item => (
                                        <div key={item.id} className="mini-item">
                                            <div className="mini-item-main">
                                                <img 
                                                    src={item.image ? (
                                                        item.image.startsWith('http') 
                                                            ? item.image 
                                                            : (item.image.startsWith('/images/') 
                                                                ? `${BASE_URL}${item.image}` 
                                                                : `${BASE_URL}/images/${item.image}`)
                                                    ) : '/images/sin imagen.jpeg'} 
                                                    alt={item.name}
                                                    className="mini-item-img"
                                                    onError={(e) => { e.target.src = '/images/sin imagen.jpeg'; }}
                                                />
                                                <div className="mini-item-info">
                                                    <span className="mini-item-name">{item.name}</span>
                                                    <span className="mini-item-meta">{item.quantity} un. x {formatCurrency(item.price, currencyCode)}</span>
                                                </div>
                                            </div>
                                            <span className="mini-item-price">{formatCurrency(item.price * item.quantity, currencyCode)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="summary-divider"></div>
                                <div className="summary-row">
                                    <span>Subtotal</span>
                                    <span>{formatCurrency(total, currencyCode)}</span>
                                </div>
                                <div className="summary-row shipping-row">
                                    <span>Envío</span>
                                    <span className={mapData.shippingCost > 0 ? '' : 'shipping-pending'}>
                                        {mapData.shippingCost > 0 
                                            ? formatCurrency(mapData.shippingCost, currencyCode) 
                                            : 'Pendiente'}
                                    </span>
                                </div>
                                <div className="summary-divider"></div>
                                <div className="summary-row total-row">
                                    <span>Total</span>
                                    <span>{formatCurrency(total + mapData.shippingCost, currencyCode)}</span>
                                </div>
                                </>
                                )}
                            </div>
                        </div>
            </div>

            <div className="checkout-actions-container">
                {step > 1 && (
                    <button 
                        type="button" 
                        className="btn-back" 
                        onClick={() => setStep(step - 1)}
                        disabled={isSubmitting}
                    >
                        <span className="btn-icon">←</span> Atrás
                    </button>
                )}
                
                {step === 1 && !showVerification && !showLogin && (
                    <button type="submit" form="step1-form" className="btn-next">
                        Siguiente <span className="btn-icon">→</span>
                    </button>
                )}
                
                {step === 2 && (
                    <button type="submit" form="step2-form" className="btn-next">
                        Siguiente <span className="btn-icon">→</span>
                    </button>
                )}

                {step === 3 && (
                    <button type="button" className="btn-next" onClick={() => {
                        // Validate cart has items before proceeding to payment
                        if (!cartItems || cartItems.length === 0) {
                            setError('Tu carrito está vacío. Agrega productos antes de continuar.');
                            return;
                        }
                        setStep(4);
                    }}>
                        Siguiente <span className="btn-icon">→</span>
                    </button>
                )}

                {step === 4 && (
                    <button 
                        type="button" 
                        className={`btn-confirm ${(showStripePayment || showPayPalPayment) ? 'btn-disabled-stripe' : ''}`}
                        onClick={handleSubmit} 
                        disabled={isSubmitting || showStripePayment || showPayPalPayment}
                        title={(showStripePayment || showPayPalPayment) ? 'Complete el pago para continuar' : ''}
                    >
                        {isSubmitting ? 'Procesando...' : ((showStripePayment || showPayPalPayment) ? 'Continuar' : 'Confirmar Todo el Pedido')} 
                        <span className="btn-icon">{(showStripePayment || showPayPalPayment) ? '→' : '✓'}</span>
                    </button>
                )}
            </div>
        </div>
    )}
    </div>
</div>
);

}

export default Checkout;
