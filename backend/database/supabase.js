// database/supabase.js — Supabase adapter (PostgREST + Storage)
// Extracted from the original database.js — same interface, same behavior.
require('dotenv').config();
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local'), override: true });

const { createClient } = require('@supabase/supabase-js');

// --- Supabase client (nullable — app runs in "setup mode" without credentials) ---
let supabase = null;
let dbConfigured = false;

const initSupabase = (url, key) => {
  if (!url || !key) return false;
  try {
    supabase = createClient(url, key);
    dbConfigured = true;
    return true;
  } catch (err) {
    console.error('❌ Error inicializando Supabase:', err.message);
    return false;
  }
};

// Boot: try env vars
if (!initSupabase(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)) {
  console.warn('⚠️  SUPABASE_URL / SUPABASE_KEY no configurados.');
  console.warn('   La app arrancará en modo setup (sin datos).');
  console.warn('   Configura las credenciales en .env y reinicia, o desde Admin Panel → Base de Datos.');
}

// Extract relative storage path from a full Supabase Storage public URL
const getStoragePathFromUrl = (publicUrl) => {
  if (!publicUrl || typeof publicUrl !== 'string') return null;
  const marker = '/storage/v1/object/public/products/';
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;
  const path = publicUrl.slice(index + marker.length);
  return path || null;
};

// Supported product unit types for white-label catalogs
const VALID_PRODUCT_UNIT_TYPES = ['unidad', 'paquete', 'caja', 'docena', 'lb', 'kg', 'g', 'l', 'ml', 'm'];

const normalizeProductUnitType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return VALID_PRODUCT_UNIT_TYPES.includes(normalized) ? normalized : 'unidad';
};

let productUnitTypeColumnSupported = null;
let productIsHiddenColumnSupported = null;

// Backwards compat: older deployments may not have unit_type column
const ensureProductUnitTypeColumnSupport = async () => {
  if (productUnitTypeColumnSupported !== null) return productUnitTypeColumnSupported;
  if (!supabase) {
    productUnitTypeColumnSupported = false;
    return false;
  }
  const { error } = await supabase
    .from('products')
    .select('unit_type')
    .limit(1);
  productUnitTypeColumnSupported = !error;
  return productUnitTypeColumnSupported;
};

// Backwards compat: older deployments may not have is_hidden column
const ensureProductIsHiddenColumnSupport = async () => {
  if (productIsHiddenColumnSupported !== null) return productIsHiddenColumnSupported;
  if (!supabase) {
    productIsHiddenColumnSupported = false;
    return false;
  }
  const { error } = await supabase
    .from('products')
    .select('is_hidden')
    .limit(1);
  productIsHiddenColumnSupported = !error;
  return productIsHiddenColumnSupported;
};

// ---------------------------------------------------------------------------
// statements — all CRUD operations via Supabase PostgREST
// ---------------------------------------------------------------------------
const statements = {

  // ── Storage ──────────────────────────────────────────────
  uploadImage: async (file) => {
    // Strip all metadata (EXIF, GPS, ICC profiles, etc.) for privacy/security
    const sharp = require('sharp');
    const cleanBuffer = await sharp(file.buffer)
      .rotate() // Auto-rotate based on EXIF orientation before stripping
      .withMetadata(false) // Remove all metadata
      .toBuffer();

    // Sanitize filename: lowercase, remove accents, replace non-alphanum with dashes
    const originalName = file.originalname.split('.').slice(0, -1).join('.');
    const fileExt = file.originalname.split('.').pop();
    const sanitizedName = originalName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const fileName = `${sanitizedName}-${Date.now()}.${fileExt}`;
    const filePath = `products/${fileName}`;

    const { data, error } = await supabase.storage
      .from('products')
      .upload(filePath, cleanBuffer, {
        contentType: file.mimetype,
        upsert: false
      });
    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('products')
      .getPublicUrl(filePath);

    return publicUrl;
  },

  // ── Users ────────────────────────────────────────────────
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

  // ── Products ─────────────────────────────────────────────
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

    // Sanitize search input
    const sanitizeSearchInput = (input) => {
      if (!input || typeof input !== 'string') return '';
      return input.replace(/%/g, '').replace(/_/g, '\\_').trim().slice(0, 50);
    };

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' });

    if (search) {
      const safeSearch = sanitizeSearchInput(search);
      if (safeSearch) {
        query = query.or(`name.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`);
      }
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
  createProduct: async (name, description, price, category, stock, unitType = 'unidad') => {
    const supportsUnitType = await ensureProductUnitTypeColumnSupport();
    const payload = { name, description, price, category, stock };
    if (supportsUnitType) {
      payload.unit_type = normalizeProductUnitType(unitType);
    }
    const { data, error } = await supabase
      .from('products')
      .insert([payload])
      .select()
      .single();
    if (error) throw error;
    return { lastInsertRowid: data.id };
  },
  updateProduct: async (name, description, price, category, stock, id, unitType, isHidden) => {
    const supportsUnitType = await ensureProductUnitTypeColumnSupport();
    const supportsIsHidden = await ensureProductIsHiddenColumnSupport();
    const payload = { name, description, price, category, stock, updated_at: new Date().toISOString() };
    if (supportsUnitType && unitType !== undefined) {
      payload.unit_type = normalizeProductUnitType(unitType);
    }
    if (supportsIsHidden && isHidden !== undefined) {
      payload.is_hidden = !!isHidden;
    }
    const { data, error } = await supabase
      .from('products')
      .update(payload)
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

  // ── Stock (atomic via RPC) ───────────────────────────────
  decrementStockIfAvailable: async (product_id, quantity) => {
    const { data, error } = await supabase.rpc('decrement_stock_if_available', {
      p_product_id: product_id,
      p_quantity: quantity
    });
    if (error) throw error;
    return !!data;
  },
  incrementStock: async (product_id, quantity) => {
    const { data, error } = await supabase.rpc('increment_stock', {
      p_product_id: product_id,
      p_quantity: quantity
    });
    if (error) throw error;
    return !!data;
  },

  // ── Product Images ───────────────────────────────────────
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
    // Fetch image path to delete from storage
    const { data: imageRow, error: fetchError } = await supabase
      .from('product_images')
      .select('image_path')
      .eq('id', id)
      .eq('product_id', product_id)
      .single();
    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

    // Delete file from Supabase Storage
    if (imageRow?.image_path) {
      const filePath = getStoragePathFromUrl(imageRow.image_path);
      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from('products')
          .remove([filePath]);
        if (storageError) throw storageError;
      }
    }

    // Delete DB row
    const { error } = await supabase
      .from('product_images')
      .delete()
      .eq('id', id)
      .eq('product_id', product_id);
    if (error) throw error;
    return true;
  },
  deleteAllProductImages: async (product_id) => {
    // Fetch all image paths for batch storage deletion
    const { data: images, error: fetchError } = await supabase
      .from('product_images')
      .select('image_path')
      .eq('product_id', product_id);
    if (fetchError) throw fetchError;

    const paths = (images || [])
      .map((img) => getStoragePathFromUrl(img.image_path))
      .filter(Boolean);

    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('products')
        .remove(paths);
      if (storageError) throw storageError;
    }

    const { error } = await supabase
      .from('product_images')
      .delete()
      .eq('product_id', product_id);
    if (error) throw error;
    return true;
  },

  // ── Product Variants ─────────────────────────────────────
  // Get all variants for a product — includes attributes array
  getVariantsByProduct: async (product_id) => {
    const { data: variants, error } = await supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', product_id)
      .order('created_at', { ascending: true });
    if (error) { console.error('Error getVariantsByProduct:', error); return []; }
    if (!variants || variants.length === 0) return [];

    // Fetch attributes for all variants in one query
    const variantIds = variants.map(v => v.id);
    const { data: attrs, error: attrsError } = await supabase
      .from('product_variant_attributes')
      .select('*')
      .in('variant_id', variantIds);
    if (attrsError) console.error('Error fetching variant attrs:', attrsError);

    // Group attributes by variant_id
    const attrsMap = (attrs || []).reduce((acc, a) => {
      if (!acc[a.variant_id]) acc[a.variant_id] = [];
      acc[a.variant_id].push({ type: a.attribute_type, value: a.attribute_value, color_hex: a.color_hex || null });
      return acc;
    }, {});

    return variants.map(v => ({
      ...v,
      price_override: v.price,
      attributes: attrsMap[v.id] || []
    }));
  },

  // Get a single variant by ID — includes attributes
  getVariantById: async (variant_id) => {
    const { data: variant, error } = await supabase
      .from('product_variants')
      .select('*')
      .eq('id', variant_id)
      .single();
    if (error) { if (error.code !== 'PGRST116') console.error('Error getVariantById:', error); return null; }

    const { data: attrs } = await supabase
      .from('product_variant_attributes')
      .select('*')
      .eq('variant_id', variant_id);

    return {
      ...variant,
      price_override: variant.price,
      attributes: (attrs || []).map(a => ({ type: a.attribute_type, value: a.attribute_value, color_hex: a.color_hex || null }))
    };
  },

  // Create a new variant with its attributes (transactional-style)
  createVariant: async (product_id, { sku, price, stock, image_url, is_active = true, attributes = [] }) => {
    // Insert variant row
    const { data: variant, error } = await supabase
      .from('product_variants')
      .insert([{ product_id, sku: sku || null, price: price ?? null, stock: stock || 0, image_url: image_url || null, is_active }])
      .select()
      .single();
    if (error) throw error;

    // Insert attributes (if any)
    if (attributes.length > 0) {
      const attrRows = attributes.map(a => ({
        variant_id: variant.id,
        attribute_type: a.type,
        attribute_value: a.value,
        color_hex: a.color_hex || null
      }));
      const { error: attrError } = await supabase
        .from('product_variant_attributes')
        .insert(attrRows);
      if (attrError) throw attrError;
    }

    // Mark parent product as has_variants = true
    await supabase
      .from('products')
      .update({ has_variants: true, updated_at: new Date().toISOString() })
      .eq('id', product_id);

    return { ...variant, attributes };
  },

  // Update an existing variant
  updateVariant: async (variant_id, { sku, price, stock, image_url, is_active, attributes }) => {
    // Update variant fields
    const payload = { updated_at: new Date().toISOString() };
    if (sku !== undefined)      payload.sku = sku;
    if (price !== undefined)    payload.price = price;
    if (stock !== undefined)    payload.stock = stock;
    if (image_url !== undefined) payload.image_url = image_url;
    if (is_active !== undefined) payload.is_active = is_active;

    const { data: variant, error } = await supabase
      .from('product_variants')
      .update(payload)
      .eq('id', variant_id)
      .select()
      .single();
    if (error) throw error;

    // Replace attributes if provided
    if (attributes && Array.isArray(attributes)) {
      // Delete old attrs
      await supabase
        .from('product_variant_attributes')
        .delete()
        .eq('variant_id', variant_id);
      // Insert new attrs
      if (attributes.length > 0) {
        const attrRows = attributes.map(a => ({
          variant_id,
          attribute_type: a.type,
          attribute_value: a.value,
          color_hex: a.color_hex || null
        }));
        const { error: attrError } = await supabase
          .from('product_variant_attributes')
          .insert(attrRows);
        if (attrError) throw attrError;
      }
    }

    return { ...variant, attributes: attributes || [] };
  },

  // Delete a variant — cascade deletes its attributes
  deleteVariant: async (variant_id) => {
    // Get product_id before deleting
    const { data: variant } = await supabase
      .from('product_variants')
      .select('product_id')
      .eq('id', variant_id)
      .single();

    const { error } = await supabase
      .from('product_variants')
      .delete()
      .eq('id', variant_id);
    if (error) throw error;

    // Check if parent still has variants → update has_variants flag
    if (variant?.product_id) {
      const { data: remaining } = await supabase
        .from('product_variants')
        .select('id')
        .eq('product_id', variant.product_id)
        .limit(1);
      if (!remaining || remaining.length === 0) {
        await supabase
          .from('products')
          .update({ has_variants: false, updated_at: new Date().toISOString() })
          .eq('id', variant.product_id);
      }
    }
    return true;
  },

  // Get all available attribute types (global catalog)
  getAttributeTypes: async () => {
    const { data, error } = await supabase
      .from('product_attribute_types')
      .select('*')
      .order('name', { ascending: true });
    if (error) { console.error('Error getAttributeTypes:', error); return []; }
    return data || [];
  },

  // ── Variant Stock (atomic via RPC) ───────────────────────
  decrementVariantStock: async (variant_id, quantity) => {
    const { data, error } = await supabase.rpc('decrement_variant_stock', {
      p_variant_id: variant_id,
      p_quantity: quantity
    });
    if (error) throw error;
    return !!data;
  },
  incrementVariantStock: async (variant_id, quantity) => {
    const { data, error } = await supabase.rpc('increment_variant_stock', {
      p_variant_id: variant_id,
      p_quantity: quantity
    });
    if (error) throw error;
    return !!data;
  },

  // ── Cart ─────────────────────────────────────────────────
  getCartByUserId: async (user_id) => {
    const supportsUnitType = await ensureProductUnitTypeColumnSupport();
    const productFields = supportsUnitType
      ? 'name, price, stock, unit_type, image, has_variants, product_images (image_path)'
      : 'name, price, stock, image, has_variants, product_images (image_path)';

    const { data, error } = await supabase
      .from('cart')
      .select(`
        id, product_id, variant_id, quantity,
        products (
          ${productFields}
        ),
        product_variants (
          sku, price, stock, image_url, is_active
        )
      `)
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getCartByUserId:', error);
      return [];
    }

    // Fetch variant attributes for cart items that have a variant
    const variantIds = data.filter(i => i.variant_id).map(i => i.variant_id);
    let variantAttrs = {};
    if (variantIds.length > 0) {
      const { data: attrs } = await supabase
        .from('product_variant_attributes')
        .select('variant_id, attribute_type, attribute_value')
        .in('variant_id', variantIds);
      if (attrs) {
        for (const a of attrs) {
          if (!variantAttrs[a.variant_id]) variantAttrs[a.variant_id] = [];
          variantAttrs[a.variant_id].push({ type: a.attribute_type, value: a.attribute_value });
        }
      }
    }

    return data.map(item => {
      const product = item.products;
      const variant = item.product_variants;
      // Prefer variant image > gallery image > legacy product.image
      let image = variant?.image_url
        || (product.product_images && product.product_images.length > 0
            ? product.product_images[0].image_path
            : product.image);

      // Price: variant override > product price
      const price = (variant?.price != null) ? variant.price : product.price;
      // Stock: variant stock when applicable
      const stock = variant ? variant.stock : product.stock;

      return {
        id: item.id,
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        quantity: item.quantity,
        name: product.name,
        price,
        stock,
        unit_type: normalizeProductUnitType(product.unit_type),
        image,
        variant_attributes: variantAttrs[item.variant_id] || null
      };
    });
  },
  // variant_id is optional — null for non-variant products
  addToCart: async (user_id, product_id, quantity, variant_id = null) => {
    const row = { user_id, product_id, quantity, updated_at: new Date().toISOString() };
    if (variant_id) row.variant_id = variant_id;
    const { data, error } = await supabase
      .from('cart')
      .insert(row);
    if (error) throw error;
    return data;
  },
  updateCartItem: async (quantity, user_id, product_id, variant_id = null) => {
    let query = supabase
      .from('cart')
      .update({ quantity, updated_at: new Date().toISOString() })
      .eq('user_id', user_id)
      .eq('product_id', product_id);
    // Filter by variant: explicit null vs. actual value
    query = variant_id ? query.eq('variant_id', variant_id) : query.is('variant_id', null);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  removeFromCart: async (user_id, product_id, variant_id = null) => {
    let query = supabase
      .from('cart')
      .delete()
      .eq('user_id', user_id)
      .eq('product_id', product_id);
    query = variant_id ? query.eq('variant_id', variant_id) : query.is('variant_id', null);
    const { error } = await query;
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
  getCartItem: async (user_id, product_id, variant_id = null) => {
    let query = supabase
      .from('cart')
      .select('*')
      .eq('user_id', user_id)
      .eq('product_id', product_id);
    query = variant_id ? query.eq('variant_id', variant_id) : query.is('variant_id', null);
    const { data, error } = await query.single();
    if (error && error.code !== 'PGRST116') console.error('Error getCartItem:', error);
    return data;
  },

  // ── Orders ───────────────────────────────────────────────
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
      .select(`*, users (name, email)`)
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
      .select(`*, users (name, email)`, { count: 'exact' });

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
  getOrderCounts: async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('status');
    if (error) {
      console.error('Error getOrderCounts:', error);
      return {};
    }
    return data.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});
  },
  getOrderWithCustomerById: async (id) => {
    const { data, error } = await supabase
      .from('orders')
      .select(`*, users (name, email)`)
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
      .select(`*, users (name, email)`)
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
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .ilike('email', email)
        .maybeSingle();

      if (!userData?.id) return [];

      const { data, error } = await supabase
        .from('orders')
        .select('*, users (name, email)')
        .eq('user_id', userData.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error getOrdersByEmail:', error);
        return [];
      }
      return (data || []).map(order => ({
        ...order,
        customer_name: order.users ? order.users.name : order.customer_name,
        customer_email: order.users ? order.users.email : order.customer_email
      }));
    } catch (err) {
      console.error('Error global en getOrdersByEmail:', err);
      return [];
    }
  },

  // ── Order Items ──────────────────────────────────────────
  // variant_id and variant_attributes are optional (null for non-variant items)
  addOrderItem: async (order_id, product_id, quantity, price, variant_id = null, variant_attributes = null) => {
    const row = { order_id, product_id, quantity, price };
    if (variant_id) row.variant_id = variant_id;
    if (variant_attributes) row.variant_attributes = variant_attributes;
    const { data, error } = await supabase
      .from('order_items')
      .insert([row]);
    if (error) throw error;
    return data;
  },
  getOrderItems: async (order_id) => {
    const supportsUnitType = await ensureProductUnitTypeColumnSupport();
    const orderItemProductFields = supportsUnitType
      ? 'name, unit_type, image, product_images (image_path)'
      : 'name, image, product_images (image_path)';

    const { data, error } = await supabase
      .from('order_items')
      .select(`*, products ( ${orderItemProductFields} )`)
      .eq('order_id', order_id);

    if (error) {
      console.error('Error getOrderItems:', error);
      return [];
    }

    return data.map(item => {
      let itemImage = item.products?.image;
      if (!itemImage && item.products?.product_images && item.products.product_images.length > 0) {
        itemImage = item.products.product_images[0].image_path;
      }
      return {
        ...item,
        name: item.products?.name || 'Producto eliminado',
        unit_type: normalizeProductUnitType(item.products?.unit_type),
        image: itemImage || null,
        // Include variant snapshot for display
        variant_id: item.variant_id || null,
        variant_attributes: item.variant_attributes || null
      };
    });
  },

  // ── Users Admin ──────────────────────────────────────────
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

  // ── Verification Codes ───────────────────────────────────
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
  },

  // ── App Settings ─────────────────────────────────────────
  getSettings: async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*');
    if (error) {
      if (error.code === 'PGRST116' || error.code === 'PGRST205' || error.message.includes('not found')) return [];
      throw error;
    }
    return data;
  },
  updateSetting: async (key, value) => {
    const stringValue = typeof value === 'string' ? value : String(value);
    const { data, error } = await supabase
      .from('app_settings')
      .upsert({ id: key, value: stringValue }, { onConflict: 'id' });
    if (error) {
      if (error.code === 'PGRST205' || error.message.includes('not found')) {
        throw new Error('La tabla "app_settings" no existe en la base de datos. Por favor, ejecuta el script de migración en Supabase.');
      }
      throw error;
    }
    return data;
  },

  // ── Token Blacklist ──────────────────────────────────────
  addToBlacklist: async (tokenHash, sessionId, userId, expiresAt, reason = 'logout') => {
    const { data, error } = await supabase
      .from('token_blacklist')
      .insert([{
        token_hash: tokenHash,
        session_id: sessionId,
        user_id: userId,
        expires_at: expiresAt,
        reason
      }])
      .select()
      .single();
    if (error) {
      if (error.code === 'PGRST205' || error.message.includes('not found')) {
        console.warn('⚠️ token_blacklist table not found. Using in-memory fallback.');
        return null;
      }
      throw error;
    }
    return data;
  },
  isTokenBlacklisted: async (tokenHash) => {
    const { data, error } = await supabase
      .from('token_blacklist')
      .select('id')
      .eq('token_hash', tokenHash)
      .gt('expires_at', new Date().toISOString())
      .limit(1);
    if (error) {
      if (error.code === 'PGRST205' || error.message.includes('not found')) {
        return false;
      }
      throw error;
    }
    return data && data.length > 0;
  },
  revokeAllUserSessions: async (userId, exceptSessionId = null) => {
    console.log(`Revoking all sessions for user ${userId} except ${exceptSessionId}`);
    return true;
  },
  cleanupExpiredBlacklistTokens: async () => {
    const { error } = await supabase
      .from('token_blacklist')
      .delete()
      .lt('expires_at', new Date().toISOString());
    if (error && error.code !== 'PGRST205') {
      console.error('Error cleaning up blacklist:', error);
    }
    return true;
  }
};

// ---------------------------------------------------------------------------
// Reinitialize / Disconnect — hot-swap credentials at runtime
// ---------------------------------------------------------------------------
const reinitializeDb = (url, key) => initSupabase(url, key);

const disconnectDb = () => {
  supabase = null;
  dbConfigured = false;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_KEY;
  console.log('⚠️  Base de datos desconectada — app en modo setup.');
  return true;
};

// ---------------------------------------------------------------------------
// Safe proxy: throws DB_NOT_CONFIGURED if client is null
// ---------------------------------------------------------------------------
const safeStatements = new Proxy(statements, {
  get(target, prop) {
    const original = target[prop];
    if (typeof original !== 'function') return original;
    return async (...args) => {
      if (!supabase) {
        const err = new Error('Base de datos no configurada. Añade SUPABASE_URL y SUPABASE_KEY en .env o desde Admin Panel.');
        err.code = 'DB_NOT_CONFIGURED';
        err.statusCode = 503;
        throw err;
      }
      return original.apply(target, args);
    };
  }
});

// Test connection with a lightweight query (used by settings db-status endpoint)
const testConnection = async () => {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('app_settings').select('id').limit(1);
    return !error;
  } catch { return false; }
};

module.exports = {
  get supabase() { return supabase; },
  provider: 'supabase',                       // Provider identifier
  statements: safeStatements,
  dbConfigured: () => dbConfigured,
  reinitializeDb,
  disconnectDb,
  testConnection
};
