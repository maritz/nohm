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
  t.expect(2);
  
  user.p({
    name: 'hurgelwurz',
    email: 'hurgelwurz@hurgel.de'
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
      t.done();
    });
  });
};