import { v1 as uuid } from 'uuid';
import * as redis from 'redis';
import * as Debug from 'debug';

const debug = Debug('nohm:idGenerator');

export interface IGenerators {
  [key: string]: (client: redis.RedisClient, idPrefix: string) => Promise<string>;
}

export const idGenerators: IGenerators = {

  default: async function defaultGenerator(): Promise<string> {
    const newId = uuid();
    debug('Generated default (uuid) id: %s.', newId);
    return newId;
  },

  increment: function incrementGenerator(client: redis.RedisClient, idPrefix: string): Promise<string> {
    return new Promise((resolve, reject) => {
      client.incr(idPrefix, (err, newId) => {
        if (err) {
          reject(err);
        } else {
          debug('Generated incremental id: %s.', newId);
          resolve(newId.toString(10));
        }
      });
    });
  },

};
