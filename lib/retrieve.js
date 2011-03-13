var Nohm = null;
exports.setNohm = function (originalNohm) {
  Nohm = originalNohm;
}

var Conduct = require('conductor')
,h = require(__dirname + '/helpers');

/**
 * Retrieves the hash data by id and puts it into the properties.
 */
exports.load = function (id, callback) {
  var self = this;
  id = parseInt(id, 10);
  if (isNaN(id) || id < 1) {
    Nohm.logError('Trying to pass load() a wrong kind of id. Needs to be a number over 0. (still trying to load it though)');
  }
  this.getClient().hgetall(this.getHashKey(id), function (err, values) {
    var p, value;
    if (err) {
      Nohm.logError('loading a hash produced an error: ' + err);
    }
    if (values !== null) {
      for (p in values) {
        if (values.hasOwnProperty(p)) {
          value = values[p] !== null ? values[p].toString() : null;
          if (self.properties[p].load_pure) {
            self.properties[p].value = value;
          } else {
            self.p(p, value);
          }
          self.__resetProp(p);
        }
      }
      self.id = id;
      self.__inDB = true;
      self.__loaded = true;
    } else if (!err) {
      err = 'not found';
    }
    if (typeof(callback) === 'function') {
      callback(err);
    }
  });
}

/**
 * Finds ids of objects by search arguments
 */
exports.find = function find(searches, callback) {
  var self = this, sets = [], zsetKeys = [], s, prop,
  returnFunction = function (err, values) {
    var found = [];
    Nohm.logError(err);
    if (Array.isArray(values) && values.length > 0) {
      values = values.forEach(function (val, i) {
        if (val) {
          var id = parseInt(val.toString(), 10);
          if (id > 0) {
            found.push(id);
          }
        }
      });
    }
    callback(err, found);
  },
  getSets = function (callback) {
    self.getClient().sinter(sets, callback);
  },
  getZSets = function (callback) {
    var i, len, options,
    conductorFuncs = function (i, callback) {
      var rangeCallback = function (err, values) {
        if (err) {
          callback(err);
        } else {
          values.forEach(function (val, i) {
            values[i] = parseInt(val, 10);
          });
          callback(values);
        }
      }
      options = zsetKeys[i].options;
      if ( ! options.min && options.min !== 0)
        options.min = '-inf';
      if ( ! options.max && options.max !== 0)
        options.max = '+inf';
      if ( ! options.offset && options.offset !== 0)
        options.offset = '+inf';
      if (options.limit) {
        self.getClient().zrangebyscore(zsetKeys[i].key, options.min, options.max,
                        'LIMIT', options.offset, options.limit,
                        rangeCallback);
      } else {
        self.getClient().zrangebyscore(zsetKeys[i].key, options.min, options.max,
                        rangeCallback);
      }
    },
    conductors = {}, conductorsDone = [], conductorArgs = [], tmpName;
    for (i = 0, len = zsetKeys.length; i < len; i = i + 1) {
      tmpName = h.numToAlpha(i);
      conductors[tmpName] = ['_' + (i + 1), conductorFuncs];
      conductorsDone.push(tmpName + '0');
      conductorArgs.push(i);
    }
    conductorsDone.push(function () {
      var test, arg, arr = [];
      for (arg in arguments) {
        if (arguments.hasOwnProperty(arg) && Array.isArray(arguments[arg])) {
          arr.push(arguments[arg]);
        }
      }
      test = h.intersections(arr, function (a, b) {
        return a - b;
      });
      callback(null, test);
    });
    conductors.done = conductorsDone;
    new Conduct(conductors).apply(this, conductorArgs);
  };
  if (typeof searches === 'function') {
    callback = searches;
    searches = {};
  }
  for (s in searches) {
    if (searches.hasOwnProperty(s) && this.properties.hasOwnProperty(s)) {
      prop = this.properties[s];
      if (prop.unique) {
        return this.getClient().mget(Nohm.prefix.unique + self.modelName + ':' + s +
                         ':' + searches[s],
                         returnFunction);
      }
      if (prop.index && !prop.__numericIndex) {
        sets.push(Nohm.prefix.index + self.modelName + ':' + s + ':' + searches[s]);
      } else if (prop.__numericIndex) {
        zsetKeys.push({
          key: Nohm.prefix.scoredindex + self.modelName + ':' + s,
          options: searches[s]
        });
      }
    }
  }
  if (sets.length === 0 && zsetKeys.length === 0) {
    this.getClient().smembers(Nohm.prefix.idsets + this.modelName, function (err, ids) {
      if (Array.isArray(ids)) {
        ids = ids.map(function (val) {
          return parseInt(val.toString(), 10);
        });
      }
      returnFunction(err, ids);
    });
  } else if (zsetKeys.length === 0) {
    getSets(returnFunction);
  } else if (sets.length === 0) {
    getZSets(returnFunction);
  } else {
    getSets(function (err, setids) {
      if (Array.isArray(setids)) {
        setids = setids.map(function (val) {
          return parseInt(val.toString(), 10);
        });
      }
      getZSets(function (err2, zsetids) {
        if (err2) {
          err = [err, err2];
        }
        returnFunction(err, h.intersections([setids, zsetids], function (a, b) {
          return a - b;
        }));
      });
    });
  }
}