/**
 * PM2 Ecosystem Configuration
 * Manages both backend and frontend processes for production deployment
 * 
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 restart all
 *   pm2 stop all
 *   pm2 logs
 */

module.exports = {
  apps: [
    // ===================
    // Express Backend API
    // ===================
    {
      name: 'backend',
      cwd: './backend',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5001
      },
      // Restart behavior
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      // Watch for changes (disable in production)
      watch: false,
      // Logging
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      merge_logs: true,
      time: true,
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000
    },

    // ===================
    // Vite Frontend (Preview Mode)
    // ===================
    // Uses Vite preview server to serve the built dist/ folder
    {
      name: 'frontend',
      cwd: './frontend',
      script: 'npm',
      args: 'run preview -- --host 0.0.0.0 --port 5173',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      // Restart behavior
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      // Watch for changes (disable in production)
      watch: false,
      // Logging
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      merge_logs: true,
      time: true,
      // Graceful shutdown
      kill_timeout: 5000
    }
  ],

  // ===================
  // Deployment Configuration
  // ===================
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'git@github.com:YOUR_USERNAME/mi-tienda-online2.git',
      path: '/var/www/demotechstore',
      'pre-deploy-local': '',
      'post-deploy': 
        'npm install && ' +
        'cd backend && npm install && cd .. && ' +
        'cd frontend && npm install && npm run build && cd .. && ' +
        'pm2 reload ecosystem.config.cjs --env production',
      'pre-setup': ''
    }
  }
};
