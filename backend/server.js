// server/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const { statements } = require('./database');
const app = express();

// --- Security Middleware ---
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Permitir cargar imágenes desde el frontend
    contentSecurityPolicy: false, // Desactivar si causa problemas con el frontend en desarrollo
}));

const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('❌ ERROR CRÍTICO: JWT_SECRET no está definido en el archivo .env.');
    console.error('El servidor no puede iniciar sin una clave secreta para los tokens JWT por motivos de seguridad.');
    process.exit(1);
}

const FINAL_JWT_SECRET = JWT_SECRET;

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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Add these headers to all responses
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (corsOptions.origin.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// --- Rate Limiting ---
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // Limitar cada IP a 10 peticiones por ventana
    message: { message: 'Demasiados intentos desde esta IP, por favor intenta de nuevo en 15 minutos' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === 'OPTIONS', // No contar preflights en el límite
});

// Aplicar limitador a rutas sensibles
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/verification/send-code', authLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- File Paths ---
const storage = multer.memoryStorage();

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

function generateOrderNumber(id) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    const idPadded = id.toString().padStart(5, '0');
    return `W-${dateStr}-${idPadded}`;
}

// --- Middleware de Autenticación ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ message: 'Token de acceso requerido' });
    }

    jwt.verify(token, FINAL_JWT_SECRET, (err, user) => {
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
        const { name, email, password, code } = req.body;

        // Validación básica
        if (!name || !email || !password || !code) {
            return res.status(400).json({ 
                message: 'Nombre, email, contraseña y código de verificación son requeridos' 
            });
        }

        // Validar código de verificación
        const verificationRecord = await statements.getVerificationCode(email.toLowerCase(), code, 'register');
        if (!verificationRecord) {
            return res.status(400).json({ 
                message: 'Código de verificación inválido o expirado' 
            });
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                message: 'Formato de email inválido' 
            });
        }

        // Validar longitud y complejidad de contraseña
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({ 
                message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número' 
            });
        }

        // Verificar si el email ya existe
        const existingUser = await statements.getUserByEmail(email.toLowerCase());
        if (existingUser) {
            return res.status(409).json({ 
                message: 'El email ya está registrado' 
            });
        }

        // Encriptar contraseña
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Crear nuevo usuario (not a guest)
        const result = await statements.createUser(
            name.trim(),
            email.toLowerCase().trim(),
            hashedPassword,
            'customer',
            0  // is_guest = false (real customer account)
        );

        const newUserId = result.lastInsertRowid;
        const newUser = await statements.getUserById(newUserId);

        // Eliminar el código de verificación usado
        await statements.deleteVerificationCodes(email.toLowerCase(), 'register');

        // Generar token JWT
        const token = jwt.sign(
            { 
                id: newUser.id, 
                email: newUser.email,
                name: newUser.name,
                role: newUser.role 
            },
            FINAL_JWT_SECRET,
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
        const user = await statements.getUserByEmail(email.toLowerCase());
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
        await statements.updateLastLogin(user.id);

        // Generar token JWT
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email,
                name: user.name,
                role: user.role 
            },
            FINAL_JWT_SECRET,
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

/**
 * POST /api/auth/forgot-password
 * Envía un código de verificación para restablecer la contraseña
 */
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email es requerido' });
    }

    try {
        const user = await statements.getUserByEmail(email.toLowerCase());
        if (!user) {
            // Por seguridad, no revelamos si el email existe o no
            return res.json({ 
                success: true, 
                message: 'Si el email está registrado, recibirás un código de verificación' 
            });
        }

        // Generar código de 6 dígitos
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        await statements.deleteVerificationCodes(email.toLowerCase(), 'password_reset');
        await statements.createVerificationCode(email.toLowerCase(), code, 'password_reset', expiresAt);

        const mailOptions = {
            from: process.env.EMAIL_USER || 'noreply@techstore.com',
            to: email,
            subject: 'Restablecer contraseña - TechStore',
            text: `Tu código para restablecer la contraseña es: ${code}. Expira en 10 minutos.`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #007bff;">Restablecer Contraseña</h2>
                    <p>Has solicitado restablecer tu contraseña en TechStore.</p>
                    <p>Tu código de verificación es:</p>
                    <h1 style="letter-spacing: 5px; background: #f4f4f4; padding: 10px; display: inline-block; border-radius: 5px;">${code}</h1>
                    <p>Este código expira en 10 minutos.</p>
                    <p>Si no solicitaste esto, puedes ignorar este correo.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Código enviado correctamente' });

    } catch (error) {
        console.error('Error en forgot-password:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

/**
 * POST /api/auth/reset-password
 * Restablece la contraseña usando un código de verificación
 */
app.post('/api/auth/reset-password', async (req, res) => {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
        return res.status(400).json({ 
            message: 'Email, código y nueva contraseña son requeridos' 
        });
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({ 
            message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número' 
        });
    }

    try {
        const verificationRecord = await statements.getVerificationCode(email.toLowerCase(), code, 'password_reset');
        if (!verificationRecord) {
            return res.status(400).json({ 
                message: 'Código de verificación inválido o expirado' 
            });
        }

        const user = await statements.getUserByEmail(email.toLowerCase());
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await statements.updateUserPassword(hashedPassword, user.id);
        await statements.deleteVerificationCodes(email.toLowerCase(), 'password_reset');

        res.json({ success: true, message: 'Contraseña actualizada correctamente' });

    } catch (error) {
        console.error('Error en reset-password:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const user = await statements.getUserById(req.user.id);

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
        const user = await statements.getUserById(req.user.id);

        if (!user) {
            return res.status(404).json({ 
                message: 'Usuario no encontrado' 
            });
        }

        // Actualizar datos de perfil
        await statements.updateUser(
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
            await statements.updateUserPassword(hashedNewPassword, user.id);
        }

        // Get updated user
        const updatedUser = await statements.getUserById(user.id);

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
app.get('/api/products', async (req, res) => {
    const categoryFilter = req.query.category;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';

    try {
        // Use paginated function
        const { data: products, total } = await statements.getProductsPaginated(
            page, 
            limit, 
            search, 
            categoryFilter && categoryFilter.toLowerCase() !== 'todos' ? categoryFilter : 'all'
        );

        // Add images to each product and migrate legacy images
        const productsWithImages = await Promise.all(products.map(async (product) => {
            let images = await statements.getProductImages(product.id);
            
            // Migrate legacy image to product_images table if needed
            if (images.length === 0 && product.image) {
                await statements.addProductImage(product.id, product.image);
                images = await statements.getProductImages(product.id);
            }
            
            return { 
                ...product, 
                images,
                image: images.length > 0 ? images[0].image_path : product.image
            };
        }));

        res.json({
            data: productsWithImages,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error obteniendo productos:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.get('/api/products/:id', async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    try {
        const product = await statements.getProductById(productId);

        if (product) {
            let images = await statements.getProductImages(productId);
            
            // Migrate legacy image to product_images table if needed
            if (images.length === 0 && product.image) {
                await statements.addProductImage(productId, product.image);
                images = await statements.getProductImages(productId);
            }
            
            res.json({ 
                ...product, 
                images,
                image: images.length > 0 ? images[0].image_path : product.image
            });
        } else {
            res.status(404).json({ message: 'Producto no encontrado' });
        }
    } catch (error) {
        console.error('Error obteniendo producto:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.post('/api/products', upload.array('images', 10), async (req, res) => {
    try {
        const { name, description, price, category, stock } = req.body;

        if (!name || !price || !category || stock === undefined) {
            return res.status(400).json({ message: 'Faltan campos requeridos (nombre, precio, categoría, stock).' });
        }
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'Se requiere al menos una imagen.' });
        }

        const result = await statements.createProduct(
            name,
            description || '',
            parseFloat(price),
            category,
            parseInt(stock, 10)
        );

        const productId = result.lastInsertRowid;

        // Add images to Supabase Storage
        for (const file of req.files) {
            const publicUrl = await statements.uploadImage(file);
            await statements.addProductImage(productId, publicUrl);
        }

        const newProduct = await statements.getProductById(productId);
        const images = await statements.getProductImages(productId);

        const productWithImage = {
            ...newProduct,
            images,
            image: images.length > 0 ? images[0].image_path : newProduct.image
        };

        console.log('Producto guardado correctamente:', productWithImage);
        res.status(201).json(productWithImage);

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

app.delete('/api/products/:id', async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    try {
        // Delete all images first
        await statements.deleteAllProductImages(productId);

        await statements.deleteProduct(productId);

        res.json({ message: 'Producto eliminado exitosamente' });
    } catch (error) {
        console.error('Error eliminando producto:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.put('/api/products/:id', async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    const updatedData = req.body;
    try {
        const existingProduct = await statements.getProductById(productId);

        if (!existingProduct) {
            return res.status(404).json({ message: 'Producto no encontrado para actualizar' });
        }

        await statements.updateProduct(
            updatedData.name || existingProduct.name,
            updatedData.description !== undefined ? updatedData.description : existingProduct.description,
            updatedData.price !== undefined ? parseFloat(updatedData.price) : existingProduct.price,
            updatedData.category || existingProduct.category,
            updatedData.stock !== undefined ? parseInt(updatedData.stock, 10) : existingProduct.stock,
            productId
        );

        const updatedProduct = await statements.getProductById(productId);
        const images = await statements.getProductImages(productId);

        const productWithImage = {
            ...updatedProduct,
            images,
            image: images.length > 0 ? images[0].image_path : updatedProduct.image
        };

        console.log('Producto actualizado:', productWithImage);
        res.json(productWithImage);
    } catch (error) {
        console.error('Error actualizando producto:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Product Image Management
app.post('/api/products/:id/images', upload.array('images', 10), async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    try {
        const product = await statements.getProductById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No se recibió ningún archivo de imagen.' });
        }

        // Add images to Supabase Storage
        for (const file of req.files) {
            const publicUrl = await statements.uploadImage(file);
            await statements.addProductImage(productId, publicUrl);
        }

        const images = await statements.getProductImages(productId);
        res.status(201).json(images);
    } catch (err) {
        console.error('Error agregando imágenes:', err);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.delete('/api/products/:id/images/:imageId', async (req, res) => {
    const productId = parseInt(req.params.id, 10);
    const imageId = parseInt(req.params.imageId, 10);
    try {
        const product = await statements.getProductById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        await statements.deleteProductImage(imageId, productId);

        const images = await statements.getProductImages(productId);
        res.json({ message: 'Imagen eliminada exitosamente', images });
    } catch (error) {
        console.error('Error eliminando imagen:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// == Cart == (Rutas protegidas para usuarios autenticados)

app.get('/api/cart', authenticateToken, async (req, res) => {
    try {
        const cart = await statements.getCartByUserId(req.user.id);
        res.json(cart);
    } catch (error) {
        console.error('Error obteniendo carrito:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.post('/api/cart', authenticateToken, async (req, res) => {
    const { productId, quantity } = req.body;

    if (typeof productId !== 'number' || typeof quantity !== 'number' || quantity <= 0) {
        return res.status(400).json({ message: 'ID de producto o cantidad inválida.' });
    }

    try {
        const product = await statements.getProductById(productId);

        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }
        if (product.stock <= 0) {
            return res.status(400).json({ message: `Producto "${product.name}" está agotado.` });
        }

        const existingItem = await statements.getCartItem(req.user.id, productId);

        if (existingItem) {
            const newQuantity = existingItem.quantity + quantity;
            if (newQuantity > product.stock) {
                return res.status(400).json({
                    message: `No hay suficiente stock para ${product.name}. Stock disponible: ${product.stock}, en carrito ya tiene: ${existingItem.quantity}`,
                    availableStock: product.stock,
                    currentCartQuantity: existingItem.quantity
                });
            }
            await statements.updateCartItem(newQuantity, req.user.id, productId);
        } else {
            if (quantity > product.stock) {
                return res.status(400).json({
                    message: `No hay suficiente stock para ${product.name}. Stock disponible: ${product.stock}`,
                    availableStock: product.stock
                });
            }
            await statements.addToCart(req.user.id, productId, quantity);
        }

        const cart = await statements.getCartByUserId(req.user.id);
        console.log('Carrito actualizado para usuario', req.user.id, ':', cart);
        res.status(201).json(cart);
    } catch (error) {
        console.error('Error agregando al carrito:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.delete('/api/cart/:productId', authenticateToken, async (req, res) => {
    const productId = parseInt(req.params.productId, 10);
    try {
        await statements.removeFromCart(req.user.id, productId);

        const cart = await statements.getCartByUserId(req.user.id);
        console.log('Item eliminado del carrito del usuario', req.user.id, ':', cart);
        res.json(cart);
    } catch (error) {
        console.error('Error eliminando del carrito:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// == Orders == 

// Get all orders (admin only)
app.get('/api/orders', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const status = req.query.status || 'all';
    const paymentType = req.query.paymentType || 'all';
    const type = req.query.type || 'all';

    try {
        const { data: orders, total } = await statements.getOrdersPaginated(page, limit, search, status, paymentType, type);
        
        res.json({
            data: orders,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error obteniendo órdenes:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Get current user's orders
app.get('/api/orders/my', authenticateToken, async (req, res) => {
    try {
        const orders = await statements.getOrdersByUserId(req.user.id);
        
        const ordersWithItems = await Promise.all(orders.map(async (order) => ({
            ...order,
            items: await statements.getOrderItems(order.id)
        })));
        
        res.json(ordersWithItems);
    } catch (error) {
        console.error('Error obteniendo mis órdenes:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Get order details with items
app.get('/api/orders/:id', authenticateToken, async (req, res) => {
    const orderId = parseInt(req.params.id, 10);

    try {
        const order = await statements.getOrderWithCustomerById(orderId);
        
        if (!order) {
            return res.status(404).json({ message: 'Orden no encontrada' });
        }

        // Check authorization
        if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
            return res.status(403).json({ message: 'Acceso denegado' });
        }

        const orderItems = await statements.getOrderItems(orderId);
        
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
app.post('/api/orders', authenticateToken, async (req, res) => {
    const { notes, shipping_address, items, payment_method, customer_name, customer_email, customer_phone, shipping_street, shipping_city, shipping_postal_code, shipping_sector } = req.body;

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
            const product = await statements.getProductById(item.product_id);
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
        // Use notes if provided, otherwise fallback to legacy address format
        const legacyAddress = notes || shipping_address || [shipping_street, shipping_sector, shipping_city].filter(Boolean).join(', ');
        
        const resolvedCustomerName = (customer_name && customer_name.trim()) || req.user.name;
        const resolvedCustomerEmail = (customer_email || req.user.email || '').trim().toLowerCase();
        const resolvedCustomerPhone = customer_phone ? customer_phone.trim() : '';

        // Set initial status based on payment method
        // transfer -> pending_payment
        // cash -> pending_payment (waiting for delivery/payment)
        const initialStatus = 'pending_payment';

        const orderResult = await statements.createOrder(
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

        // Update status explicitly to ensure it matches our new system
        await statements.updateOrderStatus(initialStatus, orderId);

        // Generate and update order number
        const orderNumber = generateOrderNumber(orderId);
        await statements.updateOrderNumber(orderNumber, orderId);

        // Add order items and update stock
        for (const item of items) {
            const product = await statements.getProductById(item.product_id);
            await statements.addOrderItem(orderId, item.product_id, item.quantity, product.price);
            
            // Update stock
            const newStock = product.stock - item.quantity;
            await statements.updateProduct(
                product.name,
                product.description,
                product.price,
                product.category,
                newStock,
                item.product_id
            );
        }

        // Clear cart
        await statements.clearCart(req.user.id);

        const order = await statements.getOrderById(orderId);
        console.log('Orden creada:', order);
        res.status(201).json(order);
    } catch (error) {
        console.error('Error creando orden:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Create order as guest (no authentication required)
app.post('/api/orders/guest', async (req, res) => {
    const { notes, shipping_address, items, customer_info, payment_method, shipping_street, shipping_city, shipping_postal_code, shipping_sector } = req.body;

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
            const product = await statements.getProductById(item.product_id);
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
        // Use notes if provided, otherwise fallback to legacy address format
        const legacyAddress = notes || shipping_address || [shipping_street, shipping_sector, shipping_city].filter(Boolean).join(', ');
        const guestName = (customer_info.name && customer_info.name.trim()) || 'Cliente Invitado';
        const guestEmail = customer_info.email.trim().toLowerCase();
        const guestPhone = customer_info.phone ? customer_info.phone.trim() : '';

        // Set initial status based on payment method
        const initialStatus = 'pending_payment';

        const orderResult = await statements.createOrder(
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

        // Update status explicitly to ensure it matches our new system
        await statements.updateOrderStatus(initialStatus, orderId);

        // Generate and update order number
        const orderNumber = generateOrderNumber(orderId);
        await statements.updateOrderNumber(orderNumber, orderId);

        // Add order items and update stock
        for (const item of items) {
            const product = await statements.getProductById(item.product_id);
            await statements.addOrderItem(orderId, item.product_id, item.quantity, product.price);
            
            // Update stock
            const newStock = product.stock - item.quantity;
            await statements.updateProduct(
                product.name,
                product.description,
                product.price,
                product.category,
                newStock,
                item.product_id
            );
        }

        const order = await statements.getOrderById(orderId);
        console.log('Orden de invitado creada:', order);
        res.status(201).json(order);
    } catch (error) {
        console.error('Error creando orden de invitado:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Update order details (admin only)
app.put('/api/orders/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado' });
    }

    const orderId = parseInt(req.params.id, 10);
    const updates = req.body;

    // Filter allowed fields to prevent overwriting critical data like ID or user_id
    const allowedFields = ['status', 'internal_notes', 'carrier', 'tracking_number', 'shipping_address', 'shipping_street', 'shipping_city', 'shipping_sector', 'shipping_postal_code'];
    const filteredUpdates = {};
    
    Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
            filteredUpdates[key] = updates[key];
        }
    });

    if (Object.keys(filteredUpdates).length === 0) {
        return res.status(400).json({ message: 'No se proporcionaron campos válidos para actualizar' });
    }

    if (filteredUpdates.status) {
        const validStatuses = [
            'pending_payment', 'paid', 'to_ship', 'shipped', 'delivered', 
            'return', 'refund', 'cancelled', 'pending', 'processing'
        ];
        if (!validStatuses.includes(filteredUpdates.status)) {
            return res.status(400).json({ 
                message: `Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}` 
            });
        }
    }

    try {
        // Get current order status BEFORE update
        const currentOrder = await statements.getOrderById(orderId);
        if (!currentOrder) {
             return res.status(404).json({ message: 'Orden no encontrada' });
        }

        const result = await statements.updateOrder(orderId, filteredUpdates);
        
        if (result) {
            // Check for stock reversion
            const newStatus = filteredUpdates.status;
            const oldStatus = currentOrder.status;
            const isCancelledOrReturn = ['cancelled', 'return', 'refund'].includes(newStatus);
            const wasCancelledOrReturn = ['cancelled', 'return', 'refund'].includes(oldStatus);

            if (newStatus && isCancelledOrReturn && !wasCancelledOrReturn) {
                console.log(`Restoring stock for order ${orderId} (Status: ${oldStatus} -> ${newStatus})`);
                const orderItems = await statements.getOrderItems(orderId);
                for (const item of orderItems) {
                    const product = await statements.getProductById(item.product_id);
                    if (product) {
                        const newStock = product.stock + item.quantity;
                        await statements.updateProduct(
                            product.name,
                            product.description,
                            product.price,
                            product.category,
                            newStock,
                            item.product_id
                        );
                    }
                }
            }

            const order = await statements.getOrderById(orderId);
            console.log('Orden actualizada:', order);
            res.json({ message: 'Orden actualizada exitosamente', order });
        } else {
            res.status(404).json({ message: 'Orden no encontrada' });
        }
    } catch (error) {
        console.error('Error actualizando orden:', error);
        // Return the actual error message in development or a specific message for column errors
        if (error.code === '42703') { // Postgres error code for undefined column
            return res.status(500).json({ message: 'Error de base de datos: Faltan columnas (internal_notes, carrier, tracking_number). Por favor ejecuta la migración.' });
        }
        res.status(500).json({ message: 'Error interno del servidor: ' + error.message });
    }
});

// Update order status (admin only)
app.put('/api/orders/:id/status', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado' });
    }

    const orderId = parseInt(req.params.id, 10);
    const { status } = req.body;

    const validStatuses = [
        'pending_payment', 
        'paid', 
        'to_ship', 
        'shipped', 
        'delivered', 
        'return', 
        'refund', 
        'cancelled',
        'pending',
        'processing'
    ];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
            message: `Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}` 
        });
    }

    try {
        // Get current order status BEFORE update
        const currentOrder = await statements.getOrderById(orderId);
        if (!currentOrder) {
             return res.status(404).json({ message: 'Orden no encontrada' });
        }

        const result = await statements.updateOrderStatus(status, orderId);
        
        if (result) {
            // Check for stock reversion
            const newStatus = status;
            const oldStatus = currentOrder.status;
            const isCancelledOrReturn = ['cancelled', 'return', 'refund'].includes(newStatus);
            const wasCancelledOrReturn = ['cancelled', 'return', 'refund'].includes(oldStatus);

            if (isCancelledOrReturn && !wasCancelledOrReturn) {
                console.log(`Restoring stock for order ${orderId} (Status: ${oldStatus} -> ${newStatus})`);
                const orderItems = await statements.getOrderItems(orderId);
                for (const item of orderItems) {
                    const product = await statements.getProductById(item.product_id);
                    if (product) {
                        const newStock = product.stock + item.quantity;
                        await statements.updateProduct(
                            product.name,
                            product.description,
                            product.price,
                            product.category,
                            newStock,
                            item.product_id
                        );
                    }
                }
            }

            const order = await statements.getOrderById(orderId);
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

// Delete order (admin only)
app.delete('/api/orders/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado' });
    }

    const orderId = parseInt(req.params.id, 10);

    try {
        const result = await statements.deleteOrder(orderId);
        
        if (result) {
            console.log('Orden eliminada:', orderId);
            res.json({ message: 'Orden eliminada exitosamente' });
        } else {
            res.status(404).json({ message: 'Orden no encontrada' });
        }
    } catch (error) {
        console.error('Error eliminando orden:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Track order by ID or Order Number (public - no authentication required)
app.get('/api/orders/track/:id', async (req, res) => {
    const param = req.params.id;
    const orderId = parseInt(param, 10);

    try {
        let order;
        
        // If param is a number, search by ID
        if (!isNaN(orderId) && orderId.toString() === param) {
            order = await statements.getOrderWithCustomerById(orderId);
        } else {
            // Search by order_number
            order = await statements.getOrderByNumber(param);
        }
        
        if (!order) {
            return res.status(404).json({ message: 'Orden no encontrada' });
        }

        // Get order items
        const orderItems = await statements.getOrderItems(order.id);
        
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
app.get('/api/orders/track/email/:email', async (req, res) => {
    const email = req.params.email.trim().toLowerCase();

    try {
        const orders = await statements.getOrdersByEmail(email);
        
        if (!orders || orders.length === 0) {
            return res.status(404).json({ message: 'No se encontraron órdenes' });
        }

        const ordersWithItems = await Promise.all(orders.map(async (order) => ({
            ...order,
            items: await statements.getOrderItems(order.id)
        })));
        
        res.json(ordersWithItems);
    } catch (error) {
        console.error('Error buscando órdenes por email:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// --- RUTAS DE ADMINISTRACIÓN DE USUARIOS (Opcional) ---

app.get('/api/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const role = req.query.role || 'all';
    const status = req.query.status || 'all';

    try {
        const { data: users, total } = await statements.getUsersPaginated(page, limit, search, role, status);
        
        res.json({
            data: users,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error obteniendo usuarios:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Update user role
app.put('/api/users/:id/role', authenticateToken, async (req, res) => {
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
        const result = await statements.updateUserRole(role, userId);
        
        if (result) {
            const updatedUser = await statements.getUserById(userId);
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
app.put('/api/users/:id/status', authenticateToken, async (req, res) => {
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
        const result = await statements.updateUserStatus(is_active, userId);
        
        if (result) {
            const updatedUser = await statements.getUserById(userId);
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

    const normalizedEmail = email.toLowerCase().trim();

    // Generar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Expiración en 10 minutos
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    try {
        // Eliminar códigos anteriores para este email y propósito
        await statements.deleteVerificationCodes(normalizedEmail, purpose || 'general');

        // Guardar nuevo código
        await statements.createVerificationCode(normalizedEmail, code, purpose || 'general', expiresAt);

        // Enviar email
        const mailOptions = {
            from: process.env.EMAIL_USER || 'noreply@techstore.com',
            to: normalizedEmail,
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
app.post('/api/verification/verify-code', async (req, res) => {
    const { email, code, purpose } = req.body;

    if (!email || !code) {
        return res.status(400).json({ message: 'Email y código son requeridos' });
    }

    try {
        const normalizedEmail = email.toLowerCase().trim();
        const record = await statements.getVerificationCode(normalizedEmail, code, purpose || 'general');

        if (record) {
            // Código válido
            // No eliminar si es para registro o restablecimiento de contraseña, 
            // ya que esas rutas necesitan verificar el código una segunda vez al procesar la acción final.
            if (purpose !== 'register' && purpose !== 'password_reset') {
                await statements.deleteVerificationCodes(normalizedEmail, purpose || 'general');
            }
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
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Cerrando servidor...');
    process.exit(0);
});



// Agregar esta ruta a tu server.js después de las rutas existentes del carrito

app.put('/api/cart/:productId', authenticateToken, async (req, res) => {
    const productId = parseInt(req.params.productId, 10);
    const { quantity } = req.body;

    // Validaciones
    if (typeof quantity !== 'number' || quantity < 0) {
        return res.status(400).json({ message: 'Cantidad inválida.' });
    }

    try {
        // Verificar que el producto existe
        const product = await statements.getProductById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        // Verificar que el item existe en el carrito
        const existingItem = await statements.getCartItem(req.user.id, productId);
        if (!existingItem) {
            return res.status(404).json({ message: 'Producto no encontrado en el carrito' });
        }

        // Si la cantidad es 0, eliminar el item
        if (quantity === 0) {
            await statements.removeFromCart(req.user.id, productId);
        } else {
            // Verificar stock disponible
            if (quantity > product.stock) {
                return res.status(400).json({
                    message: `No hay suficiente stock para ${product.name}. Stock disponible: ${product.stock}`,
                    availableStock: product.stock
                });
            }

            // Actualizar cantidad
            await statements.updateCartItem(quantity, req.user.id, productId);
        }

        const cart = await statements.getCartByUserId(req.user.id);
        console.log('Carrito actualizado para usuario', req.user.id, ':', cart);
        res.json(cart);
    } catch (error) {
        console.error('Error actualizando carrito:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

app.delete('/api/cart', authenticateToken, async (req, res) => {
    try {
        await statements.clearCart(req.user.id);
        console.log('Carrito vaciado para usuario', req.user.id);
        res.json({ message: 'Carrito vaciado exitosamente', cart: [] });
    } catch (error) {
        console.error('Error vaciando carrito:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

