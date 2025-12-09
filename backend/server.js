// server/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { db, statements } = require('./database');
const app = express();

const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta_super_segura_cambiala_en_produccion';

// CORS con múltiples orígenes permitidos
const corsOptions = {
    origin: [
        'https://8smgkh0x-5173.use2.devtunnels.ms',
        'https://3mml836n-5001.use2.devtunnels.ms',
        'http://192.168.100.41:5173',
        'http://143.47.118.165:5173',
        'http://192.168.100.41:5001',
        'http://143.47.118.165:3000',
        'http://143.47.118.165',
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:5001'
        
	    
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Add these headers to all responses
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
});

// Ensure the 'public/images' directory exists before serving static files from it
const publicImagesPath = path.join(__dirname, 'images');
if (!fs.existsSync(publicImagesPath)) {
    fs.mkdirSync(publicImagesPath, { recursive: true });
}
app.use('/images', express.static(publicImagesPath));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- File Paths ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, publicImagesPath);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const imageFileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('¡Solo se permiten archivos de imagen!'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: imageFileFilter
});

// --- Helper Functions for Reading/Writing JSON ---
function loadJsonData(filePath, defaultValue = []) {
    try {
        if (fs.existsSync(filePath)) {
            const json = fs.readFileSync(filePath, 'utf-8');
            return json ? JSON.parse(json) : defaultValue;
        }
        return defaultValue;
    } catch (err) {
        console.error(`Error reading JSON from ${path.basename(filePath)}:`, err);
        return defaultValue;
    }
}

function saveJsonData(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
        console.error(`Error writing JSON to ${path.basename(filePath)}:`, err);
    }
}

// --- Middleware de Autenticación ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ message: 'Token de acceso requerido' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token inválido o expirado' });
        }
        req.user = user;
        next();
    });
};

// --- NUEVAS RUTAS DE AUTENTICACIÓN ---

/**
 * POST /api/auth/register
 * Registra un nuevo usuario
 */
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validación básica
        if (!name || !email || !password) {
            return res.status(400).json({ 
                message: 'Nombre, email y contraseña son requeridos' 
            });
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                message: 'Formato de email inválido' 
            });
        }

        // Validar longitud de contraseña
        if (password.length < 6) {
            return res.status(400).json({ 
                message: 'La contraseña debe tener al menos 6 caracteres' 
            });
        }

        // Verificar si el email ya existe
        const existingUser = statements.getUserByEmail.get(email.toLowerCase());
        if (existingUser) {
            return res.status(409).json({ 
                message: 'El email ya está registrado' 
            });
        }

        // Encriptar contraseña
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Crear nuevo usuario (not a guest)
        const result = statements.createUser.run(
            name.trim(),
            email.toLowerCase().trim(),
            hashedPassword,
            'customer',
            0  // is_guest = false (real customer account)
        );

        const newUserId = result.lastInsertRowid;
        const newUser = statements.getUserById.get(newUserId);

        // Generar token JWT
        const token = jwt.sign(
            { 
                id: newUser.id, 
                email: newUser.email,
                name: newUser.name,
                role: newUser.role 
            },
            JWT_SECRET,
            { expiresIn: '7d' } // Token válido por 7 días
        );

        // Respuesta sin contraseña
        const userResponse = {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            createdAt: newUser.created_at
        };

        console.log('Usuario registrado exitosamente:', userResponse);
        res.status(201).json({
            message: 'Usuario registrado exitosamente',
            user: userResponse,
            token
        });

    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ 
            message: 'Error interno del servidor' 
        });
    }
});

/**
 * POST /api/auth/login
 * Inicia sesión de usuario
 */
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validación básica
        if (!email || !password) {
            return res.status(400).json({ 
                message: 'Email y contraseña son requeridos' 
            });
        }

        // Buscar usuario por email
        const user = statements.getUserByEmail.get(email.toLowerCase());
        if (!user) {
            return res.status(401).json({ 
                message: 'Credenciales inválidas' 
            });
        }

        // Verificar si el usuario está activo
        if (!user.is_active) {
            return res.status(401).json({ 
                message: 'Cuenta desactivada. Contacta al soporte' 
            });
        }

        // Verificar contraseña
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ 
                message: 'Credenciales inválidas' 
            });
        }

        // Actualizar último login
        statements.updateLastLogin.run(user.id);

        // Generar token JWT
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email,
                name: user.name,
                role: user.role 
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Respuesta sin contraseña
        const userResponse = {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            street: user.street,
            sector: user.sector,
            city: user.city,
            country: user.country,
            role: user.role,
            createdAt: user.created_at,
            lastLogin: user.last_login
        };

        console.log('Usuario logueado exitosamente:', userResponse.email);
        res.json({
            message: 'Login exitoso',
            user: userResponse,
            token
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ 
            message: 'Error interno del servidor' 
        });
    }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
    try {
        const user = statements.getUserById.get(req.user.id);

        if (!user) {
            return res.status(404).json({ 
                message: 'Usuario no encontrado' 
            });
        }

        const userResponse = {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            street: user.street,
            sector: user.sector,
            city: user.city,
            country: user.country,
            role: user.role,
            createdAt: user.created_at,
            lastLogin: user.last_login
        };

        res.json(userResponse);
    } catch (error) {
        console.error('Error obteniendo perfil:', error);
        res.status(500).json({ 
            message: 'Error interno del servidor' 
        });
    }
});

app.put('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
        const { name, phone, street, sector, city, country, currentPassword, newPassword } = req.body;
        const user = statements.getUserById.get(req.user.id);

        if (!user) {
            return res.status(404).json({ 
                message: 'Usuario no encontrado' 
            });
        }

        // Actualizar datos de perfil
        statements.updateUser.run(
            name !== undefined ? name.trim() : user.name,
            phone !== undefined ? phone.trim() : (user.phone || ''),
            street !== undefined ? street.trim() : (user.street || ''),
            sector !== undefined ? sector.trim() : (user.sector || ''),
            city !== undefined ? city.trim() : (user.city || ''),
            country !== undefined ? country.trim() : (user.country || ''),
            user.id
        );

        // Cambiar contraseña si se proporciona
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ 
                    message: 'Contraseña actual requerida para cambiar contraseña' 
                });
            }

            const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isCurrentPasswordValid) {
                return res.status(400).json({ 
                    message: 'Contraseña actual incorrecta' 
                });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({ 
                    message: 'La nueva contraseña debe tener al menos 6 caracteres' 
                });
            }

            const hashedNewPassword = await bcrypt.hash(newPassword, 10);
            statements.updateUserPassword.run(hashedNewPassword, user.id);
        }

        // Get updated user
        const updatedUser = statements.getUserById.get(user.id);

        const userResponse = {
            id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            phone: updatedUser.phone,
            street: updatedUser.street,
            sector: updatedUser.sector,
            city: updatedUser.city,
            country: updatedUser.country,
            role: updatedUser.role,
            updatedAt: updatedUser.updated_at
        };

        res.json({
            message: 'Perfil actualizado exitosamente',
            user: userResponse
        });

    } catch (error) {
        console.error('Error actualizando perfil:', error);
        res.status(500).json({ 
            message: 'Error interno del servidor' 
        });
    }
});

/**
 * POST /api/auth/logout
 * Logout (principalmente para limpiar datos del lado del cliente)
 */
app.post('/api/auth/logout', authenticateToken, (req, res) => {
    // En una implementación real, podrías mantener una lista negra de tokens
    // Por ahora, simplemente confirmamos el logout
    res.json({ 
        message: 'Logout exitoso' 
    });
});

// --- RUTAS EXISTENTES DE PRODUCTOS, CARRITO Y ÓRDENES ---
// (Mantener todas las rutas existentes...)

// == Products ==
app.get('/api/products', (req, res) => {
    const categoryFilter = req.query.category;
    try {
        let products;
        if (categoryFilter && categoryFilter.toLowerCase() !== 'todos') {
            products = statements.getProductsByCategory.all(categoryFilter);
        } else {
            products = statements.getAllProducts.all();
        }

        // Add images to each product and migrate legacy images
        const productsWithImages = products.map(product => {
            let images = statements.getProductImages.all(product.id);
            
            // Migrate legacy image to product_images table if needed
            if (images.length === 0 && product.image) {
                statements.addProductImage.run(product.id, product.image);
                images = statements.getProductImages.all(product.id);
            }
            
            return { ...product, images };
        });

        res.json(productsWithImages);
    } catch (error) {
        console.error('Error obteniendo productos:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.get('/api/products/:id', (req, res) => {
    const productId = parseInt(req.params.id, 10);
    try {
        const product = statements.getProductById.get(productId);

        if (product) {
            let images = statements.getProductImages.all(productId);
            
            // Migrate legacy image to product_images table if needed
            if (images.length === 0 && product.image) {
                const result = statements.addProductImage.run(productId, product.image);
                images = statements.getProductImages.all(productId);
                
                // Optionally clear the legacy image column after migration
                // statements.updateProduct.run(product.name, product.description, product.price, product.category, product.stock, null, productId);
            }
            
            res.json({ ...product, images });
        } else {
            res.status(404).json({ message: 'Producto no encontrado' });
        }
    } catch (error) {
        console.error('Error obteniendo producto:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.post('/api/products', upload.array('images', 10), (req, res) => {
    try {
        const { name, description, price, category, stock } = req.body;

        if (!name || !price || !category || stock === undefined) {
            return res.status(400).json({ message: 'Faltan campos requeridos (nombre, precio, categoría, stock).' });
        }
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'Se requiere al menos una imagen.' });
        }

        const result = statements.createProduct.run(
            name,
            description || '',
            parseFloat(price),
            category,
            parseInt(stock, 10)
        );

        const productId = result.lastInsertRowid;

        // Add images
        for (const file of req.files) {
            statements.addProductImage.run(productId, `/images/${file.filename}`);
        }

        const newProduct = statements.getProductById.get(productId);
        const images = statements.getProductImages.all(productId);

        console.log('Producto guardado correctamente:', { ...newProduct, images });
        res.status(201).json({ ...newProduct, images });

    } catch (err) {
        console.error('Error al guardar producto:', err);
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ message: `Error de Multer: ${err.message}` });
        } else if (err.message === '¡Solo se permiten archivos de imagen!') {
            return res.status(400).json({ message: err.message });
        }
        res.status(500).json({ message: 'Error interno del servidor al guardar el producto.' });
    }
});

app.delete('/api/products/:id', (req, res) => {
    const productId = parseInt(req.params.id, 10);
    try {
        // Delete all images first
        statements.deleteAllProductImages.run(productId);

        const result = statements.deleteProduct.run(productId);

        if (result.changes > 0) {
            res.json({ message: 'Producto eliminado exitosamente' });
        } else {
            res.status(404).json({ message: 'Producto no encontrado para eliminar' });
        }
    } catch (error) {
        console.error('Error eliminando producto:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.put('/api/products/:id', (req, res) => {
    const productId = parseInt(req.params.id, 10);
    const updatedData = req.body;
    try {
        const existingProduct = statements.getProductById.get(productId);

        if (!existingProduct) {
            return res.status(404).json({ message: 'Producto no encontrado para actualizar' });
        }

        statements.updateProduct.run(
            updatedData.name || existingProduct.name,
            updatedData.description !== undefined ? updatedData.description : existingProduct.description,
            updatedData.price !== undefined ? parseFloat(updatedData.price) : existingProduct.price,
            updatedData.category || existingProduct.category,
            updatedData.stock !== undefined ? parseInt(updatedData.stock, 10) : existingProduct.stock,
            productId
        );

        const updatedProduct = statements.getProductById.get(productId);
        const images = statements.getProductImages.all(productId);

        console.log('Producto actualizado:', { ...updatedProduct, images });
        res.json({ ...updatedProduct, images });
    } catch (error) {
        console.error('Error actualizando producto:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Product Image Management
app.post('/api/products/:id/images', upload.array('images', 10), (req, res) => {
    const productId = parseInt(req.params.id, 10);
    try {
        const product = statements.getProductById.get(productId);
        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No se recibió ningún archivo de imagen.' });
        }

        // Add images
        for (const file of req.files) {
            statements.addProductImage.run(productId, `/images/${file.filename}`);
        }

        const images = statements.getProductImages.all(productId);
        res.status(201).json(images);
    } catch (err) {
        console.error('Error agregando imágenes:', err);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.delete('/api/products/:id/images/:imageId', (req, res) => {
    const productId = parseInt(req.params.id, 10);
    const imageId = parseInt(req.params.imageId, 10);
    try {
        const product = statements.getProductById.get(productId);
        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        const result = statements.deleteProductImage.run(imageId, productId);

        if (result.changes > 0) {
            const images = statements.getProductImages.all(productId);
            res.json({ message: 'Imagen eliminada exitosamente', images });
        } else {
            res.status(404).json({ message: 'Imagen no encontrada' });
        }
    } catch (error) {
        console.error('Error eliminando imagen:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// == Cart == (Rutas protegidas para usuarios autenticados)

app.get('/api/cart', authenticateToken, (req, res) => {
    try {
        const cart = statements.getCartByUserId.all(req.user.id);
        res.json(cart);
    } catch (error) {
        console.error('Error obteniendo carrito:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.post('/api/cart', authenticateToken, (req, res) => {
    const { productId, quantity } = req.body;

    if (typeof productId !== 'number' || typeof quantity !== 'number' || quantity <= 0) {
        return res.status(400).json({ message: 'ID de producto o cantidad inválida.' });
    }

    try {
        const product = statements.getProductById.get(productId);

        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }
        if (product.stock <= 0) {
            return res.status(400).json({ message: `Producto "${product.name}" está agotado.` });
        }

        const existingItem = statements.getCartItem.get(req.user.id, productId);

        if (existingItem) {
            const newQuantity = existingItem.quantity + quantity;
            if (newQuantity > product.stock) {
                return res.status(400).json({
                    message: `No hay suficiente stock para ${product.name}. Stock disponible: ${product.stock}, en carrito ya tiene: ${existingItem.quantity}`,
                    availableStock: product.stock,
                    currentCartQuantity: existingItem.quantity
                });
            }
            statements.updateCartItem.run(newQuantity, req.user.id, productId);
        } else {
            if (quantity > product.stock) {
                return res.status(400).json({
                    message: `No hay suficiente stock para ${product.name}. Stock disponible: ${product.stock}`,
                    availableStock: product.stock
                });
            }
            statements.addToCart.run(req.user.id, productId, quantity);
        }

        const cart = statements.getCartByUserId.all(req.user.id);
        console.log('Carrito actualizado para usuario', req.user.id, ':', cart);
        res.status(201).json(cart);
    } catch (error) {
        console.error('Error agregando al carrito:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.delete('/api/cart/:productId', authenticateToken, (req, res) => {
    const productId = parseInt(req.params.productId, 10);
    try {
        const result = statements.removeFromCart.run(req.user.id, productId);

        if (result.changes > 0) {
            const cart = statements.getCartByUserId.all(req.user.id);
            console.log('Item eliminado del carrito del usuario', req.user.id, ':', cart);
            res.json(cart);
        } else {
            res.status(404).json({ message: 'Item no encontrado en el carrito' });
        }
    } catch (error) {
        console.error('Error eliminando del carrito:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// == Orders == 

// Get all orders (admin only)
app.get('/api/orders', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado' });
    }

    try {
        const orders = db.prepare(`
            SELECT 
                o.*, 
                COALESCE(u.name, o.customer_name) as customer_name, 
                COALESCE(u.email, o.customer_email) as customer_email
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            ORDER BY o.created_at DESC
        `).all();
        res.json(orders);
    } catch (error) {
        console.error('Error obteniendo órdenes:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Get order details with items
app.get('/api/orders/:id', authenticateToken, (req, res) => {
    const orderId = parseInt(req.params.id, 10);

    try {
        // Get order with customer information
        const getOrderWithCustomer = db.prepare(`
            SELECT 
                o.*, 
                COALESCE(u.name, o.customer_name) as customer_name, 
                COALESCE(u.email, o.customer_email) as customer_email
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            WHERE o.id = ?
        `);
        
        const order = getOrderWithCustomer.get(orderId);
        
        if (!order) {
            return res.status(404).json({ message: 'Orden no encontrada' });
        }

        // Check authorization
        if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
            return res.status(403).json({ message: 'Acceso denegado' });
        }

        const orderItems = statements.getOrderItems.all(orderId);
        
        res.json({
            ...order,
            items: orderItems
        });
    } catch (error) {
        console.error('Error obteniendo orden:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Create new order
app.post('/api/orders', authenticateToken, (req, res) => {
    const { shipping_address, items, payment_method, customer_name, customer_email, customer_phone, shipping_street, shipping_city, shipping_postal_code, shipping_sector } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ message: 'La orden debe tener al menos un producto' });
    }

    if (!shipping_street || !shipping_city) {
        return res.status(400).json({ message: 'Se requiere dirección completa (calle, ciudad)' });
    }

    try {
        // Calculate total
        let total = 0;
        for (const item of items) {
            const product = statements.getProductById.get(item.product_id);
            if (!product) {
                return res.status(404).json({ message: `Producto ${item.product_id} no encontrado` });
            }
            if (product.stock < item.quantity) {
                return res.status(400).json({ 
                    message: `Stock insuficiente para ${product.name}` 
                });
            }
            total += product.price * item.quantity;
        }

        // Create order with structured address fields
        const paymentMethodValue = payment_method || 'cash';
        // Keep shipping_address for backward compatibility (can be used for notes)
        const legacyAddress = shipping_address || `${shipping_street}, ${shipping_sector || ''}, ${shipping_city}`;
        
        const resolvedCustomerName = (customer_name && customer_name.trim()) || req.user.name;
        const resolvedCustomerEmail = (customer_email || req.user.email || '').trim().toLowerCase();
        const resolvedCustomerPhone = customer_phone ? customer_phone.trim() : '';

        const orderResult = statements.createOrder.run(
            req.user.id, 
            total, 
            legacyAddress,
            paymentMethodValue,
            resolvedCustomerName,
            resolvedCustomerEmail,
            resolvedCustomerPhone,
            shipping_street,
            shipping_city,
            shipping_postal_code || '',
            shipping_sector || ''
        );
        const orderId = orderResult.lastInsertRowid;

        // Add order items and update stock
        for (const item of items) {
            const product = statements.getProductById.get(item.product_id);
            statements.addOrderItem.run(orderId, item.product_id, item.quantity, product.price);
            
            // Update stock
            const newStock = product.stock - item.quantity;
            statements.updateProduct.run(
                product.name,
                product.description,
                product.price,
                product.category,
                newStock,
                item.product_id
            );
        }

        // Clear cart
        statements.clearCart.run(req.user.id);

        const order = statements.getOrderById.get(orderId);
        console.log('Orden creada:', order);
        res.status(201).json(order);
    } catch (error) {
        console.error('Error creando orden:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Create order as guest (no authentication required)
app.post('/api/orders/guest', (req, res) => {
    const { shipping_address, items, customer_info, payment_method, shipping_street, shipping_city, shipping_postal_code, shipping_sector } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ message: 'La orden debe tener al menos un producto' });
    }

    if (!shipping_street || !shipping_city) {
        return res.status(400).json({ message: 'Se requiere dirección completa (calle, ciudad)' });
    }

    if (!customer_info || !customer_info.email) {
        return res.status(400).json({ message: 'Se requiere información del cliente (email)' });
    }

    try {
        // Calculate total
        let total = 0;
        for (const item of items) {
            const product = statements.getProductById.get(item.product_id);
            if (!product) {
                return res.status(404).json({ message: `Producto ${item.product_id} no encontrado` });
            }
            if (product.stock < item.quantity) {
                return res.status(400).json({ 
                    message: `Stock insuficiente para ${product.name}` 
                });
            }
            total += product.price * item.quantity;
        }

        // Create order with structured address fields
        const paymentMethodValue = payment_method || 'cash';
        // Keep shipping_address for backward compatibility or additional notes
        const legacyAddress = shipping_address || `${shipping_street}, ${shipping_sector || ''}, ${shipping_city}`;
        const guestName = (customer_info.name && customer_info.name.trim()) || 'Cliente Invitado';
        const guestEmail = customer_info.email.trim().toLowerCase();
        const guestPhone = customer_info.phone ? customer_info.phone.trim() : '';

        const orderResult = statements.createOrder.run(
            null,
            total,
            legacyAddress,
            paymentMethodValue,
            guestName,
            guestEmail,
            guestPhone,
            shipping_street,
            shipping_city,
            shipping_postal_code || '',
            shipping_sector || ''
        );
        const orderId = orderResult.lastInsertRowid;

        // Add order items and update stock
        for (const item of items) {
            const product = statements.getProductById.get(item.product_id);
            statements.addOrderItem.run(orderId, item.product_id, item.quantity, product.price);
            
            // Update stock
            const newStock = product.stock - item.quantity;
            statements.updateProduct.run(
                product.name,
                product.description,
                product.price,
                product.category,
                newStock,
                item.product_id
            );
        }

        const order = statements.getOrderById.get(orderId);
        console.log('Orden de invitado creada:', order);
        res.status(201).json(order);
    } catch (error) {
        console.error('Error creando orden de invitado:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Update order status (admin only)
app.put('/api/orders/:id/status', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado' });
    }

    const orderId = parseInt(req.params.id, 10);
    const { status } = req.body;

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
            message: `Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}` 
        });
    }

    try {
        const result = statements.updateOrderStatus.run(status, orderId);
        
        if (result.changes > 0) {
            const order = statements.getOrderById.get(orderId);
            console.log('Estado de orden actualizado:', order);
            res.json({ message: 'Estado actualizado exitosamente', order });
        } else {
            res.status(404).json({ message: 'Orden no encontrada' });
        }
    } catch (error) {
        console.error('Error actualizando estado:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Track order by ID (public - no authentication required)
app.get('/api/orders/track/:id', (req, res) => {
    const orderId = parseInt(req.params.id, 10);

    try {
        const getOrderWithCustomer = db.prepare(`
            SELECT 
                o.*, 
                COALESCE(u.name, o.customer_name) as customer_name, 
                COALESCE(u.email, o.customer_email) as customer_email
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            WHERE o.id = ?
        `);
        
        const order = getOrderWithCustomer.get(orderId);
        
        if (!order) {
            return res.status(404).json({ message: 'Orden no encontrada' });
        }

        // Get order items
        const orderItems = statements.getOrderItems.all(orderId);
        
        res.json({
            ...order,
            items: orderItems
        });
    } catch (error) {
        console.error('Error buscando orden:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Track orders by email (public - no authentication required)
app.get('/api/orders/track/email/:email', (req, res) => {
    const email = req.params.email.trim().toLowerCase();

    try {
        const getOrdersByEmail = db.prepare(`
            SELECT 
                o.*,
                COALESCE(u.name, o.customer_name) as customer_name,
                COALESCE(u.email, o.customer_email) as customer_email
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            WHERE LOWER(o.customer_email) = ? OR (u.email IS NOT NULL AND LOWER(u.email) = ?)
            ORDER BY o.created_at DESC
        `);
        
        const orders = getOrdersByEmail.all(email, email);
        
        if (!orders || orders.length === 0) {
            return res.status(404).json({ message: 'No se encontraron órdenes' });
        }

        const ordersWithItems = orders.map(order => ({
            ...order,
            items: statements.getOrderItems.all(order.id)
        }));
        
        res.json(ordersWithItems);
    } catch (error) {
        console.error('Error buscando órdenes por email:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// --- RUTAS DE ADMINISTRACIÓN DE USUARIOS (Opcional) ---

app.get('/api/users', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado' });
    }

    try {
        // Get all users from database
        const users = db.prepare('SELECT id, name, email, role, is_active, created_at, updated_at, last_login FROM users ORDER BY created_at DESC').all();
        res.json(users);
    } catch (error) {
        console.error('Error obteniendo usuarios:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Update user role
app.put('/api/users/:id/role', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado' });
    }

    const userId = parseInt(req.params.id, 10);
    const { role } = req.body;

    if (!role || !['admin', 'customer'].includes(role)) {
        return res.status(400).json({ message: 'Rol inválido. Debe ser "admin" o "customer"' });
    }

    // Prevent self-demotion from admin
    if (userId === req.user.id && role === 'customer') {
        return res.status(400).json({ message: 'No puedes cambiar tu propio rol de administrador' });
    }

    try {
        const result = db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(role, userId);
        
        if (result.changes > 0) {
            const updatedUser = db.prepare('SELECT id, name, email, role, is_active, created_at, updated_at, last_login FROM users WHERE id = ?').get(userId);
            console.log('Rol de usuario actualizado:', updatedUser);
            res.json({ message: 'Rol actualizado exitosamente', user: updatedUser });
        } else {
            res.status(404).json({ message: 'Usuario no encontrado' });
        }
    } catch (error) {
        console.error('Error actualizando rol de usuario:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Toggle user active status
app.put('/api/users/:id/status', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado' });
    }

    const userId = parseInt(req.params.id, 10);
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
        return res.status(400).json({ message: 'Estado inválido. Debe ser true o false' });
    }

    // Prevent self-deactivation
    if (userId === req.user.id && !is_active) {
        return res.status(400).json({ message: 'No puedes desactivar tu propia cuenta' });
    }

    try {
        const result = db.prepare('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(is_active ? 1 : 0, userId);
        
        if (result.changes > 0) {
            const updatedUser = db.prepare('SELECT id, name, email, role, is_active, created_at, updated_at, last_login FROM users WHERE id = ?').get(userId);
            console.log('Estado de usuario actualizado:', updatedUser);
            res.json({ message: 'Estado actualizado exitosamente', user: updatedUser });
        } else {
            res.status(404).json({ message: 'Usuario no encontrado' });
        }
    } catch (error) {
        console.error('Error actualizando estado de usuario:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// --- Email Configuration ---
const transporter = nodemailer.createTransport({
    service: 'gmail', // O tu proveedor de preferencia
    auth: {
        user: process.env.EMAIL_USER || 'tu_email@gmail.com',
        pass: process.env.EMAIL_PASS || 'tu_app_password'
    }
});

// --- Verification Routes ---

// Enviar código de verificación
app.post('/api/verification/send-code', async (req, res) => {
    const { email, purpose } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email es requerido' });
    }

    // Generar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Expiración en 10 minutos
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    try {
        // Eliminar códigos anteriores para este email y propósito
        statements.deleteVerificationCodes.run(email, purpose || 'general');

        // Guardar nuevo código
        statements.createVerificationCode.run(email, code, purpose || 'general', expiresAt);

        // Enviar email
        const mailOptions = {
            from: process.env.EMAIL_USER || 'noreply@techstore.com',
            to: email,
            subject: 'Tu código de verificación - TechStore',
            text: `Tu código de verificación es: ${code}. Este código expira en 10 minutos.`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #007bff;">Código de Verificación</h2>
                    <p>Hola,</p>
                    <p>Tu código de verificación para TechStore es:</p>
                    <h1 style="letter-spacing: 5px; background: #f4f4f4; padding: 10px; display: inline-block; border-radius: 5px;">${code}</h1>
                    <p>Este código expira en 10 minutos.</p>
                    <p>Si no solicitaste este código, puedes ignorar este correo.</p>
                </div>
            `
        };

        // Intentar enviar correo
        try {
            await transporter.sendMail(mailOptions);
        } catch (emailError) {
            console.error('Error enviando email:', emailError);
            return res.status(500).json({ message: 'Error al enviar el correo de verificación' });
        }

        res.json({ success: true, message: 'Código enviado correctamente' });

    } catch (error) {
        console.error('Error generando código:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Verificar código
app.post('/api/verification/verify-code', (req, res) => {
    const { email, code, purpose } = req.body;

    if (!email || !code) {
        return res.status(400).json({ message: 'Email y código son requeridos' });
    }

    try {
        const record = statements.getVerificationCode.get(email, code, purpose || 'general');

        if (record) {
            // Código válido, eliminarlo para que no se use de nuevo
            statements.deleteVerificationCodes.run(email, purpose || 'general');
            res.json({ success: true, message: 'Código verificado correctamente' });
        } else {
            res.status(400).json({ message: 'Código inválido o expirado' });
        }
    } catch (error) {
        console.error('Error verificando código:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// --- Start Server ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log(`Acceso en red local: http://149.47.118.165:{PORT}`);
    console.log(`Acceso en red local: http://149.47.118.165:{PORT}`);
    console.log('Base de datos SQLite inicializada correctamente');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Cerrando servidor...');
    db.close();
    process.exit(0);
});



// Agregar esta ruta a tu server.js después de las rutas existentes del carrito

app.put('/api/cart/:productId', authenticateToken, (req, res) => {
    const productId = parseInt(req.params.productId, 10);
    const { quantity } = req.body;

    // Validaciones
    if (typeof quantity !== 'number' || quantity < 0) {
        return res.status(400).json({ message: 'Cantidad inválida.' });
    }

    try {
        // Verificar que el producto existe
        const product = statements.getProductById.get(productId);
        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        // Verificar que el item existe en el carrito
        const existingItem = statements.getCartItem.get(req.user.id, productId);
        if (!existingItem) {
            return res.status(404).json({ message: 'Producto no encontrado en el carrito' });
        }

        // Si la cantidad es 0, eliminar el item
        if (quantity === 0) {
            statements.removeFromCart.run(req.user.id, productId);
        } else {
            // Verificar stock disponible
            if (quantity > product.stock) {
                return res.status(400).json({
                    message: `No hay suficiente stock para ${product.name}. Stock disponible: ${product.stock}`,
                    availableStock: product.stock
                });
            }

            // Actualizar cantidad
            statements.updateCartItem.run(quantity, req.user.id, productId);
        }

        const cart = statements.getCartByUserId.all(req.user.id);
        console.log('Carrito actualizado para usuario', req.user.id, ':', cart);
        res.json(cart);
    } catch (error) {
        console.error('Error actualizando carrito:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.delete('/api/cart', authenticateToken, (req, res) => {
    try {
        statements.clearCart.run(req.user.id);
        console.log('Carrito vaciado para usuario', req.user.id);
        res.json({ message: 'Carrito vaciado exitosamente', cart: [] });
    } catch (error) {
        console.error('Error vaciando carrito:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

