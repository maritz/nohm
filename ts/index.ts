import * as Debug from 'debug';
import { EventEmitter } from 'events';
import * as redis from 'redis';

import { LinkError } from './errors/LinkError';
import { ValidationError } from './errors/ValidationError';
import { getPrefix, INohmPrefixes } from './helpers';
import { IMiddlewareOptions, middleware, TRequestHandler } from './middleware';
import {
  IDictionary,
  ILinkOptions,
  IModelOptions,
  IModelPropertyDefinition,
  IModelPropertyDefinitions,
  ISortOptions,
  NohmModel,
  TLinkCallback,
} from './model';
import {
  boolProperty,
  dateProperty,
  floatProperty,
  IChangeEventPayload,
  IDefaultEventPayload,
  integerProperty,
  IRelationChangeEventPayload,
  ISearchOption,
  IStaticMethods,
  jsonProperty,
  numberProperty,
  stringProperty,
  timeProperty,
  timestampProperty,
  TTypedDefinitions,
} from './model.header';
import { psubscribe, punsubscribe } from './typed-redis-helper';

export {
  boolProperty,
  dateProperty,
  floatProperty,
  IChangeEventPayload,
  IDefaultEventPayload,
  IDictionary,
  ILinkOptions,
  IModelOptions,
  IModelPropertyDefinition,
  IModelPropertyDefinitions,
  INohmPrefixes,
  integerProperty,
  IRelationChangeEventPayload,
  ISortOptions,
  IStaticMethods,
  jsonProperty,
  LinkError,
  NohmModelExtendable as NohmModel,
  numberProperty,
  stringProperty,
  timeProperty,
  timestampProperty,
  TLinkCallback,
  TTypedDefinitions,
  ValidationError,
};
export { nohm, nohm as Nohm };

const debug = Debug('nohm:index');
const debugPubSub = Debug('nohm:pubSub');

const PUBSUB_ALL_PATTERN = '*:*';

// this is the exported extendable version - still needs to be registered to receive proper methods
abstract class NohmModelExtendable<TProps = any> extends NohmModel<TProps> {
  public client: redis.RedisClient;
  protected nohmClass: NohmClass;
  /**
   * DO NOT OVERWRITE THIS; USED INTERNALLY
   *
   * @protected
   */
  protected _initOptions() {
    // overwritten in NohmClass.model/register
    throw new Error(
      'Class is not extended proplery. Use the return Nohm.register() instead of your class directly.',
    );
  }
  /**
   * DO NOT OVERWRITE THIS; USED INTERNALLY
   *
   * @protected
   */
  protected prefix(_prefix: keyof INohmPrefixes): string {
    // overwritten in NohmClass.model/register
    throw new Error(
      'Class is not extended proplery. Use the return Nohm.register() instead of your class directly.',
    );
  }
  /**
   * DO NOT OVERWRITE THIS; USED INTERNALLY
   *
   * @protected
   */
  protected rawPrefix(): INohmPrefixes {
    // overwritten in NohmClass.model/register
    throw new Error(
      'Class is not extended proplery. Use the return Nohm.register() instead of your class directly.',
    );
  }
}

export interface INohmOptions {
  prefix?: string;
  client?: redis.RedisClient;
  meta?: boolean;
  publish?: boolean | redis.RedisClient;
}

export type Constructor<T> = new (...args: Array<any>) => T;

function staticImplements<T>() {
  return (_constructor: T) => {
    // no op decorator
  };
}

/**
 * Some generic definitions for Nohm
 *
 * @namespace Nohm
 */

/**
 * Nohm specific Errors
 *
 * @namespace NohmErrors
 */

/**
 * Main Nohm class.Hholds models, generic configuration and can generate the middleware for client validations.
 *
 * Can be instantiated multiple times if you want different configurations, but usually you only need the default
 * that is exported as `require('nohm').nohm`.
 *
 * @example
 * // To instantiate another you can do this:
 * const NohmClass = require('nohm').NohmClass;
 * const myNohm = new NohmClas({ prefix: 'SomePrefix' });
 *
 * @class NohmClass
 */
export class NohmClass {
  /**
   * The redis prefixed key object.
   * Defaults to prefixing with 'nohm' which then creates keys like 'nohm:idsets:someModel'.
   */
  public prefix: INohmPrefixes;

  /**
   * The current global nohm redis client
   */
  public client: redis.RedisClient;

  public readonly LinkError = LinkError;
  public readonly ValidationError = ValidationError;

  /**
   * Whether to store the meta values about models.
   * This is used for example by the admin app.
   * Defaults to true.
   */
  private meta: boolean;

  private publish: boolean = false;
  private publishClient: redis.RedisClient;
  private isPublishSubscribed: boolean;
  private publishEventEmitter: EventEmitter;

  private modelCache: {
    [name: string]: Constructor<NohmModel<any>>;
  };

  private extraValidators: Array<string>;

  constructor({ prefix, client, meta, publish }: INohmOptions) {
    debug('Creating NohmClass.', arguments);
    this.setPrefix(prefix);
    if (client) {
      this.setClient(client);
    }
    this.modelCache = {};
    this.extraValidators = [];
    this.meta = meta || true;
    this.isPublishSubscribed = false;
    if (typeof publish !== 'undefined') {
      if (typeof publish !== 'boolean') {
        this.setPublish(true);
        this.setPubSubClient(publish);
      } else {
        this.setPublish(publish);
      }
    }
  }

  /**
   * Set the Nohm global redis client.
   * Note: this will not affect models that have a client set on their own.
   */
  public setPrefix(prefix = 'nohm') {
    debug('Setting new prefix.', prefix);
    this.prefix = getPrefix(prefix);
  }

  /**
   * Set the Nohm global redis client.
   * Note: this will not affect models that have a client set on their own.
   */
  public setClient(client?: redis.RedisClient) {
    debug(
      'Setting new redis client. Connected: %s; Address: %s.',
      client && client.connected,
      client && (client as any).address,
    );
    if (client && !client.connected) {
      this
        .logError(`WARNING: setClient() received a redis client that is not connected yet.
      Consider waiting for an established connection before setting it.`);
    } else if (!client) {
      client = redis.createClient();
    }
    this.client = client;
  }

  public logError(err: string | Error | null) {
    if (err) {
      console.error({
        // TODO: Make this a wrapped NohmError if not already an error
        message: err,
        name: 'Nohm Error',
      });
    }
  }

  /**
   * Creates and returns a new model class with the given name and options.
   *  If you're using Typescript it is strongly advised to use Nohm.register() instead.
   *
   * @param {string} modelName Name of the model. This needs to be unique and is used in data storage.
   *                      Thus <b>changing this will invalidate existing data</b>!
   * @param {IModelDefinitions} options This is an object containing the actual model definitions.
   *                                    These are: properties, methods (optional) and the client (optional) to be used.
   * @param {boolean} temp When true, this model is not added to the internal model cache,
   *                        meaning methods like factory() and getModels() cannot access them.
   *                        This is mostly useful for meta things like migrations.
   * @returns {NohmStaticModel}
   */
  public model<TAdditionalMethods>(
    modelName: string,
    options: IModelOptions & { properties: IModelPropertyDefinitions },
    temp = false,
  ): Constructor<NohmModelExtendable<IDictionary> & TAdditionalMethods> &
    IStaticMethods<NohmModel> {
    if (!modelName) {
      this.logError('When creating a new model you have to provide a name!');
    }
    debug('Registering new model using model().', modelName, options, temp);
    // tslint:disable-next-line:no-this-assignment
    const self = this; // well then...

    /**
     * The static Model Class, used to get instances or operate on multiple records.
     *
     * @class NohmStaticModel
     */
    @staticImplements<IStaticMethods<CreatedClass>>()
    // tslint:disable-next-line:max-classes-per-file
    class CreatedClass extends NohmModelExtendable {
      /**
       * Redis client that is set for this Model.
       * Defaults to the NohmClass client it was registered in.
       *
       * @memberof NohmStaticModel
       * @type {RedisClient}
       */
      public client = self.client;

      protected nohmClass = self;
      protected options = options;

      /**
       * Name of the model, used for database keys and relation values
       *
       * @memberof NohmStaticModel
       * @type {string}
       */
      public readonly modelName = modelName;

      /**
       * Creates an instance of CreatedClass.
       *
       * @ignore
       * @memberof NohmStaticModel
       */
      constructor() {
        super();
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
        Object.getPrototypeOf(this).definitions = this.options.properties;
        this.meta = {
          inDb: false,
          properties: {},
          version: '',
        };
        if (!this.client) {
          this.client = self.client;
        }
      }

      protected prefix(prefix: keyof INohmPrefixes): string {
        return self.prefix[prefix] + modelName;
      }

      protected rawPrefix(): INohmPrefixes {
        return self.prefix;
      }

      /**
       * Creates a new model instance and loads it with the given id.
       *
       * @static
       * @param {*} id ID of the model to be loaded
       * @throws {Error('not found')} If no record exists of the given id,
       * an error is thrown with the message 'not found'
       * @alias load
       * @memberof! NohmStaticModel
       * @returns {Promise<NohmModel>}
       */
      public static async load<P extends NohmModel>(id: any): Promise<P> {
        const model = await self.factory<P>(modelName);
        await model.load(id);
        return model;
      }

      /**
       * Loads an Array of NohmModels via the given ids. Any ids that do not exist will just be ignored.
       * If any of the ids do not exist in the database, they are left out instead of throwing an error.
       * Thus if no ids exist an empty error is returned.
       *
       * @static
       * @param {Array<string>} ids Array of IDs of the models to be loaded
       * @alias loadMany
       * @memberof! NohmStaticModel
       * @returns {Promise<NohmModel>}
       */
      public static async loadMany<P extends NohmModel>(
        ids: Array<string>,
      ): Promise<Array<P>> {
        if (!Array.isArray(ids) || ids.length === 0) {
          return [];
        }
        const loadPromises = ids.map(async (id) => {
          try {
            return await self.factory(modelName, id);
          } catch (err) {
            if (err && err.message === 'not found') {
              return;
            } else {
              throw err;
            }
          }
        });
        const loadedModels = await Promise.all(loadPromises);
        return loadedModels.filter<P>(
          (model): model is P => typeof model !== 'undefined',
        );
      }

      /**
       * Finds ids of objects and loads them into full NohmModels.
       *
       * @static
       * @param {ISearchOptions} searches
       * @alias findAndLoad
       * @memberof! NohmStaticModel
       * @returns {Promise<Array<NohmModel>>}
       */
      public static async findAndLoad<
        P extends NohmModel,
        TProps extends IDictionary
      >(
        searches?: Partial<
          {
            [key in keyof TProps]:
              | string
              | number
              | boolean
              | Partial<ISearchOption>
          }
        >,
      ): Promise<Array<P>> {
        const dummy = await self.factory<P>(modelName);
        const ids = await dummy.find(searches);
        if (ids.length === 0) {
          return [];
        }
        const loadPromises = ids.map((id) => {
          return self.factory<P>(modelName, id);
        });
        return Promise.all(loadPromises);
      }

      /**
       * Sort the given ids or all stored ids by their SortOptions
       *
       * @static
       * @see NohmModel.sort
       * @param {ISortOptions<IDictionary>} [sortOptions={}] Search options
       * @alias sort
       * @memberof! NohmStaticModel
       * @returns {Promise<Array<string>>} Array of ids
       */
      public static async sort(
        sortOptions: ISortOptions<IDictionary> = {},
        ids: Array<string | number> | false = false,
      ): Promise<Array<string>> {
        const dummy = await self.factory(modelName);
        return dummy.sort(sortOptions, ids);
      }

      /**
       * Search for ids
       *
       * @static
       * @see NohmModel.find
       * @param {ISearchOptions} [searches={}] Search options
       * @alias find
       * @memberof NohmStaticModel
       * @returns {Promise<Array<string>>} Array of ids
       */
      public static async find<TProps extends IDictionary>(
        searches: Partial<
          {
            [key in keyof TProps]:
              | string
              | number
              | boolean
              | Partial<ISearchOption>
          }
        > = {},
      ): Promise<Array<string>> {
        const dummy = await self.factory(modelName);
        return dummy.find(searches);
      }

      /**
       * Loads a NohmModels via the given id.
       *
       * @static
       * @param {*} id ID of the model to be loaded
       * @alias remove
       * @memberof NohmStaticModel
       * @returns {Promise<NohmModel>}
       */
      public static async remove(id: any, silent?: boolean): Promise<void> {
        const model = await self.factory(modelName);
        model.id = id;
        await model.remove(silent);
      }
    }

    if (!temp) {
      this.modelCache[modelName] = CreatedClass;
    }

    return CreatedClass as any;
  }

  /**
   * Creates, registers and returns a new model class from a given class.
   * When using Typescript this is the preferred method of creating new models over using Nohm.model().
   *
   * @param {NohmModel} subClass Complete model class, needs to extend NohmModel.
   * @param {boolean} temp When true, this model is not added to the internal model cache,
   *                        meaning methods like factory() and getModels() cannot access them.
   *                        This is mostly useful for meta things like migrations.
   * @returns {NohmStaticModel}
   *
   * @example
   *   // Typescript
   *   import { Nohm, NohmModel, TTypedDefinitions } from 'nohm';
   *
   *   // this interface is useful for having typings in .property() and .allProperties() etc. but is optional
   *   interface IUserModelProps {
   *    name: string;
   *   }
   *
   *   class UserModelClass extends NohmModel<IUserModelProps> {
   *     protected static modelName = 'user'; // used in redis to store the keys
   *
   *     // the TTypedDefinitions generic makes sure that our definitions have the same keys as
   *     // defined in our property interface.
   *     // If you don't want to use the generic, you have to use the exported {type}Property types
   *     // to get around the tsc throwing an error.
   *     // TODO: look into the error thrown by tsc when leaving out TTYpedDefinitions and using 'sometype' as type
   *     protected static definitions: TTypedDefinitions<IUserModelProps> = {
   *       name: {
   *         defaultValue: 'testName',
   *         type: 'string', // you have to manually make sure this matches the IUserModelProps type!
   *         validations: [
   *           'notEmpty',
   *         ],
   *       },
   *     };
   *     public async foo() {
   *       const test = bar.property('name'); // no error and test typed to string
   *
   *       await bar.validate();
   *       bar.errors.name; // no error and typed
   *
   *       // accessing unknown props does not work,
   *       // because we specified that UserModel only has properties of IUserModelProps
   *       bar.property('foo'); // typescript errors
   *       bar.errors.foo; // typescript error
   *     };
   *   }
   *   const userModel = Nohm.register(UserModelClass);
   *   // typescript now knows about bar.foo() and all the standard nohm methods like bar.property();
   *   const bar = new userModel();
   *   bar.foo(); // no error
   *   bar.allProperties().name === 'testName'; // no error
   */
  public register<T extends Constructor<NohmModelExtendable<IDictionary>>>(
    subClass: T,
    temp = false,
  ): T & IStaticMethods<NohmModel> {
    // tslint:disable-next-line:no-this-assignment
    const self = this; // well then...
    const modelName = (subClass as any).modelName;
    if (!modelName) {
      throw new Error(
        'A class passed to nohm.register() did not have static a modelName property.',
      );
    }

    if (!(subClass as any).definitions) {
      throw new Error(
        'A class passed to nohm.register() did not have static property definitions.',
      );
    }

    debug(
      'Registering new model using register().',
      modelName,
      (subClass as any).definitions,
      temp,
    );

    // tslint:disable-next-line:max-classes-per-file
    @staticImplements<IStaticMethods<CreatedClass>>()
    class CreatedClass extends subClass {
      protected nohmClass = self;

      public readonly modelName = modelName;

      constructor(...args: Array<any>) {
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
        this.options = {
          idGenerator: (subClass as any).idGenerator,
          properties: {},
        };
        if (!this.client) {
          this.client = self.client;
        }
        this.meta = {
          inDb: false,
          properties: {},
          version: '',
        };
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

      public getDefinitions(): {
        [key: string]: IModelPropertyDefinition;
      } {
        const definitions = (CreatedClass as any).definitions;
        if (!definitions) {
          throw new Error(
            `Model was not defined with proper static definitions: '${modelName}'`,
          );
        }
        return definitions;
      }

      /**
       * Loads a NohmModels via the given id.
       *
       * @param {*} id ID of the model to be loaded
       * @returns {Promise<NohmModel|void>}
       */
      public static async load<P extends NohmModel>(id: any): Promise<P> {
        const model = await self.factory<P>(modelName);
        await model.load(id);
        return model;
      }

      /**
       * Loads an Array of NohmModels via the given ids. Any ids that do not exist will just be ignored.
       *
       * @param {Array<string>} ids Array of IDs of the models to be loaded
       * @returns {Promise<NohmModel>}
       */
      public static async loadMany<P extends NohmModel>(
        ids: Array<string>,
      ): Promise<Array<P>> {
        if (!Array.isArray(ids) || ids.length === 0) {
          return [];
        }
        const loadPromises = ids.map(async (id) => {
          try {
            return await self.factory(modelName, id);
          } catch (err) {
            if (err && err.message === 'not found') {
              return;
            } else {
              throw err;
            }
          }
        });
        const loadedModels = await Promise.all(loadPromises);
        return loadedModels.filter<P>(
          (model): model is P => typeof model !== 'undefined',
        );
      }

      /**
       * Finds ids of objects and loads them into full NohmModels.
       *
       * @param {ISearchOptions} searches
       * @returns {Promise<Array<NohmModel>>}
       */
      public static async findAndLoad<
        P extends NohmModel,
        TProps extends IDictionary
      >(
        searches?: Partial<
          {
            [key in keyof TProps]:
              | string
              | number
              | boolean
              | Partial<ISearchOption>
          }
        >,
      ): Promise<Array<P>> {
        const dummy = await self.factory<P>(modelName);
        const ids = await dummy.find(searches);
        if (ids.length === 0) {
          return [];
        }
        const loadPromises = ids.map((id) => {
          return self.factory<P>(dummy.modelName, id);
        });
        return Promise.all(loadPromises);
      }

      /**
       * Sort the given ids or all stored ids by their SortOptions
       *
       * @see NohmModel.sort
       * @static
       * @param {ISortOptions<IDictionary>} [sortOptions={}] Search options
       * @returns {Promise<Array<string>>} Array of ids
       */
      public static async sort(
        options: ISortOptions<IDictionary> = {},
        ids: Array<string | number> | false = false,
      ): Promise<Array<string>> {
        const dummy = await self.factory(modelName);
        return dummy.sort(options, ids);
      }

      /**
       * Search for ids
       *
       * @see NohmModel.find
       * @static
       * @param {ISearchOptions} [searches={}] Search options
       * @returns {Promise<Array<string>>} Array of ids
       */
      public static async find<TProps extends IDictionary>(
        searches: Partial<
          {
            [key in keyof TProps]:
              | string
              | number
              | boolean
              | Partial<ISearchOption>
          }
        > = {},
      ): Promise<Array<string>> {
        const dummy = await self.factory(modelName);
        return dummy.find(searches);
      }

      /**
       * Loads a NohmModels via the given id.
       *
       * @param {*} id ID of the model to be loaded
       * @returns {Promise<NohmModel>}
       */
      public static async remove(id: any, silent?: boolean): Promise<void> {
        const model = await self.factory(modelName);
        model.id = id;
        await model.remove(silent);
      }
    }

    if (!temp) {
      this.modelCache[modelName] = CreatedClass;
    }

    return CreatedClass;
  }

  /**
   * Get all model classes that are registered via .register() or .model()
   *
   * @returns {Array<NohmModelStatic>}
   */
  public getModels() {
    return this.modelCache;
  }

  /**
   * Creates a new instance of the model with the given modelName.
   * When given an id as second parameter it also loads it.
   *
   * @param {string} name Name of the model, must match the modelName of one of your defined models.
   * @param {*} [id] ID of a record you want to load.
   * @returns {Promise<NohmModel>}
   * @throws {Error('Model %name not found.')} Rejects when there is no registered model with the given modelName.
   * @throws {Error('not found')} If no record exists of the given id,
   * an error is thrown with the message 'not found'
   * @memberof NohmClass
   */
  public async factory<T extends NohmModel<any>>(
    name: string,
    id?: any,
  ): Promise<T> {
    if (
      typeof arguments[1] === 'function' ||
      typeof arguments[2] === 'function'
    ) {
      throw new Error(
        'Not implmented: factory does not support callback method anymore.',
      );
    } else {
      debug(`Factory is creating a new instance of '%s' with id %s.`, name, id);
      const model = this.modelCache[name];
      if (!model) {
        throw new Error(`Model '${name}' not found.`);
      }
      const instance = new model() as T;
      if (id) {
        await instance.load(id);
        return instance;
      } else {
        return instance;
      }
    }
  }

  /**
   * DO NOT USE THIS UNLESS YOU ARE ABSOLUTELY SURE ABOUT IT!
   *
   * Deletes any keys from the db that start with the set nohm prefixes.
   *
   * DO NOT USE THIS UNLESS YOU ARE ABSOLUTELY SURE ABOUT IT!
   *
   * @param {Object} [client] You can specify the redis client to use. Default: Nohm.client
   */
  public async purgeDb(client: redis.RedisClient = this.client): Promise<void> {
    function delKeys(prefix: string) {
      return new Promise<void>((resolve, reject) => {
        client.KEYS(prefix + '*', (err, keys) => {
          if (err) {
            reject(err);
          } else if (keys.length === 0) {
            resolve();
          } else {
            client.DEL(keys, (innerErr) => {
              if (innerErr) {
                reject(innerErr);
              } else {
                resolve();
              }
            });
          }
        });
      });
    }
    const deletes: Array<Promise<void>> = [];

    debug(
      `PURGING DATABASE!`,
      client && client.connected,
      client && (client as any).address,
      this.prefix,
    );

    Object.keys(this.prefix).forEach((key) => {
      const prefix = (this.prefix as any)[key];
      if (typeof prefix === 'object') {
        Object.keys(prefix).forEach((innerKey) => {
          const innerPrefix = prefix[innerKey];
          deletes.push(delKeys(innerPrefix));
        });
      } else {
        deletes.push(delKeys(prefix));
      }
    });

    await Promise.all(deletes);
  }

  public setExtraValidations(files: string | Array<string>) {
    debug(`Setting extra validation files`, files);
    if (!Array.isArray(files)) {
      files = [files];
    }
    files.forEach((path) => {
      if (this.extraValidators.indexOf(path) === -1) {
        this.extraValidators.push(path);
        const validators = require(path);
        Object.keys(validators).forEach((_name) => {
          // TODO for v1: check if this needs to be implemented
          // this.__validators[name] = validators[name];
        });
      }
    });
  }

  public getExtraValidatorFileNames(): Array<string> {
    return this.extraValidators;
  }

  public middleware(options: IMiddlewareOptions): TRequestHandler {
    return middleware(options, this);
  }

  public getPublish(): boolean {
    return this.publish;
  }

  public setPublish(publish: boolean) {
    debug(`Setting publish mode to '%o'.`, !!publish);
    this.publish = !!publish;
  }

  public getPubSubClient(): redis.RedisClient {
    return this.publishClient;
  }
  public setPubSubClient(client: redis.RedisClient): Promise<void> {
    debug(
      `Setting pubSub client. Connected: '%s'; Address: '%s'.`,
      client && client.connected,
      client && (client as any).address,
    );

    this.publishClient = client;
    return this.initPubSub();
  }

  private async initPubSub(): Promise<void> {
    if (!this.getPubSubClient()) {
      throw new Error(
        'A second redis client must set via nohm.setPubSubClient before using pub/sub methods.',
      );
    } else if (this.isPublishSubscribed === true) {
      // already in pubsub mode, don't need to initialize it again.
      return;
    }

    this.publishEventEmitter = new EventEmitter();
    this.publishEventEmitter.setMaxListeners(0); // TODO: check if this is sensible
    this.isPublishSubscribed = true;

    await psubscribe(
      this.publishClient,
      this.prefix.channel + PUBSUB_ALL_PATTERN,
    );

    debugPubSub(
      `Redis PSUBSCRIBE for '%s'.`,
      this.prefix.channel + PUBSUB_ALL_PATTERN,
    );

    this.publishClient.on('pmessage', (_pattern, channel, message) => {
      const suffix = channel.slice(this.prefix.channel.length);
      const parts = suffix.match(/([^:]+)/g); // Pattern = _prefix_:channel:_modelname_:_action_

      if (!parts) {
        this.logError(`An erroneous channel has been captured: ${channel}.`);
        return;
      }

      const modelName = parts[0];
      const action = parts[1];

      let payload = {};

      try {
        payload = message ? JSON.parse(message) : {};
        debugPubSub(
          `Redis published message for model '%s' with action '%s' and message: '%j'.`,
          modelName,
          action,
          payload,
        );
      } catch (e) {
        this.logError(
          `A published message is not valid JSON. Was : "${message}"`,
        );
        return;
      }

      this.publishEventEmitter.emit(`${modelName}:${action}`, payload);
    });
  }

  public async subscribeEvent(
    eventName: string,
    callback: (payload: any) => void,
  ): Promise<void> {
    await this.initPubSub();
    debugPubSub(`Redis subscribing to event '%s'.`, eventName);
    this.publishEventEmitter.on(eventName, callback);
  }

  public async subscribeEventOnce(
    eventName: string,
    callback: (payload: any) => void,
  ): Promise<void> {
    await this.initPubSub();
    debugPubSub(`Redis subscribing once to event '%s'.`, eventName);
    this.publishEventEmitter.once(eventName, callback);
  }

  public unsubscribeEvent(eventName: string, fn?: any): void {
    if (this.publishEventEmitter) {
      debugPubSub(
        `Redis unsubscribing from event '%s' with fn?: %s.`,
        eventName,
        fn,
      );
      if (!fn) {
        this.publishEventEmitter.removeAllListeners(eventName);
      } else {
        this.publishEventEmitter.removeListener(eventName, fn);
      }
    }
  }

  public async closePubSub(): Promise<redis.RedisClient> {
    if (this.isPublishSubscribed === true) {
      debugPubSub(
        `Redis PUNSUBSCRIBE for '%s'.`,
        this.prefix.channel + PUBSUB_ALL_PATTERN,
      );
      this.isPublishSubscribed = false;
      await punsubscribe(
        this.publishClient,
        this.prefix.channel + PUBSUB_ALL_PATTERN,
      );
    }
    return this.publishClient;
  }
}

const nohm = new NohmClass({});

export default nohm;
