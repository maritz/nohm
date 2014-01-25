var nohm = require(__dirname+'/../lib/nohm').Nohm;
var args = require(__dirname+'/testArgs.js');
var redis = args.redis;
var h = require(__dirname+'/helper.js');
var vm = require('vm');

nohm.setExtraValidations(__dirname + '/custom_validations.js');

nohm.model('UserConnectMockup', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'testName',
      validations: [
        'notEmpty',
        ['length', {
            min: 2
          }
        ]
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
        ['length', {
            min: 2
          }
        ]
      ]
    }
  }
});
nohm.model('ExcludedConnectMockup', {
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
  t.expect(3+expected);
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
        str = str.replace(/(typeof\(exports\) === 'undefined')/, 
                          '(window[nohmValidationsNamespaceName] = '+namespace+') && $1');
      
        vm.runInNewContext(str, sandbox, 'validations.vm');
      } catch (e) {
        console.log(str);
        console.log('Parsing the javascript failed: '+e.message);
        console.log(e.stack);
        t.done();
      }
      callback(sandbox, str);
    }
  };
  
  var url = (options && options.url) ? options.url : '/nohmValidations.js';
  
  nohm.connect(options)({url: url }, dummyRes, function () {
    t.ok(false, 'Connect middleware called next with valid url.');
    t.done();
  });
};


exports.connect = {
  
  setUp: function (next) {
    if ( ! nohm.client) {
      nohm.setClient(redis);
    }
    next();
  },
  tearDown: function (next) {
    h.cleanUp(redis, args.prefix, next);
  },
  
  
  connectNoOptions: function (t) {
  
    setup(t, 2, undefined, function (sandbox, str) {
      var val = sandbox.nohmValidations.models.UserConnectMockup;
      t.ok(val.name.indexOf('notEmpty') === 0, 'UserConnectMockup did not have the proper validations');
      t.same(val.name[1], [
        'length', {
            min: 2
          }
        ], 'UserConnectMockup did not have the proper validations');
      t.done();
    });
  },

  connectValidate: function (t) {
      
    setup(t, 2, undefined, function (sandbox) {
      var val = sandbox.nohmValidations.validate;
      val('UserConnectMockup', {name: 'asd', excludedProperty: 'asd', excludedValidation: 'asd'}, function (valid) {
        t.same(valid, true, 'Validate did not work as expected.');
      
        val('UserConnectMockup', {name: 'a', excludedProperty: '', excludedValidation: 'a'}, function (valid, errors) {
          t.same(errors, {name: ['length'], excludedProperty: ['notEmpty'], excludedValidation: ['length']}, 'Validate did not work as expected.');
          t.done();
        });
      });
    });
  },
  
  connectOptions: function (t) {
    
    setup(t, 1, {url: './nohm.js', namespace: 'hurgel'}, function (sandbox) {
      t.ok(sandbox.hurgel, 'Namespace option not successful');
      t.done();
    });
    
  },
  
  connectExtraFiles: function (t) {
    
    setup(t, 1, {extraFiles: __dirname+'/custom_validations2.js'}, function (sandbox) {
      sandbox.nohmValidations.validate('UserConnectMockup', {
        customValidationFile: 'NOPE',
        customValidationFileTimesTwo: 'NOPE'
        }, function (valid, errors) {
          t.same(errors, {
              customValidationFile: ['customValidationFile'],
              customValidationFileTimesTwo: ['customValidationFileTimesTwo']
            }, 'Validate did not work as expected.');
          t.done();
        });
    });
    
  },
  
  connectExceptions: function (t) {
    
    setup(t, 2, {exclusions: {
      UserConnectMockup: {
        excludedValidation: [1],
        excludedProperty: true
      },
      ExcludedConnectMockup: true
    }}, function (sandbox) {
      var validate = sandbox.nohmValidations.validate;
      validate('UserConnectMockup', {
        excludedValidation: 'a',
        excludedProperty: ''
      }, function (valid) {
        t.same(valid, true, 'Validate did not work as expected with exclusions.');
    
        try {
          validate('ExcludedConnectMockup', {
            name: ''
          }, function () {
            t.ok(false, 'Validate should have thrown an error about an invalid modelname');
            t.done();
          });
        } catch (e) {
          t.same(e.message, 'Invalid modelName passed to nohm or model was not properly exported.', 'Validate did not work as expected with exclusions.');
        }
        t.done();
      });
    });  
    
  },
  
  connectValidateEmpty: function (t) {
    
    setup(t, 1, undefined, function (sandbox) {
      var val = sandbox.nohmValidations.validate;
      val('UserConnectMockup', {excludedProperty: 'asd', excludedValidation: 'asd'}, function (valid) {
        t.same(valid, true, 'Validate did not work as expected.');
        t.done();
      });
    });
  }
};