// tslint:disable-next-line:no-implicit-dependencies
import test from 'ava';

import * as _ from 'lodash';
// tslint:disable-next-line:no-implicit-dependencies
import * as async from 'async';

import * as args from './testArgs.js';
import { cleanUpPromise } from './helper';

import { hgetall, keys, sismember, zscore } from '../ts/typed-redis-helper';

// to make prefixes per-file separate we add the filename
const prefix = args.prefix + 'feature';

import { Nohm, NohmModel } from '../ts';

const nohm = Nohm;

// real tests start in 3.. 2.. 1.. NOW!
const redis = args.redis;

test.before((t) => {
  nohm.setPrefix(prefix);
});

test.afterEach(async (t) => {
  await cleanUpPromise(redis, prefix);
});

// tslint:disable-next-line:variable-name
const UserMockup = Nohm.model('UserMockup', {
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
    json: {
      type: 'json',
      defaultValue: '{}',
    },
  },
  idGenerator: 'increment',
});

nohm.model('NonIncrement', {
  properties: {
    name: {
      type: 'string',
    },
  },
});

test.serial(
  'creating models with and without a redis client set',
  async (t) => {
    nohm.client = null;
    t.throws(
      () => {
        // tslint:disable-next-line:no-unused-expression
        new UserMockup();
      },
      /No redis client/,
      'Creating a model without having a redis client set did not throw an error.',
    );
    await args.setClient(nohm, redis); // this waits until the connection is ready before setting the client

    t.notThrows(() => {
      // tslint:disable-next-line:no-unused-expression
      new UserMockup();
    }, 'Creating a model with a redis client set threw an error.');
  },
);

test.serial('setPrefix', (t) => {
  const oldPrefix = nohm.prefix;

  nohm.setPrefix('hurgel');
  t.snapshot(nohm.prefix, 'Setting a custom prefix did not work as expected');

  nohm.prefix = oldPrefix;
});

test.serial('create a new instance', async (t) => {
  const user = new UserMockup();

  user.property('name', 'createTest');
  user.property('email', 'createTest@asdasd.de');

  await t.notThrowsAsync(async () => {
    await user.save();
  }, 'Creating a user did not work.:' + user.errors);

  const value = await hgetall(
    nohm.client,
    prefix + ':hash:UserMockup:' + user.id,
  );
  t.true(
    value.name.toString() === 'createTest',
    'The user name was not saved properly',
  );
  t.true(
    value.visits.toString() === '0',
    'The user visits were not saved properly',
  );
  t.true(
    value.email.toString() === 'createTest@asdasd.de',
    'The user email was not saved properly',
  );
});

test.serial('remove', async (t) => {
  const user = new UserMockup();
  let testExists;

  testExists = (what, key, callback) => {
    redis.exists(key, (err, value) => {
      t.true(!err, 'There was a redis error in the remove test check.');
      t.true(
        value === 0,
        'Deleting a user did not work: ' + what + ', key: ' + key,
      );
      callback();
    });
  };

  user.property('name', 'deleteTest');
  user.property('email', 'deleteTest@asdasd.de');
  await user.save();

  const id = user.id;
  await user.remove();

  t.is(
    user.id,
    null,
    'Removing an object from the db did not set the id to null',
  );
  return new Promise<void>((resolve, reject) => {
    async.series(
      [
        (callback) => {
          testExists('hashes', prefix + ':hash:UserMockup:' + id, callback);
        },
        (callback) => {
          redis.sismember(
            prefix + ':index:UserMockup:name:' + user.property('name'),
            id,
            (err, value) => {
              t.true(
                err === null && value === 0,
                'Deleting a model did not properly delete the normal index.',
              );
              callback();
            },
          );
        },
        (callback) => {
          redis.zscore(
            prefix + ':scoredindex:UserMockup:visits',
            id,
            (err, value) => {
              t.true(
                err === null && value === null,
                'Deleting a model did not properly delete the scored index.',
              );
              callback();
            },
          );
        },
        (callback) => {
          testExists(
            'uniques',
            prefix + ':uniques:UserMockup:name:' + user.property('name'),
            callback,
          );
        },
      ],
      (err: any) => {
        if (err) {
          return reject(err);
        } else {
          resolve();
        }
      },
    );
  });
});

test.serial('idSets', async (t) => {
  const user = new UserMockup();
  let tempId = '';
  user.property('name', 'idSetTest');

  await user.save();
  tempId = user.id;
  const value = await sismember(
    user.client,
    prefix + ':idsets:' + user.modelName,
    tempId,
  );
  t.is(value, 1, 'The userid was not part of the idset after saving.');
  await user.remove();
  const valueAfter = await sismember(
    user.client,
    prefix + ':idsets:' + user.modelName,
    tempId,
  );
  t.is(valueAfter, 0, 'The userid was still part of the idset after removing.');
});

test.serial('update', async (t) => {
  const user = new UserMockup();

  user.property('name', 'updateTest1');
  user.property('email', 'updateTest1@email.de');
  await user.save();
  user.property('name', 'updateTest2');
  user.property('email', 'updateTest2@email.de');
  await user.save();
  const value = await hgetall(
    user.client,
    prefix + ':hash:UserMockup:' + user.id,
  );
  t.true(
    value.name.toString() === 'updateTest2',
    'The user name was not updated properly',
  );
  t.true(
    value.email.toString() === 'updateTest2@email.de',
    'The user email was not updated properly',
  );
});

test.serial('indexes', async (t) => {
  const user = new UserMockup();

  user.property('name', 'indexTest');
  user.property('email', 'indexTest@test.de');
  user.property('country', 'indexTestCountry');
  user.property('visits', 20);

  await user.save();
  const countryIndex = await sismember(
    redis,
    prefix + ':index:UserMockup:country:indexTestCountry',
    user.id,
  );
  t.is(
    countryIndex.toString(),
    user.id,
    'The country index did not have the user as one of its ids.',
  );

  const visitsScore = await zscore(
    redis,
    prefix + ':scoredindex:UserMockup:visits',
    user.id,
  );
  t.is(
    visitsScore,
    user.property('visits'),
    'The visits index did not have the correct score.',
  );

  const visitsIndex = await sismember(
    redis,
    prefix + ':index:UserMockup:visits:' + user.property('visits'),
    user.id,
  );
  t.is(
    visitsIndex.toString(),
    user.id,
    'The visits index did not have the user as one of its ids.',
  );
});

test.serial('__updated internal property is updated correctly', async (t) => {
  const user = new UserMockup();
  await user.save();
  user.property('name', 'hurgelwurz');
  t.true(
    // @ts-ignore properties is an internal property
    user.properties.get('name').__updated === true,
    '__updated was not ser on property `name`.',
  );
  user.property('name', 'test');
  t.true(
    // @ts-ignore properties is an internal property
    user.properties.get('name').__updated === false,
    "Changing a var manually to the original didn't reset the internal __updated var",
  );
  await user.remove();

  const user2 = new UserMockup();
  user2.property('name', 'hurgelwurz');
  user2.propertyReset();
  t.true(
    // @ts-ignore properties is an internal property
    user2.properties.get('name').__updated === false,
    "Changing a var by propertyReset to the original didn't reset the internal __updated var",
  );
});

test.serial("delete with id that doesn't exist", async (t) => {
  const user = new UserMockup();
  user.id = '987654321';

  await t.throwsAsync(async () => {
    return user.remove();
  }, 'not found');
});

test.serial(
  'allProperties with JSON produces same as property()',
  async (t) => {
    const user = new UserMockup();
    user.property('json', { test: 1 });
    user.property({
      name: 'allPropertiesJson',
      email: 'allPropertiesJson@test.de',
    });

    await user.save();
    const testProps = user.allProperties();
    t.deepEqual(
      testProps.json,
      user.property('json'),
      'allProperties did not properly parse json properties',
    );
  },
);

/*
// TODO: Check which (if any) of these need to be re-enabled
test.serial('thisInCallbacks', async (t) => {
  const user = new UserMockup();
  let checkCounter = 0;
  const checkSum = 11;
  var checkThis = function (name, cb) {
    return function () {
      checkCounter++;
      t.true(this instanceof UserMockup, '`this` is not set to the instance in ' + name);
      if (checkCounter === checkSum) {
        done();
      } else if (typeof (cb) === 'function') {
        cb();
      }
    };
  };
  t.plan(checkSum + 1);

  var done = function () {
    user.remove(checkThis('remove', function () {
      t.end();
    }));
  };

  user.save(checkThis('createError', function () {
    user.property({
      name: 'thisInCallbacks',
      email: 'thisInCallbacks@test.de'
    });
    user.link(user, checkThis('link'));
    user.save(checkThis('create', function () {
      user.load(user.id, checkThis('load'));
      user.find({ name: 'thisInCallbacks' }, checkThis('find'));
      user.save(checkThis('update', function () {
        user.property('email', 'asd');
        user.save(checkThis('updateError'));
      }));
      user.belongsTo(user, checkThis('belongsTo'));
      user.getAll('UserMockup', checkThis('getAll'));
      user.numLinks('UserMockup', checkThis('numLinks'));
      user.unlinkAll(null, checkThis('unlinkAll'));
    }));
  }));
});
*/

test.serial.cb('defaultAsFunction', (t) => {
  // tslint:disable-next-line:variable-name
  const TestMockup = nohm.model('TestMockup', {
    properties: {
      time: {
        type: 'timestamp',
        defaultValue: () => {
          return +new Date();
        },
      },
    },
  });
  const test1 = new TestMockup();
  setTimeout(() => {
    const test2 = new TestMockup();

    t.true(
      typeof test1.property('time') === 'string',
      'time of test1 is not a string',
    );
    t.true(
      typeof test2.property('time') === 'string',
      'time of test2 is not a string',
    );
    t.true(
      test1.property('time') < test2.property('time'),
      'time of test2 is not lower than test1',
    );
    t.end();
  }, 10);
});

test.serial('defaultIdGeneration', async (t) => {
  // tslint:disable-next-line:variable-name
  const TestMockup = nohm.model('TestMockup', {
    properties: {
      name: {
        type: 'string',
        defaultValue: 'defaultIdGeneration',
      },
    },
  });
  const test1 = new TestMockup();
  await test1.save();
  t.is(typeof test1.id, 'string', 'The generated id was not a string');
});

/*
 * TODO: Check if this is reasonably possible. Problem is awaiting the constructor is not supported.
 test.serial('instanceLoad', async (t) => {
   t.plan(1);
   new UserMockup(1123123, function (err) {
     t.is(err, 'not found', 'Instantiating a user with an id and callback did not try to load it');
     t.end();
    });
  };
  */

test.serial('factory', async (t) => {
  t.plan(3);
  const name = 'UserMockup';
  const user = await nohm.factory(name);
  t.is(
    user.modelName,
    name,
    'Using the factory to get an instance did not work.',
  );

  try {
    await nohm.factory(name, 1234124235);
  } catch (err) {
    t.is(
      err.message,
      'not found',
      'Instantiating a user via factory with an id and callback did not try to load it',
    );
  }
  const nonExistingModelName = 'doesnt exist';
  try {
    await nohm.factory(nonExistingModelName, 1234124235);
  } catch (err) {
    t.is(
      err.message,
      `Model '${nonExistingModelName}' not found.`,
      'Instantiating a user via factory with an id and callback did not try to load it',
    );
  }
});

test.serial('factory with non-integer id', async (t) => {
  const name = 'NonIncrement';
  const obj = await nohm.factory(name);
  obj.property('name', 'factory_non_integer_load');
  await obj.save();

  const obj2 = await nohm.factory(name, obj.id);
  t.deepEqual(
    obj2.allProperties(),
    obj.allProperties(),
    'The loaded object seems to have wrong properties',
  );
});

test.serial.cb('purgeDB', (t) => {
  t.plan(4);

  // TODO: refactor this mess
  const countKeys = (
    countPrefix: string,
    callback: (err: Error, count: number) => void,
  ) => {
    redis.keys(countPrefix + '*', (err, keysFound) => {
      callback(err, keysFound.length);
    });
  };

  const tests = [];
  Object.keys(nohm.prefix).forEach((key) => {
    if (typeof nohm.prefix[key] === 'object') {
      Object.keys(nohm.prefix[key]).forEach((innerKey) => {
        tests.push(async.apply(countKeys, nohm.prefix[key][innerKey]));
      });
    } else {
      tests.push(async.apply(countKeys, nohm.prefix[key]));
    }
  });

  // make sure we have some keys by first saving a model and then counting keys. then we purge and count again.
  const user = new UserMockup();
  user.save().then(
    () => {
      async.series(tests, (err, numArr) => {
        t.true(!err, 'Unexpected redis error');
        const countBefore = numArr.reduce((num: number, add: number) => {
          return num + add;
        }, 0);
        t.true(
          countBefore > 0,
          'Database did not have any keys before purgeDb call',
        );
        nohm.purgeDb().then(() => {
          async.series(tests, (errInner, numArrInner) => {
            t.true(!errInner, 'Unexpected redis error');
            const countAfter = numArrInner.reduce(
              (num: number, add: number) => {
                return num + add;
              },
              0,
            );
            t.is(countAfter, 0, 'Database did have keys left after purging.');
            t.end();
          });
        }, t.fail);
      });
    },
    (err) => {
      t.fail(err);
    },
  );
});

test.serial('no key left behind', async (t) => {
  const user = await nohm.factory('UserMockup');
  const user2 = await nohm.factory('UserMockup');

  user2.property({
    name: 'user2',
    email: 'user2@test.com',
  });

  user.link(user2);
  user2.link(user, 'father');

  await cleanUpPromise(redis, args.prefix);
  const remainingKeys = await keys(redis, prefix + ':*');

  // at this point only meta info should be stored
  t.is(remainingKeys.length, 0, 'Not all keys were removed before tests');

  await user.save();
  await user2.save();
  user.unlink(user2);
  await user2.save();
  await user2.remove();
  await user.remove();

  const remainingKeys2 = await keys(redis, prefix + ':*');
  // we keep the idsets and meta keys (version, idgenerator and properties), so it should be 4 here.
  t.is(remainingKeys2.length, 4, 'Not all keys were removed from the database');
});

test.serial('temporary model definitions', async (t) => {
  const user = await nohm.factory('UserMockup');

  // new temporary model definition with same name
  // tslint:disable-next-line:variable-name
  const TempUserMockup = nohm.model(
    'UserMockup',
    {
      properties: {
        well_shit: {
          type: 'string',
        },
      },
    },
    true,
  );
  const newUser = new TempUserMockup();

  const user2 = await nohm.factory('UserMockup');

  t.deepEqual(user.allProperties(), user2.allProperties(), 'HURASDASF');
  t.notDeepEqual(user.allProperties(), newUser.allProperties(), 'HURASDASF');
});

test.serial(
  'changing unique frees old unique with uppercase values',
  async (t) => {
    const obj = await nohm.factory('UserMockup');
    const obj2 = await nohm.factory('UserMockup');
    const obj3 = await nohm.factory('UserMockup');
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

test.serial('register nohm model via ES6 class definition', async (t) => {
  class ClassModel extends NohmModel {}
  // @ts-ignore - in typescript you would just use static properties
  ClassModel.modelName = 'ClassModel';
  // @ts-ignore
  ClassModel.definitions = {
    name: {
      type: 'string',
      unique: true,
    },
  };

  // @ts-ignore
  // tslint:disable-next-line:variable-name
  const ModelCtor = nohm.register(ClassModel);
  const instance = new ModelCtor();
  const factoryInstance = await nohm.factory('ClassModel');

  t.is(
    instance.id,
    null,
    'Created model does not have null as id before saving',
  );

  t.is(
    typeof ModelCtor.findAndLoad,
    'function',
    'Created model class does not have static findAndLoad().',
  );
  t.is(
    factoryInstance.modelName,
    'ClassModel',
    'Created factory model does not have the correct modelName.',
  );
  t.is(
    instance.modelName,
    'ClassModel',
    'Created model does not have the correct modelName.',
  );

  instance.property('name', 'registerES6Test');
  await instance.save();
  t.not(instance.id, null, 'Created model does not have an id after saving.');

  const staticLoad = await ModelCtor.load(instance.id);
  t.deepEqual(
    staticLoad.allProperties(),
    instance.allProperties(),
    'register().load failed.',
  );

  const staticSort = await ModelCtor.sort({ field: 'name' }, [instance.id]);
  t.deepEqual(staticSort, [instance.id], 'register().sort failed.');

  const staticFind = await ModelCtor.find({
    name: instance.property('name'),
  });
  t.deepEqual(staticFind, [instance.id], 'register().find failed.');

  let staticFindAndLoad = await ModelCtor.findAndLoad({
    name: instance.property('name'),
  });
  t.deepEqual(
    staticFindAndLoad[0].allProperties(),
    instance.allProperties(),
    'register().findAndLoad failed.',
  );

  staticFindAndLoad = await ModelCtor.remove(instance.id);
  t.is(staticFindAndLoad, undefined, 'register().findAndLoad failed.');

  staticFindAndLoad = await ModelCtor.findAndLoad({
    name: instance.property('name'),
  });
  t.deepEqual(
    staticFindAndLoad,
    [],
    'register().findAndLoad after remove failed.',
  );
});

test.serial('return value of .property() with object', async (t) => {
  const user = new UserMockup();

  const object = {
    name: 'propertyWithObjectReturn',
    email: 'propertyWithObjectReturn@test.de',
    visits: '1',
  };

  const properties = user.property(object);

  const compareObject = {
    name: object.name,
    email: object.email,
    visits: 1,
  };
  t.deepEqual(
    compareObject,
    properties,
    'The returned properties were not correct.',
  );
});

test.serial('id always stringified', async (t) => {
  const user = new UserMockup();

  t.is(user.id, null, 'Base state of id is not null');
  user.id = 'asd';
  t.is(user.id, 'asd', 'Basic string setter failed');
  // @ts-ignore - specifically testing the wrong input type
  user.id = 213;
  t.is(user.id, '213', 'Casting string setter failed');
});

test.serial('isLoaded', async (t) => {
  let user = await nohm.factory('NonIncrement');
  user.property('name', 'isLoadedUser');

  t.is(user.isLoaded, false, 'isLoaded true in base state.');
  user.id = 'asd';
  t.is(user.isLoaded, false, 'isLoaded true after setting manual id');
  await user.save();
  t.is(user.isLoaded, true, 'isLoaded true after setting manual id');
  const id = user.id;
  user = null;

  const loadUser = await nohm.factory('NonIncrement');
  t.is(loadUser.isLoaded, false, 'isLoaded true in base state on loadUser.');
  await loadUser.load(id);
  t.is(loadUser.isLoaded, true, 'isLoaded false after load()');
  loadUser.id = 'asdasd';
  t.is(
    loadUser.isLoaded,
    false,
    'isLoaded true after setting manual id on loaded user',
  );
});

test.serial('isDirty', async (t) => {
  const user = await nohm.factory('UserMockup');
  const other = await nohm.factory('NonIncrement');

  t.is(user.isDirty, false, 'user.isDirty true in base state.');
  t.is(other.isDirty, false, 'other.isDirty true in base state.');

  other.link(user);
  t.is(user.isDirty, false, 'user.isDirty true after other.link(user).');
  t.is(other.isDirty, true, 'other.isDirty false after other.link(user).');

  user.property('name', 'isDirtyUser');
  t.is(user.isDirty, true, 'user.isDirty false after first edit.');
  user.property('email', 'isDirtyUser@test.de');
  t.is(user.isDirty, true, 'user.isDirty false after second.');

  await other.save();
  t.is(user.isDirty, false, 'user.isDirty true after saving.');
  t.is(other.isDirty, false, 'other.isDirty true after saving.');

  user.id = user.id;
  t.is(user.isDirty, false, 'user.isDirty true after same id change.');

  t.not(other.id, 'new_id', 'other.id was already test value Oo');
  other.id = 'new_id';
  t.is(other.id, 'new_id', 'other.id change failed.');
  t.is(other.isDirty, true, 'other.isDirty false after id change.');

  const loadUser = await nohm.factory('UserMockup');
  await loadUser.load(user.id);
  t.is(loadUser.isDirty, false, 'loadUser.isDirty was true after load()');
});

test.serial('create-only failure attempt without load_pure', async (t) => {
  nohm.model('withoutLoadPureCreateOnlyModel', {
    properties: {
      createdAt: {
        defaultValue: () => Date.now() + ':' + Math.random(),
        type: (_a, _b, oldValue) => oldValue, // never change the value after creation
      },
    },
  });

  const loadPure = await nohm.factory('withoutLoadPureCreateOnlyModel');
  const initialValue = loadPure.property('createdAt');
  loadPure.property('createdAt', 'asdasd');

  t.is(
    loadPure.property('createdAt'),
    initialValue,
    'Behavior failed to prevent property change',
  );

  await loadPure.save();
  const controlLoadPure = await nohm.factory('withoutLoadPureCreateOnlyModel');
  await controlLoadPure.load(loadPure.id);

  t.not(
    controlLoadPure.property('createdAt'),
    initialValue,
    'create-only loading produced non-cast value (should only happen with load_pure)',
  );
});

test.serial('loadPure', async (t) => {
  nohm.model('loadPureModel', {
    properties: {
      incrementOnChange: {
        defaultValue: 0,
        load_pure: true,
        type() {
          return (
            1 + parseInt(this.property('incrementOnChange'), 10)
          ).toString();
        },
      },
      createdAt: {
        defaultValue: () => Date.now() + ':' + Math.random(),
        load_pure: true,
        type: (_a, _b, oldValue) => oldValue, // never change the value after creation
      },
    },
  });

  const loadPure = await nohm.factory('loadPureModel');
  const initialCreatedAt = loadPure.property('createdAt');
  loadPure.property('createdAt', 'asdasd');
  loadPure.property('incrementOnChange', 'asdasd');
  loadPure.property('incrementOnChange', 'asdasd');
  const incrementedTwice = '2';

  t.is(
    loadPure.property('incrementOnChange'),
    incrementedTwice,
    'incrementedTwice change did not work',
  );
  t.is(
    loadPure.property('createdAt'),
    initialCreatedAt,
    'Behavior failed to prevent property change',
  );

  await loadPure.save();
  const controlLoadPure = await nohm.factory('loadPureModel');
  await controlLoadPure.load(loadPure.id);
  t.is(
    controlLoadPure.property('incrementOnChange'),
    incrementedTwice,
    'incrementedTwice was changed during load',
  );
  t.is(
    controlLoadPure.property('createdAt'),
    initialCreatedAt,
    'create-only loading produced typecast value',
  );
});

test.serial('allProperties() cache is reset on propertyReset()', async (t) => {
  const user = await nohm.factory('UserMockup');
  const name = 'allPropertyCacheEmpty';
  const email = 'allPropertyCacheEmpty@test.de';
  user.property({
    name,
    email,
  });
  const allProps = user.allProperties();
  user.propertyReset();

  t.not(user.property('name'), name, 'Name was not reset.');
  t.is(allProps.name, name, 'Name was reset in  test object.');

  const controlAllProps = user.allProperties();
  t.notDeepEqual(
    allProps,
    controlAllProps,
    'allProperties cache was not reset properly',
  );
});

test.serial('id with : should fail', async (t) => {
  const wrongIdModel = nohm.model(
    'wrongIdModel',
    {
      properties: {
        name: {
          type: 'string',
        },
      },
      idGenerator: () => {
        return 'foo:bar';
      },
    },
    true,
  );

  const instance = new wrongIdModel();

  try {
    await instance.save();
  } catch (e) {
    t.is(
      e.message,
      'Nohm IDs cannot contain the character ":". Please change your idGenerator!',
      'Error thrown by wrong id was wrong.',
    );
  }
});

test.serial(
  'manually setting id should allow saving with uniques',
  async (t) => {
    // see https://github.com/maritz/nohm/issues/82 for details

    const props = {
      name: 'manualIdWithuniques',
      email: 'manualIdWithuniques@example.com',
    };

    const origInstance = new UserMockup();
    origInstance.property(props);
    await origInstance.save();

    const instance = new UserMockup();
    instance.id = origInstance.id;
    instance.property(props);

    await t.notThrowsAsync(async () => {
      return instance.save();
    });
  },
);

test.serial('helpers.checkEqual generic tests', (t) => {
  const checkEqual = require('../tsOut/helpers').checkEqual;

  t.is(checkEqual(false, true), false, 'false, true');
  t.is(checkEqual(true, false), false, 'true, false');
  t.true(checkEqual(true, true), 'true, true');
  t.true(checkEqual(false, false), 'false, false');

  const test1 = new UserMockup();
  const test2 = new UserMockup();

  t.is(
    checkEqual(test1, test2),
    false,
    `Model instances that don't have an id were identified as equal.`,
  );
  test1.id = 'asd';
  test2.id = test1.id;
  t.true(
    checkEqual(test1, test2),
    `Model instances that DO have an id were identified as NOT equal.`,
  );
});

test.serial(
  'helpers.checkEqual uses Object.hasOwnProperty for safety',
  async (t) => {
    const checkEqual = require('../tsOut/helpers').checkEqual;

    const test1 = Object.create(null);
    const test2 = {};

    // checkEqual throws an error here if it's not using Object.hasOwnProperty()
    t.is(checkEqual(test1, test2), false, 'Something is wrong');
  },
);

test.serial('helpers.callbackError', (t) => {
  const callbackError = require('../tsOut/helpers').callbackError;

  t.throws(
    () => {
      // tslint:disable-next-line:no-empty
      callbackError(() => {});
    },
    /^Callback style has been removed. Use the returned promise\.$/,
    'Does not throw when given only function',
  );
  t.throws(
    () => {
      // tslint:disable-next-line:no-empty
      callbackError('foo', 'bar', 'baz', () => {});
    },
    /^Callback style has been removed. Use the returned promise\.$/,
    'Does not throw when last of 4 is function.',
  );
  t.notThrows(() => {
    callbackError('foo', 'bar', 'baz');
  }, 'Error thrown even though arguments contained no function.');
  t.notThrows(() => {
    // tslint:disable-next-line:no-empty
    callbackError(() => {}, 'bar', 'baz');
  }, 'Error thrown even though last argument was not a function.');
});
