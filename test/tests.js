require.paths.unshift(__dirname); //tests
require.paths.unshift('../lib'); // nohm itself
require.paths.unshift('../lib/redis-node/lib'); // redis-node client lib
require.paths.unshift('../lib/class/lib'); // class system

var testrunner = require('nodeunit').testrunner
    , sys = require('sys');
    
process.chdir(__dirname);
testrunner.run(['features.js']);
