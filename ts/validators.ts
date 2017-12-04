import { validatiorFunction } from './model.header';
import * as path from 'path';

export const universalValidatorPath = path.join(__dirname, '..', 'ts', 'universalValidators.js');
// tslint:disable-next-line:no-var-requires
const newRawValidators = require(universalValidatorPath);


/**
 * @namespace Validators
 */
export const validators: {
  [index: string]: validatiorFunction;
} = newRawValidators.validators;

exports.regexps = newRawValidators.regexps;

