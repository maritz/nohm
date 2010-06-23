var sys = require('sys');
var nohm = require('nohm');

// !!! this mockup must be defined valid from the start for most tests !!!
var UserMockup = nohm.Model.extend({
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
        value: '1,000.5623',
        validations: [
        'number'
        ]
      },
      numberUS: {
        type: 'string',
        value: '2,000.5623',
        validations: [
        'numberUS'
        ]
      },
      numberEU: {
        type: 'string',
        value: '3.000,5623',
        validations: [
        'numberEU'
        ]
      },
      numberSI: {
        type: 'string',
        value: '4 000,5623',
        validations: [
        'numberSI'
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
  var user = new UserMockup();
  t.expect(1);

  t.ok(user.valid(), 'The Model was not recognized as valid. Is it? Should be!');

  t.done();
}

exports.castString = function (t) {
  var user = new UserMockup();
  t.expect(7);

  // is this overkill? i believe so... but a little copy and paste doesn't take that much time ;D
  user.p('name', null);
  t.ok(user.p('name') === '', 'Setting a String to null did not cast it to an empty string.');

  user.p('name', false);
  t.ok(user.p('name') === '', 'Setting a String to false did not cast it to an empty string.');

  user.p('name', true);
  t.ok(user.p('name') === '', 'Setting a String to true did not cast it to an empty string.');

  user.p('name', 0);
  t.ok(user.p('name') === '', 'Setting a String to 0 did not cast it to an empty string.');

  user.p('name', {});
  t.ok(user.p('name') === '', 'Setting a String to {} did not cast it to an empty string.');

  user.p('name', []);
  t.ok(user.p('name') === '', 'Setting a String to [] did not cast it to an empty string.');

  user.p('name', new String(''));
  t.ok(user.p('name') === '', 'Setting a String to new String() did not cast it to an empty string.');

  t.done();
}

exports.setterValidation = function (t) {
  var user = new UserMockup();
  t.expect(4);

  t.ok(user.p('name', 'hurz', true), 'Setting a property to a correct value with validation did not return true.');

  t.ok(user.p('name') === 'hurz', 'Setting a property to a correct value with validation did not set the value.')

  t.ok(!user.p('name', '', true), 'Setting a property to a wrong value with validation did not return false.');

  t.ok(user.p('name') === 'hurz', 'Setting a property to a wrong value with validation did set the value.');

  t.done();
}

exports.notEmpty = function (t) {
  var user = new UserMockup();
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

exports.stringLength = function (t) {
  var user = new UserMockup();
  t.expect(5);

  t.ok(user.valid('minLength'), 'Valid minLength was not accepted.');

  
  t.ok(!user.p('minLength', 'as', true), 'String shorter than minLength was accepted.');

  
  t.ok(!user.p('minLength2', 'as', true), 'String shorter than minLength was accepted. (optional but 2 chars)');

  t.ok(user.valid('maxLength'), 'Valid maxLength was not accepted');

  t.ok(!user.p('maxLength', 'asdasd', true), 'Invalid maxLength was accepted.');

  t.done();
}

exports.intSize = function (t) {
  var user = new UserMockup();
  t.expect(3);

  t.ok(!user.p('minMax', 1, true), 'Integer lower than min was accepted.');

  t.ok(!user.p('minMax', 21, true), 'Integer higher than min was accepted.');

  t.ok(user.p('minOptional', 0, true), 'Integer as 0 and optional was not accepted.');

  t.done();
}

exports.email = function (t) {
  // oh gawd...
  var user = new UserMockup();
  t.expect(4);

  t.ok(user.valid('email'), 'Valid email was not recognized.');

  user.p('email', 'asdasd@asd');
  t.ok(!user.valid('email'), 'Invalid email was recognized.');

  user.p('email', 'as"da"s.d@asd.asd.asd.de');
  t.ok(!user.valid('email'), 'Invalid email was recognized.');

  t.ok(user.valid('optionalEmail'), 'Optional email was not recognized.');

  t.done()
}

exports.number = function (t) {
  var user = new UserMockup();
  t.expect(11);

  t.ok(user.p('number', '0', true), 'Valid number was not accepted. (look at stacktrace for line :P )');

  t.ok(user.p('number', '1', true), 'Valid number was not accepted. (look at stacktrace for line :P )');

  t.ok(user.p('number', '-1', true), 'Valid number was not accepted. (look at stacktrace for line :P )');

  t.ok(user.p('number', '10', true), 'Valid number was not accepted. (look at stacktrace for line :P )');

  t.ok(user.p('number', '1000', true), 'Valid number was not accepted. (look at stacktrace for line :P )');

  t.ok(user.p('number', '1,1', true), 'Valid number was not accepted. (look at stacktrace for line :P )');

  t.ok(user.p('number', '1.1', true), 'Valid number was not accepted. (look at stacktrace for line :P )');

  t.ok(user.p('number', '1.000,1', true), 'Valid number was not accepted. (look at stacktrace for line :P )');

  t.ok(user.p('number', '1,000.1', true), 'Valid number was not accepted. (look at stacktrace for line :P )');

  t.ok(user.p('number', '1 000.1', true), 'Valid number was not accepted. (look at stacktrace for line :P )');

  t.ok(user.p('number', '1 000,1', true), 'Valid number was not accepted. (look at stacktrace for line :P )');

  // TODO: write tests for US, EU, SI specifically

  t.done();
}

exports.consistency = function (t) {
  var user = new UserMockup();
  t.expect(2);

  t.ok(user.valid('name') === user.valid('email'), 'Validating two valid properties resulted in different outputs.');

  t.ok(user.valid('name') === user.valid(), 'Validating the entire Model had a different result than validating a single property.');

  t.done();
}