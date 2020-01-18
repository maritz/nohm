import test, { ExecutionContext } from 'ava';
import * as td from 'testdouble';

import * as redisHelper from '../ts/typed-redis-helper';
import { Multi } from 'redis';

// an object that has the redis methods that are used as testdoubles (could also use a redis client, this is simpler)
const mockRedis = td.object(redisHelper);

const testCommand = (name: string, args: Array<any>, resolveExpect?: any) => {
  return async (t: ExecutionContext<unknown>) => {
    const testMethod = redisHelper[name];

    try {
      await testMethod({});
    } catch (e) {
      t.true(e instanceof Error, 'Error thrown was not instance of Error.');
      t.is(
        e.message,
        redisHelper.errorMessage,
        'Error thrown had the wrong message.',
      );
    }

    try {
      td.when(mockRedis[name](...args)).thenCallback(null, resolveExpect);
      t.deepEqual(
        await testMethod.apply(testMethod, [mockRedis, ...args]),
        resolveExpect,
        `${name} did not resolve correctly`,
      );
    } catch (e) {
      t.fail(`${name} without error rejected: ${e.message}`);
    }

    const errorString = Symbol('Error string');
    try {
      args.splice(0, 1); // since we're passing errorKey as the first arg, we remove the first supplied one
      td.when(mockRedis[name](...['errorKey', ...args])).thenCallback(
        errorString,
        null,
      );
      await testMethod.apply(testMethod, [mockRedis, 'errorKey', ...args]);
      t.fail('Succeeded where it should not have.');
    } catch (e) {
      t.is(e, errorString, 'Error thrown was not errorString');
    }
  };
};

test('get', testCommand('get', ['foo'], 'bar'));
test('exists', testCommand('exists', ['foo'], true));
test('del', testCommand('del', ['foo']));
test('set', testCommand('set', ['foo', 'bar']));
test('mset', testCommand('mset', ['foo', ['foo', 'bar']]));
test('setnx', testCommand('setnx', ['foo', 'bar'], true));
test('smembers', testCommand('smembers', ['foo'], ['bar']));
test('sismember', testCommand('sismember', ['foo', 'bar'], 1));
test('sadd', testCommand('sadd', ['foo', 'bar'], 1));
test('sinter', testCommand('sinter', ['foo', 'bar'], ['bar', 'baz']));
test('hgetall', testCommand('hgetall', ['foo'], ['bar', 'baz']));
test('psubscribe', testCommand('psubscribe', ['foo', ['bar', 'baz']]));
test('punsubscribe', testCommand('punsubscribe', ['foo', ['bar', 'baz']]));
test('keys', testCommand('keys', ['foo'], ['bar', 'baz']));
test('zscore', testCommand('zscore', ['foo', 'bar'], 2));
test('hset', testCommand('hset', ['foo', 'bar', 'baz'], 2));
test('hget', testCommand('hget', ['foo', 'bar'], 'baz'));

test.serial('exec', async (t) => {
  // exec has no firstArg. it's easier to duplicate the test here instead of changing testCommand
  const mockMultiRedis: Multi = td.object(['exec', 'EXEC']) as Multi;

  try {
    // @ts-ignore intentionally calling with wrong arguments
    await redisHelper.exec({});
    t.fail('Succeeded where it should have failed.');
  } catch (e) {
    t.true(e instanceof Error, 'Error thrown was not instance of Error.');
    t.is(
      e.message,
      redisHelper.errorMessage,
      'Error thrown had the wrong message.',
    );
  }

  const resolveExpect = ['foo', 'baz'];
  td.when(mockMultiRedis.exec()).thenCallback(null, resolveExpect);
  t.deepEqual(
    await redisHelper.exec(mockMultiRedis),
    resolveExpect,
    `exec did not resolve correctly`,
  );

  // test that error callback rejects
  const errorString = Symbol('Error string');
  try {
    td.when(mockMultiRedis.exec()).thenCallback(errorString, null);
    await redisHelper.exec(mockMultiRedis);
    t.fail('Error callback did not reject.');
  } catch (e) {
    t.is(e, errorString, 'Error thrown was not errorString');
  }
});
