import * as redis from 'redis';

import { getPrefix, INohmPrefixes } from './helpers';
import { IModelOptions, IModelPropertyDefinition, IModelPropertyDefinitions, NohmModel } from './model';

export { INohmPrefixes, NohmModelExtendable as NohmModel, IModelOptions, IModelPropertyDefinition };

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

type Constructor<T> = new (...args: any[]) => T;

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

  /**
   * Whether to store the meta values about models.
   * This is used for example by the admin app.
   * Defaults to true.
   */
  private meta = true;

  private modelCache: {
    [name: string]: Constructor<NohmModel<any>>,
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
    this.prefix = getPrefix(prefix);
  }

  /**
   * Set the Nohm global redis client.
   * Note: this will not affect models that have a client set on their own.
   * @static
   */
  public setClient(client: redis.RedisClient) {
    this.client = client;
    if (!client.connected) {
      NohmClass.logError(`WARNING: setClient() received a redis client that is not connected yet.
Consider waiting for an established connection before setting it.`);
    }
  }

  public static logError(err: string | Error | null) {
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
  ): Constructor<NohmModel<any>> {
    if (!name) {
      NohmClass.logError('When creating a new model you have to provide a name!');
    }
    // tslint:disable-next-line:no-this-assignment
    const self = this; // well then...

    // tslint:disable-next-line:max-classes-per-file
    class CreatedClass extends NohmModelExtendable {

      public client = self.client;

      protected definitions: IModelPropertyDefinitions;

      protected options = options;

      public readonly modelName = name;

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
  public register<T extends Constructor<NohmModel<any>>>(
    subClass: T, temp = false,
  ): Constructor<NohmModel<any>> & T {
    // tslint:disable-next-line:no-this-assignment
    const self = this; // well then...

    // tslint:disable-next-line:max-classes-per-file
    class CreatedClass extends subClass {
      protected definitions: IModelPropertyDefinitions;

      constructor(...args: any[]) {
        super(...args);
        if (self.meta) {
          // TODO: fix meta info storing
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

  public factory<T extends NohmModel<any>>(
    name: string,
  ): T;
  public factory<T extends NohmModel<any>>(
    name: string, id: number,
  ): Promise<T>;
  /*public factory<T extends NohmModel<any>>(
    name: string, id?: number, callback?: (this: T, err: string, properties: { [name: string]: any }) => any,
  ): Promise<T>*/
  public factory<T extends NohmModel<any>>(
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

