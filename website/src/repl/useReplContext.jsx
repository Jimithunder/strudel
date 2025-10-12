/*
Repl.jsx - <short description TODO>
Copyright (C) 2022 Strudel contributors - see <https://codeberg.org/uzu/strudel/src/branch/main/repl/src/App.js>
This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details. You should have received a copy of the GNU Affero General Public License along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { code2hash, getPerformanceTimeSeconds, logger, silence } from '@strudel/core';
import { getDrawContext } from '@strudel/draw';
import { transpiler } from '@strudel/transpiler';
import {
  getAudioContextCurrentTime,
  webaudioOutput,
  resetGlobalEffects,
  resetLoadedSounds,
  initAudioOnFirstClick,
  resetDefaults,
} from '@strudel/webaudio';
import { setVersionDefaultsFrom } from './util.mjs';
import { StrudelMirror, defaultSettings } from '@strudel/codemirror';
import { clearHydra } from '@strudel/hydra';
import { useCallback, useEffect, useRef, useState } from 'react';
import { parseBoolean, settingsMap, useSettings } from '../settings.mjs';
import { 
  createCollaborationProvider, 
  generateRoomId, 
  getRoomIdFromUrl, 
  updateUrlWithRoomId,
  removeRoomIdFromUrl,
  getShareableUrl,
  setUserInfo 
} from '@strudel/collab/collab.mjs';
import {
  setActivePattern,
  setLatestCode,
  createPatternID,
  userPattern,
  getViewingPatternData,
  setViewingPatternData,
} from '../user_pattern_utils.mjs';
import { superdirtOutput } from '@strudel/osc/superdirtoutput';
import { audioEngineTargets } from '../settings.mjs';
import { useStore } from '@nanostores/react';
import { prebake } from './prebake.mjs';
import { getRandomTune, initCode, loadModules, shareCode } from './util.mjs';
import './Repl.css';
import { setInterval, clearInterval } from 'worker-timers';
import { getMetadata } from '../metadata_parser';

const { latestCode, maxPolyphony, audioDeviceName, multiChannelOrbits } = settingsMap.get();
let modulesLoading, presets, drawContext, clearCanvas, audioReady;

if (typeof window !== 'undefined') {
  audioReady = initAudioOnFirstClick({
    maxPolyphony,
    audioDeviceName,
    multiChannelOrbits: parseBoolean(multiChannelOrbits),
  });
  modulesLoading = loadModules();
  presets = prebake();
  drawContext = getDrawContext();
  clearCanvas = () => drawContext.clearRect(0, 0, drawContext.canvas.height, drawContext.canvas.width);
}

async function getModule(name) {
  if (!modulesLoading) {
    return;
  }
  const modules = await modulesLoading;
  return modules.find((m) => m.packageName === name);
}

const initialCode = `// LOADING`;

export function useReplContext() {
  const { isSyncEnabled, audioEngineTarget } = useSettings();
  const shouldUseWebaudio = audioEngineTarget !== audioEngineTargets.osc;
  const defaultOutput = shouldUseWebaudio ? webaudioOutput : superdirtOutput;
  const getTime = shouldUseWebaudio ? getAudioContextCurrentTime : getPerformanceTimeSeconds;

  const init = useCallback(() => {
    const drawTime = [-2, 2];
    const drawContext = getDrawContext();
    
    // Check if there's a room ID in the URL
    const urlRoomId = getRoomIdFromUrl();
    let collaboration = null;
    
    if (urlRoomId) {
      try {
        const serverUrl = 'ws://localhost:1234';
        const collab = createCollaborationProvider(urlRoomId, serverUrl);
        collaboration = collab;
        collabProviderRef.current = collab;
        setIsCollaborating(true);
        setRoomId(urlRoomId);
        
        // Set user info
        setUserInfo(collab.awareness, {
          name: `User ${Math.floor(Math.random() * 1000)}`,
        });
        
        // Track connected users
        collab.awareness.on('change', () => {
          setConnectedUsers(collab.awareness.getStates().size);
        });
        
        logger(`🤝 Joined collaboration room: ${urlRoomId}`, 'highlight');
      } catch (err) {
        console.error('Failed to initialize collaboration:', err);
        logger(`⚠️ Could not connect to collaboration server. Make sure it's running!`, 'warning');
      }
    }
    
    const editor = new StrudelMirror({
      sync: isSyncEnabled,
      defaultOutput,
      getTime,
      setInterval,
      clearInterval,
      transpiler,
      autodraw: false,
      root: containerRef.current,
      initialCode,
      pattern: silence,
      drawTime,
      drawContext,
      collaboration,
      prebake: async () => Promise.all([modulesLoading, presets]),
      onUpdateState: (state) => {
        setReplState({ ...state });
      },
      onToggle: (playing) => {
        if (!playing) {
          clearHydra();
        }
      },
      beforeEval: () => audioReady,
      afterEval: (all) => {
        const { code } = all;
        //post to iframe parent (like Udels) if it exists...
        window.parent?.postMessage(code);

        setLatestCode(code);
        window.location.hash = '#' + code2hash(code);
        setDocumentTitle(code);
        const viewingPatternData = getViewingPatternData();
        setVersionDefaultsFrom(code);
        const data = { ...viewingPatternData, code };
        let id = data.id;
        const isExamplePattern = viewingPatternData.collection !== userPattern.collection;

        if (isExamplePattern) {
          const codeHasChanged = code !== viewingPatternData.code;
          if (codeHasChanged) {
            // fork example
            const newPattern = userPattern.duplicate(data);
            id = newPattern.id;
            setViewingPatternData(newPattern.data);
          }
        } else {
          id = userPattern.isValidID(id) ? id : createPatternID();
          setViewingPatternData(userPattern.update(id, data).data);
        }
        setActivePattern(id);
      },
      bgFill: false,
    });
    window.strudelMirror = editor;

    // init settings
    initCode().then(async (decoded) => {
      let code, msg;
      if (decoded) {
        code = decoded;
        msg = `I have loaded the code from the URL.`;
      } else if (latestCode) {
        code = latestCode;
        msg = `Your last session has been loaded!`;
      } else {
        /* const { code: randomTune, name } = await getRandomTune();
        code = randomTune; */
        code = '$: s("[bd <hh oh>]*2").bank("tr909").dec(.4)';
        msg = `Default code has been loaded`;
      }
      
      // Only set code if not in collaboration mode (Yjs will sync it)
      if (!collaboration) {
        editor.setCode(code);
      }
      setDocumentTitle(code);
      logger(`Welcome to Strudel! ${msg} Press play or hit ctrl+enter to run it!`, 'highlight');
    });

    editorRef.current = editor;
  }, []);

  const [replState, setReplState] = useState({});
  const { started, isDirty, error, activeCode, pending } = replState;
  const editorRef = useRef();
  const containerRef = useRef();
  
  // Collaboration state
  const [isCollaborating, setIsCollaborating] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [connectedUsers, setConnectedUsers] = useState(0);
  const collabProviderRef = useRef(null);

  // this can be simplified once SettingsTab has been refactored to change codemirrorSettings directly!
  // this will be the case when the main repl is being replaced
  const _settings = useStore(settingsMap, { keys: Object.keys(defaultSettings) });
  useEffect(() => {
    let editorSettings = {};
    Object.keys(defaultSettings).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(_settings, key)) {
        editorSettings[key] = _settings[key];
      }
    });
    editorRef.current?.updateSettings(editorSettings);
  }, [_settings]);

  //
  // UI Actions
  //

  const setDocumentTitle = (code) => {
    const meta = getMetadata(code);
    document.title = (meta.title ? `${meta.title} - ` : '') + 'Strudel REPL';
  };

  const handleTogglePlay = async () => {
    editorRef.current?.toggle();
  };

  const resetEditor = async () => {
    (await getModule('@strudel/tonal'))?.resetVoicings();
    resetDefaults();
    resetGlobalEffects();
    clearCanvas();
    clearHydra();
    resetLoadedSounds();
    editorRef.current.repl.setCps(0.5);
    await prebake(); // declare default samples
  };

  const handleUpdate = async (patternData, reset = false) => {
    setViewingPatternData(patternData);
    editorRef.current.setCode(patternData.code);
    if (reset) {
      await resetEditor();
      handleEvaluate();
    }
  };

  const handleEvaluate = () => {
    editorRef.current.evaluate();
  };
  const handleShuffle = async () => {
    const patternData = await getRandomTune();
    const code = patternData.code;
    logger(`[repl] ✨ loading random tune "${patternData.id}"`);
    setActivePattern(patternData.id);
    setViewingPatternData(patternData);
    await resetEditor();
    editorRef.current.setCode(code);
    editorRef.current.repl.evaluate(code);
  };

  const handleShare = async () => shareCode(replState.code);
  
  // Collaboration handlers
  const handleStartCollaboration = () => {
    const newRoomId = generateRoomId();
    updateUrlWithRoomId(newRoomId);
    // Reload to reinitialize with collaboration
    window.location.reload();
  };
  
  const handleStopCollaboration = () => {
    if (collabProviderRef.current) {
      collabProviderRef.current.provider.destroy();
      collabProviderRef.current = null;
    }
    setIsCollaborating(false);
    setRoomId(null);
    setConnectedUsers(0);
    removeRoomIdFromUrl();
    logger('👋 Left collaboration room', 'highlight');
  };
  
  const shareableUrl = roomId ? getShareableUrl(roomId) : '';
  
  const context = {
    started,
    pending,
    isDirty,
    activeCode,
    handleTogglePlay,
    handleUpdate,
    handleShuffle,
    handleShare,
    handleEvaluate,
    init,
    error,
    editorRef,
    containerRef,
    // Collaboration
    isCollaborating,
    roomId,
    connectedUsers,
    shareableUrl,
    handleStartCollaboration,
    handleStopCollaboration,
  };
  return context;
}
