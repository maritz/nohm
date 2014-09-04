var async = require('async');
var nohm = require(__dirname + '/../lib/nohm').Nohm;
var h = require(__dirname + '/helper.js');
var args = require(__dirname + '/testArgs.js');
var redis = args.redis;

var UserFindMockup = nohm.model('UserFindMockup', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'testName',
      index: true,
      validations: [
        'notEmpty'
        ]
    },
    email: {
      type: 'string',
      defaultValue: 'testMail@test.de',
      unique: true
    },
    gender: {
      type: 'string'
    },
    json: {
      type: 'json',
      defaultValue: '{}'
    },
    number: {
      type: 'integer',
      defaultValue: 1,
      index: true
    },
    number2: {
      type: 'integer',
      defaultValue: 200,
      index: true
    },
    bool: {
      type: 'bool',
      defaultValue: false
    }
  },
  idGenerator: 'increment'
});

var UserFindNoIncrementMockup = nohm.model('UserFindNoIncrementMockup', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'testName',
      index: true,
      validations: [
        'notEmpty'
        ]
    },
    number: {
      type: 'integer',
      defaultValue: 1,
      index: true
    }
  }
});

nohm.model('UniqueIntegerFind', {
  properties: {
    unique: {
      type: 'integer',
      unique: true
    }
  }
});

var errLogger = function(err) {
  if (err) {
    console.dir(err);
  }
};

var createUsers = function(props, modelName, callback) {
  if (typeof(modelName) === 'function') {
    callback = modelName;
    modelName = 'UserFindMockup';
  }
  var makeSeries = function(prop) {
    return function(next) {
      var user = nohm.factory(modelName);
      user.p(prop);
      user.save(function (err) {
        next(err, user);
      });
    };
  };

  var series = props.map(function(prop) {
    return makeSeries(prop);
  });

  async.series(series, function(err, users) {
    var ids = users.map(function (user) {
      return user.id;
    });
    callback(users, ids);
  });
};

exports.find = {

  setUp: function(next) {
    if (!nohm.client) {
      nohm.setClient(redis);
    }
    var t = this;
    h.cleanUp(redis, args.prefix, function() {
      createUsers([{
        name: 'numericindextest',
        email: 'numericindextest@hurgel.de',
        gender: 'male',
        number: 3
      }, {
        name: 'numericindextest',
        email: 'numericindextest2@hurgel.de',
        gender: 'male',
        number: 4,
        number2: 33
      }, {
        name: 'numericindextest',
        email: 'numericindextest3@hurgel.de',
        gender: 'female',
        number: 4,
        number2: 1
      }, {
        name: 'uniquefind',
        email: 'uniquefind@hurgel.de'
      }, {
        name: 'indextest',
        email: 'indextest@hurgel.de'
      }, {
        name: 'indextest',
        email: 'indextest2@hurgel.de'
      }, {
        name: 'a_sort_first',
        email: 'a_sort_first@hurgel.de',
        number: 1
      }, {
        name: 'z_sort_last',
        email: 'z_sort_last@hurgel.de',
        number: 100000
      }], function(users, ids) {
        t.users = users;
        t.userIds = ids;
        next();
      });
    });
  },
  tearDown: function(next) {
    h.cleanUp(redis, args.prefix, next);
  },


  loadInvalid: function(t) {
    var user = new UserFindMockup();
    t.expect(1);

    h.cleanUp(redis, args.prefix, function () {
      user.load(1, function(err) {
        t.equals(err, 'not found', 'Load() did not return "not found" for id 1 even though there should not be a user yet.');
        t.done();
      });
    });
  },


  load: function(t) {
    var user = new UserFindMockup(),
        findUser = new UserFindMockup();
    t.expect(5);

    user.p({
      name: 'hurgelwurz',
      email: 'hurgelwurz@hurgel.de',
      json: {
        test: 1
      },
      bool: 'true'
    });

    user.save(function(err) {
      if (err) {
        console.dir(err);
        t.done();
      }
      findUser.load(user.id, function(err) {
        if (err) {
          console.dir(err);
          t.done();
        }
        t.equals(user.p('name'), findUser.p('name'), 'The loaded version of the name was not the same as a set one.');
        t.equals(user.p('email'), findUser.p('email'), 'The loaded version of the email was not the same as a set one.');
        t.equals(findUser.p('json').test, 1, 'The loaded version of the json was not the same as the set one.');
        t.equals(user.id, findUser.id, 'The loaded version of the email was not the same as a set one.');
        t.equals(findUser.p('bool'), true, 'The loaded version of the boolean was not the same as a set one.');
        t.done();
      });
    });
  },


  findAndLoad: function (t) {
    var user = new UserFindMockup();
    var user2 = new UserFindMockup();

    user.p({
      name: 'hurgelwurz',
      email: 'hurgelwurz@hurgel.de',
    });
    user2.p({
      name: 'hurgelwurz',
      email: 'hurgelwurz2@hurgel.de',
    });

    async.parallel([
      function (done) {
        user.save(done);
      },
      function (done) {
        user2.save(done);
      }
    ], function(err) {
      if (err) {
        console.dir(err);
        t.done();
      }
      UserFindMockup.findAndLoad({name: "hurgelwurz"}, function(err, users) {
        if (err) {
          console.dir(err);
          t.done();
        }
        t.equals(users.length, 2, 'The loaded number of users was not 2.');
        t.equals(user.p('name'), users[0].p('name'), 'The loaded version of the name was not the same as a set one.');
        t.equals(user.p('email'), users[0].p('email'), 'The loaded version of the email was not the same as a set one.');
        t.equals(user.id, users[0].id, 'The loaded version of the email was not the same as a set one.');
        t.done();
      });
    });
  },


  findAll: function(t) {
    var self = this;
    var findUser = new UserFindMockup();
    t.expect(1);

    findUser.find(function(err, ids) {
      ids.sort(); // usually redis returns them first-in-first-out, but not always
      t.same(self.userIds, ids, 'find() did not return all users when not given any search parameters.');
      t.done();
    });
  },

  exists: function(t) {
    var existsUser = new UserFindMockup();
    t.expect(2);


    existsUser.exists(1, function(exists) {
      t.equals(exists, true, 'Exists() did not return true for id 1.');

      existsUser.exists(9999999, function(exists) {
        t.equals(exists, false, 'Exists() did not return false for id 9999999.');
        t.done();
      });
    });
  },

/* I don't know how to do this right now.
loadArray: function (t) {
  var findUser = new UserFindMockup();
  t.expect(2);

  findUser.load(all, function (err, users) {
    errLogger(err);
    t.ok(Array.isArray(users), 'load()ing an array of ids did not return an array');
    t.same(all.length, users.length, 'load()ing an array of ids did not return an array with the coorect length');
  });
},*/

  findByInvalidSearch: function(t) {
    var findUser = new UserFindMockup();
    t.expect(1);

    console.log('There should be an error in the next line');
    findUser.find({
      gender: 'male'
    }, function(err, ids) {
      t.same(0, ids.length, 'Searching for a nonexistant index did not return an empty array.');
      t.done();
    });
  },

  findByUnique: function(t) {
    var findUser = new UserFindMockup();
    var userUnique = this.users.filter(function (user) {
      return user.p('name') ==='uniquefind';
    })[0];
    t.expect(1);

    findUser.find({
      email: userUnique.p('email')
    }, function(err, ids) {
      if (err) {
        console.dir(err);
      }
      t.same(ids, [userUnique.id], 'The found id did not match the id of the saved object.');
      t.done();
    });
  },

  findByUniqueOtherCase: function(t) {
    var findUser = new UserFindMockup();
    var userUnique = this.users.filter(function (user) {
      return user.p('name') ==='uniquefind';
    })[0];
    t.expect(1);

    findUser.find({
      email: userUnique.p('email').toUpperCase()
    }, function(err, ids) {
      if (err) {
        console.dir(err);
      }
      t.same(ids, [userUnique.id], 'The found id did not match the id of the saved object.');
      t.done();
    });
  },

  findByUniqueInvalidSearch: function(t) {
    var findUser = new UserFindMockup();
    t.expect(1);

    console.log('There should be an error in the next line');
    findUser.find({
      email: {}
    }, function(err) {
      t.same(0, err.indexOf('Invalid search parameters'), 'The found id did not match the id of the saved object.');
      t.done();
    });
  },

  findByIntegerUnique: function(t) {
    var saveObj = nohm.factory('UniqueIntegerFind');
    var findObj = nohm.factory('UniqueIntegerFind');
    t.expect(3);

    saveObj.p('unique', 123);
    saveObj.save(function (err) {
      t.ok(!err, 'Unexpected saving error');

      findObj.find({
        unique: saveObj.p('unique')
      }, function(err, ids) {
        t.ok(!err, 'Unexpected finding error');
        t.same(ids, [saveObj.id], 'The found id did not match the id of the saved object.');
        t.done();
      });
    });
  },

  findByStringIndex: function(t) {
    var findUser = new UserFindMockup();
    var users = this.users.filter(function (user) {
      return user.p('name') ==='indextest';
    });
    t.expect(1);

    findUser.find({
      name: 'indextest'
    }, function(err, ids) {
      if (err) {
        console.dir(err);
      }
      t.same(ids, [users[0].id, users[1].id], 'The found id did not match the id of the saved object.');
      t.done();
    });
  },

  findByNumericIndex: function(t) {
    var findUser = new UserFindMockup();
    var users = this.users.filter(function (user) {
      return user.p('number') > 2 && user.p('number2') < 100;
    });
    t.expect(1);

    findUser.find({
      number: {
        min: 2
      },
      number2: {
        max: 100,
        limit: 2
      }
    }, function(err, ids) {
      errLogger(err);
      t.same(ids.sort(), [users[0].id, users[1].id].sort(), 'The found id did not match the id of the saved object.');
      t.done();
    });
  },

  findByMixedIndex: function(t) {
    var findUser = new UserFindMockup();
    t.expect(1);

    createUsers([{
      name: 'mixedindextest',
      email: 'mixedindextest@hurgel.de',
      number: 3,
      number2: 33
    }, {
      name: 'mixedindextest',
      email: 'mixedindextest2@hurgel.de',
      number: 4,
      number2: 33
    }, {
      name: 'mixedindextestNOT',
      email: 'mixedindextest3@hurgel.de',
      number: 4,
      number2: 1
    }, {
      name: 'mixedindextest',
      email: 'mixedindextest4@hurgel.de',
      number: 1,
      number2: 33
    }], function (users) {

      findUser.find({
        number: {
          min: 2
        },
        number2: {
          max: 100
        },
        name: 'mixedindextest'
      }, function(err, ids) {
        if (err) {
          console.dir(err);
        }
        t.same(ids.sort(), [users[0].id, users[1].id].sort(), 'The found id did not match the id of the saved object.');
        t.done();
      });
    });
  },

  findSameNumericTwice: function(t) {
    var self = this;
    var findUser = new UserFindMockup();
    t.expect(2);


    createUsers([{
      name: 'SameNumericTwice',
      email: 'SameNumericTwice@hurgel.de',
      number: 3000
    }, {
      name: 'SameNumericTwice2',
      email: 'SameNumericTwice2@hurgel.de',
      number: 3000
    }], function (users, userIds) {
      findUser.find({
        number: {
          min: 3000
        }
      }, function(err, ids) {
        if (err) {
          console.dir(err);
        }
        userIds.push(self.userIds[self.userIds.length-1]);
        t.same(userIds.length, 3, 'Didn\'t create 2 users, instead: '+userIds.length);
        t.same(ids.sort(), userIds.sort(), 'The found id did not match the id of the saved objects.');
        t.done();
      });
    });
  },

  findByMixedIndexMissing: function(t) {
    var findUser = new UserFindMockup();
    t.expect(1);

    createUsers([{
      name: 'mixedindextestMissing',
      email: 'mixedindextestMissing@hurgel.de',
      number: 4
    }, {
      name: 'mixedindextestMissing2',
      email: 'mixedindextestMissing2@hurgel.de',
      number: 4
    }], function () {
      findUser.find({
        number: {
          min: 2
        },
        name: 'mixedindextASDASDestMISSING'
      }, function(err, ids) {
        if (err) {
          console.dir(err);
        }
        t.same(ids, [], 'Ids were found even though the name should not be findable.');
        t.done();
      });
    });
  },


  findNumericWithoutLimit: function(t) {
    var findUser = new UserFindMockup(),
        usersLooped = 0,
        loopUserCreation = function(err) {
          if (err) {
            t.ok(false, 'Error while creating findUsers');
          }
          usersLooped++;
          if (usersLooped === 55) {
            findUser.find({
              number: {
                min: 1,
                limit: 0
              }
            }, function(err, ids) {
              errLogger(err);
              t.ok(ids.length > 54, 'The limit: 0 option did not return more than 50 ids.');
              t.done();
            });
          }
        };
    t.expect(1);

    for (var i = 0, len = 55; i < len; i++) {
      var user = new UserFindMockup();
      user.p({
        name: 'findNumericWithoutLimit' + i,
        email: 'findNumericWithoutLimit' + i + '@hurgel.de',
        number: i
      });

      user.save(loopUserCreation);
    }
  },

  findExactNumeric: function(t) {
    var user = new UserFindMockup(),
        findUser = new UserFindMockup(),
        num = 999876543;
    t.expect(2);

    user.p({
      name: 'findExactNumeric',
      email: 'findExactNumeric@hurgel.de',
      number: num
    });
    user.save(function(err) {
      if (err) {
        console.dir(err);
      }
      findUser.find({
        number: num
      }, function(err, ids) {
        t.same(ids, [user.id], 'Did not find an exact number match');
        findUser.find({
          number: (num - 1)
        }, function(err, ids) {
          t.same(ids, [], 'Searching for a nonexistant number did not return an empty array.');
          t.done();
        });
      });
    });
  },

  loadReturnsProps: function(t) {
    var user = new UserFindMockup(),
        findUser = new UserFindMockup();
    t.expect(1);

    user.p({
      name: 'loadReturnsProps',
      email: 'loadReturnsProps@hurgel.de',
      json: {
        test: 1
      }
    });

    user.save(function(err) {
      if (err) {
        console.dir(err);
        t.done();
      }
      findUser.load(user.id, function(err, props) {
        if (err) {
          console.dir(err);
          t.done();
        }
        var testProps = user.allProperties();
        delete testProps.id;
        t.same(props, testProps, 'The loaded properties are not the same as allProperties() (without id).');
        t.done();
      });
    });
  },

  shortForms: function(t) {
    t.expect(12);
    var shortFormMockup = nohm.model('shortFormMockup', {
      properties: {
        name: {
          type: 'string',
          defaultValue: 'testName',
          index: true,
          validations: [
            'notEmpty'
            ]
        }
      },
      idGenerator: 'increment'
    });

    var saved = shortFormMockup.save(function(err) {
      t.same(saved, this, '`this` is not equal to the return value of save().');
      var id = saved.id;
      t.ok(!err, 'There was an error while saving');
      t.ok(saved instanceof shortFormMockup, '´this´ was not set to an instance of UserFindMockup');
      t.ok(id > 0, 'The id was not set properly');
      saved.p('name', 'shortForm');
      saved.save(function() {
        saved.p('name', 'asdasd'); // make sure our comparisons in load aren't bogus
        shortFormMockup.load(id, function(err, props) {
          t.ok(!err, 'There was an error while loading.');
          t.ok(props.hasOwnProperty('name') && props.name === 'shortForm', 'The props argument was not properly passed in load.');
          t.same(this.p('name'), 'shortForm', 'The `this` instance has some property issues.');
          shortFormMockup.find({
            name: 'shortForm'
          }, function(err, ids) {
            t.ok(!err, 'There was an error while finding');
            t.same(ids, [id], 'The found ids do not match [id]');
            shortFormMockup.remove(id, function(err) {
              t.ok(!err, 'There was an error while removing');
              shortFormMockup.find({
                name: 'shortForm'
              }, function(err, ids) {
                t.ok(!err, 'There was en error while finding the second time');
                t.same(ids, [], 'Remove did not remove the correct instance. Uh-Oh.... :D ');
                t.done();
              });
            });
          });
        });
      });
    });
  },

  uuidLoadFind: function(t) {
    t.expect(6);
    var uuidMockup = nohm.model('uuidMockup', {
      properties: {
        name: {
          type: 'string',
          defaultValue: 'testName',
          index: true,
          validations: [
            'notEmpty'
            ]
        }
      }
    });

    var test = new uuidMockup();
    test.p('name', 'uuid');

    var test2 = new uuidMockup();
    test2.p('name', 'uuid2');

    test.save(function() {
      t.ok(test.id.length > 0, 'There was no proper id generated');
      test2.save(function() {
        t.ok(test.id !== test2.id, 'The uuids were the same.... ');
        var loader = new uuidMockup();
        loader.load(test.id, function(err, props) {
          t.ok(!err, 'There was an error while loading');
          t.same(props.name, test.p('name'), 'The loaded properties were not correct.');
          uuidMockup.find({
            name: test.p('name')
          }, function(err, ids) {
            t.ok(!err, 'There was an error while finding.');
            t.same([test.id], ids, 'Did not find the correct ids');
            t.done();
          });
        });
      });
    });
  },

  "normal string IDs": {
    setUp: function (next) {
      var self = this;
      createUsers([{
      }, {
        name: 'blablub'
      }], 'UserFindNoIncrementMockup', function (users, ids) {
        self.users = users;
        self.userIds = ids;
        next();
      });
    },
    tearDown: function (next) {
      h.cleanUp(redis, args.prefix, next);
    },

    find: function (t) {
      t.expect(2);
      var self = this;

      UserFindNoIncrementMockup.find({
        name: 'blablub'
      }, function (err, ids) {
        t.same(ids.length, 1, 'Did not find the correct number of ids for non-incremental id model.');
        t.same(ids[0], self.userIds[1], 'Did not find the correct id for non-incremental id model.');
        t.done();
      });
    },

    "load via constructor": function (t) {
      t.expect(2);
      var self = this;

      var test = new UserFindNoIncrementMockup(this.userIds[0], function (err) {
        t.ok(!err, 'There was an error while loading a model via constructor.');
        t.same(test.allProperties(), self.users[0].allProperties(), 'A loaded user did not match what should\'ve been saved.');
        t.done();
      });
    }
  },

  "search unique that doesn't exists": function (t) {
    t.expect(2);
    var test = nohm.factory('UserFindMockup');
    test.find({
      email: 'this_user_email_should_absolutely_not_exist. it\'s not even a valid email...'
    }, function (err, ids) {
      t.ok(!err, 'There was an error while searching an inexistant unique value.');
      t.same([], ids, 'The return of a search that didn\'t find anything was wrong.');
      t.done();
    });
  },

  "load via constructor": function (t) {
    t.expect(3);
    var test = nohm.factory('UserFindMockup');
    test.save(function (err) {
      t.ok(!err, 'There was an error while saving.');

      var test2 = new UserFindMockup(test.id, function (err) {
        t.ok(!err, 'There was an error while loading a model via constructor.');
        t.same(test2.allProperties(), test.allProperties(), 'The return of a search that didn\'t find anything was wrong.');
        t.done();
      });
    });
  },

  sort: {

    "all by name": function (t) {
      t.expect(2);

      var sorted_ids = this.users.sort(function (a, b) {
        a = a.p('name');
        b = b.p('name');
        return a > b ? 1 : (a < b ? -1 : 0);
      }).map(function (user) {
        return ''+user.id;
      });

      UserFindMockup.sort({
        field: 'name'
      }, function (err, ids) {
        t.same(null, err, 'Sorting caused an error: '+err);
        t.same(sorted_ids, ids, 'Sorting went wrong.');
        t.done();
      });
    },

    "all by name DESC": function (t) {
      t.expect(2);

      var sorted_ids = this.users.sort(function (a, b) {
        a = a.p('name');
        b = b.p('name');
        return a < b ? 1 : (a > b ? -1 : 0);
      }).map(function (user) {
        return ''+user.id;
      });

      UserFindMockup.sort({
        field: 'name',
        direction: 'DESC'
      }, function (err, ids) {
        t.same(null, err, 'Sorting caused an error: '+err);
        t.same(sorted_ids, ids, 'Sorting went wrong.');
        t.done();
      });
    },

    "all by name LIMIT 2, 3": function (t) {
      t.expect(2);

      var sorted_ids = this.users.sort(function (a, b) {
        a = a.p('name');
        b = b.p('name');
        return a > b ? 1 : (a < b ? -1 : 0);
      }).slice(2, 5)
      .map(function (user) {
        return ''+user.id;
      });

      UserFindMockup.sort({
        field: 'name',
        limit: [2,3]
      }, function (err, ids) {
        t.same(null, err, 'Sorting caused an error: '+err);
        t.same(sorted_ids, ids, 'Sorting went wrong.');
        t.done();
      });
    },

    "all by number": function (t) {
      t.expect(2);

      var sorted_ids = this.users.sort(function (a, b) {
        a = a.p('number');
        b = b.p('number');
        return a > b ? 1 : (a < b ? -1 : 0);
      }).map(function (user) {
        return ''+user.id;
      });

      UserFindMockup.sort({
        field: 'number'
      }, function (err, ids) {
        t.same(null, err, 'Sorting caused an error: '+err);
        t.same(sorted_ids, ids, 'Sorting went wrong.');
        t.done();
      });
    },

    "all by number DESC": function (t) {
      t.expect(2);

      var sorted_ids = this.users.sort(function (a, b) {
        var id_sort = a.id < b.id ? 1 : -1;
        a = a.p('number');
        b = b.p('number');
        return a < b ? 1 : (a > b ? -1 : id_sort);
      }).map(function (user) {
        return ''+user.id;
      });

      UserFindMockup.sort({
        field: 'number',
        direction: 'DESC'
      }, function (err, ids) {
        t.same(null, err, 'Sorting caused an error: '+err);
        t.same(sorted_ids, ids, 'Sorting went wrong.');
        t.done();
      });
    },

    "all by number LIMIT 3, 3": function (t) {
      t.expect(2);

      var sorted_ids = this.users.sort(function (a, b) {
        a = a.p('number');
        b = b.p('number');
        return a > b ? 1 : (a < b ? -1 : 0);
      }).slice(3, 6)
      .map(function (user) {
        return ''+user.id;
      });

      UserFindMockup.sort({
        field: 'number',
        limit: [3,3]
      }, function (err, ids) {
        t.same(null, err, 'Sorting caused an error: '+err);
        t.same(sorted_ids, ids, 'Sorting went wrong.');
        t.done();
      });
    },
    "provided by name": function (t) {
      t.expect(2);

      var sorted_ids = this.users.sort(function (a, b) {
        a = a.p('name');
        b = b.p('name');
        return a > b ? 1 : (a < b ? -1 : 0);
      }).map(function (user) {
        return ''+user.id;
      });

      UserFindMockup.sort({
        field: 'name'
      }, this.userIds, function (err, ids) {
        t.same(null, err, 'Sorting caused an error: '+err);
        t.same(sorted_ids, ids, 'Sorting went wrong.');
        t.done();
      });
    },

    "provided by name DESC": function (t) {
      t.expect(2);

      var sorted_ids = this.users.sort(function (a, b) {
        a = a.p('name');
        b = b.p('name');
        return a < b ? 1 : (a > b ? -1 : 0);
      }).map(function (user) {
        return ''+user.id;
      });

      UserFindMockup.sort({
        field: 'name',
        direction: 'DESC'
      }, this.userIds, function (err, ids) {
        t.same(null, err, 'Sorting caused an error: '+err);
        t.same(sorted_ids, ids, 'Sorting went wrong.');
        t.done();
      });
    },

    "provided by name LIMIT 2, 3": function (t) {
      t.expect(2);

      var sorted_ids = this.users.sort(function (a, b) {
        a = a.p('name');
        b = b.p('name');
        return a > b ? 1 : (a < b ? -1 : 0);
      }).slice(2, 5)
      .map(function (user) {
        return ''+user.id;
      });

      UserFindMockup.sort({
        field: 'name',
        limit: [2,3]
      }, this.userIds, function (err, ids) {
        t.same(null, err, 'Sorting caused an error: '+err);
        t.same(sorted_ids, ids, 'Sorting went wrong.');
        t.done();
      });
    },

    "provided by number": function (t) {
      t.expect(2);

      var sorted_ids = this.users.sort(function (a, b) {
        a = a.p('number');
        b = b.p('number');
        return a > b ? 1 : (a < b ? -1 : 0);
      }).map(function (user) {
        return ''+user.id;
      });

      UserFindMockup.sort({
        field: 'number'
      }, this.userIds, function (err, ids) {
        t.same(null, err, 'Sorting caused an error: '+err);
        t.same(sorted_ids, ids, 'Sorting went wrong.');
        t.done();
      });
    },

    "provided by number DESC": function (t) {
      t.expect(2);

      var sorted_ids = this.users.sort(function (a, b) {
        var id_sort = a.id < b.id ? 1 : -1;
        a = a.p('number');
        b = b.p('number');
        return a < b ? 1 : (a > b ? -1 : id_sort);
      }).map(function (user) {
        return ''+user.id;
      });

      UserFindMockup.sort({
        field: 'number',
        direction: 'DESC'
      }, this.userIds, function (err, ids) {
        t.same(null, err, 'Sorting caused an error: '+err);
        t.same(sorted_ids, ids, 'Sorting went wrong.');
        t.done();
      });
    },

    "provided by number LIMIT 3, 3": function (t) {
      t.expect(2);

      var sorted_ids = this.users.sort(function (a, b) {
        a = a.p('number');
        b = b.p('number');
        return a > b ? 1 : (a < b ? -1 : 0);
      }).slice(3, 6)
      .map(function (user) {
        return ''+user.id;
      });

      UserFindMockup.sort({
        field: 'number',
        limit: [3,3]
      }, this.userIds, function (err, ids) {
        t.same(null, err, 'Sorting caused an error: '+err);
        t.same(sorted_ids, ids, 'Sorting went wrong.');
        t.done();
      });
    },

    "provided empty list": function (t) {
      t.expect(2);

      UserFindMockup.sort({
        field: 'number',
        limit: [0, 10]
      }, [], function(err, ids) {
        t.same(null, err, 'Sorting caused an error: '+err);
        t.same(0, ids.length, 'Sorting went wrong when ids.length is 0.');
        t.done();
      });
    }
  },

  "load hash with extra properties": function (t) {
    var user = new UserFindMockup(),
        findUser = new UserFindMockup();
    t.expect(7);

    user.p({
      name: 'hurgelwurz',
      email: 'hurgelwurz@hurgel.de',
      json: {
        test: 1
      }
    });

    user.save(function(err) {
      if (err) {
        console.dir(err);
        t.done();
      }
      redis.hset(nohm.prefix.hash+findUser.modelName+':'+user.id, 'not_a_real_property', 'something... :-)', function (err) {
        t.ok(!err, 'Unexpected redis error in custom query');
        console.log('There should be an error in the next line');
        findUser.load(user.id, function(err) {
          t.ok(!err, 'Unexpected load error');
          t.equals(user.p('name'), findUser.p('name'), 'The loaded version of the name was not the same as a set one.');
          t.equals(user.p('email'), findUser.p('email'), 'The loaded version of the email was not the same as a set one.');
          t.equals(findUser.p('json').test, 1, 'The loaded version of the json was not the same as the set one.');
          t.equals(user.id, findUser.id, 'The loaded version of the email was not the same as a set one.');
          t.equals(user.p('bool'), false, 'The loaded version of the boolean was not the same as a set one.');
          t.done();
        });
      });
    });
  },

  "descending order through higher min than max": function (t) {
    t.expect(2);

    UserFindMockup.find({
      number: {
        min: 3,
        max: '-inf'
      }
    }, function(err, ids) {
      t.ok(!err, 'Unexpected redis error in custom query');
      t.same([1, 7, 6, 5, 4], ids, 'Searching when min>max condition(ZREVRANGEBYSCORE) is invalid.');
      t.done();
    });
  },

  "descending order through higher min than max with limit 2": function (t) { // should produce lexical ordering for the second which should be 7 (due)
    t.expect(2);

    UserFindMockup.find({
      number: {
        min: 3,
        max: '-inf',
        limit: 2
      }
    }, function(err, ids) {
      t.ok(!err, 'Unexpected redis error in custom query');
      t.same([1, 7], ids, 'Searching when min>max condition(ZREVRANGEBYSCORE) with limit is invalid.');
      t.done();
    });
  },

  "endpoints exclude left": function (t) {
    t.expect(2);

    UserFindMockup.find({
      number: {
        min: 3,
        max: 1,
        endpoints: '(]'
      }
    }, function(err, ids) {
      t.ok(!err, 'Unexpected redis error in custom query');
      t.same([7, 6, 5, 4], ids, 'Defining an endpoint failed.');
      t.done();
    });
  },

  "endpoints exclude right": function (t) {
    t.expect(2);

    UserFindMockup.find({
      number: {
        min: 3,
        max: 1,
        endpoints: '[)'
      }
    }, function(err, ids) {
      t.ok(!err, 'Unexpected redis error in custom query');
      t.same([1], ids, 'Defining an endpoint failed.');
      t.done();
    });
  },

  "endpoints exclude both": function (t) {
    t.expect(2);

    UserFindMockup.find({
      number: {
        min: 3,
        max: 1,
        endpoints: '()'
      }
    }, function(err, ids) {
      t.ok(!err, 'Unexpected redis error in custom query');
      t.same([], ids, 'Defining an endpoint failed.');
      t.done();
    });
  },

  "endpoints only specify one": function (t) {
    t.expect(4);

    UserFindMockup.find({
      number: {
        min: 3,
        max: 1,
        endpoints: '('
      }
    }, function(err, ids) {
      t.ok(!err, 'Unexpected redis error in custom query');
      t.same([7, 6, 5, 4], ids, 'Defining an endpoint failed.');
      UserFindMockup.find({
        number: {
          min: 3,
          max: 1,
          endpoints: ')'
        }
      }, function(err, ids) {
        t.ok(!err, 'Unexpected redis error in custom query');
        t.same([1], ids, 'Defining an endpoint failed.');
        t.done();
      });
    });
  },

  "find numeric options parsing and defaulting": function (t) {
    t.expect(2);

    UserFindMockup.find({
      number: {
        min: "1",
        max: "not a number",
        offset: [1],
        limit: function () { return "Nope, not a number either." },
        endpoints: '('
      }
    }, function(err, ids) {
      t.ok(!err, 'Unexpected redis error in custom query');
      t.same(ids, [2, 3, 8], 'Invalid or parseAble find options caused wrong search results.');
      t.done();
    });
  },

  "find numeric with offset and limit": function (t) {
    t.expect(2);

    UserFindMockup.find({
      number: {
        min: 1,
        limit: 3,
        offset: 2
      }
    }, function(err, ids) {
      t.ok(!err, 'Unexpected redis error in custom query');
      t.same(ids, [6, 7, 1], 'The found ids were incorrect.');
      t.done();
    });
  },

  "find numeric with offset and limit were the offset reduces the set below the limit": function (t) {
    var findUser = new UserFindMockup();
    t.expect(2);

    findUser.find({
      number: {
        min: 1,
        limit: 3,
        offset: 6
      }
    }, function(err, ids) {
      t.ok(!err, 'Unexpected redis error in custom query');
      t.same(ids, [3, 8], 'The found ids were incorrect.');
      t.done();
    });
  },

  "find numeric with offset without limit": function (t) {
    var findUser = new UserFindMockup();
    t.expect(2);

    findUser.find({
      number: {
        min: 1,
        offset: 5
      }
    }, function(err, ids) {
      t.ok(!err, 'Unexpected redis error in custom query');
      t.same(ids, [2, 3, 8], 'The found ids were incorrect.');
      t.done();
    });
  }


};
