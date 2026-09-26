import { registerRootComponent } from 'expo';

import App from './App';
import { migrateLegacyStorage } from './src/utils/storageMigration';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
//
// La migracion de claves (@vendelo/* -> @vendelo/*) se resuelve antes de montar
// la app para que ningun proveedor lea claves viejas o una base renombrada a medias.
migrateLegacyStorage()
  .catch(() => {
    // La migracion es de mejor esfuerzo: un fallo no debe impedir arrancar.
  })
  .finally(() => registerRootComponent(App));
