import { ILinkSaveResult } from '../model.d';

export interface ILinkError extends Error {
  errors: Array<ILinkSaveResult>;
}

export class LinkError extends Error implements ILinkError {
  constructor(errorMessage: string, public errors: Array<ILinkSaveResult>) {
    super(errorMessage);
  }
}
