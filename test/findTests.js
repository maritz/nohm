var async = require('async');
var Nohm = require(__dirname + '/../tsOut/');
var h = require(__dirname + '/helper.js');
var args = require(__dirname + '/testArgs.js');
var redis = args.redis;

const nohm = Nohm.nohm;

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

var errLogger = function (err) {
  if (err) {
    console.dir(err);
  }
};

var createUsers = function (props, modelName, callback) {
  if (typeof (modelName) === 'function') {
    callback = modelName;
    modelName = 'UserFindMockup';
  }

  var promises = props.map(async (prop) => {
    var user = await nohm.factory(modelName);
    user.property(prop);
    await user.save();
    return user;
  });

  Promise.all(promises).then((users) => {
    var ids = users.map(function (user) {
      return user.id;
    });
    callback(users, ids);
  });
};

exports.find = {

  setUp: function (next) {
    if (!nohm.client) {
      nohm.setClient(redis);
    }
    var t = this;
    h.cleanUp(redis, args.prefix, function () {
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
      }], function (users, ids) {
        t.users = users;
        t.userIds = ids;
        next();
      });
    });
  },
  tearDown: function (next) {
    h.cleanUp(redis, args.prefix, next);
  },


  loadInvalid: async (t) => {
    var user = new UserFindMockup();
    t.expect(1);

    h.cleanUp(redis, args.prefix, async () => {
      try {
        await user.load(1);
      } catch (err) {
        t.equals(err.message, 'not found', 'Load() did not return "not found" for id 1 even though there should not be a user yet.');
        t.done();
      }
    });
  },


  load: async (t) => {
    var user = new UserFindMockup(),
      findUser = new UserFindMockup();
    t.expect(5);

    user.property({
      name: 'hurgelwurz',
      email: 'hurgelwurz@hurgel.de',
      json: {
        test: 1
      },
      bool: 'true'
    });

    await user.save();
    await findUser.load(user.id);
    t.equals(user.property('name'), findUser.property('name'), 'The loaded version of the name was not the same as a set one.');
    t.equals(user.property('email'), findUser.property('email'), 'The loaded version of the email was not the same as a set one.');
    t.equals(findUser.property('json').test, 1, 'The loaded version of the json was not the same as the set one.');
    t.equals(user.id, findUser.id, 'The loaded version of the email was not the same as a set one.');
    t.equals(findUser.property('bool'), true, 'The loaded version of the boolean was not the same as a set one.');
    t.done();
  },


  findAndLoad: async (t) => {
    t.expect(4);
    var user = new UserFindMockup();
    var user2 = new UserFindMockup();

    user.property({
      name: 'hurgelwurz',
      email: 'hurgelwurz@hurgel.de',
    });
    user2.property({
      name: 'hurgelwurz',
      email: 'hurgelwurz2@hurgel.de',
    });

    await user.save();
    await user2.save();
    const users = await UserFindMockup.findAndLoad({ name: "hurgelwurz" });
    t.equals(users.length, 2, 'The loaded number of users was not 2.');
    t.equals(user.property('name'), users[0].property('name'), 'The loaded version of the name was not the same as a set one.');
    t.equals(user.property('email'), users[0].property('email'), 'The loaded version of the email was not the same as a set one.');
    t.equals(user.id, users[0].id, 'The loaded version of the email was not the same as a set one.');
    t.done();
  },

  findAndLoadNonExisting: async (t) => {
    t.expect(1);
    const users = await UserFindMockup.findAndLoad({ name: "hurgelwurz" });
    t.equals(users.length, 0, 'The loaded number of users was not 2.');
    t.done();
  },

  findAll: function (t) {
    var self = this;
    var findUser = new UserFindMockup();
    t.expect(1);

    (async () => {
      const ids = await findUser.find();
      ids.sort(); // usually redis returns them first-in-first-out, but not guaranteed
      t.same(self.userIds, ids, 'find() did not return all users when not given any search parameters.');
      t.done();
    })();
  },

  exists: async (t) => {
    var existsUser = new UserFindMockup();
    t.expect(2);


    let exists = await existsUser.exists(1);
    t.equals(exists, true, 'Exists() did not return true for id 1.');

    exists = await existsUser.exists(9999999);
    t.equals(exists, false, 'Exists() did not return false for id 9999999.');
    t.done();
  },

  findByInvalidSearch: async (t) => {
    var findUser = new UserFindMockup();
    t.expect(1);

    try {
      await findUser.find({
        gender: 'male'
      });
      t.same(true, false, 'Searching for a nonexistant index did not throw an error');
    } catch (err) {
      t.ok(
        err.message.match('Trying to search for non-indexed'),
        'Searching for a nonexistant index did not return an empty array.',
      );
      t.done();
    }
  },

  findByUnique: function (t) {
    var self = this;
    (async () => {
      var findUser = new UserFindMockup();
      var userUnique = self.users.filter(function (user) {
        return user.property('name') === 'uniquefind';
      })[0];
      t.expect(1);

      const ids = await findUser.find({
        email: userUnique.property('email')
      });
      t.same(ids, [userUnique.id], 'The found id did not match the id of the saved object.');
      t.done();
    })();
  },

  findByUniqueOtherCase: function (t) {
    var self = this;
    (async () => {
      var findUser = new UserFindMockup();
      var userUnique = this.users.filter(function (user) {
        return user.property('name') === 'uniquefind';
      })[0];
      t.expect(1);

      const ids = await findUser.find({
        email: userUnique.property('email').toUpperCase()
      });
      t.same(ids, [userUnique.id], 'The found id did not match the id of the saved object.');
      t.done();
    })();
  },

  findByUniqueInvalidSearch: async (t) => {
    var findUser = new UserFindMockup();
    t.expect(1);

    try {
      await findUser.find({
        email: {}
      });
    } catch (err) {
      t.same(0, err.message.indexOf('Invalid search parameters'), 'The found id did not match the id of the saved object.');
      t.done();
    }
  },

  findByIntegerUnique: async (t) => {
    var saveObj = await nohm.factory('UniqueIntegerFind');
    var findObj = await nohm.factory('UniqueIntegerFind');
    t.expect(1);

    saveObj.property('unique', 123);
    await saveObj.save();

    const ids = await findObj.find({
      unique: saveObj.property('unique')
    });
    t.same(ids, [saveObj.id], 'The found id did not match the id of the saved object.');
    t.done();
  },

  findByStringIndex: function (t) {
    var self = this;
    (async () => {
      var findUser = new UserFindMockup();
      var users = self.users.filter(function (user) {
        return user.property('name') === 'indextest';
      });
      t.expect(1);

      const ids = await findUser.find({
        name: 'indextest'
      });
      t.same(ids, [users[0].id, users[1].id], 'The found id did not match the id of the saved object.');
      t.done();
    })();
  },

  findByNumericIndex: function (t) {
    var self = this;
    (async () => {
      var findUser = new UserFindMockup();
      var users = this.users.filter(function (user) {
        return user.property('number') > 2 && user.property('number2') < 100;
      });
      t.expect(1);

      const ids = await findUser.find({
        number: {
          min: 2
        },
        number2: {
          max: 100,
          limit: 2
        }
      });
      t.same(ids.sort(), [users[0].id, users[1].id].sort(), 'The found id did not match the id of the saved object.');
      t.done();
    })();
  },


  findByMixedIndex: (t) => {
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
    }], async (users) => {
      const ids = await findUser.find({
        number: {
          min: 2
        },
        number2: {
          max: 100
        },
        name: 'mixedindextest'
      });
      t.same(ids.sort(), [users[0].id, users[1].id].sort(), 'The found id did not match the id of the saved object.');
      t.done();
    });
  },

  findSameNumericTwice: function (t) {
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
    }], async (users, userIds) => {
      userIds.push(self.userIds[self.userIds.length - 1]);
      t.same(userIds.length, 3, 'Didn\'t create 2 users, instead: ' + userIds.length);

      const ids = await findUser.find({
        number: {
          min: 3000
        }
      });
      t.same(ids.sort(), userIds.sort(), 'The found id did not match the id of the saved objects.');
      t.done();
    });
  },

  findByMixedIndexMissing: async (t) => {
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
    }], async () => {
      const ids = await findUser.find({
        number: {
          min: 2
        },
        name: 'mixedindextASDASDestMISSING'
      });
      t.same(ids, [], 'Ids were found even though the name should not be findable.');
      t.done();
    });
  },


  findNumericWithoutLimit: async (t) => {
    var findUser = new UserFindMockup(),
      usersLooped = 0;
    t.expect(1);

    for (var i = 0, len = 55; i < len; i++) {
      var user = new UserFindMockup();
      user.property({
        name: 'findNumericWithoutLimit' + i,
        email: 'findNumericWithoutLimit' + i + '@hurgel.de',
        number: i
      });

      await user.save();
    }
    const ids = await findUser.find({
      number: {
        min: 1,
        limit: 0
      }
    });
    t.ok(ids.length > 54, 'The limit: 0 option did not return more than 50 ids.');
    t.done();
  },

  findExactNumeric: async (t) => {
    var user = new UserFindMockup(),
      findUser = new UserFindMockup(),
      num = 999876543;
    t.expect(2);

    user.property({
      name: 'findExactNumeric',
      email: 'findExactNumeric@hurgel.de',
      number: num
    });
    await user.save();
    const ids = await findUser.find({
      number: num
    });
    t.same(ids, [user.id], 'Did not find an exact number match');
    const ids2 = await findUser.find({
      number: (num - 1)
    });
    t.same(ids2, [], 'Searching for a nonexistant number did not return an empty array.');
    t.done();
  },

  loadReturnsProps: async (t) => {
    var user = new UserFindMockup(),
      findUser = new UserFindMockup();
    t.expect(1);

    user.property({
      name: 'loadReturnsProps',
      email: 'loadReturnsProps@hurgel.de',
      json: {
        test: 1
      }
    });

    await user.save();
    const props = await findUser.load(user.id);
    var testProps = user.allProperties();
    t.same(props, testProps, 'The loaded properties are not the same as allProperties() (without id).');
    t.done();
  },

  shortForms: async (t) => {
    t.expect(3);
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

    var saved = new shortFormMockup();
    saved.property('name', 'shortForm');
    await saved.save();
    const id = saved.id;
    saved.property('name', 'asdasd'); // make sure our comparisons in load aren't bogus
    const loaded = await shortFormMockup.load(id);
    t.same(loaded.property('name'), 'shortForm', 'The returned instance has some property issues.');
    const ids = await shortFormMockup.find({
      name: 'shortForm'
    });
    t.same(ids, [id], 'The found ids do not match [id]');
    await shortFormMockup.remove(id);
    const idsAfterRemove = await shortFormMockup.find({
      name: 'shortForm'
    });
    t.same(idsAfterRemove, [], 'Remove did not remove the correct instance. Uh-Oh....');
    t.done();
  },

  uuidLoadFind: async (t) => {
    t.expect(4);
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
    test.property('name', 'uuid');

    var test2 = new uuidMockup();
    test2.property('name', 'uuid2');

    await test.save();
    t.ok(test.id.length > 0, 'There was no proper id generated');
    await test2.save();
    t.ok(test.id !== test2.id, 'The uuids were the same.... ');
    var loader = new uuidMockup();
    const props = await loader.load(test.id);
    t.same(props.name, test.property('name'), 'The loaded properties were not correct.');
    const ids = await new uuidMockup().find({
      name: test.property('name')
    });
    t.same([test.id], ids, 'Did not find the correct ids');
    t.done();
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
      var self = this;
      (async () => {
        t.expect(2);
        const ids = await new UserFindNoIncrementMockup().find({
          name: 'blablub'
        });
        t.same(ids.length, 1, 'Did not find the correct number of ids for non-incremental id model.');
        t.same(ids[0], self.userIds[1], 'Did not find the correct id for non-incremental id model.');
        t.done();
      })();
    },

  },

  "search unique that doesn't exists": async (t) => {
    t.expect(1);
    var test = await nohm.factory('UserFindMockup');
    const ids = await test.find({
      email: 'this_user_email_should_absolutely_not_exist. it\'s not even a valid email...'
    });
    t.same([], ids, 'The return of a search that didn\'t find anything was wrong.');
    t.done();
  },

  sort: {

    "all by name": function (t) {
      t.expect(1);

      const sorted_ids = this.users.sort(function (a, b) {
        a = a.property('name');
        b = b.property('name');
        return a > b ? 1 : (a < b ? -1 : 0);
      }).map(function (user) {
        return '' + user.id;
      });

      (async () => {
        const ids = await UserFindMockup.sort({
          field: 'name'
        });
        t.same(sorted_ids, ids, 'Sorting went wrong.');
        t.done();
      })();
    },

    "all by name DESC": function (t) {
      t.expect(1);

      var sorted_ids = this.users.sort(function (a, b) {
        a = a.property('name');
        b = b.property('name');
        return a < b ? 1 : (a > b ? -1 : 0);
      }).map(function (user) {
        return '' + user.id;
      });

      (async () => {
        const ids = await UserFindMockup.sort({
          field: 'name',
          direction: 'DESC'
        });
        t.same(sorted_ids, ids, 'Sorting went wrong.');
        t.done();
      })();
    },

    "all by name LIMIT 2, 3": function (t) {
      t.expect(1);

      var sorted_ids = this.users.sort(function (a, b) {
        a = a.property('name');
        b = b.property('name');
        return a > b ? 1 : (a < b ? -1 : 0);
      }).slice(2, 5)
        .map(function (user) {
          return '' + user.id;
        });

      (async () => {
        const ids = await UserFindMockup.sort({
          field: 'name',
          limit: [2, 3]
        });
        t.same(sorted_ids, ids, 'Sorting went wrong.');
        t.done();
      })();
    },

    "all by number": function (t) {
      t.expect(1);

      var sorted_ids = this.users.sort(function (a, b) {
        a = a.property('number');
        b = b.property('number');
        return a > b ? 1 : (a < b ? -1 : 0);
      }).map(function (user) {
        return '' + user.id;
      });

      (async () => {
        const ids = await UserFindMockup.sort({
          field: 'number'
        });
        t.same(sorted_ids, ids, 'Sorting went wrong.');
        t.done();
      })();
    },

    "all by number DESC": function (t) {
      t.expect(1);

      var sorted_ids = this.users.sort(function (a, b) {
        var id_sort = a.id < b.id ? 1 : -1;
        a = a.property('number');
        b = b.property('number');
        return a < b ? 1 : (a > b ? -1 : id_sort);
      }).map(function (user) {
        return '' + user.id;
      });

      (async () => {
        const ids = await UserFindMockup.sort({
          field: 'number',
          direction: 'DESC'
        });
        t.same(sorted_ids, ids, 'Sorting went wrong.');
        t.done();
      })();
    },

    "all by number LIMIT 3, 3": function (t) {
      t.expect(1);

      var sorted_ids = this.users.sort(function (a, b) {
        a = a.property('number');
        b = b.property('number');
        return a > b ? 1 : (a < b ? -1 : 0);
      }).slice(3, 6)
        .map(function (user) {
          return '' + user.id;
        });

      (async () => {
        const ids = await UserFindMockup.sort({
          field: 'number',
          limit: [3, 3]
        });
        t.same(sorted_ids, ids, 'Sorting went wrong.');
        t.done();
      })();
    },

    "provided by name": function (t) {
      t.expect(1);

      var sorted_ids = this.users.sort(function (a, b) {
        a = a.property('name');
        b = b.property('name');
        return a > b ? 1 : (a < b ? -1 : 0);
      }).map(function (user) {
        return '' + user.id;
      });

      (async () => {
        const ids = await UserFindMockup.sort({
          field: 'name'
        }, this.userIds);
        t.same(sorted_ids, ids, 'Sorting went wrong.');
        t.done();
      })();
    },

    "provided by name DESC": function (t) {
      t.expect(1);

      var sorted_ids = this.users.sort(function (a, b) {
        a = a.property('name');
        b = b.property('name');
        return a < b ? 1 : (a > b ? -1 : 0);
      }).map(function (user) {
        return '' + user.id;
      });

      (async () => {
        const ids = await UserFindMockup.sort({
          field: 'name',
          direction: 'DESC'
        }, this.userIds);
        t.same(sorted_ids, ids, 'Sorting went wrong.');
        t.done();
      })();
    },

    "provided by name LIMIT 2, 3": function (t) {
      t.expect(1);

      var sorted_ids = this.users.sort(function (a, b) {
        a = a.property('name');
        b = b.property('name');
        return a > b ? 1 : (a < b ? -1 : 0);
      }).slice(2, 5)
        .map(function (user) {
          return '' + user.id;
        });

      (async () => {
        const ids = await UserFindMockup.sort({
          field: 'name',
          limit: [2, 3]
        }, this.userIds);
        t.same(sorted_ids, ids, 'Sorting went wrong.');
        t.done();
      })();
    },

    "provided by number": function (t) {
      t.expect(1);

      var sorted_ids = this.users.sort(function (a, b) {
        a = a.property('number');
        b = b.property('number');
        return a > b ? 1 : (a < b ? -1 : 0);
      }).map(function (user) {
        return '' + user.id;
      });

      (async () => {
        const ids = await UserFindMockup.sort({
          field: 'number'
        }, this.userIds);
        t.same(sorted_ids, ids, 'Sorting went wrong.');
        t.done();
      })();
    },

    "provided by number DESC": function (t) {
      t.expect(1);

      var sorted_ids = this.users.sort(function (a, b) {
        var id_sort = a.id < b.id ? 1 : -1;
        a = a.property('number');
        b = b.property('number');
        return a < b ? 1 : (a > b ? -1 : id_sort);
      }).map(function (user) {
        return '' + user.id;
      });

      (async () => {
        const ids = await UserFindMockup.sort({
          field: 'number',
          direction: 'DESC'
        }, this.userIds);
        t.same(sorted_ids, ids, 'Sorting went wrong.');
        t.done();
      })();
    },

    "provided by number LIMIT 3, 3": function (t) {
      t.expect(1);

      var sorted_ids = this.users.sort(function (a, b) {
        a = a.property('number');
        b = b.property('number');
        return a > b ? 1 : (a < b ? -1 : 0);
      }).slice(3, 6)
        .map(function (user) {
          return '' + user.id;
        });

      (async () => {
        const ids = await UserFindMockup.sort({
          field: 'number',
          limit: [3, 3]
        }, this.userIds);
        t.same(sorted_ids, ids, 'Sorting went wrong.');
        t.done();
      })();
    },

    "provided empty list": async (t) => {
      t.expect(1);

      (async () => {
        const ids = await UserFindMockup.sort({
          field: 'number',
          limit: [0, 10]
        }, []);
        t.same(0, ids.length, 'Sorting went wrong when ids.length is 0.');
        t.done();
      })();
    }
  },

  "load hash with extra properties": async (t) => {
    var user = new UserFindMockup(),
      findUser = new UserFindMockup();
    t.expect(6);

    user.property({
      name: 'hurgelwurz',
      email: 'hurgelwurz@hurgel.de',
      json: {
        test: 1
      }
    });

    await user.save();
    redis.hset(
      nohm.prefix.hash + findUser.modelName + ':' + user.id, 'not_a_real_property', 'something... :-)',
      async (err) => {
        t.ok(!err, 'Unexpected redis error in custom query');
        console.log('There should be an error in the next line');
        await findUser.load(user.id);
        t.equals(user.property('name'), findUser.property('name'), 'The loaded version of the name was not the same as a set one.');
        t.equals(user.property('email'), findUser.property('email'), 'The loaded version of the email was not the same as a set one.');
        t.equals(findUser.property('json').test, 1, 'The loaded version of the json was not the same as the set one.');
        t.equals(user.id, findUser.id, 'The loaded version of the email was not the same as a set one.');
        t.equals(user.property('bool'), false, 'The loaded version of the boolean was not the same as a set one.');
        t.done();
      });
  },

  "descending order through higher min than max": async (t) => {
    t.expect(1);

    const ids = await UserFindMockup.find({
      number: {
        min: 3,
        max: '-inf'
      }
    });
    t.same([1, 7, 6, 5, 4], ids, 'Searching when min>max condition(ZREVRANGEBYSCORE) is invalid.');
    t.done();
  },

  "descending order through higher min than max with limit 2": async (t) => { // should produce lexical ordering for the second which should be 7 (due)
    t.expect(1);

    const ids = await UserFindMockup.find({
      number: {
        min: 3,
        max: '-inf',
        limit: 2
      }
    });
    t.same([1, 7], ids, 'Searching when min>max condition(ZREVRANGEBYSCORE) with limit is invalid.');
    t.done();
  },

  "endpoints exclude left": async (t) => {
    t.expect(1);

    const ids = await UserFindMockup.find({
      number: {
        min: 3,
        max: 1,
        endpoints: '(]'
      }
    });
    t.same([7, 6, 5, 4], ids, 'Defining an endpoint failed.');
    t.done();
  },

  "endpoints exclude right": async (t) => {
    t.expect(1);

    const ids = await UserFindMockup.find({
      number: {
        min: 3,
        max: 1,
        endpoints: '[)'
      }
    });
    t.same([1], ids, 'Defining an endpoint failed.');
    t.done();
  },

  "endpoints exclude both": async (t) => {
    t.expect(1);

    const ids = await UserFindMockup.find({
      number: {
        min: 3,
        max: 1,
        endpoints: '()'
      }
    });
    t.same([], ids, 'Defining an endpoint failed.');
    t.done();
  },

  "endpoints only specify one": async (t) => {
    t.expect(2);

    const ids = await UserFindMockup.find({
      number: {
        min: 3,
        max: 1,
        endpoints: '('
      }
    });
    t.same([7, 6, 5, 4], ids, 'Defining an endpoint failed.');
    const ids2 = await UserFindMockup.find({
      number: {
        min: 3,
        max: 1,
        endpoints: ')'
      }
    });
    t.same([1], ids2, 'Defining an endpoint failed.');
    t.done();
  },

  "find numeric options parsing and defaulting": async (t) => {
    t.expect(1);

    try {
      console.log('There should be a redis deprecation warning in the next line.');
      const ids = await UserFindMockup.find({
        number: {
          min: "1",
          max: "not a number",
          offset: [1],
          limit: function () { return "Nope, not a number either." },
          endpoints: '('
        }
      });
    } catch (err) {
      t.same(err.message, 'ERR min or max is not a float', 'Invalid or parseAble find options didn\'t throw an error.');
      t.done();
    }
  },

  "find numeric with offset and limit": async (t) => {
    t.expect(1);

    const ids = await UserFindMockup.find({
      number: {
        min: 1,
        limit: 3,
        offset: 2
      }
    });
    t.same(ids, [6, 7, 1], 'The found ids were incorrect.');
    t.done();
  },

  "find numeric with offset and limit were the offset reduces the set below the limit": async (t) => {
    var findUser = new UserFindMockup();
    t.expect(1);

    const ids = await findUser.find({
      number: {
        min: 1,
        limit: 3,
        offset: 6
      }
    });
    t.same(ids, [3, 8], 'The found ids were incorrect.');
    t.done();
  },

  "find numeric with offset without limit": async (t) => {
    var findUser = new UserFindMockup();
    t.expect(1);

    const ids = await findUser.find({
      number: {
        min: 1,
        offset: 5
      }
    });
    t.same(ids, [2, 3, 8], 'The found ids were incorrect.');
    t.done();
  }


};
