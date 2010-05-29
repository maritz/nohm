require.paths.unshift(__dirname); //tests
require.paths.unshift('../lib'); // nohm itself
require.paths.unshift('../lib/redis-node/lib'); // redis-node client lib
require.paths.unshift('../lib/class/lib'); // class system

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
            var end = new Date().getTime();
            var duration = end - start;
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
        }
    });
};

process.chdir(__dirname);
run(['features.js']);