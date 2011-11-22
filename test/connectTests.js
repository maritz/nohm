var util = require('util'),
  nohm = require(__dirname+'/../lib/nohm').Nohm,
  redis = nohm.client,
  UserConnectMockup = nohm.model('UserConnectMockup', {
    properties: {
      name: {
        type: 'string',
        defaultValue: 'testName',
        validations: [
          'notEmpty'
        ]
      }
    }
  });

exports.instances = function (t) {
  var user = new UserConnectMockup();

  t.done();
};
