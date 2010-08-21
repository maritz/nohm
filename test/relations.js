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
var UserLinkMockup = nohm.Model.extend({
  constructor: function () {
    this.modelName = 'UserLinkMockup';
    this.properties = {
      name: {
        type: 'string',
        value: 'test',
        unique: true,
        validations: [
          'notEmpty'
        ]
      }
    };
    nohm.Model.call(this);
  }
});

var CommentLinkMockup = nohm.Model.extend({
  constructor: function () {
    this.modelName = 'CommentLinkMockup';
    this.properties = {
      text: {
        type: 'string',
        value: 'this is a comment! REALLY!',
        validations: [
          'notEmpty'
        ]
      }
    };
    nohm.Model.call(this);
  }
});

var RoleLinkMockup = nohm.Model.extend({
  constructor: function () {
    this.modelName = 'RoleLinkMockup';
    this.properties = {
      name: {
        type: 'string',
        value: 'user'
      }
    };
    nohm.Model.call(this);
  }
});

exports.instances = function (t) {
  var user = new UserLinkMockup(),
  role = new RoleLinkMockup(),
  role2;

  t.expect(2);

  role.link(user);

  t.ok(role.relationChanges !== user.relationChanges, 'Instances share the relationchanges, initiate them as an empty array in the constructor.');

  role2 = new RoleLinkMockup();
  t.same(role2.relationChanges, [], 'Creating a new instance does not reset the relationchanges of that instance.');

  t.done();
};


exports.link = function (t) {
  var user = new UserLinkMockup(),
  role = new RoleLinkMockup(),
  linkCallbackCalled = false;
  t.expect(10);

  user.link(role, function (action, on, name, obj) {
    linkCallbackCalled = true;
    t.equals(action, 'link', 'The argument "action" given to the link callback are not correct');
    t.equals(on, 'UserLinkMockup', 'The argument "on" given to the link callback are not correct');
    t.equals(name, 'child', 'The argument "name" given to the link callback are not correct');
    t.same(obj, role, 'The argument "obj" given to the link callback are not correct');
  });

  user.save(function (err) {
    if (!err) {
      t.ok(linkCallbackCalled, 'The provided callback for linking was not called.');
      redis.keys(prefix + '*:relations:*', function (err, values) {
        var args = [],
        key,
        firstDone = false,
        keyCheck = function (err, members) {
          t.equals(members.length, 1, 'The set of a relationship does not have exactly one relationship entry');
          t.equals(members[0], '1', 'The set of a relationship contained a wrong member');
          if (firstDone === true) {
            t.done();
          } else {
            firstDone = true;
          }
        };
        if (!err) {
          t.ok(values.length === 2, 'Linking an object did not create the correct number of keys.');
          redis.smembers(values[0].toString(), keyCheck);
          redis.smembers(values[1].toString(), keyCheck);
        } else {
          t.done();
        }
      });
    } else {
      t.done();
    }
  });
};

exports.unlink = function (t) {
  var user = new UserLinkMockup(),
  role = new RoleLinkMockup(),
  unlinkCallbackCalled = false;
  t.expect(6);

  user.id = 1;
  role.id = 1;

  user.unlink(role, function (action, on, name, obj) {
    unlinkCallbackCalled = true;
    t.equals(action, 'unlink', 'The argument "action" given to the unlink callback are not correct');
    t.equals(on, 'UserLinkMockup', 'The argument "on" given to the unlink callback are not correct');
    t.equals(name, 'child', 'The argument "name" given to the unlink callback are not correct');
    t.equals(obj, role, 'The argument "obj" given to the unlink callback are not correct');
  });

  user.save(function (err) {
    if (!err) {
      t.ok(unlinkCallbackCalled, 'The provided callback for unlinking was not called.');
      redis.keys('*:relations:*', function (err, values) {
        if (!err) {
          t.equals(values, null, 'Unlinking an object did not delete keys.');
        }
        t.done();
      });
    } else {
      console.dir(err);
      t.done();
    }
  });
};

exports.deeplink = function (t) {
  var user = new UserLinkMockup(),
  role = new RoleLinkMockup(),
  comment = new CommentLinkMockup(),
  userLinkCallbackCalled = false,
  commentLinkCallbackCalled = false;
  t.expect(3);

  role.link(user, function (action, on, name, obj) {
    userLinkCallbackCalled = true;
  });
  user.link(comment, function (action, on, name, obj) {
    commentLinkCallbackCalled = true;
  });

  role.save(function (err) {
    if (!err) {
      t.ok(userLinkCallbackCalled, 'The user link callback was not called.');
      t.ok(commentLinkCallbackCalled, 'The comment link callback was not called.');
      t.ok(comment.id !== null, 'The deeplinked comment does not have an id and thus is probably not saved correctly.');
    } else {
      console.dir(err);
    }
    t.done();
  });
};
