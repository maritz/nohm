var util = require('util');
var args = require(__dirname + '/testArgs.js');
var h = require('./helper.js');

exports.checkModules = function (t) {
  var redis, nohm, async;
  t.expect(3);

  redis = require('redis');
  t.ok(typeof redis.createClient === 'function', 'the redis client library should be available.');

  nohm = require(__dirname + '/../tsOut');
  t.ok(typeof nohm === 'object', 'nohm should be available -- something is fishy here.');

  async = require('async');
  t.ok(typeof async !== 'undefined', 'async should be available.');

  t.done();
};

var prefix = args.prefix;

// real tests start in 3.. 2.. 1.. NOW!
var redis = args.redis;
var nohm = require(__dirname + '/../tsOut').Nohm;
var helper = require(__dirname + '/../lib/helpers');
var async = require('async');

var UserMockup = nohm.model('UserMockup', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'test',
      unique: true,
      validations: [
        'notEmpty'
      ]
    },
    visits: {
      type: 'integer',
      index: true
    },
    email: {
      type: 'string',
      unique: true,
      defaultValue: 'email@email.de',
      validations: [
        'email'
      ]
    },
    emailOptional: {
      type: 'string',
      unique: true,
      defaultValue: '',
      validations: [
        {
          name: 'email',
          options: {
            optional: true
          }
        }
      ]
    },
    country: {
      type: 'string',
      defaultValue: 'Tibet',
      index: true,
      validations: [
        'notEmpty'
      ]
    },
    json: {
      type: 'json',
      defaultValue: '{}'
    }
  },
  methods: {
    test: function test() {
      return this.property('name');
    }
  },
  idGenerator: 'increment'
});

nohm.model('NonIncrement', {
  properties: {
    name: 'No name'
  }
});

nohm.model('UniqueInteger', {
  properties: {
    unique: {
      type: 'integer',
      unique: true
    }
  }
});


exports.prepare = {
  redisClean: function (t) {
    t.expect(1);
    redis.keys(prefix + ':*:*Mockup:*', function (err, value) {
      var check = (Array.isArray(value) && value.length === 0) || value === null;
      t.ok(check, 'The redis database seems to contain fragments from previous nohm testruns. Use the redis command "KEYS ' + prefix + ':*:*Mockup:*" to see what keys could be the cause.');
      t.done();
    });
  },

  idIntersection: function (t) {
    var arr1 = [1, 2, 3, 4, 5, 6, 7, 8, 9],
      arr2 = [2, 3, 4, 10],
      arr3 = [2, 3, 4, 10],
      arr4 = [],
      arr5 = [16, 28, 39],
      arr6 = ['hurgelwurz', 28, 39],
      arr7 = ['hurgelwurz', 28, 39],
      arr8 = [10, 3, 2],
      testIntersection = function (arrs, resultTest) {
        var result;

        result = helper.idIntersection.apply(null, arrs);
        t.same(result, resultTest, 'idIntersection did not perform correctly.');
      };
    t.expect(9);

    testIntersection([arr1], arr1);

    testIntersection([arr1, arr2], [2, 3, 4]);

    testIntersection([arr1, arr2, arr3], [2, 3, 4]);

    testIntersection([arr2, arr3], [2, 3, 4, 10]);

    testIntersection([arr1, arr2, arr3, arr4], []);

    testIntersection([arr1, arr2, arr3, arr5], []);

    testIntersection([arr5, arr6], [28, 39]);

    testIntersection([arr6, arr7], ['hurgelwurz', 28, 39]);

    testIntersection([arr3, arr8], [10, 3, 2]);

    t.done();
  },

  setRedisClient: function (t) {
    t.expect(2);
    nohm.client = null;
    t.throws(
      () => {
        var user = new UserMockup();
      },
      /No redis client/,
      'Creating a model without having a redis client set did not throw an error.'
    );

    nohm.setClient(redis);

    t.doesNotThrow(
      () => {
        var user = new UserMockup();
      },
      'Creating a model with a redis client set threw an error.'
    );
    t.done();
  },

  setPrefix: function (t) {
    const oldPrefix = nohm.prefix;
    t.expect(1);
    const expectPrefix = {
      channel: 'hurgel:channel:',
      hash: 'hurgel:hash:',
      idsets: 'hurgel:idsets:',
      incrementalIds: 'hurgel:ids:',
      index: 'hurgel:index:',
      meta: {
        idGenerator: 'hurgel:meta:idGenerator:',
        properties: 'hurgel:meta:properties:',
        version: 'hurgel:meta:version:',
      },
      relationKeys: 'hurgel:relationKeys:',
      relations: 'hurgel:relations:',
      scoredindex: 'hurgel:scoredindex:',
      unique: 'hurgel:uniques:',
    };

    nohm.setPrefix('hurgel');
    t.same(nohm.prefix, expectPrefix, 'Setting a custom prefix did not work as expected');

    nohm.prefix = oldPrefix;
    t.done();
  }
};

exports.propertyTests = {
  propertyGetter: function (t) {
    var user = new UserMockup();
    t.expect(7);

    t.equals(typeof (user.p), 'function', 'Property getter short p is not available.');

    t.equals(typeof (user.prop), 'function', 'Property getter short prop is not available.');

    t.equals(typeof (user.property), 'function', 'Property getter is not available.');

    t.equals(user.property('email'), 'email@email.de', 'Property getter did not return the correct value for email.');

    t.equals(user.property('name'), 'test', 'Property getter did not return the correct value for name.');


    t.throws(
      () => {
        user.property('hurgelwurz');
      },
      /Invalid property key 'hurgelwurz'\./,
      'Calling .property() with an undefined key did not throw an error.'
    );

    t.same(user.property('json'), {}, 'Property getter did not return the correct value for json.');
    t.done();
  },


  propertySetter: function (t) {
    var user = new UserMockup();
    var controlUser = new UserMockup();
    t.expect(6);

    t.same(user.property('email', 123), '', 'Setting a property did not return the new value that was set (with casting).');

    user.property('email', 'asdasd');
    t.equals(user.property('email'), 'asdasd', 'Setting a property did not actually set the property to the correct value');

    user.property('email', 'test@test.de');
    t.ok(user.property('email') !== controlUser.property('email'), 'Creating a new instance of an Object does not create fresh properties.');

    user.property({
      name: 'objectTest',
      email: 'object@test.de'
    });

    t.equals(user.property('name'), 'objectTest', 'Setting multiple properties by providing one object did not work correctly for the name.');
    t.equals(user.property('email'), 'object@test.de', 'Setting multiple properties by providing one object did not work correctly for the email.');

    user.property('json', {
      test: 1
    });

    t.equals(user.property('json').test, 1, 'Setting a json property did not work correctly.');

    t.done();
  },


  propertyDiff: function (t) {
    var user = new UserMockup(),
      beforeName = user.property('name'),
      beforeEmail = user.property('email');
    t.expect(5);
    const shouldName = [{
      key: 'name',
      before: beforeName,
      after: 'hurgelwurz'
    }];
    const shouldMail = [{
      key: 'email',
      before: 'email@email.de',
      after: 'email.propertyDiff@test'
    }];
    const shouldNameAndMail = shouldName.concat(shouldMail);

    t.ok(user.propertyDiff(), 'Property diff returned changes even though there were none');

    user.property('name', 'hurgelwurz');
    t.same(shouldName, user.propertyDiff(), 'Property diff did not correctly recognize the changed property `name`.');

    user.property('email', 'email.propertyDiff@test');
    t.same(shouldName, user.propertyDiff('name'), 'Property diff did not correctly filter for changes only in `name`.');

    t.same(shouldNameAndMail, user.propertyDiff(), 'Property diff did not correctly recognize the changed properties `name` and `email`.');

    user.property('name', beforeName);
    t.same(shouldMail, user.propertyDiff(), 'Property diff did not correctly recognize the reset property `name`.');

    t.done();
  },


  propertyReset: function (t) {
    const user = new UserMockup();
    const beforeName = user.property('name');
    const beforeEmail = user.property('email');
    t.expect(3);

    user.property('name', user.property('name') + 'hurgelwurz');
    user.property('email', user.property('email') + 'asdasd');
    user.propertyReset('name');
    t.same(user.property('name'), beforeName, 'Property reset did not properly reset `name`.');

    t.ok(user.property('email') !== beforeEmail, 'Property reset reset `email` when it shouldn\'t have.');

    user.property('name', user.property('name') + 'hurgelwurz');
    user.propertyReset();
    t.ok(user.property('name') === beforeName && user.property('email') === beforeEmail, 'Property reset did not properly reset `name` and `email`.');

    t.done();
  },


  allProperties: function (t) {
    const user = new UserMockup();
    t.expect(1);

    user.property('name', 'hurgelwurz');
    user.property('email', 'hurgelwurz@test.de');
    const should = {
      name: user.property('name'),
      visits: user.property('visits'),
      email: user.property('email'),
      emailOptional: user.property('emailOptional'),
      country: user.property('country'),
      json: {},
      id: user.id
    };
    t.same(should, user.allProperties(), 'Getting all properties failed.');

    t.done();
  }
};

exports.create = function (t) {
  var user = new UserMockup();
  t.expect(5);

  user.property('name', 'createTest');
  user.property('email', 'createTest@asdasd.de');

  t.doesNotThrow(async () => {
    // TODO: when upgrading to a better test framework, async errors need to be handled
    // right now the promise rejections from this lead to a unhandledPromiseRejection
    await user.save();

    redis.hgetall(prefix + ':hash:UserMockup:' + user.id, function (err, value) {
      t.ok(!err, 'There was a redis error in the create test check.');
      t.ok(value.name.toString() === 'createTest', 'The user name was not saved properly');
      t.ok(value.visits.toString() === '0', 'The user visits were not saved properly');
      t.ok(value.email.toString() === 'createTest@asdasd.de', 'The user email was not saved properly');
      t.done();
    });
  }, 'Creating a user did not work.:' + user.errors);
};

exports.remove = async function (t) {
  var user = new UserMockup(),
    testExists;
  t.expect(7);

  testExists = function (what, key, callback) {
    redis.exists(key, function (err, value) {
      t.ok(!err, 'There was a redis error in the remove test check.');
      t.ok(value === 0, 'Deleting a user did not work: ' + what + ', key: ' + key);
      callback();
    });
  };

  user.property('name', 'deleteTest');
  user.property('email', 'deleteTest@asdasd.de');
  await user.save();

  var id = user.id;
  await user.remove();

  t.equals(user.id, 0, 'Removing an object from the db did not set the id to null');
  async.series([
    function (callback) {
      testExists('hashes', prefix + ':hash:UserMockup:' + id, callback);
    },
    function (callback) {
      redis.sismember(prefix + ':index:UserMockup:name:' + user.property('name'), id, function (err, value) {
        t.ok((err === null && value === 0), 'Deleting a model did not properly delete the normal index.');
      });
      callback();
    },
    function (callback) {
      redis.zscore(prefix + ':scoredindex:UserMockup:visits', id, function (err, value) {
        t.ok((err === null && value === null), 'Deleting a model did not properly delete the scored index.');
      });
      callback();
    },
    function (callback) {
      testExists('uniques', prefix + ':uniques:UserMockup:name:' + user.property('name'), callback);
    }
  ], t.done);
};

exports.idSets = async function (t) {
  const user = new UserMockup();
  let tmpid = 0;
  t.expect(4);
  user.property('name', 'idSetTest');

  await user.save();
  tmpid = user.id;
  redis.sismember(prefix + ':idsets:' + user.modelName, tmpid, async (err, value) => {
    t.ok(!err, 'There was an unexpected redis error.');
    t.equals(value, 1, 'The userid was not part of the idset after saving.');
    await user.remove();
    redis.sismember(prefix + ':idsets:' + user.modelName, tmpid, (err, value) => {
      t.ok(!err, 'There was an unexpected redis error.');
      t.equals(value, 0, 'The userid was still part of the idset after removing.');
      t.done();
    });
  });
};

exports.update = async function (t) {
  const user = new UserMockup();
  t.expect(3);

  user.property('name', 'updateTest1');
  user.property('email', 'updateTest1@email.de');
  await user.save();
  user.property('name', 'updateTest2');
  user.property('email', 'updateTest2@email.de');
  await user.save();
  redis.hgetall(prefix + ':hash:UserMockup:' + user.id, function (err, value) {
    t.ok(!err, 'There was a redis error in the update test check.');
    if (err) {
      t.done();
    }
    t.ok(value.name.toString() === 'updateTest2', 'The user name was not updated properly');
    t.ok(value.email.toString() === 'updateTest2@email.de', 'The user email was not updated properly');
    t.done();
  });
};

exports.unique = async function (t) {
  const user1 = new UserMockup();
  const user2 = new UserMockup();
  t.expect(7);

  user1.property('name', 'duplicateTest');
  user1.property('email', 'duplicateTest@test.de');
  user2.property('name', 'duplicateTest');
  user2.property('email', 'dubplicateTest@test.de'); // intentional typo dub
  await user1.save();
  redis.get(prefix + ':uniques:UserMockup:name:duplicatetest', async (err, value) => {
    t.ok(user1.id, 'Userid b0rked while checking uniques');
    t.equals(parseInt(value, 10), user1.id, 'The unique key did not have the correct id');
    const valid = await user2.validate(false, false);
    t.ok(!valid, 'A unique property was not recognized as a duplicate in valid without setDirectly');
    try {
      await user2.save();
      t.ok(false, 'Saving a model with an invalid non-unique property did not throw/reject.');
    } catch (err) {
      t.equals(err, 'invalid', 'A saved unique property was not recognized as a duplicate');

      redis.exists(prefix + ':uniques:UserMockup:email:dubbplicatetest@test.de', (err, value) => {
        t.equals(value, 0, 'The tmp unique lock was not deleted for a failed save.');
        redis.get(prefix + ':uniques:UserMockup:name:duplicatetest', (err, value) => {
          t.ok(!err, 'There was an unexpected probllem: ' + util.inspect(err));
          t.same(parseInt(value, 10), user1.id, 'The unique key did not have the correct id after trying to save another unique.');
          t.done();
        });
      });
    }
  });
};

exports.uniqueLowerCase = async function (t) {
  const user1 = new UserMockup();
  const user2 = new UserMockup();
  t.expect(5);

  user1.property('name', 'LowerCaseTest');
  user1.property('email', 'LowerCaseTest@test.de');
  user2.property('name', 'lowercasetest');
  user2.property('email', 'lowercasetest@test.de');
  await user1.save();
  redis.get(prefix + ':uniques:UserMockup:name:' + user1.property('name').toLowerCase(), async (err, value) => {
    t.equals(parseInt(value, 10), user1.id, 'The unique key did not have the correct id');
    const valid = await user2.validate(false, false);
    t.ok(!valid, 'A unique property was not recognized as a duplicate in valid without setDirectly.');
    try {
      await user2.save();
      t.ok(false, 'Saving a model with an invalid non-unique property did not throw/reject.');
    } catch (err) {
      t.equals(err, 'invalid', 'A saved unique property was not recognized as a duplicate');
      redis.get(prefix + ':uniques:UserMockup:name:lowercasetest', function (err, value) {
        t.ok(!err, 'There was an unexpected probllem: ' + util.inspect(err));
        t.same(parseInt(value, 10), user1.id, 'The unique key did not have the correct id after trying to save another unique.');
        t.done();
      });
    }
  });
};

exports.uniqueDeleteWhenOtherFails = function (t) {
  var user = new UserMockup();
  t.expect(2);

  user.property('name', 'uniqueDeleteTest');
  user.property('email', 'uniqueDeleteTest@test.de');
  user.property('country', '');
  user.save(function (err) {
    t.same('invalid', err, 'There was an unexpected problem: ' + util.inspect(err));
    redis.exists(prefix + ':uniques:UserMockup:name:' + user.property('name').toLowerCase(), function (err, value) {
      t.equals(value, 0, 'The unique was locked although there were errors in the non-unique checks.');
      t.done();
    });
  });
};

exports.uniqueOnlyCheckSpecified = function (t) {
  var user = new UserMockup();
  t.expect(2);

  user.property('name', 'dubplicateTest');
  user.property('email', 'dubplicateTest@test.de');
  user.valid('name', function (valid) {
    t.same(valid, false, 'Checking the duplication status failed in valid().');
    t.same(user.errors.email, [], 'Checking the duplication status of one property set the error for another one.');
    t.done();
  });
};

exports.uniqueDeletion = function (t) {
  var user = new UserMockup();
  t.expect(2);

  user.property({
    'name': 'dubplicateDeletionTest',
    'email': 'dubplicateDeletionTest@test.de',
    'country': ''
  });

  user.save(function (err) {
    t.ok(err, 'The invalid property country did not trigger a failure.');
    redis.exists(prefix + ':uniques:UserMockup:name:dubplicateDeletionTest', function (err, value) {
      t.equals(value, 0, 'The tmp unique key was not deleted if a non-unique saving failure occured.');
      t.done();
    });
  });
};

exports.uniqueCaseInSensitive = function (t) {
  var user = new UserMockup();
  var user2 = new UserMockup();
  t.expect(4);

  user.property({
    'name': 'uniqueCaseInSensitive',
    'email': 'uniqueCaseInSensitive@test.de'
  });
  user2.property({
    'name': user.property('name').toLowerCase(),
    'email': user.property('email').toLowerCase()
  });

  user.save(function (err) {
    t.ok(!err, 'Saving failed');
    user2.valid(function (valid) {
      t.ok(!valid, 'A duplicate (different case) unique property was validated.');
      t.same(user2.errors.name, ['notUnique'], 'The error for name was not correct.');
      t.same(user2.errors.email, ['notUnique'], 'The error for email was not correct.');
      t.done();
    });
  });
};

exports.uniqueEmpty = function (t) {
  var user = new UserMockup();
  t.expect(5);

  redis.exists(prefix + ':uniques:UserMockup:emailOptional:', function (err, exists) {
    t.ok(!err, 'redis.keys failed.');
    t.same(exists, 0, 'An empty unique was set before the test for it was run');
    user.property({
      'name': 'emailOptional',
      'email': 'emailOptionalTest@test.de',
      'emailOptional': ''
    });
    user.save(function (err) {
      t.ok(!err, 'Saving failed.');
      redis.keys(prefix + ':uniques:UserMockup:emailOptional:', function (err, keys) {
        t.ok(!err, 'redis.keys failed.');
        t.same(keys.length, 0, 'An empty unique was set');
        t.done();
      });
    });
  });
};

exports["integer uniques"] = function (t) {
  t.expect(5);
  var obj = nohm.factory('UniqueInteger');
  var obj2 = nohm.factory('UniqueInteger');
  obj.property('unique', 123);
  obj2.property('unique', 123);

  obj.save(function (err) {
    t.ok(!err, 'Unexpected saving error');
    t.same(obj.allProperties(), {
      unique: 123,
      id: obj.id
    }, 'Properties not correct');
    obj2.save(function (err) {
      t.same(err, 'invalid', 'Unique integer conflict did not result in error.');
      obj.remove(function (err) {
        t.ok(!err, 'Unexpected removing error');
        obj2.save(function () {
          t.ok(!err, 'Unexpected saving error');
          t.done();
        });
      });
    });
  });
};

exports.indexes = function (t) {
  var user = new UserMockup();
  t.expect(7);

  user.property('name', 'indexTest');
  user.property('email', 'indexTest@test.de');
  user.property('country', 'indexTestCountry');
  user.property('visits', 20);

  function checkCountryIndex(callback) {
    redis.sismember(prefix + ':index:UserMockup:country:indexTestCountry', user.id, function (err, value) {
      t.ok(!err, 'There was an unexpected problem: ' + util.inspect(err));
      t.ok(value === 1, 'The country index did not have the user as one of its ids.');
      callback();
    });
  }

  function checkVisitsIndex(callback) {
    redis.zscore(prefix + ':scoredindex:UserMockup:visits', user.id, function (err, value) {
      t.ok(!err, 'There was an unexpected problem: ' + util.inspect(err));
      t.ok(value == user.property('visits'), 'The visits index did not have the correct score.');
      redis.sismember(prefix + ':index:UserMockup:visits:' + user.property('visits'), user.id, function (err, value) {
        t.ok(!err, 'There was an unexpected problem: ' + util.inspect(err));
        t.ok(value === 1, 'The visits index did not have the user as one of its ids.');
        callback();
      });
    });
  }

  user.save(function (err) {
    t.ok(!err, 'There was an unexpected problem: ' + util.inspect(err));
    checkCountryIndex(function () {
      checkVisitsIndex(t.done);
    });
  });
};

exports.__updated = function (t) {
  var user = new UserMockup();
  t.expect(2);
  user.property('email', '__updatedTest@test.de');
  user.save(function (err) {
    if (err) {
      console.log(err);
      t.ok(false, 'Error while saving user in test for __updated.');
    }
    user.property('name', 'hurgelwurz');
    user.property('name', 'test');
    t.ok(user.properties.name.__updated === false, 'Changing a var manually to the original didn\'t reset the internal __updated var');

    user.remove(function (err) {
      if (err) {
        util.debug('Error while saving user in __updated.');
      }
      user = new UserMockup();
      user.property('name', 'hurgelwurz');
      user.propertyReset();
      t.ok(user.properties.name.__updated === false, 'Changing a var by propertyReset to the original didn\'t reset the internal __updated var');
      t.done();
    });
  });
};

exports.deleteNonExistant = function (t) {
  var user = new UserMockup();
  t.expect(1);
  user.id = 987654321;

  user.remove(function (err) {
    t.same(err, 'not found', 'Trying to delete an instance that doesn\'t exist did not return "not found".');
    t.done();
  });
};

exports.methods = function (t) {
  var user = new UserMockup();
  t.expect(2);

  t.same(typeof (user.test), 'function', 'Adding a method to a model did not create that method on a new instance.');
  t.same(user.test(), user.property('name'), 'The test method did not work properly. (probably doesn\'t have the correct `this`.');
  t.done();
};

exports.methodsSuper = function (t) {
  var user = new UserMockup();
  t.expect(4);

  t.same(typeof (user.prop), 'function', 'Overwriting a method in a model definition did not create that method on a new instance.');
  t.same(typeof (user._super_prop), 'function', 'Overwriting a method in a model definition did not create the _super_ method on a new instance.');
  t.same(user.prop('super'), user.property('name'), 'The super test method did not work properly.');
  user.prop('name', 'methodTest');
  t.same(user.property('name'), 'methodTest', 'The super test method did not properly handle arguments');
  t.done();
};

exports["no super method if none needed"] = function (t) {
  var user = new UserMockup();
  t.expect(1);

  t.ok(!user.hasOwnProperty('_super_test'), 'Defining a method that does not overwrite a nohm method created a _super_.');
  t.done();
};

exports.uniqueDefaultOverwritten = function (t) {
  var user = new UserMockup();
  var user2 = new UserMockup();
  t.expect(3);

  user.save(function (err) {
    t.ok(!err, 'Unexpected saving error.');
    user2.save(function (err) {
      t.same(err, 'invalid', 'Saving a default unique value did not return with the error "invalid"');
      t.same(user2.errors.name, ['notUnique'], 'Saving a default unique value returned the wrong error: ' + user2.errors.name);
      t.done();
    });
  });
};

exports.allPropertiesJson = function (t) {
  var user = new UserMockup();
  user.property('json', { test: 1 });
  user.property({
    name: 'allPropertiesJson',
    email: 'allPropertiesJson@test.de'
  });
  t.expect(2);

  user.save(function (err) {
    t.ok(!err, 'Unexpected saving error.');
    var testProps = user.allProperties();
    t.same(testProps.json, user.property('json'), 'allProperties did not properly parse json properties');
    t.done();
  });
};

exports.thisInCallbacks = function (t) {
  var user = new UserMockup();
  var checkCounter = 0;
  var checkSum = 11;
  var checkThis = function (name, cb) {
    return function () {
      checkCounter++;
      t.ok(this instanceof UserMockup, '`this` is not set to the instance in ' + name);
      if (checkCounter === checkSum) {
        done();
      } else if (typeof (cb) === 'function') {
        cb();
      }
    };
  };
  t.expect(checkSum + 1);

  var done = function () {
    user.remove(checkThis('remove', function () {
      t.done();
    }));
  };

  user.save(checkThis('createError', function () {
    user.property({
      name: 'thisInCallbacks',
      email: 'thisInCallbacks@test.de'
    });
    user.link(user, checkThis('link'));
    user.save(checkThis('create', function () {
      user.load(user.id, checkThis('load'));
      user.find({ name: 'thisInCallbacks' }, checkThis('find'));
      user.save(checkThis('update', function () {
        user.property('email', 'asd');
        user.save(checkThis('updateError'));
      }));
      user.belongsTo(user, checkThis('belongsTo'));
      user.getAll('UserMockup', checkThis('getAll'));
      user.numLinks('UserMockup', checkThis('numLinks'));
      user.unlinkAll(null, checkThis('unlinkAll'));
    }));
  }));
};

exports.defaultAsFunction = function (t) {
  t.expect(3);

  var TestMockup = nohm.model('TestMockup', {
    properties: {
      time: {
        type: 'timestamp',
        defaultValue: function () {
          return (+ new Date());
        }
      }
    }
  });
  var test1 = new TestMockup();
  setTimeout(function () {
    var test2 = new TestMockup();

    t.ok(typeof (test1.property('time')) === 'number', 'time of test1 is not a number');
    t.ok(typeof (test2.property('time')) === 'number', 'time of test2 is not a number');
    t.ok(test1.property('time') < test2.property('time'), 'time of test2 is not lower than test1');
    t.done();
  }, 10);
};

exports.defaultIdGeneration = function (t) {
  t.expect(2);

  var TestMockup = nohm.model('TestMockup', {
    properties: {
      name: {
        type: 'string',
        defaultValue: 'defaultIdGeneration'
      }
    }
  });
  var test1 = new TestMockup();
  test1.save(function (err) {
    t.ok(!err, 'There was an error while saving.');
    t.same(typeof (test1.id), 'string', 'The generated id was not a string');
    t.done();
  });
};

exports.instanceLoad = function (t) {
  t.expect(1);
  new UserMockup(1123123, function (err) {
    t.same(err, 'not found', 'Instantiating a user with an id and callback did not try to load it');
    t.done();
  });
};

exports.factory = function (t) {
  t.expect(4);
  var name = 'UserMockup';
  var user = nohm.factory(name);
  t.same(user.modelName, name, 'Using the factory to get an instance did not work.');

  var user2 = nohm.factory(name, 1234124235, function (err) {
    t.same(err, 'not found', 'Instantiating a user via factory with an id and callback did not try to load it');
    t.same(user.modelName, name, 'Using the factory to get an instance (with id) did not work.');
    t.done();
  });
  t.ok(user2, 'Using the factory with an id and callback returned false');
};

exports["factory with non-integer id"] = function (t) {
  t.expect(3);
  var name = 'NonIncrement';
  var obj = nohm.factory(name);
  obj.property('name', 'factory_non_integer_load');
  obj.save(function (err) {
    t.ok(!err, 'Unexpected saving error');
    var obj2 = nohm.factory(name, obj.id, function (err) {
      t.ok(!err, 'Unexpected factory loading error');
      t.same(obj2.allProperties(), obj.allProperties(), 'The loaded object seems to have wrong properties');
      t.done();
    });
  });
};

exports.purgeDB = function (t) {
  var expected = 1;
  var countKeys = function (prefix, callback) {
    redis.keys(prefix + '*', function (err, orig_num) {
      callback(err, orig_num.length);
    });
  };

  var tests = [];
  Object.keys(nohm.prefix).forEach(function (key) {
    expected += 2;
    tests.push(async.apply(countKeys, nohm.prefix[key]));
  });

  async.series(tests, function (err, num_arr) {
    t.ok(!err, 'Unexpected redis error');
    var count = num_arr.reduce(function (num, add) { return num + add; }, 0);
    t.ok(count > 0, 'Database did not have any keys');
    nohm.purgeDb(function (err) {
      t.ok(!err, 'Unexpected redis error');
      async.series(tests, function (err, num_arr) {
        t.ok(!err, 'Unexpected redis error');
        var count = num_arr.reduce(function (num, add) { return num + add; }, 0);
        t.same(count, 0, 'Database did have keys left after purging.');
        t.done();
      });
    });
  });
};

exports["no key left behind"] = function (t) {
  var user = nohm.factory('UserMockup');
  var user2 = nohm.factory('UserMockup');
  t.expect(3);

  user2.property({
    name: 'user2',
    email: 'user2@test.com'
  });

  user.link(user2);
  user2.link(user, 'father');

  async.series([
    async.apply(h.cleanUp, redis, args.prefix),
    function (cb) {
      user.save(cb);
    },
    function (cb) {
      user2.save(cb);
    },
    function (cb) {
      user.unlink(user2);
      user2.save(cb);
    },
    function (cb) {
      user2.remove(cb);
    },
    function (cb) {
      user.remove(cb);
    }
  ], function (err) {
    t.ok(!err, 'Unexpected saving error');
    redis.keys(prefix + ':*', function (err, keys) {
      t.ok(!err, 'Unexpected saving error');
      t.same(keys.length, 1, 'Not all keys were removed from the database'); // we keep the idsets and meta keys (version, idgenerator and properties), so it should be 4 here.
      t.done();
    });
  }
  );
};

exports["temporary model definitions"] = function (t) {
  t.expect(2);
  var user = nohm.factory('UserMockup');
  var user2 = nohm.factory('UserMockup');

  var TempUserMockup = nohm.model('UserMockup', {
    properties: {
      well_shit: {
        type: 'string'
      }
    }
  }, true);
  var new_user = new TempUserMockup();

  t.deepEqual(user.allProperties(), user2.allProperties(), 'HURASDASF');
  t.notDeepEqual(user.allProperties(), new_user.allProperties(), 'HURASDASF');
  t.done();
};

exports["changing unique frees old unique with uppercase values"] = function (t) {
  t.expect(3);
  var obj = nohm.factory('UserMockup');
  var obj2 = nohm.factory('UserMockup');
  var obj3 = nohm.factory('UserMockup');
  var old = "Changing Unique Property Frees The Value";
  obj.property('name', old);
  obj.property('email', 'change_frees@unique.de');

  obj.save(function (err) {
    t.ok(!err, 'Unexpected saving error');
    obj2.load(obj.id, function () {
      obj2.property('name', "changing unique property frees the value to something else");
      obj2.save(function (err) {
        t.ok(!err, 'Unexpected saving error');
        obj3.load(obj.id, function () {
          obj2.property('name', old);
          obj2.save(function (err) {
            t.ok(!err, 'Unexpected saving error. (May be because old uniques are not freed properly on chnage.');
            t.done();
          });
        });
      });
    });
  });
};

exports["removing unique frees unique with uppercase values"] = function (t) {
  t.expect(3);
  var obj = nohm.factory('UserMockup');
  var obj2 = nohm.factory('UserMockup');
  var old = "Removing Unique Property Frees The Value";
  obj.property('name', old);
  obj.property('email', 'remove_frees@unique.de');

  obj.save(function (err) {
    t.ok(!err, 'Unexpected saving error: ' + err);
    obj.remove(obj.id, function (err) {
      t.ok(!err, 'Unexpected removing error: ' + err);
      obj2.property('name', old);
      obj2.save(function (err) {
        t.ok(!err, 'Unexpected saving error. (May be because old uniques are not freed properly on chnage.');
        t.done();
      });
    });
  });
};
