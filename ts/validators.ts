import { validatiorFunction } from './model.d';

// tslint:disable-next-line:no-var-requires
const newRawValidators = require(__dirname + '/newValidators.js');

/**
 * @namespace Validators
 */
export const validators: {
  [index: string]: validatiorFunction;
} = newRawValidators.validators;

exports.regexps = newRawValidators.regexps;

