var util = require('util'),
    nohm = require(__dirname+'/../lib/nohm').Nohm;

// !!! this mockup must be defined valid from the start for most tests !!!
var UserMockup = nohm.model('UserMockup', {
  properties: {
    name: {
      type: 'string',
      value: 'test',
      validations: [
        'notEmpty'
      ]
    },
    castInteger: {
      type: 'integer',
      value: 2
    },
    castFloat: {
      type: 'float',
      value: 2.5
    },
    castTimestamp: {
      type: 'timestamp',
      value: 100000
    },
    behaviour: {
      type: function incrby(value, key, old) {
        return old + value;
      },
      value: 1
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
        ['min', 10, 'optional']
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
    },
    custom: {
      type: 'string',
      value: 'valid',
      validations: [
        function (value) {
          return value === 'valid';
        }
      ]
    },
    custom2: {
      type: 'string',
      value: 'valid2',
      validations: [
        function (value) {
          return value === 'valid2';
        }
      ]
    },
    customNamed: {
      type: 'string',
      value: 'validNamed',
      validations: [
        function customNamed (value) {
          return value === 'validNamed';
        }
      ]
    }
  }
});

exports.general = function (t) {
  var user = new UserMockup();
  t.expect(1);

  t.ok(user.valid(), 'The Model was not recognized as valid. Is it? Should be!');

  t.done();
};

exports.castString = function (t) {
  var user = new UserMockup();
  t.expect(6);

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

  t.done();
};

exports.castInteger = function (t) {
  var user = new UserMockup();
  t.expect(6);

  user.p('castInteger', '15');
  t.ok(user.p('castInteger') === 15, 'Setting an Integer to a string "15" did not cast it to 15.');

  user.p('castInteger', '15asd');
  t.ok(user.p('castInteger') === 15, 'Setting an Integer to a string "15asd" did not cast it to 15.');

  user.p('castInteger', '1.5');
  t.ok(user.p('castInteger') === 1, 'Setting an Integer to a string "1.5" did not cast it to 1.');

  user.p('castInteger', '0x15');
  t.ok(user.p('castInteger') === 0, 'Setting an Integer to a string "0x1.5" did not cast it to 0.');

  user.p('castInteger', '.5');
  t.ok(user.p('castInteger') === 0, 'Setting an Integer to a string ".5" did not cast it to 0.');

  user.p('castInteger', '0.1e2');
  t.ok(user.p('castInteger') === 0, 'Setting an Integer to a string "0.1e2" did not cast it to 0.');

  t.done();
};

exports.castFloat = function (t) {
  var user = new UserMockup();
  t.expect(6);

  user.p('castFloat', '1.5');
  t.ok(user.p('castFloat') === 1.5, 'Setting a Float to a string "1.5" did not cast it to 1.5.');

  user.p('castFloat', '1.5asd');
  t.ok(user.p('castFloat') === 1.5, 'Setting a Float to a string "1.5asd" did not cast it to 1.5.');

  user.p('castFloat', '01.5');
  t.ok(user.p('castFloat') === 1.5, 'Setting a Float to a string "01.5" did not cast it to 1.5.');

  user.p('castFloat', '0x1.5');
  t.ok(user.p('castFloat') === 0, 'Setting a Float to a string "0x1.5" did not cast it to 0.');

  user.p('castFloat', '.5');
  t.ok(user.p('castFloat') === 0.5, 'Setting a Float to a string ".5" did not cast it to 0.5.');

  user.p('castFloat', '0.1e2');
  t.ok(user.p('castFloat') === 10, 'Setting a Float to a string "0.1e2" did not cast it to 10.');

  t.done();
};

exports.castTimestamp = function (t) {
  var user = new UserMockup(),
  should = new Date('1988-03-12T00:00:00Z').getTime();
  t.expect(8);

  user.p('castTimestamp', should);
  t.ok(user.p('castTimestamp') === should, 'Setting a Timestamp to a number should did not cast it to ' + should);

  user.p('castTimestamp', '' + should);
  t.ok(user.p('castTimestamp') === should, 'Setting a Timestamp to a string "should" did not cast it to ' + should);

  user.p('castTimestamp', '1988-03-12T00:00:00Z');
  t.ok(user.p('castTimestamp') === should, 'Setting a Timestamp to a string "1988-03-12T00:00:00Z" did not cast it to ' + should);

  user.p('castTimestamp', '1988-03-12T04:30:00+04:30');
  t.ok(user.p('castTimestamp') === should, 'Setting a Timestamp to a string "1988-03-12T00:00:00+04:30" did not cast it to ' + should);

  user.p('castTimestamp', '1988-03-11T20:30:00-04:30');
  t.ok(user.p('castTimestamp') === should, 'Setting a Timestamp to a string "1988-03-12T00:00:00+04:30" did not cast it to ' + should);

  user.p('castTimestamp', 'Sat, 12 Mar 1988 00:00:00');
  t.ok(user.p('castTimestamp') === should, 'Setting a Timestamp to a string "Sat, 12 Mar 1988 00:00:00" did not cast it to ' + should);

  user.p('castTimestamp', '03.12.1988');
  t.ok(user.p('castTimestamp') === should, 'Setting a Timestamp to a string "03.12.1988" did not cast it to ' + should);

  user.p('castTimestamp', '03/12/1988');
  t.ok(user.p('castTimestamp') === should, 'Setting a Timestamp to a string "03/12/1988" did not cast it to ' + should);

  t.done();
};

exports.behaviours = function (t) {
  var user = new UserMockup();
  t.expect(1);
  
  user.p('behaviour', 5);
  t.equals(user.p('behaviour'), 6, 'Using the behaviour did not work correctly');
  
  t.done();
};

exports.setterValidation = function (t) {
  var user = new UserMockup();
  t.expect(6);

  t.ok(user.p('name', 'hurz', true), 'Setting a property to a correct value with validation did not return true.');

  t.ok(user.p('name') === 'hurz', 'Setting a property to a correct value with validation did not set the value.');

  t.ok(!user.p('name', '', true), 'Setting a property to a wrong value with validation did not return false.');

  t.ok(user.p('name') === 'hurz', 'Setting a property to a wrong value with validation did set the value.');
  
  t.ok(user.p({name: 'hurgel'}, true), 'Setting a property by passing an object and with validation did not return true.');
  
  t.ok(user.p('name') === 'hurgel', 'Setting a property by passing an object and with validation did set the value.');

  t.done();
};

exports.notEmpty = function (t) {
  var user = new UserMockup();
  t.expect(2);

  t.ok(user.valid('name'), 'Notempty field `name` was valid but not accepted.');

  user.p('name', '');
  t.ok(!user.valid('name'), 'Notempty field `name` was accepted as an empty string.');

  t.done();
};

exports.stringLength = function (t) {
  var user = new UserMockup();
  t.expect(5);

  t.ok(user.valid('minLength'), 'Valid minLength was not accepted.');


  t.ok(!user.p('minLength', 'as', true), 'String shorter than minLength was accepted.');


  t.ok(!user.p('minLength2', 'as', true), 'String shorter than minLength was accepted. (optional but 2 chars)');

  t.ok(user.valid('maxLength'), 'Valid maxLength was not accepted');

  t.ok(!user.p('maxLength', 'asdasd', true), 'Invalid maxLength was accepted.');

  t.done();
};

exports.intSize = function (t) {
  var user = new UserMockup();
  t.expect(3);

  t.ok(!user.p('minMax', 1, true), 'Integer lower than min was accepted.');

  t.ok(!user.p('minMax', 21, true), 'Integer higher than min was accepted.');

  t.ok(user.p('minOptional', 0, true), 'Integer as 0 and optional was not accepted.');

  t.done();
};

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

  t.done();
};

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
};


exports.consistency = function (t) {
  var user = new UserMockup();
  t.expect(2);

  t.ok(user.valid('name') === user.valid('email'), 'Validating two valid properties resulted in different outputs.');

  t.ok(user.valid('name') === user.valid(), 'Validating the entire Model had a different result than validating a single property.');

  t.done();
};

exports.functionArgument = function (t) {
  var user = new UserMockup();
  t.expect(2);

  
  user.valid(function (valid) {
    t.same(valid, true, 'Validating with a function as the first arg did not call the callback with false as its first arg');

    user.p({
      name: '',
      email: 'asd'
    });
    
    user.valid(function (valid2) {
      t.same(valid2, false, 'Validating with a function as the first arg did not call the callback with false as its first arg');
      t.done();
    });
  });
};


exports.errorsCleared = function (t) {
  var user = new UserMockup();
  t.expect(2);

  user.p({
    name: '',
    email: 'asd'
  });
  
  user.valid(function (valid) {
    t.same({
      user: user.errors.name,
      email: user.errors.email
    }, {
      user: ['notEmpty'], 
      email: ['email']
    }, 'Validating a user did not set the user.errors properly.');
    user.p({
      name: 'test'
    });
    user.valid(function (valid) {
      t.same({
        user: user.errors.name,
        email: user.errors.email
      }, {
        user: [],
        email: ['email']
      }, 'Validating a user did not REset the user.errors properly.');
    });
    t.done();
  });
};


exports.customErrorNames = function (t) {
  var user = new UserMockup();
  t.expect(1);

  user.p({
    custom: 'INVALID',
    custom2: 'INVALID',
    customNamed: 'INVALID'
  });
  
  user.valid(function(valid) {
    t.same({
      custom: user.errors.custom, 
      custom2: user.errors.custom2,
      customNamed: user.errors.customNamed
    }, {
      custom: ['custom_custom'], 
      custom2: ['custom_custom2'],
      customNamed: ['custom_customNamed']
    }, 'Validating a user with custom validations failing did not put the proper error messages in user.errors.');
    t.done();
  });
};