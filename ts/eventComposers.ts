import { NohmModel, IDictionary } from './model';
import { IPropertyDiff } from './model.header';

// The default (base) message creator
export function defaultComposer(this: NohmModel) {
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
function changeComposer(this: NohmModel, diff: Array<void | IPropertyDiff<IDictionary>>) {
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


function relationComposer(this: NohmModel, parent: NohmModel, relationName: string) {
  const result: any = {};
  result.child = defaultComposer.call(this).target;
  result.parent = defaultComposer.call(parent).target;
  result.relation = relationName;
  return result;
}


export { relationComposer as link, relationComposer as unlink };
