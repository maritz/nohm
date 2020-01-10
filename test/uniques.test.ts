import test from 'ava';

import { Nohm, nohm } from '../ts';

import * as args from './testArgs';
import { cleanUpPromise } from './helper';
import { exists, get, keys } from '../ts/typed-redis-helper';

const redis = args.redis;

// tslint:disable-next-line:variable-name
const Model = Nohm.model('UniqueTests', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'test',
      unique: true,
      validations: ['notEmpty'],
    },
    visits: {
      type: 'integer',
      index: true,
    },
    email: {
      type: 'string',
      unique: true,
      defaultValue: 'email@email.de',
      validations: ['email'],
    },
    emailOptional: {
      type: 'string',
      unique: true,
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
    country: {
      type: 'string',
      defaultValue: 'Tibet',
      index: true,
      validations: ['notEmpty'],
    },
  },
  idGenerator: 'increment',
});

const prefix = args.prefix + 'unique';

test.before(async (t) => {
  nohm.setPrefix(prefix);
  await args.setClient(nohm, redis);
  await cleanUpPromise(redis, prefix);
});

test.afterEach(async (t) => {
  await cleanUpPromise(redis, prefix);
});

test.serial('unique', async (t) => {
  const instance1 = new Model();
  const instance2 = new Model();

  instance1.property('name', 'duplicateTest');
  instance1.property('email', 'duplicateTest@test.de');
  instance2.property('name', 'duplicateTest');
  instance2.property('email', 'dubplicateTest@test.de'); // intentional typo "dubplicate"
  await instance1.save();
  const uniqueLock1 = await get(
    redis,
    `${prefix}:uniques:${instance1.modelName}:name:duplicatetest`,
  );
  t.truthy(instance1.id, 'User id b0rked while checking uniques');
  t.is(uniqueLock1, instance1.id, 'The unique key did not have the correct id');
  const valid = await instance2.validate();
  t.true(
    !valid,
    'A unique property was not recognized as a duplicate in valid without setDirectly',
  );
  try {
    await instance2.save();
    t.true(
      false,
      'Saving a model with an invalid non-unique property did not throw/reject.',
    );
  } catch (err) {
    t.true(
      err instanceof nohm.ValidationError,
      'A saved unique property was not recognized as a duplicate',
    );
    t.deepEqual(
      err.errors.name,
      ['notUnique'],
      'A saved unique property was not recognized as a duplicate',
    );

    const doesExist = await exists(
      redis,
      `${prefix}:uniques:${instance1.modelName}:email:dubbplicatetest@test.de`,
    );
    t.is(
      doesExist,
      0,
      'The tmp unique lock was not deleted for a failed save.',
    );
    const uniqueLock2 = await get(
      redis,
      `${prefix}:uniques:${instance1.modelName}:name:duplicatetest`,
    );
    t.is(
      uniqueLock2,
      instance1.id,
      'The unique key did not have the correct id after trying to save another unique.',
    );
  }
});

test.serial('unique with lowerLowerCase', async (t) => {
  const instance1 = new Model();
  const instance2 = new Model();

  instance1.property('name', 'LowerCaseTest');
  instance1.property('email', 'LowerCaseTest@test.de');
  instance2.property('name', 'lowercasetest');
  instance2.property('email', 'lowercasetest@test.de');
  await instance1.save();

  const uniqueLock = await get(
    redis,
    `${prefix}:uniques:${instance1.modelName}:name:${instance1
      .property('name')
      .toLowerCase()}`,
  );
  t.is(uniqueLock, instance1.id, 'The unique key did not have the correct id');
  const valid = await instance2.validate();
  t.true(
    !valid,
    'A unique property was not recognized as a duplicate in valid without setDirectly.',
  );
  try {
    await instance2.save();
    t.fail(
      'Saving a model with an invalid non-unique property did not throw/reject.',
    );
  } catch (err) {
    t.true(
      err instanceof nohm.ValidationError,
      'A saved unique property was not recognized as a duplicate',
    );
    const value = await get(
      redis,
      `${prefix}:uniques:${instance1.modelName}:name:lowercasetest`,
    );
    t.is(
      value,
      instance1.id,
      'The unique key did not have the correct id after trying to save another unique.',
    );
  }
});

test.serial(
  'deletes unique lock when a non-unique validation fails',
  async (t) => {
    const instance = new Model();

    instance.property('name', 'uniqueDeleteTest');
    instance.property('email', 'uniqueDeleteTest@test.de');
    instance.property('country', '');
    try {
      await instance.save();
      t.fail('Saving the instance succeeded where it should have failed.');
    } catch (err) {
      t.true(
        err instanceof nohm.ValidationError,
        'There was an unexpected problem: ' + err,
      );
      const value = await exists(
        redis,
        prefix +
          ':uniques:UserMockup:name:' +
          instance.property('name').toLowerCase(),
      );
      t.is(
        value,
        0,
        'The unique was locked although there were errors in the non-unique checks.',
      );
    }
  },
);

test.serial(
  'validate on only one property checks unique properly',
  async (t) => {
    const instance1 = new Model();
    instance1.property('name', 'duplicateTest');
    instance1.property('email', 'duplicateTest@test.de');
    await instance1.save();

    const instance2 = new Model();

    instance2.property('name', 'duplicateTest');
    instance2.property('email', 'duplicateTest@test.de');
    const valid = await instance2.validate('name');
    t.is(valid, false, 'Checking the duplication status failed in valid().');
    t.deepEqual(
      instance2.errors.email,
      [],
      'Checking the duplication status of one property set the error for another one.',
    );
  },
);

test.serial('uniqueDeletion', async (t) => {
  const instance = new Model();

  instance.property({
    name: 'duplicateDeletionTest',
    email: 'duplicateDeletionTest@test.de',
    country: '',
  });

  try {
    await instance.save();
    t.fail('Saving the instance succeeded where it should have failed.');
  } catch (err) {
    const value = await exists(
      redis,
      `${prefix}:uniques:${instance.modelName}:name:duplicateDeletionTest`,
    );
    t.is(
      value,
      0,
      'The tmp unique key was not deleted if a non-unique saving failure occurred.',
    );
  }
});

test.serial('uniques are case INsensitive', async (t) => {
  const instance1 = new Model();
  const instance2 = new Model();

  instance1.property({
    name: 'uniqueCaseInSensitive',
    email: 'uniqueCaseInSensitive@test.de',
  });
  instance2.property({
    name: instance1.property('name').toLowerCase(),
    email: instance1.property('email').toLowerCase(),
  });

  await instance1.save();
  const valid = await instance2.validate();
  t.true(!valid, 'A duplicate (different case) unique property was validated.');
  t.deepEqual(
    instance2.errors.name,
    ['notUnique'],
    'The error for name was not correct.',
  );
  t.deepEqual(
    instance2.errors.email,
    ['notUnique'],
    'The error for email was not correct.',
  );
});

test.serial('uniqueEmpty', async (t) => {
  const instance = new Model();

  const doesExist = await exists(
    redis,
    prefix + ':uniques:UserMockup:emailOptional:',
  );
  t.is(doesExist, 0, 'An empty unique was set before the test for it was run');

  instance.property({
    name: 'emailOptional',
    email: 'emailOptionalTest@test.de',
    emailOptional: '',
  });
  await instance.save();
  const uniqueEmailKeys = await keys(
    redis,
    prefix + ':uniques:UserMockup:emailOptional:',
  );
  t.is(uniqueEmailKeys.length, 0, 'An empty unique was set');
});

test.serial('integer uniques', async (t) => {
  nohm.model('UniqueInteger', {
    properties: {
      unique: {
        type: 'integer',
        unique: true,
      },
    },
  });
  const instance1 = await nohm.factory('UniqueInteger');
  const instance2 = await nohm.factory('UniqueInteger');
  instance1.property('unique', 123);
  instance2.property('unique', 123);

  await instance1.save();
  t.deepEqual(
    instance1.allProperties(),
    {
      unique: 123,
      id: instance1.id,
    },
    'Properties not correct',
  );
  try {
    await instance2.save();
  } catch (err) {
    t.true(
      err instanceof nohm.ValidationError,
      'Unique integer conflict did not result in error.',
    );
    await instance1.remove();
    await t.notThrowsAsync(async () => {
      await instance2.save();
    });
  }
});

test.serial('uniqueDefaultOverwritten', async (t) => {
  const instance1 = new Model();
  const instance2 = new Model();

  await instance1.save();
  try {
    await instance2.save();
    t.fail('Saving succeeded where it should not have.');
  } catch (err) {
    t.true(
      err instanceof nohm.ValidationError,
      'Saving a default unique value did not return with the error "invalid"',
    );
    t.deepEqual(
      instance2.errors.name,
      ['notUnique'],
      'Saving a default unique value returned the wrong error: ' +
        instance2.errors.name,
    );
  }
});

test.serial('removing unique frees unique with uppercase values', async (t) => {
  const instance1 = new Model();
  const instance2 = new Model();
  const old = 'Removing Unique Property Frees The Value';
  instance1.property('name', old);
  instance1.property('email', 'remove_frees@unique.de');

  await instance1.save();
  await instance1.remove();
  instance2.property('name', old);
  await t.notThrowsAsync(async () => {
    return instance2.save();
  });
});

test.serial(
  'changing unique frees old unique with uppercase values',
  async (t) => {
    const obj = new Model();
    const obj2 = new Model();
    const obj3 = new Model();
    const old = 'Changing Unique Property Frees The Value';
    obj.property('name', old);
    obj.property('email', 'change_frees@unique.de');

    await obj.save();
    await obj2.load(obj.id);
    obj2.property(
      'name',
      'changing unique property frees the value to something else',
    );
    await obj2.save();
    await obj3.load(obj.id);
    obj2.property('name', old);
    try {
      obj2.save();
      // test something, so we at least have the resemblance of normal testing here........
      // the way it actually tests whether the uniques are freed is by not throwing errors during save
      t.is(obj2.id, obj3.id, 'Something went wrong');
    } catch (err) {
      t.true(
        !err,
        'Unexpected saving error. (May be because old uniques are not freed properly on change.',
      );
    }
  },
);
