var nohm = require('../lib/nohm');

var UserMockup = exports.user = nohm.Model.extend({
  constructor: function () {
    this.modelName = 'UserMockup';
    this.properties = {
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
    };
    nohm.Model.call(this);
  }
});