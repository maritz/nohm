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

export { IModelPropertyDefinition, IModelPropertyDefinitions, IModelOptions };
export { NohmModel };

interface IDictionary {
  [index: string]: any;
}

/**
 * The property types that get indexed in a sorted set.
 * This should not be changed since it can invalidate already existing data.
 */
const indexNumberTypes = ['integer', 'float', 'timestamp'];

interface IProperties {
  [key: string]: {
    value: any;
    __updated: boolean;
    __oldValue: any;
    __numericIndex: boolean;
  };
}

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

    this.properties = {};
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
        this.properties[key] = {
          __numericIndex: false,
          __oldValue: null,
          __updated: false,
          value: defaultValue,
        };
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
    const tmp = this.properties[property];
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

  protected idGenerator(): Promise<string> {
    return Promise.resolve(uuid());
  }

  protected idGeneratorIncremental(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.client.incr(this.prefix('ids'), (err, newId) => {
        if (err || newId.length < 1) {
          reject(err || new Error('No new id was returned'));
        } else {
          resolve(newId[0]);
        }
      });
    });
  }

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
      this.allPropertiesCache[keyOrValues] = this.properties[keyOrValues].value;
    } else {
      return this.properties[keyOrValues].value;
    }
  }

  public setProperty(key: string, value: any): void {
    this.properties[key] = value;
  }

  /**
   *  Get all properties with values either as an array or as json (param true)
   */
  public allProperties(): TProps & { id: any } {
    return this.allPropertiesCache;
  }
}

export default NohmModel;
