import anyTest, { TestInterface } from 'ava';
import { createHash } from 'crypto';
import * as traverse from 'traverse';

import { nohm } from '../ts';

import * as args from './testArgs';
import { cleanUpPromise } from './helper';
import NohmModel from '../ts/model';
import { get, hget } from '../ts/typed-redis-helper';

const test = anyTest as TestInterface<{
  users: Array<NohmModel<any>>;
  userIds: Array<string>;
}>;

const redis = args.redis;

const prefix = args.prefix + 'meta';

nohm.model('UserMetaMockup', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'testName',
      index: true,
      validations: ['notEmpty'],
    },
    email: {
      type: 'string',
      defaultValue: 'testMail@test.de',
      unique: true,
      validations: [
        'email',
        (values) => {
          return Promise.resolve(values !== 'thisisnoemail');
        },
      ],
    },
    gender: {
      type: 'string',
    },
    json: {
      type: 'json',
      defaultValue: '{}',
    },
    number: {
      type: 'integer',
      defaultValue: 1,
      index: true,
    },
    bool: {
      type: 'bool',
      defaultValue: false,
    },
  },
  idGenerator: 'increment',
});

nohm.model('CommentMetaMockup', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'testName',
      index: true,
      validations: ['notEmpty'],
    },
  },
  idGenerator() {
    return Promise.resolve(+new Date());
  },
});

const createUsers = async <TProps, TModel extends NohmModel<TProps>>(
  props: Array<TProps>,
): Promise<[Array<TModel>, Array<string>]> => {
  const promises = props.map(async (prop) => {
    const user: TModel = await nohm.factory('UserMetaMockup');
    user.property(prop);
    await user.save();
    return user;
  });

  const users = await Promise.all(promises);
  const ids = users.map((user) => {
    return user.id;
  });
  return [users, ids];
};

test.before(async (t) => {
  nohm.setPrefix(prefix);
  await args.setClient(nohm, redis);
  await cleanUpPromise(redis, prefix);
  const [users, userIds] = await createUsers([
    {
      name: 'metatestsone',
      email: 'metatestsone@hurgel.de',
      gender: 'male',
      number: 3,
    },
    {
      name: 'metateststwo',
      email: 'numericindextest2@hurgel.de',
      gender: 'male',
      number: 4,
    },
  ]);
  const comment = await nohm.factory('CommentMetaMockup');
  users[0].link(comment);
  await users[0].save();
  t.context.users = users;
  t.context.userIds = userIds;
});

test.after(async (t) => {
  await cleanUpPromise(redis, prefix);
});

const stringifyFunctions = (obj) => {
  return traverse(obj).map((x) => {
    if (typeof x === 'function') {
      return String(x);
    } else {
      return x;
    }
  });
};

test('version', async (t) => {
  const user = await nohm.factory('UserMetaMockup');

  const hash = createHash('sha1');

  hash.update(JSON.stringify(user.meta.properties));
  hash.update(JSON.stringify(user.modelName));
  // any because we are accessing private user.options
  hash.update((user as any).options.idGenerator.toString());

  const version = await get(redis, prefix + ':meta:version:UserMetaMockup');
  t.is(hash.digest('hex'), version, 'Version of the metadata did not match.');
});

test('version in instance', async (t) => {
  const user = await nohm.factory('UserMetaMockup');

  const version = await hget(
    redis,
    prefix + ':hash:UserMetaMockup:1',
    '__meta_version',
  );
  t.is(
    version,
    user.meta.version,
    'Version of the instance did not match meta data.',
  );
});

test.cb('meta callback and setting meta.inDb', (t) => {
  const testModel = nohm.model('TestVersionMetaMockup', {
    properties: {
      name: {
        type: 'string',
        defaultValue: 'testProperty',
      },
    },
    metaCallback(err, version) {
      t.is(err, null, 'Meta version callback had an error.');
      t.true(testInstance.meta.inDb, 'Meta version inDb was not false.');
      t.truthy(version, 'No version in meta.inDb callback');
      t.end();
    },
  });

  const testInstance = new testModel();
  t.false(
    testInstance.meta.inDb,
    'Meta version inDb was not false directly after instantiation.',
  );
});

test('idGenerator', async (t) => {
  const user = await nohm.factory('UserMetaMockup');
  const comment = await nohm.factory('CommentMetaMockup');

  const userIdGenerator = await get(
    redis,
    prefix + ':meta:idGenerator:UserMetaMockup',
  );
  t.is(
    userIdGenerator,
    // any because we are accessing private user.options
    (user as any).options.idGenerator.toString(),
    'idGenerator of the user did not match.',
  );

  const commentIdGenerator = await get(
    redis,
    prefix + ':meta:idGenerator:CommentMetaMockup',
  );
  t.is(
    commentIdGenerator,
    // any because we are accessing private user.options
    (comment as any).options.idGenerator.toString(),
    'idGenerator of the comment did not match.',
  );
});

test('properties', async (t) => {
  const user = await nohm.factory('UserMetaMockup');
  const comment = await nohm.factory('CommentMetaMockup');

  const userMetaProps = await get(
    redis,
    prefix + ':meta:properties:UserMetaMockup',
  );
  t.is(
    userMetaProps,
    JSON.stringify(stringifyFunctions(user.meta.properties)),
    'Properties of the user did not match.',
  );

  const commentMetaProps = await get(
    redis,
    prefix + ':meta:properties:CommentMetaMockup',
  );
  t.is(
    commentMetaProps,
    JSON.stringify(stringifyFunctions(comment.meta.properties)),
    'Properties of the comment did not match.',
  );
});
