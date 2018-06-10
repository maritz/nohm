import { ILinkSaveResult } from '../model.header';

export interface ILinkError extends Error {
  errors: Array<ILinkSaveResult>;
}

// tslint:disable:max-line-length
/**
 * Details about which part of linking failed.
 *
 * @type { Array.<{ success: boolean, child: NohmModel, parent: NohmModel, error: null | Error | LinkError | ValidationError}> }
 * @name errors
 * @memberof NohmErrors.LinkError#
 */
// tslint:enable:max-line-length

/**
 * Error thrown whenever linking failed during {@link NohmModel#save}.
 *
 * @class LinkError
 * @memberof NohmErrors
 * @extends {Error}
 */
export class LinkError extends Error implements ILinkError {
  constructor(
    public errors: Array<ILinkSaveResult>,
    errorMessage = 'Linking failed. See .errors on this Error object for an Array of failures.',
  ) {
    super(errorMessage);
  }
}
