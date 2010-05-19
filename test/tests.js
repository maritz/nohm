require.paths.unshift(__dirname);
require.paths.unshift('../lib');
require.paths.unshift('../lib/redis-node/lib');

var testrunner = require('nodeunit').testrunner
    , sys = require('sys');
    
process.chdir(__dirname);
testrunner.run(['features.js']);