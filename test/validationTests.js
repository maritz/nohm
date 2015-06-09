var nohm = require(__dirname + '/../lib/nohm').Nohm;
var async = require('async');
var util = require('util');

nohm.setExtraValidations(__dirname + '/custom_validations.js');

// !!! this mockup must be defined valid from the start for most tests !!!
var UserMockup = nohm.model('UserMockup', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'test',
      validations: [
        'notEmpty'
      ]
    },
    castInteger: {
      type: 'integer',
      defaultValue: 2
    },
    castFloat: {
      type: 'float',
      defaultValue: 2.5
    },
    castTimestamp: {
      type: 'timestamp',
      defaultValue: 100000
    },
    behaviour: {
      type: function incrby(value, key, old) {
        return old + value;
      },
      defaultValue: 1
    },
    minMax: {
      type: 'integer',
      defaultValue: 5,
      validations: [
        ['minMax',
          {
            min: 2,
            max: 20
          }
        ]
      ]
    },
    minOptional: {
      type: 'integer',
      defaultValue: 0,
      validations: [
        ['minMax',
          {
            min: 10,
            optional: true // this is a bit stupid. because 0 will trigger it as optional
          }
        ]
      ]
    },
    email: {
      type: 'string',
      defaultValue: 'blub@bla.de',
      validations: [
        'email'
      ]
    },
    optionalEmail: {
      type: 'string',
      defaultValue: '',
      validations: [
        ['email',
          {
            optional: true
          }
        ]
      ]
    },
    minLength: {
      type: 'string',
      defaultValue: 'asd',
      validations: [
        ['length',
          {
            min: 3
          }
        ]
      ]
    },
    minLength2: {
      type: 'string',
      defaultValue: '',
      validations: [
        ['length',
          {
            min: 3,
            optional: true
          }
        ]
      ]
    },
    maxLength: {
      type: 'string',
      defaultValue: 'asd',
      validations: [
        ['length',
          {
            max: 5
          }
        ]
      ]
    },
    number: {
      type: 'string',
      defaultValue: '1,000.5623',
      validations: [
        'number'
      ]
    },
    numberUS: {
      type: 'string',
      defaultValue: '2,000.5623',
      validations: [
        'numberUS'
      ]
    },
    numberEU: {
      type: 'string',
      defaultValue: '3.000,5623',
      validations: [
        'numberEU'
      ]
    },
    numberSI: {
      type: 'string',
      defaultValue: '4 000,5623',
      validations: [
        'numberSI'
      ]
    },
    url: {
      type: 'string',
      defaultValue: 'http://test.de',
      validations: [
        'url'
      ]
    },
    custom: {
      type: 'string',
      defaultValue: 'valid',
      validations: [
        function(value, opt, callback) {
          callback(value === 'valid');
        }
      ]
    },
    custom2: {
      type: 'string',
      defaultValue: 'valid2',
      validations: [
        function(value, opt, callback) {
          callback(value === 'valid2');
        }
      ]
    },
    customNamed: {
      type: 'string',
      defaultValue: 'validNamed',
      validations: [
        function customNamed(value, opt, callback) {
          callback(value === 'validNamed');
        }
      ]
    },
    alphanumeric: {
      type: 'string',
      defaultValue: 'hurgel1234',
      validations: [
        'alphanumeric'
      ]
    },
    noRegexp: {
      type: 'string',
      defaultValue: 'hurgel1234',
      validations: [
        'regexp'
      ]
    },
    regexp: {
      type: 'string',
      defaultValue: 'asd1',
      validations: [
        ['regexp',
          {
            regex: /^asd[\d]+$/,
            optional: true
          }
        ]
      ]
    },
    customValidationFile: {
      type: 'string',
      defaultValue: 'customValidationFile',
      validations: [
        'customValidationFile'
      ]
    },
    customValidationFileOptional: {
      type: 'string',
      defaultValue: 'customValidationFile',
      validations: [
        ['customValidationFile',
          {
            optional: true
          }
        ]
      ]
    }
  }
});

function testSimpleProps(t, props, dontExpect) {
  if (!dontExpect) {
    t.expect(props.tests.length);
  }
  props.tests.forEach(function(prop) {
    var user = new UserMockup();
    user.p(props.name, prop.input);

    t.same(user.p(props.name), prop.expected, 'Setting the property ' + props.name + ' to ' + util.inspect(prop.input) + ' did not cast it to ' + util.inspect(prop.expected));
  });
}

function testValidateProp(t, objectName, propName) {
  var tests = {};
  var parallel = [];
  tests.push = function(expected, setValue) {
    parallel.push(function(callback) {
      var obj = nohm.factory(objectName);
      if (typeof(setValue) !== 'undefined') {
        var setReturn = obj.p(propName, setValue);
      }
      obj.valid(propName, function(valid) {
        var errorStr = "Property '" + propName + "' was not validated properly. Details:" + "\nobject: " + objectName + "\nprop: " + propName + "\nvalue: " + util.inspect(setValue) + "\nafter casting: " + util.inspect(setReturn) + "\nerrors: " + util.inspect(obj.errors);
        t.same(expected, valid, errorStr);
        callback();
      });
    });
  };
  tests.launch = function() {
    t.expect(parallel.length);
    async.parallel(parallel, function() {
      t.done();
    });
  };
  return tests;
}

var args = require(__dirname+'/testArgs.js');
var redis = args.redis;
var h = require(__dirname+'/helper.js');

exports.validation = {
  setUp: function (next) {
    if ( ! nohm.client) {
      nohm.setClient(redis);
    }
    next();
  },
  tearDown: function (next) {
    h.cleanUp(redis, args.prefix, next);
  },
  general: function(t) {
    var user = new UserMockup();
    t.expect(1);

    user.valid(function(valid) {
      if (!valid) {
        console.dir(user.errors);
      }

      t.ok(valid, 'The Model was not recognized as valid. Is it? Should be!');

      t.done();
    });
  },


  castString: function(t) {
    var tests = {
      name: 'name',
      tests: [{
        input: null,
        expected: ''
      }, {
        input: false,
        expected: ''
      }, {
        input: true,
        expected: ''
      }, {
        input: 0,
        expected: ''
      }, {
        input: {},
        expected: ''
      }, {
        input: [],
        expected: ''
      }]
    };

    testSimpleProps(t, tests);

    t.done();
  },

  castInteger: function(t) {
    var tests = {
      name: 'castInteger',
      tests: [{
        input: '15',
        expected: 15
      }, {
        input: '15asd',
        expected: 15
      }, {
        input: '1.5',
        expected: 1
      }, {
        input: '0x15',
        expected: 0
      }, {
        input: '.5',
        expected: 0
      }, {
        input: '0.1e2',
        expected: 0
      }]
    };

    testSimpleProps(t, tests);

    t.done();
  },

  castFloat: function(t) {
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
  },

  castTimestamp: function(t) {
    var user = new UserMockup(),
        should = new Date('1988-03-12T00:00:00Z').getTime();
    t.expect(8);

    user.p('castTimestamp', should);
    t.ok(user.p('castTimestamp') === should, 'Setting a Timestamp to a number should did not cast it to ' + should);

    user.p('castTimestamp', '' + should);
    t.ok(user.p('castTimestamp') === should, 'Setting a Timestamp to a string "should" did not cast it to ' + should);

    user.p('castTimestamp', '1988-03-12T00:00:00Z');
    t.ok(user.p('castTimestamp') === should, 'Setting a Timestamp to a string "1988-03-12T00:00:00Z" did not cast it to ' + should);

    user.p('castTimestamp', '1988-03-12 04:30:00 +04:30');
    t.ok(user.p('castTimestamp') === should, 'Setting a Timestamp to a string "1988-03-12 04:30:00 +04:30" did not cast it to ' + should);

    user.p('castTimestamp', '1988-03-11 19:30:00 -04:30');
    t.ok(user.p('castTimestamp') === should, 'Setting a Timestamp to a string "1988-03-11 20:30:00 -04:30" did not cast it to ' + should);

    user.p('castTimestamp', 'Sat, 12 Mar 1988 00:00:00');
    t.ok(user.p('castTimestamp') === should, 'Setting a Timestamp to a string "Sat, 12 Mar 1988 00:00:00" did not cast it to ' + should);

    user.p('castTimestamp', '03.12.1988');
    t.ok(user.p('castTimestamp') === should, 'Setting a Timestamp to a string "03.12.1988" did not cast it to ' + should);

    user.p('castTimestamp', '03/12/1988');
    t.ok(user.p('castTimestamp') === should, 'Setting a Timestamp to a string "03/12/1988" did not cast it to ' + should);

    t.done();
  },

  behaviours: function(t) {
    var user = new UserMockup();
    t.expect(1);

    user.p('behaviour', 5);
    t.equals(user.p('behaviour'), 6, 'Using the behaviour did not work correctly');

    t.done();
  },


  notEmpty: function(t) {
    var tests = testValidateProp(t, 'UserMockup', 'name');

    tests.push(false, '');
    tests.push(false, '  ');

    tests.launch();
  },

  stringMinLength: function(t) {
    var tests = testValidateProp(t, 'UserMockup', 'minLength');

    tests.push(false, 'as');

    tests.launch();
  },

  stringMaxLength: function(t) {
    var tests = testValidateProp(t, 'UserMockup', 'maxLength');

    tests.push(false, 'asdasd');

    tests.launch();
  },

  stringLengthOptional: function(t) {
    var tests = testValidateProp(t, 'UserMockup', 'minLength2');

    tests.push(true, '');
    tests.push(false, 'as');

    tests.launch();
  },

  minMax: function(t) {
    var tests = testValidateProp(t, 'UserMockup', 'minMax');

    tests.push(false, 1);
    tests.push(false, 21);

    tests.launch();
  },

  minOptional: function(t) {
    var tests = testValidateProp(t, 'UserMockup', 'minOptional');

    tests.push(true, 0);

    tests.launch();
  },

  email: function(t) {
    // this isn't really sufficient to ensure that the regex is really working correctly, but it's good enough for now.
    var tests = testValidateProp(t, 'UserMockup', 'email');

    tests.push(true, 'asdasd@asd.de');
    tests.push(true, 'asdasd+asd@asd.de');
    tests.push(true, '"Abc\\@def"@example.com');
    tests.push(true, '"Fred Bloggs"@example.com');
    tests.push(true, '"Joe\\Blow"@example.com');
    tests.push(true, '"Abc@def"@example.com');
    tests.push(true, 'customer/department=shipping@example.com');
    tests.push(true, '$A12345@example.com');
    tests.push(true, '!def!xyz%abc@example.com');
    tests.push(true, '_somename@example.com');
    tests.push(false, 'somename@example');
    tests.push(false, '@example.com');
    tests.push(false, 'example');
    tests.push(false, 'asd');
    tests.launch();
  },

  number: function(t) {
    var tests = testValidateProp(t, 'UserMockup', 'number');

    tests.push(true, '0');
    tests.push(true, '1');
    tests.push(true, '-1');
    tests.push(true, '10');
    tests.push(true, '1000');
    tests.push(true, '1,1');
    tests.push(true, '1.1');
    tests.push(true, '1.000,1');
    tests.push(true, '1,000.1');
    tests.push(true, '1 000.1');
    tests.push(true, '1 000,1');

    tests.launch();
  },

  alphanumeric: function(t) {
    var tests = testValidateProp(t, 'UserMockup', 'alphanumeric');

    tests.push(true, 'asd');
    tests.push(true, '1234');
    tests.push(false, ' asd');
    tests.push(false, 'a$aa');

    tests.launch();
  },

  regexp: function(t) {
    var tests = testValidateProp(t, 'UserMockup', 'regexp');

    tests.push(true, 'asd1234123');
    tests.push(true, 'asd1');
    tests.push(true, '');
    tests.push(false, ' asd');
    tests.push(false, '12345');

    tests.launch();
  },

  customValidationFile: function(t) {
    var tests = testValidateProp(t, 'UserMockup', 'customValidationFile');

    tests.push(false, 'somethingelse');

    tests.launch();
  },

  customValidationFileOptional: function(t) {
    var tests = testValidateProp(t, 'UserMockup', 'customValidationFileOptional');

    tests.push(true, '');

    tests.launch();
  },

  errorFromObject: function(t) {
    var user = new UserMockup();
    t.expect(1);

    user.p('minMax', 'a');
    user.valid('minMax', function() {
      t.same(user.errors.minMax, ['minMax'], 'Error was incorrect');
      t.done();
    });
  },

  consistency: function(t) {
    var user = new UserMockup();
    t.expect(2);

    user.valid('name', function(valid1) {
      user.valid('email', function(valid2) {
        t.same(valid1, valid2, 'Validating two valid properties resulted in different outputs.');
        user.valid(function(valid3) {
          t.same(valid1, valid3, 'Validating the entire Model had a different result than validating a single property.');
          t.done();
        });
      });
    });
  },

  functionArgument: function(t) {
    var user = new UserMockup();
    t.expect(2);


    user.valid(function(valid) {
      t.same(valid, true, 'Validating with a function as the first arg did not call the callback with true as its first arg');

      user.p({
        name: '',
        email: 'asd'
      });

      user.valid(function(valid2) {
        t.same(valid2, false, 'Validating with a function as the first arg did not call the callback with false as its first arg');
        t.done();
      });
    });
  },


  errorsCleared: function(t) {
    var user = new UserMockup();
    t.expect(2);

    user.p({
      name: '',
      email: 'asd'
    });

    user.valid(function() {
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
      user.valid(function() {
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
  },


  customErrorNames: function(t) {
    var user = new UserMockup();
    t.expect(1);

    user.p({
      custom: 'INVALID',
      custom2: 'INVALID',
      customNamed: 'INVALID'
    });

    user.valid(function() {
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
  },

  invalidSaveResetsId: function(t) {
    var user = new UserMockup();
    t.expect(1);

    user.p('name', '');

    user.save(function() {
      t.same(user.id, null, 'The id of an invalid user was not reset properly.');
      t.done();
    });
  },

  skipValidation: function(t) {
    var user = new UserMockup();
    t.expect(2);

    user.p('name', '');

    user.save({ skip_validation_and_unique_indexes: true }, function(err) {
      t.notEqual(user.id, null, 'The id of an invalid user with skip_validation was reset.');
      t.strictEqual(err, undefined, 'The validation has been run even though skip_validation was true.');
      t.done();
    });
  }
};
