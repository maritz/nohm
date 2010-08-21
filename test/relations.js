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
  }
});


exports.link = function (t) {
  var user = new UserLinkMockup(),
  role = new RoleLinkMockup(),
  linkCallbackCalled = false;
  t.expect(10);
  
  user.link(role, function (action, on, name, obj) {
    linkCallbackCalled = true;
    t.ok(action === 'link', 'The argument "action" given to the link callback are not correct');
    t.ok(on === 'UserLinkMockup', 'The argument "on" given to the link callback are not correct');
    t.ok(name === 'child', 'The argument "name" given to the link callback are not correct');
    t.ok(obj === role, 'The argument "obj" given to the link callback are not correct');
  });
  
  user.save(function (err) {
    if (!err) {
      t.ok(linkCallbackCalled, 'The provided callback for linking was not called.');
      redis.keys('*:relations:*', function (err, values) {
        var args = [],
        key,
        firstDone = false,
        keyCheck = function (err, members) {
          t.ok(members.length === 1, 'The set of a relationship does not have exactly one relationship entry');
          t.ok(members[0].toString() === '1', 'The set of a relationship contained a wrong member');
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
    t.ok(action === 'unlink', 'The argument "action" given to the unlink callback are not correct');
    t.ok(on === 'UserLinkMockup', 'The argument "on" given to the unlink callback are not correct');
    t.ok(name === 'child', 'The argument "name" given to the unlink callback are not correct');
    t.ok(obj === role, 'The argument "obj" given to the unlink callback are not correct');
  });
  
  user.save(function (err) {
    if (!err) {
      t.ok(unlinkCallbackCalled, 'The provided callback for unlinking was not called.');
      redis.keys('*:relations:*', function (err, values) {
        if (!err) {
          t.ok(values === null, 'Unlinking an object did not delete keys.');
        }
        t.done();
      });
    } else {
      console.dir(err);
      t.done();
    }
  });
};