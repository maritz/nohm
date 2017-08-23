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
  IProperty,
  IPropertyDiff,
  IValidationResult,
  ISaveOptions,
  validatiorFunction
} from './model.d';

import { idGenerators } from './idGenerators';
import { validators } from './validators';

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


abstract class NohmModel<TProps extends IDictionary> implements INohmModel {

  public id: any;

  public client: redis.RedisClient;
  public errors: {
    [key in keyof TProps]: Array<string>;
  };
  public readonly modelName: string;
  public meta: {
    inDb: boolean,
    properties: IModelPropertyDefinitions,
    version: string,
  };

  protected properties: Map<string, IProperty>;
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
    this.errors = {} as any;

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
    const tmp = this.getProperty(property);
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
   * @returns {(any)} Returns the property as set after type casting
   */
  public property(key: keyof TProps): any;
  // tslint:disable-next-line:unified-signatures
  public property(key: keyof TProps, value: any): any;
  // tslint:disable-next-line:unified-signatures
  public property(valuesObject: {[key in keyof TProps]: any}): any;
  public property(keyOrValues: keyof TProps | {[key in keyof TProps]: any}, value?: any): any {
    if (typeof (keyOrValues) !== 'string') {
      const obj = _.map(keyOrValues, (innerValue, key) => this.property(key, innerValue));
      return obj;
    }
    if (value) {
      this.setProperty(keyOrValues, value);
      this.allPropertiesCache[keyOrValues] = this.property(keyOrValues);
    }
    const prop = this.getProperty(keyOrValues);
    return prop.value;
  }

  private getProperty(key: keyof TProps) {
    const prop = this.properties.get(key);
    if (!prop) {
      throw new Error(`Invalid property key '${key}'.`);
    }
    return prop;
  }

  public setProperty(key: keyof TProps, value: any): void {
    const prop = this.getProperty(key);
    if (prop.value !== value) {
      prop.value = this.castProperty(key, prop);
      prop.__updated = prop.value !== prop.__oldValue;
      // TODO: test if prop is a reference or a copy. if it's a reference, we don't need to set it.
      this.properties.set(key, prop);
    }
  }

  private castProperty(key: keyof TProps, prop: IProperty): any {
    const type = this.definitions[key].type;

    if (typeof (type) === 'undefined') {
      return prop.value;
    }

    if (typeof (type) === 'function') {
      return type.call(this, prop.value, key, prop.__oldValue);
    }

    switch (type.toLowerCase()) {
      case 'boolean':
      case 'bool':
        return prop.value === 'false' ? false : !!prop.value;
      case 'string':
      case 'string':
        // no .toString() here. TODO: or should there be?
        return (
          (!(prop.value instanceof String) ||
            prop.value.toString() === '') && typeof prop.value !== 'string'
        ) ? ''
          : prop.value;
      case 'integer':
      case 'int':
        return isNaN(parseInt(prop.value, 10)) ? 0 : parseInt(prop.value, 10);
      case 'float':
        return isNaN(parseFloat(prop.value)) ? 0 : parseFloat(prop.value);
      case 'date':
      case 'time':
      case 'timestamp':
        // make it a timestamp aka. miliseconds from 1970
        if (isNaN(prop.value) && typeof prop.value === 'string') {
          let timezoneOffset: number;
          // see if there is a timezone specified in the string
          if (prop.value.match(/Z$/)) {
            // UTC timezone in an ISO string (hopefully)
            timezoneOffset = 0;
          } else {
            const matches = prop.value.match(/(\+|\-)([\d]{1,2})\:([\d]{2})$/);
            if (matches) {
              // +/- hours:minutes specified.
              // calculating offsets in minutes and removing the offset from the string since new Date()
              // can't handle those.
              const hours = parseInt(matches[2], 10);
              const minutes = parseInt(matches[3], 10);
              timezoneOffset = hours * 60 + minutes;
              if (matches[1] === '-') {
                timezoneOffset *= -1;
              }
              // make sure it is set in UTC here
              prop.value = prop.value.substring(0, prop.value.length - matches[0].length) + 'Z';
            } else {
              timezoneOffset = new Date(prop.value).getTimezoneOffset();
            }
          }
          return new Date(prop.value).getTime() - timezoneOffset * 60 * 1000;
        }
        return parseInt(prop.value, 10);
      case 'json':
        if (typeof (prop.value) === 'object') {
          return JSON.stringify(prop.value);
        } else {
          try {
            // already is json, do nothing
            JSON.parse(prop.value);
            return prop.value;
          } catch (e) {
            return JSON.stringify(prop.value);
          }
        }
      default:
        return prop.value;
    }
  }

  public propertyDiff(): Array<IPropertyDiff<keyof TProps>>;
  public propertyDiff(key: keyof TProps): void | IPropertyDiff;
  public propertyDiff(key?: keyof TProps): void | IPropertyDiff | Array<IPropertyDiff> {
    // TODO: determine if returning an array is really the best option
    if (key) {
      return this.onePropertyDiff(key);
    } else {
      const diffResult: Array<IPropertyDiff<keyof TProps>> = [];
      for (const [iterationKey] of this.properties) {
        const diff = this.onePropertyDiff(iterationKey);
        if (diff) {
          diffResult.push(diff);
        }
      }
      return diffResult;
    }
  }

  private onePropertyDiff(key: keyof TProps): IPropertyDiff | void {
    const prop = this.getProperty(key);
    if (prop.__updated) {
      return {
        after: prop.value,
        before: prop.__oldValue,
        key,
      };
    }
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
        isValid = await this.validate(undefined, true);
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

        this.inDb = true;
        for (const [key] of this.properties) {
          this.__resetProp(key);
        }

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

  public valid(property?: keyof TProps, setDirectly = false) {
    // TODO: decide whether actually deprecating this is worth it.
    console.warn('DEPRECATED: Usage of NohmModel.valid() is deprecated, use NohmModel.validate() instead.');
    return this.validate(property, setDirectly);
  }

  public async validate(property?: keyof TProps, setDirectly = false): Promise<boolean> {
    const nonUniqueValidations: Array<Promise<IValidationResult>> = [];
    for (const [key, prop] of this.properties) {
      if (!property || property === key) {
        nonUniqueValidations.push(this.validateProperty(key, prop));
      }
    }
    const validationResults = await Promise.all<IValidationResult>(nonUniqueValidations);

    let valid = validationResults.some((result) => !result.valid);

    if (!valid) {
      // if nonUniuqeValidations failed, we don't want to set uniques while checking them
      setDirectly = false;
    }

    const uniqueValidations: Array<Promise<IValidationResult>> = [];
    for (const [key, prop] of this.properties) {
      if (!property || property === key) {
        uniqueValidations.push(this.checkUniques(setDirectly, key, prop));
      }
    }
    validationResults.concat(await Promise.all<IValidationResult>(uniqueValidations));

    validationResults.forEach((result) => {
      this.errors[result.key] = [];
      if (!result.valid) {
        valid = false;
        if (!result.error) {
          throw new Error(`Validation failed but didn't provide an error message. Property name: ${result.key}.`);
        }
        this.errors[result.key].push(result.error);
      }
    });


    return valid;
  }

  private async validateProperty(key: string, property: IProperty): Promise<IValidationResult> {
    const result: IValidationResult = {
      key,
      valid: true,
    };
    const validations = this.definitions[key].validations;
    if (validations) {
      const validatorOptions = {
        old: property.__oldValue,
        optional: false,
        trim: true,
      };
      const validationPromises: Array<Promise<boolean>> = validations.map((validator) => {
        if (typeof (validator) === 'function') {
          return validator(property.value, validatorOptions);
        } else {
          let validationFunction: validatiorFunction;
          let localValidatorOptions = validatorOptions;
          if (typeof (validator) === 'string') {
            validationFunction = validators[validator];
          } else if (validator && validator.name) {
            validationFunction = validators[validator.name];
            localValidatorOptions = {
              ...validatorOptions,
              ...validator.options,
            };
          } else {
            throw new Error(
              `Bad validation definition for model '${this.modelName}' in property '${key}': ${validator}`
            );
          }
          return validationFunction(property.value, localValidatorOptions);
        }
      });
    }
    return result;
  }

  private async checkUniques(
    setDirectly: boolean,
    key: string,
    property: IProperty,
  ): Promise<IValidationResult> {
    if (property.value === 'foo') {
      return {
        error: 'not foo... LUL',
        key,
        valid: false,
      };
    }
    return {
      key,
      valid: true,
    };
  }
}

export default NohmModel;
