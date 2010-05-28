var sys = require('sys');

exports.testForModules = function (t) {
  t.expect(3);
  var redis = require('redis-client');
  t.ok(typeof redis.Client === 'function', 'redis-client should be available -- forgot to do "git submodule update --init"?');
  var nohm = require('nohm');
  t.ok(typeof nohm.Model === 'function', 'nohm should be available -- something is fishy here.');
  var Class = require('class');
  t.ok(typeof Class.Class === 'function', 'Class should be available -- forgot to do "git submodule update --init"?');
  t.done();
};

var nohm = require('nohm');
var mockups = require('./mockups');
var user = new mockups.User();

exports.testPropertyGetter = function (t) {
  t.expect(5); 
  t.ok(typeof user.p === 'function', 'Property getter short p is not available.');
  t.ok(typeof user.prop === 'function', 'Property getter short prop is not available.');
  t.ok(typeof user.property === 'function', 'Property getter is not available.');
  t.ok(user.p('email') === null, 'Property getter did not return the correct value for email.');
  t.ok(user.p('name') === 'test', 'Property getter did not return the correct value for name.');
  t.done();
}

exports.testPropertySetter = function (t) {
  // we won't test setter validation here, that'll be tested in the testPropertyValidation
  var result;
  
  t.expect(4);
  result = user.p('email', 'asdasd');
  t.ok(result, 'Setting a property without validation did not return `true`.');
  t.ok(user.p('email') === 'asdasd', 'Setting a property did not actually set the property to the correct value');
  
  result = user.p('email', null);
  t.ok(result, 'Setting a property without validation did not return `true`.');
  //require('assert')['ok'].apply(global, [false, "Setting a string property to null did not cast the value to an empty string."]);
  t.ok(user.p('email') === '', "Setting a string property to null did not cast the value to an empty string.");
  t.done();
}
