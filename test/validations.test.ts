import test from 'ava';
import * as util from 'util';

import { nohm } from '../ts';

import * as args from './testArgs';
import { cleanUpPromise } from './helper';

const redis = args.redis;

const prefix = args.prefix + 'validationTests';

test.before(async () => {
  nohm.setPrefix(prefix);
  await args.setClient(nohm, redis);
  await cleanUpPromise(redis, prefix);
});

test.after(async () => {
  await cleanUpPromise(redis, prefix);
});

nohm.setExtraValidations(__dirname + '/custom_validations.js');

const UserMockup = nohm.model('UserMockup', {
  // !!! this mockup must be defined with valid default values !!!
  properties: {
    name: {
      defaultValue: 'test',
      type: 'string',
      validations: ['notEmpty'],
    },
    castInteger: {
      defaultValue: 2,
      type: 'integer',
    },
    castFloat: {
      defaultValue: 2.5,
      type: 'float',
    },
    castNumber: {
      defaultValue: 2.5,
      type: 'number',
    },
    castTimestamp: {
      defaultValue: 100000,
      type: 'timestamp',
    },
    behavior: {
      defaultValue: 1,
      type: function incrementBy(value, _key, old) {
        if (typeof value !== 'string' || typeof old !== 'string') {
          throw new Error('Behavior arguments were not strings!');
        }
        return parseInt(old, 10) + parseInt(value, 10);
      },
    },
    minMax: {
      defaultValue: 5,
      type: 'integer',
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
      defaultValue: 0,
      type: 'integer',
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
      defaultValue: 'blub@bla.de',
      type: 'string',
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
      defaultValue: '',
      type: 'string',
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
      defaultValue: 'asd',
      type: 'string',
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
      defaultValue: '',
      type: 'string',
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
      defaultValue: 'asd',
      type: 'string',
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
      defaultValue: '1,000.5623',
      type: 'string',
      validations: ['number'],
    },
    numberUS: {
      defaultValue: '2,000.5623',
      type: 'string',
      validations: ['numberUS'],
    },
    numberEU: {
      defaultValue: '3.000,5623',
      type: 'string',
      validations: ['numberEU'],
    },
    numberSI: {
      defaultValue: '4 000,5623',
      type: 'string',
      validations: ['numberSI'],
    },
    url: {
      defaultValue: 'http://test.de',
      type: 'string',
      validations: ['url'],
    },
    custom: {
      defaultValue: 'valid',
      type: 'string',
      validations: [
        (value) => {
          return Promise.resolve(value === 'valid');
        },
      ],
    },
    custom2: {
      defaultValue: 'valid2',
      type: 'string',
      validations: [
        (value) => {
          return Promise.resolve(value === 'valid2');
        },
      ],
    },
    customNamed: {
      defaultValue: 'validNamed',
      type: 'string',
      validations: [
        function /*test*/ customNamedFunc(value) {
          return Promise.resolve(value === 'validNamed');
        },
      ],
    },
    customNamedAsync: {
      defaultValue: 'validNamedAsync',
      type: 'string',
      validations: [
        async function customNamedAsyncFunc(value) {
          return Promise.resolve(value === 'validNamedAsync');
        },
      ],
    },
    alphanumeric: {
      defaultValue: 'hurgel1234',
      type: 'string',
      validations: ['alphanumeric'],
    },
    regexp: {
      defaultValue: 'asd1',
      type: 'string',
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
    TODO: re-enable once custom validations are implemented
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

function testSimpleProps(t, props) {
  props.tests.forEach((prop) => {
    const user = new UserMockup();
    user.property(props.name, prop.input);

    t.is(
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
          const obj = await nohm.factory(objectName);
          let setReturn = '';
          if (typeof setValue !== 'undefined') {
            setReturn = obj.property(propName, setValue);
          }
          const valid = await obj.validate(propName);
          const errorStr = `Property '${propName}' was not validated properly. Details:
object: ${objectName}
prop: ${propName}
value: ${util.inspect(setValue)}
after casting: ${util.inspect(setReturn)}
errors: ${util.inspect(obj.errors)}`;
          t.is(expected, valid, errorStr);
        })();
      });
    },
    launch: async () => {
      const promises = tests.map((testFn) => testFn());
      await Promise.all(promises);
    },
  };
}

test('default values validate', async (t) => {
  const user = new UserMockup();

  const valid = await user.validate();
  t.true(valid, 'The Model was not recognized as valid. Is it? Should be!');
});

test('castString', (t) => {
  const tests = {
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
});

test('castInteger', (t) => {
  const tests = {
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
});

test('castFloat', (t) => {
  const user = new UserMockup();

  user.property('castFloat', '1.5');
  t.is(
    user.property('castFloat'),
    1.5,
    'Setting a Float to a string "1.5" did not cast it to 1.5.',
  );

  user.property('castFloat', '1.5asd');
  t.is(
    user.property('castFloat'),
    1.5,
    'Setting a Float to a string "1.5asd" did not cast it to 1.5.',
  );

  user.property('castFloat', '01.5');
  t.is(
    user.property('castFloat'),
    1.5,
    'Setting a Float to a string "01.5" did not cast it to 1.5.',
  );

  user.property('castFloat', '0x1.5');
  t.is(
    user.property('castFloat'),
    0,
    'Setting a Float to a string "0x1.5" did not cast it to 0.',
  );

  user.property('castFloat', '.5');
  t.is(
    user.property('castFloat'),
    0.5,
    'Setting a Float to a string ".5" did not cast it to 0.5.',
  );

  user.property('castFloat', '0.1e2');
  t.is(
    user.property('castFloat'),
    10,
    'Setting a Float to a string "0.1e2" did not cast it to 10.',
  );
});

test('castNumber', (t) => {
  const user = new UserMockup();

  user.property('castNumber', '1.5');
  t.is(
    user.property('castNumber'),
    1.5,
    'Setting a Float to a string "1.5" did not cast it to 1.5.',
  );

  user.property('castNumber', '1.5asd');
  t.is(
    user.property('castNumber'),
    1.5,
    'Setting a Float to a string "1.5asd" did not cast it to 1.5.',
  );

  user.property('castNumber', '01.5');
  t.is(
    user.property('castNumber'),
    1.5,
    'Setting a Float to a string "01.5" did not cast it to 1.5.',
  );

  user.property('castNumber', '0x1.5');
  t.is(
    user.property('castNumber'),
    0,
    'Setting a Float to a string "0x1.5" did not cast it to 0.',
  );

  user.property('castNumber', '.5');
  t.is(
    user.property('castNumber'),
    0.5,
    'Setting a Float to a string ".5" did not cast it to 0.5.',
  );

  user.property('castNumber', '0.1e2');
  t.is(
    user.property('castNumber'),
    10,
    'Setting a Float to a string "0.1e2" did not cast it to 10.',
  );
});

test('castTimestamp', (t) => {
  const user = new UserMockup();
  const should = new Date('1988-03-12T00:00:00Z').getTime().toString();

  user.property('castTimestamp', should);
  t.true(
    user.property('castTimestamp') === should,
    'Setting a Timestamp to a number should did not cast it to ' + should,
  );

  user.property('castTimestamp', '' + should);
  t.true(
    user.property('castTimestamp') === should,
    'Setting a Timestamp to a string "should" did not cast it to ' + should,
  );

  user.property('castTimestamp', '1988-03-12T00:00:00Z');
  t.true(
    user.property('castTimestamp') === should,
    'Setting a Timestamp to a string "1988-03-12T00:00:00Z" did not cast it to ' +
      should,
  );

  user.property('castTimestamp', '1988-03-12 04:30:00 +04:30');
  t.true(
    user.property('castTimestamp') === should,
    'Setting a Timestamp to a string "1988-03-12 04:30:00 +04:30" did not cast it to ' +
      should,
  );

  user.property('castTimestamp', '1988-03-11 19:30:00 -04:30');
  t.true(
    user.property('castTimestamp') === should,
    'Setting a Timestamp to a string "1988-03-11 20:30:00 -04:30" did not cast it to ' +
      should,
  );

  user.property('castTimestamp', 'Sat, 12 Mar 1988 00:00:00');
  t.true(
    user.property('castTimestamp') === should,
    'Setting a Timestamp to a string "Sat, 12 Mar 1988 00:00:00" did not cast it to ' +
      should,
  );

  user.property('castTimestamp', '03.12.1988');
  t.true(
    user.property('castTimestamp') === should,
    'Setting a Timestamp to a string "03.12.1988" did not cast it to ' + should,
  );

  user.property('castTimestamp', '03/12/1988');
  t.true(
    user.property('castTimestamp') === should,
    'Setting a Timestamp to a string "03/12/1988" did not cast it to ' + should,
  );
});

test('behaviors', (t) => {
  const user = new UserMockup();

  user.property('behavior', 5);
  t.is(
    user.property('behavior'),
    6,
    'Using the behavior did not work correctly',
  );
});

test('notEmpty', async (t) => {
  const tests = testValidateProp(t, 'UserMockup', 'name');

  tests.push(false, '');
  tests.push(false, '  ');

  await tests.launch();
});

test('stringMinLength', async (t) => {
  const tests = testValidateProp(t, 'UserMockup', 'minLength');

  tests.push(false, 'as');

  await tests.launch();
});

test('stringMaxLength', async (t) => {
  const tests = testValidateProp(t, 'UserMockup', 'maxLength');

  tests.push(false, 'asdasd');

  await tests.launch();
});

test('stringLengthOptional', async (t) => {
  const tests = testValidateProp(t, 'UserMockup', 'minLength2');

  tests.push(true, '');
  tests.push(false, 'as');

  await tests.launch();
});

test('minMax', async (t) => {
  const tests = testValidateProp(t, 'UserMockup', 'minMax');

  tests.push(false, 1);
  tests.push(false, 21);

  await tests.launch();
});

test('minOptional', async (t) => {
  const tests = testValidateProp(t, 'UserMockup', 'minOptional');

  tests.push(true, 0);

  await tests.launch();
});

test('email', async (t) => {
  // this isn't really sufficient to ensure that the regex is really working correctly, but it's good enough for now.
  const tests = testValidateProp(t, 'UserMockup', 'email');

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
  await tests.launch();
});

test('number', async (t) => {
  const tests = testValidateProp(t, 'UserMockup', 'number');

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

  await tests.launch();
});

test('alphanumeric', async (t) => {
  const tests = testValidateProp(t, 'UserMockup', 'alphanumeric');

  tests.push(true, 'asd');
  tests.push(true, '1234');
  tests.push(false, ' asd');
  tests.push(false, 'a$aa');

  await tests.launch();
});

test('regexp', async (t) => {
  const tests = testValidateProp(t, 'UserMockup', 'regexp');

  tests.push(true, 'asd1234123');
  tests.push(true, 'asd1');
  tests.push(true, '');
  tests.push(false, ' asd');
  tests.push(false, '12345');

  await tests.launch();
});

/*
  TODO: Re-enable once custom validation is implemented
  test('customValidationFile', (t) => {
    const tests = testValidateProp(t, 'UserMockup', 'customValidationFile');

    tests.push(false, 'somethingelse');

    await tests.launch();
  });

  test('customValidationFileOptional', (t) => {
    const tests = testValidateProp(t, 'UserMockup', 'customValidationFileOptional');

    tests.push(true, '');

    await tests.launch();
  });

  test('customDependentValidation', (t) => {
    const tests = testValidateProp(t, 'UserMockup', 'customDependentValidation');

    tests.push(true, 'test');

    await tests.launch();
  });
  */

test('errorFromObject', async (t) => {
  const user = new UserMockup();

  user.property('minMax', 'a');
  await user.validate('minMax');
  t.deepEqual(user.errors.minMax, ['minMax'], 'Error was incorrect');
});

test('consistency', async (t) => {
  const user = new UserMockup();

  const valid1 = await user.validate('name');
  const valid2 = await user.validate('email');
  t.is(
    valid1,
    valid2,
    'Validating two valid properties resulted in different outputs.',
  );
  const valid3 = await user.validate();
  t.is(
    valid1,
    valid3,
    'Validating the entire Model had a different result than validating a single property.',
  );
});

test('functionArgument', async (t) => {
  const user = new UserMockup();

  const valid = await user.validate();
  t.is(
    valid,
    true,
    'Validating with a function as the first arg did not call the callback with true as its first arg',
  );

  user.property({
    name: '',
    email: 'asd',
  });

  const valid2 = await user.validate();
  t.is(
    valid2,
    false,
    'Validating with a function as the first arg did not call the callback with false as its first arg',
  );
});

test('errorsCleared', async (t) => {
  const user = new UserMockup();

  user.property({
    name: '',
    email: 'asd',
  });

  await user.validate();
  t.deepEqual(
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
  t.deepEqual(
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
});

test('customErrorNames', async (t) => {
  const user = new UserMockup();

  user.property({
    custom: 'INVALID',
    custom2: 'INVALID',
    customNamed: 'INVALID',
  });

  await user.validate();
  t.deepEqual(
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
});

test('customErrorNamesAsync', async (t) => {
  const user = new UserMockup();

  user.property({
    customNamedAsync: 'INVALID',
  });

  await user.validate();
  t.deepEqual(
    {
      customNamedAsync: user.errors.customNamedAsync,
    },
    {
      customNamedAsync: ['custom_customNamedAsyncFunc'],
    },
    'Validating a user with custom validations failing did not put the proper error messages in user.errors.',
  );
});

test('invalidSaveResetsId', async (t) => {
  const user = new UserMockup();

  user.property('name', '');
  try {
    await user.save();
  } catch (e) {
    t.true(e instanceof nohm.ValidationError, 'Unexpected error.');
  } finally {
    t.is(user.id, null, 'The id of an invalid user was not reset properly.');
  }
});

test('skipValidation', async (t) => {
  const user = new UserMockup();

  user.property('name', '');

  try {
    await user.save({ skip_validation_and_unique_indexes: true });
    t.notDeepEqual(
      user.id,
      null,
      'The id of an invalid user with skip_validation was reset.',
    );
  } catch (err) {
    t.fail('The validation has been run even though skip_validation was true.');
  }
});

test('invalid regexp option', async (t) => {
  const model = nohm.model(
    'invalidRegexpOption',
    {
      properties: {
        noRegexp: {
          defaultValue: 'hurgel1234',
          type: 'string',
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
    t.fail('Validation did not throw with an invalid validation regexp');
  } catch (err) {
    t.is(
      err.message,
      'Option for regexp validation was not a RegExp object.',
      'Wrong error thrown',
    );
  }
});

test('ValidationError only has objects for properties with errors', async (t) => {
  const user = new UserMockup();

  user.property('name', '');
  try {
    await user.save();
    t.fail('Succeeded where it should not have.');
  } catch (e) {
    t.true(e instanceof nohm.ValidationError, 'Unexpected error.');
    const errorKeys = Object.keys(e.errors);
    t.deepEqual(
      ['name'],
      errorKeys,
      'ValidationError was not restricted to error keys',
    );
  }
});

test('multiple validation failures produce multiple error entries', async (t) => {
  const user = new UserMockup();

  user.property('email', 'a');
  try {
    await user.save();
    t.fail('Succeeded where it should not have.');
  } catch (e) {
    t.deepEqual(
      ['length', 'email'],
      e.errors.email,
      'ValidationError was not restricted to error keys',
    );
  }
});

test('ValidationError has modelName as property', async (t) => {
  const user = new UserMockup();

  user.property('name', '');
  try {
    await user.save();
    t.fail('Succeeded where it should not have.');
  } catch (e) {
    t.deepEqual(
      e.modelName,
      user.modelName,
      "ValidationError didn't have the right modelName set",
    );
  }
});
