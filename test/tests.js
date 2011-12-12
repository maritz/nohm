var nodeunit = require('nodeunit')
    , util = require('util');

var furtherTests = [
    'validationTests.js',
    'relationTests.js',
    'findTests.js',
    'connectTests.js',
    'pubsubTests.js'
  ];
var next;
var error_sum = 0;

// testrunner copied from nodeunit and edited a little
run = function(files){

    var red   = function(str){return "\033[31m" + str + "\033[39m"};
    var green = function(str){return "\033[32m" + str + "\033[39m"};
    var bold  = function(str){return "\033[1m" + str + "\033[22m"};

    nodeunit.reporters.default.run(files, undefined, function (error) {
      if (error instanceof Error) {
        error_sum++;
      }
      
      next = furtherTests.splice(0, 1);
      if (next.length > 0) { // this is a hack to make the tests run serially
        run(next);
      } else {
        if (error_sum > 0) {
          console.log(
              '\n' + bold(red('FAILURES: ')) + error_sum +
              ' Modules failed.');
        } else {
          console.log(
              '\n' + bold(green('SUCCESS!'))+' No assertions failed');
        }
        cleanup(function () {
          redis.end();
        });
      }
    });
};


var args = require(__dirname+'/testArgs.js');

var runner = function () {
  process.chdir(__dirname);
  run(['featureTests.js']);
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
