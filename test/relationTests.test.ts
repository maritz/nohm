import test from 'ava';

import { nohm } from '../ts';

import * as args from './testArgs';
import { cleanUpPromise } from './helper';
import { keys, smembers, exists, sismember } from '../ts/typed-redis-helper';

const redis = args.redis;

const prefix = args.prefix + 'relations';

let relationsPrefix = '';

test.before(async () => {
  nohm.setPrefix(prefix);
  relationsPrefix = nohm.prefix.relations;
  await args.setClient(nohm, redis);
  await cleanUpPromise(redis, prefix);
});

test.afterEach(async () => {
  await cleanUpPromise(redis, prefix);
});

// tslint:disable-next-line:variable-name
const UserLinkMockup = nohm.model('UserLinkMockup', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'testName',
      validations: ['notEmpty'],
    },
  },
});
// tslint:disable-next-line:variable-name
const CommentLinkMockup = nohm.model('CommentLinkMockup', {
  properties: {
    text: {
      type: 'string',
      defaultValue: 'this is a comment! REALLY!',
      validations: ['notEmpty'],
    },
  },
});
// tslint:disable-next-line:variable-name
const RoleLinkMockup = nohm.model('RoleLinkMockup', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'user',
    },
  },
});

test.serial('instances', (t) => {
  const user = new UserLinkMockup();
  const role = new RoleLinkMockup();

  role.link(user);

  t.not(
    // @ts-ignore
    role.relationChanges,
    // @ts-ignore
    user.relationChanges,
    'Instances share the relationChanges, initiate them as an empty array in the constructor.',
  );

  const role2 = new RoleLinkMockup();
  t.deepEqual(
    // @ts-ignore
    role2.relationChanges,
    [],
    'Creating a new instance does not reset the relationChanges of that instance.',
  );
});

test.serial('link', async (t) => {
  const user = new UserLinkMockup();
  const role = new RoleLinkMockup();
  const role2 = new RoleLinkMockup();
  let linkCallbackCalled = false;
  let linkCallbackCalled2 = false;

  user.link(role, (action, on, name, obj) => {
    linkCallbackCalled = true;
    t.is(
      action,
      'link',
      'The argument "action" given to the link callback are not correct',
    );
    t.is(
      on,
      'UserLinkMockup',
      'The argument "on" given to the link callback are not correct',
    );
    t.is(
      name,
      'default',
      'The argument "name" given to the link callback are not correct',
    );
    t.is(
      obj,
      role,
      'The argument "obj" given to the link callback are not correct',
    );
  });

  role2.property('name', 'test');

  user.link(role2, () => {
    linkCallbackCalled2 = true;
  });

  await user.save();

  t.true(
    linkCallbackCalled,
    'The provided callback for linking was not called.',
  );
  t.true(
    linkCallbackCalled2,
    'The provided callback for the second(!) linking was not called.',
  );
  const values = await keys(redis, relationsPrefix + '*');
  t.is(
    values.length,
    3,
    'Linking an object did not create the correct number of keys.',
  );
  await Promise.all(
    values.map<Promise<void>>(async (value) => {
      const isForeignLink = value.includes(':defaultForeign:');
      // user links to role1 and role2, each role links to only user
      const ids = isForeignLink ? [user.id] : [role.id, role2.id];
      const members = await smembers(redis, value.toString());
      t.deepEqual(members.sort(), ids.sort());
    }),
  );
});

test.serial('unlink', async (t) => {
  const user = new UserLinkMockup();
  const role = new RoleLinkMockup();
  const role2 = new RoleLinkMockup();
  let unlinkCallbackCalled = false;
  let unlinkCallbackCalled2 = false;

  user.id = '1';
  role.id = '1';
  role2.id = '2';

  user.unlink(role, (action, on, name, obj) => {
    unlinkCallbackCalled = true;
    t.is(
      action,
      'unlink',
      'The argument "action" given to the unlink callback are not correct',
    );
    t.is(
      on,
      'UserLinkMockup',
      'The argument "on" given to the unlink callback are not correct',
    );
    t.is(
      name,
      'default',
      'The argument "name" given to the unlink callback are not correct',
    );
    t.is(
      obj,
      role,
      'The argument "obj" given to the unlink callback are not correct',
    );
  });

  user.unlink(role2, () => {
    unlinkCallbackCalled2 = true;
  });

  await user.save();
  t.true(
    unlinkCallbackCalled,
    'The provided callback for unlinking was not called.',
  );
  t.true(
    unlinkCallbackCalled2,
    'The provided callback for the second(!) unlinking was not called.',
  );
  const relationKeys = await keys(redis, relationsPrefix + '*');
  const check =
    (Array.isArray(relationKeys) && relationKeys.length === 0) ||
    relationKeys === null;
  t.true(check, 'Unlinking an object did not delete keys.');
});

test.serial('deepLink', async (t) => {
  const user = new UserLinkMockup();
  const role = new RoleLinkMockup();
  const comment = new CommentLinkMockup();
  let userLinkCallbackCalled = false;
  let commentLinkCallbackCalled = false;

  role.link(user, () => {
    userLinkCallbackCalled = true;
  });
  user.link(comment, () => {
    commentLinkCallbackCalled = true;
  });

  await role.save();
  t.true(userLinkCallbackCalled, 'The user link callback was not called.');
  t.true(
    commentLinkCallbackCalled,
    'The comment link callback was not called.',
  );
  t.true(
    user.id !== null,
    'The deep linked user does not have an id and thus is probably not saved correctly.',
  );
  t.true(
    comment.id !== null,
    'The deep linked comment does not have an id and thus is probably not saved correctly.',
  );
  const value = await smembers(
    redis,
    relationsPrefix +
      comment.modelName +
      ':defaultForeign:' +
      user.modelName +
      ':' +
      comment.id,
  );
  t.is(
    value[0],
    user.id,
    'The user does not have the necessary relations saved. There are probably more problems, if this occurs.',
  );
});

test.serial('removeUnlinks', async (t) => {
  // uses unlinkAll in remove
  const user = new UserLinkMockup();
  const role = new RoleLinkMockup();
  const role2 = new RoleLinkMockup();
  const comment = new CommentLinkMockup();
  const linkName = 'creator';

  user.property('name', 'removeUnlinks');

  role.link(user, linkName);
  user.link(role, 'isA');
  user.link(comment);
  role2.link(user);

  await role2.save();
  const tmpId = user.id;

  await user.remove();

  const foreignRoleLinkExists = await exists(
    redis,
    relationsPrefix +
      user.modelName +
      ':' +
      linkName +
      'Foreign:' +
      role.modelName +
      ':' +
      tmpId,
  );
  t.is(
    foreignRoleLinkExists,
    0,
    'The foreign link to the custom-link-name role was not deleted',
  );

  const roleLinkExists = await exists(
    redis,
    relationsPrefix +
      role.modelName +
      ':' +
      linkName +
      ':' +
      user.modelName +
      ':' +
      role.id,
  );
  t.is(
    roleLinkExists,
    0,
    'The link to the custom-link-name role was not deleted',
  );

  const commentLinkExists = await exists(
    redis,
    relationsPrefix +
      user.modelName +
      ':default:' +
      comment.modelName +
      ':' +
      tmpId,
  );
  t.is(commentLinkExists, 0, 'The link to the child comment was not deleted');

  const foreignCommentIds = await sismember(
    redis,
    relationsPrefix +
      comment.modelName +
      ':defaultForeign:' +
      user.modelName +
      ':' +
      comment.id,
    tmpId,
  );
  t.is(foreignCommentIds, 0, 'The link to the comment parent was not deleted');

  const roleParentIds = await sismember(
    redis,
    relationsPrefix +
      role2.modelName +
      ':default:' +
      user.modelName +
      ':' +
      role2.id,
    tmpId,
  );
  t.is(
    roleParentIds,
    0,
    'The removal did not delete the link from a parent to the object itself.',
  );
});

test.serial('belongsTo', async (t) => {
  const user = new UserLinkMockup();
  const role = new RoleLinkMockup();

  user.link(role);

  await user.save();
  const belongs = await user.belongsTo(role);
  t.is(belongs, true, 'The link was not detected correctly by belongsTo()');
});

test.serial('getAll', async (t) => {
  const user = new UserLinkMockup();
  const role = new RoleLinkMockup();
  const role2 = new RoleLinkMockup();

  user.link(role);
  user.link(role2);

  await user.save();
  const should = [role.id, role2.id].sort();
  const relationIds = await user.getAll(role.modelName);
  t.true(Array.isArray(relationIds), 'getAll() did not return an array.');
  t.deepEqual(
    relationIds.sort(),
    should,
    'getAll() did not return the correct array',
  );
});

test.serial('getAll with different id generators', async (t) => {
  const user = new UserLinkMockup();
  const comment = new CommentLinkMockup();

  user.link(comment);

  await user.save();
  const should = [comment.id];
  const relationIds = await user.getAll(comment.modelName);
  t.deepEqual(relationIds, should, 'getAll() did not return the correct array');
});

test.serial('numLinks', async (t) => {
  const user = new UserLinkMockup();
  const role = new RoleLinkMockup();
  const role2 = new RoleLinkMockup();
  user.link(role);
  user.link(role2);

  await user.save();
  const numLinks = await user.numLinks(role.modelName);
  t.is(numLinks, 2, 'The number of links was not returned correctly');
});

test.serial('deep link errors', async (t) => {
  const user = new UserLinkMockup();
  const role = new RoleLinkMockup();
  const comment = new CommentLinkMockup();
  role.link(user);
  user.link(comment);
  comment.property('text', ''); // makes the comment fail

  try {
    await role.save();
  } catch (err) {
    t.true(
      user.id !== null,
      'The deep linked user does not have an id and thus is probably not saved correctly.',
    );
    t.is(
      comment.id,
      null,
      'The deep linked erroneous comment does not have an id and thus is probably saved.',
    );
    t.true(
      err instanceof nohm.LinkError,
      'The deep linked comment did not produce a top-level LinkError.',
    );
    t.is(
      err.errors.length,
      1,
      'The deep linked role did not fail in a child or reported it wrong.',
    );
    t.true(
      err.errors[0].error instanceof nohm.ValidationError,
      'The deep linked comment did not produce a ValidationError.',
    );
    t.deepEqual(
      err.errors[0].child.errors,
      { text: ['notEmpty'] },
      'The deep linked role did not fail.',
    );
    t.is(
      err.errors[0].child.modelName,
      'CommentLinkMockup',
      'The deep linked role failed in the wrong model or reported it wrong.',
    );
    t.is(
      err.errors[0].parent.modelName,
      'UserLinkMockup',
      'The deep linked role failed in the wrong model or reported it wrong.',
    );
  }
});

test.serial('linkToSelf', async (t) => {
  const user = new UserLinkMockup();
  user.link(user);

  await user.save();
  t.true(true, 'Linking an object to itself failed.');
});

test.serial('deppLinkErrorCallback', async (t) => {
  const user = new UserLinkMockup();
  const role = new RoleLinkMockup();
  const comment = new CommentLinkMockup();
  role.link(user, {
    error: (err, obj) => {
      console.log(err, obj.errors, obj.allProperties());
      t.fail(
        'Error callback for role.link(user) called even though user is valid.',
      );
    },
  });
  user.link(comment, {
    error: (err, obj) => {
      t.true(
        err instanceof nohm.ValidationError,
        'err in error callback was not a ValidationError',
      );
      t.is(comment, obj, 'obj in Error callback was not the right object.');
    },
  });
  comment.property('text', ''); // makes the comment fail

  try {
    await role.save();
  } catch (err) {
    t.true(
      user.id !== null,
      'The deep linked user does not have an id and thus is probably not saved correctly.',
    );
    t.is(
      comment.id,
      null,
      'The deep linked erroneous comment does not have an id and thus is probably saved.',
    );
    t.true(
      err instanceof nohm.LinkError,
      'The deep linked role did not fail in a child or reported it wrong.',
    );
    t.is(
      err.errors[0].child.modelName,
      'CommentLinkMockup',
      'The deep linked role failed in the wrong model or reported it wrong.',
    );
  }
});

test.serial('continueOnError', async (t) => {
  const user = new UserLinkMockup();
  const role = new RoleLinkMockup();
  const comment = new CommentLinkMockup();
  const comment2 = new CommentLinkMockup();
  const comment3 = new CommentLinkMockup();
  role.link(user, {
    error: (err, obj) => {
      console.log(err, obj.errors, obj.allProperties());
      t.fail(
        'Error callback for role.link(user) called even though user is valid.',
      );
    },
  });
  user.link(comment, {
    error: (err, obj) => {
      t.true(
        err instanceof nohm.ValidationError,
        'err in error callback was not a ValidationError',
      );
      t.is(comment, obj, 'obj in Error callback was not the right object.');
    },
  });
  user.link(comment2, {
    error: (err, obj) => {
      console.log(err, obj.errors, obj.allProperties());
      t.fail(
        'Error callback for comment2.link(user) called even though user is valid.',
      );
    },
  });
  user.link(comment3, {
    error: (err, obj) => {
      console.log(err, obj.errors, obj.allProperties());
      t.fail(
        'Error callback for comment3.link(user) called even though user is valid.',
      );
    },
  });
  comment.property('text', ''); // makes the first comment fail

  try {
    await role.save();
  } catch (e) {
    t.true(
      e instanceof nohm.LinkError,
      'Error thrown by save() was not a link error.',
    );
    t.is(e.errors.length, 1, 'LinkError contained too many error items');
    t.is(e.errors[0].parent, user, 'LinkError parent was not user.');
    t.is(e.errors[0].child, comment, 'LinkError child was not comment.');
    t.true(
      e.errors[0].error instanceof nohm.ValidationError,
      'LinkError contained error was not ValidationError.',
    );
    const commentForeignUserIds = await sismember(
      redis,
      relationsPrefix +
        comment3.modelName +
        ':defaultForeign:' +
        user.modelName +
        ':' +
        comment3.id,
      user.id,
    );
    t.is(commentForeignUserIds, 1, 'The comment3 relation was not saved');
  }
});

/* Maybe this isn't such a good idea. I like that model definitions are completely
   lacking relation definitions.
cascadingDeletes: function (t) {
  const user = new UserLinkMockup(),
  role = new RoleLinkMockup(),
  comment = new CommentLinkMockup(),
  testComment = new CommentLinkMockup();
  ;

  user.link(role);
  role.link(comment);

  user.save(function (err) {
    if (err) {
      console.dir(err);

    }
    const testid = comment.id;
    user.remove(function (err) {
      if (err) {
        console.dir(err);

      }
      testComment.load(testid, function (err) {
        t.is(err, 'not found', 'Removing an object that has cascading deletes did not remove the relations');

      });
    });
  });
};*/
