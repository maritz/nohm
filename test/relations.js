"use strict";
var sys = require('sys');


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
      }
    };
    nohm.Model.call(this);
  }
});

var CommentMockup = nohm.Model.extend({
  constructor: function () {
    this.modelName = 'CommentMockup';
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

var RoleMockup = nohm.Model.extend({
  constructor: function () {
    this.modelName = 'RoleMockup';
    this.properties = {
      name: {
        type: 'string',
        value: 'user'
      }
    };
  }
});


exports.linkWithoutSaving = function (t) {
  var user = new UserMockup(),
  role = new RoleMockup();
  t.expect(0);
  
  user.save(function (err) {
    if (!err) {
      user.link(role);
      user.unlink(role);
      t.done();
    }
  });
};