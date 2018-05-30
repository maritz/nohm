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
    Object.hasOwnProperty.call(obj1, 'modelName') &&
    Object.hasOwnProperty.call(obj2, 'modelName') &&
    obj1.modelName === obj2.modelName
  ) {
    // both must have the same id.
    if (obj1.id && obj2.id && obj1.id === obj2.id) {
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
