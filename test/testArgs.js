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

if (process.env.NOHM_TEST_IOREDIS == 'true') {
  const Redis = require('ioredis');

  exports.redis = new Redis({
    port: exports.redis_port,
    host: exports.redis_host,
    password: exports.redis_auth,
  });

  exports.secondaryClient = new Redis({
    port: exports.redis_port,
    host: exports.redis_host,
    password: exports.redis_auth,
  });
} else {
  exports.redis = require('redis').createClient(
    exports.redis_port,
    exports.redis_host,
    {
      auth_pass: exports.redis_auth,
      retry_strategy: function(options) {
        console.error(
          '\nFailed to connect to primary redis:',
          options.error,
          '\n',
        );
        return null;
      },
    },
  );

  exports.secondaryClient = require('redis').createClient(
    exports.redis_port,
    exports.redis_host,
    {
      auth_pass: exports.redis_auth,
      retry_strategy: function(options) {
        console.error(
          '\nFailed to connect to secondary redis:',
          options.error,
          '\n',
        );
        return null;
      },
    },
  );
}

exports.setClient = (nohm, client) => {
  return new Promise((resolve) => {
    if (!client) {
      client = exports.redis;
    }
    client.on('ready', () => {
      nohm.setClient(client);
      resolve(true);
    });
  });
};
