var util = require('util');
var Nohm = require(__dirname+'/../lib/nohm').Nohm;
var redis = Nohm.client;
var UserConnectMockup = Nohm.model('UserConnectMockup', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'testName',
      validations: [
        'notEmpty',
        ['minLength', 2]
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
    ecludedProperty: {
      type: 'string',
      defaultValue: 'asd',
      validations: [
        'notEmpty'
      ]
    },
    ecludedValidation: {
      type: 'string',
      defaultValue: 'asd',
      validations: [
        'notEmpty',
        ['minLength', 2]
      ]
    }
  }
});
Nohm.model('ExcludedConnectMockup', {
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
var vm = require('vm');

var setup = function (t, expected, options, callback) {
  t.expect(3+expected);
  var length = 0;
  var headersSet = false;
  var namespace = (options && options.namespace) ? options.namespace : 'nohmValidations';
  var dummyRes = {
    writeHead: function (status, headers) {
      t.ok(headers['Content-Length'] > 0, 'Header Content-Length was 0');
      length = headers['Content-Length'];
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
  
  Nohm.connect(options)({url: url }, dummyRes, function () {
    t.ok(false, 'Connect middleware called next with valid url.');
    t.done();
  });
};

exports.connectNoOptions = function (t) {
  var user = new UserConnectMockup();
  
  setup(t, 2, undefined, function (sandbox, str) {
    var val = sandbox.nohmValidations.models.UserConnectMockup;
    t.ok(val.name.indexOf('notEmpty') === 0, 'UserConnectMockup did not have the proper validations');
    t.same(val.name[1], ['minLength', 2], 'UserConnectMockup did not have the proper validations');
    t.done();
  });
};

exports.connectValidate = function (t) {
  var user = new UserConnectMockup();
  
  setup(t, 2, undefined, function (sandbox, str) {
    var val = sandbox.nohmValidations.validate;
    var valid = val('UserConnectMockup', {name: 'asd'});
    t.same(valid, true, 'Validate did not work as expected.');
    
    var errors = val('UserConnectMockup', {name: 'a'});
    t.same(errors, {name: ['minLength']}, 'Validate did not work as expected.');
    t.done();
  });
};

exports.connectOptions = function (t) {
  var user = new UserConnectMockup();
  
  setup(t, 1, {url: './nohm.js', namespace: 'hurgel'}, function (sandbox, str) {
    t.ok(sandbox.hurgel, 'Namespace option not successful');
    t.done();
  });
};

exports.connectExtraFiles = function (t) {
  var user = new UserConnectMockup();
  
  setup(t, 1, {extraFiles: __dirname+'/custom_validations2.js'}, function (sandbox, str) {
    var errors = sandbox.nohmValidations.validate('UserConnectMockup', {
      customValidationFile: 'NOPE',
      customValidationFileTimesTwo: 'NOPE'
      });
    t.same(errors, {
        customValidationFile: ['customValidationFile'],
        customValidationFileTimesTwo: ['customValidationFileTimesTwo']
      }, 'Validate did not work as expected.');
    t.done();
  });
};

exports.connectExceptions = function (t) {
  var user = new UserConnectMockup();
  
  setup(t, 2, {exclusions: {
    UserConnectMockup: {
      excludedValidation: [1],
      excludedProperty: true
    },
    ExcludedConnectMockup: true
  }}, function (sandbox, str) {
    var errors = sandbox.nohmValidations.validate('UserConnectMockup', {
      excludedValidation: 'a',
      excludedProperty: ''
    });
    t.same(errors, true, 'Validate did not work as expected with exclusions.');
  
    try {
      errors = sandbox.nohmValidations.validate('ExcludedConenctMockup', {
        name: ''
      });
    } catch (e) {
      t.same(e.message, 'Invalid modelName passed to nohm or model was not properly exported.', 'Validate did not work as expected with exclusions.');
    }
    t.done();
  });
};