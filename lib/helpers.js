"use strict";


// thanks to FransWillem
exports.intersections = function intersections(arrs,cmp) {
	var ret=[],
		offsets=arrs.map(function() { return 0; }),
		lowestIndex,highestIndex,
		lowest,highest,
		index,
		cur;
        if (!arrs.every(function (arr) {
          return Array.isArray(arr) && arr.length > 0;
        })) {
          // one of the arrays is either not an array or empty.
          return [];
        }
	//Copy each array and sort it
	arrs=arrs.map(function(a) { return a.slice(0).sort(cmp); });
	while (arrs.every(function(x,i) { return x.length>offsets[i]; })) {
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