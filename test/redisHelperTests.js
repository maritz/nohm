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

exports['GET'] = testCommand('GET', 'foo', undefined, 'bar');
exports['EXISTS'] = testCommand('EXISTS', 'foo', undefined, true);
exports['DEL'] = testCommand('DEL', 'foo');
exports['SET'] = testCommand('SET', 'foo', 'bar');
exports['MSET'] = testCommand('MSET', 'foo', ['foo', 'bar']);
exports['SETNX'] = testCommand('SETNX', 'foo', 'bar', true);
exports['SMEMBERS'] = testCommand('SMEMBERS', 'foo', undefined, ['bar']);
exports['SISMEMBER'] = testCommand('SISMEMBER', 'foo', 'bar', 1);
exports['SADD'] = testCommand('SADD', 'foo', 'bar', 1);
exports['SINTER'] = testCommand('SINTER', 'foo', 'bar', ['bar', 'baz']);
exports['HGETALL'] = testCommand('HGETALL', 'foo', undefined, ['bar', 'baz']);
exports['PSUBSCRIBE'] = testCommand('PSUBSCRIBE', 'foo', ['bar', 'baz']);
exports['PUNSUBSCRIBE'] = testCommand('PUNSUBSCRIBE', 'foo', ['bar', 'baz']);

exports['EXEC'] = async (t) => {
  t.expect(4);

  // EXEC has no firstArg. it's easier to duplicate the test here instead of changing testCommand
  const name = 'EXEC';
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
