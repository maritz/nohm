import { IDictionary } from '../model.header';

export interface IValidationError<TProps extends IDictionary> extends Error {
  modelName: string;
  errors: { [key in keyof TProps]?: Array<string> };
}

// tslint:disable:max-line-length
/**
 * Details about which properties failed to validate in which way.
 *
 * The type is an object with property names as keys and then an array with validation
 * names of the validations that failed
 *
 * @type { Object.<string, Array<string>> }
 * @name errors
 * @memberof NohmErrors.ValidationError#
 */
// tslint:enable:max-line-length

/**
 * Error thrown whenever validation failed during {@link NohmModel#validate} or {@link NohmModel#save}.
 *
 * @class ValidationError
 * @memberof NohmErrors
 * @extends {Error}
 */
export class ValidationError<TProps extends IDictionary>
  extends Error
  implements IValidationError<TProps> {
  public readonly errors: IValidationError<TProps>['errors'];
  public readonly modelName: string;

  constructor(
    errors: IValidationError<TProps>['errors'],
    modelName: string,
    errorMessage: string = 'Validation failed. See .errors on this Error or the Nohm model instance for details.',
  ) {
    super(errorMessage);
    const emptyErrors: IValidationError<TProps>['errors'] = {};
    this.modelName = modelName;
    const keys: Array<keyof TProps> = Object.keys(errors);
    this.errors = keys.reduce<IValidationError<TProps>['errors']>(
      (obj, key) => {
        const error = errors[key];
        if (error && error.length > 0) {
          obj[key] = error;
        }
        return obj;
      },
      emptyErrors,
    );
  }
}
