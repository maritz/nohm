// Models
exports.user = nohm.model('UserMockup', {
  properties: {
    username: {
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

exports.item = nohm.model('ItemMockup', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'my item',
      validations: [
        'notEmpty'
      ]
    },
  }
});