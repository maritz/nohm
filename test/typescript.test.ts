import test from 'ava';

import * as args from './testArgs';

import { cleanUpPromise } from './helper';

import { Nohm, NohmModel, TTypedDefinitions, ValidationError } from '../ts';
import {
  integerProperty,
  IPropertyDiff,
  stringProperty,
} from '../ts/model.header';

const nohm = Nohm;

const redis = args.redis;

/*
 * This file tests a bunch of Stuff for Typescript just by being compiled in addition to
 * being included in the nodeunit tests.
 */

interface IUserLinkProps {
  name: string;
  test: string;
  number: number;
}
// tslint:disable:max-classes-per-file
class UserMockup extends NohmModel<IUserLinkProps> {
  public static modelName = 'UserMockup';
  public publish = true;
  protected static idGenerator = 'increment';
  protected static definitions = {
    name: {
      defaultValue: 'defaultName',
      type: stringProperty,
      validations: ['notEmpty'],
    },
    number: {
      defaultValue: 123,
      type: integerProperty,
      validations: ['notEmpty'],
    },
    test: {
      defaultValue: 'defaultTest',
      type: stringProperty,
      validations: ['notEmpty'],
    },
  };

  public testMethodTypecheck(
    _arg1: string,
    _arg2: number,
  ): undefined | string | (() => any) {
    return this.options.idGenerator;
  }
}
const userMockupClass = nohm.register(UserMockup);

interface ICommentProps {
  text: string;
}
const commentMockup = nohm.register(
  class extends NohmModel<ICommentProps> {
    public static modelName = 'CommentMockup';

    protected static definitions: TTypedDefinitions<ICommentProps> = {
      text: {
        defaultValue: 'defaultComment',
        type: 'string',
        validations: ['notEmpty'],
      },
    };

    get pName(): string {
      return this.allProperties().text;
    }

    set pName(value: string) {
      this.property('text', value);
    }
  },
);

interface IRoleLinkProps {
  name: string;
}
class RoleLinkMockup extends NohmModel<IRoleLinkProps> {
  public static modelName = 'RoleLinkMockup';
  protected static definitions: TTypedDefinitions<IRoleLinkProps> = {
    name: {
      defaultValue: 'admin',
      type: 'string',
    },
  };

  get pName(): string {
    return this.allProperties().name;
  }
}
const roleLinkMockup = nohm.register(RoleLinkMockup);

const prefix = args.prefix + 'typescript';

test.before(async () => {
  nohm.setPrefix(prefix);
  await args.setClient(nohm, redis);
  await cleanUpPromise(redis, prefix);
});

test.afterEach(async () => {
  await cleanUpPromise(redis, prefix);
});

test.serial('static methods', async (t) => {
  interface IAdditionalMethods {
    test1(): Promise<boolean>;
    test2(player: any): Promise<void>;
  }

  const simpleModel = nohm.model<IAdditionalMethods>(
    'SimpleModelRegistration',
    {
      properties: {
        name: {
          defaultValue: 'simple',
          type: 'string',
        },
      },
      // tslint:disable-next-line:object-literal-sort-keys
      methods: {
        test1(): Promise<boolean> {
          return this.validate();
        },
        async test2(player: any) {
          await this.save();
          this.link(player, 'leader');
          this.link(player);
        },
      },
    },
  );

  t.is(
    typeof commentMockup.findAndLoad,
    'function',
    'findAndLoad was not set on commentMockup',
  );
  t.is(
    typeof commentMockup.sort,
    'function',
    'findAndLoad was not set on commentMockup',
  );
  t.is(
    typeof commentMockup.find,
    'function',
    'findAndLoad was not set on commentMockup',
  );
  t.is(
    typeof simpleModel.findAndLoad,
    'function',
    'findAndLoad was not set on commentMockup',
  );
  t.is(
    typeof simpleModel.sort,
    'function',
    'findAndLoad was not set on commentMockup',
  );
  t.is(
    typeof simpleModel.find,
    'function',
    'findAndLoad was not set on commentMockup',
  );
  const testInstance = new simpleModel();
  testInstance.test1();
});

test.serial('instances', async (t) => {
  const comment = new commentMockup();
  const user = await nohm.factory<UserMockup>('UserMockup');
  try {
    const role = new RoleLinkMockup();
    // do something with role so it doesn't cause a compile error
    await role.remove();
    t.fail('Directly constructing a class did not throw an error.');
  } catch (err) {
    t.is(
      err.message,
      'Class is not extended properly. Use the return Nohm.register() instead of your class directly.',
      'Directly constructing a class did not throw the correct error.',
    );
  }

  t.is(
    comment.property('text'),
    'defaultComment',
    'Getting property text of comment failed',
  );
  t.is(
    user.property('test'),
    'defaultTest',
    'Getting property test of user failed',
  );
  t.is(
    user.allProperties().name,
    'defaultName',
    'Getting allProperties().name of user failed',
  );
  t.is(await user.validate(), true, 'Checking validity failed');
  t.deepEqual(user.errors.name, [], 'Error was set?');
  await user.save();
  const users = await userMockupClass.findAndLoad<UserMockup>({});
  const numbers: Array<number> = users.map((x) => x.property('number'));
  t.deepEqual(numbers, [123]);
});

test.serial(
  'method declaration is type checked & idGenerator set from static',
  async (t) => {
    const testInstance = await nohm.factory<UserMockup>('UserMockup');
    const idGenerator:
      | undefined
      | string
      | (() => any) = testInstance.testMethodTypecheck('asd', 123);
    t.is(idGenerator, 'increment', 'The type check method returned false.');
  },
);

test.serial('typing in property()', async (t) => {
  const user = await nohm.factory<UserMockup>('UserMockup');

  const name: string = user.property('name');
  const num: number = user.property('number', 456);
  const multiple = user.property({
    name: 'changedName',
    number: 789,
  });

  t.is(name, 'defaultName', 'Getting assigned and typed name of user failed.');
  t.is(num, 456, 'Getting assigned and typed number of user failed.');
  t.is(
    multiple.name,
    'changedName',
    'Getting assigned and typed multi.name of user failed.',
  );
  t.is(
    multiple.number,
    789,
    'Getting assigned and typed multi.number of user failed.',
  );
  t.is(
    multiple.test,
    undefined,
    'Getting assigned and typed multi.test of user failed.',
  );
});

test.serial('typing in find()', async (t) => {
  const user = await nohm.factory<UserMockup>('UserMockup');

  try {
    await user.find({
      name: 'changedName',
      number: 789,
    });

    await userMockupClass.find<IUserLinkProps>({
      name: 'changedName',
      number: 789,
    });

    await userMockupClass.findAndLoad<UserMockup, IUserLinkProps>({
      name: 'changedName',
      number: 789,
    });
  } catch (e) {
    // properties aren't indexed, whatever... just testing that the generics are right and manually testing errors
    // in find options
    t.pass("I'm sure it's fine.");
  }
});

test.serial('typing in subscribe()', async (t) => {
  await nohm.setPubSubClient(args.secondaryClient);

  const user = await nohm.factory<UserMockup>('UserMockup');
  const role = new roleLinkMockup();

  let propertyDiff: Array<void | IPropertyDiff<keyof IUserLinkProps>>;
  let userId: string;

  const initialProps = user.allProperties();
  await user.subscribe('create', (payload) => {
    t.is(payload.target.id, user.id, 'id in create handler was wrong');
    if (user.id) {
      userId = user.id; // used in other tests
    }
    t.is(
      payload.target.modelName,
      user.modelName,
      'modelname in create handler was wrong',
    );
    t.deepEqual(
      payload.target.properties,
      {
        ...initialProps,
        id: userId,
      },
      'properties in create handler were wrong',
    );
  });
  await user.subscribe('link', (payload) => {
    t.is(payload.child.id, user.id, 'id in link handler CHILD was wrong');
    t.is(
      payload.child.modelName,
      user.modelName,
      'modelname in link handler CHILD was wrong',
    );
    t.deepEqual(
      payload.child.properties,
      user.allProperties(),
      'properties in link handler CHILD were wrong',
    );
    t.is(payload.parent.id, role.id, 'id in link handler PARENT was wrong');
    t.is(
      payload.parent.modelName,
      role.modelName,
      'modelname in link handler PARENT was wrong',
    );
    t.deepEqual(
      payload.parent.properties,
      role.allProperties(),
      'properties in link handler PARENT were wrong',
    );
  });
  await user.subscribe('update', (payload) => {
    t.is(payload.target.id, user.id, 'id in update handler was wrong');
    t.is(
      payload.target.modelName,
      user.modelName,
      'modelname in update handler was wrong',
    );
    t.deepEqual(
      payload.target.properties,
      user.allProperties(),
      'properties in update handler was wrong',
    );
    t.deepEqual(
      payload.target.diff,
      propertyDiff,
      'properties in update handler were wrong',
    );
  });
  await user.subscribe('remove', (payload) => {
    t.not(payload.target.id, null, 'id in remove handler was null');
    t.is(payload.target.id, userId, 'id in remove handler was wrong');
    t.is(
      payload.target.modelName,
      user.modelName,
      'modelname in remove handler was wrong',
    );
    t.deepEqual(
      payload.target.properties,
      user.allProperties(),
      'properties in remove handler were wrong',
    );
  });

  await user.save();
  user.link(role);
  user.property('name', 'foobar');
  propertyDiff = user.propertyDiff();
  await user.save();
  await user.remove();
});

test.serial('validation errors', async (t) => {
  // see above for their different ways of setup/definition
  const user = await nohm.factory<UserMockup>('UserMockup');
  user.property('name', '');
  try {
    await user.save();
    t.fail('No error thrown thrown');
  } catch (err) {
    if (err instanceof ValidationError && err.modelName === 'UserMockup') {
      t.deepEqual((err as ValidationError<IUserLinkProps>).errors.name, [
        'notEmpty',
      ]);
    } else {
      t.fail('Wrong kind of error thrown.');
    }
  }
});
