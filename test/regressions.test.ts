import test from 'ava';

import { nohm } from '../ts';

import * as args from './testArgs';
import { cleanUp, cleanUpPromise } from './helper';
import { exists, smembers } from '../ts/typed-redis-helper';

const redis = args.redis;

const prefix = args.prefix + 'regressions';

test.before(async (t) => {
  nohm.setPrefix(prefix);
  await args.setClient(nohm, redis);
  await cleanUpPromise(redis, prefix);
});

test.afterEach.cb((t) => {
  cleanUp(redis, prefix, t.end);
});

test.serial('#114 update does not reset index', async (t) => {
  // https://github.com/maritz/nohm/issues/114

  const modelName = 'Regression114Model';

  nohm.model(modelName, {
    properties: {
      uniqueDeletion: {
        type: 'string',
        unique: true,
      },
      isActive: {
        index: true,
        defaultValue: true,
        type: 'boolean',
      },
      scoredIndex: {
        index: true,
        defaultValue: 1,
        type: 'number',
      },
    },
    idGenerator: 'increment',
  });

  const instance = await nohm.factory(modelName);
  instance.property({ uniqueDeletion: 'one' });

  const instance2 = await nohm.factory(modelName);
  instance2.property({
    uniqueDeletion: 'two',
    isActive: false,
    scoredIndex: 123,
  });

  const instance3 = await nohm.factory(modelName);
  instance3.property({ uniqueDeletion: 'three' });
  await Promise.all([instance.save(), instance2.save(), instance3.save()]);

  const uniqueKey = `${prefix}:uniques:${instance2.modelName}:uniqueDeletion:two`;

  // make sure we check the correct unique key
  const uniqueExistsCheck = await exists(redis, uniqueKey);

  t.is(uniqueExistsCheck, 1, 'A unique key of a changed property remained.');

  const instance2Activated = await nohm.factory(modelName);
  instance2Activated.id = instance2.id;
  instance2Activated.property({
    uniqueDeletion: 'twoDelete',
    isActive: true,
  });
  await instance2Activated.save();

  const membersTrue = await smembers(
    redis,
    `${prefix}:index:${modelName}:isActive:true`,
  );

  t.deepEqual(
    membersTrue,
    [instance.id, instance2.id, instance3.id],
    'Not all instances were properly indexed as isActive:true',
  );

  const membersFalse = await smembers(
    redis,
    `${prefix}:index:${modelName}:isActive:false`,
  );

  t.deepEqual(membersFalse, [], 'An index for isActive:false remained.');

  const uniqueExists = await exists(redis, uniqueKey);

  t.is(uniqueExists, 0, 'A unique key of a changed property remained.');
});
