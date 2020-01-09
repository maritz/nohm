import { RedisClient } from 'redis';

export const cleanUp = (
  redis: RedisClient,
  prefix: string,
  cb: (err?: Error | string) => unknown,
) => {
  redis.keys(prefix + '*', (err, keys) => {
    if (err) {
      cb(err);
    }
    if (!keys || keys.length === 0) {
      return cb();
    }
    const len = keys.length;
    let k = 0;
    const deleteCallback = () => {
      k = k + 1;
      if (k === len) {
        cb();
      }
    };
    for (let i = 0; i < len; i++) {
      redis.del(keys[i], deleteCallback);
    }
  });
};

export const cleanUpPromise = (redis: RedisClient, prefix: string) => {
  return new Promise((resolve) => {
    cleanUp(redis, prefix, resolve);
  });
};

export const sleep = (time = 100) => {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
};
