import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL, BASE_URL } from '../../config';
import { apiFetch, apiUrl } from '../../services/apiClient';
import { getCurrentUser } from '../../services/authService';
import Invoice from '../common/Invoice';
import { buildInvoiceData, generateInvoicePdfBlob } from '../../utils/invoiceUtils';
import EmailVerification from '../auth/EmailVerification';
import LoginPage from '../auth/LoginPage';
import '../products/ProductDetail.css';
import './Checkout.css';
import { formatCurrency } from '../../utils/formatCurrency';

// Shipping rates by distance (in km)
const PRICE_RANGES = [
    { maxDistance: 5, price: 50, label: 'Zona 1 (0-5km)' },
    { maxDistance: 10, price: 100, label: 'Zona 2 (5-10km)' },
    { maxDistance: 20, price: 180, label: 'Zona 3 (10-20km)' },
    { maxDistance: 50, price: 350, label: 'Zona 4 (20-50km)' },
    { maxDistance: Infinity, price: 600, label: 'Zona 5 (>50km)' }
];

// Distribution center location (Santo Domingo, Dominican Republic)
const WAREHOUSE_LOCATION = {
    lat: 18.4861,
    lng: -69.9312,
    address: 'Centro de Distribución - Santo Domingo'
};

function Checkout({ cartItems, total, onSubmit, onClose, onClearCart, onOrderComplete, siteName, siteIcon, onLoginSuccess, currencyCode }) {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
firstName: '',
lastName: '',
email: '',
address: '',
sector: '',
city: '',
phone: '',
notes: '', // Nuevo campo opcional para notas/referencias
paymentMethod: '' // Nuevo campo para método de pago
});

const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Map refs and state
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const warehouseMarkerRef = useRef(null);
    const deliveryMarkerRef = useRef(null);
    const routeLineRef = useRef(null);
    const [mapData, setMapData] = useState({
        selectedLocation: null,
        distance: null,
        shippingCost: 0
    });
    const [leafletLoaded, setLeafletLoaded] = useState(false);
    const [error, setError] = useState('');
    const [orderCreated, setOrderCreated] = useState(null);
    const [confirmedItems, setConfirmedItems] = useState([]);
    const [isEmailVerified, setIsEmailVerified] = useState(false);
    const [showVerification, setShowVerification] = useState(false);
    const [_emailExists, setEmailExists] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [friendlyLoginMessage, setFriendlyLoginMessage] = useState('');

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

    // Calculate distance using Haversine formula
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Earth radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };

    // Calculate shipping cost based on distance
    const calculateShippingCost = (distance) => {
        const range = PRICE_RANGES.find(r => distance <= r.maxDistance);
        return range ? range.price : PRICE_RANGES[PRICE_RANGES.length - 1].price;
    };

    // Update delivery location on map
    const updateDeliveryLocation = useCallback((lat, lng) => {
        const distance = calculateDistance(
            WAREHOUSE_LOCATION.lat,
            WAREHOUSE_LOCATION.lng,
            lat,
            lng
        );
        const cost = calculateShippingCost(distance);

        setMapData(prev => ({
            ...prev,
            selectedLocation: { lat, lng },
            distance,
            shippingCost: cost
        }));

        // Update delivery marker
        if (mapInstanceRef.current && window.L) {
            const L = window.L;
            if (deliveryMarkerRef.current) {
                deliveryMarkerRef.current.setLatLng([lat, lng]);
            } else {
                const deliveryIcon = L.divIcon({
                    html: '<div style="background-color: #ef4444; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>',
                    className: '',
                    iconSize: [30, 30],
                    iconAnchor: [15, 30]
                });

                deliveryMarkerRef.current = L.marker([lat, lng], {
                    icon: deliveryIcon,
                    draggable: true
                }).addTo(mapInstanceRef.current);

                deliveryMarkerRef.current.on('dragend', (e) => {
                    const { lat: newLat, lng: newLng } = e.target.getLatLng();
                    updateDeliveryLocation(newLat, newLng);
                });
            }

            // Draw route line
            if (routeLineRef.current) {
                mapInstanceRef.current.removeLayer(routeLineRef.current);
            }

            routeLineRef.current = L.polyline([
                [WAREHOUSE_LOCATION.lat, WAREHOUSE_LOCATION.lng],
                [lat, lng]
            ], {
                color: '#3b82f6',
                weight: 4,
                opacity: 0.7,
                dashArray: '10, 10'
            }).addTo(mapInstanceRef.current);

            // Fit bounds to show both points
            const bounds = L.latLngBounds([
                [WAREHOUSE_LOCATION.lat, WAREHOUSE_LOCATION.lng],
                [lat, lng]
            ]);
            mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
    }, []);

    // Get current location from browser
    const getCurrentLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    updateDeliveryLocation(latitude, longitude);
                    
                    if (mapInstanceRef.current) {
                        mapInstanceRef.current.setView([latitude, longitude], 15);
                    }
                },
                (error) => {
                    console.error('Error getting location:', error);
                    setError('No se pudo obtener tu ubicación. Verifica los permisos del navegador.');
                },
                { enableHighAccuracy: true }
            );
        } else {
            setError('Tu navegador no soporta geolocalización');
        }
    };

    // Load Leaflet scripts dynamically
    useEffect(() => {
        if (window.L) {
            setLeafletLoaded(true);
            return;
        }

        // Load Leaflet CSS
        const leafletCss = document.createElement('link');
        leafletCss.rel = 'stylesheet';
        leafletCss.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(leafletCss);

        // Load Geocoder CSS
        const geocoderCss = document.createElement('link');
        geocoderCss.rel = 'stylesheet';
        geocoderCss.href = 'https://unpkg.com/leaflet-control-geocoder@2.4.0/dist/Control.Geocoder.css';
        document.head.appendChild(geocoderCss);

        // Load Leaflet JS
        const leafletScript = document.createElement('script');
        leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        leafletScript.onload = () => {
            // Load Geocoder JS after Leaflet
            const geocoderScript = document.createElement('script');
            geocoderScript.src = 'https://unpkg.com/leaflet-control-geocoder@2.4.0/dist/Control.Geocoder.js';
            geocoderScript.onload = () => setLeafletLoaded(true);
            document.body.appendChild(geocoderScript);
        };
        document.body.appendChild(leafletScript);
    }, []);

    // Initialize map when step is 2 and Leaflet is loaded
    useEffect(() => {
        if (step !== 2 || !leafletLoaded || !mapRef.current || mapInstanceRef.current) return;

        const L = window.L;
        
        // Create map
        const map = L.map(mapRef.current).setView(
            [WAREHOUSE_LOCATION.lat, WAREHOUSE_LOCATION.lng],
            12
        );

        // Add map layer (OpenStreetMap)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);

        // Warehouse marker
        const warehouseIcon = L.divIcon({
            html: '<div style="background-color: #3b82f6; width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 20px;">🏢</div>',
            className: '',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        warehouseMarkerRef.current = L.marker(
            [WAREHOUSE_LOCATION.lat, WAREHOUSE_LOCATION.lng],
            { icon: warehouseIcon }
        ).addTo(map);

        warehouseMarkerRef.current.bindPopup(
            `<strong>${WAREHOUSE_LOCATION.address}</strong>`
        );

        // Click on map to select location
        map.on('click', (e) => {
            updateDeliveryLocation(e.latlng.lat, e.latlng.lng);
        });

        // Add search control
        const geocoder = L.Control.Geocoder.nominatim();
        L.Control.geocoder({
            geocoder: geocoder,
            defaultMarkGeocode: false,
            placeholder: 'Buscar dirección...',
            errorMessage: 'No se encontró la dirección'
        }).on('markgeocode', (e) => {
            const { center, name } = e.geocode;
            updateDeliveryLocation(center.lat, center.lng);
            setFormData(prev => ({ ...prev, address: name }));
            map.setView(center, 15);
        }).addTo(map);

        mapInstanceRef.current = map;

        // Cleanup
        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
                deliveryMarkerRef.current = null;
                routeLineRef.current = null;
            }
        };
    }, [step, leafletLoaded, updateDeliveryLocation]);

const handleSubmit = async (e) => {
e.preventDefault();

    try {
        setIsSubmitting(true);
        setError('');

        // Validar que se haya seleccionado un método de pago
        if (!formData.paymentMethod) {
            setError('Por favor selecciona un método de pago');
            setIsSubmitting(false);
            return;
        }

        // Validar si el método de pago está disponible
        if (formData.paymentMethod !== 'cash' && formData.paymentMethod !== 'transfer') {
            setError('Este método de pago estará disponible próximamente. Por favor selecciona "Pago Contra Entrega" o "Transferencia Bancaria"');
            setIsSubmitting(false);
            return;
        }

        const isAuthenticated = !!getCurrentUser();

        // Preparar items para el backend
        const orderItems = cartItems.map(item => ({
            product_id: item.id,
            quantity: item.quantity
        }));

        let response;

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
         */
        const sendInvoiceEmail = async (order, orderItems) => {
            // Validate email before attempting to send
            const email = formData.email?.trim();
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
                    customerInfo: formData,
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
                    console.error('Invoice email API error:', errorData.message || res.statusText);
                    return false;
                }

                // Invoice email sent successfully
                return true;
            } catch (error) {
                console.error('Error sending invoice email:', error.message || error);
                return false;
            }
        };

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
        }    if (!response.ok) {
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
                        <h2 className="hero-title">Finalizar Pedido</h2>
                        <p className="hero-text">
                            <span className="hero-category-badge">CHECKOUT</span>
                            Completa tu información de envío y selecciona tu método de pago.
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
                                            <label>Nombre</label>
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
                                            <label>Apellidos</label>
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
                                    <div className="form-group" style={{marginBottom: '20px'}}>
                                        <label>Correo Electrónico</label>
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
                                </form>
                            )
                        )}

                        {step === 2 && (
                            <form id="step2-form" className="step-form step-form-shipping" onSubmit={(e) => {
                                e.preventDefault();
                                if (!mapData.selectedLocation) {
                                    setError('Por favor selecciona una ubicación en el mapa');
                                    return;
                                }
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
                                    <div className="form-group" style={{marginBottom: '15px'}}>
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

                                {/* Map Section - At the bottom */}
                                <div className="shipping-map-section">
                                    <div className="map-header">
                                        <h4>📍 Ubicación de Entrega</h4>
                                        <button
                                            type="button"
                                            onClick={getCurrentLocation}
                                            className="btn-location"
                                        >
                                            🧭 Mi Ubicación
                                        </button>
                                    </div>
                                    
                                    <div 
                                        ref={mapRef}
                                        className="shipping-map-container"
                                    />
                                    
                                    <div className="map-instructions">
                                        <p>🔍 Usa el buscador en el mapa para encontrar direcciones</p>
                                        <p>👆 Haz clic en cualquier punto del mapa para seleccionar</p>
                                        <p>📍 Arrastra el marcador rojo para ajustar la posición</p>
                                    </div>

                                    {/* Shipping Cost Card */}
                                    {mapData.distance && (
                                        <div className="shipping-cost-card">
                                            <div className="shipping-cost-header">
                                                <span>💵 Costo de Envío</span>
                                            </div>
                                            <div className="shipping-cost-details">
                                                <div className="shipping-cost-row">
                                                    <span>Distancia:</span>
                                                    <span className="shipping-distance">{mapData.distance.toFixed(2)} km</span>
                                                </div>
                                                <div className="shipping-cost-row total">
                                                    <span>Envío:</span>
                                                    <span className="shipping-price">{formatCurrency(mapData.shippingCost, currencyCode)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Shipping Rates Table */}
                                    <div className="shipping-rates-table">
                                        <h5>Tarifas de Envío</h5>
                                        <div className="rates-list">
                                            {PRICE_RANGES.map((range, index) => {
                                                const isActive = mapData.distance && 
                                                    mapData.distance <= range.maxDistance && 
                                                    (index === 0 || mapData.distance > PRICE_RANGES[index - 1].maxDistance);
                                                
                                                return (
                                                    <div 
                                                        key={index}
                                                        className={`rate-item ${isActive ? 'active' : ''}`}
                                                    >
                                                        <span className="rate-label">{range.label}</span>
                                                        <span className="rate-price">{formatCurrency(range.price, currencyCode)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
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
                                
                                <div className="payment-methods">
                                    <div 
                                        className={`payment-option ${formData.paymentMethod === 'cash' ? 'selected' : ''}`}
                                        onClick={() => setFormData({...formData, paymentMethod: 'cash'})}
                                    >
                                        <div className="payment-icon">💵</div>
                                        <div className="payment-info">
                                            <h4>Pago Contra Entrega</h4>
                                            <p>Paga en efectivo cuando recibas tu pedido</p>
                                        </div>
                                        <div className="payment-check">
                                            {formData.paymentMethod === 'cash' && '✓'}
                                        </div>
                                    </div>

                                    <div 
                                        className={`payment-option ${formData.paymentMethod === 'transfer' ? 'selected' : ''}`}
                                        onClick={() => setFormData({...formData, paymentMethod: 'transfer'})}
                                    >
                                        <div className="payment-icon">🏦</div>
                                        <div className="payment-info">
                                            <h4>Transferencia Bancaria</h4>
                                            <p>Transferencia o depósito bancario</p>
                                        </div>
                                        <div className="payment-check">
                                            {formData.paymentMethod === 'transfer' && '✓'}
                                        </div>
                                    </div>

                                    <div className="payment-option disabled">
                                        <div className="payment-icon">💳</div>
                                        <div className="payment-info">
                                            <h4>Pago en Línea</h4>
                                            <p>PayPal, Stripe, MercadoPago</p>
                                            <span className="badge-soon">Próximamente</span>
                                        </div>
                                    </div>

                                    <div className="payment-option disabled">
                                        <div className="payment-icon">💳</div>
                                        <div className="payment-info">
                                            <h4>Tarjeta de Crédito/Débito</h4>
                                            <p>Visa, MasterCard, American Express</p>
                                            <span className="badge-soon">Próximamente</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                        <div className="checkout-summary-column">
                            <div className="summary-card">
                                <h3>Tu Carrito</h3>
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
                    <button type="button" className="btn-next" onClick={() => setStep(4)}>
                        Siguiente <span className="btn-icon">→</span>
                    </button>
                )}

                {step === 4 && (
                    <button 
                        type="button" 
                        className="btn-confirm" 
                        onClick={handleSubmit} 
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Procesando...' : 'Confirmar Todo el Pedido'} <span className="btn-icon">✓</span>
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
