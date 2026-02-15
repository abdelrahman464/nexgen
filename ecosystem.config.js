module.exports = {
  apps: [
    {
      name: "MAIN SERVER",
      script: "./server.js",
      instances: 1,
      exec_mode: "fork",
      cwd: "/home/nexgen-academy-api/htdocs/api.nexgen-academy.com",
      
      // Auto-restart configuration
      autorestart: true, // Enable auto-restart (default: true)
      watch: false, // Don't watch for file changes in production
      max_memory_restart: "1G", // Restart if memory exceeds 1GB
      
      // Restart policy for crashes
      max_restarts: 10, // Max restarts in 1 minute
      min_uptime: "10s", // Min uptime before considering it stable
      restart_delay: 4000, // Wait 4 seconds before restart
      
      // Environment variables
      env: {
        NODE_ENV: "production",
      },
      env_development: {
        NODE_ENV: "development",
      },
      
      // Logging - matching current PM2 log paths
      error_file: "/root/.pm2/logs/MAIN-SERVER-error.log",
      out_file: "/root/.pm2/logs/MAIN-SERVER-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      
      // Advanced restart conditions
      exp_backoff_restart_delay: 100, // Exponential backoff restart delay
      
      // Kill timeout (time to wait before force kill)
      kill_timeout: 5000,
      
      // Listen for shutdown signals
      listen_timeout: 10000,
      shutdown_with_message: true,
    },
  ],
};
