// middleware/upload.js - Multer file upload configuration
const multer = require('multer');

// Memory storage for Supabase uploads
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

// Upload middleware for product images
const productImagesUpload = upload.array('images', 10);

// Upload middleware for single image
const singleImageUpload = upload.single('image');

module.exports = {
    upload,
    productImagesUpload,
    singleImageUpload
};
