"use strict";
var sys = require('sys');

exports.checkModules = function (t) {
  var redis, nohm, Class;
  t.expect(3);

  redis = require('redis-client');
  t.ok(typeof redis.Client === 'function', 'redis-client should be available -- forgot to do "git submodule update --init"?');

  nohm = require('nohm');
  t.ok(typeof nohm.Model === 'function', 'nohm should be available -- something is fishy here.');

  Class = require('class');
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
        unique: true,
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
        unique: true,
        value: 'email@email.de',
        validations: [
          'email'
        ]
      }
    };
    nohm.Model.call(this);
  }
});

exports.redisClean = function (t) {
  t.expect(1);
  redis.keys('nohm:*:UserMockup:*', function (err, value) {
    t.ok(value === null, 'The redis database seems to contain fragments from previous nohm testruns. Use the redis command "KEYS nohm:*:UserMockup:*" to see what keys could be the cause.');
    t.done();
  });
};

exports.propertyGetter = function (t) {
  var user = new UserMockup(),
  exceptionThrown;
  t.expect(6);

  t.ok(typeof user.p === 'function', 'Property getter short p is not available.');

  t.ok(typeof user.prop === 'function', 'Property getter short prop is not available.');

  t.ok(typeof user.property === 'function', 'Property getter is not available.');

  t.ok(user.p('email') === 'email@email.de', 'Property getter did not return the correct value for email.');

  t.ok(user.p('name') === 'test', 'Property getter did not return the correct value for name.');

  exceptionThrown = false;
  try {
    user.p('hurgelwurz');
  } catch (e) {
    exceptionThrown = true;
  }
  t.ok(exceptionThrown, 'Accessing an undefined property did not throw an exception.');

  t.done();
};


exports.propertySetter = function (t) {
  var user = new UserMockup(),
  result,
  controlUser;
  t.expect(4);

  t.ok(user.p('email', 'asdasd'), 'Setting a property without validation did not return `true`.');

  t.ok(user.p('email') === 'asdasd', 'Setting a property did not actually set the property to the correct value');

  t.ok(user.p('email', null), 'Setting a property without validation did not return `true`.');

  user.p('email', 'test@test.de');
  controlUser = new UserMockup();
  t.ok(user.p('email') !== controlUser.p('email'), 'Creating a new instance of an Object does not create fresh properties.');

  t.done();
};


exports.propertyDiff = function (t) {
  var user = new UserMockup(),
  should = [],
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
};


exports.propertyReset = function (t) {
  var user = new UserMockup(),
  beforeName = user.p('name'),
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
};


exports.allProperties = function (t) {
  var user = new UserMockup(),
  should;
  t.expect(2);

  user.p('name', 'hurgelwurz');
  user.p('email', 'hurgelwurz@test.de');
  should = {
    name: user.p('name'),
    visits: user.p('visits'),
    email: user.p('email')
  }; // yes, this absolutely must be set correct for this test to work. sorry

  t.same(should, user.allProperties(), 'Getting all properties failed.');

  t.ok(user.allProperties(true) === JSON.stringify(should), 'Getting all properties as JSON failed.');

  t.done();
};

exports.create = function (t) {
  var user = new UserMockup();
  t.expect(5);

  user.p('name', 'createTest');
  user.p('email', 'createTest@asdasd.de');
  user.save(function (err) {
    t.ok(!err, 'Saving a user did not work.');
    if (err) {
      t.done();
    }
    redis.hgetall('nohm:hashes:UserMockup:' + user.id, function (err, value) {
      t.ok(!err, 'There was a redis error in the create test check.');
      // using == here because value.x are actually buffers. other option would be value.x.toString() === 'something'
      t.ok(value.name == 'createTest', 'The user name was not saved properly');
      t.ok(value.visits == '0', 'The user visits were not saved properly');
      t.ok(value.email == 'createTest@asdasd.de', 'The user email was not saved properly');
      t.done();
    });
  });
};

exports.remove = function (t) {
  var user = new UserMockup();
  t.expect(4);

  user.p('name', 'deleteTest');
  user.p('email', 'deleteTest@asdasd.de');
  user.save(function (err) {
    t.ok(!err, 'There was an unexpected problem: ' + sys.inspect(err));
    if (err) {
      t.done();
    }
    var id = user.id;
    user.remove(function (err) {
      t.ok(!err, 'There was a redis error in the remove test.');
      if (err) {
        t.done();
      }
      redis.exists('nohm:hashes:UserMockup:' + id, function (err, value) {
        t.ok(!err, 'There was a redis error in the remove test check.');
        t.ok(value === 0, 'Deleting a user did not work');
        t.done();
      });
    });
  });
};

exports.update = function (t) {
  var user = new UserMockup();
  t.expect(5);

  user.p('name', 'updateTest1');
  user.p('email', 'updateTest1@email.de');
  user.save(function (err) {
    t.ok(!err, 'There was a redis error in the update test. (creation part)');
    if (err) {
      t.done();
    }
    user.p('name', 'updateTest2');
    user.p('email', 'updateTest2@email.de');
    user.save(function (err) {
      t.ok(!err, 'There was a redis error in the update test.');
      if (err) {
        t.done();
      }
      redis.hgetall('nohm:hashes:UserMockup:' + user.id, function (err, value) {
        t.ok(!err, 'There was a redis error in the update test check.');
        if (err) {
          t.done();
        }
        // using == here because value.x are actually buffers. other option would be value.x.toString() === 'something'
        t.ok(value.name == 'updateTest2', 'The user name was not updated properly');
        t.ok(value.email == 'updateTest2@email.de', 'The user email was not updated properly');
        t.done();
      });
    });
  });
};

exports.unique = function (t) {
  var user1 = new UserMockup(),
  user2 = new UserMockup();
  t.expect(4);

  user1.p('name', 'dubplicateTest');
  user1.p('email', 'dubplicateTest@test.de');
  user2.p('name', 'dubplicateTest');
  user2.p('email', 'dubplicateTest@test.de');
  user1.save(function (err) {
    t.ok(!err, 'There was an unexpected problem: ' + sys.inspect(err));
    redis.get('nohm:uniques:UserMockup:name:dubplicateTest', function (err, value) {
      t.ok(user1.id, 'Userid b0rked while checking uniques');
      t.ok(value == user1.id, 'The unique key did not have the correct id');
    });
    if (err) {
      t.done();
    }
    user2.save(function (err) {
      t.ok(err, 'A saved unique property was not recognized as a duplicate');
      t.done();
    });
  });
};

exports.__updated = function (t) {
  var user = new UserMockup();
  t.expect(2);
  user.save(function (err) {
    if (err) {
      sys.debug('Error while saving user in __updated.');
    }
    user.p('name', 'hurgelwurz');
    user.p('name', 'test');
    t.ok(user.properties.name.__updated === false, 'Changing a var manually to the original didn\'t reset the internal __updated var');

    user.remove(function (err) {
      if (err) {
        sys.debug('Error while saving user in __updated.');
      }
      user = new UserMockup();
      user.p('name', 'hurgelwurz');
      user.propertyReset();
      t.ok(user.properties.name.__updated === false, 'Changing a var by propertyReset to the original didn\'t reset the internal __updated var');
      t.done();
    });
  });
};
