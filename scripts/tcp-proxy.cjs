const net = require('net');

const LOCAL_PORT = 11434;
const TARGET_HOST = '100.124.196.33';
const TARGET_PORT = 11434;

const server = net.createServer((localSocket) => {
  const remoteSocket = net.connect(TARGET_PORT, TARGET_HOST, () => {
    localSocket.pipe(remoteSocket);
    remoteSocket.pipe(localSocket);
  });

  localSocket.on('error', (err) => {
    remoteSocket.end();
  });

  remoteSocket.on('error', (err) => {
    localSocket.end();
  });
});

server.listen(LOCAL_PORT, '0.0.0.0', () => {
  console.log(`TCP Proxy listening on port ${LOCAL_PORT} -> ${TARGET_HOST}:${TARGET_PORT}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
});
