import * as async from 'async';
import { createHash } from 'crypto';
import * as _ from 'lodash';
import * as redis from 'redis';
import * as traverse from 'traverse';
import { v1 as uuid } from 'uuid';

import { LinkError } from './errors/LinkError';
import { ValidationError } from './errors/ValidationError';
import { checkEqual, callbackError } from './helpers';
import { idGenerators } from './idGenerators';
import { INohmPrefixes, NohmClass } from './index';
import {
  IDictionary,
  ILinkOptions,
  ILinkSaveResult,
  IModelOptions,
  IModelPropertyDefinition,
  IModelPropertyDefinitions,
  IProperty,
  IPropertyDiff,
  IRelationChange,
  ISaveOptions,
  ISearchOptions,
  IUnlinkKeyMapItem,
  IValidationObject,
  IValidationResult,
  TValidationDefinition,
  IStructuredSearch,
  ISearchOption,
  ISortOptions,
} from './model.d';
import { validators } from './validators';

export {
  IDictionary,
  ILinkOptions,
  IModelPropertyDefinition,
  IModelPropertyDefinitions,
  IModelOptions,
  ISearchOptions,
  ISortOptions,
};
export { NohmModel };


/**
 * The property types that get indexed in a sorted set.
 * This should not be changed since it can invalidate already existing data.
 */
const indexNumberTypes = ['integer', 'float', 'timestamp'];


abstract class NohmModel<TProps extends IDictionary> {

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
  private inDb: boolean;
  private tmpUniqueKeys: Array<string>;

  private relationChanges: Array<IRelationChange>;

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
      if (typeof (definition.type) === 'function') {
        // behaviours should not be called on initialization - thus leaving it at defaultValue
        this.setProperty(key, defaultValue);
      } else {
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
          // tslint:disable-next-line:max-line-length
          console.warn(`DEPRECATED: Overwriting built-in methhods is deprecated. Please migrate them to a different name.`);
          (this as any)['_super_' + name] = (this as any)[name].bind(this);
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

    setTimeout(() => {
      // setTimeout to defer execution to the next process/browser tick
      // this means we will have modelName set and meta doesnt take precedence over other operations

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
    }, 1);
  }


  /**
   * DO NOT OVERWRITE THIS; USED INTERNALLY
   *
   * @protected
   */
  protected abstract _initOptions(): any;

  /**
   * Returns the a redis key prefix string (including the modelName but without trailing ':'!)
   * DO NOT OVERWRITE THIS; USED INTERNALLY
   *
   * @protected
   */
  protected abstract prefix(prefix: keyof INohmPrefixes): string;

  /**
   * Returns an object with the redis key prefix strings (including the trailing ':')
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
   * Checks if key is a string, nothing else. Used as a typeguard
   *
   * @private
   * @param {*} key
   * @returns {key is keyof TProps}
   */
  private isPropertyKey(key: any): key is keyof TProps {
    return typeof (key) === 'string';
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
  public property(valuesObject: Partial<{[key in keyof TProps]: any}>): any;
  public property(keyOrValues: keyof TProps | Partial<{[key in keyof TProps]: any}>, value?: any): any {
    if (!this.isPropertyKey(keyOrValues)) {
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

  private setProperty(key: keyof TProps, value: any): void {
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
    // tslint:disable-next-line:prefer-object-spread // ts complains when using spread method here
    return Object.assign({}, this.allPropertiesCache);
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
  public async save(
    options: ISaveOptions,
  ): Promise<void> {
    // TODO: right now continue_on_link_error is always "true" since it's the current
    // behavior without options and the option isn't passed.
    // Need to check if the option should work again.
    callbackError(...arguments);
    options = {
      continue_on_link_error: false,
      silent: false,
      skip_validation_and_unique_indexes: false,
      ...options,
    };
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
      if (!isValid) {
        if (action === 'create') {
          // remove temp id
          this.id = null;
        }
        throw new ValidationError(this.errors);
      }
    }
    const idExists = await this.checkIdExists(this.id);
    if (action === 'create' && !idExists) {
      await this.create();
    }
    await this.update(options);
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
    this.setId(id);
  }

  private setId(id: any) {
    this.id = id;
    this.allPropertiesCache.id = id;
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

  private update(options: ISaveOptions): Promise<Array<ILinkSaveResult> | LinkError> {
    return new Promise((resolve, reject) => {
      if (!this.id) {
        return reject(new Error('Update was called without having an id set.'));
      }
      const hmSetArguments = [];
      const client = this.client.MULTI();
      const isCreate = !this.inDb;

      hmSetArguments.push(`${this.prefix('hash')}:${this.id}`);

      for (const [key, prop] of this.properties) {
        if (isCreate || prop.__updated) {
          hmSetArguments.push(key, prop.value);
        }
      }

      if (hmSetArguments.length > 1) {
        hmSetArguments.push('__meta_version', this.meta.version);
        client.HMSET.apply(client, hmSetArguments);
      }

      this.setIndices(client);

      client.exec(async (err) => {
        if (err) {
          return reject(err);
        }

        const linkResults = await this.storeLinks(options);

        const linkFailures = linkResults.filter((linkResult) => !linkResult.success);

        if (linkFailures.length > 0) {
          const linkError = new LinkError(
            linkFailures,
          );
          return reject(linkError);
        }

        this.inDb = true;
        for (const [key] of this.properties) {
          this.__resetProp(key);
        }

        // TODO: pubsub stuff goes here

        resolve(linkResults);

      });
    });
  }

  private async storeLinks(options: ISaveOptions): Promise<Array<ILinkSaveResult>> {
    const changeFns = this.relationChanges.map((change) => {
      return async () => {
        // TODO: decide whether silent should actually be overwritten for all cases
        change.options.silent = options.silent;
        let returnArray: Array<ILinkSaveResult> = [];
        const saveResult: ILinkSaveResult = {
          child: change.object,
          error: null,
          parent: this,
          success: true,
        };
        try {
          if (!change.object.id) {
            await change.object.save(options);
          }
          await this.saveLinkRedis(change);
          try {
            if (typeof (change.callback) === 'function') {
              change.callback.call(this,
                change.action,
                this.modelName,
                change.options.name,
                change.object,
              );
            }
          } catch (e) {
            // ignore errors thrown by link callback
          }
        } catch (err) {
          const isSubLinkError = err instanceof LinkError;
          if (!isSubLinkError && typeof (change.options.error) === 'function') {
            try {
              change.options.error(err, change.object);
            } catch (e) {
              // ignore errors thrown by link callback
            }
          }
          if (isSubLinkError) {
            returnArray = returnArray.concat(err.errors);
          } else {
            saveResult.success = false;
            saveResult.error = err;
          }
        }
        returnArray.push(saveResult);
        return returnArray;
      };
    });
    let saveResults: Array<ILinkSaveResult> = [];
    // Sequentially go through all the changes and store them instead of parallel.
    // The reason for this behaviour is that it makes saving other objects when they don't have an id yet
    // easier and cannot cause race-conditions as easily.
    for (const [_key, fn] of changeFns.entries()) {
      // TODO: implement continue_on_link_error
      saveResults = saveResults.concat(await fn());
    }
    return saveResults;
  }

  private getRelationKey(otherName: string, relationName: string) {
    return `${this.prefix('relations')}:${relationName}:${otherName}:${this.id}`;
  }

  private saveLinkRedis(change: IRelationChange): Promise<void> {
    return new Promise((resolve, reject) => {

      const foreignName = `${change.options.name}Foreign`;
      const command = change.action === 'link' ? 'sadd' : 'srem';
      const relationKeyPrefix = this.rawPrefix().relationKeys;


      const multi = this.client.MULTI();
      // relation to other
      const toKey = this.getRelationKey(change.object.modelName, change.options.name);
      // first store the information to which other model names the instance has a relation to
      multi[command](
        `${relationKeyPrefix}${this.modelName}:${this.id}`,
        toKey,
      );
      // second store the information which specific other model id that relation is referring to
      multi[command](toKey, change.object.id);

      // relation from other - same thing in reverse
      const fromKey = change.object.getRelationKey(this.modelName, foreignName);
      multi[command](
        `${relationKeyPrefix}${change.object.modelName}:${change.object.id}`,
        fromKey,
      );
      multi[command](fromKey, this.id);

      multi.exec((err) => {
        if (err) {
          if (change.options.error) {
            change.options.error(err, change.object);
          }
          return reject(err);
        } else {
          if (!change.options.silent) {
            // TODO: enable this once fireEvent is implemented
            // this.fireEvent( change.action, change.object, change.options.name);
          }
          return resolve();
        }
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

  public valid(property?: keyof TProps, setDirectly = false): Promise<boolean> {
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
    callbackError(...arguments);
    const nonUniqueValidations: Array<Promise<IValidationResult>> = [];
    for (const [key, prop] of this.properties) {
      if (!property || property === key) {
        this.errors[key] = [];
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
      const validationObjects = validations.map((validator) => this.getValidationObject(validator, key));
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
        }
      });
      await Promise.all(validationPromises);
    }
    return result;
  }

  private getValidationObject(validator: TValidationDefinition, key: keyof TProps): IValidationObject {
    if (typeof (validator) === 'function') {
      const funcName = validator.toString().match(/^function ([\w]*)[\s]?\(/);
      return {
        name: `custom_${(funcName && funcName[1] ? funcName[1] : key)}`,
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

  private isUniqueKeyFree(key: string, setDirectly: boolean): Promise<boolean> {
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
    const isFree = await this.isUniqueKeyFree(uniqueKey, setDirectly);
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
    callbackError(...arguments);
    if (!this.id) {
      throw new Error('The instance you are trying to delete has no id.');
    }
    if (!this.inDb) {
      // TODO check if this is needed
      await this.load(this.id);
    }
    return this.deleteDbCall(silent);
  }

  private deleteDbCall(silent: boolean): Promise<void> {
    return new Promise(async (resolve, reject) => {
      // TODO: write test for removal of relationKeys - purgeDb kinda tests it already, but not enough

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

      try {
        await this.unlinkAll(multi);
      } catch (e) {
        return reject(e);
      }
      multi.exec((err) => {
        this.setId(null);

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

  /**
   * Returns a Promsie that resolves to true if the given id exists for this model.
   *
   * @param {*} id
   * @returns {Promise<boolean>}
   */
  public exists(id: any): Promise<boolean> {
    callbackError(...arguments);
    return new Promise((resolve, reject) => {
      this.client.SISMEMBER(this.prefix('idsets'), id, (err, found) => {
        if (err) {
          reject(err);
        } else {
          resolve(found === 1);
        }
      });
    });
  }

  private getHashAll(id: any): Promise<Partial<TProps>> {
    return new Promise((resolve, reject) => {
      const props: Partial<TProps> = {};
      this.client.HGETALL(`${this.prefix('hash')}:${id}`, (err, values) => {
        if (err) {
          return reject(err);
        }
        if (values === null) {
          return reject(new Error('not found'));
        }
        Object.keys(values).forEach((key) => {
          if (key === '__meta_version') {
            return;
          }
          if (!this.definitions[key]) {
            // tslint:disable-next-line:max-line-length
            NohmClass.logError(`A hash in the DB contained a key '${key}' that is not in the model definition. This might be because of model changes or database corruption/intrusion.`);
            return;
          }
          props[key] = values[key];
        });
        return resolve(props);
      });
    });
  }

  public async load(id: any): Promise<TProps & { id: any }> {
    callbackError(...arguments);
    if (!id) {
      throw new Error('No id passed to .load().');
    }
    const dbProps = await this.getHashAll(id);
    this.property(dbProps);
    Object.keys(dbProps).forEach((key) => {
      this.__resetProp(key);
    });
    this.setId(id);
    this.inDb = true;
    return this.allProperties();
  }


  /**
   * Links one object to another.
   * Does not save the link directly but marks it for the next .save() call.
   * When linking an instance that has not been saved that instance will then be saved during the .save() call
   * on this instance.
   *
   * Note: link names should not end with 'Foreign' as that is an internally used identifier.
   *
   * @example
   *  const user = new UserModel();
   *  const comment = new CommentModel();
   *  await user.load(123);
   *  user.linK(comment, 'author');
   *  await user.save(); // this will save the link to the database and also call .save() on comment
   *
   * @example
   *  // options object typing:
   *  {
   *    continue_on_link_error?: boolean; // default false
   *    error?: (err: Error | string, otherName: string, otherObject: NohmModel<IDictionary>) => any;
   *    name: string;
   *    silent?: boolean;
   *  }
   *
   * @param {NohmModel<IDictionary>} other The other instance that is being linked
   * @param {(string | ILinkOptions | (() => any))} optionsOrNameOrCallback Either a string for the
   *  relation name (default: 'default') or an options object (see example above) or the callback
   * @param {() => any} [callback] Function that is called when the link is saved.
   */
  public link(other: NohmModel<IDictionary>, callback: () => any): void;
  public link(
    other: NohmModel<IDictionary>,
    optionsOrNameOrCallback: string | ILinkOptions,
    callback?: () => any,
  ): void;
  public link(
    other: NohmModel<IDictionary>,
    optionsOrNameOrCallback: string | ILinkOptions | (() => any),
    callback?: () => any,
  ): void {
    if (typeof (optionsOrNameOrCallback) === 'function') {
      callback = optionsOrNameOrCallback;
      optionsOrNameOrCallback = 'default';
    }
    const options: ILinkOptions = this.getLinkOptions(optionsOrNameOrCallback);
    this.relationChanges.push({
      action: 'link',
      callback,
      object: other,
      options,
    });
  }

  /**
   * Unlinks one object to another.
   * Does not remove the link directly but marks it for the next .save() call.
   *
   * @example
   *  // options object typing:
   *  {
   *    continue_on_link_error?: boolean; // default false
   *    error?: (err: Error | string, otherName: string, otherObject: NohmModel<IDictionary>) => any;
   *    name: string;
   *    silent?: boolean;
   *  }
   *
   * @param {NohmModel<IDictionary>} other The other instance that is being unlinked (needs to have an id)
   * @param {(string | ILinkOptions | (() => any))} optionsOrNameOrCallback Either a string for the
   *  relation name (default: 'default') or an options object (see example above) or the callback
   * @param {() => any} [callback]
   */
  public unlink(other: NohmModel<IDictionary>, callback: () => any): void;
  public unlink(
    other: NohmModel<IDictionary>,
    optionsOrNameOrCallback: string | ILinkOptions,
    callback?: () => any,
  ): void;
  public unlink(
    other: NohmModel<IDictionary>,
    optionsOrNameOrCallback: string | ILinkOptions | (() => any),
    callback?: () => any,
  ): void {
    if (typeof (optionsOrNameOrCallback) === 'function') {
      callback = optionsOrNameOrCallback;
      optionsOrNameOrCallback = 'default';
    }
    const options: ILinkOptions = this.getLinkOptions(optionsOrNameOrCallback);
    this.relationChanges.forEach((change, key) => {
      const sameRelationChange = change.options.name === options.name && checkEqual(change.object, other);
      if (sameRelationChange) {
        delete this.relationChanges[key];
      }
    });
    this.relationChanges.push({
      action: 'unlink',
      callback,
      object: other,
      options,
    });
  }

  private getLinkOptions(optionsOrName: string | ILinkOptions): ILinkOptions {
    if (typeof (optionsOrName) === 'string') {
      return {
        name: optionsOrName,
      };
    } else {
      return {
        name: 'default',
        ...optionsOrName,
      };
    }
  }

  private isMultiClient(client: any): client is redis.Multi {
    return client && typeof (client.exec) === 'function';
  }

  public async unlinkAll(givenClient?: redis.RedisClient | redis.Multi): Promise<void> {
    callbackError(...arguments);
    let multi: redis.Multi;
    if (this.isMultiClient(givenClient)) {
      multi = givenClient;
    } else if (givenClient) {
      multi = givenClient.MULTI();
    } else {
      multi = this.client.MULTI();
    }

    // remove outstanding relation changes
    this.relationChanges = [];

    const keys = await this.getAllRelationKeys();

    const others: Array<IUnlinkKeyMapItem> = keys.map((key) => {
      const matches = key.match(/:([\w]*):([\w]*):[\w]+$/i);
      if (!matches) {
        throw new Error('Malformed relation key found in the database! ' + key);
      }
      // selfName is the name of the relation as it is on this instance
      const selfRelationName = matches[1];
      const otherModelName = matches[2];
      const namedMatches = matches[1].match(/^([\w]*)Foreign$/);
      const otherRelationName = namedMatches ? namedMatches[1] : matches[1] + 'Foreign';
      return {
        otherIdsKey: `${this.rawPrefix().relations}${otherModelName}:${otherRelationName}:${this.modelName}:`,
        ownIdsKey: `${this.prefix('relations')}:${selfRelationName}:${otherModelName}:${this.id}`,
      };
    });
    const otherRelationIdsPromises = others.map((item) => this.removeIdFromOtherRelations(multi, item));


    await Promise.all(otherRelationIdsPromises);

    // add multi'ed delete commands for other keys
    others.forEach((item) => multi.DEL(item.ownIdsKey));
    multi.del(`${this.rawPrefix().relationKeys}${this.modelName}:${this.id}`);

    // if we didn't get a multi client from the callee we have to exec() ourselves
    if (!this.isMultiClient(givenClient)) {
      return new Promise<void>((resolve, reject) => {
        multi.exec((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  }

  private getAllRelationKeys(): Promise<Array<string>> {
    return new Promise((resolve, reject) => {
      const relationKeysKey = `${this.rawPrefix().relationKeys}${this.modelName}:${this.id}`;
      this.client.SMEMBERS(relationKeysKey, (err, keys) => {
        if (err) {
          return reject(err);
        } else {
          resolve(keys);
        }
      });
    });
  }

  /*
  This method is doubly asynchronous:
  First it returns a promise that gets resolved when the ids have been fetched that need to be used as keys for
  removing this.id from relations to others.
  Secondly it adds an SREM to the multi redis client.
  */
  private removeIdFromOtherRelations(multi: redis.Multi, item: IUnlinkKeyMapItem): Promise<void> {
    return new Promise((resolve, reject) => {
      // we usenormalClient for fetching data and client (which could be a provided client in multi mode)
      // for manipulating data
      this.client.SMEMBERS(item.ownIdsKey, async (err, ids) => {
        if (err) {
          return reject(err);
        }
        ids.forEach((id) => {
          multi.SREM(`${item.otherIdsKey}${id}`, this.id);
        });
        resolve();
      });
    });
  }

  /**
   * Resolves with true if the given object has a relation (optionally with the given relation name) to this.
   *
   * @param {NohmModel<IDictionary>} obj
   * @param {string} [relationName='default']
   * @returns {Promise<boolean>}
   */
  public belongsTo(obj: NohmModel<IDictionary>, relationName = 'default'): Promise<boolean> {
    callbackError(...arguments);
    return new Promise((resolve, reject) => {
      if (!this.id || !obj.id) {
        return reject(
          new Error('Calling belongsTo() even though either the object itself or the relation does not have an id.'),
        );
      }
      this.client.SISMEMBER(
        this.getRelationKey(obj.modelName, relationName),
        obj.id,
        (err, value) => {
          if (err) {
            reject(err);
          } else {
            resolve(!!value);
          }
        },
      );
    });
  }

  /**
   * Returns an array of the ids of all objects that are linked with the given relation.
   *
   * @param {string} otherModelName
   * @param {string} [relationName='default']
   * @returns {Promise<Array<any>>}
   */
  public getAll(otherModelName: string, relationName = 'default'): Promise<Array<any>> {
    return new Promise((resolve, reject) => {
      if (!this.id) {
        return reject(
          new Error(`Calling getAll() even though this ${this.modelName} has no id. Please load or save it first.`),
        );
      }
      const relationKey = this.getRelationKey(otherModelName, relationName);
      this.client.SMEMBERS(relationKey, (err, ids) => {
        if (err) {
          return reject(err);
        } else if (!Array.isArray(ids)) {
          resolve([]);
        } else {
          resolve(ids);
        }
      });
    });
  }

  /**
   * Returns the number of links of a specified relation (or the default) an instance has to
   * models of a given modelName.
   *
   * @param {string} otherModelName Name of the model on the other end of the relation.
   * @param {string} [relationName='default'] Name of the relation
   * @returns {Promise<number>}
   */
  public numLinks(otherModelName: string, relationName = 'default'): Promise<number> {
    callbackError(...arguments);
    return new Promise((resolve, reject) => {
      if (!this.id) {
        return reject(
          new Error(`Calling numLinks() even though this ${this.modelName} has no id. Please load or save it first.`),
        );
      }
      const relationKey = this.getRelationKey(otherModelName, relationName);
      this.client.SCARD(relationKey, (err, numRelations) => {
        if (err) {
          return reject(err);
        } else {
          resolve(numRelations);
        }
      });
    });
  }



  /**
   * Finds ids of objects by search arguments
   *
   * @param {ISearchOptions} searches
   * @returns {Promise<Array<any>>}
   */
  public async find(searches: ISearchOptions = {}): Promise<Array<string>> {
    // TODO: figure out a way to make ISearchOptions take the TProps generic to use as index

    const structuredSearches = this.createStructuredSearchOptions(searches);

    const uniqueSearch = structuredSearches.find((search) => search.type === 'unique');
    if (uniqueSearch) {
      return this.uniqueSearch(uniqueSearch);
    }

    const onlySets = structuredSearches.filter((search) => search.type === 'set');
    const onlyZSets = structuredSearches.filter((search) => search.type === 'zset');

    if (onlySets.length === 0 && onlyZSets.length === 0) {
      // no valid searches - return all ids
      return this.getAllIds();
    }

    const setPromises = this.setSearch(onlySets);
    const zSetPromises = this.zSetSearch(onlyZSets);
    const searchResults = await Promise.all([setPromises, zSetPromises]);
    if (onlySets.length !== 0 && onlyZSets.length !== 0) {
      // both searches - form intersection of them
      const intersection = _.intersection(searchResults[0], searchResults[1]);
      return intersection;
    } else {
      // only one form of search
      if (onlySets.length !== 0) {
        return searchResults[0];
      } else {
        return searchResults[1];
      }
    }
  }

  private createStructuredSearchOptions(searches: ISearchOptions): Array<IStructuredSearch<TProps>> {
    return Object.keys(searches).map((key) => {
      const search = searches[key];
      const prop = this.getProperty(key);
      const definition = this.definitions[key];
      const structuredSearch: IStructuredSearch<TProps> = {
        key,
        options: {},
        type: 'undefined',
        value: search,
      };
      if (definition.unique) {
        if (definition.type === 'string') {
          if (typeof (search.toLowerCase) !== 'function') {
            // tslint:disable-next-line:max-line-length
            throw new Error('Invalid search parameters: Searching for a unique (type "string") with a non-string value is not supported.');
          }
          structuredSearch.value = search.toLowerCase();
        }
        structuredSearch.type = 'unique';
      } else {
        if (!prop.__numericIndex && !definition.index) {
          throw new Error(`Trying to search for non-indexed and non-unique property '${key}' is not supported.`);
        }
        const isDirectNumericSearch = !isNaN(parseInt(search, 10));
        const isSimpleIndexSearch = !prop.__numericIndex || isDirectNumericSearch;
        if (!isSimpleIndexSearch && prop.__numericIndex) {
          structuredSearch.type = 'zset';
          structuredSearch.options = search;
        } else if (definition.index === true) {
          structuredSearch.type = 'set';
        }
      }
      return structuredSearch;
    });
  }

  private uniqueSearch(options: IStructuredSearch<TProps>): Promise<Array<string>> {
    return new Promise((resolve, reject) => {
      const key = `${this.prefix('unique')}:${options.key}:${options.value}`;
      this.client.GET(key, (err, id) => {
        if (err) {
          reject(err);
        } else {
          if (id) {
            resolve([id]);
          } else {
            resolve([]);
          }
        }
      });
    });
  }

  private getAllIds(): Promise<Array<string>> {
    return new Promise((resolve, reject) => {
      const key = `${this.prefix('idsets')}`;
      this.client.SMEMBERS(key, (err, ids) => {
        if (err) {
          reject(err);
        } else {
          resolve(ids);
        }
      });
    });
  }

  private setSearch(searches: Array<IStructuredSearch<TProps>>): Promise<Array<string>> {
    return new Promise((resolve, reject) => {
      const keys = searches.map((search) => {
        return `${this.prefix('index')}:${search.key}:${search.value}`;
      });
      this.client.SINTER(keys.join(' '), (err, ids) => {
        if (err) {
          reject(err);
        } else {
          resolve(ids);
        }
      });
    });
  }

  private async zSetSearch(searches: Array<IStructuredSearch<TProps>>): Promise<Array<string>> {
    const singleSearches = await Promise.all(searches.map((search) => this.singleZSetSearch(search)));
    return _.intersection(...singleSearches);
  }

  private singleZSetSearch(search: IStructuredSearch<TProps>): Promise<Array<string>> {
    return new Promise((resolve, reject) => {
      const key = `${this.prefix('scoredindex')}:${search.key}`;
      let command: 'ZRANGEBYSCORE' | 'ZREVRANGEBYSCORE' = 'ZRANGEBYSCORE';
      const options: ISearchOption = {
        endpoints: '[]',
        limit: -1,
        max: '+inf',
        min: '-inf',
        offset: 0,
        ...search.options,
      };
      if ((options.min === '+inf' && options.max !== '+inf') ||
        (options.max === '-inf' && options.min !== '-inf') ||
        (parseFloat('' + options.min) > parseFloat('' + options.max))) {
        command = 'ZREVRANGEBYSCORE';
      }

      if (options.endpoints === ')') {
        options.endpoints = '[)';
      }

      const endpoints = [
        (options.endpoints[0] === '(' ? '(' : ''),
        (options.endpoints[1] === ')' ? '(' : ''),
      ];

      const callback = (err: Error | null, ids: Array<string>) => {
        if (err) {
          reject(err);
        } else {
          resolve(ids);
        }
      };
      if (options.limit) {
        this.client[command](key,
          endpoints[0] + options.min,
          endpoints[1] + options.max,
          'LIMIT', options.offset, options.limit,
          callback,
        );
      } else {
        this.client[command](key,
          endpoints[0] + options.min,
          endpoints[1] + options.max,
          callback,
        );
      }
    });
  }

  public async sort(
    options: ISortOptions<TProps> = {},
    ids: Array<string | number> | false = false,
  ): Promise<Array<string>> {
    callbackError(...arguments);
    if (!Array.isArray(ids)) {
      ids = false;
    }
    if (ids && ids.length === 0) {
      return [];
    }

    if (Array.isArray(ids) && options === {}) {
      return ids.map((id) => String(id)).sort();
    }

    if (!options.field || !this.properties.has(options.field)) {
      throw new Error(`Invalid field in ${this.modelName}.sort() options: '${options.field}'`);
    }

    const fieldType = this.definitions[options.field].type;

    const alpha = options.alpha || (fieldType === 'string' ? 'ALPHA' : '');
    const direction = options.direction ? options.direction : 'ASC';
    const scored = typeof (fieldType) === 'string' ? indexNumberTypes.includes(fieldType) : false;
    let start = 0;
    let stop = 100;
    if (Array.isArray(options.limit) && options.limit.length > 0) {
      start = options.limit[0];
      if (scored) { // the limit arguments for sets and sorted sets work differently
        // stop is a 0-based index from the start of all zset members
        stop = options.limit[1] ? start + options.limit[1] : start + stop;
        stop--;
      } else {
        // stop is a 1-based index from the defined start limit (the wanted behaviour)
        stop = options.limit[1] || stop;
      }
    }
    let idsetKey = this.prefix('idsets');
    let zsetKey = `${this.prefix('scoredindex')}:${options.field}`;
    const client: redis.Multi = this.client.multi();
    let tmpKey: string = '';

    if (ids) {
      // to get the intersection of the given ids and all ids on the server we first
      // temporarily store the given ids either in a set or sorted set and then return the intersection
      if (scored) {
        tmpKey = zsetKey + ':tmp_sort:' + (+ new Date()) + Math.ceil(Math.random() * 1000);
        const tempZaddArgs = [tmpKey];
        ids.forEach((id) => {
          tempZaddArgs.push('0', id as string);
        }); // typecast because rediss doesn't care about numbers/string
        client.zadd.apply(client, tempZaddArgs);
        client.zinterstore([tmpKey, 2, tmpKey, zsetKey]);
        zsetKey = tmpKey;
      } else {
        tmpKey = idsetKey + ':tmp_sort:' + (+ new Date()) + Math.ceil(Math.random() * 1000);
        ids.unshift(tmpKey);
        client.SADD.apply(client, ids as Array<string>); // typecast because rediss doesn't care about numbers/string
        client.SINTERSTORE([tmpKey, tmpKey, idsetKey]);
        idsetKey = tmpKey;
      }
    }
    if (scored) {
      const method = direction && direction === 'DESC' ? 'ZREVRANGE' : 'ZRANGE';
      client[method](zsetKey, start, stop);
    } else {
      client.sort(idsetKey,
        'BY', `${this.prefix('hash')}:*->${options.field}`,
        'LIMIT', String(start), String(stop),
        direction,
        alpha);
    }
    if (ids) {
      client.del(tmpKey);
    }
    return new Promise<Array<string>>((resolve, reject) => {
      client.exec((err, replies) => {
        if (err) {
          reject(err);
        } else {
          if (ids) {
            // 2 redis commands to create the temp keys, then the query
            resolve(replies[2]);
          } else {
            resolve(replies[0]);
          }
        }
      });
    });
  }

  public getDefinitions() {
    return this.definitions;
  }

}

export default NohmModel;
