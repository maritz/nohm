import { integerProperty, stringProperty } from './model.header';
import { Nohm, NohmModel, TTypedDefinitions } from './index';

const nohm = Nohm;

// tslint:disable-next-line:no-var-requires
const args = require(__dirname + '/../test/testArgs.js');
const redis = args.redis;
// tslint:disable-next-line:no-var-requires
const h = require(__dirname + '/../test/helper.js');

// tslint:disable:max-classes-per-file

/*
 * This file tests a bunch of Stuff for Typescript just by being compiled in addition to
 * being included in the nodeunit tests.
 */

interface IUserLinkProps {
  name: string;
  test: string;
  number: number;
}
class UserMockup extends NohmModel<IUserLinkProps> {
  public static modelName = 'UserMockup';
  protected static idGenerator = 'increment';
  protected static definitions = {
    name: {
      defaultValue: 'defaultName',
      type: stringProperty,
      validations: [
        'notEmpty',
      ],
    },
    number: {
      defaultValue: 123,
      type: integerProperty,
      validations: [
        'notEmpty',
      ],
    },
    test: {
      defaultValue: 'defaultTest',
      type: stringProperty,
      validations: [
        'notEmpty',
      ],
    },
  };

  public testMethodTypecheck(_arg1: string, _arg2: number): undefined | string | (() => any) {
    return this.options.idGenerator;
  }
}
nohm.register(UserMockup);


interface ICommentProps {
  text: string;
}
const commentMockup = nohm.register(class extends NohmModel<ICommentProps> {
  public static modelName = 'CommentMockup';

  protected static definitions: TTypedDefinitions<ICommentProps> = {
    text: {
      defaultValue: 'defaultComment',
      type: 'string',
      validations: [
        'notEmpty',
      ],
    },
  };

  get pName(): string {
    return this.allProperties().text;
  }

  set pName(value: string) {
    this.property('text', value);
  }
});


interface IRoleLinkProps {
  name: string;
}
class RoleLinkMockup extends NohmModel<IRoleLinkProps> {
  public static modelName = 'RoleLinkMockup';
  protected static definitions: TTypedDefinitions<IRoleLinkProps> = {
    name: {
      defaultValue: 'user',
      type: 'string',
    },
  };

  get pName(): string {
    return this.allProperties().name;
  }
}

exports.Typescript = {

  'setUp': (next: () => any) => {
    if (!nohm.client) {
      nohm.setClient(redis);
    }
    next();
  },
  'tearDown': (next: () => any) => {
    h.cleanUp(redis, args.prefix, next);
  },

  'static methods': async (t: any) => {
    // see above for their different ways of setup/definition
    t.expect(6);

    interface IAdditionalMethods {
      test1(): Promise<boolean>;
      test2(player: any): Promise<void>;
    }

    const simpleModel = nohm.model<IAdditionalMethods>('SimpleModelRegistration', {
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
    });

    t.same(typeof commentMockup.findAndLoad, 'function', 'findAndLoad was not set on commentMockup');
    t.same(typeof commentMockup.sort, 'function', 'findAndLoad was not set on commentMockup');
    t.same(typeof commentMockup.find, 'function', 'findAndLoad was not set on commentMockup');
    t.same(typeof simpleModel.findAndLoad, 'function', 'findAndLoad was not set on commentMockup');
    t.same(typeof simpleModel.sort, 'function', 'findAndLoad was not set on commentMockup');
    t.same(typeof simpleModel.find, 'function', 'findAndLoad was not set on commentMockup');
    const test = new simpleModel();
    test.test1();

    t.done();
  },


  'instances': async (t: any) => {
    // see above for their different ways of setup/definition
    const comment = new commentMockup();
    const user = await nohm.factory<UserMockup>('UserMockup');
    try {
      const role = new RoleLinkMockup();
      t.same(1234, role, 'Directly constructing a class did not throw an error.');
    } catch (err) {
      t.same(
        err.message,
        'Class is not extended proplery. Use the return Nohm.register() instead of your class directly.',
        'Directly constructing a class did not throw the correct error.',
      );
    }

    t.expect(6);

    t.same(comment.property('text'), 'defaultComment', 'Getting property text of comment failed');
    t.same(user.property('test'), 'defaultTest', 'Getting property test of user failed');
    t.same(user.allProperties().name, 'defaultName', 'Getting allProperties().name of user failed');
    t.same(await user.validate(), true, 'Checking validity failed');
    t.same(user.errors.name, [], 'Error was set?');

    t.done();
  },

  'method declaration is typechecked & idgenerator set from static': async (t: any) => {
    t.expect(1);
    const testInstance = await nohm.factory<UserMockup>('UserMockup');
    const idGenerator: undefined | string | (() => any) = testInstance.testMethodTypecheck('asd', 123);
    t.same(idGenerator, 'increment', 'The typecheck method returned false.');
    t.done();
  },

  'typing in property()': async (t: any) => {
    // see above for their different ways of setup/definition
    const user = await nohm.factory<UserMockup>('UserMockup');

    t.expect(5);

    const name: string = user.property('name');
    const num: number = user.property('number', 456);
    const multiple = user.property({
      name: 'changedName',
      number: 789,
    });

    t.ok(name === 'defaultName', 'Getting assigned and typed name of user failed.');
    t.ok(num === 456, 'Getting assigned and typed number of user failed.');
    t.ok(multiple.name === 'changedName', 'Getting assigned and typed multi.name of user failed.');
    t.ok(multiple.number === 789, 'Getting assigned and typed multi.number of user failed.');
    t.ok(multiple.test === undefined, 'Getting assigned and typed multi.test of user failed.');

    t.done();
  },
};

