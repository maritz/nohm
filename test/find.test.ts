import anyTest, { TestInterface } from 'ava';
import * as td from 'testdouble';

import { nohm, NohmModel } from '../ts';

import * as args from './testArgs';
import { cleanUpPromise } from './helper';
import { hset } from '../ts/typed-redis-helper';
import * as _ from 'lodash';

const redis = args.redis;

const prefix = args.prefix + 'find';

// tslint:disable-next-line:variable-name
const UserFindMockup = nohm.model('UserFindMockup', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'testName',
      index: true,
      validations: ['notEmpty'],
    },
    email: {
      type: 'string',
      defaultValue: 'testMail@test.de',
      unique: true,
    },
    gender: {
      type: 'string',
    },
    json: {
      type: 'json',
      defaultValue: '{}',
    },
    number: {
      type: 'integer',
      defaultValue: 1,
      index: true,
    },
    number2: {
      type: 'integer',
      defaultValue: 200,
      index: true,
    },
    bool: {
      type: 'bool',
      defaultValue: false,
      index: true,
    },
    numberNonIndexed: {
      type: 'integer',
    },
    customNonIndexed: {
      defaultValue: 4,
      type() {
        return 4;
      },
    },
  },
  idGenerator: 'increment',
});

// tslint:disable-next-line:variable-name
const UserFindNoIncrementMockup = nohm.model('UserFindNoIncrementMockup', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'testName',
      index: true,
      validations: ['notEmpty'],
    },
    number: {
      type: 'integer',
      defaultValue: 1,
      index: true,
    },
  },
});

nohm.model('UniqueIntegerFind', {
  properties: {
    unique: {
      type: 'integer',
      unique: true,
    },
  },
});

const origLogError = nohm.logError;

const createUsers = async <TProps, TModel extends NohmModel<TProps>>(
  props: Array<TProps>,
  modelName = 'UserFindMockup',
): Promise<[Array<TModel>, Array<string>]> => {
  const promises = props.map(async (prop) => {
    const user: TModel = await nohm.factory(modelName);
    user.property(prop);
    await user.save();
    return user;
  });

  const users = await Promise.all(promises);
  const ids = users.map((user) => {
    return user.id;
  });
  return [users, ids];
};

const test = anyTest as TestInterface<{
  users: Array<NohmModel<any>>;
  userIds: Array<string>;
}>;

test.before(async (t) => {
  nohm.setPrefix(prefix);
  await args.setClient(nohm, redis);
});

test.afterEach(async () => {
  await cleanUpPromise(redis, prefix);
  nohm.logError = origLogError;
});

test.beforeEach(async (t) => {
  await cleanUpPromise(redis, prefix);
  const [users, ids] = await createUsers([
    {
      // id: 1
      name: 'numericindextest',
      email: 'numericindextest@hurgel.de',
      gender: 'male',
      number: 3,
      numberNonIndexed: 4,
    },
    {
      // id: 2
      name: 'numericindextest',
      email: 'numericindextest2@hurgel.de',
      gender: 'male',
      number: 4,
      number2: 33,
      numberNonIndexed: 4,
    },
    {
      // id: 3
      name: 'numericindextest',
      email: 'numericindextest3@hurgel.de',
      gender: 'female',
      number: 4,
      number2: 1,
      numberNonIndexed: 1,
    },
    {
      // id: 4
      name: 'uniquefind',
      email: 'uniquefind@hurgel.de',
      numberNonIndexed: 5,
    },
    {
      // id: 5
      name: 'indextest',
      email: 'indextest@hurgel.de',
      numberNonIndexed: 8,
    },
    {
      // id: 6
      name: 'indextest',
      email: 'indextest2@hurgel.de',
      numberNonIndexed: 200,
    },
    {
      // id: 7
      name: 'a_sort_first',
      email: 'a_sort_first@hurgel.de',
      number: 1,
      numberNonIndexed: 0,
    },
    {
      // id: 8
      name: 'z_sort_last',
      email: 'z_sort_last@hurgel.de',
      number: 100000,
      numberNonIndexed: 24.5,
    },
  ]);
  t.context.users = users;
  t.context.userIds = ids;
});

anyTest.serial('load while none exist', async (t) => {
  const user = new UserFindMockup();

  await cleanUpPromise(redis, prefix);
  try {
    await user.load(1);
  } catch (err) {
    t.is(
      err.message,
      'not found',
      'Load() did not return "not found" for id 1 even though there should not be a user yet.',
    );
  }
});

test.serial('load', async (t) => {
  const user = new UserFindMockup();
  const findUser = new UserFindMockup();

  user.property({
    name: 'hurgelwurz',
    email: 'hurgelwurz@hurgel.de',
    json: {
      test: 1,
    },
    bool: 'true',
  });

  await user.save();
  await findUser.load(user.id);
  t.is(
    user.property('name'),
    findUser.property('name'),
    'The loaded version of the name was not the same as a set one.',
  );
  t.is(
    user.property('email'),
    findUser.property('email'),
    'The loaded version of the email was not the same as a set one.',
  );
  t.is(
    findUser.property('json').test,
    1,
    'The loaded version of the json was not the same as the set one.',
  );
  t.is(
    user.id,
    findUser.id,
    'The loaded version of the email was not the same as a set one.',
  );
  t.is(
    findUser.property('bool'),
    true,
    'The loaded version of the boolean was not the same as a set one.',
  );
});

test.serial('findAndLoad', async (t) => {
  const user = new UserFindMockup();
  const user2 = new UserFindMockup();

  user.property({
    name: 'hurgelwurz',
    email: 'hurgelwurz@hurgel.de',
  });
  user2.property({
    name: 'hurgelwurz',
    email: 'hurgelwurz2@hurgel.de',
  });

  await user.save();
  await user2.save();
  const users = await UserFindMockup.findAndLoad({ name: 'hurgelwurz' });

  t.is(users.length, 2, 'The loaded number of users was not 2.');
  t.deepEqual(
    _.sortBy(
      users.map((u) => u.allProperties()),
      ['email'],
    ),
    _.sortBy(
      [user2, user].map((u) => u.allProperties()),
      ['email'],
    ),
  );
});

test.serial('findAndLoadNonExisting', async (t) => {
  const users = await UserFindMockup.findAndLoad({ name: 'hurgelwurz' });
  t.is(users.length, 0, 'The loaded number of users was not 2.');
});

test.serial('findAndLoadAll', async (t) => {
  const users = await UserFindMockup.findAndLoad({});
  t.true(
    Array.isArray(users),
    'The loaded users was not of the expected type (Array).',
  );
  t.is(users.length, 8, 'The loaded number of users was not 8.');
  t.true(
    users[0] instanceof UserFindMockup,
    'The loaded user is not a nohm instance',
  );
});

test.serial('findAll', async (t) => {
  const findUser = new UserFindMockup();

  const ids = await findUser.find();
  ids.sort(); // usually redis returns them first-in-first-out, but not guaranteed
  t.deepEqual(
    t.context.userIds,
    ids,
    'find() did not return all users when not given any search parameters.',
  );
});

test.serial('exists', async (t) => {
  const existsUser = new UserFindMockup();

  t.is(
    await existsUser.exists(1),
    true,
    'Exists() did not return true for id 1.',
  );

  t.is(
    await existsUser.exists(9999999),
    false,
    'Exists() did not return false for id 9999999.',
  );
});

test.serial('findByInvalidSearch', async (t) => {
  const findUser = new UserFindMockup();

  await t.throwsAsync(async () => {
    await findUser.find({
      gender: 'male',
    });
  }, /Trying to search for non-indexed/);
});

test.serial('findByUnique', async (t) => {
  const findUser = new UserFindMockup();
  const userUnique = t.context.users.filter((user) => {
    return user.property('name') === 'uniquefind';
  })[0];

  const ids = await findUser.find({
    email: userUnique.property('email'),
  });
  t.deepEqual(
    ids,
    [userUnique.id],
    'The found id did not match the id of the saved object.',
  );
});

test.serial('findByUniqueOtherCase', async (t) => {
  const findUser = new UserFindMockup();
  const userUnique = t.context.users.filter((user) => {
    return user.property('name') === 'uniquefind';
  })[0];

  const ids = await findUser.find({
    email: userUnique.property('email').toUpperCase(),
  });
  t.deepEqual(
    ids,
    [userUnique.id],
    'The found id did not match the id of the saved object.',
  );
});

test.serial('findByUniqueInvalidSearch', async (t) => {
  const findUser = new UserFindMockup();

  try {
    await findUser.find({
      email: {},
    });
    t.fail('Succeeded where it should not have.');
  } catch (err) {
    t.is(
      0,
      err.message.indexOf('Invalid search parameters'),
      'The found id did not match the id of the saved object.',
    );
  }
});

test.serial('findByIntegerUnique', async (t) => {
  const saveObj = await nohm.factory('UniqueIntegerFind');
  const findObj = await nohm.factory('UniqueIntegerFind');

  saveObj.property('unique', 123);
  await saveObj.save();

  const ids = await findObj.find({
    unique: saveObj.property('unique'),
  });
  t.deepEqual(
    ids,
    [saveObj.id],
    'The found id did not match the id of the saved object.',
  );
});

test.serial('findByStringIndex', async (t) => {
  const findUser = new UserFindMockup();
  const users = t.context.users.filter((user) => {
    return user.property('name') === 'indextest';
  });

  const ids = await findUser.find({
    name: 'indextest',
  });
  t.deepEqual(
    ids,
    [users[0].id, users[1].id],
    'The found id did not match the id of the saved object.',
  );
});

test.serial('findByNumericIndex', async (t) => {
  const findUser = new UserFindMockup();
  const users = t.context.users.filter((user) => {
    return user.property('number') > 2 && user.property('number2') < 100;
  });

  const ids = await findUser.find({
    number: {
      min: 2,
    },
    number2: {
      max: 100,
      limit: 2,
    },
  });
  t.deepEqual(
    ids.sort(),
    [users[0].id, users[1].id].sort(),
    'The found id did not match the id of the saved object.',
  );
});

test.serial('findByMixedIndex', async (t) => {
  const findUser = new UserFindMockup();

  const [users] = await createUsers([
    {
      name: 'mixedindextest',
      email: 'mixedindextest@hurgel.de',
      number: 3,
      number2: 33,
    },
    {
      name: 'mixedindextest',
      email: 'mixedindextest2@hurgel.de',
      number: 4,
      number2: 33,
    },
    {
      name: 'mixedindextestNOT',
      email: 'mixedindextest3@hurgel.de',
      number: 4,
      number2: 1,
    },
    {
      name: 'mixedindextest',
      email: 'mixedindextest4@hurgel.de',
      number: 1,
      number2: 33,
    },
  ]);
  const ids = await findUser.find({
    number: {
      min: 2,
    },
    number2: {
      max: 100,
    },
    name: 'mixedindextest',
  });
  t.deepEqual(
    ids.sort(),
    [users[0].id, users[1].id].sort(),
    'The found id did not match the id of the saved object.',
  );
});

test.serial('findSameNumericTwice', async (t) => {
  const findUser = new UserFindMockup();

  const [, userIds] = await createUsers([
    {
      name: 'SameNumericTwice',
      email: 'SameNumericTwice@hurgel.de',
      number: 3000,
    },
    {
      name: 'SameNumericTwice2',
      email: 'SameNumericTwice2@hurgel.de',
      number: 3000,
    },
  ]);
  userIds.push(t.context.userIds[t.context.userIds.length - 1]);
  t.is(userIds.length, 3, "Didn't create 2 users, instead: " + userIds.length);

  const ids = await findUser.find({
    number: {
      min: 3000,
    },
  });
  t.deepEqual(
    ids.sort(),
    userIds.sort(),
    'The found id did not match the id of the saved objects.',
  );
});

test.serial('findByMixedIndexMissing', async (t) => {
  const findUser = new UserFindMockup();

  await createUsers([
    {
      name: 'mixedindextestMissing',
      email: 'mixedindextestMissing@hurgel.de',
      number: 4,
    },
    {
      name: 'mixedindextestMissing2',
      email: 'mixedindextestMissing2@hurgel.de',
      number: 4,
    },
  ]);
  const ids = await findUser.find({
    number: {
      min: 2,
    },
    name: 'mixedindextASDASDestMISSING',
  });
  t.deepEqual(
    ids,
    [],
    'Ids were found even though the name should not be findable.',
  );
});

test.serial('findNumericWithoutLimit', async (t) => {
  const findUser = new UserFindMockup();

  await Promise.all(
    Array(55)
      .fill(0)
      .map((_value, index) => {
        const user = new UserFindMockup();
        user.property({
          name: 'findNumericWithoutLimit' + index,
          email: 'findNumericWithoutLimit' + index + '@hurgel.de',
          number: index,
        });

        return user.save();
      }),
  );

  const ids = await findUser.find({
    number: {
      min: 1,
      limit: 0,
    },
  });
  t.true(
    ids.length > 54,
    'The limit: 0 option did not return more than 50 ids.',
  );
});

test.serial('findExactNumeric', async (t) => {
  const user = new UserFindMockup();
  const findUser = new UserFindMockup();
  const num = 999876543;

  user.property({
    name: 'findExactNumeric',
    email: 'findExactNumeric@hurgel.de',
    number: num,
  });
  await user.save();
  const ids = await findUser.find({
    number: num,
  });
  t.deepEqual(ids, [user.id], 'Did not find an exact number match');
  const ids2 = await findUser.find({
    number: num - 1,
  });
  t.deepEqual(
    ids2,
    [],
    'Searching for a nonexistant number did not return an empty array.',
  );
});

test.serial('loadReturnsProps', async (t) => {
  const user = new UserFindMockup();
  const findUser = new UserFindMockup();

  user.property({
    name: 'loadReturnsProps',
    email: 'loadReturnsProps@hurgel.de',
    json: {
      test: 1,
    },
  });

  await user.save();
  const props = await findUser.load(user.id);
  const testProps = user.allProperties();
  t.deepEqual(
    props,
    testProps,
    'The loaded properties are not the same as allProperties() (without id).',
  );
});

test.serial('shortForms', async (t) => {
  const shortFormMockup = nohm.model('shortFormMockup', {
    properties: {
      name: {
        type: 'string',
        defaultValue: 'testName',
        index: true,
        validations: ['notEmpty'],
      },
    },
    idGenerator: 'increment',
  });

  const saved = new shortFormMockup();
  saved.property('name', 'shortForm');
  await saved.save();
  const id = saved.id;
  saved.property('name', 'asdasd'); // make sure our comparisons in load aren't bogus
  const loaded = await shortFormMockup.load(id);
  t.is(
    loaded.property('name'),
    'shortForm',
    'The returned instance has some property issues.',
  );
  const ids = await shortFormMockup.find({
    name: 'shortForm',
  });
  t.deepEqual(ids, [id], 'The found ids do not match [id]');
  await shortFormMockup.remove(id);
  const idsAfterRemove = await shortFormMockup.find({
    name: 'shortForm',
  });
  t.deepEqual(
    idsAfterRemove,
    [],
    'Remove did not remove the correct instance. Uh-Oh....',
  );
});

test.serial('uuidLoadFind', async (t) => {
  const uuidMockup = nohm.model('uuidMockup', {
    properties: {
      name: {
        type: 'string',
        defaultValue: 'testName',
        index: true,
        validations: ['notEmpty'],
      },
    },
  });

  const uuidInstance1 = new uuidMockup();
  uuidInstance1.property('name', 'uuid');

  const uuidInstance2 = new uuidMockup();
  uuidInstance2.property('name', 'uuid2');

  await uuidInstance1.save();
  t.true(uuidInstance1.id.length > 0, 'There was no proper id generated');
  await uuidInstance2.save();
  t.true(uuidInstance1.id !== uuidInstance2.id, 'The uuids were the same.... ');
  const loader = new uuidMockup();
  const props = await loader.load(uuidInstance1.id);
  t.is(
    props.name,
    uuidInstance1.property('name'),
    'The loaded properties were not correct.',
  );
  const ids = await new uuidMockup().find({
    name: uuidInstance1.property('name'),
  });
  t.deepEqual([uuidInstance1.id], ids, 'Did not find the correct ids');
});

test.serial('normal string ID find', async (t) => {
  const [, userIds] = await createUsers(
    [
      {},
      {
        name: 'blablub',
      },
    ],
    'UserFindNoIncrementMockup',
  );
  const ids = await new UserFindNoIncrementMockup().find({
    name: 'blablub',
  });
  t.is(
    ids.length,
    1,
    'Did not find the correct number of ids for non-incremental id model.',
  );
  t.is(
    ids[0],
    userIds[1],
    'Did not find the correct id for non-incremental id model.',
  );
});

test.serial("search unique that doesn't exists", async (t) => {
  const instance = await nohm.factory('UserFindMockup');
  const ids = await instance.find({
    email:
      "this_user_email_should_absolutely_not_exist. it's not even a valid email...",
  });
  t.deepEqual(
    [],
    ids,
    "The return of a search that didn't find anything was wrong.",
  );
});

test.serial('sort() - all by name', async (t) => {
  const sortedIds = t.context.users
    .sort((a, b) => {
      a = a.property('name');
      b = b.property('name');
      return a > b ? 1 : a < b ? -1 : 0;
    })
    .map((user) => {
      return '' + user.id;
    });

  const ids = await UserFindMockup.sort({
    field: 'name',
  });
  t.deepEqual(sortedIds, ids, 'Sorting went wrong.');
});

test.serial('sort() - all by name DESC', async (t) => {
  const sortedIds = t.context.users
    .sort((a, b) => {
      a = a.property('name');
      b = b.property('name');
      return a < b ? 1 : a > b ? -1 : 0;
    })
    .map((user) => {
      return '' + user.id;
    });

  const ids = await UserFindMockup.sort({
    field: 'name',
    direction: 'DESC',
  });
  t.deepEqual(sortedIds, ids, 'Sorting went wrong.');
});

test.serial('sort() - all by name LIMIT 2, 3', async (t) => {
  const sortedIds = t.context.users
    .sort((a, b) => {
      a = a.property('name');
      b = b.property('name');
      return a > b ? 1 : a < b ? -1 : 0;
    })
    .slice(2, 5)
    .map((user) => {
      return '' + user.id;
    });

  const ids = await UserFindMockup.sort({
    field: 'name',
    limit: [2, 3],
  });
  t.deepEqual(sortedIds, ids, 'Sorting went wrong.');
});

test.serial('sort() - all by number', async (t) => {
  const sortedIds = t.context.users
    .sort((a, b) => {
      a = a.property('number');
      b = b.property('number');
      return a > b ? 1 : a < b ? -1 : 0;
    })
    .map((user) => {
      return '' + user.id;
    });

  const ids = await UserFindMockup.sort({
    field: 'number',
  });
  t.deepEqual(sortedIds, ids, 'Sorting went wrong.');
});

test.serial('sort() - all by number DESC', async (t) => {
  const sortedIds = t.context.users
    .sort((a, b) => {
      const idSort = a.id < b.id ? 1 : -1;
      a = a.property('number');
      b = b.property('number');
      return a < b ? 1 : a > b ? -1 : idSort;
    })
    .map((user) => {
      return '' + user.id;
    });

  const ids = await UserFindMockup.sort({
    field: 'number',
    direction: 'DESC',
  });
  t.deepEqual(sortedIds, ids, 'Sorting went wrong.');
});

test.serial('sort() - all by number LIMIT 3, 3', async (t) => {
  const sortedIds = t.context.users
    .sort((a, b) => {
      a = a.property('number');
      b = b.property('number');
      return a > b ? 1 : a < b ? -1 : 0;
    })
    .slice(3, 6)
    .map((user) => {
      return '' + user.id;
    });

  const ids = await UserFindMockup.sort({
    field: 'number',
    limit: [3, 3],
  });
  t.deepEqual(sortedIds, ids, 'Sorting went wrong.');
});

test.serial('sort() - provided by name', async (t) => {
  const sortedIds = t.context.users
    .sort((a, b) => {
      a = a.property('name');
      b = b.property('name');
      return a > b ? 1 : a < b ? -1 : 0;
    })
    .map((user) => {
      return '' + user.id;
    });

  const ids = await UserFindMockup.sort(
    {
      field: 'name',
    },
    t.context.userIds,
  );
  t.deepEqual(sortedIds, ids, 'Sorting went wrong.');
});

test.serial('sort() - provided by name DESC', async (t) => {
  const sortedIds = t.context.users
    .sort((a, b) => {
      a = a.property('name');
      b = b.property('name');
      return a < b ? 1 : a > b ? -1 : 0;
    })
    .map((user) => {
      return '' + user.id;
    });

  const ids = await UserFindMockup.sort(
    {
      field: 'name',
      direction: 'DESC',
    },
    t.context.userIds,
  );
  t.deepEqual(sortedIds, ids, 'Sorting went wrong.');
});

test.serial('sort() - provided by name LIMIT 2, 3', async (t) => {
  const sortedIds = t.context.users
    .sort((a, b) => {
      a = a.property('name');
      b = b.property('name');
      return a > b ? 1 : a < b ? -1 : 0;
    })
    .slice(2, 5)
    .map((user) => {
      return '' + user.id;
    });

  const ids = await UserFindMockup.sort(
    {
      field: 'name',
      limit: [2, 3],
    },
    t.context.userIds,
  );
  t.deepEqual(sortedIds, ids, 'Sorting went wrong.');
});

test.serial('sort() - provided by number', async (t) => {
  const sortedIds = t.context.users
    .sort((a, b) => {
      a = a.property('number');
      b = b.property('number');
      return a > b ? 1 : a < b ? -1 : 0;
    })
    .map((user) => {
      return '' + user.id;
    });

  const ids = await UserFindMockup.sort(
    {
      field: 'number',
    },
    t.context.userIds,
  );
  t.deepEqual(sortedIds, ids, 'Sorting went wrong.');
});

test.serial('sort() - provided by number DESC', async (t) => {
  const sortedIds = t.context.users
    .sort((a, b) => {
      const idSort = a.id < b.id ? 1 : -1;
      a = a.property('number');
      b = b.property('number');
      return a < b ? 1 : a > b ? -1 : idSort;
    })
    .map((user) => {
      return '' + user.id;
    });

  const ids = await UserFindMockup.sort(
    {
      field: 'number',
      direction: 'DESC',
    },
    t.context.userIds,
  );
  t.deepEqual(sortedIds, ids, 'Sorting went wrong.');
});

test.serial('sort() - provided by number LIMIT 3, 3', async (t) => {
  const sortedIds = t.context.users
    .sort((a, b) => {
      a = a.property('number');
      b = b.property('number');
      return a > b ? 1 : a < b ? -1 : 0;
    })
    .slice(3, 6)
    .map((user) => {
      return '' + user.id;
    });

  const ids = await UserFindMockup.sort(
    {
      field: 'number',
      limit: [3, 3],
    },
    t.context.userIds,
  );
  t.deepEqual(sortedIds, ids, 'Sorting went wrong.');
});

test.serial('sort() - provided empty list', async (t) => {
  const ids = await UserFindMockup.sort(
    {
      field: 'number',
      limit: [0, 10],
    },
    [],
  );
  t.is(0, ids.length, 'Sorting went wrong when ids.length is 0.');
});

test.serial('sort() - non-indexed non-string property', async (t) => {
  const sortedIds = t.context.users
    .sort((a, b) => {
      a = a.property('numberNonIndexed');
      b = b.property('numberNonIndexed');
      return a > b ? 1 : a < b ? -1 : 0;
    })
    .map((user) => {
      return '' + user.id;
    });

  const ids = await UserFindMockup.sort(
    {
      field: 'numberNonIndexed',
    },
    t.context.userIds,
  );
  t.deepEqual(sortedIds, ids, 'Sorting non-indexed number field went wrong.');
});

test.serial('sort() - non-indexed custom type property', async (t) => {
  const sortedIds = t.context.users
    .sort((a, b) => {
      a = a.property('customNonIndexed');
      b = b.property('customNonIndexed');
      return a > b ? 1 : a < b ? -1 : 0;
    })
    .map((user) => {
      return '' + user.id;
    });

  const ids = await UserFindMockup.sort(
    {
      field: 'customNonIndexed',
    },
    t.context.userIds,
  );
  t.deepEqual(
    sortedIds,
    ids,
    'Sorting non-indexed custom type field went wrong.',
  );
});

test.serial('sort() - load hash with extra properties', async (t) => {
  const user = new UserFindMockup();
  const findUser = new UserFindMockup();

  // plan because we have an async test in the logError replacement.
  t.plan(6);

  user.property({
    name: 'hurgelwurz',
    email: 'hurgelwurz@hurgel.de',
    json: {
      test: 1,
    },
  });

  const badProperty = 'not_a_real_property';

  await user.save();

  // manually changing the db stored hash
  await hset(
    redis,
    nohm.prefix.hash + findUser.modelName + ':' + user.id,
    badProperty,
    'something... :-)',
  );

  nohm.logError = (errMessage) => {
    t.is(
      errMessage,
      `A hash in the DB contained a key '${badProperty}' that is not in the model definition. This might be because of model changes or database corruption/intrusion.`,
      'The error logged for the wrong property key was wrong.',
    );
  };
  await findUser.load(user.id);
  t.is(
    user.property('name'),
    findUser.property('name'),
    'The loaded version of the name was not the same as a set one.',
  );
  t.is(
    user.property('email'),
    findUser.property('email'),
    'The loaded version of the email was not the same as a set one.',
  );
  t.is(
    findUser.property('json').test,
    1,
    'The loaded version of the json was not the same as the set one.',
  );
  t.is(
    user.id,
    findUser.id,
    'The loaded version of the email was not the same as a set one.',
  );
  t.is(
    user.property('bool'),
    false,
    'The loaded version of the boolean was not the same as a set one.',
  );
});

test.serial(
  'sort() - descending order through higher min than max',
  async (t) => {
    const ids = await UserFindMockup.find({
      number: {
        min: 3,
        max: '-inf',
      },
    });
    t.deepEqual(
      ['1', '7', '6', '5', '4'],
      ids,
      'Searching when min>max condition(ZREVRANGEBYSCORE) is invalid.',
    );
  },
);

test.serial(
  'sort() - descending order through higher min than max with limit 2',
  async (t) => {
    // should produce lexical ordering for the second value which should be 7 (due)

    const ids = await UserFindMockup.find({
      number: {
        min: 3,
        max: '-inf',
        limit: 2,
      },
    });
    t.deepEqual(
      ['1', '7'],
      ids,
      'Searching when min>max condition(ZREVRANGEBYSCORE) with limit is invalid.',
    );
  },
);

test.serial('sort() - endpoints exclude left', async (t) => {
  const ids = await UserFindMockup.find({
    number: {
      min: 3,
      max: 1,
      endpoints: '(]',
    },
  });
  t.deepEqual(['7', '6', '5', '4'], ids, 'Defining an endpoint failed.');
});

test.serial('sort() - endpoints exclude right', async (t) => {
  const ids = await UserFindMockup.find({
    number: {
      min: 3,
      max: 1,
      endpoints: '[)',
    },
  });
  t.deepEqual(['1'], ids, 'Defining an endpoint failed.');
});

test.serial('sort() - endpoints exclude both', async (t) => {
  const ids = await UserFindMockup.find({
    number: {
      min: 3,
      max: 1,
      endpoints: '()',
    },
  });
  t.deepEqual([], ids, 'Defining an endpoint failed.');
});

test.serial('sort() - endpoints only specify one', async (t) => {
  const ids = await UserFindMockup.find({
    number: {
      min: 3,
      max: 1,
      endpoints: '(',
    },
  });
  t.deepEqual(
    ['7', '6', '5', '4'],
    ids,
    'Defining only the left endpoint failed.',
  );
  const ids2 = await UserFindMockup.find({
    number: {
      min: 3,
      max: 1,
      endpoints: ')',
    },
  });
  t.deepEqual(['1'], ids2, 'Defining only the right endpoint failed.');
});

test.serial(
  'sort() - find numeric options parsing and defaulting',
  async (t) => {
    const warnDouble = td.replace(global.console, 'warn');
    try {
      await UserFindMockup.find({
        // @ts-ignore - intentionally calling it with wrong parameters
        number: {
          min: '1',
          max: 'not a number',
          offset: [1],
          limit() {
            return 'Nope, not a number either.';
          },
          endpoints: '(',
        },
      });
      t.fail('Succeeded where it should not have.');
    } catch (err) {
      if (process.env.NOHM_TEST_IOREDIS !== 'true') {
        td.verify(
          warnDouble,
          warnDouble(
            'node_redis:',
            `Deprecated: The ZRANGEBYSCORE command contains a argument of type Array.
This is converted to "1" by using .toString() now and will return an error from v.3.0 on.
Please handle this in your code to make sure everything works as you intended it to.`,
          ),
        );
      }
      t.is(
        err.message,
        'ERR min or max is not a float',
        "Invalid or parseAble find options didn't throw an error.",
      );
    }
  },
);

test.serial('sort() - find numeric with offset and limit', async (t) => {
  const ids = await UserFindMockup.find({
    number: {
      min: 1,
      limit: 3,
      offset: 2,
    },
  });
  t.deepEqual(ids, ['6', '7', '1'], 'The found ids were incorrect.');
});

test.serial(
  'find numeric with offset and limit were the offset reduces the set below the limit',
  async (t) => {
    const findUser = new UserFindMockup();

    const ids = await findUser.find({
      number: {
        min: 1,
        limit: 3,
        offset: 6,
      },
    });
    t.deepEqual(ids, ['3', '8'], 'The found ids were incorrect.');
  },
);

test.serial('sort() - find numeric with offset without limit', async (t) => {
  const findUser = new UserFindMockup();

  const ids = await findUser.find({
    number: {
      min: 1,
      offset: 5,
    },
  });
  t.deepEqual(ids, ['2', '3', '8'], 'The found ids were incorrect.');
});

test.serial('sort() - find bool with true', async (t) => {
  const findUser = new UserFindMockup();

  const ids = await findUser.find({
    bool: true,
  });
  t.deepEqual(ids, [], 'Found ids even though none should exist.');

  const user = new UserFindMockup();
  user.property({
    name: 'findBoolTrue',
    email: 'findBoolTrue@example.com',
    bool: true,
  });
  await user.save();

  const ids2 = await findUser.find({
    bool: true,
  });
  t.deepEqual(ids2, [user.id], 'The found ids were incorrect.');
});

test.serial('sort() - find bool with false', async (t) => {
  const findUser = new UserFindMockup();

  const ids = await findUser.find({
    bool: false,
  });
  t.deepEqual(ids, t.context.userIds, 'The found ids were incorrect.');
});
