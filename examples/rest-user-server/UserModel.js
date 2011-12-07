var nohm = require(__dirname+'/../../lib/nohm.js').Nohm,
    crypto = require('crypto');

/**
 * Given a password and salt this creates an SHA512 hash.
 */
var hasher = function hasher (password, salt) {
  var hash = crypto.createHash('sha512');
  hash.update(password);
  hash.update(salt);
  return hash.digest('base64');
};

/**
 * Create a random id
 */
var uid = function uid () {
  return ((Date.now() & 0x7fff).toString(32) + (0x100000000 * Math.random()).toString(32));
};


var password_minlength = 6; // we use this multiple times and store it here to only have one place where it needs to be configured

/**
 * Model definition of a simple user
 */
module.exports = nohm.model('User', {
  idGenerator: 'increment',
  properties: {
    name: {
      type: 'string',
      unique: true,
      validations: [
        'notEmpty',
        ['length', {
          min: 4
        }]
      ]
    },
    email: {
      type: 'string',
      validations: [
        ['email', {
          optional: true
        }] // this means only values that pass the email regexp are accepted. BUT it is also optional, thus a falsy value is accepted as well.
      ]
    },
    someRegex: {
      type: 'string',
      validations: [
        ['regexp', {
          regex: /^asd$/, 
          optional: true
        }]
      ]
    },
    password: {
      load_pure: true, // this ensures that there is no typecasting when loading from the db.
      type: function (value, key, old) { // because when typecasting, we create a new salt and hash the pw.
        var pwd, salt,
            valueDefined = value && typeof(value.length) !== 'undefined';
        if ( valueDefined && value.length >= password_minlength) {
          pwd = hasher(value, this.p('salt'));
          if (pwd !== old) {
            // if the password was changed, we change the salt as well, just to be sure.
            salt = uid();
            this.p('salt', salt);
            pwd = hasher(value, salt);
          }
          return pwd;
        } else {
          return value;
        }
      },
      validations: [
        'notEmpty',
        ['length', {
          min: password_minlength
        }]
      ]
    },
    salt: {
      // we store the salt so we can check the hashed passwords.
      // this is done so that if someone gets access to the database, they can't just use the same salt for every password. this increases the time they need for the decryption and thus makes it less likely that they'll succeed.
      // Note: this is not very secure. There should also be an application salt and some other techniques to make password decryption more difficult
      defaultValue: uid()
    }
  },
  methods: {
    // custom methods we define here to make handling this model easier.
    
    /**
     * Check a given username/password combination for validity.
     */
    login: function (name, password, callback) {
      var self = this;
      if (!name || name === '' || !password || password === '') {
        callback(false);
        return;
      }
      this.find({name: name}, function (err, ids) {
        if (ids.length === 0) {
          callback(false);
        } else {
          self.load(ids[0], function (err) {
            if (!err && self.p('password') === hasher(password, self.p('salt'))) {
              callback(true);
            } else {
              callback(false);
            }
          });
        }
      });
    },
    
    /**
     * This function makes dealing with user input a little easier, since we don't want the user to be able to do things on certain fields, like the salt.
     * You can specify a data array that might come from the user and an array containing the fields that should be used from used from the data.
     * Optionally you can specify a function that gets called on every field/data pair to do a dynamic check if the data should be included.
     * The principle of this might make it into core nohm at some point.
     */
    fill: function (data, fields, fieldCheck) {
      var props = {},
          self = this,
          doFieldCheck = typeof(fieldCheck) === 'function';
          
      fields = Array.isArray(fields) ? fields : Object.keys(data);
      
      fields.forEach(function (i) {
        var fieldCheckResult;
        
        if (i === 'salt' || // make sure the salt isn't overwritten
            ! self.properties.hasOwnProperty(i))
          return;
          
        if (doFieldCheck)
          fieldCheckResult = fieldCheck(i, data[i]);
          
        if (doFieldCheck && fieldCheckResult === false)
          return;
        else if (doFieldCheck && typeof (fieldCheckResult) !== 'undefined' &&
                fieldCheckResult !== true)
          return (props[i] = fieldCheckResult);
          
        
        props[i] = data[i];
      });
     
      this.p(props);
      return props;
    },
    
    /**
     * This is a wrapper around fill and save.
     * It also makes sure that if there are validation errors, the salt field is not included in there. (although we don't have validations for the salt, an empty entry for it would be created in the errors object)
     */
    store: function (data, callback) {
      var self = this;
      
      this.fill(data);
      this.save(function () {
        delete self.errors.salt;
        callback.apply(self, Array.prototype.slice.call(arguments, 0));
      });
    },
    
    /**
     * Wrapper around fill and valid.
     * This makes it easier to check user input.
     */
    checkProperties: function (data, fields, callback) {
      callback = typeof(fields) === 'function' ? fields : callback;
      
      this.fill(data, fields);
      this.valid(false, false, callback);
    },
    
    /**
     * Overwrites nohms allProperties() to make sure password and salt are not given out.
     */
    allProperties: function (stringify) {
      var props = this._super_allProperties.call(this);
      delete props.password;
      delete props.salt;
      return stringify ? JSON.stringify(props) : props;
    }
  }
});