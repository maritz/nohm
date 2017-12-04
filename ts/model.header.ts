import { NohmModel } from './model';

export type TPropertyTypeNames = 'string' | 'bool' | 'boolean' | 'integer' | 'int' | 'float' |
  'number' | 'date' | 'time' | 'timestamp' | 'json';
export const stringProperty: TPropertyTypeNames = 'string';
export const boolProperty: TPropertyTypeNames = 'bool';
export const integerProperty: TPropertyTypeNames = 'integer';
export const floatProperty: TPropertyTypeNames = 'float';
export const numberProperty: TPropertyTypeNames = 'number';
export const dateProperty: TPropertyTypeNames = 'date';
export const timeProperty: TPropertyTypeNames = 'time';
export const timestampProperty: TPropertyTypeNames = 'timestamp';
export const jsonProperty: TPropertyTypeNames = 'json';

export interface IPropertyObject { [index: string]: any; }

export interface IDictionary {
  [index: string]: any;
}

export type PropertyBehaviour = <TModel>(
  this: TModel,
  newValue: any,
  key: string,
  oldValue: any,
) => any;

export interface IStaticMethods<T extends NohmModel> {
  new(): T;
  load<P extends NohmModel>(id: any): Promise<P>;
  loadMany<P extends NohmModel>(id: Array<string>): Promise<Array<P>>;
  findAndLoad<P extends NohmModel>(searches: ISearchOptions): Promise<Array<P>>;
  sort(
    sortOptions: ISortOptions<IDictionary>,
    ids: Array<string | number> | false,
  ): Promise<Array<string>>;
  find(searches: ISearchOptions): Promise<Array<string>>;
  remove(id: any): Promise<void>;
}


export type validatiorFunction = (value: any, options: any) => Promise<boolean>;

export interface IValidationObject {
  name: string;
  options: { [index: string]: any };
  validator: validatiorFunction;
}

export type TValidationDefinition = string | { name: string, options: any } | validatiorFunction;

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
  type: TPropertyTypeNames | PropertyBehaviour;
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
  continue_on_link_error: boolean;
  silent: boolean;
  skip_validation_and_unique_indexes: boolean;
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
  error?: string;
}

export interface IRelationChange {
  action: 'link' | 'unlink';
  callback?: (...args: Array<any>) => any;
  object: NohmModel;
  options: ILinkOptions;
}

export interface ILinkOptions {
  continue_on_link_error?: boolean;
  error?: (err: Error | string, otherObject: NohmModel) => any;
  name: string;
  silent?: boolean;
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

export interface ISearchOptions {
  [key: string]: any | Partial<ISearchOption>;
}

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

export type TLinkCallback<T> = (action: string, ownModelName: string, relationName: string, other: T) => void;
