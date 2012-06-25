/**
 * Helper functions that are used throughout nohm
 * @namespace
 */
var Helper = {};

/**
 * This extends an object with x other objects.
 * @see http://api.jquery.com/jQuery.extend/
 */
Helper.$extend = function() {
  var options, name, src, copy, copyIsArray, clone,
  target = arguments[0] || {},
  i = 1,
  length = arguments.length,
  deep = false;

  // Handle a deep copy situation
  if ( typeof target === "boolean" ) {
    deep = target;
    target = arguments[1] || {};
    // skip the boolean and the target
    i = 2;
  }

  // Handle case when target is a string or something (possible in deep copy)
  if ( typeof target !== "object" && typeof(target) == 'function') {
    target = {};
  }

  for ( ; i < length; i++ ) {
    // Only deal with non-null/undefined values
    if ( (options = arguments[ i ]) !== null ) {
    // Extend the base object
      for ( name in options ) {
        if (options.hasOwnProperty(name)) {
          src = target[ name ];
          copy = options[ name ];

          // Prevent never-ending loop
          if ( target === copy ) {
            continue;
          }

          // Recurse if we're merging plain objects or arrays
          if ( deep && copy && ( isPlainObject(copy) || (copyIsArray = Array.isArray(copy)) ) ) {
            if ( copyIsArray ) {
              copyIsArray = false;
              clone = src && Array.isArray(src) ? src : [];

            } else {
              clone = src && isPlainObject(src) ? src : {};
            }

            // Never move original objects, clone them
            target[ name ] = Helper.$extend( deep, clone, copy );

          // Don't bring in undefined values
          } else if ( copy !== undefined ) {
            target[ name ] = copy;
          }
        }
      }
    }
  }

	// Return the modified object
	return target;
};

var isPlainObject = function( obj ) {

	// Not own constructor property must be Object
	if ( obj.constructor &&
		!obj.hasOwnProperty("constructor") &&
		!obj.constructor.prototype.hasOwnProperty("isPrototypeOf") ) {
		return false;
	}

	// Own properties are enumerated firstly, so to speed up,
	// if last one is own, then all properties are own.

	var key;
	for ( key in obj ) {}

	return key === undefined ||  obj.hasOwnProperty(key);
};

// redis.multi returns QUEUED on successfully queing a command.
Helper.__expectQueued = function __expectQueued(err, value) {
  if (value.toString() !== 'QUEUED') {
    ModelClass.logError('Queing of multi/exec failed. returned value: ' + value.toString());
  }
};

// extend a given object with the given prototypes
Helper.prototypeModule = function (obj, protos) {
  for (var proto in protos) {
    if (protos.hasOwnProperty(proto)) {
      obj.prototype[proto] = protos[proto];
    }
  }
  return obj;
};

/**
 * Get an object containing all the prefixes for the different key types.
 */
Helper.getPrefix = function (defaultPrefix) {
  var prefix = null;
  var obj;
  if (prefix === null)
    prefix = defaultPrefix;

  obj = {
    ids: prefix + ':ids:',
    idsets: prefix + ':idsets:',
    hash: prefix + ':hash:',
    unique: prefix + ':uniques:',
    scoredindex: prefix + ':scoredindex:',
    index: prefix + ':index:',
    relations: prefix + ':relations:',
    relationKeys: prefix + ':relationKeys:',
    meta: {
      version: prefix + ':meta:version:',
      idGenerator: prefix + ':meta:idGenerator:',
      properties: prefix + ':meta:properties:',
    },
    channel: prefix + ':channel:'
  };
  return obj;
};

/**
 * Get the intersection of 2 or more id arrays.
 * @param {Array[]} Arrays The arrays (containing ids) you want to check
 */
Helper.idIntersection = function idIntersection(first) {
  var ret = first,
      empty = false;
  Array.prototype.slice.call(arguments, 1).forEach(function (arr) {
    if ( ! Array.isArray(arr) ) {
      throw new Error('intersections received non-array argument');
    }
    if (arr.length === 0) {
      empty = true;
    }
    if (empty || arr === ret) {
      return false;
    }

    ret = arr.filter(function(value) {
      return value && ret.indexOf(value) !== -1;
    });
    if (ret.length === 0) {
      empty = true;
    }
  });
  return empty ? [] : ret;
};



/**
 *  Checks if the last item in the given array is a function and returns that or an empty function.
 */
Helper.getCallback = function getCallback(args) {
  if (args.length >= 1 &&
      typeof args[args.length - 1] === 'function') {
    return args[args.length - 1];
  } else {
    return function () {};
  }
};

/**
 * Checks whether 2 (nohm) objects are the same.
 */
Helper.checkEqual = function checkEqual(obj1, obj2) {
  if (!obj1 || (obj1 && !obj2)) {
    return false;
  }
  if (obj1 === obj2) {
    return true;
  }
  else if (obj1.hasOwnProperty('modelName') && obj2.hasOwnProperty('modelName') &&
           obj1.modelName === obj2.modelName) {
    // if both have been saved, both must have the same id.
    if (obj1.id && obj2.id && obj1.id === obj2.id) {
      return true;
    }
    else if (obj1.id && obj2.id) { // both have been saved but do not share the same id -> must be different.
      return false;
    }

    // if both have exactly the same properties (and at most one has been saved - see above)
    if (obj1.allProperties(true) === obj2.allProperties(true)) {
      return true;
    }
  }
  return false;
};

module.exports = Helper;