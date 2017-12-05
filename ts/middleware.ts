import * as fs from 'fs';

import { NohmClass, nohm as instantiatedNohm } from './index';
import { NohmModel } from './model';

// tslint:disable-next-line:no-implicit-dependencies # we don't actually use express, just the typing
import { RequestHandler as TRequestHandler } from 'express';
import { universalValidatorPath } from './validators';

export { TRequestHandler };

export interface IExclusionsOption {
  [key: string]: Array<number | boolean> | boolean;
}

export interface IMiddlewareOptions {
  url?: string;
  namespace?: string;
  maxAge?: number;
  exclusions?: {
    [key: string]: IExclusionsOption | boolean,
  };
  extraFiles?: string | Array<string>;
  uglify?: any;
}

const MAX_DEPTH = 5;

function customToString(obj: any, depth: number = 0): string {
  if (depth > MAX_DEPTH) {
    console.warn((new Error('nohm: middleware customToString() maxdepth exceeded')).stack);
    return '';
  }
  switch (typeof (obj)) {
    case 'string':
      return '"' + obj + '"';
    case 'number':
      return obj.toString();
    case 'boolean':
      return obj ? 'true' : 'false';
    case 'function':
      if (obj instanceof RegExp) {
        return obj.toString();
      }
      break;
    case 'object':
      if (Array.isArray(obj)) {
        const arr: Array<string> = [];
        obj.forEach((val) => {
          arr.push(customToString(val, depth + 1));
        });
        return '[' + arr.join(',') + ']';
      } else if (obj instanceof RegExp) {
        return obj.toString();
      } else {
        const arr: Array<string> = [];
        Object.keys(obj).forEach((val) => {
          arr.push('"' + val + '":' + customToString(obj[val], depth + 1));
        });
        return '{' + arr.join(',') + '}';
      }
    default:
      return '';
  }
  return '';
}

function validationsFlatten(
  model: new (...args: Array<any>) => NohmModel,
  exclusions: IExclusionsOption = {},
): string {
  const instance = new model();
  const definitions = instance.getDefinitions();
  let str = instance.modelName + ': {';

  /*
   * example exclusions object
   *  {
   *    // this will ignore the first validation in the validation definition array for name in the model definition
   *    name: [0],
   *    // this will completely ignore all validations for the salt property
   *    salt: true
   *  },
   */

  const exclusionsStrings: Array<string> = [];
  const exclusionsObject: { [key: string]: Array<boolean> } = {};
  Object.keys(exclusions).forEach((key) => {
    const value = exclusions[key];
    if (Array.isArray(value)) {
      exclusionsObject[key] = value.map((x) => !!x);
    }
    exclusionsStrings.push(key);
  });

  Object.keys(definitions).forEach((key) => {
    const isExcepted = exclusionsStrings.indexOf(key) !== -1 && !exclusionsObject.hasOwnProperty(key);
    if (!isExcepted) {
      const vals = definitions[key].validations;
      if (Array.isArray(vals) && vals.length > 0) {
        str += `${key}: [`;
        const strVals: Array<string> = [];
        vals.forEach((val, index) => {
          if (!exclusionsObject[key] || exclusionsObject[key][index]) {
            strVals.push(customToString(val));
          }
        });
        str += strVals.join(',') + '],           ';
      }
    }
  });
  return str + '}';
}

let extraFilesIndex = 0;

function wrapFile(fileStr: string, namespace: string) {
  let str = `${namespace}.extraValidations[${extraFilesIndex}]={};(function (exports) {`;
  str += fileStr;
  str += `})(${namespace}.extraValidations[${extraFilesIndex}]);`;
  extraFilesIndex++;
  return str;
}

function wrapExtraFiles(files: Array<string>, namespace: string) {
  let str = '';
  files.forEach((path) => {
    const fileStr = fs.readFileSync(path, 'utf-8');
    str += wrapFile(fileStr, namespace);
  });
  return str;
}

/**
 * Returns a middleware that can deliver the validations as a javascript file
 * and the modelspecific validations as a JSON object to the browser.
 * This is useful if you want to save some bandwith by doing the validations
 * in the browser before saving to the server.
 *
 * Options:
 *    - `url`         - Url under which the js file will be available. Default: '/nohmValidations.js'
 *    - `exclusions`  - Object containing exclusions for the validations export - see example for details
 *    - `namespace`   - Namespace to be used by the js file in the browser. Default: 'nohmValidations'
 *    - `extraFiles`  - Extra files containing validations. You should only use this if they are not already set
 *                        via Nohm.setExtraValidations as this automatically includes those.
 *    - `maxAge`      - Cache control (in seconds)
 *    - `uglify`      - Boolean. True to enable minification. Requires uglify-js (not in dependencies of nohm!).
 *                       Default: false
 *
 * Example:
 *
 *    server.use(nohm.middleware(
 *      // options object
 *      {
 *        url: '/nohm.js',
 *        namespace: 'nohm',
 *        exclusions: {
 *
 *          User: { // modelName
 *
 *            // this will ignore the second validation in the validation definition array for
 *            // the property 'name' in the model definition
 *            name: [false, true],
 *
 *            // this will completely ignore all validations for the salt property
 *            salt: true
 *          },
 *
 *          Privileges: true // this will completely ignore the Priviledges model
 *        }
 *      }
 *    ));
 *
 * @param {Object} options Options for the middleware
 * @return {Function}
 * @static
 */

export function middleware(
  options: IMiddlewareOptions,
  nohm: NohmClass = instantiatedNohm,
): TRequestHandler {
  options = options || {};
  const url = options.url || '/nohmValidations.js';
  const namespace = options.namespace || 'nohmValidations';
  const maxAge = options.maxAge || 3600; // 1 hour
  const exclusions = options.exclusions || {};
  let extraFiles = options.extraFiles || [];
  let uglify = options.uglify || false;
  if (!Array.isArray(extraFiles)) {
    extraFiles = [extraFiles];
  }

  // collect models
  const arr: Array<string> = [];
  const models = nohm.getModels();
  Object.keys(models).forEach((name) => {
    const model = models[name];
    let exclusion = exclusions[name];
    if (exclusion === true) {
      return; // exception set, but no fields
    } else {
      if (exclusion === true || exclusion === false) {
        exclusion = {};
      }
      arr.push(validationsFlatten(model, exclusion));
    }
  });

  let str = `var nohmValidationsNamespaceName = "${namespace}";
var ${namespace}={"extraValidations": [], "models":{${arr.join(',')}}};
// extrafiles
${wrapExtraFiles(extraFiles, namespace)}
// extravalidations
${wrapExtraFiles(nohm.getExtraValidatorFileNames(), namespace)/* needs to somehow access the same thing */}
// validators.js
${ fs.readFileSync(universalValidatorPath, 'utf-8')}`;


  if (uglify) {
    try {
      // tslint:disable-next-line:no-implicit-dependencies
      uglify = require('uglify-js');
    } catch (e) {
      console.warn('You tried to use the uglify option in Nohm.connect but uglify-js is not requirable.',
        'Continuing without uglify.', e);
    }
    if (uglify.parser && uglify.uglify) {
      const jsp = uglify.parser;
      const pro = uglify.uglify;

      const ast = jsp.parse(str);
      // ast = pro.ast_mangle(ast); // TODO: test if this works with our globals
      const squeezed = pro.ast_squeeze(ast);
      str = pro.gen_code(squeezed);
    }
  }

  return (req, res, next) => {
    if (req.url === url) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/javascript');
      res.setHeader('Content-Length', str.length.toString());
      res.setHeader('Cache-Control', 'public, max-age=' + maxAge);
      res.end(str);
    } else {
      next();
    }
  };
}
