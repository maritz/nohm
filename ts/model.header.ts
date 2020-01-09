import { NohmModel } from './model';

export type TPropertyTypeNames =
  | 'string'
  | 'bool'
  | 'boolean'
  | 'integer'
  | 'int'
  | 'float'
  | 'number'
  | 'date'
  | 'time'
  | 'timestamp'
  | 'json';
export const stringProperty: TPropertyTypeNames = 'string';
export const boolProperty: TPropertyTypeNames = 'bool';
export const integerProperty: TPropertyTypeNames = 'integer';
export const floatProperty: TPropertyTypeNames = 'float';
export const numberProperty: TPropertyTypeNames = 'number';
export const dateProperty: TPropertyTypeNames = 'date';
export const timeProperty: TPropertyTypeNames = 'time';
export const timestampProperty: TPropertyTypeNames = 'timestamp';
export const jsonProperty: TPropertyTypeNames = 'json';

export interface IDictionary {
  [index: string]: any;
}

export type PropertyBehavior = <TModel extends NohmModel>(
  this: TModel,
  newValue: string,
  key: string,
  oldValue: string,
) => any;

export interface IStaticMethods<T extends NohmModel> {
  new (): T;
  load<P extends NohmModel>(id: any): Promise<P>;
  loadMany<P extends NohmModel>(id: Array<string>): Promise<Array<P>>;
  findAndLoad<P extends NohmModel, TProps extends IDictionary = {}>(
    searches?: Partial<
      {
        [key in keyof TProps]:
          | string
          | number
          | boolean
          | Partial<ISearchOption>;
      }
    >,
  ): Promise<Array<P>>;
  sort(
    sortOptions: ISortOptions<IDictionary>,
    ids?: Array<string | number> | false,
  ): Promise<Array<string>>;
  find<TProps extends IDictionary = {}>(
    searches: Partial<
      {
        [key in keyof TProps]:
          | string
          | number
          | boolean
          | Partial<ISearchOption>;
      }
    >,
  ): Promise<Array<string>>;
  remove(id: any): Promise<void>;
}

export type validatiorFunction = (value: any, options: any) => Promise<boolean>;

export interface IValidationObject {
  name: string;
  options: { [index: string]: any };
  validator: validatiorFunction;
}

export type TValidationDefinition =
  | string
  | { name: string; options: any }
  | validatiorFunction;

export interface IModelPropertyDefinition {
  /**
   * Whether the property should be indexed. Depending on type this creates different keys/collections.
   * Does not work for all types. TODO: specify here which types.
   *
   * @type {boolean}
   * @memberof IModelPropertyDefinition
   */
  index?: boolean;
  defaultValue?: any;
  load_pure?: boolean;
  type: TPropertyTypeNames | PropertyBehavior;
  unique?: boolean;
  validations?: Array<TValidationDefinition>;
}

export type TTypedDefinitions<TProps extends IDictionary> = {
  [props in keyof TProps]: IModelPropertyDefinition;
};

export interface IModelPropertyDefinitions {
  [propName: string]: IModelPropertyDefinition;
}

export type TIdGenerators = 'default' | 'increment';

export interface IModelOptions {
  metaCallback?: () => any;
  methods?: {
    [name: string]: (this: NohmModel, ...args: Array<any>) => any;
  };
  properties: IModelPropertyDefinitions;
  publish?: boolean;
  idGenerator?: TIdGenerators | (() => any);
}

export interface ISaveOptions {
  silent?: boolean;
  skip_validation_and_unique_indexes?: boolean;
}

export interface IProperty {
  value: any;
  __updated: boolean;
  __oldValue: any;
  __numericIndex: boolean; // this is static but private so for now it might be better here than in definitions
}

export interface IPropertyDiff<TKeys = string> {
  key: TKeys;
  before: any;
  after: any;
}

export interface IValidationResult {
  key: string;
  valid: boolean;
  errors?: Array<string>;
}

export interface IRelationChange {
  action: 'link' | 'unlink';
  callback?: (...args: Array<any>) => any;
  object: NohmModel;
  options: ILinkOptionsWithName;
}

export interface ILinkOptions {
  error?: (err: Error | string, otherObject: NohmModel) => any;
  name?: string;
  silent?: boolean;
}

export interface ILinkOptionsWithName extends ILinkOptions {
  name: string;
}

export interface ILinkSaveResult {
  success: boolean;
  child: NohmModel;
  parent: NohmModel;
  error: null | Error;
}

export interface IUnlinkKeyMapItem {
  ownIdsKey: string;
  otherIdsKey: string;
}

export interface ISearchOption {
  endpoints: '()' | '[]' | '[)' | '(]' | '(' | ')';
  limit: number;
  min: number | '-inf' | '+inf';
  max: number | '-inf' | '+inf';
  offset: number;
}

export type TKey<TProps extends IDictionary> = keyof TProps;

export interface IStructuredSearch<TProps extends IDictionary> {
  type: 'undefined' | 'unique' | 'set' | 'zset';
  options: Partial<ISearchOption>;
  key: keyof TProps;
  value: any;
}

export interface ISortOptions<TProps extends IDictionary> {
  alpha?: 'ALPHA' | '';
  direction?: 'ASC' | 'DESC';
  field?: keyof TProps;
  limit?: Array<number>;
}

export type TLinkCallback<T> = (
  action: string,
  ownModelName: string,
  relationName: string,
  other: T,
) => void;

export interface IDefaultEventPayload<TProps extends IDictionary> {
  target: {
    id: null | string;
    modelName: string;
    properties: TProps;
  };
}

export interface IChangeEventPayload<TProps extends IDictionary> {
  target: {
    id: string;
    modelName: string;
    properties: TProps;
    diff: Array<void | IPropertyDiff<TKey<TProps>>>;
  };
}

export interface IRelationChangeEventPayload<TProps extends IDictionary> {
  child: IDefaultEventPayload<TProps>['target'];
  parent: IDefaultEventPayload<TProps>['target'];
  relation: string;
}
