import test, { ExecutionContext } from 'ava';

import { nohm } from '../ts';

import * as args from './testArgs.js';

import * as vm from 'vm';
import { ServerResponse } from 'http';
import { IMiddlewareOptions } from '../ts/middleware';

const redis = args.redis;

test.before(async (t) => {
  nohm.setPrefix(args.prefix);
  await args.setClient(nohm, redis);
});

nohm.setExtraValidations(__dirname + '/custom_validations.js');

nohm.model('UserMiddlewareMockup', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'testName',
      validations: [
        'notEmpty',
        {
          name: 'length',
          options: {
            min: 2,
          },
        },
      ],
    },
    customValidationFile: {
      type: 'string',
      defaultValue: 'customValidationFile',
      validations: ['customValidationFile'],
    },
    customValidationFileTimesTwo: {
      type: 'string',
      defaultValue: 'customValidationFileTimesTwo',
      validations: ['customValidationFileTimesTwo'],
    },
    excludedProperty: {
      type: 'string',
      defaultValue: 'asd',
      validations: ['notEmpty'],
    },
    excludedValidation: {
      type: 'string',
      defaultValue: 'asd',
      validations: [
        'notEmpty',
        {
          name: 'length',
          options: {
            min: 2,
          },
        },
      ],
    },
  },
});
nohm.model('ExcludedMiddlewareMockup', {
  properties: {
    name: {
      type: 'string',
      defaultValue: '',
      validations: ['notEmpty'],
    },
  },
});

const setup = (
  t: ExecutionContext<unknown>,
  expected: number,
  options: IMiddlewareOptions,
): Promise<{ sandbox: any; str: string }> => {
  return new Promise((resolve) => {
    t.plan(3 + expected);
    let length = 0;
    let headersSet = false;
    const namespace =
      options && options.namespace ? options.namespace : 'nohmValidations';
    const dummyRes = {
      setHeader(name: string, value: string | number) {
        if (name === 'Content-Length') {
          t.true(value > 0, 'Header Content-Length was 0');
          if (typeof value === 'string') {
            length = parseInt(value, 10);
          } else {
            length = value;
          }
        }
        headersSet = true;
      },
      end(str: string) {
        const sandbox = {
          window: {},
          console,
        };
        t.true(headersSet, 'Headers were not set before res.end() was called');
        t.is(
          length,
          str.length,
          'Content-Length was not equal to the actual body length',
        );
        try {
          // fixes the problem that in the browser we'd have globals automatically in window, here we don't.
          str = str.replace(
            /(typeof \(exports\) === 'undefined')/,
            '(window[nohmValidationsNamespaceName] = ' + namespace + ') && $1',
          );

          vm.runInNewContext(str, sandbox, 'validations.vm');
        } catch (e) {
          console.log(str);
          console.log('Parsing the javascript failed: ' + e.message);
          console.log(e.stack);
          t.fail('Parsing javascript failed.');
        }
        resolve({ sandbox, str });
      },
    };

    const url = options && options.url ? options.url : '/nohmValidations.js';

    // `{ url } as any` because url should be the only part of the IncomingMessage argument that is used
    nohm.middleware(options)({ url } as any, dummyRes as ServerResponse, () => {
      t.fail(
        'nohm.middleware() called next even though a valid middleware url was passed.',
      );
    });
  });
};

test('no options passed', async (t) => {
  const { sandbox } = await setup(t, 2, undefined);
  const val = sandbox.nohmValidations.models.UserMiddlewareMockup;
  t.is(
    val.name.indexOf('notEmpty'),
    0,
    'UserMiddlewareMockup did not have the proper validations',
  );
  t.deepEqual(
    val.name[1],
    {
      name: 'length',
      options: {
        min: 2,
      },
    },
    'UserMiddlewareMockup did not have the proper validations',
  );
});

test('validation', async (t) => {
  const { sandbox } = await setup(t, 3, undefined);
  const val = sandbox.nohmValidations.validate;
  const validation = await val('UserMiddlewareMockup', {
    name: 'asd',
    excludedProperty: 'asd',
    excludedValidation: 'asd',
  });
  t.true(validation.result, 'Validate did not work as expected.');

  const validation2 = await val('UserMiddlewareMockup', {
    name: 'a',
    excludedProperty: '',
    excludedValidation: 'a',
  });
  t.false(validation2.result, 'Validate did not work as expected.');
  t.deepEqual(
    validation2.errors,
    {
      name: ['length'],
      excludedProperty: ['notEmpty'],
      excludedValidation: ['length'],
    },
    'Validate did not work as expected.',
  );
});

test('options', async (t) => {
  const { sandbox } = await setup(t, 1, {
    url: './nohm.js',
    namespace: 'hurgel',
  });
  t.snapshot(sandbox.hurgel, 'Namespace option not successful');
});

test('extra files', async (t) => {
  const { sandbox } = await setup(t, 1, {
    extraFiles: __dirname + '/custom_validations2.js',
  });
  const validation = await sandbox.nohmValidations.validate(
    'UserMiddlewareMockup',
    {
      customValidationFile: 'NOPE',
      customValidationFileTimesTwo: 'NOPE',
    },
  );
  t.deepEqual(
    validation.errors,
    {
      customValidationFile: ['customValidationFile'],
      customValidationFileTimesTwo: ['customValidationFileTimesTwo'],
    },
    'Validate did not work as expected.',
  );
});

test('exceptions', async (t) => {
  const { sandbox } = await setup(t, 2, {
    exclusions: {
      UserMiddlewareMockup: {
        excludedValidation: [1],
        excludedProperty: true,
      },
      ExcludedMiddlewareMockup: true,
    },
  });
  const validate = sandbox.nohmValidations.validate;
  const validation = await validate('UserMiddlewareMockup', {
    excludedValidation: 'a',
    excludedProperty: '',
  });
  t.true(
    validation.result,
    'Validate did not work as expected with exclusions.',
  );

  try {
    await validate('ExcludedMiddlewareMockup', {
      name: '',
    });
    t.fail('Validate should have thrown an error about an invalid modelName');
  } catch (e) {
    t.is(
      e.message,
      'Invalid modelName passed to nohm or model was not properly exported.',
      'Validate did not work as expected with exclusions.',
    );
  }
});

test('validate empty', async (t) => {
  const { sandbox } = await setup(t, 1, undefined);
  const val = sandbox.nohmValidations.validate;
  const validation = await val('UserMiddlewareMockup', {
    excludedProperty: 'asd',
    excludedValidation: 'asd',
  });
  t.true(validation.result, 'Validate did not work as expected.');
});

test('validate undefined', async (t) => {
  const { sandbox } = await setup(t, 2, undefined);
  const val = sandbox.nohmValidations.validate;
  try {
    const result = await val('UserMiddlewareMockup', {
      name: undefined,
    });
    t.false(result.result, 'Validating with name undefined succeeded');
    t.deepEqual(
      result.errors,
      { name: ['length', 'notEmpty'] },
      'Validating with name undefined had wrong errors object.',
    );
  } catch (e) {
    t.fail('Validate threw an error on undefined data.');
  }
});
