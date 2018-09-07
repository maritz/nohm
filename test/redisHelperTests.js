const td = require('testdouble');

const redisHelper = require(__dirname + '/../tsOut/typed-redis-helper');
const mockRedis = td.object(redisHelper);

const testCommand = (name, firstArg, secondArg, resolveExpect) => {
  return async (t) => {
    t.expect(4);

    const testMethod = redisHelper[name];

    try {
      await testMethod({});
    } catch (e) {
      t.ok(e instanceof Error, 'Eror thrown was not instance of Error.');
      t.equal(
        e.message,
        redisHelper.errorMessage,
        'Eror thrown had the wrong message.',
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
      t.equal(
        await testMethod(mockRedis, firstArg, secondArg),
        resolveExpect,
        `${name} did not resolve correctly`,
      );
    } catch (e) {
      t.ok(false, `${name} without error rejected: ${e.message}`);
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
      t.equal(e, errorString, 'Error thrown was not errorString');
    }

    t.done();
  };
};

exports['get'] = testCommand('get', 'foo', undefined, 'bar');
exports['exists'] = testCommand('exists', 'foo', undefined, true);
exports['del'] = testCommand('del', 'foo');
exports['set'] = testCommand('set', 'foo', 'bar');
exports['mset'] = testCommand('mset', 'foo', ['foo', 'bar']);
exports['setnx'] = testCommand('setnx', 'foo', 'bar', true);
exports['smembers'] = testCommand('smembers', 'foo', undefined, ['bar']);
exports['sismember'] = testCommand('sismember', 'foo', 'bar', 1);
exports['sadd'] = testCommand('sadd', 'foo', 'bar', 1);
exports['sinter'] = testCommand('sinter', 'foo', 'bar', ['bar', 'baz']);
exports['hgetall'] = testCommand('hgetall', 'foo', undefined, ['bar', 'baz']);
exports['psubscribe'] = testCommand('psubscribe', 'foo', ['bar', 'baz']);
exports['punsubscribe'] = testCommand('punsubscribe', 'foo', ['bar', 'baz']);

exports['exec'] = async (t) => {
  t.expect(4);

  // exec has no firstArg. it's easier to duplicate the test here instead of changing testCommand
  const name = 'exec';
  const resolveExpect = ['foo', 'baz'];
  const testMethod = redisHelper[name];

  try {
    await testMethod({});
  } catch (e) {
    t.ok(e instanceof Error, 'Eror thrown was not instance of Error.');
    t.equal(
      e.message,
      redisHelper.errorMessage,
      'Eror thrown had the wrong message.',
    );
  }

  try {
    td.when(mockRedis[name]()).thenCallback(null, resolveExpect);
    t.equal(
      await testMethod(mockRedis),
      resolveExpect,
      `${name} did not resolve correctly`,
    );
  } catch (e) {
    t.ok(false, `${name} without error rejected: ${e.message}`);
  }

  const errorString = Symbol('Error string');
  try {
    td.when(mockRedis[name]()).thenCallback(errorString, null);
    await testMethod(mockRedis);
  } catch (e) {
    t.equal(e, errorString, 'Error thrown was not errorString');
  }

  t.done();
};
