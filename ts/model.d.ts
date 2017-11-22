import { NohmModel } from './model';

type propertyTypeNames = 'string' | 'bool' | 'boolean' | 'integer' | 'int' | 'float' | 'date' | 'time' |
  'timestamp' | 'json';

export type PropertyObject = { [index: string]: any };

interface IDictionary {
  [index: string]: any;
}

export type PropertyBehaviour = <TModel>(
  this: TModel,
  newValue: any,
  key: string,
  oldValue: any
) => any;

export type validatiorFunction = (value: any, options: any) => Promise<boolean>;

export interface IValidationObject {
  name: string;
  options: { [index: string]: any };
  validator: validatiorFunction;
}

export type TValidationDefinition = string | { name: string, options: any } | validatiorFunction;

export interface IModelPropertyDefinition {
  type: propertyTypeNames | PropertyBehaviour;
  defaultValue?: any;
  validations?: Array<TValidationDefinition>;
  unique?: boolean;
  /**
   * Whether the property should be indexed. Depending on type this creates different keys/collections.
   * Does not work for all types. TODO: specify here which types.
   * 
   * @type {boolean}
   * @memberof IModelPropertyDefinition
   */
  index?: boolean;
}

export interface IModelPropertyDefinitions {
  [propName: string]: IModelPropertyDefinition;
}

type idGenerators = 'default' | 'increment';

export interface IModelOptions {
  metaCallback?: () => any;
  methods?: {
    [name: string]: () => any;
  };
  properties: IModelPropertyDefinitions;
  publish?: any;
  idGenerator?: idGenerators | (() => any);
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
  valid: boolean,
  error?: string
}

export interface IRelationChange {
  action: 'link' | 'unlink';
  callback?: (...args: Array<any>) => any;
  object: NohmModel<IDictionary>;
  options: ILinkOptions;
}

export interface ILinkOptions {
  continue_on_link_error?: boolean;
  error?: (err: Error | string, otherObject: NohmModel<IDictionary>) => any;
  name: string;
  silent?: boolean;
}

export interface ILinkSaveResult {
  success: boolean;
  child: NohmModel<IDictionary>;
  parent: NohmModel<IDictionary>;
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
