const cluster = require('cluster');
const os = require('os');

if (cluster.isPrimary) {
  const cpuCount = Math.max(os.cpus().length, 2);

  console.log(`Primary ${process.pid} running`);
  console.log(`Forking ${cpuCount} workers`);

  for (let i = 0; i < cpuCount; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker) => {
    console.error(`Worker ${worker.process.pid} died. Restarting.`);
    cluster.fork();
  });
} else {
  require('./app');
}