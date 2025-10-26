# TechStore - E-commerce Platform

Una plataforma de e-commerce completa para venta de productos tecnológicos con panel de administración, gestión de órdenes y checkout para invitados.

## 🚀 Características

- ✅ Catálogo de productos con categorías
- ✅ Carrito de compras
- ✅ Autenticación de usuarios (JWT)
- ✅ Panel de administración
- ✅ Gestión de productos (CRUD)
- ✅ Gestión de usuarios y roles
- ✅ Sistema de órdenes
- ✅ Checkout para invitados
- ✅ Múltiples métodos de pago (efectivo, transferencia)
- ✅ Rastreo de órdenes público
- ✅ Gestión de inventario

## 🛠️ Tecnologías

### Backend
- Node.js + Express
- SQLite (better-sqlite3)
- JWT para autenticación
- Bcrypt para encriptación
- Multer para carga de imágenes

### Frontend
- React 18+
- Vite
- CSS Modules
- Fetch API

## 📋 Requisitos Previos

- Node.js (v16 o superior)
- npm o yarn

## 🔧 Instalación

### 1. Clonar el repositorio
```bash
git clone <url-del-repositorio>
cd mi-tienda-online2
```

### 2. Instalar dependencias del Backend
```bash
cd backend
npm install
```

### 3. Instalar dependencias del Frontend
```bash
cd ../frontend
npm install
```

## 🚀 Uso

### Iniciar el Backend
```bash
cd backend
npm run dev
```
El servidor estará disponible en `http://localhost:5001`

### Iniciar el Frontend
```bash
cd frontend
npm run dev
```
La aplicación estará disponible en `http://localhost:5173`

## 📁 Estructura del Proyecto

```
mi-tienda-online2/
├── backend/
│   ├── server.js           # Servidor Express principal
│   ├── database.js         # Configuración de SQLite
│   ├── images/             # Imágenes de productos
│   ├── data/               # Base de datos SQLite
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Componente principal
│   │   ├── components/     # Componentes React
│   │   ├── services/       # Servicios (auth, etc.)
│   │   └── config.js       # Configuración
│   ├── public/
│   └── package.json
└── README.md
```

## 🔐 Autenticación

### Usuario Admin por Defecto
Debes crear un usuario admin a través del registro y luego actualizar su rol en la base de datos.

### Endpoints de Autenticación
- POST `/api/auth/register` - Registro de usuarios
- POST `/api/auth/login` - Inicio de sesión
- GET `/api/auth/me` - Obtener usuario actual
- PUT `/api/auth/profile` - Actualizar perfil

## 📦 API Endpoints

### Productos
- GET `/api/products` - Listar productos
- GET `/api/products/:id` - Obtener producto por ID
- POST `/api/products` - Crear producto (Admin)
- PUT `/api/products/:id` - Actualizar producto (Admin)
- DELETE `/api/products/:id` - Eliminar producto (Admin)

### Órdenes
- GET `/api/orders` - Listar todas las órdenes (Admin)
- GET `/api/orders/:id` - Obtener orden por ID
- POST `/api/orders` - Crear orden (Autenticado)
- POST `/api/orders/guest` - Crear orden como invitado
- PUT `/api/orders/:id/status` - Actualizar estado (Admin)
- GET `/api/orders/track/:id` - Rastrear por ID (Público)
- GET `/api/orders/track/email/:email` - Rastrear por email (Público)

### Usuarios
- GET `/api/users` - Listar usuarios (Admin)
- PUT `/api/users/:id/role` - Cambiar rol (Admin)
- PUT `/api/users/:id/status` - Activar/desactivar (Admin)

### Carrito
- GET `/api/cart` - Obtener carrito
- POST `/api/cart` - Agregar al carrito
- PUT `/api/cart/:productId` - Actualizar cantidad
- DELETE `/api/cart/:productId` - Eliminar del carrito
- DELETE `/api/cart` - Vaciar carrito

## 💳 Métodos de Pago

- 💵 Pago Contra Entrega (Efectivo)
- 🏦 Transferencia Bancaria
- 💳 Pago en Línea (Futuro)
- 💳 Tarjeta de Crédito/Débito (Futuro)

## 🎨 Características del Frontend

- Diseño responsive
- Carrito de compras con LocalStorage
- Modal de órdenes con búsqueda
- Panel de administración con 3 pestañas
- Edición inline de productos
- Gestión de inventario en tiempo real

## 🔒 Seguridad

- Contraseñas hasheadas con bcrypt
- Tokens JWT con expiración de 7 días
- Validación de entrada en el backend
- CORS configurado
- Protección de rutas administrativas

## 📝 Notas

- La base de datos SQLite se crea automáticamente al iniciar el servidor
- Las imágenes se almacenan en `backend/images/`
- El checkout de invitados crea usuarios temporales
- Los clientes pueden rastrear órdenes sin autenticación

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:
1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## 👥 Autor

Robert - TechStore E-commerce Platform

## 🙏 Agradecimientos

- React Team
- Express.js Team
- SQLite Team
