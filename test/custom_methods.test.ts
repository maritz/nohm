import test from 'ava';

import { nohm } from '../ts';
import * as args from './testArgs';

test.before(async () => {
  await args.setClient(nohm, args.redis);
});

const normalModel = nohm.model('normalModel', {
  properties: {
    name: {
      type: 'string',
    },
  },
});

const MethodOverwrite = nohm.model('methodOverwrite', {
  properties: {
    name: {
      defaultValue: 'test',
      type: 'string',
      unique: true,
      validations: ['notEmpty'],
    },
  },
  methods: {
    // tslint:disable-next-line:no-shadowed-variable
    test: function test() {
      return this.property('name');
    },
  },
});

test('methods', async (t) => {
  const methodOverwrite = new MethodOverwrite();

  t.is(
    // @ts-ignore _super_prop is dynamically added
    typeof methodOverwrite.test,
    'function',
    'Adding a method to a model did not create that method on a new instance.',
  );
  t.is(
    // @ts-ignore _super_prop is dynamically added
    methodOverwrite.test(),
    methodOverwrite.property('name'),
    "The test method did not work properly. (probably doesn't have the correct `this`.",
  );
});

test('overwriting built-in methods throws error', async (t) => {
  const methodOverwriteSuperThrows = nohm.model(
    'methodOverwriteSuperThrows',
    {
      properties: {
        name: {
          defaultValue: 'test',
          type: 'string',
        },
      },
      methods: {
        property: function property() {
          t.fail('Overwriting .properties() worked.');
          return;
        },
      },
    },
    true,
  );
  t.throws(
    () => {
      const methodOverwrite = new methodOverwriteSuperThrows();
      methodOverwrite.property('foo');
    },
    {
      message:
        'Overwriting built-in methods is not supported anymore. Please migrate them to a different name.',
    },
  );
});

test('no super method if none needed', async (t) => {
  const instance = new normalModel();

  t.true(
    !instance.hasOwnProperty('_super_test'),
    'Defining a method that does not overwrite a nohm method created a _super_.',
  );
});
