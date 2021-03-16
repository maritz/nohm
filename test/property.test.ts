import test from 'ava';

import { nohm } from '../ts';
import * as args from './testArgs';

test.before(async () => {
  await args.setClient(nohm, args.redis);
});

const userMockup = nohm.model('UserMockup', {
  properties: {
    name: {
      defaultValue: 'test',
      type: 'string',
      unique: true,
      validations: ['notEmpty'],
    },
    visits: {
      index: true,
      type: 'integer',
    },
    email: {
      defaultValue: 'email@email.de',
      type: 'string',
      unique: true,
      validations: ['email'],
    },
    emailOptional: {
      defaultValue: '',
      type: 'string',
      unique: true,
      validations: [
        {
          name: 'email',
          options: {
            optional: true,
          },
        },
      ],
    },
    country: {
      index: true,
      defaultValue: 'Tibet',
      type: 'string',
      validations: ['notEmpty'],
    },
    json: {
      defaultValue: '{}',
      type: 'json',
    },
  },
  idGenerator: 'increment',
});

test('propertyGetter', (t) => {
  const user = new userMockup();

  t.is(typeof user.p, 'function', 'Property getter short p is not available.');

  t.is(
    typeof user.prop,
    'function',
    'Property getter short prop is not available.',
  );

  t.is(typeof user.property, 'function', 'Property getter is not available.');

  t.is(
    user.property('email'),
    'email@email.de',
    'Property getter did not return the correct value for email.',
  );

  t.is(
    user.property('name'),
    'test',
    'Property getter did not return the correct value for name.',
  );

  t.throws(
    () => {
      user.property('hurgelwurz');
    },
    { message: /Invalid property key 'hurgelwurz'\./ },
    'Calling .property() with an undefined key did not throw an error.',
  );

  t.deepEqual(
    user.property('json'),
    {},
    'Property getter did not return the correct value for json.',
  );
});

test('propertySetter', (t) => {
  const user = new userMockup();
  const controlUser = new userMockup();

  t.is(
    user.property('email', 123),
    '',
    'Setting a property did not return the new value that was set (with casting).',
  );

  user.property('email', 'asdasd');
  t.is(
    user.property('email'),
    'asdasd',
    'Setting a property did not actually set the property to the correct value',
  );

  user.property('email', 'test@test.de');
  t.not(
    user.property('email'),
    controlUser.property('email'),
    'Creating a new instance of an Object does not create fresh properties.',
  );

  user.property({
    name: 'objectTest',
    email: 'object@test.de',
  });

  t.is(
    user.property('name'),
    'objectTest',
    'Setting multiple properties by providing one object did not work correctly for the name.',
  );
  t.is(
    user.property('email'),
    'object@test.de',
    'Setting multiple properties by providing one object did not work correctly for the email.',
  );

  user.property('json', {
    test: 1,
  });

  t.is(
    user.property('json').test,
    1,
    'Setting a json property did not work correctly.',
  );
});

test('propertyDiff', (t) => {
  const user = new userMockup();
  const beforeName = user.property('name');
  const afterName = 'hurgelwurz';
  const beforeEmail = user.property('email');
  const afterEmail = 'email.propertyDiff@test';
  const shouldName = [
    {
      key: 'name',
      before: beforeName,
      after: afterName,
    },
  ];
  const shouldMail = [
    {
      key: 'email',
      before: beforeEmail,
      after: afterEmail,
    },
  ];
  const shouldNameAndMail = shouldName.concat(shouldMail);

  t.deepEqual(
    user.propertyDiff(),
    [],
    'Property diff returned changes even though there were none',
  );

  user.property('name', afterName);
  t.deepEqual(
    user.propertyDiff(),
    shouldName,
    'Property diff did not correctly recognize the changed property `name`.',
  );

  user.property('email', afterEmail);
  t.deepEqual(
    user.propertyDiff('name'),
    shouldName,
    'Property diff did not correctly filter for changes only in `name`.',
  );

  t.deepEqual(
    user.propertyDiff(),
    shouldNameAndMail,
    'Property diff did not correctly recognize the changed properties `name` and `email`.',
  );

  user.property('name', beforeName);
  t.deepEqual(
    user.propertyDiff(),
    shouldMail,
    'Property diff did not correctly recognize the reset property `name`.',
  );
});

test('propertyReset', (t) => {
  const user = new userMockup();
  const beforeName = user.property('name');
  const beforeEmail = user.property('email');

  user.property('name', user.property('name') + 'hurgelwurz');
  user.property('email', user.property('email') + 'asdasd');
  user.propertyReset('name');
  t.is(
    user.property('name'),
    beforeName,
    'Property reset did not properly reset `name`.',
  );

  t.not(
    user.property('email'),
    beforeEmail,
    "Property reset reset `email` when it shouldn't have.",
  );

  user.property('name', user.property('name') + 'hurgelwurz');
  user.propertyReset();
  t.true(
    user.property('name') === beforeName &&
      user.property('email') === beforeEmail,
    'Property reset did not properly reset `name` and `email`.',
  );
});

test('allProperties', (t) => {
  const user = new userMockup();

  user.property('name', 'hurgelwurz');
  user.property('email', 'hurgelwurz@test.de');
  const should = {
    name: user.property('name'),
    visits: user.property('visits'),
    email: user.property('email'),
    emailOptional: user.property('emailOptional'),
    country: user.property('country'),
    json: {},
    id: user.id,
  };
  t.deepEqual(should, user.allProperties(), 'Getting all properties failed.');
});
