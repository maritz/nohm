import { NohmModel } from './model';
import {
  IChangeEventPayload,
  IDefaultEventPayload,
  IPropertyDiff,
  IRelationChangeEventPayload,
  IDictionary,
} from './model.header';

// The default (base) message creator
export function defaultComposer<TProps>(
  this: NohmModel<TProps>,
): IDefaultEventPayload<TProps> {
  return {
    target: {
      id: this.id,
      modelName: this.modelName,
      properties: this.allProperties(),
    },
  };
}

export { defaultComposer as create };

// This populates the diff property for `save` and `update` events.
function changeComposer<TProps>(
  this: NohmModel<TProps>,
  diff: Array<void | IPropertyDiff<keyof TProps>>,
): IChangeEventPayload<TProps> {
  const result = defaultComposer.apply(this);
  result.target.diff = diff;
  return result;
}

export { changeComposer as update, changeComposer as save };

// This sets the id and properties
export function remove(this: NohmModel, id: string) {
  const result = defaultComposer.apply(this);
  result.target.id = id;
  return result;
}

function relationComposer<TProps, TParentProps>(
  this: NohmModel<TProps>,
  parent: NohmModel<TParentProps>,
  relationName: string,
): IRelationChangeEventPayload<TProps> {
  const childPayload: IDefaultEventPayload<TProps> = defaultComposer.call(this);
  const parentPayload: IDefaultEventPayload<IDictionary> = defaultComposer.call(
    parent,
  );
  return {
    child: childPayload.target,
    parent: parentPayload.target,
    relation: relationName,
  };
}

export { relationComposer as link, relationComposer as unlink };
