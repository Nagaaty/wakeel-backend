module.exports = {
  apps: [
    {
      name: "wakeel-backend",
      script: "./src/index.js",
      instances: "max",       // Clones the app across all available CPU cores!
      exec_mode: "cluster",   // Enables Node.js cluster mode
      watch: false,           // Do not watch in production to save CPU
      env: {
        NODE_ENV: "production",
        PORT: 5001
      }
    }
  ]
};
