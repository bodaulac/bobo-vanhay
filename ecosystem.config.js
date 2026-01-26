module.exports = {
  apps: [{
    name: 'bobo-vanhoc',
    script: 'server.js',
    cwd: '/home/jay/bobo-vanhoc-v2',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production',
      PORT: 3004
    }
  }]
};
