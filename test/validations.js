var sys = require('sys');
var nohm = require('nohm');

// !!! this mockup must be defined valid from the start for most tests !!!
var userMockup = nohm.Model.extend({
  constructor: function () {
    this.properties = {
      name: {
        type: 'string',
        value: 'test',
        validations: [
        'notEmpty'
        ]
      },
      minMax: {
        type: 'integer',
        value: 5,
        validations: [
        ['min', 2],
        ['max', 20]
        ]
      },
      minOptional: {
        type: 'integer',
        value: 0,
        validations: [
        ['min', 10, 'optional'],
        ]
      },
      email: {
        type: 'string',
        value: 'blub@bla.de',
        validations: [
        'email'
        ]
      },
      optionalEmail: {
        type: 'string',
        value: '',
        validations: [
        ['email', true]
        ]
      },
      minLength: {
        type: 'string',
        value: 'asd',
        validations: [
        ['minLength', 3]
        ]
      },
      minLength2: {
        type: 'string',
        value: '',
        validations: [
        ['minLength', 3, 'optional']
        ]
      },
      maxLength: {
        type: 'string',
        value: 'asd',
        validations: [
        ['maxLength', 5]
        ]
      },
      number: {
        type: 'string',
        value: '1,000.56234234',
        validations: [
        'number'
        ]
      },
      germanNumber: {
        type: 'string',
        value: '1.000,56234234',
        validations: [
        'numberGerman'
        ]
      },
      universalNumber: {
        type: 'string',
        value: '1.000,56234234',
        validations: [
        'numberGerman'
        ]
      },
      url: {
        type: 'string',
        value: 'http://test.de',
        validations: [
        'url'
        ]
      }
    };
    nohm.Model.call(this);
  }
});

exports.general = function (t) {
  var user = new userMockup();
  t.expect(1);

  t.ok(user.valid(), 'The Model was not recognized as valid. Is it? Should be!');

  t.done();
}

exports.setterValidation = function (t) {
  var user = new userMockup();
  t.expect(4);

  t.ok(user.p('name', 'hurz', true), 'Setting a property to a correct value with validation did not return true.');

  t.ok(user.p('name') === 'hurz', 'Setting a property to a correct value with validation did not set the value.')

  t.ok(!user.p('name', '', true), 'Setting a property to a wrong value with validation did not return false.');

  t.ok(user.p('name') === 'hurz', 'Setting a property to a wrong value with validation did set the value.');

  t.done();
}

exports.notempty = function (t) {
  var user = new userMockup();
  t.expect(5);

  t.ok(user.valid('name'), 'Notempty field `name` was valid but not accepted.');

  user.p('name', '');
  t.ok(!user.valid('name'), 'Notempty field `name` was accepted as an empty string.');

  user.p('name', null); // TODO: this is obsolete once typecasting to string is implemented, since null is cast to ''
  t.ok(!user.valid('name'), 'Notempty field `name` was accepted with value null.');

  user.p('name', false); // TODO: this is obsolete once typecasting to string is implemented, since false is cast to ''
  t.ok(!user.valid('name'), 'Notempty field `name` was accepted with value false.');

  user.p('name', true); // TODO: this is obsolete once typecasting to string is implemented, since true is cast to ''
  t.ok(!user.valid('name'), 'Notempty field `name` was accepted with value true.');

  t.done();
}

exports.stringlength = function (t) {
  var user = new userMockup();
  t.expect(5);

  t.ok(user.valid('minLength'), 'Valid minLength was not accepted.');

  
  t.ok(!user.p('minLength', 'as', true), 'String shorter than minLength was accepted.');

  
  t.ok(!user.p('minLength2', 'as', true), 'String shorter than minLength was accepted. (optional but 2 chars)');

  t.ok(user.valid('maxLength'), 'Valid maxLength was not accepted');

  t.ok(!user.p('maxLength', 'asdasd', true), 'Invalid maxLength was accepted.');

  t.done();
}

exports.email = function (t) {
  // oh gawd...
  var user = new userMockup();
  t.expect(4);

  t.ok(user.valid('email'), 'Valid email was not recognized.');

  user.p('email', 'asdasd@asd');
  t.ok(!user.valid('email'), 'Invalid email was recognized.');

  user.p('email', 'as"da"s.d@asd.asd.asd.de');
  t.ok(!user.valid('email'), 'Invalid email was recognized.');

  t.ok(user.valid('optionalEmail'), 'Optional email was not recognized.');

  t.done()
}

exports.consistency = function (t) {
  var user = new userMockup();
  t.expect(2);

  t.ok(user.valid('name') === user.valid('email'), 'Validating two valid properties resulted in different outputs.');

  t.ok(user.valid('name') === user.valid(), 'Validating the entire Model had a different result than validating a single property.');

  t.done();
}