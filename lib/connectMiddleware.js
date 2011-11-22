var Nohm = null;
exports.setNohm = function (originalNohm) {
  Nohm = originalNohm;
  Nohm.connect = connect;
}

/**
 * This is black magic for now. Stay away from it if you can for now!
 */

var fs = require('fs');
var validators = require(__dirname+'/validators.js');

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

var validationsFlatten = function (obj, namespace) {
  model = new obj.model();
  var blacklist = Array.isArray(obj.blacklist) ? obj.blacklist : [];
  var props = model.properties;
  var str = model.modelName+': {';
  Object.keys(props).forEach(function (key) {
    if (blacklist.indexOf(key) === -1) {
      var vals = props[key].validations;
      if (Array.isArray(vals) && vals.length > 0) {
        str += ""+key+': [';
        var strVals = [];
        vals.forEach(function (val) {
          strVals.push(customToString(val));
        });
        str += strVals.join(',')+'],           ';
      }
    }
  });
  return str+'}';
};

var wrapFile = function (fileStr, index, namespace) {
  var str = namespace+'.extraValidations['+index+'] = {};(function (exports) {';
  str += fileStr;
  str += '})('+namespace+'.extraValidations['+index+']);';
  return str;
};

var wrapExtraFiles = function (files, namespace) {
  var index = 0;
  var str = '';
  files.forEach(function (path) {
    file = fs.readFileSync(path, 'utf-8');
    str += wrapFile(file, index, namespace);
  });
  return str;
};

/**
 * Returns a middleware that can deliver the validations as a javascript file
 * and the modelspecific serial validations as a JSON object to the browser.
 * This is useful if you want to save some bandwith by doing the serial validations
 * in the browser before saving to the server.
 * Custom validations are not supported by this yet. (TODO: we might add a way to do custom validations by just supplying a special name/string that will get called)
 *
 * Options:
 *    - `models` - object of all models you want to extract the validations from and possible attribute exception array
 * 
 * Example:
 * 
 *    server.use(nohm.connect(
 *      // array of objects containing the model and blacklist
 *      [{
 *        model: User, 
 *        blacklist: ['salt']
 *      }], 
 *      // options object
 *      {
 *        url: '/nohm.js'
 *      });
 *
 * @return {Function}
 * @api public
 */
 
function connect(models, options){
  options = options || {};
  var url = options.url || '/nohmValidations.js';
  var namespace = options.namespace || 'nohmValidations';
  var arr = [];
  var maxAge = options.maxAge || 3600; // 1 hour
  var extraFiles = options.extraFiles || [];
  if ( ! Array.isArray(extraFiles)) {
    extraFiles = [extraFiles];
  }
  
  if (Array.isArray(models) && models.length > 0) {
    models.forEach(function (item) {
      arr.push(validationsFlatten(item, namespace));
    });
  }
  
  var str = 'var nohmValidationsNamespaceName = "'+namespace+'";var '+namespace+'={"extraValidations": [], "models":{'+arr.join(',')+'}};';
  
  str += wrapExtraFiles(extraFiles, namespace);
  str += wrapExtraFiles(Nohm.getExtraValidatorFileNames(), namespace); // needs to somehow access the same thing
  fs.readFile(__dirname+'/validators.js', function(err, buf){
    if (err) return next(err);
    
    str += buf.toString('utf-8');
  });
  
  // TODO: uglify
  
  return function (req, res, next) {
    if (req.url === url) {
      var headers = {
          'Content-Type': 'text/javascript',
          'Content-Length': str.length,
          'Cache-Control': 'public, max-age=' + maxAge
      };
      res.writeHead(200, headers);
      res.end(str);
    } else {
      next();
    }
  };
};
