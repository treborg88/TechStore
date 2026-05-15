// middleware/upload.js - Multer file upload configuration
const multer = require('multer');
const { tenantContext } = require('../database');

// Memory storage for file uploads
const storage = multer.memoryStorage();

// File filter for images only
const imageFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten archivos de imagen (jpeg, jpg, png, gif, webp)'), false);
    }
};

// Main upload configuration
const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit per file
        files: 10 // Max 10 files
    },
    fileFilter: imageFilter
});

// Wrap Multer middleware to preserve tenant DB async context.
// Some callback-based middleware can drop AsyncLocalStorage state.
const preserveTenantContext = (multerMiddleware) => (req, res, next) => {
    const store = tenantContext.getStore();
    multerMiddleware(req, res, (err) => {
        if (!store || !store.client) {
            return next(err);
        }
        tenantContext.run(store, () => next(err));
    });
};

// Upload middleware for product images
const productImagesUpload = preserveTenantContext(upload.array('images', 10));

// Upload middleware for single image
const singleImageUpload = preserveTenantContext(upload.single('image'));

module.exports = {
    upload,
    productImagesUpload,
    singleImageUpload
};
