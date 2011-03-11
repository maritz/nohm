var Nohm = null;
exports.setNohm = function (originalNohm) {
  Nohm = originalNohm;
}

/**
 *  Get or set a property.
 *  This automatically invokes typecasting and behaviours.
 *  If you pass true as the third parameter,
 *  the property is instantly checked for validity.
 */
exports.p = exports.prop = exports.property = function property(key, val, validate) {
  var tmp, old, success = true, p;
  if (typeof key === 'object') {
    if (typeof(validate) === 'undefined') {
      validate = val;
    }
    for (p in key) {
      if (key.hasOwnProperty(p)) {
        if (!this.p(p, key[p], validate)) {
          success = false;
        }
      }
    }
    return success;
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
    old = tmp.value;
    tmp.value = this.__cast(key, val, old);
    if (validate) {
      if (!this.valid(key)) {
        tmp.value = old;
        return false;
      }
    }
    if (tmp.value === tmp.__oldValue) {
      tmp.__updated = false;
    } else {
      tmp.__updated = true;
    }
  }
  return true;
}

exports.__resetProp = function resetProp(p) {
  var tmp = this.properties[p];
  tmp.__updated = false;
  tmp.__oldValue = tmp.value;
  tmp.__numericIndex = Nohm.indexNumberTypes.indexOf(tmp.type) > -1 && !tmp.noscore;
  this.properties[p] = tmp;
}

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

  if (typeof type === 'function') {
    return type.call(this, value, key, old);
  }
  switch (type) {
  case 'bool':
    return value === 'false' ? false : !!value;
  case 'string':
    // no .toString() here. TODO: or should there be?
    return (
            (!(value instanceof String) ||
             value.toString() === '') && typeof value !== 'string'
            ) ? ''
              : value;
  case 'integer':
    return isNaN(parseInt(value, 10)) ? 0 : parseInt(value, 10);
  case 'float':
    return isNaN(parseFloat(value)) ? 0 : parseFloat(value);
  case 'timestamp':
    // make it a timestamp aka. miliseconds from 1970
    if (isNaN(value) && typeof value === 'string') {
      // see if there is a timezone specified in the string
      matches = value.match(/(\+|\-)([\d]{1,2})\:([\d]{2})$/);
      if (value.match(/Z$/)) {
        // UTC timezone in an ISO string (hopefully)
        timezoneOffset = 0;
      } else if (matches) {
        // +/- hours:minutes specified.
        // calculating offsets in minutes and removing the offset from the string since new Date() can't handle those.
        hours = parseInt(matches[2], 10);
        minutes = parseInt(matches[3], 10);
        if (matches[1] === '-') {
          timezoneOffset = -1 * (hours * 60 + minutes);
        } else {
          timezoneOffset = hours * 60 - minutes;
        }
        value = value.substring(0, value.length - matches[0].length);
      } else {
        timezoneOffset = new Date(value).getTimezoneOffset();
      }
      return new Date(value).getTime() - timezoneOffset * 60 * 1000;
    }
    return parseInt(value, 10);
  case 'json':
    try {
      // already is json, no nothing
      JSON.parse(value);
      return value;
    } catch (e) {
      return JSON.stringify(value);
    }
  default:
    return value;
  }
}