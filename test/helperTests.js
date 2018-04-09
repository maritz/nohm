var nohm = require(__dirname+'/../lib/nohm').Nohm;
var args = require(__dirname+'/testArgs.js');
var redis = args.redis;
var helperLib = require(__dirname+'/../lib/helpers.js');
var h = require(__dirname+'/helper.js');

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
    var role = new RoleLinkMockup();
    var role2 = new RoleLinkMockup();
    t.expect(1);

    var equality = helperLib.checkEqual(role, role2);

    t.same(equality, true, 'checkEqual Helper should evaluate two different instances with the same values as equal.');
    t.done();
  }

};
