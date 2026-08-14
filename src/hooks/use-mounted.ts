import * as React from 'react';

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

// Reads as "true" only once client rendering has taken over, without the
// setState-in-effect pattern this repo's lint config forbids.
export function useMounted() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
