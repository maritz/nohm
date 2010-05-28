var nohm = require('nohm');

var User = nohm.Model.extend({
  properties: {
    name: {
      type: 'string',
      value: 'test'
    },
    visits: {
      type: 'counter',
      stepsize: 2,
      cap: 20
    },
    email: {
      type: 'string',
      validations: [
        'email'
      ]
    }
  }
});

exports.User = User;