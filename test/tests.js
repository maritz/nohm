var nodeunit = require('nodeunit');

// testrunner copied from nodeunit and edited a little
var run = function(files){

    var red   = function(str){return "\033[31m" + str + "\033[39m"};
    var green = function(str){return "\033[32m" + str + "\033[39m"};
    var bold  = function(str){return "\033[1m" + str + "\033[22m"};

    nodeunit.reporters['default'].run(files, undefined, function (error) {
      cleanup(function () {
        redis.end();
        process.exit();
      });
    });
};


var args = require(__dirname+'/testArgs.js');

var runner = function () {
  process.chdir(__dirname);
  run(['featureTests.js', 'validationTests.js', 'relationTests.js', 'findTests.js', 'connectTests.js', 'metaTests.js', 'pubsubTests.js']);
};


var redis = args.redis,
    cleanup = function (cb, force) {
      if ( ! force && args.noCleanup === true)
        return cb();
      require('./helper.js').cleanUp(redis, args.prefix, cb);
    },
    Nohm = require(__dirname+'/../lib/nohm').Nohm;
    Nohm.setPrefix(args.prefix);
cleanup(runner, true);
