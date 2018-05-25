import { createHash } from 'crypto';
import * as Debug from 'debug';
import * as _ from 'lodash';
import * as redis from 'redis';
import * as traverse from 'traverse';
import { v4 as uuid } from 'uuid';

import { INohmPrefixes, NohmClass } from '.';
import { LinkError } from './errors/LinkError';
import { ValidationError } from './errors/ValidationError';
import * as messageComposers from './eventComposers';
import { callbackError, checkEqual } from './helpers';
import { idGenerators } from './idGenerators';
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
  ISearchOption,
  ISortOptions,
  IStructuredSearch,
  IUnlinkKeyMapItem,
  IValidationObject,
  IValidationResult,
  TLinkCallback,
  TValidationDefinition,
} from './model.header';
import {
  DEL,
  EXEC,
  EXISTS,
  GET,
  HGETALL,
  MSET,
  SADD,
  SCARD,
  SET,
  SETNX,
  SINTER,
  SISMEMBER,
  SMEMBERS,
} from './typed-redis-helper';
import { validators } from './validators';

export {
  IDictionary,
  ILinkOptions,
  IModelPropertyDefinition,
  IModelPropertyDefinitions,
  IModelOptions,
  ISortOptions,
  TLinkCallback,
};
export { NohmModel };

const debug = Debug('nohm:model');
const debugPubSub = Debug('nohm:pubSub');

/**
 * The property types that get indexed in a sorted set.
 * This should not be changed since it can invalidate already existing data.
 */
const indexNumberTypes = ['integer', 'float', 'timestamp'];

export type TAllowedEventNames = 'create' | 'save' | 'update' | 'remove' | 'link' | 'unlink';
const eventActions: Array<TAllowedEventNames> = ['create', 'update', 'save', 'remove', 'unlink', 'link'];


abstract class NohmModel<TProps extends IDictionary = IDictionary> {


  public client: redis.RedisClient;
  public errors: {
    [key in keyof TProps]: Array<string>;
  };
  public meta: {
    inDb: boolean,
    properties: IModelPropertyDefinitions,
    version: string,
  };
  public readonly modelName: string;

  protected properties: Map<keyof TProps, IProperty>;
  protected options: IModelOptions;
  protected publish: null | boolean = null;
  protected static readonly definitions: IModelPropertyDefinitions = {};
  protected abstract nohmClass: NohmClass;

  private _id: null | string;
  private _isLoaded: boolean;
  private _isDirty: boolean;
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

    const definitions = this.getDefinitions();
    const propKeys = Object.keys(definitions);
    debug(`Constructing model with these properties: %j`, propKeys);
    propKeys.forEach((key: keyof TProps) => {
      const definition = this.getDefinitions()[key];
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
        this.setProperty(key, defaultValue, true);
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

    this._id = null;
    this._isLoaded = false;
    this._isDirty = false;
    this.inDb = false;
  }

  private __resetProp(property: keyof TProps) {
    const tmp = this.getProperty(property);
    tmp.__updated = false;
    tmp.__oldValue = tmp.value;
    type genericFunction = (...args: Array<any>) => any;
    let type: string | genericFunction = this.getDefinitions()[property].type;
    if (typeof (type) !== 'string') {
      type = '__notIndexed__';
    }
    tmp.__numericIndex = indexNumberTypes.indexOf(type) > -1;
  }

  private addMethods(methods?: { [name: string]: () => any }) {
    if (methods) {
      _.each(methods, (method, name) => {
        if (typeof ((this as any)[name]) !== 'undefined') {
          const errorForStack = new Error('Deprecation warning');
          setTimeout(() => {
            // Timeout to make sure we have this.modelName. this function is called in constructor and thus
            //  doesn't always have modelName yet
            // tslint:disable-next-line:max-line-length
            console.warn('\x1b[31m%s\x1b[0m', `WARNING: Overwriting existing property/method '${name}' in '${this.modelName}' because of method definition.`);
            // tslint:disable-next-line:max-line-length
            console.warn('\x1b[31m%s\x1b[0m', `DEPRECATED: Overwriting built-in methods is deprecated. Please migrate them to a different name. Here's a stack to help identify the problem:`, errorForStack.stack);
          }, 1);
          (this as any)['_super_' + name] = (this as any)[name].bind(this);
        }
        debug(`Adding method to model: %s`, method);
        (this as any)[name] = method;
      });
    }
  }

  private updateMeta(
    callback: (
      error: string | Error | null, version?: string,
    ) => any = (..._args: Array<any>) => { /* noop */ },
  ) {

    setTimeout(async () => {
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


      try {
        const dbVersion = await GET(this.client, versionKey);
        if (this.meta.version !== dbVersion) {
          const generator = this.options.idGenerator || 'default';
          debug(`Setting meta for model '%s' with version '%s' and idGenerator '%s' to %j.`,
            this.modelName, this.meta.version, generator, properties);
          await Promise.all([
            SET(this.client, idGeneratorKey, generator.toString()),
            SET(this.client, propertiesKey, JSON.stringify(properties)),
            SET(this.client, versionKey, this.meta.version),
          ]);
        }
        this.meta.inDb = true;
        callback(null, this.meta.version);
      } catch (err) {
        this.nohmClass.logError(err);
        callback(err, this.meta.version);
      }
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
    hash.update('' + JSON.stringify(this.getDefinitions()));
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
    console.warn(
      '\x1b[31m%s\x1b[0m',
      'DEPRECATED: Usage of NohmModel.p() is deprecated, use NohmModel.property() instead.',
    );
    return this.property(keyOrValues, value);
  }

  /**
   * Alias for .property().
   * This method is deprecated, use .property() instead.
   *
   * @deprecated
   */
  public prop(keyOrValues: any, value?: any): any {
    console.warn(
      '\x1b[31m%s\x1b[0m',
      'DEPRECATED: Usage of NohmModel.prop() is deprecated, use NohmModel.property() instead.',
    );
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
  public property<TProp extends keyof TProps>(key: TProp): TProps[TProp];
  // tslint:disable-next-line:unified-signatures
  public property<TProp extends keyof TProps>(key: TProp, value: any): TProps[TProp];
  // tslint:disable-next-line:unified-signatures
  public property(
    valuesObject: Partial<{ [key in keyof TProps]: any }>,
  ): Partial<{ [key in keyof TProps]: TProps[key] }>;
  public property<TProp extends keyof TProps>(
    keyOrValues: keyof TProps | Partial<{ [key in keyof TProps]: any }>,
    value?: any,
  ): TProps[TProp] | Partial<{ [key in keyof TProps]: any }> {
    if (!this.isPropertyKey(keyOrValues)) {
      const obj: Partial<{ [key in keyof TProps]: any }> = {};
      Object.keys(keyOrValues).forEach((key) => {
        obj[key] = this.property(key, keyOrValues[key]);
      });
      return obj;
    }
    if (typeof value !== 'undefined') {
      debug(`Setting property '%s' to value %o`, keyOrValues, value);
      this.setProperty(keyOrValues, value);
      this.allPropertiesCache[keyOrValues] = this.property(keyOrValues);
    }
    const prop = this.getProperty(keyOrValues);
    let returnValue = prop.value;
    if (this.getDefinitions()[keyOrValues].type === 'json') {
      returnValue = JSON.parse(returnValue);
    }
    debug(`Returning property '%s' with value %o`, keyOrValues, returnValue);
    return returnValue;
  }

  private getProperty(key: keyof TProps) {
    const prop = this.properties.get(key);
    if (!prop) {
      throw new Error(`Invalid property key '${key}'.`);
    }
    return prop;
  }

  private setProperty(key: keyof TProps, value: any, skipCast = false): void {
    const prop = this.getProperty(key);
    if (prop.value !== value) {
      if (skipCast) {
        prop.value = value;
        this.allPropertiesCache[key] = value;
      } else {
        prop.value = this.castProperty(key, prop, value);
      }
      prop.__updated = prop.value !== prop.__oldValue;
      this.properties.set(key, prop);
    }
  }

  private castProperty(key: keyof TProps, prop: IProperty, newValue: any): any {
    const type = this.getDefinitions()[key].type;

    if (typeof (type) === 'undefined') {
      return newValue;
    }

    debug(`Casting property '%s' with type %o`, key, type);

    if (typeof (type) === 'function') {
      return type.call(this, String(newValue), key, String(prop.__oldValue));
    }

    switch (type.toLowerCase()) {
      case 'boolean':
      case 'bool':
        return newValue === 'false' ? false : !!newValue;
      case 'string':
        return (
          (!(newValue instanceof String) ||
            newValue.toString() === '') && typeof newValue !== 'string'
        ) ? ''
          : newValue;
      case 'integer':
      case 'int':
        return isNaN(parseInt(newValue, 10)) ? 0 : parseInt(newValue, 10);
      case 'float':
      case 'number':
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
    debug(`Resetting property '%s' (all if empty).`, key);

    this.properties.forEach((prop: IProperty, innerKey: keyof TProps) => {
      if (!key || innerKey === key) {
        prop.__updated = false;
        prop.value = prop.__oldValue;
        this.properties.set(innerKey, prop);
        this.allPropertiesCache[innerKey] = prop.__oldValue;
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
    options?: ISaveOptions,
  ): Promise<void> {
    // TODO for v1: right now continue_on_link_error is always "true" since it's the current
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
      // that would also make clustered/sharded storage much more straight forward
      // and remove a bit of code here.
      this.id = uuid();
    }

    debug(`Saving instance '%s.%s' with action '%s'.`, this.modelName, this.id, action);
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
    let numIdExisting: number = 0;
    if (action !== 'create') {
      numIdExisting = numIdExisting = await SISMEMBER(this.client, this.prefix('idsets'), this.id);
    }
    if (action === 'create' && numIdExisting === 0) {
      debug(`Creating new instance '%s.%s' because action was '%s' and numIdExisting was %d.`,
        this.modelName, this.id, action, numIdExisting);
      await this.create();
    }
    await this.update(options);
    // TODO: maybe implement some kind of locking mechanism so that an object is not being changed during save.
    this._isDirty = false;
    this._isLoaded = true;
  }

  private async create() {
    const id = await this.generateId();
    await SADD(this.client, this.prefix('idsets'), id);
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
    if (typeof id === 'string' && id.includes(':')) {
      // TODO: add documentation for this
      // we need to do stuff with redis keys and we seperate parts of the redis key by :
      // thus the id cannot contain that character.
      throw new Error('Nohm IDs cannot contain the character ":". Please change your idGenerator!');
    }
    return id;
  }

  /**
   * Sets the unique ids of all unique property values in this instance to the given id.
   * Warning: Only use this during create() when overwriting temporary ids!
   */
  private async setUniqueIds(id: string): Promise<void> {
    const mSetArguments = [];
    for (const [key, prop] of this.properties) {
      const isUnique = !!this.getDefinitions()[key].unique;
      const isEmptyString = prop.value === ''; // marking an empty string as unique is probably never wanted
      const isDirty = prop.__updated || !this.inDb;
      if (isUnique && !isEmptyString && isDirty) {
        let value = this.property(key);
        if (this.getDefinitions()[key].type === 'string') {
          value = (value as string).toLowerCase();
        }
        const prefix = this.prefix('unique');
        mSetArguments.push(`${prefix}:${key}:${value}`, id);
      }
    }
    if (mSetArguments.length !== 0) {
      debug(`Setting all unique indices of model '%s.%s' to new id '%s'.`,
        this.modelName, this.id, id);
      return MSET(this.client, mSetArguments);
    }
  }

  private async update(options: ISaveOptions): Promise<Array<ILinkSaveResult> | LinkError> {
    if (!this.id) {
      throw new Error('Update was called without having an id set.');
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

    await EXEC(client);

    const linkResults = await this.storeLinks(options);
    this.relationChanges = [];

    const linkFailures = linkResults.filter((linkResult) => !linkResult.success);

    if (linkFailures.length > 0) {
      throw new LinkError(
        linkFailures,
      );
    }

    this.inDb = true;

    let diff;
    if (this.getPublish()) { // don't need the diff otherwise
      diff = this.propertyDiff();
    }

    for (const [key] of this.properties) {
      this.__resetProp(key);
    }

    if (!options.silent) {
      if (isCreate) {
        this.fireEvent('create');
      } else {
        this.fireEvent('update', diff);
      }
      this.fireEvent('save', diff);
    }

    return linkResults;

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
            debug(`Saving %sed '%s' instance from '%s.%s' with relation '%s' because it had no id.`,
              change.action, change.object.modelName, this.modelName, this.id, change.options.name);
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
      // TODO for v1: implement continue_on_link_error
      saveResults = saveResults.concat(await fn());
    }
    return saveResults;
  }

  private getRelationKey(otherName: string, relationName: string) {
    return `${this.prefix('relations')}:${relationName}:${otherName}:${this.id}`;
  }

  private async saveLinkRedis(change: IRelationChange): Promise<void> {
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
    multi[command](toKey, change.object.stringId());

    // relation from other - same thing in reverse
    const fromKey = change.object.getRelationKey(this.modelName, foreignName);
    multi[command](
      `${relationKeyPrefix}${change.object.modelName}:${change.object.id}`,
      fromKey,
    );
    multi[command](fromKey, this.stringId());

    try {
      debug(`Linking in redis.`,
        this.modelName, change.options.name, command);
      await EXEC(multi);
      if (!change.options.silent) {
        this.fireEvent(change.action, change.object, change.options.name);
      }
    } catch (err) {
      if (change.options.error) {
        change.options.error(err, change.object);
      }
      throw err;
    }
  }


  private setIndices(multi: redis.Multi | redis.RedisClient) {
    for (const [key, prop] of this.properties) {
      const isUnique = !!this.getDefinitions()[key].unique;
      const isIndex = !!this.getDefinitions()[key].index;
      const isDirty = prop.__updated || !this.inDb;

      // free old uniques
      if (isUnique && prop.__updated && this.inDb) {
        let oldUniqueValue = prop.__oldValue;
        if (this.getDefinitions()[key].type === 'string') {
          oldUniqueValue = (oldUniqueValue as string).toLowerCase();
        }
        debug(`Removing old unique '%s' from '%s.%s' because propUpdated: %o && this.inDb %o.`,
          key, this.modelName, this.id, prop.__updated, this.inDb);
        multi.DEL(`${this.prefix('unique')}:${key}:${oldUniqueValue}`, this.nohmClass.logError);
      }

      // set new normal index
      if (isIndex && isDirty) {
        if (prop.__numericIndex) {
          debug(`Adding numeric index '%s' to '%s.%s'.`,
            key, this.modelName, this.id, prop.__updated, this.inDb);
          // we use scored sets for things like "get all users older than 5"
          const scoredPrefix = this.prefix('scoredindex');
          if (this.inDb) {
            multi.ZREM(`${scoredPrefix}:${key}`, this.stringId(), this.nohmClass.logError);
          }
          multi.ZADD(`${scoredPrefix}:${key}`, prop.value, this.stringId(), this.nohmClass.logError);
        }
        debug(`Adding index '%s' to '%s.%s'.`,
          key, this.modelName, this.id, prop.__updated, this.inDb);
        const prefix = this.prefix('index');
        if (this.inDb) {
          multi.SREM(`${prefix}:${key}:${prop.__oldValue}`, this.stringId(), this.nohmClass.logError);
        }
        multi.SADD(`${prefix}:${key}:${prop.value}`, this.stringId(), this.nohmClass.logError);
      }
    }
  }

  public valid(property?: keyof TProps, setDirectly = false): Promise<boolean> {
    console.warn('\x1b[31m%s\x1b[0m',
      'DEPRECATED: Usage of NohmModel.valid() is deprecated, use NohmModel.validate() instead.');
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
        if (!result.errors || result.errors.length === 0) {
          throw new Error(`Validation failed but didn't provide an error message. Property name: ${result.key}.`);
        }
        this.errors[result.key] = this.errors[result.key].concat(result.errors);
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
    const validations = this.getDefinitions()[key].validations;
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
          if (!result.errors) {
            result.errors = [];
          }
          result.errors.push(validationObject.name);
        }
      });
      await Promise.all(validationPromises);
    }
    return result;
  }

  private getValidationObject(validator: TValidationDefinition, key: keyof TProps): IValidationObject {
    if (typeof (validator) === 'function') {
      const funcName = validator.toString().match(/^(async )?function ([\w]*)[\s]?\(/);
      return {
        name: `custom_${(funcName && funcName[2] ? funcName[2] : key)}`,
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
    const definition = this.getDefinitions()[key];
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

  private async isUniqueKeyFree(key: string, setDirectly: boolean): Promise<boolean> {
    let dbValue: number;
    if (setDirectly) {
      /*
      * We lock the unique value here if it's not locked yet, then later remove the old uniquelock
      * when really saving it. (or we free the unique slot if we're not saving)
      */
      dbValue = await SETNX(this.client, key, this.stringId());
    } else {
      dbValue = await EXISTS(this.client, key);
    }
    let isFreeUnique = false;
    if (setDirectly && dbValue === 1) {
      // setDirectly === true means using setnx which returns 1 if the value did *not* exist
      isFreeUnique = true;
      this.tmpUniqueKeys.push(key);
    } else if (!setDirectly && dbValue === 0) {
      // setDirectly === false means using exists which returns 0 if the value did *not* exist
      isFreeUnique = true;
    } else if (setDirectly && dbValue === 0) {
      // setDirectly === true means using setnx which returns 1 if the value did *not* exist
      // if it did exist, we check if the unique is the same as the one on this model.
      // see https://github.com/maritz/nohm/issues/82 for use-case
      const dbId = await GET(this.client, key);
      if (dbId === this.stringId()) {
        isFreeUnique = true;
      }
    }
    debug(`Checked unique '%s' for '%s.%s'. Result: '%s' because setDirectly: '%o' && dbValue: '%d'.`,
      key, this.modelName, this.id, isFreeUnique, setDirectly, dbValue);
    return isFreeUnique;
  }

  private getUniqueKey(key: keyof TProps, property: IProperty): string {
    let uniqueValue = property.value;
    if (this.getDefinitions()[key].type === 'string') {
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
    debug(`Checking unique '%s' for '%s.%s' at '%s'.`,
      key, this.modelName, this.id, uniqueKey);
    const isFree = await this.isUniqueKeyFree(uniqueKey, setDirectly);
    if (!isFree) {
      return {
        errors: ['notUnique'],
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
      debug(`Clearing temp uniques '%o' for '%s.%s'.`,
        this.tmpUniqueKeys, this.modelName, this.id);
      const deletes: Array<Promise<void>> = this.tmpUniqueKeys.map((key) => {
        return DEL(this.client, key);
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
      // make sure we have the db uniques/indices
      await this.load(this.id);
    }
    debug(`Removing '%s.%s'.`, this.modelName, this.id);
    await this.deleteDbCall();
    const oldId = this.id;
    this.id = null;

    if (!silent) {
      this.fireEvent('remove', oldId);
    }
  }

  private async deleteDbCall(): Promise<void> {
    // TODO for v1: write test for removal of relationKeys - purgeDb kinda tests it already, but not enough

    const multi = this.client.MULTI();

    multi.del(`${this.prefix('hash')}:${this.stringId()}`);
    multi.srem(this.prefix('idsets'), this.stringId());

    this.properties.forEach((prop, key) => {
      if (this.getDefinitions()[key].unique) {
        let value = prop.__oldValue;
        if (this.getDefinitions()[key].type === 'string') {
          value = String(value).toLowerCase();
        }
        multi.del(`${this.prefix('unique')}:${key}:${value}`);
      }
      if (this.getDefinitions()[key].index === true) {
        multi.srem(`${this.prefix('index')}:${key}:${prop.__oldValue}`, this.stringId());
      }
      if (prop.__numericIndex === true) {
        multi.zrem(`${this.prefix('scoredindex')}:${key}`, this.stringId());
      }
    });

    await this.unlinkAll(multi);

    await EXEC(multi);
  }

  /**
   * Returns a Promsie that resolves to true if the given id exists for this model.
   *
   * @param {*} id
   * @returns {Promise<boolean>}
   */
  public async exists(id: any): Promise<boolean> {
    callbackError(...arguments);
    return !!await SISMEMBER(this.client, this.prefix('idsets'), id);
  }

  private async getHashAll(id: any): Promise<Partial<TProps>> {
    const props: Partial<TProps> = {};
    const values = await HGETALL(this.client, `${this.prefix('hash')}:${id}`);
    if (values === null) {
      throw new Error('not found');
    }
    Object.keys(values).forEach((key) => {
      if (key === '__meta_version') {
        return;
      }
      if (!this.getDefinitions()[key]) {
        // tslint:disable-next-line:max-line-length
        this.nohmClass.logError(`A hash in the DB contained a key '${key}' that is not in the model definition. This might be because of model changes or database corruption/intrusion.`);
        return;
      }
      props[key] = values[key];
    });
    return props;
  }

  public async load(id: any): Promise<TProps & { id: any }> {
    callbackError(...arguments);
    if (!id) {
      throw new Error('No id passed to .load().');
    }
    debug(`Loading '%s.%s' at '%s'.`, this.modelName, id);
    const dbProps = await this.getHashAll(id);
    const definitions = this.getDefinitions();

    Object.keys(dbProps).forEach((key) => {
      if (definitions[key].load_pure) {
        // prevents type casting/behaviour. especially useful for create-only properties like a createdAt timestamp
        debug(`Loading property '%s' from '%s.%s' as pure (no type casting).`,
          key, this.modelName, id);
        this.setProperty(key, dbProps[key], true);
      } else {
        this.property(key, dbProps[key]);
      }
      this.__resetProp(key);
    });
    this.id = id;
    this.inDb = true;
    this._isLoaded = true;
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
   *    error?: (err: Error | string, otherName: string, otherObject: NohmModel) => any;
   *    name: string;
   *    silent?: boolean;
   *  }
   *
   * @param {NohmModel} other The other instance that is being linked
   * @param {(string | ILinkOptions | (() => any))} [optionsOrNameOrCallback] Either a string for the
   *  relation name (default: 'default') or an options object (see example above) or the callback
   * @param {() => any} [callback] Function that is called when the link is saved.
   */
  public link<T extends NohmModel>(other: T, callback?: TLinkCallback<T>): void;
  public link<T extends NohmModel>(
    other: NohmModel,
    optionsOrNameOrCallback: string | ILinkOptions,
    callback?: TLinkCallback<T>,
  ): void;
  public link<T extends NohmModel>(
    other: NohmModel,
    optionsOrNameOrCallback?: string | ILinkOptions | (TLinkCallback<T>),
    callback?: TLinkCallback<T>,
  ): void {
    if (typeof (optionsOrNameOrCallback) === 'function') {
      callback = optionsOrNameOrCallback;
      optionsOrNameOrCallback = 'default';
    } else if (typeof (optionsOrNameOrCallback) === 'undefined') {
      optionsOrNameOrCallback = 'default';
    }
    const options: ILinkOptions = this.getLinkOptions(optionsOrNameOrCallback);
    this.relationChanges.push({
      action: 'link',
      callback,
      object: other,
      options,
    });
    debug(`Set link for '%s.%s': %o`,
      this.modelName, this.id, this.relationChanges[this.relationChanges.length - 1]);
  }

  /**
   * Unlinks one object to another.
   * Does not remove the link directly but marks it for the next .save() call.
   *
   * @example
   *  // options object typing:
   *  {
   *    continue_on_link_error?: boolean; // default false
   *    error?: (err: Error | string, otherName: string, otherObject: NohmModel) => any;
   *    name: string;
   *    silent?: boolean;
   *  }
   *
   * @param {NohmModel} other The other instance that is being unlinked (needs to have an id)
   * @param {(string | ILinkOptions | (() => any))} [optionsOrNameOrCallback] Either a string for the
   *  relation name (default: 'default') or an options object (see example above) or the callback
   * @param {() => any} [callback]
   */
  public unlink<T extends NohmModel>(other: T, callback?: TLinkCallback<T>): void;
  public unlink<T extends NohmModel>(
    other: NohmModel,
    optionsOrNameOrCallback: string | ILinkOptions,
    callback?: TLinkCallback<T>,
  ): void;
  public unlink<T extends NohmModel>(
    other: NohmModel,
    optionsOrNameOrCallback?: string | ILinkOptions | (TLinkCallback<T>),
    callback?: TLinkCallback<T>,
  ): void {
    if (typeof (optionsOrNameOrCallback) === 'function') {
      callback = optionsOrNameOrCallback;
      optionsOrNameOrCallback = 'default';
    } else if (typeof (optionsOrNameOrCallback) === 'undefined') {
      optionsOrNameOrCallback = 'default';
    }
    const options: ILinkOptions = this.getLinkOptions(optionsOrNameOrCallback);
    this.relationChanges.forEach((change, key) => {
      const sameRelationChange = change.options.name === options.name && checkEqual(change.object, other);
      if (sameRelationChange) {
        this.relationChanges.splice(key, 1);
      }
    });
    this.relationChanges.push({
      action: 'unlink',
      callback,
      object: other,
      options,
    });
    debug(`Set unlink for '%s.%s': %o`,
      this.modelName, this.id, this.relationChanges[this.relationChanges.length - 1]);
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
    const relationKeysKey = `${this.rawPrefix().relationKeys}${this.modelName}:${this.id}`;

    const keys = await SMEMBERS(this.client, relationKeysKey);

    debug(`Remvoing links for '%s.%s': %o.`,
      this.modelName, this.id, keys);

    const others: Array<IUnlinkKeyMapItem> = keys.map((key) => {
      const matches = key.match(/:([\w]*):([\w]*):[^:]+$/i);
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
    multi.del(relationKeysKey);

    // if we didn't get a multi client from the callee we have to exec() ourselves
    if (!this.isMultiClient(givenClient)) {
      await EXEC(multi);
    }
  }

  /*
  This method is doubly asynchronous:
  First it returns a promise that gets resolved when the ids have been fetched that need to be used as keys for
  removing this.id from relations to others.
  Secondly it adds an SREM to the multi redis client.
  */
  private async removeIdFromOtherRelations(multi: redis.Multi, item: IUnlinkKeyMapItem): Promise<void> {
    const ids = await SMEMBERS(this.client, item.ownIdsKey);
    ids.forEach((id) => {
      multi.SREM(`${item.otherIdsKey}${id}`, this.stringId());
    });
  }

  /**
   * Resolves with true if the given object has a relation (optionally with the given relation name) to this.
   *
   * @param {NohmModel} obj
   * @param {string} [relationName='default']
   * @returns {Promise<boolean>}
   */
  public async belongsTo(obj: NohmModel, relationName = 'default'): Promise<boolean> {
    callbackError(...arguments);
    if (!this.id || !obj.id) {
      throw new Error('Calling belongsTo() even though either the object itself or the relation does not have an id.');
    }
    return !!await SISMEMBER(this.client, this.getRelationKey(obj.modelName, relationName), obj.id);
  }

  /**
   * Returns an array of the ids of all objects that are linked with the given relation.
   *
   * @param {string} otherModelName
   * @param {string} [relationName='default']
   * @returns {Promise<Array<any>>}
   */
  public async getAll(otherModelName: string, relationName = 'default'): Promise<Array<any>> {
    if (!this.id) {
      throw new Error(`Calling getAll() even though this ${this.modelName} has no id. Please load or save it first.`);
    }
    const relationKey = this.getRelationKey(otherModelName, relationName);
    const ids = await SMEMBERS(this.client, relationKey);
    if (!Array.isArray(ids)) {
      return [];
    } else {
      return ids;
    }
  }

  /**
   * Returns the number of links of a specified relation (or the default) an instance has to
   * models of a given modelName.
   *
   * @param {string} otherModelName Name of the model on the other end of the relation.
   * @param {string} [relationName='default'] Name of the relation
   * @returns {Promise<number>}
   */
  public async numLinks(otherModelName: string, relationName = 'default'): Promise<number> {
    callbackError(...arguments);
    if (!this.id) {
      throw new Error(`Calling numLinks() even though this ${this.modelName} has no id. Please load or save it first.`);
    }
    const relationKey = this.getRelationKey(otherModelName, relationName);
    return SCARD(this.client, relationKey);
  }

  /**
   * Finds ids of objects by search arguments
   *
   * @param {ISearchOptions} searches
   * @returns {Promise<Array<any>>}
   */
  public async find(searches: Partial<{
    [key in keyof TProps]: string | number | boolean | Partial<ISearchOption>;
  }> = {}): Promise<Array<string>> {
    const structuredSearches = this.createStructuredSearchOptions(searches);

    const uniqueSearch = structuredSearches.find((search) => search.type === 'unique');
    if (uniqueSearch) {
      debug(`Finding '%s's with uniques:\n%o.`,
        this.modelName, this.id, uniqueSearch);
      return this.uniqueSearch(uniqueSearch);
    }

    const onlySets = structuredSearches.filter((search) => search.type === 'set');
    const onlyZSets = structuredSearches.filter((search) => search.type === 'zset');

    if (onlySets.length === 0 && onlyZSets.length === 0) {
      // no valid searches - return all ids
      return SMEMBERS(this.client, `${this.prefix('idsets')}`);
    }
    debug(`Finding '%s's with these searches (sets, zsets):\n%o,\n%o.`,
      this.modelName, this.id, onlySets, onlyZSets);

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

  private createStructuredSearchOptions(searches: Partial<{
    [key in keyof TProps]: string | number | boolean | Partial<ISearchOption>;
  }>): Array<IStructuredSearch<TProps>> {
    return Object.keys(searches).map((key) => {
      const search = searches[key];
      if (typeof search === 'undefined') {
        throw new Error('Invalid find() options.'); // this shouldn't occur
      }
      const prop = this.getProperty(key);
      const definition = this.getDefinitions()[key];
      const structuredSearch: IStructuredSearch<TProps> = {
        key,
        options: {},
        type: 'undefined',
        value: search,
      };
      if (definition.unique) {
        if (definition.type === 'string') {
          if (typeof (search) !== 'string') {
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
        const isDirectNumericSearch = !isNaN(parseInt(search as string, 10));
        const isSimpleIndexSearch = !prop.__numericIndex || isDirectNumericSearch;
        if (!isSimpleIndexSearch && prop.__numericIndex) {
          structuredSearch.type = 'zset';
          structuredSearch.options = search as Partial<ISearchOption>;
        } else if (definition.index === true) {
          structuredSearch.type = 'set';
        }
      }
      return structuredSearch;
    });
  }

  private async uniqueSearch(options: IStructuredSearch<TProps>): Promise<Array<string>> {
    const key = `${this.prefix('unique')}:${options.key}:${options.value}`;
    const id = await GET(this.client, key);
    if (id) {
      return [id];
    } else {
      return [];
    }
  }

  private async setSearch(searches: Array<IStructuredSearch<TProps>>): Promise<Array<string>> {
    const keys = searches.map((search) => {
      return `${this.prefix('index')}:${search.key}:${search.value}`;
    });
    if (keys.length === 0) {
      // shortcut
      return [];
    }
    return SINTER(this.client, keys);
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

    const fieldType = this.getDefinitions()[options.field].type;
    const isIndexed = this.getDefinitions()[options.field].index;

    const alpha = options.alpha || (fieldType === 'string' ? 'ALPHA' : undefined);
    const direction = options.direction ? options.direction : 'ASC';
    const scored = typeof (fieldType) === 'string' && isIndexed ? indexNumberTypes.includes(fieldType) : false;
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
    const client: redis.Multi = this.client.MULTI();
    let tmpKey: string = '';


    debug(`Sorting '%s's with these options (alpha, direction, scored, start, stop, ids):`,
      this.modelName, this.id, alpha, direction, scored, start, stop, ids);

    if (ids) {
      // to get the intersection of the given ids and all ids on the server we first
      // temporarily store the given ids either in a set or sorted set and then return the intersection
      if (scored) {
        tmpKey = zsetKey + ':tmp_sort:' + (+ new Date()) + Math.ceil(Math.random() * 1000);
        const tempZaddArgs = [tmpKey];
        ids.forEach((id) => {
          tempZaddArgs.push('0', id as string);
        }); // typecast because redis doesn't care about numbers/string
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
        alpha as any, // any casting because passing in an empty string actually results in errors in some cases
      );
    }
    if (ids) {
      client.del(tmpKey);
    }
    const replies = await EXEC<any>(client);
    let reply: Array<Error | any>;
    if (ids) {
      // 2 redis commands to create the temp keys, then the query
      reply = replies.splice(2, 1)[0];
    } else {
      reply = replies.splice(0, 1)[0];
    }
    replies.forEach((otherReply) => {
      if (otherReply instanceof Error) {
        const warnMessage = otherReply.stack ? otherReply.stack : otherReply.message;
        console.warn(`Error during ${this.modelName}.sort() multi.exec(): ${warnMessage}`);
      }
    });
    if (reply instanceof Error) {
      // multi responses are returned as arrays and each item can be an error
      // if the reply of the sort command that gives us our ids fails, we want to throw
      throw reply;
    } else {
      return reply;
    }
  }

  public getDefinitions(): {
    [key: string]: IModelPropertyDefinition;
  } {
    const definitions = Object.getPrototypeOf(this).definitions;
    if (!definitions) {
      throw new Error(`Model was not defined with proper static definitions: '${this.modelName}'`);
    }
    return definitions;
  }

  private fireEvent(event: TAllowedEventNames, ...args: Array<any>) {
    if (!this.getPublish()) {
      // global or model specific setting for publishing events is false.
      return;
    }

    if (eventActions.indexOf(event) < 0) {
      const supported = eventActions.join(', ');
      this.nohmClass.logError(
        'Cannot fire an unsupported action. Was "' + event + '" ' +
        'and must be one of ' + supported,
      );
      return;
    }

    const composer = messageComposers[event] || messageComposers.defaultComposer;
    const payload = composer.apply(this, args);
    const message = JSON.stringify(payload);

    debugPubSub(`Firing event '%s' for '%s': %j.`,
      event, this.modelName, payload);

    this.client.publish(`${this.prefix('channel')}:${event}`, message);
  }

  private getPublish(): boolean {
    if (this.publish !== null) {
      return this.publish;
    } else {
      return this.nohmClass.getPublish();
    }
  }

  public async subscribe(
    eventName: TAllowedEventNames,
    callback: (payload: any) => void,
  ): Promise<void> {
    debugPubSub(`Subscribing to event '%s' for '%s'.`,
      eventName, this.modelName);
    await this.nohmClass.subscribeEvent(`${this.modelName}:${eventName}`, callback);
  }

  public async subscribeOnce(
    eventName: TAllowedEventNames,
    callback: (payload: any) => void,
  ): Promise<void> {
    debugPubSub(`Subscribing once to event '%s' for '%s'.`,
      eventName, this.modelName);
    await this.nohmClass.subscribeEventOnce(`${this.modelName}:${eventName}`, callback);
  }

  public unsubscribeEvent(
    eventName: string,
    fn?: any,
  ): void {
    debugPubSub(`Unsubscribing from event '%s' for '%s' with fn?: %s.`,
      eventName, this.modelName, fn);
    this.nohmClass.unsubscribeEvent(eventName, fn);
  }

  get id(): null | string {
    return this._id;
  }

  set id(id: null | string) {
    if (id === null) {
      this._id = null;
      this._isLoaded = false;
      this._isDirty = false;
      this.allPropertiesCache.id = null;
      return;
    }
    const stringifiedId = String(id);
    if (this._id !== stringifiedId) {
      this._id = stringifiedId;
      this._isLoaded = false;
      this._isDirty = true;
      this.allPropertiesCache.id = this._id;
    }
  }

  /**
   * Always returns string, even if id is null ('').
   * Used internally for redis command type safety.
   *
   * @returns {string} Id of the model
   * @memberof NohmModel
   */
  public stringId(): string {
    return typeof (this._id) === 'string' ? this._id : '';
  }

  get isLoaded(): boolean {
    return this._isLoaded;
  }

  /**
   * True if there are any unsaved changes. This is triggered by changing the id manually,
   * using .link()/.unlink() and changing properties from their stored state.
   */
  get isDirty(): boolean {
    if (this._isDirty) {
      return true;
    }
    if (this.relationChanges.length > 0) {
      return true;
    }
    const propDiffs = this.propertyDiff();
    if (propDiffs.length > 0) {
      return true;
    }
    return false;
  }
}

export default NohmModel;
