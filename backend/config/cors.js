// config/cors.js - CORS configuration
const cors = require('cors');

const corsOptions = {
    origin: [
        'https://6sfq7hfx-5173.use2.devtunnels.ms',
        'https://6sfq7hfx-5001.use2.devtunnels.ms',
        'http://192.168.100.41:5173',
        'http://143.47.118.165:5173',
        'http://192.168.100.41:5001',
        'http://143.47.118.165',
        'http://localhost:5173',
        'http://localhost:5001'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    optionsSuccessStatus: 200
};

// Middleware to add headers to all responses
const corsHeaders = (req, res, next) => {
    const origin = req.headers.origin;
    if (corsOptions.origin.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
};

module.exports = {
    corsMiddleware: cors(corsOptions),
    corsHeaders,
    corsOptions
};
