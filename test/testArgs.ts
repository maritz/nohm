import { NohmClass } from '../ts';
import * as NodeRedis from 'redis';
import * as IORedis from 'ioredis';

export let prefix = 'nohmtests';
export let noCleanup = false;
export let setMeta = false;
export let redisHost = '127.0.0.1';
export let redisPort = 6379;

export let redisAuth: undefined | string;
export let redis: any;
export let secondaryClient: any;

process.argv.forEach((val, index) => {
  if (val === '--nohm-prefix') {
    prefix = process.argv[index + 1];
  }
  if (val === '--no-cleanup') {
    noCleanup = true;
  }
  if (val === '--redis-host') {
    redisHost = process.argv[index + 1];
  }
  if (val === '--redis-port') {
    redisPort = parseInt(process.argv[index + 1], 10);
  }
  if (val === '--redis-auth') {
    redisAuth = process.argv[index + 1];
  }
});

if (process.env.NOHM_TEST_IOREDIS === 'true') {
  redis = new IORedis({
    port: redisPort,
    host: redisHost,
    password: redisAuth,
  });

  secondaryClient = new IORedis({
    port: redisPort,
    host: redisHost,
    password: redisAuth,
  });
} else {
  redis = NodeRedis.createClient(redisPort, redisHost, {
    auth_pass: redisAuth,
    retry_strategy(options) {
      console.error(
        '\nFailed to connect to primary redis:',
        options.error,
        '\n',
      );
      return new Error('Redis connection failed');
    },
  });

  secondaryClient = NodeRedis.createClient(redisPort, redisHost, {
    auth_pass: redisAuth,
    retry_strategy(options: any) {
      console.error(
        '\nFailed to connect to secondary redis:',
        options.error,
        '\n',
      );
      return new Error('Redis connection failed');
    },
  });
}

export const setClient = (nohm: NohmClass, client: NodeRedis.RedisClient) => {
  return new Promise((resolve) => {
    if (!client) {
      client = redis;
    }
    client.on('ready', () => {
      nohm.setClient(client);
      resolve(true);
    });
  });
};
