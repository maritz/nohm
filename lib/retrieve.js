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

var convertIdsToInt = function (ids, callback) {
  if (this.idGenerator === 'increment' && Array.isArray(ids)) {
    ids = ids.map(function (val) {
      return parseInt(val, 10);
    });
  }
  callback(ids);
}

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
        keys = values ? Object.keys(values) : [],
        return_props = {};
    if (err) {
      Nohm.logError('loading a hash produced an error: ' + err);
    }
    if (Array.isArray(keys) && keys.length > 0) {
      for (p in values) {
        var is_enumerable = values.hasOwnProperty(p);
        var is_meta = p === '__meta_version';
        var is_property = self.properties.hasOwnProperty(p);
        if (is_enumerable && is_property && ! is_meta) {
          value = values[p] !== null ? values[p].toString() : null;
          if (self.properties[p].load_pure) {
            self.properties[p].value = value;
          } else {
            self.p(p, value);
          }
          return_props[p] = self.p(p);
          self.__resetProp(p);
        } else if ( ! is_meta && ! self.properties.hasOwnProperty(p)) {
          Nohm.logError('WARNING: A hash in the DB contained a key ('+p+') that is not in the model definition. This might be because of model changes or database corruption/intrusion.')
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
 * Finds ids of objects and loads them.
 */
exports.findAndLoad = function findAndLoad(searches, callback) {
  var self = this;
  this.find(searches, function (err, ids) {
    if (err) {
      callback(err, ids);
    } else if (ids.length === 0) {
      callback("not found", ids);
    } else {
      if (ids.length > 0) {
        async.map(ids, function (id, done) {
          var instance = Nohm.factory(self.modelName);
          instance.load(id, function (err) {
            done(err, instance);
          });
        }, callback);
      }
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
    } else if ( ! Array.isArray(values) && values !== null) {
      found = [values];
    } else if (values === null) {
      found = [];
    }
    convertIdsToInt(found, function (ids) {
      callback.call(self, err, ids);
    });
  },
  getSets = function (callback) {
    self.getClient().sinter(sets, callback);
  },
  getSingleZSet = function (zSet, callback) {
    var rangeCallback, options, command, endpoints;

    rangeCallback = function (err, values) {
      if (err) {
        callback(err);
      } else {
        callback(null, values);
      }
    };
    var getRedisZSetArg = function (input, converter, defaultArg) {
      if (input === "-inf" || input === "+inf") {
        return input;
      }
      var converted = converter(input, 10);
      if ( isNaN(converted) ) {
        return defaultArg;
      }
      return converted;
    }

    options = zSet.options;

    options.min = getRedisZSetArg(options.min, parseFloat, "-inf");
    options.max = getRedisZSetArg(options.max, parseFloat, "+inf");
    options.offset = getRedisZSetArg(options.offset, parseFloat, 0);
    options.limit = getRedisZSetArg(options.limit, parseFloat, -1);

    if( (options.min === '+inf' && options.max !== '+inf') ||
        (options.max === '-inf' && options.min !== '-inf') ||
        (options.min > options.max) ) {
      command = 'zrevrangebyscore';
    } else {
      command = 'zrangebyscore';
    }

    if ( ! options.endpoints ) {
      options.endpoints = '[]';
    } else if (options.endpoints === ')') {
      options.endpoints = '[)';
    } else if ( options.endpoints.length > 2) {
      return returnFunction('Invalid search parameters: endpoints expression is invalid.');
    }
    endpoints = [
      (options.endpoints[0] === '(' ? '(' : ''),
      (options.endpoints[1] === ')' ? '(' : '')
    ];

    if (options.limit) {
      self.getClient()[command](zSet.key,
                    endpoints[0] + options.min,
                    endpoints[1] + options.max,
                    'LIMIT', options.offset, options.limit,
                    rangeCallback);
    } else {
      self.getClient()[command](zSet.key,
                    endpoints[0] + options.min,
                    endpoints[1] + options.max,
                    rangeCallback);
    }
  },
  getZSets = function (callback) {
    async.map(zsetKeys, getSingleZSet, function done (err, arr) {
      var ids = h.idIntersection.apply(null, arr);
      callback(err, ids);
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
        if (prop.type === 'string') {
          if ( ! searches[s].toLowerCase) {
            return returnFunction('Invalid search parameters: Searching for a unique (type "string") with a non-string value is not supported.');
          }
          searches[s] = searches[s].toLowerCase()
        }
        var key = Nohm.prefix.unique+self.modelName+':'+s+':'+searches[s];
        return this.getClient().get([key], returnFunction);
      }
      var isNum = ! isNaN(parseInt(searches[s], 10));
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
    if (JSON.stringify(searches) != '{}') {
      Nohm.logError("Invalid search: Index not found.");
      return returnFunction(null, []);
    }
    // no specific searches, retrieve all ids
    this.getClient().smembers(Nohm.prefix.idsets + this.modelName, returnFunction);
  } else if (zsetKeys.length === 0) {
    getSets(returnFunction);
  } else if (sets.length === 0) {
    getZSets(returnFunction);
  } else {
    getSets(function (err, setids) {
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
  if ( ! Array.isArray(ids) ) {
    ids = false;
  }
  if ( ids && ids.length == 0 ){
    callback(null, []);
    return;
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
    if (scored) { // the limit arguments for sets and sorted sets work differently
      // stop is a 0-based index from the start of all zset members
      stop = options.limit[1] ? start+options.limit[1] : start+stop;
      stop--;
    } else {
      // stop is a 1-based index from the defined start limit (the wanted behaviour)
      stop = options.limit[1] || stop;
    }
  }
  var idset_key = Nohm.prefix.idsets+this.modelName;
  var zset_key = Nohm.prefix.scoredindex+this.modelName+':'+options.field;
  var client = this.getClient();
  var tmp_key;

  if (ids) {
    // to get the intersection of the given ids and all ids on the server we first
    // temporarily store the given ids either in a set or sorted set and then return the intersection

    client = client.multi();

    if (scored) {
      tmp_key = zset_key+':tmp_sort:'+(+ new Date()) + Math.ceil(Math.random()*1000);
      var tmp_zadd_args = [tmp_key];
      ids.forEach(function (id) {
        tmp_zadd_args.push(0, id);
      });
      client.zadd(tmp_zadd_args);
      client.zinterstore([tmp_key, 2, tmp_key, zset_key]);
      zset_key = tmp_key;
    } else {
      tmp_key = idset_key+':tmp_sort:'+(+ new Date()) + Math.ceil(Math.random()*1000);
      ids.unshift(tmp_key);
      client.SADD(ids);
      client.SINTERSTORE([tmp_key, tmp_key, idset_key]);
      idset_key = tmp_key;
    }
  }
  if (scored) {
    sortScored.call(this, client, zset_key, direction, start, stop, callback);
  } else {
    sortNormal.call(this, client, idset_key, options.field, alpha, direction, start, stop, callback);
  }
  if (ids) {
    client.del(tmp_key);
    client.exec(Nohm.logError);
  }
};

var sortNormal = function (client, idset_key, field, alpha, direction, start, stop, callback) {
  var hash_key = Nohm.prefix.hash+this.modelName;
  client.sort([idset_key,
    'BY', hash_key+':*->'+field,
    'LIMIT', start, stop,
    direction,
    alpha],
    callback);
};


var sortScored = function (client, zset_key, direction, start, stop, callback) {
  var method = direction && direction === 'DESC' ? 'ZREVRANGE' : 'ZRANGE';
  if (start < 0 || stop < 0) {
    Nohm.logError('Notice: tried to limit a scored sort with a negative start('+start+') or stop('+stop+').');
  }
  if (stop < start) {
    Nohm.logError('Notice: tried to limit a scored sort with a higher start('+start+') than stop('+stop+').');
  }
  client[method](
    [zset_key,
      start, stop],
    callback
  );
};
