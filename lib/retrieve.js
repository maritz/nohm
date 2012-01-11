var Nohm = null;
exports.setNohm = function (originalNohm) {
  Nohm = originalNohm;
};

var async = require('async'),
    h = require(__dirname + '/helpers');

/**
 * Check if a given id exists in the DB.
 */
exports.exists = function (id, callback) {
  this.getClient().sismember(Nohm.prefix.idsets+this.modelName, id, function (err, found) {
    Nohm.logError(err);
    callback(!!found);
  });
};

/**
 * Retrieves the hash data by id and puts it into the properties.
 */
exports.load = function (id, callback) {
  var self = this;
  if (!id) {
    Nohm.logError('Trying to pass load() a wrong kind of id. Needs to be a number over 0. (still trying to load it though)');
  }
  this.getClient().hgetall(this.getHashKey(id), function (err, values) {
    var p, value,
        keys = Object.keys(values),
        return_props = {};
    if (err) {
      Nohm.logError('loading a hash produced an error: ' + err);
    }
    if (Array.isArray(keys) && keys.length > 0) {
      for (p in values) {
        if (values.hasOwnProperty(p)) {
          value = values[p] !== null ? values[p].toString() : null;
          if (self.properties[p].load_pure) {
            self.properties[p].value = value;
          } else {
            self.p(p, value);
          }
          return_props[p] = self.p(p);
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
      callback.call(self, err, return_props);
    }
  });
};


/**
 * Finds ids of objects by search arguments
 */
exports.find = function find(searches, callback) {
  var self = this, sets = [], zsetKeys = [], s, prop,
  returnFunction = function (err, values) {
    var found = [];
    Nohm.logError(err);
    if (Array.isArray(values) && values.length > 0) {
      values = values.forEach(function (val) {
        if (val) {
          found.push(val);
        }
      });
    }
    callback.call(self, err, found);
  },
  getSets = function (callback) {
    self.getClient().sinter(sets, callback);
  },
  getSingleZSet = function (zSet, callback) {
    var rangeCallback = function (err, values) {
      if (err) {
        callback(err);
      } else {
        values.forEach(function (val, key) {
          if (self.idGenerator === 'increment') {
            var parsed = parseInt(val, 10);
            if (!isNaN(parsed)) values[key] = parsed;
          }
        });
        callback(null, values);
      }
    };
    var options = zSet.options;
    if ( ! options.min && options.min !== 0)
      options.min = '-inf';
    if ( ! options.max && options.max !== 0)
      options.max = '+inf';
    if ( ! options.offset && options.offset !== 0)
      options.offset = '+inf';
    if (options.limit) {
      self.getClient().zrangebyscore(zSet.key, options.min, options.max,
                      'LIMIT', options.offset, options.limit,
                      rangeCallback);
    } else {
      self.getClient().zrangebyscore(zSet.key, options.min, options.max,
                      rangeCallback);
    }
  },
  getZSets = function (callback) {
    async.map(zsetKeys, getSingleZSet, function done (err, arr) {
      var test = h.idIntersection.apply(null, arr);
      callback(null, test.sort());
    });
  };
  
  
  if (typeof searches === 'function') {
    callback = searches;
    searches = {};
  }
  for (s in searches) {
    if (searches.hasOwnProperty(s) && this.properties.hasOwnProperty(s)) {
      prop = this.properties[s];
      if (prop.unique) {
        if ( ! searches[s].toLowerCase) {
          return returnFunction('Invalid search parameters: Searching for a unique with a non-string value is not supported.');
        }
        return this.getClient().mget(Nohm.prefix.unique + self.modelName + ':' + s +
                         ':' + searches[s].toLowerCase(),
                         returnFunction);
      }
      var isNum = !isNaN(parseInt(searches[s], 10));
      if (prop.index && ( ! prop.__numericIndex || isNum) ) {
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
    // no specific searches, retrieve all ids
    this.getClient().smembers(Nohm.prefix.idsets + this.modelName, function (err, ids) {
      if (self.idGenerator === 'increment' && Array.isArray(ids)) {
        ids = ids.map(function (val) {
          return parseInt(val, 10);
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
      if (self.idGenerator === 'increment' && Array.isArray(setids)) {
        setids = setids.map(function (val) {
          return parseInt(val.toString(), 10);
        });
      }
      getZSets(function (err2, zsetids) {
        if (err2) {
          err = [err, err2];
        }
        returnFunction(err, h.idIntersection(setids, zsetids).sort());
      });
    });
  }
};

exports.sort = function (options, ids) {
  var callback = h.getCallback(arguments);
  if ( ! Array.isArray(ids)) {
    ids = false;
  }
  options = typeof(options) !== 'function' && typeof(options) === 'object' && Object.keys(options).length > 0 ? options : {};
  
  if (ids.length > 0 && options === {}) {
    return callback(ids.sort());
  }
  
  if ( ! options.field || ! this.properties.hasOwnProperty(options.field)) {
    callback('invalid field in options', ids);
    return Nohm.logError('Invalid field in sort() options: ' + options.field);
  }
  
  var field_type = this.properties[options.field].type;
  
  var alpha = options.alpha ||  field_type === 'string' ? 'ALPHA' : '';
  var direction = options.direction ? options.direction : 'ASC';
  var scored = Nohm.indexNumberTypes.indexOf(field_type) !== -1;
  var start = 0;
  var stop = 100;
  if (Array.isArray(options.limit) && options.limit.length > 0) {
    start = options.limit[0];
    stop = options.limit[1] || (scored ? options.limit[0]+stop : stop); // the limit arguments for sets and sorted sets work differently
  }
  
  
  if (ids) {
    // to get the intersection of the given ids and all ids on the server we first
    // temporarily store the given ids either in a set or sorted set and then return the intersection
    console.log('NOT YET IMPLEMENTED PROPERLY');
    return false;
    var multi = this.getClient().multi(); 
    var tmp_idset_key = Nohm.prefix.idsets+this.modelName+':'+(+ new Date()) + Math.ceil(Math.random()*1000);
    
    if (scored) {
      
    } else {
      multi.SADD(idset_key, ids);
    }
  } else {
    // no ids provided
    if (scored) {
      sortScored.call(this, options.field, direction, start, stop, callback);
    } else {
      sortNormal.call(this, options.field, alpha, direction, start, stop, callback);
    }
  }
};

var sortNormal = function (field, alpha, direction, start, stop, callback) {
  var idset_key = Nohm.prefix.idsets+this.modelName;
  var hash_key = Nohm.prefix.hash+this.modelName;
  this.getClient().sort([idset_key, 
    'BY', hash_key+':*->'+field, 
    'LIMIT', start, stop,
    direction,
    alpha],
    callback);
};


var sortScored = function (field, direction, start, stop, callback) {
  var method = direction && direction === 'DESC' ? 'ZREVRANGE' : 'ZRANGE';
  if (start < 0 || stop < 0) {
    Nohm.logError('Notice: tried to limit a scored sort with a negative start('+start+') or stop('+stop+').');
  }
  if (stop < start) { 
    Nohm.logError('Notice: tried to limit a scored sort with a higher start('+start+') than stop('+stop+').');
  }
  this.getClient()[method](
    [Nohm.prefix.scoredindex+this.modelName+':'+field,
      start, stop],
    callback
  );
};