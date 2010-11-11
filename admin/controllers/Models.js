var Ni = require('ni'),
redis = require('redis').createClient(),
nohm = require('nohm');

var modelCache = {},
getMeta = function getMeta (model, forceRefresh, callback) {
  if (typeof(forceRefresh) === 'function') {
    callback = forceRefresh;
    forceRefresh = false;
  }
  if (forceRefresh || 
    modelCache === {} || 
    ! modelCache.hasOwnProperty(model)) {
    console.log('re-retrieving meta cache.');
    redis.keys(Ni.config.redis_prefix + ':meta:*', function (err, keys) {
      if (keys && ! err) {
        keys.forEach(function (value, i) {
          value = value.toString();
          var modelname = value.replace(/^[^:]*:meta:/, '');
          redis.hgetall(value, function (err, vals) {
            modelCache[modelname] = [];
            if (vals !== null) {
              vals.forEach(function (val, i) {
                modelCache[modelname][i] = JSON.parse(val.toString());
              });
            }
            if (modelname === model) {
              callback(modelCache[modelname]);
            }
          });
        });
      } else {
        callback(false);
      }
    });
  } else {
    callback(modelCache[model]);
  }
}
getMeta(false, true, function () {});

var getChildren = function (model, id, callback) {
  redis.keys(Ni.config.redis_prefix + ':relations:' + model + '*:' + id, function (err, keys) {
    var children = [],
    count = keys ? keys.length : 0;
    if (keys) {
      keys.forEach(function (key) {
        key = key.toString();
        var relName = key.replace(/^.*:([^:]*):[^:]*:[\d]$/, '$1'),
        modelName = key.replace(/^.*:([^:]*):[\d]$/, '$1');
        redis.smembers(Ni.config.redis_prefix + ':relations:' + model
          + ':' + relName + ':' + modelName + ':' + id, function (err, members) {
          var ids = [];
          if (members) {
            members.forEach(function (id) {
              ids.push(+id);
            });
          }
          children.push({
            model: modelName,
            rel: relName,
            ids: ids
          });
          count--;
          if (count === 0) {
            callback(children);
          }
        });
      });
    } else {
      callback([]);
    }
  });
}

module.exports = {
  __init: function (cb, req, res, next) {
    if (typeof(req.session.logged_in) === 'undefined' || !req.session.logged_in) {
      res.Ni.action = 'login';
      res.Ni.controller = 'User';
      Ni.controllers.User.login(req, res, next);
    } else {
      res.Ni.controller = 'Models'; // since i've overwritten the controller for home to be News, this is neccessary for automatic views
      cb();
    }
  },
  
  index: function (req, res, next) {
    redis.keys(Ni.config.redis_prefix + ':idsets:*', function (err, replies) {
      res.rlocals.models = [];
      if (replies) {
      replies.forEach(function (val, i) {
         res.rlocals.models[i] = val.toString().replace(/^.*\:idsets:/, '');
      });
      }
      next();
    });
  },
  
  details: function (req, res, next, model) {
    getMeta(model, function (meta) {
      if (!model) {
        console.dir('someone tried to access an inexistant model:' + model);
        res.redirect('/Models');
      }
      
      res.rlocals.model = model;
      res.rlocals.props = meta;
      redis.smembers(Ni.config.redis_prefix + ':idsets:' + model, function (err, replies) {
        if (err) {
          console.dir('something went wrong in fetching model details with model:' + model);
          res.redirect('/Models');
        }
        res.rlocals.ids = replies !== null ? replies : [];
        next();
      });
    })
  },
  
  getObject: function (req, res, next, model, id) {
    if (!model || !id) {
      console.dir('someone tried to access model: "' + model + '" with id #' + id);
      res.redirect('/Models');
    }
    redis.hgetall(Ni.config.redis_prefix + ':hash:' + model + ':' + id, function (err, replies) {
      if (err) {
        console.dir('someone tried to access an inexistant object of model: "' + model + '" with id #' + id);
        res.redirect('/Models');
      }
      res.rlocals.model = model;
      res.rlocals.id = id;
      res.rlocals.vals = [];
      if (replies !== null) {
        replies.forEach(function (val, i) {
          res.rlocals.vals[i] = val.toString();
        });
        next();
      }
    });
  },
  
  getRelations: function (req, res, next, model, id) {
    if (!model || !id) {
      console.dir('someone tried to access model relations of: "' + model + '" with id #' + id);
      res.redirect('/Models');
    }
    getChildren(model, id, function (children) {
      res.rlocals.relations = children;
      next();
    });
  }
}