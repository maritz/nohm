var Nohm = null;
exports.setNohm = function (originalNohm) {
  Nohm = originalNohm;
};

/**
 *  Get or set a property.
 *  This automatically invokes typecasting and behaviours.
 */
exports.property = function property(key, val) {
  if (arguments.length > 2 || (typeof(key) === 'object' && typeof(val) === 'boolean')) {
    // TODO: remove this warning
    Nohm.logError('Deprecated: .property() does not support immediate validation anymore.');
  }
  var tmp;
  var old;
  var res = {};
  var p;
  if (typeof key === 'object') {
    for (p in key) {
      if (key.hasOwnProperty(p)) {
        res[p] = this.p(p, key[p]);
      }
    }
    return res;
  }
  if (!this.properties[key]) {
    Nohm.logError('Trying to access undefined property "'+key+
      '" of object "'+this.modelName+'" with id:'+this.id+'.');
    return false;
  }
  tmp = this.properties[key];
  if (typeof val === 'undefined') {
    return tmp.type === 'json' ? JSON.parse(tmp.value) : tmp.value;
  } else if (val !== tmp.value) {
    tmp = this.properties[key];
    old = tmp.value;
    tmp.value = this.__cast(key, val, old);
    tmp.__updated = tmp.value !== tmp.__oldValue;
  }
  return tmp.value;
};

/**
 * Alias for Nohm.property()
 * @name p
 * @methodOf Nohm
 * @see Nohm.property
 */

/**
 * Alias for Nohm.property()
 * @name prop
 * @methodOf Nohm
 * @see Nohm.property
 */
exports.p = exports.prop = exports.property;

/**
 * Resets the property meta data. Should be called internally after saving.
 */
exports.__resetProp = function resetProp(p) {
  var tmp = this.properties[p];
  tmp.__updated = false;
  tmp.__oldValue = tmp.value;
  tmp.__numericIndex = Nohm.indexNumberTypes.indexOf(tmp.type) > -1 && !tmp.noscore;
};

/**
   *  Casts a property to a certain datatype. (Might cause unexpected results.
   *  Behaviours offer greater control over what happens.)
   *  Currently supported:
   *  string,
   *  integer,
   *  float,
   *  timestamp (time/date string or number to unix timestamp),
   *  json
   */
exports.__cast = function __cast(key, value, old) {
  if (!this.properties[key]) {
    Nohm.logError('Trying to access undefined property "' +
    key + '" of object "' + this.modelName + '".');
    return false;
  }
  var type = this.properties[key].type,
    timezoneOffset,
    matches,
    hours,
    minutes;

  if (typeof (type) === 'undefined') {
    return value;
  }

  if (typeof (type) === 'function') {
    return type.call(this, value, key, old);
  }

  switch (type.toLowerCase()) {
  case 'boolean':
  case 'bool':
    return value === 'false' ? false : !!value;
  case 'string':
  case 'string':
    // no .toString() here. TODO: or should there be?
    return (
            (!(value instanceof String) ||
             value.toString() === '') && typeof value !== 'string'
            ) ? ''
              : value;
  case 'integer':
  case 'int':
    return isNaN(parseInt(value, 10)) ? 0 : parseInt(value, 10);
  case 'float':
    return isNaN(parseFloat(value)) ? 0 : parseFloat(value);
  case 'date':
  case 'time':
  case 'timestamp':
    // make it a timestamp aka. miliseconds from 1970
    if (isNaN(value) && typeof value === 'string') {
      // see if there is a timezone specified in the string
      if (value.match(/Z$/)) {
        // UTC timezone in an ISO string (hopefully)
        timezoneOffset = 0;
      } else {
        matches = value.match(/(\+|\-)([\d]{1,2})\:([\d]{2})$/);
        if (matches) {
          // +/- hours:minutes specified.
          // calculating offsets in minutes and removing the offset from the string since new Date() can't handle those.
          hours = parseInt(matches[2], 10);
          minutes = parseInt(matches[3], 10);
          if (matches[1] === '-') {
            timezoneOffset = -1 * (hours * 60 + minutes);
          } else {
            timezoneOffset = hours * 60 + minutes;
          }
          value = value.substring(0, value.length - matches[0].length) + 'Z'; // make sure it is set in UTC here
        } else {
          timezoneOffset = new Date(value).getTimezoneOffset();
        }
      }
      return new Date(value).getTime() - timezoneOffset * 60 * 1000;
    }
    return parseInt(value, 10);
  case 'json':
    if (typeof (value) === 'object') {
      return JSON.stringify(value);
    } else {
      try {
        // already is json, do nothing
        JSON.parse(value);
        return value;
      } catch (e) {
        return JSON.stringify(value);
      }
    }
  default:
    return value;
  }
};

/**
 * Get an array of all properties that have been changed.
 */
exports.propertyDiff = function propertyDiff(key) {
  var diff = [],
  p;
  if (key && !this.properties[key]) {
    throw 'Invalid key specified for diffProperty';
  }

  for (p in this.properties) {
    if (!key || p === key) {
      if (this.properties[p].__updated) {
        diff.push({
          key: p,
          before: this.properties[p].__oldValue,
          after: this.properties[p].value
        });
      }
    }
  }
  return diff;
};

/**
 *  Resets the values of all or one propert(y/ies).
 */
exports.propertyReset = function propertyReset(key) {
  if (key && !this.properties[key]) {
    throw 'Invalid key specified for diffProperty';
  }

  for (var p in this.properties) {
    if (!key || p === key) {
      this.properties[p].__updated = false;
      this.properties[p].value = this.properties[p].__oldValue;
    }
  }
  return true;
};

/**
 *  Get all properties with values either as an array or as json (param true)
 */
exports.allProperties = function allProperties(json) {
  var props = {},
  p;
  for (p in this.properties) {
    if (this.properties.hasOwnProperty(p)) {
      props[p] = this.p(p);
    }
  }
  props.id = this.id;
  return json ? JSON.stringify(props) : props;
};