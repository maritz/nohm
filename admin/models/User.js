var Ni = require('ni'),
nohm = require('nohm');

module.exports = nohm.Model.extend({
  constructor: function () {
    this.modelName = 'UserMockup';
    this.properties = {
      name: {
        type: 'string',
        unique: true,
        validations: [
          'notEmpty'
        ]
      },
      email: {
        type: 'string',
        unique:true,
        validations: [
          'notEmpty',
          'email'
        ]
      }
    };
    nohm.Model.call(this);
  }
});