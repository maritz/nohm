export interface INohmPrefixes {
  channel: string;
  hash: string;
  incrementalIds: string;
  idsets: string;
  index: string;
  meta: {
    version: string;
    idGenerator: string;
    properties: string;
  };
  relationKeys: string;
  relations: string;
  scoredindex: string;
  unique: string;
}

export function getPrefix(prefix: string): INohmPrefixes {
  return {
    channel: prefix + ':channel:',
    hash: prefix + ':hash:',
    idsets: prefix + ':idsets:',
    incrementalIds: prefix + ':ids:',
    index: prefix + ':index:',
    meta: {
      idGenerator: prefix + ':meta:idGenerator:',
      properties: prefix + ':meta:properties:',
      version: prefix + ':meta:version:',
    },
    relationKeys: prefix + ':relationKeys:',
    relations: prefix + ':relations:',
    scoredindex: prefix + ':scoredindex:',
    unique: prefix + ':uniques:',
  };
}

export function checkEqual(obj1: any, obj2: any): boolean {
  if (!obj1 || (obj1 && !obj2)) {
    return false;
  }
  if (obj1 === obj2) {
    return true;
  } else if (
    obj1.hasOwnProperty('modelName') &&
    obj2.hasOwnProperty('modelName') &&
    obj1.modelName === obj2.modelName
  ) {
    // if both have been saved, both must have the same id.
    if (obj1.id && obj2.id && obj1.id === obj2.id) {
      return true;
    } else if (obj1.id && obj2.id) {
      // both have been saved but do not share the same id -> must be different.
      return false;
    }

    // if both have exactly the same properties (and at most one has been saved - see above)
    if (obj1.allProperties(true) === obj2.allProperties(true)) {
      return true;
    }
  }
  return false;
}

export function callbackError(...args: Array<any>) {
  if (args.length > 0) {
    const lastArgument = args[args.length - 1];
    if (typeof lastArgument === 'function') {
      throw new Error(
        'Callback style has been removed. Use the returned promise.',
      );
    }
  }
}
