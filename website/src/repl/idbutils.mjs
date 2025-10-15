import { registerSampleSource } from '@strudel/webaudio';
import { isAudioFile } from './files.mjs';
import { logger } from '@strudel/core';

//utilites for writing and reading to the indexdb

export const userSamplesDBConfig = {
  dbName: 'samples',
  table: 'usersamples',
  columns: ['blob', 'title'],
  version: 1,
};

// deletes all of the databases, useful for debugging
function clearAllIDB() {
  window.indexedDB
    .databases()
    .then((r) => {
      for (var i = 0; i < r.length; i++) clearIDB(r[i].name);
    })
    .then(() => {
      alert('All data cleared.');
    });
}

export function clearIDB(dbName) {
  return window.indexedDB.deleteDatabase(dbName);
}

// queries the DB, and registers the sounds so they can be played
export function registerSamplesFromDB(config = userSamplesDBConfig, onComplete = () => {}) {
  openDB(config, (objectStore) => {
    const query = objectStore.getAll();
    query.onerror = (e) => {
      logger('User Samples failed to load ', 'error');
      onComplete();
      console.error(e?.target?.error);
    };

    query.onsuccess = (event) => {
      const soundFiles = event.target.result;
      if (!soundFiles?.length) {
        return;
      }
      const sounds = new Map();

      Promise.all(
        [...soundFiles]
          .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }))
          .map((soundFile, i) => {
            const title = soundFile.title;
            if (!isAudioFile(title)) {
              return;
            }
            const splitRelativePath = soundFile.id.split('/');
            let parentDirectory =
              //fallback to file name before period and seperator if no parent directory
              splitRelativePath[splitRelativePath.length - 2] ?? soundFile.id.split(/\W+/)[0] ?? 'user';
            const blob = soundFile.blob;

            return blobToDataUrl(blob).then((soundPath) => {
              const titlePathMap = sounds.get(parentDirectory) ?? new Map();

              titlePathMap.set(title, soundPath);

              sounds.set(parentDirectory, titlePathMap);
              return;
            });
          }),
      )
        .then(() => {
          sounds.forEach((titlePathMap, key) => {
            const value = Array.from(titlePathMap.keys())
              .sort((a, b) => {
                return a.localeCompare(b);
              })
              .map((title) => titlePathMap.get(title));

            registerSampleSource(key, value, { prebake: false });
          });

          logger('imported sounds registered!', 'success');
          onComplete();
        })
        .catch((error) => {
          logger('Something went wrong while registering saved samples from the index db', 'error');
          console.error(error);
        });
    };
  });
}

async function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    var reader = new FileReader();
    reader.onload = function (event) {
      resolve(event.target.result);
    };
    reader.readAsDataURL(blob);
  });
}

//open db and initialize it if necessary
function openDB(config, onOpened) {
  const { dbName, version, table, columns } = config;
  if (typeof window === 'undefined') {
    return;
  }
  if (!('indexedDB' in window)) {
    console.log('IndexedDB is not supported.');
    return;
  }
  const dbOpen = indexedDB.open(dbName, version);

  dbOpen.onupgradeneeded = (_event) => {
    const db = dbOpen.result;
    const objectStore = db.createObjectStore(table, { keyPath: 'id', autoIncrement: false });
    columns.forEach((c) => {
      objectStore.createIndex(c, c, { unique: false });
    });
  };
  dbOpen.onerror = (err) => {
    logger('Something went wrong while trying to open the the client DB', 'error');
    console.error(`indexedDB error: ${err.errorCode}`);
  };

  dbOpen.onsuccess = () => {
    const db = dbOpen.result;
    // lock store for writing
    const writeTransaction = db.transaction([table], 'readwrite');
    // get object store
    const objectStore = writeTransaction.objectStore(table);
    onOpened(objectStore, db);
  };
  return dbOpen;
}

async function processFilesForIDB(files) {
  return Promise.all(
    Array.from(files)
      .map((s) => {
        const title = s.name;

        if (!isAudioFile(title)) {
          return;
        }
        //create obscured url to file system that can be fetched
        const sUrl = URL.createObjectURL(s);
        //fetch the sound and turn it into a buffer array
        return fetch(sUrl).then((res) => {
          return res.blob().then((blob) => {
            const path = s.webkitRelativePath;
            let id = path?.length ? path : title;
            if (id == null || title == null || blob == null) {
              return;
            }
            return {
              title,
              blob,
              id,
            };
          });
        });
      })
      .filter(Boolean),
  ).catch((error) => {
    logger('Something went wrong while processing uploaded files', 'error');
    console.error(error);
  });
}

export async function uploadSamplesToDB(config, files) {
  logger('procesing user samples...');
  await processFilesForIDB(files).then((files) => {
    logger('user samples processed... opening db');
    const onOpened = (objectStore, _db) => {
      logger('index db opened... writing files to db');
      files.forEach((file) => {
        if (file == null) {
          return;
        }
        objectStore.put(file);
      });
      logger('user samples written successfully');
    };
    openDB(config, onOpened);
  });
}

/*========== Local File Syncing Utilities ==========*/

/**
 * Configuration settings for the indexedDb
 * responsible for patternSyncHandlers
 */
export const patternSyncHandlerDBConfig = {
  dbName: 'strudel-sync',
  table: 'patterns',
  columns: ['patternId', 'name', 'mime', 'lastModified', 'handle'],
  version: 1,
};

/**
 * **Saves the pattern sync**
 *
 * @description saves a handle in the idb for persisting file updates
 * @param config The patternSyncDBConfig used by the SyncPatternButton
 * @param {string} patternId The string ID of the pattern
 */
export async function savePatternSyncHandlerToDB(config = patternSyncHandlerDBConfig, rec) {
  const { patternId, name, mime, lastModified, handle } = rec;
  const id = String(patternId || '').trim();
  if (!id) throw new Error('savePatternSyncToDB: patternId is required');

  const onOpened = (objectStore) => {
    objectStore.put({
      id,
      patternId: id,
      name: name ?? '',
      mime: mime ?? 'text/plain',
      lastModified: Number(lastModified ?? Date.now()),
      handle: handle ?? null,
    });
  };
  openDB(config, onOpened);
}

/**
 * **Loads the pattern sync**
 *
 * @requires showOpenFilePicker compatibility
 * @description loads a saved handle in the idb for persisting file updates
 * @param config The patternSyncDBConfig used by the SyncPatternButton
 * @param {string} patternId The string ID of the pattern
 */
export async function loadPatternSyncHandlerFromDB(config = patternSyncHandlerDBConfig, patternId) {
  // Wrap return in a promise for async evaluation
  return new Promise((resolve, reject) => {
    // open the objectStore
    openDB(config, (objectStore) => {
      // try and get the patternSyncHandler from the object store
      const req = objectStore.get(patternId);

      // reject if there are errors
      req.onerror = (e) => reject(e?.target?.error);

      // try load the pattern if successful
      req.onsuccess = async (ev) => {
        // ensure there is a valid target
        const rec = ev.target.result;
        if (!rec) return resolve(null);

        // If handle exists and ensure handle is writable
        try {
          if (rec.handle?.queryPermission) {
            const s = await rec.handle.queryPermission({ mode: 'readwrite' });
            if (s !== 'granted') {
              const r = await rec.handle.requestPermission({ mode: 'readwrite' });
              if (r !== 'granted') return resolve(null);
            }
          }
        } catch {
          console.error('This feature is not available in non-chromium browsers');
          reject(ev?.target?.error);
          /* non-Chromium or sandbox will be unable to use this feature */
        }
        resolve(rec);
      };
    });
  });
}

/**
 * **Clears the pattern sync**
 *
 * @description removes the sync between local file and given pattern
 * @param config The patternSyncDBConfig used by the SyncPatternButton
 * @param {string} patternId The string ID of the pattern
 */
export async function clearPatternSyncHandler(config = patternSyncHandlerDBConfig, patternId) {
  // check if the pattern id is valud
  const id = String(patternId || '').trim();
  if (!id) return;

  // delete patternSyncHandler from the database
  openDB(config, (objectStore) => objectStore.delete(id));
}

/**
 * **Check if pattern is synced**
 *
 * @description Checks to see if sync handle exists for current pattern
 * @note used to drive the sync vs unsync logic on the SyncPatternButton
 * @param config The patternSyncDBConfig used by the SyncPatternButton
 * @param {string} patternId The string ID of the pattern
 * @returns promise which can be used to successfully evaluate if patternSync exists
 */
export async function hasPatternSyncHandler(config = patternSyncHandlerDBConfig, patternId) {
  // Wrap return in a promise for async evaluation
  return new Promise((resolve) => {
    const id = String(patternId || '').trim();
    if (!id) return resolve(false);
    // open the objectStore
    openDB(config, (objectStore) => {
      // try and get the pattern from the object store
      const req = objectStore.get(id);

      // gracefully handle errors and return false in promise
      req.onerror = (e) => {
        console.warn('hasPatternSyncHandler error:', e.target.error);
        resolve(false);
      };

      // return successful result in the promise
      req.onsuccess = (e) => {
        resolve(!!e.target.result);
      };
    });
  });
}

/**
 * Writes the synced pattern to the synced file (if supported)
 *
 * @note showOpenFilePicker browser compatibility required
 * @notes writable file handles are currently only available on Chromium browsers
 * @link https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker
 * @param config The patternSyncDBConfig used by the SyncPatternButton
 * @param {string} patternId The string ID of the pattern
 * @param content The code to write to file
 */
export async function writeSyncedPattern(config = patternSyncHandlerDBConfig, patternId, content) {
  // Get the patternSyncHandler
  const rec = await loadPatternSyncHandlerFromDB(config, patternId);
  // Check to see if the handler is writable
  if (!rec?.handle?.createWritable) {
    console.error(
      'No writable handle stored for this pattern.\nThis is most likely caused by an unsupported browser.\nSee https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker for details.',
    );
    //Return after error to ensure wider error is not thrown.
    return;
  }
  // write the code from the pattern to the syncedFile
  const w = await rec.handle.createWritable();
  await w.write(content);
  await w.close();
}
