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
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const { statements } = require('./database');
const { buildShareHtml, extractProductIdFromSlug, ensureAbsoluteUrl } = require('./sharePage');
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

const SETTINGS_ENCRYPTION_SECRET = process.env.SETTINGS_ENCRYPTION_SECRET || JWT_SECRET;
const SETTINGS_ENCRYPTION_PREFIX = 'enc:';
const SETTINGS_ENCRYPTION_KEY = SETTINGS_ENCRYPTION_SECRET
    ? crypto.createHash('sha256').update(String(SETTINGS_ENCRYPTION_SECRET)).digest()
    : null;

const encryptSetting = (value) => {
    if (!SETTINGS_ENCRYPTION_KEY || !value) return value;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', SETTINGS_ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${SETTINGS_ENCRYPTION_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

const decryptSetting = (value) => {
    if (!SETTINGS_ENCRYPTION_KEY || !value || typeof value !== 'string') return value;
    if (!value.startsWith(SETTINGS_ENCRYPTION_PREFIX)) return value;
    try {
        const payload = value.slice(SETTINGS_ENCRYPTION_PREFIX.length);
        const [ivB64, tagB64, dataB64] = payload.split(':');
        if (!ivB64 || !tagB64 || !dataB64) return value;
        const iv = Buffer.from(ivB64, 'base64');
        const tag = Buffer.from(tagB64, 'base64');
        const data = Buffer.from(dataB64, 'base64');
        const decipher = crypto.createDecipheriv('aes-256-gcm', SETTINGS_ENCRYPTION_KEY, iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
        return decrypted.toString('utf8');
    } catch (error) {
        console.error('Error decrypting setting:', error);
        return value;
    }
};

// CORS con múltiples orígenes permitidos
const corsOptions = {
    origin: [
        'https://8smgkh0x-5173.use2.devtunnels.ms',
        'https://6sfq7hfx-5001.use2.devtunnels.ms',
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

app.set('trust proxy', 1);

app.use(cookieParser());

// Add these headers to all responses
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (corsOptions.origin.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token');
    
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

const createCsrfToken = () => crypto.randomBytes(32).toString('hex');

const getCookieOptions = (req) => {
    const origin = req?.headers?.origin || '';
    const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
    const isSecureOrigin = origin.startsWith('https://');
    const secure = process.env.NODE_ENV === 'production' || isSecureOrigin;
    const sameSite = isLocal ? 'lax' : 'none';

    return { secure, sameSite };
};

const setCsrfCookie = (req, res) => {
    const { secure, sameSite } = getCookieOptions(req);
    const csrfToken = createCsrfToken();

    res.cookie('XSRF-TOKEN', csrfToken, {
        httpOnly: false,
        secure,
        sameSite,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
    });

    return csrfToken;
};

const setAuthCookies = (req, res, token) => {
    const { secure, sameSite } = getCookieOptions(req);

    res.cookie('auth_token', token, {
        httpOnly: true,
        secure,
        sameSite,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
    });

    return setCsrfCookie(req, res);
};

const csrfProtection = (req, res, next) => {
    const method = req.method.toUpperCase();
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        return next();
    }

    const hasAuthCookie = !!req.cookies?.auth_token;
    if (!hasAuthCookie) {
        return next();
    }

    const csrfCookie = req.cookies['XSRF-TOKEN'];
    const csrfHeader = req.headers['x-csrf-token'];

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        return res.status(403).json({ message: 'Token CSRF inválido o ausente' });
    }

    next();
};

app.use(csrfProtection);

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
    fileFilter: imageFileFilter,
    limits: {
        fileSize: 15 * 1024 * 1024 // 5MB por archivo
    }
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
    const tokenFromHeader = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    const tokenFromCookie = req.cookies?.auth_token;
    const token = tokenFromHeader || tokenFromCookie;

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

        const csrfToken = setAuthCookies(req, res, token);

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
            token,
            csrfToken
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

        const csrfToken = setAuthCookies(req, res, token);

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
            token,
            csrfToken
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ 
            message: 'Error interno del servidor' 
        });
    }
});

/**
 * GET /api/auth/check-email
 * Verifica si un email ya está registrado
 */
app.get('/api/auth/check-email', async (req, res) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({ message: 'Email es requerido' });
        }

        const normalizedEmail = String(email).toLowerCase().trim();
        const user = await statements.getUserByEmail(normalizedEmail);

        return res.json({ exists: !!user });
    } catch (error) {
        console.error('Error checking email:', error);
        return res.status(500).json({ message: 'Error interno del servidor' });
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

        await sendMailWithSettings(mailOptions);
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

        if (!req.cookies?.['XSRF-TOKEN'] && req.cookies?.auth_token) {
            setCsrfCookie(req, res);
        }

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
    const { secure, sameSite } = getCookieOptions(req);
    res.clearCookie('auth_token', { path: '/', secure, sameSite });
    res.clearCookie('XSRF-TOKEN', { path: '/', secure, sameSite });
    // En una implementación real, podrías mantener una lista negra de tokens
    // Por ahora, simplemente confirmamos el logout
    res.json({ 
        message: 'Logout exitoso' 
    });
});

// == Share Page (OG) ==
app.get('/p/:slug', async (req, res) => {
    const slug = req.params.slug || '';
    const productId = extractProductIdFromSlug(slug);
    if (!productId) {
        return res.status(404).send('Producto no encontrado');
    }

    try {
        const product = await statements.getProductById(productId);
        if (!product) {
            return res.status(404).send('Producto no encontrado');
        }

        let images = await statements.getProductImages(productId);
        if (images.length === 0 && product.image) {
            images = [{ image_path: product.image }];
        }

        const baseUrl = (process.env.FRONTEND_URL || process.env.BASE_URL || `${req.protocol}://${req.get('host')}`)
            .replace(/\/$/, '');
        const primaryImage = images.length > 0 ? images[0].image_path : '';
        const imageUrl = ensureAbsoluteUrl(primaryImage, baseUrl);
        const shareUrl = `${baseUrl}/product/${productId}`;

        const html = buildShareHtml({
            title: product.name,
            description: product.description,
            imageUrl,
            url: shareUrl
        });

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(html);
    } catch (error) {
        console.error('Error generando share page:', error);
        return res.status(500).send('Error interno del servidor');
    }
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

    let total = 0;
    let orderId = null;
    const reservedItems = [];
    const itemDetails = [];

    const rollbackReserved = async () => {
        for (const item of reservedItems) {
            try {
                await statements.incrementStock(item.product_id, item.quantity);
            } catch (rollbackError) {
                console.error('Error rollback stock:', rollbackError);
            }
        }
    };

    try {
        // Calculate total and reserve stock atomically per item
        for (const item of items) {
            const product = await statements.getProductById(item.product_id);
            if (!product) {
                await rollbackReserved();
                return res.status(404).json({ message: `Producto ${item.product_id} no encontrado` });
            }

            const reserved = await statements.decrementStockIfAvailable(product.id, item.quantity);
            if (!reserved) {
                await rollbackReserved();
                return res.status(400).json({ 
                    message: `Stock insuficiente para ${product.name}` 
                });
            }

            reservedItems.push({ product_id: product.id, quantity: item.quantity });
            itemDetails.push({ product_id: product.id, name: product.name, quantity: item.quantity, price: product.price });
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
        orderId = orderResult.lastInsertRowid;

        // Update status explicitly to ensure it matches our new system
        await statements.updateOrderStatus(initialStatus, orderId);

        // Generate and update order number
        const orderNumber = generateOrderNumber(orderId);
        await statements.updateOrderNumber(orderNumber, orderId);

        // Add order items and update stock
        for (const item of itemDetails) {
            await statements.addOrderItem(orderId, item.product_id, item.quantity, item.price);
        }

        // Clear cart
        await statements.clearCart(req.user.id);

        const order = await statements.getOrderById(orderId);
        const skipEmail = req.body.skipEmail === true;
        if (!skipEmail) {
            const emailSent = await sendOrderEmail({
                order,
                items: itemDetails,
                customer: {
                    name: resolvedCustomerName,
                    email: resolvedCustomerEmail,
                    phone: resolvedCustomerPhone
                },
                shipping: {
                    address: [shipping_street, shipping_sector, shipping_city].filter(Boolean).join(', ')
                }
            });
            if (!emailSent) {
                console.warn('Order email not sent for order', orderId);
            }
        }
        console.log('Orden creada:', order);
        res.status(201).json(order);
    } catch (error) {
        console.error('Error creando orden:', error);
        await rollbackReserved();
        if (orderId) {
            try {
                await statements.updateOrderStatus('cancelled', orderId);
            } catch (statusError) {
                console.error('Error marcando orden como cancelada:', statusError);
            }
        }
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

    let total = 0;
    let orderId = null;
    const reservedItems = [];
    const itemDetails = [];

    const rollbackReserved = async () => {
        for (const item of reservedItems) {
            try {
                await statements.incrementStock(item.product_id, item.quantity);
            } catch (rollbackError) {
                console.error('Error rollback stock:', rollbackError);
            }
        }
    };

    try {
        // Calculate total and reserve stock atomically per item
        for (const item of items) {
            const product = await statements.getProductById(item.product_id);
            if (!product) {
                await rollbackReserved();
                return res.status(404).json({ message: `Producto ${item.product_id} no encontrado` });
            }

            const reserved = await statements.decrementStockIfAvailable(product.id, item.quantity);
            if (!reserved) {
                await rollbackReserved();
                return res.status(400).json({ 
                    message: `Stock insuficiente para ${product.name}` 
                });
            }

            reservedItems.push({ product_id: product.id, quantity: item.quantity });
            itemDetails.push({ product_id: product.id, name: product.name, quantity: item.quantity, price: product.price });
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
        orderId = orderResult.lastInsertRowid;

        // Update status explicitly to ensure it matches our new system
        await statements.updateOrderStatus(initialStatus, orderId);

        // Generate and update order number
        const orderNumber = generateOrderNumber(orderId);
        await statements.updateOrderNumber(orderNumber, orderId);

        // Add order items and update stock
        for (const item of itemDetails) {
            await statements.addOrderItem(orderId, item.product_id, item.quantity, item.price);
        }

        const order = await statements.getOrderById(orderId);
        const skipEmail = req.body.skipEmail === true;
        if (!skipEmail) {
            const emailSent = await sendOrderEmail({
                order,
                items: itemDetails,
                customer: {
                    name: guestName,
                    email: guestEmail,
                    phone: guestPhone
                },
                shipping: {
                    address: [shipping_street, shipping_sector, shipping_city].filter(Boolean).join(', ')
                }
            });
            if (!emailSent) {
                console.warn('Order email not sent for guest order', orderId);
            }
        }
        console.log('Orden de invitado creada:', order);
        res.status(201).json(order);
    } catch (error) {
        console.error('Error creando orden de invitado:', error);
        await rollbackReserved();
        if (orderId) {
            try {
                await statements.updateOrderStatus('cancelled', orderId);
            } catch (statusError) {
                console.error('Error marcando orden como cancelada:', statusError);
            }
        }
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Send invoice email with PDF attachment
app.post('/api/orders/:id/invoice-email', async (req, res) => {
    const orderId = parseInt(req.params.id, 10);
    const { pdfBase64, email } = req.body || {};

    if (!orderId || !pdfBase64) {
        return res.status(400).json({ message: 'Falta el PDF o el ID de la orden' });
    }

    try {
        const order = await statements.getOrderById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Orden no encontrada' });
        }

        const orderEmail = (order.customer_email || '').trim().toLowerCase();
        const requestEmail = (email || orderEmail).trim().toLowerCase();
        if (orderEmail && requestEmail && orderEmail !== requestEmail) {
            return res.status(403).json({ message: 'Email no autorizado para esta orden' });
        }

        const items = await statements.getOrderItems(orderId);
        const itemDetails = items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price
        }));

        const cleanBase64 = String(pdfBase64).replace(/^data:application\/pdf;base64,/, '');
        const attachment = {
            filename: `factura-${order.order_number || order.id}.pdf`,
            content: Buffer.from(cleanBase64, 'base64'),
            contentType: 'application/pdf'
        };

        const shippingAddress = [order.shipping_street, order.shipping_sector, order.shipping_city]
            .filter(Boolean)
            .join(', ') || order.shipping_address || '';

        let emailSent = false;
        try {
            emailSent = await sendOrderEmail({
                order,
                items: itemDetails,
                customer: {
                    name: order.customer_name || 'Cliente',
                    email: orderEmail || requestEmail,
                    phone: order.customer_phone || ''
                },
                shipping: {
                    address: shippingAddress
                },
                attachment
            });
        } catch (error) {
            console.error('Error adjuntando factura, enviando sin adjunto:', error);
        }

        if (!emailSent) {
            const fallbackSent = await sendOrderEmail({
                order,
                items: itemDetails,
                customer: {
                    name: order.customer_name || 'Cliente',
                    email: orderEmail || requestEmail,
                    phone: order.customer_phone || ''
                },
                shipping: {
                    address: shippingAddress
                }
            });

            if (!fallbackSent) {
                return res.status(500).json({ message: 'No se pudo enviar el correo' });
            }

            return res.json({ message: 'Correo enviado sin adjunto' });
        }

        return res.json({ message: 'Correo enviado con adjunto' });
    } catch (error) {
        console.error('Error enviando factura adjunta:', error);
        return res.status(500).json({ message: 'Error interno del servidor' });
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
const getSettingsMap = async () => {
    const settings = await statements.getSettings();
    return settings.reduce((acc, curr) => {
        if (curr.id === 'mailPassword') {
            acc[curr.id] = decryptSetting(curr.value);
        } else {
            acc[curr.id] = curr.value;
        }
        return acc;
    }, {});
};

const createMailTransporter = (settings) => {
    const settingsUser = (settings.mailUser || '').trim();
    const settingsPass = (settings.mailPassword || '').trim();
    const envUser = process.env.EMAIL_USER || '';
    const envPass = process.env.EMAIL_PASS || '';

    const useSettingsCreds = settingsUser.length > 0 && settingsPass.length > 0;
    const user = useSettingsCreds ? settingsUser : envUser;
    const pass = useSettingsCreds ? settingsPass : envPass;

    if (!user || !pass) {
        return null;
    }

    const host = (settings.mailHost || '').trim() || process.env.EMAIL_HOST;
    const portValue = settings.mailPort || process.env.EMAIL_PORT || 587;
    const port = Number(portValue) || 587;
    const useTls = settings.mailUseTls === true || settings.mailUseTls === 'true';
    const secure = port === 465;

    if (host) {
        return nodemailer.createTransport({
            host,
            port,
            secure,
            auth: { user, pass },
            ...(useTls ? { requireTLS: true, tls: { rejectUnauthorized: false } } : {})
        });
    }

    return nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: { user, pass }
    });
};

const formatCurrency = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('es-DO', { style: 'currency', currency: 'DOP' });
};

const renderTemplate = (template, data) => {
    if (!template) return '';
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            return data[key];
        }
        return '';
    });
};

const sendMailWithSettings = async (mailOptions) => {
    const settings = await getSettingsMap();
    const transporter = createMailTransporter(settings);
    if (!transporter) {
        throw new Error('Email transport not configured');
    }

    const fromEmail = settings.mailFrom || settings.mailUser || process.env.EMAIL_USER || mailOptions.from;
    const fromName = settings.mailFromName || settings.siteName || 'TechStore';
    const from = fromEmail ? `${fromName} <${fromEmail}>` : mailOptions.from;

    await transporter.sendMail({
        ...mailOptions,
        from
    });
};

const sendOrderEmail = async ({ order, items, customer, shipping, attachment }) => {
    try {
        const settings = await getSettingsMap();
        const transporter = createMailTransporter(settings);
        if (!transporter) {
            console.warn('No email transporter available. Missing mailUser/mailPassword.');
            return false;
        }

        const fromEmail = settings.mailFrom || settings.mailUser || process.env.EMAIL_USER;
        const fromName = settings.mailFromName || settings.siteName || 'TechStore';
        const from = `${fromName} <${fromEmail}>`;

        const itemRows = items.map((item) => `
            <tr>
                <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;">${item.name}</td>
                <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
                <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatCurrency(item.price)}</td>
                <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatCurrency(item.price * item.quantity)}</td>
            </tr>
        `).join('');

        const itemsTable = `
            <table style="width:100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                    <tr>
                        <th style="text-align:left; padding:8px 6px; border-bottom:2px solid #e5e7eb;">Producto</th>
                        <th style="text-align:center; padding:8px 6px; border-bottom:2px solid #e5e7eb;">Cantidad</th>
                        <th style="text-align:right; padding:8px 6px; border-bottom:2px solid #e5e7eb;">Precio</th>
                        <th style="text-align:right; padding:8px 6px; border-bottom:2px solid #e5e7eb;">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemRows}
                </tbody>
            </table>
        `;

        const defaultTemplate = `
            <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
                <div style="background: #111827; color: #fff; padding: 16px 20px; border-radius: 10px 10px 0 0;">
                    <h2 style="margin: 0;">${settings.siteIcon || '🛍️'} ${settings.siteName || 'TechStore'}</h2>
                    <p style="margin: 4px 0 0;">Tu pedido fue recibido</p>
                </div>
                <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 10px 10px;">
                    <p>Hola <strong>${customer.name}</strong>,</p>
                    <p>Tu orden <strong>${order.order_number || `#${order.id}`}</strong> fue tomada y está en proceso de preparación para envío. Te contactaremos si es necesario.</p>

                    <h3 style="margin-top: 20px;">Resumen de la orden</h3>
                    ${itemsTable}

                    <div style="margin-top: 16px; display: flex; justify-content: space-between;">
                        <div>
                            <p style="margin: 4px 0;"><strong>Dirección:</strong> ${shipping.address}</p>
                            <p style="margin: 4px 0;"><strong>Teléfono:</strong> ${customer.phone || 'N/A'}</p>
                            <p style="margin: 4px 0;"><strong>Método de pago:</strong> ${order.payment_method === 'cash' ? 'Contra Entrega' : order.payment_method === 'transfer' ? 'Transferencia' : order.payment_method}</p>
                        </div>
                        <div style="text-align:right;">
                            <p style="margin: 4px 0;"><strong>Total:</strong> ${formatCurrency(order.total)}</p>
                            <p style="margin: 4px 0; color: #6b7280;">Estado: ${order.status}</p>
                        </div>
                    </div>

                    <p style="margin-top: 20px;">Gracias por comprar con nosotros.</p>
                </div>
            </div>
        `;

        const template = settings.mailTemplateHtml || '';
        const html = template
            ? renderTemplate(template, {
                siteName: settings.siteName || 'TechStore',
                siteIcon: settings.siteIcon || '🛍️',
                orderNumber: order.order_number || `#${order.id}`,
                customerName: customer.name,
                customerEmail: customer.email,
                customerPhone: customer.phone || 'N/A',
                shippingAddress: shipping.address,
                paymentMethod: order.payment_method === 'cash' ? 'Contra Entrega' : order.payment_method === 'transfer' ? 'Transferencia' : order.payment_method,
                status: order.status,
                total: formatCurrency(order.total),
                itemsTable
            })
            : defaultTemplate;

        const mailOptions = {
            from,
            to: customer.email,
            subject: `Orden recibida ${order.order_number ? order.order_number : `#${order.id}`}`,
            html
        };

        if (attachment) {
            mailOptions.attachments = [attachment];
        }

        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Error enviando email de orden:', error);
        return false;
    }
};

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
            await sendMailWithSettings(mailOptions);
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

// == Cart Updates ==

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

// --- RUTAS DE CONFIGURACIÓN DEL SITIO ---

app.get('/api/settings', async (req, res) => {
    try {
        const settings = await statements.getSettings();
        // Convertir array [ {id: 'siteName', value: 'TechStore'}, ... ] a objeto { siteName: 'TechStore', ... }
        const settingsObj = settings.reduce((acc, curr) => {
            if (curr.id === 'mailPassword') {
                acc[curr.id] = '';
            } else {
                acc[curr.id] = curr.value;
            }
            return acc;
        }, {});
        res.json(settingsObj);
    } catch (error) {
        console.error('Error obteniendo ajustes:', error);
        res.status(500).json({ message: 'Error al obtener los ajustes' });
    }
});

app.put('/api/settings', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado' });
    }

    try {
        const settings = req.body; // { siteName: '...', siteIcon: '...' }
        const entries = Object.entries(settings).filter(([key, value]) => {
            if (key !== 'mailPassword') return true;
            return value !== undefined && value !== null && String(value).trim() !== '';
        });
        const promises = entries.map(([key, value]) => {
            if (key === 'mailPassword') {
                const encrypted = encryptSetting(value);
                return statements.updateSetting(key, encrypted);
            }
            return statements.updateSetting(key, value);
        });
        await Promise.all(promises);
        res.json({ message: 'Ajustes actualizados correctamente' });
    } catch (error) {
        console.error('❌ Error actualizando ajustes:', error);
        res.status(500).json({ 
            message: 'Error al actualizar los ajustes',
            details: error.message 
        });
    }
});

app.post('/api/settings/upload', authenticateToken, upload.single('image'), async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado' });
    }

    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No se subió ninguna imagen' });
        }

        const imageUrl = await statements.uploadImage(req.file);
        res.json({ url: imageUrl });
    } catch (error) {
        console.error('Error subiendo imagen de ajustes:', error);
        res.status(500).json({ message: 'Error al subir la imagen' });
    }
});

// --- Start Server ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log(`Acceso en red local: http://192.168.100.41:${PORT}`);
    console.log(`Acceso en red local: http://192.168.100.41:${PORT}`);
});

// Graceful shutdown$
process.on('SIGINT', () => {
    console.log('Cerrando servidor...');
    process.exit(0);
});
