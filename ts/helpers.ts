
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
