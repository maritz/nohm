var nohm = require('../').Nohm;

exports.user = nohm.model('UserMockup', {
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
