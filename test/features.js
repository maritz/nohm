var sys = require('sys');

exports.testForRedis = function(test){
  test.expect(1);
  var redis = require('redis-client');
  test.ok(redis, "redis-client should be available");
  test.done();
};

exports.testForNohm = function(test){
  test.expect(1);
  var nohm = require('nohm');
  test.ok(nohm, "nohm should be available");
  test.done();
};