import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  savePatternSyncHandlerToDB,
  patternSyncHandlerDBConfig,
  hasPatternSyncHandler,
  clearPatternSyncHandler,
  writeSyncedPattern,
} from '../../idbutils.mjs';

export default function SyncPatternButton({ pattern }) {
  /**
   * Evaluate whether the browser supports sync functionality
   * and render the component `null` if unsupported.
   */
  const supportsSync = useMemo(() => {
    if (!window.isSecureContext) return false;
    if ('showOpenFilePicker' in window) return true;
    return false;
  }, []);
  if (!supportsSync) return null;

  const [buttonMsg, setButtonMsg] = useState('Sync');
  const [changeDetected, setChangeDetected] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [lastPattern, setLastPattern] = useState(pattern);

  /**
   * Pick file using showOpenFilePicker
   *
   * @requires showOpenFilePicker compatibility
   */
  const pickFile = useCallback(async () => {
    //Get the showOpenFilePicker handle
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      excludeAcceptAllOption: false,
      types: [{ description: 'Strudel Files', accept: { 'text/plain': ['.strudel', '.std', '.str'] } }],
    });

    // request read/write upfront
    const perm = await handle.queryPermission?.({ mode: 'readwrite' });
    if (perm !== 'granted') {
      const res = await handle.requestPermission?.({ mode: 'readwrite' });
      if (res !== 'granted') throw new Error('Read/write permission denied for selected file.');
    }

    // get the file from the file picker
    const file = await handle.getFile();

    // save the pattern sync settings to the idb
    await savePatternSyncHandlerToDB(patternSyncHandlerDBConfig, {
      patternId: pattern.id,
      name: file.name,
      mime: file.type || 'text/plain',
      lastModified: file.lastModified,
      handle,
    });
  }, [pattern.id]);

  /**
   * unlinks the current pattern from patternSyncHandler
   */
  const onUnlink = async () => {
    await clearPatternSyncHandler(patternSyncHandlerDBConfig, pattern.id);
    setIsSynced(false);
  };

  /**
   * Handles onLink request
   *
   * @description triggers a showOpenFilePicker to establish a patternSyncHandler
   * @requires showOpenFilePicker compatibility
   */
  const onLink = useCallback(async () => {
    try {
      setIsLinking(true);
      // check showOpenFilePicker compatibility
      if ('showOpenFilePicker' in window) {
        // pick the file from the system and establish patternSyncHandler
        await pickFile();
        setIsSynced(true);
      } else {
        // this should do nothing as it should only be available on compatible browsers
        return;
      }
    } catch (err) {
      // fail with a console error so the user has feedback
      console.warn(err);
    } finally {
      // ensure the flags are set
      setIsLinking(false);
    }
  }, [pickFile]);

  /**
   * Controls the message displayed on the button
   */
  useEffect(() => {
    if (isLinking) {
      setButtonMsg('Linking...');
    } else if (changeDetected) {
      setButtonMsg('Unsaved');
    } else if (isSynced) {
      setButtonMsg('Unsync');
    } else {
      setButtonMsg('Sync');
    }
  }, [isLinking, isSynced, changeDetected]);

  /**
   * Detect changes in the code, which need syncing
   * save the current changes and set flags
   */
  useEffect(() => {
    // failsafe, ensure this only executes when code changes
    if (pattern.code !== lastPattern.code) {
      setLastPattern(pattern);
      setChangeDetected(true);
      return;
    }
    setChangeDetected(false);
  }, [pattern.code]);

  /**
   * writes the synced pattern when ever changeDetected flag becomes true
   */
  useEffect(() => {
    if (changeDetected) {
      writeSyncedPattern(patternSyncHandlerDBConfig, pattern.id, pattern.code);
      setChangeDetected(false);
    }
  }, [changeDetected]);

  /**
   * control the isSynced flag
   */
  useEffect(() => {
    hasPatternSyncHandler(patternSyncHandlerDBConfig, pattern.id).then(setIsSynced);
  }, [pattern.id]);

  return (
    <div>
      <button
        className="bg-slate-500 px-2 hover:opacity-80 cursor-pointer"
        disabled={isLinking}
        onClick={isSynced ? onUnlink : onLink}
        title="Link this pattern to a local file for sync"
      >
        {buttonMsg}
      </button>
    </div>
  );
}
