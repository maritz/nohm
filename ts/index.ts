import { PSUBSCRIBE, PUNSUBSCRIBE } from './typed-redis-helper';
import { IMiddlewareOptions, middleware } from './middleware';
import * as redis from 'redis';

import { getPrefix, INohmPrefixes } from './helpers';
import {
  IDictionary,
  ILinkOptions,
  IModelOptions,
  IModelPropertyDefinition,
  IModelPropertyDefinitions,
  ISearchOptions,
  ISortOptions,
  NohmModel,
} from './model';

import { ValidationError } from './errors/ValidationError';
import { LinkError } from './errors/LinkError';
import { EventEmitter } from 'events';

export {
  ILinkOptions,
  IModelOptions,
  IModelPropertyDefinition,
  INohmPrefixes,
  LinkError,
  NohmModelExtendable as NohmModel,
  ValidationError,
};

const PUBSUB_ALL_PATTERN = '*:*';

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
  meta?: boolean;
  publish?: boolean | redis.RedisClient;
}

type Constructor<T> = new (...args: Array<any>) => T;

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
    [name: string]: Constructor<NohmModel<any>>,
  };

  private extraValidators: Array<string>;

  constructor({ prefix, client, meta, publish }: INohmOptions) {
    this.setPrefix(prefix);
    this.setClient(client);
    this.modelCache = {};
    this.extraValidators = [];
    this.meta = meta || true;
    this.isPublishSubscribed = false;
    if (typeof (publish) !== 'undefined') {
      if (typeof (publish) !== 'boolean') {
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
    this.prefix = getPrefix(prefix);
  }

  /**
   * Set the Nohm global redis client.
   * Note: this will not affect models that have a client set on their own.
   */
  public setClient(client?: redis.RedisClient) {
    if (client && !client.connected) {
      this.logError(`WARNING: setClient() received a redis client that is not connected yet.
      Consider waiting for an established connection before setting it.`);
    } else if (!client) {
      client = redis.createClient();
    }
    this.client = client;
  }

  public logError(err: string | Error | null) {
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
   */
  public model(
    name: string, options: IModelOptions & { properties: IModelPropertyDefinitions }, temp = false,
  ): Constructor<NohmModel<any>> {
    if (!name) {
      this.logError('When creating a new model you have to provide a name!');
    }
    // tslint:disable-next-line:no-this-assignment
    const self = this; // well then...

    // tslint:disable-next-line:max-classes-per-file
    class CreatedClass extends NohmModelExtendable {

      public client = self.client;

      protected definitions: IModelPropertyDefinitions;
      protected nohmClass = self;
      protected options = options;

      public readonly modelName = name;

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

      /* This (and .register()) is the only place where this method should exist.
      An alternative would be to pass the options as a special argument to super, but that would have the downside
      of making subclasses of subclasses impossible and restricting constructor argument freedom. */
      protected _initOptions() {
        this.options = options || { properties: {} };
        this.definitions = this.options.properties;
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
        return self.prefix[prefix] + name;
      }

      protected rawPrefix(): INohmPrefixes {
        return self.prefix;
      }

      /**
       * Finds ids of objects and loads them into full NohmModels.
       *
       * @param {ISearchOptions} searches
       * @returns {Promise<Array<NohmModel<IDictionary>>>}
       */
      public static async findAndLoad(searches: ISearchOptions = {}): Promise<Array<NohmModel<IDictionary>>> {
        const dummy = await nohm.factory(name);
        const ids = await dummy.find(searches);
        if (ids.length === 0) {
          return [];
        }
        const loadPromises = ids.map((id) => {
          return nohm.factory(name, id);
        });
        return Promise.all(loadPromises);
      }

      public static async sort(
        sortOptions: ISortOptions<IDictionary> = {},
        ids: Array<string | number> | false = false,
      ): Promise<Array<string>> {
        const dummy = await nohm.factory(name);
        return dummy.sort(sortOptions, ids);
      }

      public static async find(searches: ISearchOptions = {}): Promise<Array<string>> {
        const dummy = await nohm.factory(name);
        return dummy.find(searches);
      }
    }

    if (!temp) {
      this.modelCache[name] = CreatedClass;
    }

    return CreatedClass;
  }

  /**
   * Creates, registers and returns a new model class from a given class.
   * When using Typescript this is the preferred method of creating new models over using Nohm.model().
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
  public register<T extends Constructor<NohmModel<any>>>(
    subClass: T, temp = false,
  ): Constructor<NohmModel<any>> & T {
    // tslint:disable-next-line:no-this-assignment
    const self = this; // well then...
    const uninstantiatedName = '__nohm__uninstantiated';
    let modelName = uninstantiatedName;

    // tslint:disable-next-line:max-classes-per-file
    class CreatedClass extends subClass {
      protected definitions: IModelPropertyDefinitions;
      protected nohmClass = self;

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
        this.options = { properties: {} };
        this.definitions = {};
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

      /**
       * Finds ids of objects and loads them into full NohmModels.
       *
       * @param {ISearchOptions} searches
       * @returns {Promise<Array<NohmModel<IDictionary>>>}
       */
      public static async findAndLoad(searches: ISearchOptions = {}): Promise<Array<NohmModel<IDictionary>>> {
        const dummy = await nohm.factory(modelName);
        const ids = await dummy.find(searches);
        if (ids.length === 0) {
          return [];
        }
        const loadPromises = ids.map((id) => {
          return nohm.factory(dummy.modelName, id);
        });
        return Promise.all(loadPromises);
      }

      public static async sort(
        options: ISortOptions<IDictionary> = {},
        ids: Array<string | number> | false = false,
      ): Promise<Array<string>> {
        const dummy = await nohm.factory(modelName);
        return dummy.sort(options, ids);
      }

      public static async find(searches: ISearchOptions = {}): Promise<Array<string>> {
        const dummy = await nohm.factory(modelName);
        return dummy.find(searches);
      }
    }

    if (!temp) {
      const tempInstance = new CreatedClass();
      modelName = tempInstance.modelName;
      this.modelCache[modelName] = CreatedClass;
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

  public async factory<T extends NohmModel<any>>(
    name: string, id?: any, callback?: (this: T, err: string, properties: { [name: string]: any }) => any,
  ): Promise<T> {
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
   * Deletes any keys from the db that start with nohm prefixes.
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

  /**
   * Set some extra validator files. These will also be exported to the browser via connect middleware if used.
   */
  public setExtraValidations(files: string | Array<string>) {
    if (!Array.isArray(files)) {
      files = [files];
    }
    files.forEach((path) => {
      if (this.extraValidators.indexOf(path) === -1) {
        this.extraValidators.push(path);
        const validators = require(path);
        Object.keys(validators).forEach((_name) => {
          // TODO: implement this
          // this.__validators[name] = validators[name];
        });
      }
    });
  }

  public getExtraValidatorFileNames(): Array<string> {
    return this.extraValidators;
  }

  public middleware(options: IMiddlewareOptions) {
    return middleware(options, this);
  }

  public getPublish(): boolean {
    return this.publish;
  }

  public setPublish(publish: boolean) {
    this.publish = publish;
  }

  public getPubSubClient(): redis.RedisClient {
    return this.publishClient;
  }
  public setPubSubClient(client: redis.RedisClient): Promise<void> {
    this.publishClient = client;
    return this.initPubSub();
  }

  private async initPubSub(): Promise<void> {
    if (!this.getPubSubClient) {
      throw new Error('A second redis client must set via nohm.setPubSubClient before using pub/sub methods.');
    } else if (this.isPublishSubscribed === true) {
      // already in pubsub mode, don't need to initialize it again.
      return;
    }

    this.publishEventEmitter = new EventEmitter();
    this.publishEventEmitter.setMaxListeners(0); // TODO: check if this is sensible
    this.isPublishSubscribed = true;

    await PSUBSCRIBE(this.publishClient, this.prefix.channel + PUBSUB_ALL_PATTERN);

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
      } catch (e) {
        this.logError(`A published message is not valid JSON. Was : "${message}"`);
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
    this.publishEventEmitter.on(eventName, callback);
  }

  public async subscribeEventOnce(
    eventName: string,
    callback: (payload: any) => void,
  ): Promise<void> {
    await this.initPubSub();
    this.publishEventEmitter.once(eventName, callback);
  }

  public unsubscribeEvent(
    eventName: string,
    fn?: any,
  ): void {
    if (this.publishEventEmitter) {
      if (!fn) {
        this.publishEventEmitter.removeAllListeners(eventName);
      } else {
        this.publishEventEmitter.removeListener(eventName, fn);
      }
    }
  }

  public async closePubSub(): Promise<redis.RedisClient> {
    if (this.isPublishSubscribed === true) {
      this.isPublishSubscribed = false;
      await PUNSUBSCRIBE(this.publishClient, this.prefix.channel + PUBSUB_ALL_PATTERN);
    }
    return this.publishClient;
  }
}

const nohm = new NohmClass({});

export { nohm, nohm as Nohm };
export default nohm;


// old js code copy-pasted follows for now

