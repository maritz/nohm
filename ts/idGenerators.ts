import { v1 as uuid } from 'uuid';
import * as redis from 'redis';

export interface IGenerators {
  [key: string]: (client: redis.RedisClient, idPrefix: string) => Promise<string>;
}

export const idGenerators: IGenerators = {

  default: async function defaultGenerator(): Promise<string> {
    return uuid();
  },

  increment: function incrementGenerator(client: redis.RedisClient, idPrefix: string): Promise<string> {
    return new Promise((resolve, reject) => {
      client.incr(idPrefix, (err, newId) => {
        if (err) {
          reject(err);
        } else {
          resolve(newId[0]);
        }
      });
    });
  },

};
