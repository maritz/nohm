import * as path from 'path';

import { validatorFunction } from './model.header';

export const universalValidatorPath = path.join(
  __dirname,
  '..',
  'ts',
  'universalValidators.js',
);
// tslint:disable-next-line:no-var-requires
const newRawValidators = require(universalValidatorPath);

/**
 * @namespace Validators
 */
export const validators: {
  [index: string]: validatorFunction;
} = newRawValidators.validators;

exports.regexps = newRawValidators.regexps;
