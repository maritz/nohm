var nohm = require(__dirname + '/../tsOut/').Nohm;
var args = require(__dirname + '/testArgs.js');
var redis = args.redis;
var h = require(__dirname + '/helper.js');
var vm = require('vm');

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
            min: 2
          }
        }
      ]
    },
    customValidationFile: {
      type: 'string',
      defaultValue: 'customValidationFile',
      validations: [
        'customValidationFile'
      ]
    },
    customValidationFileTimesTwo: {
      type: 'string',
      defaultValue: 'customValidationFileTimesTwo',
      validations: [
        'customValidationFileTimesTwo'
      ]
    },
    excludedProperty: {
      type: 'string',
      defaultValue: 'asd',
      validations: [
        'notEmpty'
      ]
    },
    excludedValidation: {
      type: 'string',
      defaultValue: 'asd',
      validations: [
        'notEmpty',
        {
          name: 'length',
          options: {
            min: 2
          }
        }
      ]
    }
  }
});
nohm.model('ExcludedMiddlewareMockup', {
  properties: {
    name: {
      type: 'string',
      defaultValue: '',
      validations: [
        'notEmpty'
      ]
    }
  }
});

var setup = function (t, expected, options, callback) {
  t.expect(3 + expected);
  var length = 0;
  var headersSet = false;
  var namespace = (options && options.namespace) ? options.namespace : 'nohmValidations';
  var dummyRes = {
    setHeader: function (name, value) {
      if (name === "Content-Length") {
        t.ok(value > 0, 'Header Content-Length was 0');
        length = value;
      }
      headersSet = true;
    },
    end: function (str) {
      var sandbox = {
        window: {},
        console: console
      };
      t.ok(headersSet, 'Headers were not set before res.end() was called');
      t.same(length, str.length, 'Content-Length was not equal to the actual body length');
      try {

        // fixes the problem that in the browser we'd have globals automatically in window, here we don't.
        str = str.replace(/(typeof \(exports\) === 'undefined')/,
          '(window[nohmValidationsNamespaceName] = ' + namespace + ') && $1');

        vm.runInNewContext(str, sandbox, 'validations.vm');
      } catch (e) {
        console.log(str);
        console.log('Parsing the javascript failed: ' + e.message);
        console.log(e.stack);
        t.done();
      }
      callback(sandbox, str);
    }
  };

  var url = (options && options.url) ? options.url : '/nohmValidations.js';

  nohm.middleware(options)({ url: url }, dummyRes, function () {
    t.ok(false, 'nohm.middleware() called next with valid url.');
    t.done();
  });
};


exports.middleware = {

  setUp: function (next) {
    if (!nohm.client) {
      nohm.setClient(redis);
    }
    next();
  },
  tearDown: function (next) {
    h.cleanUp(redis, args.prefix, next);
  },


  middlewareNoOptions: function (t) {

    setup(t, 2, undefined, function (sandbox) {
      var val = sandbox.nohmValidations.models.UserMiddlewareMockup;
      t.ok(val.name.indexOf('notEmpty') === 0, 'UserMiddlewareMockup did not have the proper validations');
      t.same(
        val.name[1],
        {
          name: 'length',
          options: {
            min: 2
          }
        },
        'UserMiddlewareMockup did not have the proper validations'
      );
      t.done();
    });
  },

  middlewareValidate: function (t) {

    setup(t, 3, undefined, async (sandbox) => {
      var val = sandbox.nohmValidations.validate;
      const validation = await val('UserMiddlewareMockup', { name: 'asd', excludedProperty: 'asd', excludedValidation: 'asd' });
      t.same(validation.result, true, 'Validate did not work as expected.');

      const validation2 = await val('UserMiddlewareMockup', { name: 'a', excludedProperty: '', excludedValidation: 'a' });
      t.same(validation2.result, false, 'Validate did not work as expected.');
      t.same(validation2.errors, { name: ['length'], excludedProperty: ['notEmpty'], excludedValidation: ['length'] }, 'Validate did not work as expected.');
      t.done();
    });
  },

  middlewareOptions: function (t) {

    setup(t, 1, { url: './nohm.js', namespace: 'hurgel' }, function (sandbox) {
      t.ok(sandbox.hurgel, 'Namespace option not successful');
      t.done();
    });

  },

  middlewareExtraFiles: function (t) {

    setup(t, 1, { extraFiles: __dirname + '/custom_validations2.js' }, async (sandbox) => {
      const validation = await sandbox.nohmValidations.validate('UserMiddlewareMockup', {
        customValidationFile: 'NOPE',
        customValidationFileTimesTwo: 'NOPE'
      });
      t.same(validation.errors, {
        customValidationFile: ['customValidationFile'],
        customValidationFileTimesTwo: ['customValidationFileTimesTwo']
      }, 'Validate did not work as expected.');
      t.done();
    });

  },

  middlewareExceptions: function (t) {

    setup(t, 2, {
      exclusions: {
        UserMiddlewareMockup: {
          excludedValidation: [1],
          excludedProperty: true
        },
        ExcludedMiddlewareMockup: true
      }
    }, async (sandbox) => {
      var validate = sandbox.nohmValidations.validate;
      const validation = await validate('UserMiddlewareMockup', {
        excludedValidation: 'a',
        excludedProperty: ''
      });
      t.same(validation.result, true, 'Validate did not work as expected with exclusions.');

      try {
        await validate('ExcludedMiddlewareMockup', {
          name: ''
        });
        t.ok(false, 'Validate should have thrown an error about an invalid modelname');
        t.done();
      } catch (e) {
        t.same(e.message, 'Invalid modelName passed to nohm or model was not properly exported.', 'Validate did not work as expected with exclusions.');
      }
      t.done();
    });

  },

  middlewareValidateEmpty: function (t) {

    setup(t, 1, undefined, async (sandbox) => {
      var val = sandbox.nohmValidations.validate;
      const validation = await val('UserMiddlewareMockup', { excludedProperty: 'asd', excludedValidation: 'asd' });
      t.same(validation.result, true, 'Validate did not work as expected.');
      t.done();
    });
  }
};
