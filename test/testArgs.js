exports.prefix = 'nohmtests',
exports.noCleanup = false,
exports.setMeta = false,
exports.redis_host = '127.0.0.1',
exports.redis_port = 6379;

process.argv.forEach(function (val, index) {
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
});

exports.redis = require('redis').createClient(exports.redis_port, exports.redis_host);