var nohm = require('../lib/nohm').Nohm;

var UserMockup = exports.user = nohm.model('UserMockup', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'test',
      validations: [
        'notEmpty'
      ]
    },
    key: {
      type: 'integer',
      index: true
    }
  }
});
