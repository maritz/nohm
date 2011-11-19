/**
 * This is black magic for now. Stay away from it if you can for now!
 */

var fs = require('fs');
var validators = require(__dirname + '/validators.js');

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
      break;
    case 'object':
      if (Array.isArray(obj)) {
        var arr = [];
        obj.forEach(function (val) {
          arr.push(customToString(val, depth+1));
        });
        return '['+arr.join(',')+']';
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
 *    server.use(nohm.getConnectValidationMiddleware(
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

module.exports = function getConnectValidationMiddleware(models, options){
  options = options || {};
  var url = options.url || '/nohmValidations.js';
  var namespace = options.namespace || 'nohmValidations';
  var arr = [];
  var maxAge = options.maxAge || 3600; // 1 hour
  
  if (Array.isArray(models) && models.length > 0) {
    models.forEach(function (item) {
      arr.push(validationsFlatten(item, namespace));
    });
  }
  
  var str = 'var nohmValidationsNamespaceName = "'+namespace+'";var '+namespace+'={"models":{'+arr.join(',')+'}};';
  
  console.dir(str);
  
  return function (req, res, next) {
    if (req.url === url) {
      // TODO: cache / minify the output string
      fs.readFile(__dirname+'/validators.js', function(err, buf){
          if (err) return next(err);
          
          var body = str+buf.toString('utf-8');
          var headers = {
              'Content-Type': 'text/javascript',
              'Content-Length': body.length,
              'Cache-Control': 'public, max-age=' + maxAge
          };
          res.writeHead(200, headers);
          res.end(body);
        });
    } else {
      next();
    }
  };
  
  
  var options = options || {}
    , path = path || __dirname + '/../public/favicon.ico'
    , maxAge = options.maxAge || 86400000;

  return function favicon(req, res, next){
    if ('/favicon.ico' == req.url) {
      if (icon) {
        res.writeHead(200, icon.headers);
        res.end(icon.body);
      } else {
        fs.readFile(path, function(err, buf){
          if (err) return next(err);
          icon = {
            headers: {
                'Content-Type': 'image/x-icon'
              , 'Content-Length': buf.length
              , 'ETag': '"' + utils.md5(buf) + '"'
              , 'Cache-Control': 'public, max-age=' + (maxAge / 1000)
            },
            body: buf
          };
          res.writeHead(200, icon.headers);
          res.end(icon.body);
        });
      }
    } else {
      next();
    }
  };
};
