require.paths.unshift(__dirname); //tests
require.paths.unshift('../lib'); // nohm itself
require.paths.unshift('../lib/redis-node/lib'); // redis-node client lib
require.paths.unshift('../lib/class/lib'); // class system
require.paths.unshift('../lib/conductor/lib'); // class system

var nodeunit = require('nodeunit')
    , sys = require('sys');

// testrunner copied from nodeunit and edited a little
run = function(files){

    var red   = function(str){return "\033[31m" + str + "\033[39m"};
    var green = function(str){return "\033[32m" + str + "\033[39m"};
    var bold  = function(str){return "\033[1m" + str + "\033[22m"};

    var start = new Date().getTime();

    nodeunit.runFiles(files, {
        moduleStart: function(name){
            sys.puts('\n' + bold(name));
        },
        testDone: function(name, assertions){
            if(!assertions.failures){
                sys.puts('✔ ' + name);
            }
            else {
                sys.puts(red('✖ ' + name) + '\n');
                assertions.forEach(function(assertion){
                    if(assertion.failed()){
                        sys.puts(assertion.message);
                        sys.puts(assertion.error.stack + '\n');
                    }
                });
            }
        },
        done: function(assertions){
            var redis = require('redis-client').createClient();
            redis.del('nohm:ids:UserMockup', function () {
              var deleteKeys = function (err, keys) {
                if (!keys || keys.length == 0) {
                  return false;
                }
                for(var i = 0, len = keys.length; i < len; i++) {
                  redis.del(keys[i]);
                }
              };
              redis.keys('nohm:hashes:UserMockup:*', deleteKeys);
              redis.keys('nohm:uniques:UserMockup:*', deleteKeys);
              redis.keys('nohm:index:UserMockup:*', deleteKeys);
              setTimeout(function () {
                // timeout here because else the deletes don't go through fast enough and executing the tests again will result in failure.
                if(assertions.failures){
                  sys.puts(
                      '\n' + bold(red('FAILURES: ')) + assertions.failures +
                      '/' + assertions.length + ' assertions failed (' +
                      assertions.duration + 'ms)'
                  );
                  process.exit(1);
                }
                else {
                    sys.puts(
                        '\n' + bold(green('OK: ')) + assertions.length +
                        ' assertions (' + assertions.duration + 'ms)'
                    );
                  process.exit(0);
                }
              }, 500);
            });
        }
    });
};

process.chdir(__dirname);
run(['features.js', 'validations.js']);
