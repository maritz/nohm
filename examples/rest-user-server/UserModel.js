const nohm = require('nohm').Nohm;
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

/**
 * Given a password this creates a hash using bcrypt.
 */
const hashPassword = (password) => {
  return bcrypt.hashSync(password, SALT_ROUNDS);
};

const PASSWORD_MINLENGTH = 6; // we use this multiple times and store it here to only have one place where it needs to be configured

/**
 * Model definition of a simple user
 */
module.exports = nohm.model('User', {
  properties: {
    name: {
      type: 'string',
      unique: true,
      validations: [
        'notEmpty',
        {
          name: 'length',
          options: {
            min: 4,
          },
        },
      ],
    },
    email: {
      type: 'string',
      validations: [
        {
          name: 'email',
          options: {
            optional: true, // this means only values that pass the email regexp are accepted. BUT it is also optional, thus a falsy value is accepted as well.
          },
        },
      ],
    },
    createdAt: {
      defaultValue: () => Date.now(),
      load_pure: true, // make sure the defaultValue is not set on load
      type: (_a, _b, oldValue) => parseInt(oldValue, 10), // never change the value after creation
    },
    updatedAt: {
      defaultValue: () => Date.now(),
      load_pure: true, // make sure the defaultValue is not set on load
      type: 'timestamp',
    },
    someRegex: {
      type: 'string',
      validations: [
        {
          name: 'regexp',
          options: {
            regex: /^asd$/,
            optional: true,
          },
        },
      ],
    },
    password: {
      load_pure: true, // this ensures that there is no typecasting when loading from the db.
      // because when typecasting, we create a new hash of the password.
      type: function(value) {
        const valueDefined = value && typeof value.length !== 'undefined';
        if (valueDefined && value.length >= PASSWORD_MINLENGTH) {
          return hashPassword(value);
        } else {
          return value;
        }
      },
      validations: [
        'notEmpty',
        {
          name: 'length',
          options: {
            min: PASSWORD_MINLENGTH,
          },
        },
      ],
    },
  },
  methods: {
    // custom methods we define here to make handling this model easier.

    /**
     * Check a given username/password combination for validity.
     */
    async login(name, password) {
      if (!name || name === '' || !password || password === '') {
        return false;
      }
      const ids = await this.find({ name: name });
      if (ids.length === 0) {
        return false;
      } else {
        await this.load(ids[0]);
        return bcrypt.compare(password, this.property('password'));
      }
    },

    /**
     * This function makes dealing with user input a little easier, since we may not want the user to be able to do things on some fields.
     * You can specify a data object that might come from the user and an array containing the fields that should be used from used from the data.
     * Optionally you can specify a function that gets called on every field/data pair to do a dynamic check if the data should be included.
     * The principle of this might make it into core nohm at some point.
     */
    fill(data, fields, fieldCheck) {
      const props = {};
      const doFieldCheck = typeof fieldCheck === 'function';

      fields = Array.isArray(fields) ? fields : Object.keys(data);

      fields.forEach((propKey) => {
        if (!this.getDefinitions().hasOwnProperty(propKey)) {
          return;
        }

        if (doFieldCheck) {
          const fieldCheckResult = fieldCheck(propKey, data[propKey]);
          if (fieldCheckResult === false) {
            return;
          } else if (fieldCheckResult) {
            props[propKey] = fieldCheckResult;
            return;
          }
        }

        props[propKey] = data[propKey];
      });
      console.log('properties now ', props);
      this.property(props);
      return props;
    },

    /**
     * This is a wrapper around fill and save.
     * It also makes sure that if there are validation errors.
     */
    async store(data) {
      console.log('filling', data);
      this.fill(data);
      this.property('updatedAt', Date.now());
      await this.save();
    },

    /**
     * Wrapper around fill and valid.
     * This makes it easier to check user input.
     */
    async checkProperties(data, fields) {
      this.fill(data, fields);
      return this.valid(false, false);
    },

    /**
     * safe allProperties
     */
    safeAllProperties(stringify) {
      const props = this.allProperties();
      delete props.password;
      return stringify ? JSON.stringify(props) : props;
    },
  },
});
