var Nohm = null;
exports.setNohm = function (originalNohm) {
  Nohm = originalNohm;
  Nohm.connect = connect;
};

/**
 * This is black magic for now. Stay away from it if you can for now!
 */

var fs = require('fs');

var maxDepth = 5;
var customToString = function (obj, depth) {
  depth = depth || 0;
  if (depth > maxDepth) {
    console.log('maxdepth exceeded');
    console.dir(obj);
    return '';
  }
  switch(typeof(obj)) {
    case 'string':
      return '"'+obj+'"';
    case 'number':
      return obj;
    case 'boolean':
      return obj ? 'true' : 'false';
    case 'function':
      if (obj instanceof RegExp) {
        return obj.toString();
      }
      break;
    case 'object':
      if (Array.isArray(obj)) {
        var arr = [];
        obj.forEach(function (val) {
          arr.push(customToString(val, depth+1));
        });
        return '['+arr.join(',')+']';
      } else if (obj instanceof RegExp) {
        return obj.toString();
      } else {
        var arr = [];
        Object.keys(obj).forEach(function (val) {
          arr.push('"'+val+'":'+customToString(obj[val], depth+1));
        });
        return '{'+arr.join(',')+'}';
      }
  }
};

var validationsFlatten = function (model, exclusions) {
  model = new model();
  var props = model.properties;
  var str = model.modelName+': {';
  
  /*
 *          User: { // modelName
 *            name: [0], // this will ignore the first validation in the validation definition array for name in the model definition
 *            salt: true // this will completely ignore all validations for the salt property
 *          },*/
  
  exclusions = exclusions || {};
  var exclusionsStrings = [];
  var exclusionsObject = {};
  Object.keys(exclusions).forEach(function (key) {
    var value = exclusions[key];
    if (Array.isArray(value)) {
      exclusionsObject[key] = value; // value should be like [true, false, true]
    }
    exclusionsStrings.push(key);
  });
  
  Object.keys(props).forEach(function (key) {
    var isExcepted = exclusionsStrings.indexOf(key) !== -1 && ! exclusionsObject.hasOwnProperty(key);
    if ( ! isExcepted) {
      var vals = props[key].validations;
      if (Array.isArray(vals) && vals.length > 0) {
        str += ""+key+': [';
        var strVals = [];
        vals.forEach(function (val, index) {
          if ( ! exclusionsObject[key] || exclusionsObject[key][index]) {
            strVals.push(customToString(val));
          }
        });
        str += strVals.join(',')+'],           ';
      }
    }
  });
  return str+'}';
};

var extraFilesIndex = 0;

var wrapFile = function (fileStr, namespace) {
  var str = namespace+'.extraValidations['+extraFilesIndex+'] = {};(function (exports) {';
  str += fileStr;
  str += '})('+namespace+'.extraValidations['+extraFilesIndex+']);';
  extraFilesIndex++;
  return str;
};

var wrapExtraFiles = function (files, namespace) {
  var str = '';
  files.forEach(function (path) {
    var fileStr = fs.readFileSync(path, 'utf-8');
    str += wrapFile(fileStr, namespace);
  });
  return str;
};

/**
 * Returns a middleware that can deliver the validations as a javascript file
 * and the modelspecific validations as a JSON object to the browser.
 * This is useful if you want to save some bandwith by doing the validations
 * in the browser before saving to the server.
 *
 * Options:
 *    - `url`         - Url under which the js file will be available. Default: '/nohmValidations.js'
 *    - `exclusions`  - Object containing exclusions for the validations export - see example for details
 *    - `namespace`   - Namespace to be used by the js file in the browser. Default: 'nohmValidations'
 *    - `extraFiles`  - Extra files containing validations. You should only use this if they are not already set via Nohm.setExtraValidations as this automatically includes those.
 *    - `maxAge`      - Cache control (in seconds)
 *    - `uglify`      - Boolean. True to enable minification. Requires uglify-js (not in dependencies of nohm!). Default: false // TODO
 * 
 * Example:
 * 
 *    server.use(nohm.connect(
 *      // options object
 *      {
 *        url: '/nohm.js',
 *        namespace: 'nohm',
 *        exclusions: {
 *          User: { // modelName
 *            name: [0], // this will ignore the first validation in the validation definition array for name in the model definition
 *            salt: true // this will completely ignore all validations for the salt property
 *          },
 *          Privileges: true // this will completely ignore the Priviledges model
 *        }
 *      }
 *    ));
 *
 * @param {Object} options Options for the middleware
 * @return {Function}
 * @static
 */
 
function connect(options){
  options = options || {};
  var url = options.url || '/nohmValidations.js';
  var namespace = options.namespace || 'nohmValidations';
  var maxAge = options.maxAge || 3600; // 1 hour
  var exclusions = options.exclusions || {};
  var extraFiles = options.extraFiles || [];
  var uglify = options.uglify || false;
  if ( ! Array.isArray(extraFiles)) {
    extraFiles = [extraFiles];
  }
  
  // collect models
  var arr = [];
  var models = Nohm.getModels();
  Object.keys(models).forEach(function (name) {
    var model = models[name];
    if (exclusions.hasOwnProperty(name) && exclusions[name] === true ) {
      return; // exception set, but no fields
    }
    arr.push(validationsFlatten(model, exclusions[name]));
  });
  
  var str = 'var nohmValidationsNamespaceName = "'+namespace+'";var '+namespace+'={"extraValidations": [], "models":{'+arr.join(',')+'}};';
  
  str += wrapExtraFiles(extraFiles, namespace);
  str += wrapExtraFiles(Nohm.getExtraValidatorFileNames(), namespace); // needs to somehow access the same thing
  str += fs.readFileSync(__dirname+'/validators.js', 'utf-8');
  
  if (uglify) {
    try {
      uglify = require('uglify-js');
    } catch (e) {
      Nohm.logError('You tried to use the uglify option in Nohm.connect but uglify-js is not requirable.');
    }
    if (uglify.parser && uglify.uglify) {
      var jsp = uglify.parser;
      var pro = uglify.uglify;
      
      var ast = jsp.parse(str);
      // ast = pro.ast_mangle(ast); // TODO: test if this works with our globals
      ast = pro.ast_squeeze(ast);
      str = pro.gen_code(ast);
    }
  }
  
  return function (req, res, next) {
    if (req.url === url) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/javascript");
      res.setHeader("Content-Length", str.length);
      res.setHeader("Cache-Control", "public, max-age=" + maxAge);
      res.end(str);
    } else {
      next();
    }
  };
}
