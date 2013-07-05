var async = require('async');
var nohm = require(__dirname + '/../lib/nohm').Nohm;
var h = require(__dirname + '/helper.js');
var args = require(__dirname + '/testArgs.js');
var redis = args.redis;
var crypto = require('crypto');
var traverse = require('traverse');

var prefix = args.prefix;

nohm.model('UserMetaMockup', {
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
      unique: true,
      validations: [
        'email',
        function (vals, old, cb) {
          cb(vals !== 'thisisnoemail');
        }
      ]
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
    bool: {
      type: 'bool',
      defaultValue: false
    }
  },
  idGenerator: 'increment'
});

nohm.model('CommentMetaMockup', {
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
  idGenerator: function (cb) {
    return cb(+new Date());
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
    modelName = 'UserMetaMockup';
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

var users_created = false;

var stringify_functions = function (obj) {
  return traverse(obj).map(function (x) { 
    if (typeof x === 'function') {
      return String(x) 
    } else {
      return x;
    }
  });
}

exports.meta = {
  
  setUp: function(next) {
    if (!nohm.client) {
      nohm.setClient(redis);
    }
    var t = this;
    
    if ( ! users_created) {
      createUsers([{
        name: 'metatestsone',
        email: 'metatestsone@hurgel.de',
        gender: 'male',
        number: 3
      }, {
        name: 'metateststwo',
        email: 'numericindextest2@hurgel.de',
        gender: 'male',
        number: 4
      }], function(users, ids) {
        var comment = nohm.factory('CommentMetaMockup');
        users_created = true;
        users[0].link(comment);
        users[0].save(function () {
          t.users = users;
          t.userIds = ids;
          next();
        });
      });
    } else {
      next();
    }
  },

  version: function(t) {
    var user = nohm.factory('UserMetaMockup');
    t.expect(1);
    
    var hash = crypto.createHash('sha1');
    
    hash.update(JSON.stringify(user.meta.properties));
    hash.update(JSON.stringify(user.modelName));
    hash.update(user.idGenerator.toString());
    
    redis.get(prefix+':meta:version:UserMetaMockup', function (err, version) {
      errLogger(err);
      t.same(hash.digest('hex'), version, 'Version of the metadata did not match.');
      t.done();
    });
  },

  "version in instance": function(t) {
    var user = nohm.factory('UserMetaMockup');
    t.expect(1);
    
    redis.hget(prefix+':hash:UserMetaMockup:1', '__meta_version', function (err, version) {
      errLogger(err);
      t.same(user.meta.version, version, 'Version of the instance did not match metaData.');
      t.done();
    });
  },

  "meta callback and setting meta.inDb": function(t) {
    t.expect(4);
    var test, testInstance;
    
    
    test = nohm.model('TestVersionMetaMockup', {
      properties: {
        name: {
          type: 'string',
          defaultValue: 'testPropertyy',
        }
      },
      metaCallback: function (err, version) {
        t.same(err, null, "Meta version callback had an error.");
        t.same(test.prototype.meta.inDb, true, "Meta version inDb was not false.");
        t.ok(version, "No version in meta.inDb callback");
        t.done();
      }
    });
    
    testInstance = new test();
    t.same(test.prototype.meta.inDb, false, "Meta version inDb was not false.");
  },

  "meta set inDb when version is correct": function(t) {
    t.expect(4);
    var test, testInstance;
    
    
    test = nohm.model('TestVersionMetaMockup', {
      properties: {
        name: {
          type: 'string',
          defaultValue: 'testPropertyy',
        }
      },
      metaCallback: function (err, version) {
        t.same(err, null, "Meta version callback had an error.");
        t.same(test.prototype.meta.inDb, true, "Meta version inDb was not false.");
        t.ok(version, "No version in meta.inDb callback");
        t.done();
      }
    });
    
    testInstance = new test();
    t.same(test.prototype.meta.inDb, false, "Meta version inDb was not false.");
  },

  idGenerator: function(t) {
    var user = nohm.factory('UserMetaMockup');
    var comment = nohm.factory('CommentMetaMockup');
    t.expect(2);
    
    async.parallel([
      function (next) {
        redis.get(prefix+':meta:idGenerator:UserMetaMockup', function (err, generator) {
          errLogger(err);
          t.same(user.idGenerator.toString(), generator, 'idGenerator of the user did not match.');
          next();
        });
      },
      function (next) {
        redis.get(prefix+':meta:idGenerator:CommentMetaMockup', function (err, generator)  {
          errLogger(err);
          t.same(comment.idGenerator.toString(), generator, 'idGenerator of the comment did not match.');
          next();
        });
      }
    ], t.done);
  },

  properties: function(t) {
    var user = nohm.factory('UserMetaMockup');
    var comment = nohm.factory('CommentMetaMockup');
    t.expect(2);
    
    async.parallel([
      function (next) {
        redis.get(prefix+':meta:properties:UserMetaMockup', function (err, properties) {
          errLogger(err);
          t.same(JSON.stringify(stringify_functions(user.meta.properties)), properties, 'Properties of the user did not match.');
          next();
        });
      },
      function (next) {
        redis.get(prefix+':meta:properties:CommentMetaMockup', function (err, properties)  {
          errLogger(err);
          t.same(JSON.stringify(stringify_functions(comment.meta.properties)), properties, 'Properties of the comment did not match.');
          next();
        });
      }
    ], t.done);
  }
};
