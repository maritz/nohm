var nohm = require('../lib/nohm').Nohm;

var UserMockup = exports.user = nohm.model('UserMockup', {
  properties: {
    name: {
      type: 'string',
      value: 'test',
      validations: [
        'notEmpty'
      ]
    },
    email: {
      type: 'string',
      unique: true,
      value: 'email@email.de',
      validations: [
        'email'
      ]
    },
    key: {
      type: 'integer'
    }
  }
});