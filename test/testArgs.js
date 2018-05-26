(exports.prefix = 'nohmtests'),
  (exports.noCleanup = false),
  (exports.setMeta = false),
  (exports.redis_host = '127.0.0.1'),
  (exports.redis_port = 6379);
exports.redis_auth = false;

process.argv.forEach(function(val, index) {
  if (val === '--nohm-prefix') {
    exports.prefix = process.argv[index + 1];
  }
  if (val === '--no-cleanup') {
    exports.noCleanup = true;
  }
  if (val === '--redis-host') {
    exports.redis_host = process.argv[index + 1];
  }
  if (val === '--redis-port') {
    exports.redis_port = process.argv[index + 1];
  }
  if (val === '--redis-auth') {
    exports.redis_auth = process.argv[index + 1];
  }
});

exports.redis = require('redis').createClient(
  exports.redis_port,
  exports.redis_host,
  {
    auth_pass: exports.redis_auth,
  },
);

/**
 * 
const Redis = require('ioredis');
const client = exports.redis = new Redis({
  port: exports.port,
  host: exports.host,
  password: exports.redis_auth,
});

client.connected = false;

setInterval(() => {
  if (!client.connected && client.status === 'ready') {
    client.connected = true;
  }
})
 */
