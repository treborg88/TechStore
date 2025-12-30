require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: SUPABASE_URL y SUPABASE_KEY deben estar definidos en el archivo .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper functions to mimic the old "statements" behavior but with Supabase (Async)
const statements = {
  // Storage
  uploadImage: async (file) => {
    // Obtener nombre sin extensión y sanitizarlo
    const originalName = file.originalname.split('.').slice(0, -1).join('.');
    const fileExt = file.originalname.split('.').pop();
    
    // Sanitización: minúsculas, quitar acentos, reemplazar espacios y caracteres especiales por guiones
    const sanitizedName = originalName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
      .replace(/[^a-z0-9]/g, '-')      // Reemplazar no alfanuméricos por guiones
      .replace(/-+/g, '-')             // Quitar guiones duplicados
      .replace(/^-|-$/g, '');          // Quitar guiones al inicio o final

    // Añadir un pequeño sufijo único para evitar colisiones si dos archivos se llaman igual
    const fileName = `${sanitizedName}-${Date.now()}.${fileExt}`;
    const filePath = `products/${fileName}`;

    const { data, error } = await supabase.storage
      .from('products')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('products')
      .getPublicUrl(filePath);

    return publicUrl;
  },

  // Users
  getUserById: async (id) => {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, phone, street, sector, city, country, is_active, is_guest, created_at, updated_at, last_login')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') console.error('Error getUserById:', error);
    return data;
  },
  getUserByEmail: async (email) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    if (error && error.code !== 'PGRST116') console.error('Error getUserByEmail:', error);
    return data;
  },
  createUser: async (name, email, password, role, is_guest) => {
    const { data, error } = await supabase
      .from('users')
      .insert([{ name, email, password, role, is_guest: !!is_guest }])
      .select()
      .single();
    if (error) throw error;
    return { lastInsertRowid: data.id };
  },
  updateUser: async (name, phone, street, sector, city, country, id) => {
    const { data, error } = await supabase
      .from('users')
      .update({ name, phone, street, sector, city, country, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  },
  updateUserPassword: async (password, id) => {
    const { data, error } = await supabase
      .from('users')
      .update({ password, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  },
  updateLastLogin: async (id) => {
    const { data, error } = await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return data;
  },

  // Products
  getAllProducts: async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error('Error getAllProducts:', error);
    return data || [];
  },
  getProductsPaginated: async (page = 1, limit = 20, search = '', category = '') => {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error getProductsPaginated:', error);
      return { data: [], total: 0 };
    }
    return { data, total: count };
  },
  getProductById: async (id) => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') console.error('Error getProductById:', error);
    return data;
  },
  getProductsByCategory: async (category) => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('category', category)
      .order('created_at', { ascending: false });
    if (error) console.error('Error getProductsByCategory:', error);
    return data || [];
  },
  createProduct: async (name, description, price, category, stock) => {
    const { data, error } = await supabase
      .from('products')
      .insert([{ name, description, price, category, stock }])
      .select()
      .single();
    if (error) throw error;
    return { lastInsertRowid: data.id };
  },
  updateProduct: async (name, description, price, category, stock, id) => {
    const { data, error } = await supabase
      .from('products')
      .update({ name, description, price, category, stock, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  },
  deleteProduct: async (id) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  },

  // Product Images
  getProductImages: async (product_id) => {
    const { data, error } = await supabase
      .from('product_images')
      .select('*')
      .eq('product_id', product_id)
      .order('created_at', { ascending: true });
    if (error) console.error('Error getProductImages:', error);
    return data || [];
  },
  addProductImage: async (product_id, image_path) => {
    const { data, error } = await supabase
      .from('product_images')
      .insert([{ product_id, image_path }]);
    if (error) throw error;
    return data;
  },
  deleteProductImage: async (id, product_id) => {
    const { error } = await supabase
      .from('product_images')
      .delete()
      .eq('id', id)
      .eq('product_id', product_id);
    if (error) throw error;
    return true;
  },
  deleteAllProductImages: async (product_id) => {
    const { error } = await supabase
      .from('product_images')
      .delete()
      .eq('product_id', product_id);
    if (error) throw error;
    return true;
  },

  // Cart
  getCartByUserId: async (user_id) => {
    const { data, error } = await supabase
      .from('cart')
      .select(`
        id, product_id, quantity,
        products (
          name, price, stock, image,
          product_images (image_path)
        )
      `)
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error getCartByUserId:', error);
      return [];
    }

    return data.map(item => {
      const product = item.products;
      // Priorizar la primera imagen de la galería (product_images) ya que es la que se migra a Supabase
      let image = (product.product_images && product.product_images.length > 0) 
        ? product.product_images[0].image_path 
        : product.image;
      
      return {
        id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        name: product.name,
        price: product.price,
        stock: product.stock,
        image: image
      };
    });
  },
  addToCart: async (user_id, product_id, quantity) => {
    const { data, error } = await supabase
      .from('cart')
      .upsert({ user_id, product_id, quantity, updated_at: new Date().toISOString() }, { onConflict: 'user_id, product_id' });
    if (error) throw error;
    return data;
  },
  updateCartItem: async (quantity, user_id, product_id) => {
    const { data, error } = await supabase
      .from('cart')
      .update({ quantity, updated_at: new Date().toISOString() })
      .eq('user_id', user_id)
      .eq('product_id', product_id);
    if (error) throw error;
    return data;
  },
  removeFromCart: async (user_id, product_id) => {
    const { error } = await supabase
      .from('cart')
      .delete()
      .eq('user_id', user_id)
      .eq('product_id', product_id);
    if (error) throw error;
    return true;
  },
  clearCart: async (user_id) => {
    const { error } = await supabase
      .from('cart')
      .delete()
      .eq('user_id', user_id);
    if (error) throw error;
    return true;
  },
  getCartItem: async (user_id, product_id) => {
    const { data, error } = await supabase
      .from('cart')
      .select('*')
      .eq('user_id', user_id)
      .eq('product_id', product_id)
      .single();
    if (error && error.code !== 'PGRST116') console.error('Error getCartItem:', error);
    return data;
  },

  // Orders
  createOrder: async (user_id, total, shipping_address, payment_method, customer_name, customer_email, customer_phone, shipping_street, shipping_city, shipping_postal_code, shipping_sector) => {
    const { data, error } = await supabase
      .from('orders')
      .insert([{ 
        user_id, total, shipping_address, payment_method, 
        customer_name, customer_email, customer_phone, 
        shipping_street, shipping_city, shipping_postal_code, shipping_sector 
      }])
      .select()
      .single();
    if (error) throw error;
    return { lastInsertRowid: data.id };
  },
  getOrdersByUserId: async (user_id) => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });
    if (error) console.error('Error getOrdersByUserId:', error);
    return data || [];
  },
  getOrderById: async (id) => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') console.error('Error getOrderById:', error);
    return data;
  },
  updateOrderStatus: async (status, id) => {
    const { data, error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  },
  updateOrder: async (id, updates) => {
    const { data, error } = await supabase
      .from('orders')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  },
  updateOrderNumber: async (order_number, id) => {
    const { data, error } = await supabase
      .from('orders')
      .update({ order_number })
      .eq('id', id)
      .select();
    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  },
  deleteOrder: async (id) => {
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  },
  getAllOrdersWithCustomer: async () => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        users (name, email)
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error getAllOrdersWithCustomer:', error);
      return [];
    }

    return data.map(order => ({
      ...order,
      customer_name: order.users ? order.users.name : order.customer_name,
      customer_email: order.users ? order.users.email : order.customer_email
    }));
  },
  getOrdersPaginated: async (page = 1, limit = 20, search = '', status = 'all', paymentType = 'all', type = 'all') => {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('orders')
      .select(`
        *,
        users (name, email)
      `, { count: 'exact' });

    if (status !== 'all') query = query.eq('status', status);
    if (paymentType === 'online') query = query.neq('payment_method', 'cash');
    if (paymentType === 'cod') query = query.eq('payment_method', 'cash');
    if (type === 'registered') query = query.not('user_id', 'is', null);
    if (type === 'guest') query = query.is('user_id', null);

    if (search) {
        const searchNum = isNaN(search) ? -1 : search;
        query = query.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%,id.eq.${searchNum}`);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error getOrdersPaginated:', error);
      return { data: [], total: 0 };
    }

    const formattedData = data.map(order => ({
      ...order,
      customer_name: order.users ? order.users.name : order.customer_name,
      customer_email: order.users ? order.users.email : order.customer_email
    }));

    return { data: formattedData, total: count };
  },
  getOrderWithCustomerById: async (id) => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        users (name, email)
      `)
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code !== 'PGRST116') console.error('Error getOrderWithCustomerById:', error);
      return null;
    }

    return {
      ...data,
      customer_name: data.users ? data.users.name : data.customer_name,
      customer_email: data.users ? data.users.email : data.customer_email
    };
  },
  getOrderByNumber: async (order_number) => {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        users (name, email)
      `)
      .eq('order_number', order_number)
      .single();
    
    if (error) {
      if (error.code !== 'PGRST116') console.error('Error getOrderByNumber:', error);
      return null;
    }

    return {
      ...data,
      customer_name: data.users ? data.users.name : data.customer_name,
      customer_email: data.users ? data.users.email : data.customer_email
    };
  },
  getOrdersByEmail: async (email) => {
    // This is a bit more complex because we need to check both orders.customer_email and users.email
    // We'll do two queries or a complex one. Let's do a simple approach.
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        users (name, email)
      `)
      .or(`customer_email.ilike.${email},users.email.ilike.${email}`)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error getOrdersByEmail:', error);
      return [];
    }

    return data.map(order => ({
      ...order,
      customer_name: order.users ? order.users.name : order.customer_name,
      customer_email: order.users ? order.users.email : order.customer_email
    }));
  },

  // Order Items
  addOrderItem: async (order_id, product_id, quantity, price) => {
    const { data, error } = await supabase
      .from('order_items')
      .insert([{ order_id, product_id, quantity, price }]);
    if (error) throw error;
    return data;
  },
  getOrderItems: async (order_id) => {
    const { data, error } = await supabase
      .from('order_items')
      .select(`
        *,
        products (name, image)
      `)
      .eq('order_id', order_id);
    
    if (error) {
      console.error('Error getOrderItems:', error);
      return [];
    }

    return data.map(item => ({
      ...item,
      name: item.products.name,
      image: item.products.image
    }));
  },

  // Users Admin
  getAllUsers: async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, is_active, created_at, updated_at, last_login')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error getAllUsers:', error);
      return [];
    }
    return data;
  },
  getUsersPaginated: async (page = 1, limit = 20, search = '', role = 'all', status = 'all') => {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('users')
      .select('id, name, email, role, is_active, created_at, updated_at, last_login', { count: 'exact' });

    if (role !== 'all') query = query.eq('role', role);
    if (status === 'active') query = query.eq('is_active', true);
    if (status === 'inactive') query = query.eq('is_active', false);

    if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error getUsersPaginated:', error);
      return { data: [], total: 0 };
    }

    return { data, total: count };
  },
  updateUserRole: async (role, id) => {
    const { data, error } = await supabase
      .from('users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  },
  updateUserStatus: async (is_active, id) => {
    const { data, error } = await supabase
      .from('users')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  },

  // Verification Codes
  createVerificationCode: async (email, code, purpose, expires_at) => {
    const { data, error } = await supabase
      .from('verification_codes')
      .insert([{ email, code, purpose, expires_at }]);
    if (error) throw error;
    return data;
  },
  getVerificationCode: async (email, code, purpose) => {
    const { data, error } = await supabase
      .from('verification_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('purpose', purpose)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') console.error('Error getVerificationCode:', error);
    return data;
  },
  deleteVerificationCodes: async (email, purpose) => {
    const { error } = await supabase
      .from('verification_codes')
      .delete()
      .eq('email', email)
      .eq('purpose', purpose);
    if (error) throw error;
    return true;
  },
  cleanupExpiredCodes: async () => {
    const { error } = await supabase
      .from('verification_codes')
      .delete()
      .lte('expires_at', new Date().toISOString());
    if (error) throw error;
    return true;
  }
};

module.exports = { supabase, statements };
