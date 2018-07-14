var nohm = require(__dirname + '/../tsOut').Nohm;
var util = require('util');

nohm.setExtraValidations(__dirname + '/custom_validations.js');

// !!! this mockup must be defined valid from the start for most tests !!!
var UserMockup = nohm.model('UserMockup', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'test',
      validations: ['notEmpty'],
    },
    castInteger: {
      type: 'integer',
      defaultValue: 2,
    },
    castFloat: {
      type: 'float',
      defaultValue: 2.5,
    },
    castNumber: {
      type: 'number',
      defaultValue: 2.5,
    },
    castTimestamp: {
      type: 'timestamp',
      defaultValue: 100000,
    },
    behaviour: {
      type: function incrby(value, key, old) {
        if (typeof value !== 'string' || typeof old !== 'string') {
          throw new Error('Behaviour arguments were not strings!');
        }
        return parseInt(old, 10) + parseInt(value, 10);
      },
      defaultValue: 1,
    },
    minMax: {
      type: 'integer',
      defaultValue: 5,
      validations: [
        {
          name: 'minMax',
          options: {
            min: 2,
            max: 20,
          },
        },
      ],
    },
    minOptional: {
      type: 'integer',
      defaultValue: 0,
      validations: [
        {
          name: 'minMax',
          options: {
            min: 10,
            optional: true, // this is a bit stupid. because 0 will trigger it as optional
          },
        },
      ],
    },
    email: {
      type: 'string',
      defaultValue: 'blub@bla.de',
      validations: [
        {
          name: 'length', // not needed for a normal email validation, using this to test multiple validations
          options: {
            min: 3,
          },
        },
        'email',
      ],
    },
    optionalEmail: {
      type: 'string',
      defaultValue: '',
      validations: [
        {
          name: 'email',
          options: {
            optional: true,
          },
        },
      ],
    },
    minLength: {
      type: 'string',
      defaultValue: 'asd',
      validations: [
        {
          name: 'length',
          options: {
            min: 3,
          },
        },
      ],
    },
    minLength2: {
      type: 'string',
      defaultValue: '',
      validations: [
        {
          name: 'length',
          options: {
            min: 3,
            optional: true,
          },
        },
      ],
    },
    maxLength: {
      type: 'string',
      defaultValue: 'asd',
      validations: [
        {
          name: 'length',
          options: {
            max: 5,
          },
        },
      ],
    },
    number: {
      type: 'string',
      defaultValue: '1,000.5623',
      validations: ['number'],
    },
    numberUS: {
      type: 'string',
      defaultValue: '2,000.5623',
      validations: ['numberUS'],
    },
    numberEU: {
      type: 'string',
      defaultValue: '3.000,5623',
      validations: ['numberEU'],
    },
    numberSI: {
      type: 'string',
      defaultValue: '4 000,5623',
      validations: ['numberSI'],
    },
    url: {
      type: 'string',
      defaultValue: 'http://test.de',
      validations: ['url'],
    },
    custom: {
      type: 'string',
      defaultValue: 'valid',
      validations: [
        function(value) {
          return Promise.resolve(value === 'valid');
        },
      ],
    },
    custom2: {
      type: 'string',
      defaultValue: 'valid2',
      validations: [
        function(value) {
          return Promise.resolve(value === 'valid2');
        },
      ],
    },
    customNamed: {
      type: 'string',
      defaultValue: 'validNamed',
      validations: [
        function /*test*/ customNamedFunc(value) {
          return Promise.resolve(value === 'validNamed');
        },
      ],
    },
    customNamedAsync: {
      type: 'string',
      defaultValue: 'validNamedAsync',
      validations: [
        async function customNamedAsyncFunc(value) {
          return Promise.resolve(value === 'validNamedAsync');
        },
      ],
    },
    alphanumeric: {
      type: 'string',
      defaultValue: 'hurgel1234',
      validations: ['alphanumeric'],
    },
    regexp: {
      type: 'string',
      defaultValue: 'asd1',
      validations: [
        {
          name: 'regexp',
          options: {
            regex: /^asd[\d]+$/,
            optional: true,
          },
        },
      ],
    },
    // TODO: write test for multi-validation properties
    /*
    TODO for v1: re-enable once custom validations are implemented
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
        {
          name: 'customValidationFile',
          options: {
            optional: true
          }
        }
      ]
    },
    customDependentValidation: {
      type: 'string',
      defaultValue: 'test',
      validations: [
        {
          name: 'instanceValidation',
          options: {
            property: 'name'
          }
        }
      ]
    }*/
  },
});

function testSimpleProps(t, props, dontExpect) {
  if (!dontExpect) {
    t.expect(props.tests.length);
  }
  props.tests.forEach(function(prop) {
    var user = new UserMockup();
    user.property(props.name, prop.input);

    t.same(
      user.property(props.name),
      prop.expected,
      'Setting the property ' +
        props.name +
        ' to ' +
        util.inspect(prop.input) +
        ' did not cast it to ' +
        util.inspect(prop.expected),
    );
  });
}

function testValidateProp(t, objectName, propName) {
  const tests = [];
  return {
    push: (expected, setValue) => {
      tests.push(() => {
        return (async () => {
          var obj = await nohm.factory(objectName);
          if (typeof setValue !== 'undefined') {
            var setReturn = obj.property(propName, setValue);
          }
          const valid = await obj.validate(propName);
          const errorStr = `Property '${propName}' was not validated properly. Details:
object: ${objectName}
prop: ${propName}
value: ${util.inspect(setValue)}
after casting: ${util.inspect(setReturn)}
errors: ${util.inspect(obj.errors)}`;
          t.same(expected, valid, errorStr);
        })();
      });
    },
    launch: async () => {
      const promises = tests.map((test) => test());
      await Promise.all(promises);
      t.done();
    },
  };
}

var args = require(__dirname + '/testArgs.js');
var redis = args.redis;
var h = require(__dirname + '/helper.js');

exports.validation = {
  setUp: function(next) {
    if (!nohm.client) {
      nohm.setClient(redis);
    }
    next();
  },
  tearDown: function(next) {
    h.cleanUp(redis, args.prefix, next);
  },
  general: async (t) => {
    var user = new UserMockup();
    t.expect(1);

    const valid = await user.validate();
    if (!valid) {
      console.dir(user.errors);
    }

    t.ok(valid, 'The Model was not recognized as valid. Is it? Should be!');

    t.done();
  },

  castString: function(t) {
    var tests = {
      name: 'name',
      tests: [
        {
          input: null,
          expected: '',
        },
        {
          input: false,
          expected: '',
        },
        {
          input: true,
          expected: '',
        },
        {
          input: 0,
          expected: '',
        },
        {
          input: {},
          expected: '',
        },
        {
          input: [],
          expected: '',
        },
      ],
    };

    testSimpleProps(t, tests);

    t.done();
  },

  castInteger: function(t) {
    var tests = {
      name: 'castInteger',
      tests: [
        {
          input: '15',
          expected: 15,
        },
        {
          input: '15asd',
          expected: 15,
        },
        {
          input: '1.5',
          expected: 1,
        },
        {
          input: '0x15',
          expected: 0,
        },
        {
          input: '.5',
          expected: 0,
        },
        {
          input: '0.1e2',
          expected: 0,
        },
      ],
    };

    testSimpleProps(t, tests);

    t.done();
  },

  castFloat: function(t) {
    var user = new UserMockup();
    t.expect(6);

    user.property('castFloat', '1.5');
    t.ok(
      user.property('castFloat') === 1.5,
      'Setting a Float to a string "1.5" did not cast it to 1.5.',
    );

    user.property('castFloat', '1.5asd');
    t.ok(
      user.property('castFloat') === 1.5,
      'Setting a Float to a string "1.5asd" did not cast it to 1.5.',
    );

    user.property('castFloat', '01.5');
    t.ok(
      user.property('castFloat') === 1.5,
      'Setting a Float to a string "01.5" did not cast it to 1.5.',
    );

    user.property('castFloat', '0x1.5');
    t.ok(
      user.property('castFloat') === 0,
      'Setting a Float to a string "0x1.5" did not cast it to 0.',
    );

    user.property('castFloat', '.5');
    t.ok(
      user.property('castFloat') === 0.5,
      'Setting a Float to a string ".5" did not cast it to 0.5.',
    );

    user.property('castFloat', '0.1e2');
    t.ok(
      user.property('castFloat') === 10,
      'Setting a Float to a string "0.1e2" did not cast it to 10.',
    );

    t.done();
  },

  castNumber: function(t) {
    var user = new UserMockup();
    t.expect(6);

    user.property('castNumber', '1.5');
    t.same(
      user.property('castNumber'),
      1.5,
      'Setting a Float to a string "1.5" did not cast it to 1.5.',
    );

    user.property('castNumber', '1.5asd');
    t.same(
      user.property('castNumber'),
      1.5,
      'Setting a Float to a string "1.5asd" did not cast it to 1.5.',
    );

    user.property('castNumber', '01.5');
    t.same(
      user.property('castNumber'),
      1.5,
      'Setting a Float to a string "01.5" did not cast it to 1.5.',
    );

    user.property('castNumber', '0x1.5');
    t.same(
      user.property('castNumber'),
      0,
      'Setting a Float to a string "0x1.5" did not cast it to 0.',
    );

    user.property('castNumber', '.5');
    t.same(
      user.property('castNumber'),
      0.5,
      'Setting a Float to a string ".5" did not cast it to 0.5.',
    );

    user.property('castNumber', '0.1e2');
    t.same(
      user.property('castNumber'),
      10,
      'Setting a Float to a string "0.1e2" did not cast it to 10.',
    );

    t.done();
  },

  castTimestamp: function(t) {
    var user = new UserMockup(),
      should = new Date('1988-03-12T00:00:00Z').getTime().toString();
    t.expect(8);

    user.property('castTimestamp', should);
    t.ok(
      user.property('castTimestamp') === should,
      'Setting a Timestamp to a number should did not cast it to ' + should,
    );

    user.property('castTimestamp', '' + should);
    t.ok(
      user.property('castTimestamp') === should,
      'Setting a Timestamp to a string "should" did not cast it to ' + should,
    );

    user.property('castTimestamp', '1988-03-12T00:00:00Z');
    t.ok(
      user.property('castTimestamp') === should,
      'Setting a Timestamp to a string "1988-03-12T00:00:00Z" did not cast it to ' +
        should,
    );

    user.property('castTimestamp', '1988-03-12 04:30:00 +04:30');
    t.ok(
      user.property('castTimestamp') === should,
      'Setting a Timestamp to a string "1988-03-12 04:30:00 +04:30" did not cast it to ' +
        should,
    );

    user.property('castTimestamp', '1988-03-11 19:30:00 -04:30');
    t.ok(
      user.property('castTimestamp') === should,
      'Setting a Timestamp to a string "1988-03-11 20:30:00 -04:30" did not cast it to ' +
        should,
    );

    user.property('castTimestamp', 'Sat, 12 Mar 1988 00:00:00');
    t.ok(
      user.property('castTimestamp') === should,
      'Setting a Timestamp to a string "Sat, 12 Mar 1988 00:00:00" did not cast it to ' +
        should,
    );

    user.property('castTimestamp', '03.12.1988');
    t.ok(
      user.property('castTimestamp') === should,
      'Setting a Timestamp to a string "03.12.1988" did not cast it to ' +
        should,
    );

    user.property('castTimestamp', '03/12/1988');
    t.ok(
      user.property('castTimestamp') === should,
      'Setting a Timestamp to a string "03/12/1988" did not cast it to ' +
        should,
    );

    t.done();
  },

  behaviours: function(t) {
    var user = new UserMockup();
    t.expect(1);

    user.property('behaviour', 5);
    t.equals(
      user.property('behaviour'),
      6,
      'Using the behaviour did not work correctly',
    );

    t.done();
  },

  notEmpty: async (t) => {
    var tests = testValidateProp(t, 'UserMockup', 'name');

    tests.push(false, '');
    tests.push(false, '  ');

    await tests.launch();
  },

  stringMinLength: async (t) => {
    var tests = testValidateProp(t, 'UserMockup', 'minLength');

    tests.push(false, 'as');

    tests.launch();
  },

  stringMaxLength: async (t) => {
    var tests = testValidateProp(t, 'UserMockup', 'maxLength');

    tests.push(false, 'asdasd');

    tests.launch();
  },

  stringLengthOptional: async (t) => {
    var tests = testValidateProp(t, 'UserMockup', 'minLength2');

    tests.push(true, '');
    tests.push(false, 'as');

    tests.launch();
  },

  minMax: async (t) => {
    var tests = testValidateProp(t, 'UserMockup', 'minMax');

    tests.push(false, 1);
    tests.push(false, 21);

    tests.launch();
  },

  minOptional: async (t) => {
    var tests = testValidateProp(t, 'UserMockup', 'minOptional');

    tests.push(true, 0);

    tests.launch();
  },

  email: async (t) => {
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

  number: async (t) => {
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

  alphanumeric: async (t) => {
    var tests = testValidateProp(t, 'UserMockup', 'alphanumeric');

    tests.push(true, 'asd');
    tests.push(true, '1234');
    tests.push(false, ' asd');
    tests.push(false, 'a$aa');

    tests.launch();
  },

  regexp: async (t) => {
    var tests = testValidateProp(t, 'UserMockup', 'regexp');

    tests.push(true, 'asd1234123');
    tests.push(true, 'asd1');
    tests.push(true, '');
    tests.push(false, ' asd');
    tests.push(false, '12345');

    tests.launch();
  },

  /*
  TODO: Re-enable once custom validation is implemented
  customValidationFile: async (t) => {
    var tests = testValidateProp(t, 'UserMockup', 'customValidationFile');
    
    tests.push(false, 'somethingelse');
    
    tests.launch();
  },
  
  customValidationFileOptional: async (t) => {
    var tests = testValidateProp(t, 'UserMockup', 'customValidationFileOptional');
    
    tests.push(true, '');
    
    tests.launch();
  },
  
  customDependentValidation: async (t) => {
    var tests = testValidateProp(t, 'UserMockup', 'customDependentValidation');
    
    tests.push(true, 'test');
    
    tests.launch();
  },
  */

  errorFromObject: async (t) => {
    var user = new UserMockup();
    t.expect(1);

    user.property('minMax', 'a');
    await user.validate('minMax');
    t.same(user.errors.minMax, ['minMax'], 'Error was incorrect');
    t.done();
  },

  consistency: async (t) => {
    var user = new UserMockup();
    t.expect(2);

    const valid1 = await user.validate('name');
    const valid2 = await user.validate('email');
    t.same(
      valid1,
      valid2,
      'Validating two valid properties resulted in different outputs.',
    );
    const valid3 = await user.validate();
    t.same(
      valid1,
      valid3,
      'Validating the entire Model had a different result than validating a single property.',
    );
    t.done();
  },

  functionArgument: async (t) => {
    var user = new UserMockup();
    t.expect(2);

    const valid = await user.validate();
    t.same(
      valid,
      true,
      'Validating with a function as the first arg did not call the callback with true as its first arg',
    );

    user.property({
      name: '',
      email: 'asd',
    });

    const valid2 = await user.validate();
    t.same(
      valid2,
      false,
      'Validating with a function as the first arg did not call the callback with false as its first arg',
    );
    t.done();
  },

  errorsCleared: async (t) => {
    var user = new UserMockup();
    t.expect(2);

    user.property({
      name: '',
      email: 'asd',
    });

    await user.validate();
    t.same(
      {
        user: user.errors.name,
        email: user.errors.email,
      },
      {
        user: ['notEmpty'],
        email: ['email'],
      },
      'Validating a user did not set the user.errors properly.',
    );
    user.property({
      name: 'test',
    });
    await user.validate();
    t.same(
      {
        user: user.errors.name,
        email: user.errors.email,
      },
      {
        user: [],
        email: ['email'],
      },
      'Validating a user did not reset the user.errors properly.',
    );
    t.done();
  },

  customErrorNames: async (t) => {
    var user = new UserMockup();
    t.expect(1);

    user.property({
      custom: 'INVALID',
      custom2: 'INVALID',
      customNamed: 'INVALID',
    });

    await user.validate();
    t.same(
      {
        custom: user.errors.custom,
        custom2: user.errors.custom2,
        customNamed: user.errors.customNamed,
      },
      {
        custom: ['custom_custom'],
        custom2: ['custom_custom2'],
        customNamed: ['custom_customNamedFunc'],
      },
      'Validating a user with custom validations failing did not put the proper error messages in user.errors.',
    );
    t.done();
  },

  customErrorNamesAsync: async (t) => {
    var user = new UserMockup();
    t.expect(1);

    user.property({
      customNamedAsync: 'INVALID',
    });

    await user.validate();
    t.same(
      {
        customNamedAsync: user.errors.customNamedAsync,
      },
      {
        customNamedAsync: ['custom_customNamedAsyncFunc'],
      },
      'Validating a user with custom validations failing did not put the proper error messages in user.errors.',
    );
    t.done();
  },

  invalidSaveResetsId: async (t) => {
    var user = new UserMockup();
    t.expect(2);

    user.property('name', '');
    try {
      await user.save();
    } catch (e) {
      t.ok(e instanceof nohm.ValidationError, 'Unexpected error.');
    } finally {
      t.same(
        user.id,
        null,
        'The id of an invalid user was not reset properly.',
      );
      t.done();
    }
  },

  skipValidation: async (t) => {
    var user = new UserMockup();
    t.expect(1);

    user.property('name', '');

    try {
      await user.save({ skip_validation_and_unique_indexes: true });
      t.notEqual(
        user.id,
        null,
        'The id of an invalid user with skip_validation was reset.',
      );
    } catch (err) {
      t.strictEqual(
        false,
        true,
        'The validation has been run even though skip_validation was true.',
      );
    } finally {
      t.done();
    }
  },
};

exports['invalid regexp option'] = async (t) => {
  t.expect(1);

  const model = nohm.model(
    'invalidRegexpOption',
    {
      properties: {
        noRegexp: {
          type: 'string',
          defaultValue: 'hurgel1234',
          validations: [
            {
              name: 'regexp',
              options: {
                regex: 'invalidRegexp',
              },
            },
          ],
        },
      },
    },
    true,
  );

  const instance = new model();
  try {
    await instance.validate();
    t.same(
      false,
      true,
      'Validation did not throw with an invalid validation regexp',
    );
  } catch (err) {
    t.same(
      err.message,
      'Option for regexp validation was not a RegExp object.',
      'Wrong error thrown',
    );
  } finally {
    t.done();
  }
};

exports['ValidationError only has objects for properties with errors'] = async (
  t,
) => {
  var user = new UserMockup();
  t.expect(2);

  user.property('name', '');
  try {
    await user.save();
  } catch (e) {
    t.ok(e instanceof nohm.ValidationError, 'Unexpected error.');
    const errorKeys = Object.keys(e.errors);
    t.same(
      ['name'],
      errorKeys,
      'ValidationError was not restricted to error keys',
    );
    t.done();
  }
};

exports['multiple validation failures produce multiple error entries'] = async (
  t,
) => {
  var user = new UserMockup();
  t.expect(1);

  user.property('email', 'a');
  try {
    await user.save();
  } catch (e) {
    t.same(
      ['length', 'email'],
      e.errors.email,
      'ValidationError was not restricted to error keys',
    );
    t.done();
  }
};

exports['ValidationError has modelName as property'] = async (t) => {
  var user = new UserMockup();
  t.expect(1);

  user.property('name', '');
  try {
    await user.save();
  } catch (e) {
    t.same(
      e.modelName,
      user.modelName,
      "ValidationError didn't have the right modelName set",
    );
    t.done();
  }
};
