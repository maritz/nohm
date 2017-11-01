import * as async from 'async';
import { createHash } from 'crypto';
import * as _ from 'lodash';
import * as redis from 'redis';
import * as traverse from 'traverse';
import { v1 as uuid } from 'uuid';

import { idGenerators } from './idGenerators';
import { INohmPrefixes, NohmClass } from './index';
import {
  IModelOptions,
  IModelPropertyDefinition,
  IModelPropertyDefinitions,
  INohmModel,
  IProperty,
  IPropertyDiff,
  ISaveOptions,
  IValidationObject,
  IValidationResult,
  TValidationDefinition,
} from './model.d';
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

  protected properties: Map<keyof TProps, IProperty>;
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
  private tmpUniqueKeys: Array<string>;

  constructor() {
    this._initOptions();
    if (!this.client) {
      throw new Error('No redis client defined before initializing models.');
    }

    if (!this.meta.inDb) {
      this.updateMeta(this.options.metaCallback);
    }

    this.properties = new Map();
    this.allPropertiesCache = {
      id: null,
    } as any;
    this.errors = {} as any;

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
        value: undefined,
      });
      if (typeof (definition.type) !== 'function') {
        // behaviours should not be called on initialization - thus leaving it at defaultValue
        this.property(key, defaultValue); // this ensures typecasing
      }
      this.__resetProp(key);
      this.errors[key] = [];
    });

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
    this.tmpUniqueKeys = [];

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

    // '' + to make sure that when no definition is set, it doesn't cause an exception here.
    hash.update('' + JSON.stringify(this.definitions));
    hash.update('' + JSON.stringify(this.modelName));
    hash.update(idGenerator.toString());

    return hash.digest('hex');
  }


  /**
   * Alias for .property().
   * This method is deprecated, use .property() instead.
   *
   * @deprecated
   */
  public p(keyOrValues: any, value?: any): any {
    console.log('DEPRECATED: Usage of NohmModel.p() is deprecated, use NohmModel.property() instead.');
    return this.property(keyOrValues, value);
  }

  /**
   * Alias for .property().
   * This method is deprecated, use .property() instead.
   *
   * @deprecated
   */
  public prop(keyOrValues: any, value?: any): any {
    console.log('DEPRECATED: Usage of NohmModel.prop() is deprecated, use NohmModel.property() instead.');
    return this.property(keyOrValues, value);
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
    if (typeof value !== 'undefined') {
      this.setProperty(keyOrValues, value);
      this.allPropertiesCache[keyOrValues] = this.property(keyOrValues);
    }
    const prop = this.getProperty(keyOrValues);
    let returnValue = prop.value;
    if (this.definitions[keyOrValues].type === 'json') {
      returnValue = JSON.parse(returnValue);
    }
    return returnValue;
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
      prop.value = this.castProperty(key, prop, value);
      prop.__updated = prop.value !== prop.__oldValue;
      this.properties.set(key, prop);
    }
  }

  private castProperty(key: keyof TProps, prop: IProperty, newValue: any): any {
    const type = this.definitions[key].type;

    if (typeof (type) === 'undefined') {
      return newValue;
    }

    if (typeof (type) === 'function') {
      return type.call(this, newValue, key, prop.__oldValue);
    }

    switch (type.toLowerCase()) {
      case 'boolean':
      case 'bool':
        return newValue === 'false' ? false : !!newValue;
      case 'string':
        // no .toString() here. TODO: or should there be?
        return (
          (!(newValue instanceof String) ||
            newValue.toString() === '') && typeof newValue !== 'string'
        ) ? ''
          : newValue;
      case 'integer':
      case 'int':
        return isNaN(parseInt(newValue, 10)) ? 0 : parseInt(newValue, 10);
      case 'float':
        return isNaN(parseFloat(newValue)) ? 0 : parseFloat(newValue);
      case 'date':
      case 'time':
      case 'timestamp':
        // make it a timestamp aka. miliseconds from 1970
        if (isNaN(newValue) && typeof newValue === 'string') {
          let timezoneOffset: number;
          // see if there is a timezone specified in the string
          if (newValue.match(/Z$/)) {
            // UTC timezone in an ISO string (hopefully)
            timezoneOffset = 0;
          } else {
            const matches = newValue.match(/(\+|\-)([\d]{1,2})\:([\d]{2})$/);
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
              newValue = newValue.substring(0, newValue.length - matches[0].length) + 'Z';
            } else {
              timezoneOffset = new Date(newValue).getTimezoneOffset();
            }
          }
          return new Date(newValue).getTime() - timezoneOffset * 60 * 1000;
        }
        return parseInt(newValue, 10);
      case 'json':
        if (typeof (newValue) === 'object') {
          return JSON.stringify(newValue);
        } else {
          try {
            // already is json, do nothing
            JSON.parse(newValue);
            return newValue;
          } catch (e) {
            return JSON.stringify(newValue);
          }
        }
      default:
        return newValue;
    }
  }

  /**
   * Returns an array of all the properties that have been changed since init/load/save.
   *
   * @example
   *   user.properrtyDiff('country') ===
   *    [{
   *      key: 'country',
   *      before: 'GB',
   *      after: 'AB'
   *    }]
   */
  public propertyDiff(key?: keyof TProps): Array<void | IPropertyDiff<keyof TProps>> {
    // TODO: determine if returning an array is really the best option
    if (key) {
      return [this.onePropertyDiff(key)];
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
   * Resets a property to its state as it was at last init/load/save.
   *
   * @param {keyof TProps} [key] If given only this key is reset
   */
  public propertyReset(key?: keyof TProps): void {
    if (key && !this.properties.has(key)) {
      throw new Error('Invalid key specified for propertyReset');
    }

    this.properties.forEach((prop: IProperty, innerKey: keyof TProps) => {
      if (!key || innerKey === key) {
        prop.__updated = false;
        prop.value = prop.__oldValue;
        this.properties.set(innerKey, prop);
        // this.allPropertiesCache[innerKey] = prop.__oldValue; // TODO: enable & write test for this
      }
    });
  }

  /**
   *  Get all properties with values either as an array or as json (param true).
   */
  public allProperties(): TProps & { id: any } {
    return this.allPropertiesCache;
  }

  /**
   * Save an instance to the database. Updating or Creating as needed depending on if the instance already has an id.
   *
   * @param {ISaveOptions} [options={
   *     continue_on_link_error: false,
   *     silent: false,
   *     skip_validation_and_unique_indexes: false,
   *   }]
   * @returns {Promise<void>}
   */
  public save(options: ISaveOptions = {
    continue_on_link_error: false,
    silent: false,
    skip_validation_and_unique_indexes: false,
  }): Promise<void> {
    return new Promise(async (resolve, reject) => {
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
        try {
          isValid = await this.validate(undefined, true);
        } catch (e) {
          return reject(e);
        }
        if (!isValid) {
          if (action === 'create') {
            // remove temp id
            this.id = null;
          }
          return reject('invalid');
        }
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
    const id = await this.generateId();
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

  private storeId(id: string): Promise<void> {
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
  private setUniqueIds(id: string): Promise<void> {
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

  private update(_options: ISaveOptions): Promise<void> {
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
    console.log('DEPRECATED: Usage of NohmModel.valid() is deprecated, use NohmModel.validate() instead.');
    return this.validate(property, setDirectly);
  }

  /**
   * Check if one or all properties are valid and optionally set the unique indices immediately.
   * If a property is invalid the errors object will be populated with error messages.
   *
   * @param {keyof TProps} [property] Property name if you only want to check one property for validity or
   * null for all properties
   * @param {boolean} [setDirectly=false] Set to true to immediately set the unique indices while checking.
   * This prevents race conditions but should probably only be used internally
   * @returns {Promise<boolean>} Promise resolves to true if checked properties are valid.
   */
  public async validate(property?: keyof TProps, setDirectly = false): Promise<boolean> {
    const nonUniqueValidations: Array<Promise<IValidationResult>> = [];
    for (const [key, prop] of this.properties) {
      if (!property || property === key) {
        nonUniqueValidations.push(this.validateProperty(key, prop));
      }
    }
    let validationResults: Array<IValidationResult> = await Promise.all<IValidationResult>(nonUniqueValidations);

    let valid = validationResults.some((result) => result.valid);

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
    const uniqueValidationResults = await Promise.all<IValidationResult>(uniqueValidations);
    validationResults = validationResults.concat(uniqueValidationResults);

    validationResults.forEach((result) => {
      if (!this.errors[result.key]) {
        this.errors[result.key] = [];
      }
      if (!result.valid) {
        valid = false;
        if (!result.error) {
          throw new Error(`Validation failed but didn't provide an error message. Property name: ${result.key}.`);
        }
        this.errors[result.key].push(result.error);
      }
    });

    if (setDirectly && valid === false) {
      await this.clearTemporaryUniques();
    }

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
      const validationObjects = validations.map((validator) => this.getValidationObject(validator));
      const validationPromises: Array<Promise<void>> = validationObjects.map(async (validationObject) => {
        if (validationObject.options.optional && !property.value) {
          return;
        }
        const valid = await validationObject.validator.call(
          this,
          property.value,
          {
            ...validatorOptions,
            ...validationObject.options,
          },
        );
        if (!valid) {
          result.valid = false;
          result.error = validationObject.name;
          this.errors[key].push(validationObject.name);
        }
      });
      await Promise.all(validationPromises);
    }
    return result;
  }

  private getValidationObject(validator: TValidationDefinition): IValidationObject {
    if (typeof (validator) === 'function') {
      const funcName = validator.toString().match(/^function ([\w]*)[\s]?\(/);
      return {
        name: `custom_${(funcName && funcName[1] ? funcName[1] : 'unknown')}`,
        options: {},
        validator,
      };
    } else {
      if (typeof (validator) === 'string') {
        // predefined validator method
        return {
          name: validator,
          options: {},
          validator: validators[validator],
        };
      } else if (validator && validator.name) {
        // predefined validator method with options
        return {
          name: validator.name,
          options: validator.options,
          validator: validators[validator.name],
        };
      } else {
        throw new Error(
          `Bad validation definition for model '${this.modelName}' for validator '${validator}'.`,
        );
      }
    }
  }

  private isUpdatedUnique(key: keyof TProps, property: IProperty): boolean {
    const definition = this.definitions[key];
    if (!definition || !definition.unique) {
      return false;
    }
    if (property.value === '') {
      return false; // empty string is not valid unique value
    }
    if (!property.__updated && this.inDb) {
      // neither updated nor new
      return false;
    }
    return true;
  }

  private isUniquqKeyFree(key: string, setDirectly: boolean): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const checkCallback = (err: Error | null, dbValue: number) => {
        if (err) {
          return reject(err);
        } else {
          let isFreeUnique = false;
          if (setDirectly && dbValue === 1) {
            // setDirectly === true means using setnx which returns 1 if the value did *not* exist
            isFreeUnique = true;
            this.tmpUniqueKeys.push(key);
          } else if (!setDirectly && dbValue === 0) {
            // setDirectly === false means using exists which returns 0 if the value did *not* exist
            isFreeUnique = true;
          }
          return resolve(isFreeUnique);
        }
      };
      if (setDirectly) {
        /*
        * We lock the unique value here if it's not locked yet, then later remove the old uniquelock
        * when really saving it. (or we free the unique slot if we're not saving)
        */
        this.client.setnx(key, this.id, checkCallback);
      } else {
        this.client.exists(key, checkCallback);
      }
    });
  }

  private getUniqueKey(key: keyof TProps, property: IProperty): string {
    let uniqueValue = property.value;
    if (this.definitions[key].type === 'string') {
      uniqueValue = String.prototype.toLowerCase.call(property.value);
    }
    return `${this.prefix('unique')}:${key}:${uniqueValue}`;
  }

  private async checkUniques(
    setDirectly: boolean,
    key: keyof TProps,
    property: IProperty,
  ): Promise<IValidationResult> {
    const successReturn = {
      key,
      valid: true,
    };
    const isUpdatedUnique = this.isUpdatedUnique(key, property);
    if (!isUpdatedUnique) {
      return successReturn;
    }
    const uniqueKey = this.getUniqueKey(key, property);
    const isFree = await this.isUniquqKeyFree(uniqueKey, setDirectly);
    if (!isFree) {
      return {
        error: 'notUnique',
        key,
        valid: false,
      };
    }
    return successReturn;
  }

  /**
   * Used after a failed validation with setDirectly=true to remove the temporary unique keys
   *
   * @param {keyof TProps} key
   * @param {IProperty} property
   * @returns {Promise<void>}
   */
  private async clearTemporaryUniques(): Promise<void> {
    if (this.tmpUniqueKeys.length > 0) {
      const deletes: Array<Promise<void>> = this.tmpUniqueKeys.map((key) => {
        return new Promise<void>((resolve, reject) => {
          this.client.del(key, (err: Error | null) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      });
      await Promise.all(deletes);
    }
  }

  /**
   *  Remove an objet from the database.
   *  Note: Does not destroy the js object or its properties itself!
   *
   * @param {boolean} [silent=false] Fire PubSub events or not
   * @returns {Promise<void>}
   */
  public async remove(silent = false): Promise<void> {
    if (!this.id) {
      throw new Error('The instance you are trying to delete has no id.');
    }
    /*if (!this.inDb) {
      // TODO check if this is needed
      await this.load(this.id);
    }*/
    return this.deleteDbCall(silent);
  }

  private deleteDbCall(silent: boolean): Promise<void> {
    return new Promise((resolve, reject) => {

      const multi = this.client.multi();

      multi.del(`${this.prefix('hash')}:${this.id}`);
      multi.srem(this.prefix('idsets'), this.id);

      this.properties.forEach((prop, key) => {
        if (this.definitions[key].unique) {
          let value = prop.__oldValue;
          if (this.definitions[key].type === 'string') {
            value = String(value).toLowerCase();
          }
          multi.del(`${this.prefix('unique')}:${key}:${value}`);
        }
        if (this.definitions[key].index === true) {
          multi.srem(`${this.prefix('index')}:${key}:${prop.__oldValue}`, this.id);
        }
        if (prop.__numericIndex === true) {
          multi.zrem(`${this.prefix('scoredindex')}:${key}`, this.id);
        }
      });

      // await this.unlinkAll(multi); // TODO: enable once implmemented
      multi.exec((err) => {
        this.id = 0;

        if (!silent && !err) {
          // this.fireEvent('remove', id); // TODO: enable once implemented
        }
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

export default NohmModel;
