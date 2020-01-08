import test, { ExecutionContext } from 'ava';
import * as td from 'testdouble';

import * as redisHelper from '../ts/typed-redis-helper';
import { Multi } from 'redis';

// an object that has the redis methods that are used as testdoubles (could also use a redis client, this is simpler)
const mockRedis = td.object(redisHelper);

const testCommand = (
  name: string,
  firstArg: string,
  secondArg?: any,
  resolveExpect?: any,
) => {
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
      if (secondArg === undefined) {
        td.when(mockRedis[name](firstArg)).thenCallback(null, resolveExpect);
      } else {
        td.when(mockRedis[name](firstArg, secondArg)).thenCallback(
          null,
          resolveExpect,
        );
      }
      t.deepEqual(
        await testMethod(mockRedis, firstArg, secondArg),
        resolveExpect,
        `${name} did not resolve correctly`,
      );
    } catch (e) {
      t.fail(`${name} without error rejected: ${e.message}`);
    }

    const errorString = Symbol('Error string');
    try {
      if (secondArg === undefined) {
        td.when(mockRedis[name]('errorKey')).thenCallback(errorString, null);
      } else {
        td.when(mockRedis[name]('errorKey', secondArg)).thenCallback(
          errorString,
          null,
        );
      }
      await testMethod(mockRedis, 'errorKey', secondArg);
    } catch (e) {
      t.is(e, errorString, 'Error thrown was not errorString');
    }
  };
};

test('get', testCommand('get', 'foo', undefined, 'bar'));
test('exists', testCommand('exists', 'foo', undefined, true));
test('del', testCommand('del', 'foo'));
test('set', testCommand('set', 'foo', 'bar'));
test('mset', testCommand('mset', 'foo', ['foo', 'bar']));
test('setnx', testCommand('setnx', 'foo', 'bar', true));
test('smembers', testCommand('smembers', 'foo', undefined, ['bar']));
test('sismember', testCommand('sismember', 'foo', 'bar', 1));
test('sadd', testCommand('sadd', 'foo', 'bar', 1));
test('sinter', testCommand('sinter', 'foo', 'bar', ['bar', 'baz']));
test('hgetall', testCommand('hgetall', 'foo', undefined, ['bar', 'baz']));
test('psubscribe', testCommand('psubscribe', 'foo', ['bar', 'baz']));
test('punsubscribe', testCommand('punsubscribe', 'foo', ['bar', 'baz']));
test('keys', testCommand('keys', 'foo', undefined, ['bar', 'baz']));
test('zscore', testCommand('zscore', 'foo', 'bar', 2));

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
