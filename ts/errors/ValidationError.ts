import { IDictionary } from '../model.header';

export interface IValidationError extends Error {
  errors: {
    [key: string]: Array<string>;
  };
}

export class ValidationError<TProps extends IDictionary> extends Error implements IValidationError {

  constructor(
    public errors: {
      [key in keyof TProps]: Array<string>;
    },
    errorMessage: string = 'Validation failed. See .errors on this Error or the Nohm model instance for details.',
  ) {
    super(errorMessage);
  }
}
