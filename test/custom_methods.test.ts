import test from 'ava';
import * as td from 'testdouble';

import { nohm } from '../ts';
import * as args from './testArgs';
import { sleep } from './helper';

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

// tslint:disable-next-line:variable-name
const MethodOverwrite = nohm.model('methodOverwrite', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'test',
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

test('methodsSuper', async (t) => {
  const warnDouble = td.replace(global.console, 'warn');

  const methodOverwriteSuperMethod = nohm.model(
    'methodOverwriteSuperMethod',
    {
      properties: {
        name: {
          type: 'string',
          defaultValue: 'test',
          unique: true,
          validations: ['notEmpty'],
        },
      },
      methods: {
        prop: function prop(name) {
          if (name === 'super') {
            // @ts-ignore _super_prop is dynamically added, not elegant but the only way this works right now
            return this._super_prop('name');
          } else {
            // @ts-ignore _super_prop is dynamically added
            return this._super_prop.apply(this, arguments, 0);
          }
        },
      },
    },
    // temporary model definition to prevent connectMiddleware later from throwing a bunch of deprecation warnings
    // TODO: since ava runs tests as isolated processes, this could be removed, right?!
    true,
  );

  const methodOverwrite = new methodOverwriteSuperMethod();

  // wait 100ms because the warning from the constructor is delayed as well.
  await sleep(100);
  td.verify(
    warnDouble,
    warnDouble(
      '\x1b[31m%s\x1b[0m',
      `WARNING: Overwriting existing property/method 'prop' in 'methodOverwriteSuperMethod' because of method definition.`,
    ),
  );

  t.is(
    typeof methodOverwrite.prop,
    'function',
    'Overwriting a method in a model definition did not create that method on a new instance.',
  );
  t.is(
    // @ts-ignore _super_prop is dynamically added
    typeof methodOverwrite._super_prop,
    'function',
    'Overwriting a method in a model definition did not create the _super_ method on a new instance.',
  );
  t.is(
    methodOverwrite.prop('super'),
    methodOverwrite.property('name'),
    'The super test method did not work properly.',
  );
  td.verify(
    warnDouble,
    warnDouble(
      '\x1b[31m%s\x1b[0m',
      'DEPRECATED: Usage of NohmModel.prop() is deprecated, use NohmModel.property() instead.',
    ),
  );
  methodOverwrite.prop('name', 'methodTest');
  td.verify(
    warnDouble,
    warnDouble(
      '\x1b[31m%s\x1b[0m',
      'DEPRECATED: Usage of NohmModel.prop() is deprecated, use NohmModel.property() instead.',
    ),
  );

  t.is(
    methodOverwrite.property('name'),
    'methodTest',
    'The super test method did not properly handle arguments',
  );
  td.reset();
});

test('no super method if none needed', async (t) => {
  const instance = new normalModel();

  t.true(
    !instance.hasOwnProperty('_super_test'),
    'Defining a method that does not overwrite a nohm method created a _super_.',
  );
});
