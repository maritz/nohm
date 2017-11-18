import { ILinkSaveResult } from '../model.d';

export interface ILinkError extends Error {
  errors: Array<ILinkSaveResult>;
}

export class LinkError extends Error implements ILinkError {
  constructor(
    public errors: Array<ILinkSaveResult>,
    errorMessage = 'Linking failed. See .errors on this Error object for an Array of failures.',
  ) {
    super(errorMessage);
  }
}
