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
var redis = require('redis-client').createClient();
var nohm = require('nohm');
var UserMockup = nohm.Model.extend({
  constructor: function () {
    this.modelName = 'UserMockup';
    this.properties = {
      name: {
        type: 'string',
        value: 'test',
        validations: [
        'notEmpty'
        ]
      },
      visits: {
        type: 'counter',
        stepsize: 2
      },
      email: {
        type: 'string',
        validations: [
        'email'
        ]
      }
    };
    nohm.Model.call(this);
  }
});

exports.propertyGetter = function (t) {
  var user = new UserMockup();
  t.expect(6);

  t.ok(typeof user.p === 'function', 'Property getter short p is not available.');

  t.ok(typeof user.prop === 'function', 'Property getter short prop is not available.');

  t.ok(typeof user.property === 'function', 'Property getter is not available.');

  t.ok(user.p('email') === '', 'Property getter did not return the correct value for email.');

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
  var user = new UserMockup();
  var result;
  t.expect(4);

  t.ok(user.p('email', 'asdasd'), 'Setting a property without validation did not return `true`.');

  t.ok(user.p('email') === 'asdasd', 'Setting a property did not actually set the property to the correct value');
  
  t.ok(user.p('email', null), 'Setting a property without validation did not return `true`.');

  // t.ok(user.p('email') === '', "Setting a string property to null did not cast the value to an empty string."); TODO: reinstate this test :P

  user.p('email', 'test@test.de');
  var controlUser = new UserMockup();
  t.ok(user.p('email') !== controlUser.p('email'), 'Creating a new instance of an Object does not create fresh properties.');

  t.done();
}


exports.propertyDiff = function (t) {
  var user = new UserMockup();
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
  var user = new UserMockup();
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
  var user = new UserMockup();
  t.expect(2);

  user.p('name', 'hurgelwurz');
  user.p('email', 'hurgelwurz@test.de');
  var should = {
    name: user.p('name'),
    visits: user.p('visits'),
    email: user.p('email')
  }; // yes, this absolutely must be set correct for this test to work. sorry

  t.same(should, user.allProperties(), 'Getting all properties failed.');

  t.ok(user.allProperties(true) === JSON.stringify(should), 'Getting all properties as JSON failed.');

  t.done();
}

exports.create = function (t) {
  var user = new UserMockup();
  t.expect(5);

  user.p('name', 'asdads');
  user.p('email', 'asdasd@asdasd.de');
  user.save(function (err) {
    t.ok(err === null, 'Saving a user did not work.');
    redis.hgetall('nohm:hashes:UserMockup:' + user.id, function (err, value) {
      t.ok(!err, 'There was a redis error in the create test check.');
      // using == here because value.x are actually buffers. other option would be value.x.toString() === 'something'
      t.ok(value.name == 'asdads', 'The user name was not saved properly');
      t.ok(value.visits == '0', 'The user visits were not saved properly');
      t.ok(value.email == 'asdasd@asdasd.de', 'The user email was not saved properly');
      t.done();
    });
  });
}

exports.remove = function (t) {
  var user = new UserMockup();
  t.expect(3);

  user.save(function () {
    var id = user.id;
    user.remove(function (err) {
      t.ok(!err, 'There was a redis error in the remove test.');
      redis.exists('nohm:hashes:UserMockup:' + id, function (err, value) {
        t.ok(!err, 'There was a redis error in the remove test check.');
        t.ok(value === 0, 'Deleting a user did not work');
        t.done();
      });
    })
  });
}

exports.update = function (t) {
  var user = new UserMockup();
  t.expect(5);

  user.p('name', 'name1');
  user.p('email', 'email1@email.de');
  user.save(function (err) {
    t.ok(!err, 'There was a redis error in the update test. (creation part)');
    user.p('name', 'name2');
    user.p('email', 'email2@email.de');
    user.save(function (err) {
      t.ok(!err, 'There was a redis error in the update test.');
      redis.hgetall('nohm:hashes:UserMockup:' + user.id, function (err, value) {
        t.ok(!err, 'There was a redis error in the update test check.');
        // using == here because value.x are actually buffers. other option would be value.x.toString() === 'something'
        t.ok(value.name == 'name2', 'The user name was not updated properly');
        t.ok(value.email == 'email2@email.de', 'The user email was not updated properly');
        t.done();
      });
    });
  });
}