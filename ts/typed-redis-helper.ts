import { Multi, RedisClient } from 'redis';

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
  ...keys: Array<string>
): Promise<Array<string>> {
  return new Promise<Array<string>>((resolve, reject) => {
    if (!client.sinter) {
      return reject(new Error(errorMessage));
    }
    client.sinter.apply(client, [
      keyArrayOrString,
      ...keys,
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
