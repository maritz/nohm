var nodeunit = require('nodeunit');

// testrunner copied from nodeunit and edited a little
var run = function(files) {
  nodeunit.reporters['default'].run(files, undefined, function(error) {
    cleanup(function() {
      redis.end();
      secondaryRedis.end();
      process.exit(error ? 1 : 0);
    });
  });
};

var args = require(__dirname + '/testArgs.js');

var runner = function() {
  process.chdir(__dirname);
  run([
    'featureTests.js',
    'validationTests.js',
    'relationTests.js',
    'findTests.js',
    'middlewareTests.js',
    'metaTests.js',
    '../tsOut/tests.js', // needs to be before pubsubtests, so that the pubsub client is still connected
    'pubsubTests.js',
    'redisHelperTests.js',
    'regressions.js',
  ]);
};

var redis = args.redis,
  secondaryRedis = args.secondaryClient,
  cleanup = function(cb, force) {
    if (!force && args.noCleanup === true) return cb();
    require('./helper.js').cleanUp(redis, args.prefix, cb);
  },
  Nohm = require(__dirname + '/../tsOut/').Nohm;
Nohm.setPrefix(args.prefix);
cleanup(runner, true);
