var util = require('util');
var args = require('testArgs');

exports.checkModules = function (t) {
  var redis, nohm, async;
  t.expect(3);

  redis = require('redis');
  t.ok(typeof redis.createClient === 'function', 'the redis client library should be available.');

  nohm = require(__dirname+'/../lib/nohm');
  t.ok(typeof nohm.Nohm === 'function', 'nohm should be available -- something is fishy here.');

  async = require('async');
  t.ok(typeof async !== 'undefined', 'async should be available.');

  t.done();
};

var prefix = args.prefix;

// real tests start in 3.. 2.. 1.. NOW!
var redis = args.redis,
    nohm = require(__dirname+'/../lib/nohm').Nohm,
    helper = require(__dirname+'/../lib/helpers'),
    async = require('async'),
    UserMockup = nohm.model('UserMockup', {
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
        test: function test () {
          return this.p('name');
        },
        prop: function prop (name) {
          if (name === 'super')
            return this._super_prop('name');
          else 
            return this._super_prop.apply(this, arguments, 0);
        }
      },
      idGenerator: 'increment'
    });

exports.redisClean = function (t) {
  t.expect(1);
  redis.keys(prefix + ':*:*Mockup:*', function (err, value) {
    var check = (Array.isArray(value) && value.length === 0) || value === null;
    t.ok(check, 'The redis database seems to contain fragments from previous nohm testruns. Use the redis command "KEYS '+prefix+':*:*Mockup:*" to see what keys could be the cause.');
    t.done();
  });
};

exports.idIntersection = function (t) {
  var arr1 = [1,2,3,4,5,6,7,8,9],
      arr2 = [2,3,4,10],
      arr3 = [2,3,4,10],
      arr4 = [],
      arr5 = [16,28,39],
      arr6 = ['hurgelwurz',28,39],
      arr7 = ['hurgelwurz',28,39],
      arr8 = [10,3,2],
      testIntersection = function (arrs, resultTest) {
        var result;
            
        result = helper.idIntersection.apply(null, arrs);
        t.same(result, resultTest, 'idIntersection did not perform correctly.');
      };
  t.expect(9);
  
  testIntersection(
    [arr1],
    arr1
  );
  
  testIntersection(
    [arr1, arr2],
    [2,3,4]
  );
  
  testIntersection(
    [arr1, arr2, arr3],
    [2,3,4]
  );
  
  testIntersection(
    [arr2, arr3],
    [2,3,4, 10]
  );
  
  testIntersection(
    [arr1, arr2, arr3, arr4],
    []
  );
  
  testIntersection(
    [arr1, arr2, arr3, arr5],
    []
  );
  
  testIntersection(
    [arr5, arr6],
    [28,39]
  );
  
  testIntersection(
    [arr6, arr7],
    ['hurgelwurz',28,39]
  );
  
  testIntersection(
    [arr3, arr8],
    [10, 3, 2]
  );
    
  t.done();
};

exports.setRedisClient = function (t) {
  t.expect(2);
  console.log('Note: there should be an error message in the next line. (intended behaviour)');
  var user = new UserMockup();
  t.same(user, {}, 'Creating a model without having a nohm client set did not return false.');
  
  nohm.setClient(redis);
  user = new UserMockup();
  t.equals(typeof(user.modelName), 'string', 'Creating a model having a nohm client set did not work.');
  t.done();
};

exports.setPrefix = function (t) {
  var oldPrefix = nohm.prefix;
  t.expect(1);
  nohm.setPrefix('hurgel');
  t.same(nohm.prefix, helper.getPrefix('hurgel'), 'Setting a custom prefix did not work as expected');
  nohm.prefix = oldPrefix;
  t.done();
};

exports.propertyGetter = function (t) {
  var user = new UserMockup(),
  exceptionThrown;
  t.expect(7);

  t.equals(typeof(user.p), 'function', 'Property getter short p is not available.');

  t.equals(typeof(user.prop), 'function', 'Property getter short prop is not available.');

  t.equals(typeof(user.property), 'function', 'Property getter is not available.');

  t.equals(user.p('email'), 'email@email.de', 'Property getter did not return the correct value for email.');

  t.equals(user.p('name'), 'test', 'Property getter did not return the correct value for name.');

  console.log('Note: there should be an error message in the next line. (intended behaviour)');
  t.ok(!user.p('hurgelwurz'), 'Accessing an undefined property did not return false');

  t.same(user.p('json'), {}, 'Property getter did not return the correct value for json.');

  t.done();
};


exports.propertySetter = function (t) {
  var user = new UserMockup(),
  result,
  controlUser = new UserMockup();
  t.expect(7);

  t.ok(user.p('email', 'asdasd'), 'Setting a property without validation did not return `true`.');

  t.equals(user.p('email'), 'asdasd', 'Setting a property did not actually set the property to the correct value');

  t.ok(user.p('email', null), 'Setting a property without validation did not return `true`.');

  user.p('email', 'test@test.de');
  t.ok(user.p('email') !== controlUser.p('email'), 'Creating a new instance of an Object does not create fresh properties.');

  user.p({
    name: 'objectTest',
    email: 'object@test.de'
  });

  t.equals(user.p('name'), 'objectTest', 'Setting multiple properties by providing one object did not work correctly for the name.');
  t.equals(user.p('email'), 'object@test.de', 'Setting multiple properties by providing one object did not work correctly for the email.');

  user.p('json', {
    test: 1
  });

  t.equals(user.p('json').test, 1, 'Setting a json property did not work correctly.');

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
    email: user.p('email'),
    country: user.p('country'),
    json: {},
    id: user.id
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
      console.dir(err);
      console.dir(user.errors);
      t.done();
    }
    redis.hgetall(prefix + ':hash:UserMockup:' + user.id, function (err, value) {
      t.ok(!err, 'There was a redis error in the create test check.');
      t.ok(value.name.toString() === 'createTest', 'The user name was not saved properly');
      t.ok(value.visits.toString() === '0', 'The user visits were not saved properly');
      t.ok(value.email.toString() === 'createTest@asdasd.de', 'The user email was not saved properly');
      t.done();
    });
  });
};

exports.remove = function (t) {
  var user = new UserMockup(),
  testExists,
  testBattery;
  t.expect(9);

  testExists = function (what, key, callback) {
    redis.exists(key, function (err, value) {
        t.ok(!err, 'There was a redis error in the remove test check.');
        t.ok(value === 0, 'Deleting a user did not work: '+what+', key: '+key);
        callback();
      });
  };

  user.p('name', 'deleteTest');
  user.p('email', 'deleteTest@asdasd.de');
  user.save(function (err) {
    t.ok(!err, 'There was an unexpected problem: ' + err);
    if (err) {
      t.done();
    }
    var id = user.id;
    user.remove(function (err) {
      t.ok(!err, 'There was a redis error in the remove test.');
      if (err) {
        t.done();
      }
      t.equals(user.id, 0, 'Removing an object from the db did not set the id to null');
      user.id = id; // the other tests need it back. :D
      async.series([
        function (callback) {
          testExists('hashes', prefix + ':hash:UserMockup:' + user.id, callback);
        },
        function (callback) {
          redis.sismember(prefix + ':index:UserMockup:name:' + user.p('name'), user.id, function (err, value) {
            t.ok((err === null && value === 0), 'Deleting a model did not properly delete the normal index.');
          });
          callback();
        },
        function (callback) {
          redis.zscore(prefix + ':scoredindex:UserMockup:visits', user.id, function (err, value) {
            t.ok((err === null && value === null), 'Deleting a model did not properly delete the scored index.');
          });
          callback();
        },
        function (callback) {
          testExists('uniques', prefix + ':uniques:UserMockup:name:' + user.p('name'), callback);
        }
      ], t.done);
    });
  });
};

exports.idSets = function (t) {
  var user = new UserMockup(),
  tmpid = 0;
  t.expect(6);
  user.p('name', 'idSetTest');
  user.save(function (err) {
    t.ok(!err, 'There was an unexpected redis error.');
    tmpid = user.id;
    redis.sismember(prefix + ':idsets:' + user.modelName, tmpid, function (err, value) {
      t.ok(!err, 'There was an unexpected redis error.');
      t.equals(value, 1, 'The userid was not part of the idset after saving.');
      user.remove(function (err) {
        t.ok(!err, 'There was an unexpected redis error.');
        redis.sismember(prefix + ':idsets:' + user.modelName, tmpid, function (err, value) {
          t.ok(!err, 'There was an unexpected redis error.');
          t.equals(value, 0, 'The userid was still part of the idset after removing.');
          t.done();
        });
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
      redis.hgetall(prefix + ':hash:UserMockup:' + user.id, function (err, value) {
        t.ok(!err, 'There was a redis error in the update test check.');
        if (err) {
          t.done();
        }
        t.ok(value.name.toString() === 'updateTest2', 'The user name was not updated properly');
        t.ok(value.email.toString() === 'updateTest2@email.de', 'The user email was not updated properly');
        t.done();
      });
    });
  });
};

exports.unique = function (t) {
  var user1 = new UserMockup(),
  user2 = new UserMockup();
  t.expect(8);

  user1.p('name', 'dubplicateTest');
  user1.p('email', 'dubplicateTest@test.de');
  user2.p('name', 'dubplicateTest');
  user2.p('email', 'dubbplicateTest@test.de');
  user1.save(function (err) {
    t.ok(!err, 'There was an unexpected problem: ' + util.inspect(err));
    redis.get(prefix + ':uniques:UserMockup:name:dubplicateTest', function (err, value) {
      t.ok(user1.id, 'Userid b0rked while checking uniques');
      t.equals(parseInt(value, 10), user1.id, 'The unique key did not have the correct id');
      user2.valid(false, false, function (valid) {
        t.ok(!valid, 'A unique property was not recognized as a duplicate in valid without setDirectly');
        user2.save(function (err) {
          t.equals(err, 'invalid', 'A saved unique property was not recognized as a duplicate');
          redis.exists(prefix + ':uniques:UserMockup:email:dubbplicateTest@test.de', function (err, value) {
            t.equals(value, 0, 'The tmp unique lock was not deleted for a failed save.');
            redis.get(prefix + ':uniques:UserMockup:name:dubplicateTest', function (err, value) {
              t.ok(!err, 'There was an unexpected probllem: ' + util.inspect(err));
              t.ok(parseInt(value, 10) === user1.id, 'The unique key did not have the correct id after trying to save another unique.');
              t.done();
            });
          });
        });
      });
    });
    if (err) {
      t.done();
    }
  });
};

exports.uniqueDeletion = function (t) {
  var user = new UserMockup();
  t.expect(2);

  user.p({
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

exports.indexes = function (t) {
  var user = new UserMockup();
  t.expect(7);

  user.p('name', 'indexTest');
  user.p('email', 'indexTest@test.de');
  user.p('country', 'indexTestCountry');
  user.p('visits', 20);

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
      t.ok(value == user.p('visits'), 'The visits index did not have the correct score.');
      redis.sismember(prefix + ':index:UserMockup:visits:' + user.p('visits'), user.id, function (err, value) {
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
  user.save(function (err) {
    if (err) {
      util.debug('Error while saving user in __updated.');
    }
    user.p('name', 'hurgelwurz');
    user.p('name', 'test');
    t.ok(user.properties.name.__updated === false, 'Changing a var manually to the original didn\'t reset the internal __updated var');

    user.remove(function (err) {
      if (err) {
        util.debug('Error while saving user in __updated.');
      }
      user = new UserMockup();
      user.p('name', 'hurgelwurz');
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
  
  t.same(typeof(user.test), 'function', 'Adding a method to a model did not create that method on a new instance.');
  t.same(user.test(), user.p('name'), 'The test method did not work properly. (probably doesn\'t have the correct `this`.');
  t.done();
};

exports.methodsSuper = function (t) {
  var user = new UserMockup();
  t.expect(3);
  
  t.same(typeof(user.prop), 'function', 'Overwriting a method in a model definition did not create that method on a new instance.');
  t.same(user.prop('super'), user.p('name'), 'The super test method did not work properly.');
  user.prop('name', 'methodTest');
  t.same(user.p('name'), 'methodTest', 'The super test method did not properly handle arguments');
  t.done();
};

exports.uniqueDefaultOverwritten = function (t) {
  var user = new UserMockup();
  var user2 = new UserMockup();
  t.expect(2);
  
  user.save(function (err) {
    user2.save(function (err) {
      t.same(err, 'invalid', 'Saving a default unique value did not return with the error "invalid"');
      t.same(user2.errors.name, ['notUnique'], 'Saving a default unique value returned the wrong error: '+user2.errors.name);
      t.done();
    });
  });
};

exports.allPropertiesJson = function (t) {
  var user = new UserMockup();
  user.p('json', {test: 1});
  t.expect(1);
  
  user.save(function (err) {
    var testProps = user.allProperties();
    t.same(testProps.json, user.p('json'), 'allProperties did not properly parse json properties');
    t.done();
  });
};

exports.thisInCallbacks = function (t) {
  var user = new UserMockup();
  var checkCounter = 0;
  var checkSum = 13;
  var checkThis = function (name, cb) {
    return function () {
      checkCounter++;
      t.ok(this instanceof UserMockup, '`this` is not set to the instance in '+name);
      if (checkCounter === checkSum) {
        done();
      } else if (typeof(cb) === 'function') {
        cb();
      }
    };
  };
  t.expect(checkSum+1);
  
  var done = function () {
    user.remove(checkThis('remove', function () {
      t.done();
    }));
  };
  
  user.save(checkThis('createError', function () {
    user.p({
      name: 'thisInCallbacks',
      email: 'thisInCallbacks@test.de'
    });
    user.link(user, checkThis('link'));
    user.save(checkThis('create', function () {
      user.load(user.id, checkThis('load'));
      user.find({name: 'thisInCallbacks'}, checkThis('find'));
      user.save(checkThis('update', function (){
        user.p('email', 'asd');
        user.save(checkThis('updateError'));
      }));
      user.belongsTo(user, checkThis('belongsTo'));
      user.getAll('UserMockup', checkThis('getAll'));
      user.numLinks('UserMockup', checkThis('numLinks'));
      user.link(user, 'childa', true, checkThis('linkDirect'));
      user.unlink(user, 'childa', true, checkThis('linkDirect'));
      user.unlinkAll(null, checkThis('linkDirect'));
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
    
    t.ok(typeof(test1.p('time')) === 'number', 'time of test1 is not a number');
    t.ok(typeof(test2.p('time')) === 'number', 'time of test2 is not a number');
    t.ok(test1.p('time') < test2.p('time'), 'time of test2 is not lower than test1');
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
    t.same(typeof(test1.id), 'string', 'The generated id was not a string');
    t.done();
  });
}

exports.instanceLoad = function (t) {
  t.expect(1);
  var user = new UserMockup(1123123, function (err) {
    t.same(err, 'not found', 'Instantiating a user with an id and callback did not try to load it');
    t.done();
  });;
}

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
}
