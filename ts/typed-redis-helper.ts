import { Multi, RedisClient } from 'redis';

export const errorMessage =
  'Supplied redis client does not have the correct methods.';

export function GET(client: RedisClient | Multi, key: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (!client.GET) {
      return reject(new Error(errorMessage));
    }
    client.GET(key, (err, value) => {
      if (err) {
        reject(err);
      } else {
        resolve(value);
      }
    });
  });
}

export function EXISTS(
  client: RedisClient | Multi,
  key: string,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    if (!client.EXISTS) {
      return reject(new Error(errorMessage));
    }
    client.EXISTS(key, (err, reply) => {
      if (err) {
        reject(err);
      } else {
        resolve(reply);
      }
    });
  });
}

export function DEL(client: RedisClient | Multi, key: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (!client.DEL) {
      return reject(new Error(errorMessage));
    }
    client.DEL(key, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function SET(
  client: RedisClient | Multi,
  key: string,
  value: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (!client.SET) {
      return reject(new Error(errorMessage));
    }
    client.SET(key, value, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function MSET(
  client: RedisClient | Multi,
  keyValueArrayOrString: string | Array<string>,
  ...keyValuePairs: Array<string>
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (!client.MSET) {
      return reject(new Error(errorMessage));
    }
    client.MSET.apply(client, [
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

export function SETNX(
  client: RedisClient | Multi,
  key: string,
  value: string,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    if (!client.SETNX) {
      return reject(new Error(errorMessage));
    }
    client.SETNX(key, value, (err, reply) => {
      if (err) {
        reject(err);
      } else {
        resolve(reply);
      }
    });
  });
}

export function SMEMBERS(
  client: RedisClient | Multi,
  key: string,
): Promise<Array<string>> {
  return new Promise<Array<string>>((resolve, reject) => {
    if (!client.SMEMBERS) {
      return reject(new Error(errorMessage));
    }
    client.SMEMBERS(key, (err, values) => {
      if (err) {
        reject(err);
      } else {
        resolve(values);
      }
    });
  });
}

export function SCARD(
  client: RedisClient | Multi,
  key: string,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    if (!client.SCARD) {
      return reject(new Error(errorMessage));
    }
    client.SCARD(key, (err, value) => {
      if (err) {
        reject(err);
      } else {
        resolve(value);
      }
    });
  });
}

export function SISMEMBER(
  client: RedisClient | Multi,
  key: string,
  value: string,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    if (!client.SISMEMBER) {
      return reject(new Error(errorMessage));
    }
    client.SISMEMBER(key, value, (err, numFound) => {
      if (err) {
        reject(err);
      } else {
        resolve(numFound);
      }
    });
  });
}

export function SADD(
  client: RedisClient | Multi,
  key: string,
  value: string,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    if (!client.SADD) {
      return reject(new Error(errorMessage));
    }
    client.SADD(key, value, (err, numInserted) => {
      if (err) {
        reject(err);
      } else {
        resolve(numInserted);
      }
    });
  });
}

export function SINTER(
  client: RedisClient | Multi,
  keyArrayOrString: string | Array<string>,
  ...keys: Array<string>
): Promise<Array<string>> {
  return new Promise<Array<string>>((resolve, reject) => {
    if (!client.SINTER) {
      return reject(new Error(errorMessage));
    }
    client.SINTER.apply(client, [
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

export function HGETALL(
  client: RedisClient | Multi,
  key: string,
): Promise<{ [key: string]: string }> {
  return new Promise<{ [key: string]: string }>((resolve, reject) => {
    if (!client.HGETALL) {
      return reject(new Error(errorMessage));
    }
    client.HGETALL(key, (err, values) => {
      if (err) {
        reject(err);
      } else {
        resolve(values);
      }
    });
  });
}

export function EXEC<T>(client: Multi): Promise<Array<T>> {
  return new Promise<Array<T>>((resolve, reject) => {
    if (!client.EXEC) {
      return reject(new Error(errorMessage));
    }
    client.EXEC((err, results) => {
      if (err) {
        return reject(err);
      } else {
        resolve(results);
      }
    });
  });
}

export function PSUBSCRIBE(
  client: RedisClient,
  patternOrPatternArray: string | Array<string>,
  ...patterns: Array<string>
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (!client.PSUBSCRIBE) {
      return reject(new Error(errorMessage));
    }
    client.PSUBSCRIBE.apply(client, [
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

export function PUNSUBSCRIBE(
  client: RedisClient,
  patternOrPatternArray: string | Array<string>,
  ...patterns: Array<string>
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (!client.PUNSUBSCRIBE) {
      return reject(new Error(errorMessage));
    }
    client.PUNSUBSCRIBE.apply(client, [
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
