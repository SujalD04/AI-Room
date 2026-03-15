module.exports = {
  apps: [
    {
      name: 'airoom-server',
      script: 'dist/index.js',
      cwd: './apps/server',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      combine_logs: true,
      time: true,
    },
  ],
};
