import { ILinkSaveResult } from '../model.header';

export interface ILinkError<TProps> extends Error {
  errors: Array<ILinkSaveResult<TProps>>;
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
export class LinkError<TProps> extends Error implements ILinkError<TProps> {
  constructor(
    public errors: Array<ILinkSaveResult<TProps>>,
    errorMessage = 'Linking failed. See .errors on this Error object for an Array of failures.',
  ) {
    super(errorMessage);
  }
}
