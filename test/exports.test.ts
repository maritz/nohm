import test from 'ava';

import * as NohmAll from '../ts';

// tslint:disable-next-line:no-duplicate-imports
import NohmDefault, {
  Nohm,
  NohmClass,
  NohmModel,
  LinkError,
  ValidationError,
  nohm,
} from '../ts';

test('exports the correct objects', (t) => {
  t.snapshot(NohmAll);
  t.snapshot(NohmDefault);
  t.snapshot(Nohm);
  t.is('function', typeof NohmClass);
  t.is('function', typeof NohmModel);
  t.is('function', typeof LinkError);
  t.is('function', typeof ValidationError);
  t.snapshot(nohm);
});
