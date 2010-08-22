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

exports.findByUnique = function (t) {
  var user = new UserFindMockup(),
  findUser = new UserFindMockup();
  t.expect(0);
  
  t.done();
};