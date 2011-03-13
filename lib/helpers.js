
// stolen from jquery :)
exports.$extend = $extend = function() {
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
  if ( typeof target !== "object" && !typeof(target) !== 'function') {
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
            target[ name ] = $extend( deep, clone, copy );
    
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

// jquery as well
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

		return key === undefined ||  obj.hasOwnProperty(key );
	}

exports.__expectQueued = function __expectQueued(err, value) {
  if (value.toString() !== 'QUEUED') {
    ModelClass.logError('Queing of multi/exec failed. returned value: ' + value.toString());
  }
}

exports.prototypeModule = function (obj, protos) {
  for (var proto in protos) {
    if (protos.hasOwnProperty(proto)) {
      obj.prototype[proto] = protos[proto];
    }
  }
  return obj;
}

exports.getPrefix = function (defaultPrefix) {
  var prefix = null
  , obj;
  process.argv.forEach(function (val, index) {
    if (val.indexOf('test/tests.js') !== -1)
      prefix = 'tests';
    if ( ! prefix && val === '--nohm-prefix')
      prefix = process.argv[index + 1];
  });
  if (prefix === null)
    prefix = defaultPrefix;
    
  obj = {
    hash: prefix + ':hash:',
    unique: prefix + ':uniques:',
    scoredindex: prefix + ':scoredindex:',
    index: prefix + ':index:',
    relations: prefix + ':relations:',
    meta: prefix + ':meta:'
  }
  return obj;
}

exports.callbackWrapper = function (cb) {
  if (typeof(cb) !== 'function')
    return false;
  try {
    cb();
  } catch (e) {
    console.log(e.stack);
    throw e;
  }
}

// thanks to FransWillem
checkForEmptyOrNoArray = function (arr) {
  return Array.isArray(arr) && arr.length > 0;
}

exports.intersections = function intersections(arrs,cmp) {
	var ret = []
  , offsets = arrs.map(function() { return 0; })
  , lowestIndex
  , highestIndex
	, lowest
  , highest
	, index
	, cur
  , checkArraysStillTooLong = function(x,i) { return x.length>offsets[i]; };
  
  if (!arrs.every(checkForEmptyOrNoArray)) {
    // one of the arrays is either not an array or empty.
    return [];
  }
  
	//Copy each array and sort it
	arrs = arrs.map(function(a) { 
    return a.slice(0).sort(cmp); 
  });
	while (arrs.every(checkArraysStillTooLong)) {
		lowestIndex=highestIndex=0;
		lowest=highest=arrs[0][offsets[0]];
		for (index=1; index<arrs.length; index++) {
			cur=arrs[index][offsets[index]];
			if (cmp(cur,lowest)<0) {
				lowest=cur;
				lowestIndex=index;
			}
			if (cmp(cur,highest)>0) {
				highest=cur;
				highestIndex=index;
			}
		}
		if (lowestIndex===highestIndex) {
			ret.push(lowest);
			for (index=0; index<offsets.length; index++) {
				offsets[index]++;
			}
		} else {
			offsets[lowestIndex]++;
		}
	}
	return ret;
}



/**
 *This function checks if the last item in the given array is a function and returns that or an empty function.
 */
exports.getCallback = function getCallback(args) {
  if (args.length >= 1 &&
      typeof args[args.length - 1] === 'function') {
    return args[args.length - 1];
  } else {
    return function () {};
  }
};

/**
 * This function checks whether 2 nohm objects are the same.
 */
exports.checkEqual = function checkEqual(obj1, obj2) {
  if (!obj1 || (obj1 && !obj2)) {
    return false;
  }
  if (obj1 === obj2) {
    return true; // hm... is this ever going to trigger? i don't know
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

exports.numToAlpha = exports.numToAlpha = function numToAlpha(num) {
  num = parseInt(num, 10);
  var chars = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
  alpha = '',
  str = num.toString(),
  i = 0,
  len = str.length;
  for (;i < len; i = i + 1) {
    alpha = alpha + chars[parseInt(str.charAt(i), 10)];
  }
  return alpha;
};