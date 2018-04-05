var nohm = require(__dirname+'/../lib/nohm').Nohm;
var args = require(__dirname+'/testArgs.js');
var redis = args.redis;
var helperLib = require(__dirname+'/../lib/helpers.js');
var h = require(__dirname+'/helper.js');

var UserLinkMockup = nohm.model('UserLinkMockup', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'testName',
      validations: [
        'notEmpty'
      ]
    }
  },
  idGenerator: 'increment'
});
var RoleLinkMockup = nohm.model('RoleLinkMockup', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'user'
    }
  },
  idGenerator: 'increment'
});


exports.helpers = {
  
  setUp: function (next) {
    if ( ! nohm.client) {
      nohm.setClient(redis);
    }
    next();
  },
  tearDown: function (next) {
    h.cleanUp(redis, args.prefix, next);
  },

  checkEqual: function(t) {
    let role = new RoleLinkMockup();
    let role2 = new RoleLinkMockup();
    t.expect(1);

    let equality = helperLib.checkEqual(role, role2);

    t.same(equality, true, 'checkEqual Helper should evaluate two different instances with the same values as equal.');
    t.done();
  }


};