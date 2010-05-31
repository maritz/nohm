var sys = require('sys');

exports.checkModules = function (t) {
  t.expect(3);

  var redis = require('redis-client');
  t.ok(typeof redis.Client === 'function', 'redis-client should be available -- forgot to do "git submodule update --init"?');

  var nohm = require('nohm');
  t.ok(typeof nohm.Model === 'function', 'nohm should be available -- something is fishy here.');

  var Class = require('class');
  t.ok(typeof Class.Class === 'function', 'Class should be available -- forgot to do "git submodule update --init"?');

  t.done();
};


// real tests start in 3.. 2.. 1.. NOW!
var nohm = require('nohm');
var userMockup = nohm.Model.extend({
  properties: {
    name: {
      type: 'string',
      value: 'test',
      validations: [
        'required'
      ]
    },
    visits: {
      type: 'counter',
      stepsize: 2,
      cap: 20
    },
    email: {
      type: 'string',
      validations: [
      'email'
      ]
    }
  }
});

exports.propertyGetter = function (t) {
  var user = new userMockup();
  t.expect(6);

  t.ok(typeof user.p === 'function', 'Property getter short p is not available.');

  t.ok(typeof user.prop === 'function', 'Property getter short prop is not available.');

  t.ok(typeof user.property === 'function', 'Property getter is not available.');

  t.ok(user.p('email') === null, 'Property getter did not return the correct value for email.');

  t.ok(user.p('name') === 'test', 'Property getter did not return the correct value for name.');

  var exceptionThrown = false;
  try {
    user.p('hurgelwurz');
  } catch (e) {
    exceptionThrown = true;
  }
  t.ok(exceptionThrown, 'Accessing an undefined property did not throw an exception.');

  t.done();
}


exports.propertySetter = function (t) {
  // we won't test setter validation here, that'll be tested in the testPropertyValidation
  var user = new userMockup();
  var result;
  t.expect(3);

  result = user.p('email', 'asdasd');
  t.ok(result, 'Setting a property without validation did not return `true`.');

  t.ok(user.p('email') === 'asdasd', 'Setting a property did not actually set the property to the correct value');
  
  result = user.p('email', null);
  t.ok(result, 'Setting a property without validation did not return `true`.');

  // t.ok(user.p('email') === '', "Setting a string property to null did not cast the value to an empty string."); TODO: reinstate this test :P

  t.done();
}


exports.propertyDiff = function (t) {
  var user = new userMockup();
  var should = [],
  beforeName = user.p('name'),
  beforeEmail = user.p('email');
  t.expect(5);
  
  t.ok(user.propertyDiff(), 'Property diff returned changes even though there were none');

  user.p('name', 'hurgelwurz');
  should.push({
    key: 'name',
    before: beforeName,
    after: 'hurgelwurz'
  });
  t.same(should, user.propertyDiff(), 'Property diff did not correctly recognize the changed property `name`.');

  user.p('email', 'asdasd');
  t.same(should, user.propertyDiff('name'), 'Property diff did not correctly search for changes only in `name`.');

  should.push({
    key: 'email',
    before: beforeEmail,
    after: 'asdasd'
  });
  t.same(should, user.propertyDiff(), 'Property diff did not correctly recognize the changed properties `name` and `email`.');

  should.shift();
  user.p('name', beforeName);
  t.same(should, user.propertyDiff(), 'Property diff did not correctly recognize the reset property `name`.');

  t.done();
}


exports.propertyReset = function (t) {
  var user = new userMockup();
  var beforeName = user.p('name'),
  beforeEmail = user.p('email');
  t.expect(4);

  user.p('name', user.p('name') + 'hurgelwurz');
  user.p('email', user.p('email') + 'asdasd');
  t.ok(user.propertyReset('name'), 'Property reset did not return true.'); // uhm... needed? i don't know

  t.ok(user.p('name') === beforeName, 'Property reset did not properly reset `name`.');

  t.ok(user.p('email') !== beforeEmail, 'Property reset reset `email` when it shouldn\'t have.');

  user.p('name', user.p('name') + 'hurgelwurz');
  user.propertyReset();
  t.ok(user.p('name') === beforeName && user.p('email') === beforeEmail, 'Property reset did not properly reset `name` and `email`.');

  t.done();
}


exports.allProperties = function (t) {
  var user = new userMockup();
  t.expect(2);

  user.p('name', 'hurgelwurz');
  user.p('email', 'hurgelwurz@test.de');
  var should = { name: user.p('name'), visits: user.p('visits'), email: user.p('email') }; // yes, this absolutely must be set correct for this test to work. sorry

  t.same(should, user.allProperties(), 'Getting all properties failed.');

  t.ok(user.allProperties(true) === JSON.stringify(should), 'Getting all properties as JSON failed.');

  t.done();
}