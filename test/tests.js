var nodeunit = require('nodeunit')
    , util = require('util');


// testrunner copied from nodeunit and edited a little
run = function(files){

    var red   = function(str){return "\033[31m" + str + "\033[39m"};
    var green = function(str){return "\033[32m" + str + "\033[39m"};
    var bold  = function(str){return "\033[1m" + str + "\033[22m"};

    var start = new Date().getTime();

    nodeunit.reporters.default.run(files, undefined, function () {
      cleanup(function () {
        redis.end();
      });
    });
};


var args = require(__dirname+'/testArgs.js');

var runner = function () {
  process.chdir(__dirname);
  run(['featureTests.js', 'validationTests.js', 'relationTests.js', 'findTests.js']);
}


var redis = args.redis,
    cleanup = function (cb, force) {
      if ( ! force && args.noCleanup === true)
        return cb();
      redis.keys(args.prefix + ':*', function (err, keys) {
        if (!keys || keys.length == 0) {
          return cb();
        }
        for(var i = 0, len = keys.length, k = 0; i < len; i++) {
          redis.del(keys[i], function () {
            k = k+1;
            if (k === len) {
              cb();
            }
          });
        }
      });
    },
    Nohm = require(__dirname+'/../lib/nohm').Nohm;
    Nohm.setPrefix(args.prefix);
Nohm.meta = args.setMeta;
cleanup(runner, true);
