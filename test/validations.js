var sys = require('sys');
var nohm = require('nohm');

// !!! note that this mockup must be defined valid from the start for most tests !!!
var userMockup = nohm.Model.extend({
  properties: {
    name: {
      type: 'string',
      value: 'test',
      validations: [
        'notempty'
      ]
    },
    visits: {
      type: 'counter',
      stepsize: 2,
      cap: 20
    },
    email: {
      type: 'string',
      value: 'blub@bla.de',
      validations: [
      'email'
      ]
    }
  }
});

exports.notempty = function (t) {
  var user = new userMockup();
  t.expect(5);

  user.p('name', '');
  t.ok(!user.valid('name'), 'Notempty field `name` was accepted as an empty string.');

  user.p('name', null); // TODO: this is obsolete once typecasting to string is implemented, since null is cast to ''
  t.ok(!user.valid('name'), 'Notempty field `name` was accepted with value null.');

  user.p('name', false); // TODO: this is obsolete once typecasting to string is implemented, since false is cast to ''
  t.ok(!user.valid('name'), 'Notempty field `name` was accepted with value false.');

  user.p('name', true); // TODO: this is obsolete once typecasting to string is implemented, since true is cast to ''
  t.ok(!user.valid('name'), 'Notempty field `name` was accepted with value true.');

  user.p('name', 'test');
  t.ok(user.valid('name'), 'Notempty field `name` was valid but not accepted.');

  t.done();
}

exports.email = function (t) {
  // oh gawd...
  var user = new userMockup();
  t.expect(1);

  user.p('email', 'asdasd@asd.de');
  t.ok(user.valid('email'), 'Valid email was not recognized');

  t.done()
}

exports.consistency = function (t) {
  var user = new userMockup();
  t.expect(3);

  t.ok(user.valid('name'), 'Property `name` was not recognized as valid. Is it valid? Should be!');

  t.ok(user.valid('name') === user.valid('email'), 'Validating two valid properties resulted in different outputs.');

  t.ok(user.valid('name') === user.valid('email'), 'Validating the entire Model had a different result than validating a single property.');

  t.done();
}