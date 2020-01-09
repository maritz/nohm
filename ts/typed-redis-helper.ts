import { Multi, RedisClient } from 'redis';
import * as IORedis from 'ioredis';

export const errorMessage =
  'Supplied redis client does not have the correct methods.';

export function get(client: RedisClient | Multi, key: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (!client.get) {
      return reject(new Error(errorMessage));
    }
    client.get(key, (err, value) => {
      if (err) {
        reject(err);
      } else {
        resolve(value);
      }
    });
  });
}

export function exists(
  client: RedisClient | Multi,
  key: string,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    if (!client.exists) {
      return reject(new Error(errorMessage));
    }
    client.exists(key, (err, reply) => {
      if (err) {
        reject(err);
      } else {
        resolve(reply);
      }
    });
  });
}

export function del(client: RedisClient | Multi, key: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (!client.del) {
      return reject(new Error(errorMessage));
    }
    client.del(key, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function set(
  client: RedisClient | Multi,
  key: string,
  value: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (!client.set) {
      return reject(new Error(errorMessage));
    }
    client.set(key, value, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function mset(
  client: RedisClient | Multi,
  keyValueArrayOrString: string | Array<string>,
  ...keyValuePairs: Array<string>
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (!client.mset) {
      return reject(new Error(errorMessage));
    }
    client.mset.apply(client, [
      keyValueArrayOrString,
      ...keyValuePairs,
      (err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      },
    ]);
  });
}

export function setnx(
  client: RedisClient | Multi,
  key: string,
  value: string,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    if (!client.setnx) {
      return reject(new Error(errorMessage));
    }
    client.setnx(key, value, (err, reply) => {
      if (err) {
        reject(err);
      } else {
        resolve(reply);
      }
    });
  });
}

export function smembers(
  client: RedisClient | Multi,
  key: string,
): Promise<Array<string>> {
  return new Promise<Array<string>>((resolve, reject) => {
    if (!client.smembers) {
      return reject(new Error(errorMessage));
    }
    client.smembers(key, (err, values) => {
      if (err) {
        reject(err);
      } else {
        resolve(values);
      }
    });
  });
}

export function scard(
  client: RedisClient | Multi,
  key: string,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    if (!client.scard) {
      return reject(new Error(errorMessage));
    }
    client.scard(key, (err, value) => {
      if (err) {
        reject(err);
      } else {
        resolve(value);
      }
    });
  });
}

export function sismember(
  client: RedisClient | Multi,
  key: string,
  value: string,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    if (!client.sismember) {
      return reject(new Error(errorMessage));
    }
    client.sismember(key, value, (err, numFound) => {
      if (err) {
        reject(err);
      } else {
        resolve(numFound);
      }
    });
  });
}

export function sadd(
  client: RedisClient | Multi,
  key: string,
  value: string,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    if (!client.sadd) {
      return reject(new Error(errorMessage));
    }
    client.sadd(key, value, (err, numInserted) => {
      if (err) {
        reject(err);
      } else {
        resolve(numInserted);
      }
    });
  });
}

export function sinter(
  client: RedisClient | Multi,
  keyArrayOrString: string | Array<string>,
  ...intersectKeys: Array<string>
): Promise<Array<string>> {
  return new Promise<Array<string>>((resolve, reject) => {
    if (!client.sinter) {
      return reject(new Error(errorMessage));
    }
    client.sinter.apply(client, [
      keyArrayOrString,
      ...intersectKeys,
      (err: Error | null, values: Array<string>) => {
        if (err) {
          reject(err);
        } else {
          resolve(values);
        }
      },
    ]);
  });
}

export function hgetall(
  client: RedisClient | Multi,
  key: string,
): Promise<{ [key: string]: string }> {
  return new Promise<{ [key: string]: string }>((resolve, reject) => {
    if (!client.hgetall) {
      return reject(new Error(errorMessage));
    }
    client.hgetall(key, (err, values) => {
      if (err) {
        reject(err);
      } else {
        resolve(values);
      }
    });
  });
}

export function exec<T>(client: Multi): Promise<Array<T>> {
  return new Promise<Array<T>>((resolve, reject) => {
    if (!client.exec) {
      return reject(new Error(errorMessage));
    }
    client.exec((err, results) => {
      if (err) {
        return reject(err);
      } else {
        // detect if it's ioredis, which has a different return structure.
        // better methods for doing this would be very welcome!
        if (
          Array.isArray(results[0]) &&
          (results[0][0] === null ||
            // once ioredis has proper typings, this any casting can be changed
            results[0][0] instanceof (IORedis as any).ReplyError)
        ) {
          // transform ioredis format to node_redis format
          results = results.map((result: Array<any>) => {
            const error = result[0];
            if (error instanceof (IORedis as any).ReplyError) {
              return error.message;
            }
            return result[1];
          });
        }
        resolve(results);
      }
    });
  });
}

export function psubscribe(
  client: RedisClient,
  patternOrPatternArray: string | Array<string>,
  ...patterns: Array<string>
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (!client.psubscribe) {
      return reject(new Error(errorMessage));
    }
    client.psubscribe.apply(client, [
      patternOrPatternArray,
      ...patterns,
      (err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      },
    ]);
  });
}

export function punsubscribe(
  client: RedisClient,
  patternOrPatternArray: string | Array<string>,
  ...patterns: Array<string>
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (!client.punsubscribe) {
      return reject(new Error(errorMessage));
    }
    client.punsubscribe.apply(client, [
      patternOrPatternArray,
      ...patterns,
      (err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      },
    ]);
  });
}

export function keys(
  client: RedisClient | Multi,
  searchString: string,
): Promise<Array<string>> {
  return new Promise<Array<string>>((resolve, reject) => {
    if (!client.keys) {
      return reject(new Error(errorMessage));
    }
    client.keys(searchString, (err, value) => {
      if (err) {
        reject(err);
      } else {
        resolve(value);
      }
    });
  });
}

export function zscore(
  client: RedisClient | Multi,
  key: string,
  member: string,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    if (!client.zscore) {
      return reject(new Error(errorMessage));
    }
    client.zscore(key, member, (err, value) => {
      if (err) {
        reject(err);
      } else {
        resolve(parseFloat(value));
      }
    });
  });
}

export function hset(
  client: RedisClient | Multi,
  key: string,
  field: string,
  value: string,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    if (!client.hset) {
      return reject(new Error(errorMessage));
    }
    client.hset(key, field, value, (err, numAdded) => {
      if (err) {
        reject(err);
      } else {
        resolve(numAdded);
      }
    });
  });
}
