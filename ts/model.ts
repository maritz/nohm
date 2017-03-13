
import * as redis from 'redis';
import { NohmClass } from './index';
import { createHash } from 'crypto';

type propertyTypeNames = 'string' | 'bool' | 'boolean' | 'integer' | 'int' |
                         'float' | 'date' | 'time' | 'timestamp' | 'json';

declare type PropertyBehaviour = <TModel extends NohmModel>(
  this: TModel, newValue: any, key: string, oldValue: any
) => any;

export interface IModelPropertyDefinitions {
  [propName: string]: {
    type: propertyTypeNames | PropertyBehaviour;
    defaultValue?: any;
    validations?: Array<any>;
  }
}

type idGenerators = 'default' | 'increment';

export interface IModelOptions {
  metaCallback?: Function;
  methods?: {
    [name: string]: Function
  }
  properties: IModelPropertyDefinitions;
  publish?: any;
  idGenerator?: idGenerators | Function;
}

export { NohmModel };

abstract class NohmModel {

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

  protected properties: {
    [key: string]: {
      defaultValue: any;
      value: any;
      type: string | Function;
      _updated: boolean;
    }
  };
  protected options: IModelOptions;
  protected abstract definitions: IModelPropertyDefinitions;

  constructor(...args: any[]) {
    this._initOptions();
    if (typeof(this.client) === 'undefined') {
      NohmClass.logError('Did not find a viable redis client in Nohm or the model: '+this.modelName);
    }

    if ( ! this.meta.inDb) {
      this.updateMeta(this.options.metaCallback);
    }

    this.properties = {};
    this.errors = {};

    // initialize the properties
    if (this.options.hasOwnProperty('properties')) {

      for (var p in this.definitions) {
        if (this.definitions.hasOwnProperty(p)) {
          this.properties[p] = h.$extend(true, {}, this.definitions[p]); // deep copy
          var defaultValue = this.definitions[p].defaultValue || 0;
          if (typeof(defaultValue) === 'function') {
            defaultValue = defaultValue();
          }
          if (typeof(this.definitions[p].type) === 'function') {
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

    if (this.options.hasOwnProperty('methods')) {
      addMethods.call(this, this.options.methods);
    }

    if (this.options.hasOwnProperty('publish')) {
      this.publish = this.options.publish;
    }

    this.relationChanges = [];

    this.id = null;
    this.__inDB = false;
    this.__loaded = false;

    if (args && args[0]) {
      this.properties(args);
    }
  }


  /**
   * DO NOT OVERWRITE THIS; USED INTERNALLY
   *
   * @protected
   */
  protected abstract _initOptions(): any;

  protected generateMetaVersion(): string {
    const hash = createHash('sha1');

    const idGenerator = this.options.idGenerator || 'default';

    hash.update(JSON.stringify(this.definitions));
    hash.update(JSON.stringify(this.modelName));
    hash.update(idGenerator.toString());

    return hash.digest('hex');

  }
};

export default NohmModel;
