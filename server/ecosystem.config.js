module.exports = {
  apps: [{
    name: 'bingo-server',
    script: 'index.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: { NODE_ENV: 'development', PORT: 3001 },
    env_production: { NODE_ENV: 'production', PORT: 3001 },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
};
