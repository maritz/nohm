import h = require('../lib/helpers');

import * as async from 'async';
import * as traverse from 'traverse';

import * as redis from 'redis';
import { NohmModel, IModelOptions, IModelPropertyDefinition, IModelPropertyDefinitions } from './model';

export { NohmModelExtendable as NohmModel, IModelOptions, IModelPropertyDefinition };

// this is the exported extendable version - still needs to be registered to receive proper methods
abstract class NohmModelExtendable<TProps = {}> extends NohmModel<TProps> {
  public client: redis.RedisClient;
  /**
   * DO NOT OVERWRITE THIS; USED INTERNALLY
   *
   * @protected
   */
  protected _initOptions() {
    // overwritten in NohmClass.model/register
    throw new Error('Abstract method _initOptions was not properly set in NohmClass.model or NohmClass.register.');
  }
  /**
   * DO NOT OVERWRITE THIS; USED INTERNALLY
   *
   * @protected
   */
  protected prefix(_prefix: keyof INohmPrefixes): string {
    // overwritten in NohmClass.model/register
    throw new Error('Abstract method prefix was not properly set in NohmClass.model or NohmClass.register.');
  }
  /**
   * DO NOT OVERWRITE THIS; USED INTERNALLY
   *
   * @protected
   */
  protected rawPrefix(): INohmPrefixes {
    // overwritten in NohmClass.model/register
    throw new Error('Abstract method rawPrefix was not properly set in NohmClass.model or NohmClass.register.');
  }
}

export interface INohmOptions {
  prefix?: string;
  client?: redis.RedisClient;
}

export interface INohmPrefixes {
  channel: string;
  hash: string;
  ids: string;
  idsets: string;
  index: string;
  meta: {
    version: string;
    idGenerator: string;
    properties: string;
  };
  relationKeys: string;
  relations: string;
  scoredindex: string;
  unique: string;
}

type Constructor<T> = new (...args: any[]) => T;

export class NohmClass {

  /**
   * The property types that get indexed in a sorted set.
   * This should not be changed since it can invalidate already existing data.
   */
  private static indexNumberTypes = ['integer', 'float', 'timestamp'];

  /**
   * The redis prefixed key object.
   * Defaults to prefixing with 'nohm' which then creates keys like 'nohm:idsets:someModel'.
   */
  public prefix: INohmPrefixes;

  /**
   * The current global nohm redis client
   */
  public client: redis.RedisClient;

  /**
   * Whether to store the meta values about models.
   * This is used for example by the admin app.
   * Defaults to true.
   */
  private meta = true;

  private modelCache: {
    [name: string]: Constructor<NohmModel>,
  } = {};

  constructor({ prefix, client }: INohmOptions) {
    this.setPrefix(prefix);
    this.setClient(client || redis.createClient());
  }

  /**
   * Set the Nohm global redis client.
   * Note: this will not affect models that have a client set on their own.
   */
  public setPrefix(prefix = 'nohm') {
    this.prefix = h.getPrefix(prefix);
  }

  /**
   * Set the Nohm global redis client.
   * Note: this will not affect models that have a client set on their own.
   * @static
   */
  public setClient(client: redis.RedisClient) {
    this.client = client;
    if (!client.connected) {
      NohmClass.logError(`Warning: setClient() received a redis client that is not connected yet.
Consider waiting for an established connection before setting it.`);
    }
  }

  public static logError(err: string | Error) {
    if (err) {
      console.dir({
        message: err,
        name: 'Nohm Error',
      });
    }
  }

  /**
   * Creates and returns a new model class with the given name and options.
   *  If you're using Typescript it is strongly advised to use Nohm.register() instead.
   *
   * @param {string} name Name of the model. This needs to be unique and is used in data storage.
   *                      Thus <b>changing this will invalidate existing data</b>!
   * @param {IModelDefinitions} options This is an object containing the actual model definitions.
   *                                    These are: properties, methods (optional) and the client (optional) to be used.
   * @param {boolean} temp When true, this model is not added to the internal model cache,
   *                        meaning methods like factory() and getModels() cannot access them.
   *                        This is mostly useful for meta things like migrations.
   * @returns ModelClass
   *
   * TODO: maybe deprecate this at some point
   */
  public model(
    name: string, options: IModelOptions & { properties: IModelPropertyDefinitions }, temp = false,
  ): Constructor<NohmModel> {
    if (!name) {
      NohmClass.logError('When creating a new model you have to provide a name!');
    }
    // tslint:disable-next-line:no-this-assignment
    const self = this; // well then...

    // tslint:disable-next-line:max-classes-per-file
    class CreatedClass extends NohmModelExtendable {

      public client = self.client;

      protected definitions = options.properties;

      protected options = options;

      constructor(...args: any[]) {
        super(...args);
        if (self.meta) {
          this.meta = {
            inDb: false,
            properties: this.options.properties,
            version: this.generateMetaVersion(),
          };
        }
      }

      /* This (and .register()) is the only place where this method should exist.
        An alternative would be to pass the options as a special argument to super, but that would have the downside
        of making subclasses of subclasses impossible and restricting constructor argument freedom. */
      protected _initOptions() {
        this.options = options || { properties: {} };
        if (!this.client) {
          this.client = self.client;
        }
      }

      protected prefix(prefix: keyof INohmPrefixes): string {
        return self.prefix[prefix] + name;
      }

      protected rawPrefix(): INohmPrefixes {
        return self.prefix;
      }
    }

    if (!temp) {
      this.modelCache[name] = CreatedClass;
    }

    return CreatedClass;
  }

  /**
   * Creates, registers and returns a new model class from a given class.
   * This is the preferred method of creating new models over using Nohm.model(), especially when using Typescript.
   *
   * @param {NohmModel} subClass Complete model class, needs to extend NohmModel.
   * @param {boolean} temp When true, this model is not added to the internal model cache,
   *                        meaning methods like factory() and getModels() cannot access them.
   *                        This is mostly useful for meta things like migrations.
   * @returns ModelClass
   *
   * @example
   *   // Typescript
   *   import { Nohm, NohmModel, IModelDefinitions } from 'nohm';
   *   class UserModelClass extends NohmModel {
   *     modelName = 'user'; // used in redis to store the keys
   *     definitions: IModelProperties = {
   *       name: {
   *         type: 'string',
   *         defaultValue: 'testName',
   *         validations: [
   *           'notEmpty'
   *         ]
   *       },
   *     },
   *     foo: () => {
   *       // some custom method
   *     };
   *   }
   *   const User = Nohm.register(UserModelClass);
   *   // typescript now knows about bar.foo() and all the standard nohm methods like bar.prop();
   *   const bar = new User();
   *   bar.foo(); // no error
   */
  public register<T extends Constructor<NohmModel>>(
    subClass: T, temp = false,
  ): Constructor<NohmModel> & T {
    // tslint:disable-next-line:no-this-assignment
    const self = this; // well then...

    // tslint:disable-next-line:max-classes-per-file
    class CreatedClass extends subClass {
      protected definitions: IModelPropertyDefinitions;

      constructor(...args: any[]) {
        super(...args);
        if (self.meta) {
          this.meta = {
            inDb: false,
            properties: this.options.properties,
            version: this.generateMetaVersion(),
          };
        }
      }

      /* This (and .model()) is the only place where this method should exist.
        An alternative would be to pass the options as a special argument to super, but that would have the downside
        of making subclasses of subclasses impossible. */
      protected _initOptions() {
        if (!this.client) {
          this.client = self.client;
        }
        if (!this.options.idGenerator) {
          this.options.idGenerator = 'default';
        }
      }

      protected prefix(prefix: keyof INohmPrefixes): string {
        return self.prefix[prefix] + this.modelName;
      }

      protected rawPrefix(): INohmPrefixes {
        return self.prefix;
      }
    }

    if (!temp) {
      const tempInstance = new CreatedClass();
      this.modelCache[tempInstance.modelName] = CreatedClass;
    }

    return CreatedClass;
  }

  /**
   * Get all model classes that are registered via .register() or .model()
   *
   * @returns {Array<NohmModel>}
   */
  public getModels() {
    return this.modelCache;
  }

  public factory<T extends NohmModel>(
    name: string,
  ): T;
  public factory<T extends NohmModel>(
    name: string, id: number,
  ): Promise<T>;
  /*public factory<T extends NohmModel>(
    name: string, id?: number, callback?: (this: T, err: string, properties: { [name: string]: any }) => any,
  ): Promise<T>*/
  public factory<T extends NohmModel>(
    name: string, id?: number, callback?: (this: T, err: string, properties: { [name: string]: any }) => any,
  ): T | Promise<T> {
    if (typeof callback === 'function') {
      // TODO: decide whether callback fallback should be implemented everywhere based on effort - otherwise cut it
      throw new Error('Not implmented: factory does not support callback method anymore.');
    } else {
      const model = this.modelCache[name];
      if (!model) {
        // TODO: debug(`Model ${model} not found. Available models: ${Object.keys(this.modelCache)}`);
        // return Promise.reject(`Model '${name}' not found.`);
      }
      const instance = new model() as T;
      if (id) {
        return instance.load(id);
      } else {
        return instance;
      }
    }
  }
}

const nohm = new NohmClass({});

export { nohm, nohm as Nohm };
export default nohm;


// old js code copy-pasted follows for now


NohmClass.__validators = {};
var __extraValidators = [];
/**
 * Set some extra validator files. These will also be exported to the browser via connect middleware if used.
 * @static
 */
NohmClass.setExtraValidations = function (files) {
  if (!Array.isArray(files)) {
    files = [files];
  }
  files.forEach(function (path) {
    if (__extraValidators.indexOf(path) === -1) {
      __extraValidators.push(path);
      var validators = require(path);
      Object.keys(validators).forEach(function (name) {
        NohmClass.__validators[name] = validators[name];
      });
    }
  });
};

NohmClass.getExtraValidatorFileNames = function () {
  return __extraValidators;
};

// prototype methods:

/**
 * Returns the key needed to retreive a hash (properties) of an instance.
 * @param {Number} id Id of the model instance.
 */
NohmClass.prototype.getHashKey = function (id) {
  return NohmClass.prefix.hash + this.modelName + ':' + id;
};

/**
 * Returns the client of either the model (if set) or the global Nohm object.
 */
NohmClass.prototype.getClient = function () {
  var client = this.client || NohmClass.client;
  if (!client.connected) {
    NohmClass.logError('Warning: Tried accessing a redis client that is not connected to a database. The redis client should buffer the commands and send them once connected. But if it can\'t connect they are lost.');
  }
  return client;
};

var addMethods = function (methods) {
  for (var name in methods) {
    if (methods.hasOwnProperty(name) && typeof (methods[name]) === 'function') {
      if (this[name]) {
        this['_super_' + name] = this[name];
      }
      this[name] = methods[name].bind(this);
    }
  }
};

NohmClass.prototype.init = function (options) {
  if (typeof (options.client) === 'undefined' && NohmClass.client === null) {
    NohmClass.logError('Did not find a viable redis client in Nohm or the model: ' + this.modelName);
    return false;
  }

  if (!this.meta.inDb) {
    __updateMeta.call(this, options.metaCallback);
  }

  if (typeof (options.client) !== 'undefined') {
    this.client = options.client;
  }

  this.properties = {};
  this.errors = {};

  // initialize the properties
  if (options.hasOwnProperty('properties')) {

    for (var p in options.properties) {
      if (options.properties.hasOwnProperty(p)) {
        this.properties[p] = h.$extend(true, {}, options.properties[p]); // deep copy
        var defaultValue = options.properties[p].defaultValue || 0;
        if (typeof (defaultValue) === 'function') {
          defaultValue = defaultValue();
        }
        if (typeof (options.properties[p].type) === 'function') {
          // behaviours should not be called on initialization
          this.properties[p].value = defaultValue;
        } else {
          this.property(p, defaultValue); // this ensures typecasing
        }
        this.__resetProp(p);
        this.errors[p] = [];
      }
    }
  }

  if (options.hasOwnProperty('methods')) {
    addMethods.call(this, options.methods);
  }

  if (options.hasOwnProperty('publish')) {
    this.publish = options.publish;
  }

  this.relationChanges = [];

  this.id = null;
  this.__inDB = false;
  this.__loaded = false;
};



var __updateMeta = function (callback) {
  if (!NohmClass.meta) {
    return false;
  }

  if (typeof (callback) !== 'function') {
    callback = function () { };
  }

  var self = this;

  var version_key = NohmClass.prefix.meta.version + this.modelName;
  var idGenerator_key = NohmClass.prefix.meta.idGenerator + this.modelName;
  var properties_key = NohmClass.prefix.meta.properties + this.modelName;
  var properties = traverse(self.meta.properties).map(function (x) {
    if (typeof x === 'function') {
      return String(x);
    } else {
      return x;
    }
  });

  this.getClient().get(version_key, function (err, db_version) {
    if (err) {
      NohmClass.logError(err);
      callback(err);
    } else if (self.meta.version !== db_version) {
      async.parallel({
        version: function (next) {
          self.getClient().set(version_key, self.meta.version, next);
        },
        idGenerator: function (next) {
          self.getClient().set(idGenerator_key, self.idGenerator.toString(), next);
        },
        properties: function (next) {
          self.getClient().set(properties_key, JSON.stringify(properties), next);
        },
      }, function (err) {
        if (err) {
          NohmClass.logError(err);
          callback(err, self.meta.version);
        } else {
          self.meta.inDb = true;
          callback(null, self.meta.version);
        }
      });
    } else {
      self.meta.inDb = true;
      callback(null, self.meta.version);
    }
  });
};

/**
 * DO NOT USE THIS UNLESS YOU ARE ABSOLUTELY SURE ABOUT IT!
 *
 * Deletes any keys from the db that start with nohm prefixes.
 *
 * DO NOT USE THIS UNLESS YOU ARE ABSOLUTELY SURE ABOUT IT!
 *
 * @param {Object} [redis] You can specify the redis client to use. Default: Nohm.client
 * @param {Function} [callback] Called after all keys are deleted.
 */
NohmClass.purgeDb = function (redis, callback) {
  callback = h.getCallback(arguments);
  redis = typeof (redis) !== 'function' || NohmClass.client;
  var delKeys = function (prefix, next) {
    redis.keys(prefix + '*', function (err, keys) {
      if (err || keys.length === 0) {
        next(err);
      } else {
        keys.push(next);
        redis.del.apply(redis, keys);
      }
    });
  };
  let deletes = [];

  Object.keys(NohmClass.prefix).forEach(function (key) {
    deletes.push(async.apply(delKeys, NohmClass.prefix[key]));
  });

  async.series(deletes, function (err) {
    callback(err);
  });
};

let moduleNames = ['properties', 'retrieve', 'validation', 'store', 'relations', 'connectMiddleware', 'pubsub'],
  modules = {};

moduleNames.forEach(function (name) {
  // first integrate all the modules
  modules[name] = require(__dirname + '/' + name);
  h.prototypeModule(NohmClass, modules[name]);
});
moduleNames.forEach(function (name) {
  // then give them the complete Nohm.
  if (typeof (modules[name].setNohm) !== 'undefined')
    modules[name].setNohm(NohmClass);
});

exports.Nohm = NohmClass;
