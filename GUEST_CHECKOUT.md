# Guest Checkout (Compra como Invitado)

## Descripción
Los clientes pueden realizar compras sin necesidad de crear una cuenta. El sistema detecta automáticamente si el usuario está autenticado y usa el flujo correspondiente.

## Flujo de Compra

### Para Usuarios Autenticados
1. Usuario agrega productos al carrito
2. Click en "Finalizar Compra"
3. Completa formulario (3 pasos)
4. Sistema usa token JWT y endpoint `/api/orders`
5. Orden asociada al user_id del token
6. Confirmación y limpieza del carrito

### Para Usuarios Invitados (Guest)
1. Usuario agrega productos al carrito (sin login)
2. Click en "Finalizar Compra"
3. Completa formulario (3 pasos: Datos, Envío, Pago)
4. Sistema detecta ausencia de token
5. Usa endpoint `/api/orders/guest`
6. Backend verifica si existe usuario con ese email:
   - **Si existe**: Asocia la orden a ese user_id
   - **Si NO existe**: Crea usuario tipo 'customer' con:
     - `name`: firstName + lastName
     - `email`: email del formulario
     - `password`: NULLo (no puede hacer login)
     - `role`: 'custmer'
     - `is_active`: 1
7. Guarda información de contacto en `shipping_address`
8. Confirmación con sugerencia de crear cuenta

## Endpoints Backend

### POST `/api/orders/guest`
**Sin autenticación requerida**

**Request Body:**
```json
{
  "shipping_address": "Calle 123, Ciudad, CP 12345",
  "items": [
    { "product_id": 1, "quantity": 2 },
    { "product_id": 3, "quantity": 1 }
  ],
  "customer_info": {
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "phone": "+52 555 1234567"
  }
}
```

**Response:**
```json
{
  "id": 15,
  "user_id": 8,
  "total": 150.00,
  "status": "pending",
  "shipping_address": "Calle 123, Ciudad, CP 12345. Tel: +52 555 1234567. Contacto: Juan Pérez",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### POST `/api/orders`
**Autenticación requerida** (Bearer Token)

**Request Body:**
```json
{
  "shipping_address": "Dirección completa con teléfono y contacto",
  "items": [
    { "product_id": 1, "quantity": 2 }
  ]
}
```

## Validaciones

### Stock
Ambos endpoints validan disponibilidad de stock antes de crear la orden:
- Verifica `product.stock >= quantity`
- Actualiza stock: `stock - quantity`
- Si no hay suficiente stock, retorna error 400

### Email
En modo guest:
- Si email ya existe: Asocia orden al usuario existente
- Si email no existe: Crea nuevo usuario automáticamente
- Usuarios creados automáticamente NO tienen password (no pueden loguearse hasta establecer una)

## Diferencias en UI

### Pantalla de Confirmación

**Usuario Autenticado:**
```
✅ ¡Pedido Confirmado!
Orden #15
Tu pedido ha sido recibido y está siendo procesado.
```

**Usuario Invitado:**
```
✅ ¡Pedido Confirmado!
Orden #15
Tu pedido ha sido recibido y está siendo procesado.
📧 Recibirás la confirmación en juan@example.com

💡 Tip: Crea una cuenta para hacer seguimiento de tus pedidos.
```

## Panel Administrativo

Los administradores pueden ver todas las órdenes (autenticadas y guest) en la sección "Órdenes" del panel admin:
- ID de orden
- Nombre del cliente (extraído de users)
- Email del cliente
- Total
- Estado
- Fecha de creación
- Acciones (Ver detalles, Cambiar estado)

## Base de Datos

### Tabla: users
```sql
id | name           | email              | password | role     | is_active
1  | Admin User     | admin@example.com  | hashed   | admin    | 1
5  | Cliente Normal | cliente@gmail.com  | hashed   | customer | 1
8  | Juan Pérez     | juan@example.com   | NULL     | customer | 1  -- Guest
```

### Tabla: orders
```sql
id | user_id | total  | status    | shipping_address                        | created_at
15 | 8       | 150.00 | pending   | Calle 123... Tel: +52 555... Juan Pérez | 2024-01-15...
```

### Tabla: order_items
```sql
id | order_id | product_id | quantity | price
45 | 15       | 1          | 2        | 50.00
46 | 15       | 3          | 1        | 50.00
```

## Métodos de Pago Disponibles

### Activos ✅
1. **💵 Pago Contra Entrega (Efectivo)**
   - Pago al recibir el producto
   - No requiere anticipos
   - Cliente prepara monto exacto

2. **🏦 Transferencia Bancaria**
   - Transferencia o depósito bancario
   - Requiere enviar comprobante por email
   - Orden se procesa al confirmar pago

### Próximamente 🔜
3. **💳 Pago en Línea** (PayPal, Stripe, MercadoPago)
4. **💳 Tarjeta de Crédito/Débito** (Visa, MasterCard, American Express)

## Notas Técnicas

1. **Seguridad**: El endpoint guest NO requiere autenticación, pero valida todos los datos de entrada
2. **Duplicados**: Si un invitado usa el mismo email múltiples veces, todas las órdenes se asocian al mismo user_id
3. **Conversión a cuenta**: Los usuarios guest pueden convertirse en usuarios regulares si establecen una contraseña (funcionalidad pendiente)
4. **Cart**: El carrito se mantiene en localStorage hasta completar la compra, tanto para usuarios autenticados como invitados

## Próximas Mejoras

- [ ] Email de confirmación automático
- [ ] Link para establecer contraseña y convertir cuenta guest en regular
- [ ] Historial de órdenes para usuarios guest (usando email como identificador)
- [ ] Integración con pasarela de pago real
- [ ] Seguimiento de envío
