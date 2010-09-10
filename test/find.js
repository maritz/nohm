"use strict";
var sys = require('sys');

var prefix = 'nohm';

process.argv.forEach(function (val, index) {
  if (val === '--nohm-prefix') {
    prefix = process.argv[index + 1];
  }
});
var relationsprefix = prefix + ':relations:';

var redis = require('redis-client').createClient();
var nohm = require('nohm');
var UserFindMockup = nohm.Model.extend({
  constructor: function () {
    this.modelName = 'UserFindMockup';
    this.properties = {
      name: {
        type: 'string',
        value: 'testName',
        index: true,
        validations: [
          'notEmpty'
        ]
      },
      email: {
        type: 'string',
        value: 'testMail@test.de',
        unique: true
      },
      json: {
        type: 'json',
        value: {
          test: true
        }
      },
      number: {
        type: 'integer',
        value: 1,
        index: true
      },
      number2: {
        type: 'integer',
        value: 200,
        index: true
      },
      bool: {
        type: 'bool',
        value: false
      }
    };
    nohm.Model.call(this);
  }
});

var RoleFindMockup = nohm.Model.extend({
  constructor: function () {
    this.modelName = 'RoleFindMockup';
    this.properties = {
      name: {
        type: 'string',
        value: 'user'
      }
    };
    nohm.Model.call(this);
  }
});

exports.load = function (t) {
  var user = new UserFindMockup(),
  findUser = new UserFindMockup();
  t.expect(5);

  user.p({
    name: 'hurgelwurz',
    email: 'hurgelwurz@hurgel.de',
    json: {
      test: function () {
        t.ok(true, 'Yup'); // this fails by t.expect(x), if it fails at all the message won't show.
      }
    }
  });

  user.save(function (err) {
    if (err) {
      console.dir(err);
      t.done();
    }
    findUser.load(user.id, function (err) {
      if (err) {
        console.dir(err);
        t.done();
      }
      t.equals(user.p('name'), findUser.p('name'), 'The loaded version of the name was not the same as a set one.');
      t.equals(user.p('email'), findUser.p('email'), 'The loaded version of the email was not the same as a set one.');
      user.p('json').test();
      t.equals(user.id, findUser.id, 'The loaded version of the email was not the same as a set one.');
      t.equals(user.p('bool'), false, 'The loaded version of the boolean was not the same as a set one.');
      t.done();
    });
  });
};

exports.findByUnique = function (t) {
  var user = new UserFindMockup(),
  findUser = new UserFindMockup();
  t.expect(1);

  user.p({
    name: 'uniquefind',
    email: 'uniquefind@hurgel.de'
  });

  user.save(function (err) {
    if (err) {
      console.dir(err);
      t.done();
    }
    findUser.find({
      email: user.p('email')
    }, function (err, ids) {
      if (err) {
        console.dir(err);
      }
      t.same(ids, [user.id], 'The found id did not match the id of the saved object.');
      t.done();
    });
  });
};

exports.findByStringIndex = function (t) {
  var user = new UserFindMockup(),
  user2 = new UserFindMockup(),
  findUser = new UserFindMockup();
  t.expect(1);

  user.p({
    name: 'indextest',
    email: 'indextest@hurgel.de'
  });

  user2.p({
    name: 'indextest',
    email: 'indextest2@hurgel.de'
  });

  user.save(function (err) {
    if (err) {
      console.dir(err);
      t.done();
    }
    user2.save(function (err) {
      if (err) {
        console.dir(err);
        t.done();
      }
      findUser.find({
        name: 'indextest'
      }, function (err, ids) {
        if (err) {
          console.dir(err);
        }
        t.same(ids, [user.id, user2.id], 'The found id did not match the id of the saved object.');
        t.done();
      });
    });
  });
};

exports.findByNumericIndex = function (t) {
  var user = new UserFindMockup(),
  user2 = new UserFindMockup(),
  user3 = new UserFindMockup(),
  findUser = new UserFindMockup();
  t.expect(1);

  user.p({
    name: 'numericindextest',
    email: 'numericindextest@hurgel.de',
    number: 3
  });

  user2.p({
    name: 'numericindextest',
    email: 'numericindextest2@hurgel.de',
    number: 4,
    number2: 33
  });

  user3.p({
    name: 'numericindextest',
    email: 'numericindextest3@hurgel.de',
    number: 4,
    number2: 1
  });

  user.save(function (err) {
    if (err) {
      console.dir(err);
      t.done();
    }
    user2.save(function (err) {
      if (err) {
        console.dir(err);
        t.done();
      }
      user3.save(function (err) {
        if (err) {
          console.dir(err);
          t.done();
        }
        findUser.find({
          number: {
            min: 2
          },
          number2: {
            max: 100,
            limit: 2
          }
        }, function (err, ids) {
          if (err) {
            console.dir(err);
          }
          t.same(ids, [user2.id, user3.id], 'The found id did not match the id of the saved object.');
          t.done();
        });
      });
    });
  });
};

exports.findByMixedIndex = function (t) {
  var user = new UserFindMockup(),
  user2 = new UserFindMockup(),
  user3 = new UserFindMockup(),
  findUser = new UserFindMockup();
  t.expect(1);

  user.p({
    name: 'mixedindextest',
    email: 'mixedindextest@hurgel.de',
    number: 3
  });

  user2.p({
    name: 'mixedindextest',
    email: 'mixedindextest2@hurgel.de',
    number: 4,
    number2: 33
  });

  user3.p({
    name: 'mixedindextestNOT',
    email: 'mixedindextest3@hurgel.de',
    number: 4,
    number2: 1
  });

  user.save(function (err) {
    if (err) {
      console.dir(err);
      t.done();
    }
    user2.save(function (err) {
      if (err) {
        console.dir(err);
        t.done();
      }
      user3.save(function (err) {
        if (err) {
          console.dir(err);
          t.done();
        }
        findUser.find({
          number: {
            min: 2
          },
          number2: {
            max: 100
          },
          name: 'mixedindextest'
        }, function (err, ids) {
          if (err) {
            console.dir(err);
          }
          t.same(ids, [user2.id], 'The found id did not match the id of the saved object.');
          t.done();
        });
      });
    });
  });
};
