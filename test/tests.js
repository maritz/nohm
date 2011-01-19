require.paths.unshift(__dirname); //tests
require.paths.unshift(__dirname + '/../lib'); // nohm itself
require.paths.unshift(__dirname + '/../lib/class/lib'); // class system
require.paths.unshift(__dirname + '/../lib/conductor/lib'); // conductor

var nodeunit = require('nodeunit')
    , util = require('util');


// testrunner copied from nodeunit and edited a little
run = function(files){

    var red   = function(str){return "\033[31m" + str + "\033[39m"};
    var green = function(str){return "\033[32m" + str + "\033[39m"};
    var bold  = function(str){return "\033[1m" + str + "\033[22m"};

    var start = new Date().getTime();

    nodeunit.runFiles(files, {
        moduleStart: function(name){
            util.puts('\n' + bold(name));
        },
        testDone: function(name, assertions){
            if(!assertions.failures){
                util.puts('✔ ' + name);
            }
            else {
                util.puts(red('✖ ' + name) + '\n');
                assertions.forEach(function(assertion){
                    if(assertion.failed()){
                        util.puts(assertion.message);
                        util.puts(assertion.error.stack + '\n');
                    }
                });
            }
        },
        done: function(assertions){
            if (assertions.failures) {
              util.puts(
                '\n' + bold(red('FAILURES: ')) + assertions.failures +
                '/' + assertions.length + ' assertions failed (' +
                assertions.duration + 'ms)'
              );
              process.exit(1);
            } else {
                util.puts(
                    '\n' + bold(green('OK: ')) + assertions.length +
                    ' assertions (' + assertions.duration + 'ms)'
                  );
                process.exit(0);
            }
        }
    });
};


var prefix = 'tests';

process.argv.forEach(function (val, index) {
  if (val === '--nohm-prefix') {
    prefix = process.argv[index + 1];
  }
});

var runner = function () {
    process.chdir(__dirname);
    run(['features.js', 'validations.js', 'relations.js', 'find.js']);
}

var redis = require('redis').createClient();
require('nohm').connect();
redis.keys(prefix + ':*', function (err, keys) {
  if (!keys || keys.length == 0) {
    return runner();
  }
  for(var i = 0, len = keys.length, k = 0; i < len; i++) {
    redis.del(keys[i], function () {
      k = k+1;
      if (k === len) {
        runner();
      }
    });
  }
});
