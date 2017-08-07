import * as redis from 'redis';
import { createHash } from 'crypto';
import * as _ from 'lodash';
import * as traverse from 'traverse';
import { v1 as uuid } from 'uuid';

import { NohmClass, INohmPrefixes } from './index';
import {
  INohmModel,
  IModelPropertyDefinition,
  IModelPropertyDefinitions,
  IModelOptions,
} from './model.d';

import { idGenerators } from './idGenerators';

export { IModelPropertyDefinition, IModelPropertyDefinitions, IModelOptions };
export { NohmModel };

interface IDictionary {
  [index: string]: any;
}

interface ISaveOptions {
  continue_on_link_error: boolean;
  silent: boolean;
  skip_validation_and_unique_indexes: boolean;
}

/**
 * The property types that get indexed in a sorted set.
 * This should not be changed since it can invalidate already existing data.
 */
const indexNumberTypes = ['integer', 'float', 'timestamp'];

type IProperties = Map<string, {
  value: any;
  __updated: boolean;
  __oldValue: any;
  __numericIndex: boolean; // this is static but private so for now it might be better here than in definitions
}>;

abstract class NohmModel<TProps extends IDictionary = {}> implements INohmModel {

  public id: any;

  public client: redis.RedisClient;
  public errors: {
    [key: string]: Array<string>;
  };
  public readonly modelName: string;
  public meta: {
    inDb: boolean,
    properties: IModelPropertyDefinitions,
    version: string,
  };

  protected properties: IProperties;
  protected options: IModelOptions;
  protected publish: boolean;
  protected abstract definitions: {
    [key in keyof TProps]: IModelPropertyDefinition;
  };

  private allPropertiesCache: {
    [key in keyof TProps]: any;
  } & { id: any };
  private relationChanges: Array<any>;
  private inDb: boolean;
  private loaded: boolean;

  constructor() {
    this._initOptions();
    if (typeof (this.client) === 'undefined') {
      NohmClass.logError('Did not find a viable redis client in Nohm or the model: ' + this.modelName);
    }

    if (!this.meta.inDb) {
      this.updateMeta(this.options.metaCallback);
    }

    this.properties = new Map();
    this.allPropertiesCache = {
      id: null,
    } as any;
    this.errors = {};

    // initialize the properties
    if (this.options.hasOwnProperty('properties')) {
      Object.keys(this.definitions).forEach((key: keyof TProps) => {
        const definition = this.definitions[key];
        let defaultValue = definition.defaultValue || 0;
        if (typeof (defaultValue) === 'function') {
          defaultValue = defaultValue();
        }
        this.properties.set(key, {
          __numericIndex: false,
          __oldValue: null,
          __updated: false,
          value: defaultValue,
        });
        if (typeof (definition.type) !== 'function') {
          // behaviours should not be called on initialization - thus leaving it at defaultValue
          this.property(key, defaultValue); // this ensures typecasing
        }
        this.__resetProp(key);
        this.errors[key] = [];
      });
    }

    if (this.options.methods) {
      this.addMethods(this.options.methods);
    }

    if (this.options.publish) {
      this.publish = this.options.publish;
    }

    if (!this.options.idGenerator) {
      this.options.idGenerator = 'default';
    }

    this.relationChanges = [];

    this.id = null;
    this.inDb = false;
    this.loaded = false;
  }

  private __resetProp(property: keyof TProps) {
    const tmp = this.properties.get(property);
    if (!tmp) {
      NohmClass.logError('Error: Internally __resetProp was called on undefined property.');
      return;
    }
    tmp.__updated = false;
    tmp.__oldValue = tmp.value;
    type genericFunction = (...args: Array<any>) => any;
    let type: string | genericFunction = this.definitions[property].type;
    if (typeof (type) !== 'string') {
      type = '__notIndexed__';
    }
    tmp.__numericIndex = indexNumberTypes.indexOf(type) > -1;
  }

  private addMethods(methods?: { [name: string]: () => any }) {
    if (methods) {
      _.each(methods, (method, name) => {
        console.log('DEPRECATED: Adding methods using the options.methods way is deprecated.');
        if (typeof ((this as any)[name]) !== 'undefined') {
          // tslint:disable-next-line:max-line-length
          console.warn(`WARNING: Overwriting existing property/method '${name}' in '${this.modelName}' because of method definition.`);
        }
        (this as any)[name] = method;
      });
    }
  }

  private updateMeta(
    callback: (
      error: string | Error | null, version?: string,
    ) => any = (..._args: Array<any>) => { /* noop */ },
  ) {
    const versionKey = this.rawPrefix().meta.version + this.modelName;
    const idGeneratorKey = this.rawPrefix().meta.idGenerator + this.modelName;
    const propertiesKey = this.rawPrefix().meta.properties + this.modelName;
    const properties = traverse(this.meta.properties).map((x) => {
      if (typeof x === 'function') {
        return String(x);
      } else {
        return x;
      }
    });

    this.client.get(versionKey, (err, dbVersion) => {
      if (err) {
        NohmClass.logError(err);
        callback(err);
      } else if (this.meta.version !== dbVersion) {
        // TODO: refactor promise based and without async.parallel
        async.parallel({
          idGenerator: (next) => {
            const generator = this.options.idGenerator || 'default';
            this.client.set(idGeneratorKey, generator.toString(), next);
          },
          properties: (next) => {
            this.client.set(propertiesKey, JSON.stringify(properties), next);
          },
          version: (next) => {
            this.client.set(versionKey, this.meta.version, next);
          },
        }, (asyncErr: Error | string | null) => {
          if (asyncErr) {
            NohmClass.logError(asyncErr);
            callback(asyncErr, this.meta.version);
          } else {
            this.meta.inDb = true;
            callback(null, this.meta.version);
          }
        });
      } else {
        this.meta.inDb = true;
        callback(null, this.meta.version);
      }
    });
  }


  /**
   * DO NOT OVERWRITE THIS; USED INTERNALLY
   *
   * @protected
   */
  protected abstract _initOptions(): any;

  /**
   * DO NOT OVERWRITE THIS; USED INTERNALLY
   *
   * @protected
   */
  protected abstract prefix(prefix: keyof INohmPrefixes): string;

  /**
   * DO NOT OVERWRITE THIS; USED INTERNALLY
   *
   * @protected
   */
  protected abstract rawPrefix(): INohmPrefixes;

  protected generateMetaVersion(): string {
    const hash = createHash('sha1');

    const idGenerator = this.options.idGenerator || 'default';

    hash.update(JSON.stringify(this.definitions));
    hash.update(JSON.stringify(this.modelName));
    hash.update(idGenerator.toString());

    return hash.digest('hex');
  }

  /**
   * Read and write properties to the instance.
   *
   * @param {(string | PropertyObject)} keyOrValues Name of the property as string or an object where
   * the keys are the names and the values the new values
   * @param {*} [value] If changing a property and using the .property('string', value) call signature this is the value
   * @returns {(any | void)} Returns the property value if the first parameter was string and
   * no second parameter is given
   */
  public property(key: keyof TProps): any;
  public property(key: keyof TProps, value: any): void;
  public property(values: {[key in keyof TProps]: any}): void;
  public property(keyOrValues: keyof TProps | {[key in keyof TProps]: any}, value?: any): any | void {
    if (typeof (keyOrValues) !== 'string') {
      const obj = _.map(keyOrValues, (innerValue, key) => this.property(key, innerValue));
      return obj;
    }
    if (value) {
      this.setProperty(keyOrValues, value);
      this.allPropertiesCache[keyOrValues] = this.property(keyOrValues);
    } else {
      const prop = this.properties.get(keyOrValues);
      if (!prop) {
        throw new Error(`Invalid property key '${keyOrValues}'.`);
      }
      return prop.value;
    }
  }

  public setProperty(key: string, value: any): void {
    this.properties.set(key, value);
  }

  /**
   *  Get all properties with values either as an array or as json (param true)
   */
  public allProperties(): TProps & { id: any } {
    return this.allPropertiesCache;
  }

  public save(options: ISaveOptions = {
    continue_on_link_error: false,
    silent: false,
    skip_validation_and_unique_indexes: false,
  }): Promise<any> {
    return new Promise(async (resolve) => {
      let action: 'update' | 'create' = 'update';
      if (!this.id) {
        action = 'create';
        // create and set a unique temporary id
        // TODO: determine if this is still needed or can be solved more elegantly.
        // for example just ditching manual id creation and use uuid everywhere.
        // that would also make clustered/shareded storage much more straight forward
        // and remove quite a bit of code here.
        this.id = uuid();
      }
      let isValid = true;
      if (options.skip_validation_and_unique_indexes === false) {
        isValid = await this.validate(null, true);
      }
      const idExists = await this.checkIdExists(this.id);
      if (action === 'create' && !idExists) {
        await this.create();
      }
      await this.update(options);
      resolve();
    });
  }

  private checkIdExists(id: any): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.client.sismember(this.prefix('idsets'), id, (err, found) => {
        if (err) {
          reject(err);
        } else {
          resolve(!!found);
        }
      });
    });
  }

  private async create() {
    const id = this.generateId();
    await this.storeId(id);
    await this.setUniqueIds(id);
    this.id = id;
  }

  private async generateId(): Promise<string> {
    let id = null;
    let generator = this.options.idGenerator;
    if (typeof (generator) === 'function') {
      id = await generator.call(this);
    } else {
      if (!generator || !idGenerators[generator]) {
        generator = 'default';
      }
      id = await idGenerators[generator].call(idGenerators, this.client, this.prefix('incrementalIds'));
    }
    return id;
  }

  private storeId(id: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.SADD(this.prefix('idsets'), id, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Sets the unique ids of all unique property values in this instance to the given id.
   * Warning: Only use this during create() when overwriting temporary ids!
   */
  private setUniqueIds(id: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const mSetArguments = [];
      for (const [key, prop] of this.properties) {
        const isUnique = !!this.definitions[key].unique;
        const isEmptyString = prop.value === ''; // marking an empty string as unique is probably never wanted
        const isDirty = prop.__updated || !this.inDb;
        if (isUnique && !isEmptyString && isDirty) {
          let value = this.property(key);
          if (this.definitions[key].type === 'string') {
            value = (value as string).toLowerCase();
          }
          const prefix = this.prefix('unique');
          mSetArguments.push(`${prefix}:${key}:${value}`, id);
        }
      }
      if (mSetArguments.length === 0) {
        resolve();
      } else {
        this.client.MSET(mSetArguments, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      }
    });
  }

  private update(options: ISaveOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const hmSetArguments = [];
      const multi = this.client.MULTI();
      const isCreate = !this.inDb;

      hmSetArguments.push(`${this.prefix('hash')}:${this.id}`);

      for (const [key, prop] of this.properties) {
        if (isCreate || prop.__updated) {
          hmSetArguments.push(key, prop.value);
        }
      }

      if (hmSetArguments.length > 1) {
        hmSetArguments.push('__meta_version', this.meta.version);
        multi.HMSET.apply(multi, hmSetArguments);
      }

      this.setIndices(multi);

      multi.exec((err) => {
        if (err) {
          return reject(err);
        }

        // TODO: Relation changes go here

        // TODO: pubsub stuff goes here

        resolve();

      });
    });
  }

  private setIndices(multi: redis.Multi | redis.RedisClient) {
    for (const [key, prop] of this.properties) {
      const isUnique = !!this.definitions[key].unique;
      const isIndex = !!this.definitions[key].index;
      const isDirty = prop.__updated || !this.inDb;

      // free old uniques
      if (isUnique && prop.__updated && this.inDb) {
        let oldUniqueValue = prop.__oldValue;
        if (this.definitions[key].type === 'string') {
          oldUniqueValue = (oldUniqueValue as string).toLowerCase();
        }
        multi.DEL(`${this.prefix('unique')}:${key}:${oldUniqueValue}`, NohmClass.logError);
      }

      // set new normal index
      if (isIndex && isDirty) {
        if (prop.__numericIndex) {
          // we use scored sets for things like "get all users older than 5"
          const scoredPrefix = this.prefix('scoredindex');
          if (this.inDb) {
            multi.ZREM(`${scoredPrefix}:${key}`, this.id, NohmClass.logError);
          }
          multi.ZADD(`${scoredPrefix}:${key}`, prop.value, this.id, NohmClass.logError);
        }
        const prefix = this.prefix('index');
        if (this.inDb) {
          multi.SREM(`${prefix}:${key}:${prop.__oldValue}`, this.id, NohmClass.logError);
        }
        multi.SADD(`${prefix}:${key}:${prop.value}`, this.id, NohmClass.logError);
      }
    }
  }

  public valid(property: keyof TProps | null, setDirectly = false) {
    // TODO: decide whether actually deprecating this is worth it.
    console.warn('DEPRECATED: Usage of NohmModel.valid() is deprecated, use NohmModel.validate() instead.');
    this.validate(property, setDirectly);
  }

  public validate(_property: keyof TProps | null, _setDirectly = false) {
    return Promise.resolve(true);
  }
}

export default NohmModel;
