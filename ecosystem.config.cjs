module.exports = {
  apps: [{
    name: 'qd209',
    script: 'backend/server.ts',
    interpreter: 'node',
    interpreter_args: '--import tsx',
    cwd: '/var/www/QD209',
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DATABASE_URL: 'postgresql://qd209:qd209_secret_2026@localhost:5432/logipro'
    },
    max_memory_restart: '512M',
    instances: 1,
    autorestart: true,
    watch: false,
  }]
};
