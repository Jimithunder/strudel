/*
 * Pattern Converter
 * Converts MIDI track data into Strudel pattern code strings
 * Implements multiple conversion strategies based on track complexity
 */

/**
 * Convert MIDI note number to note name
 * @param {number} midiNote - MIDI note number (0-127)
 * @returns {string} Note name (e.g., "c4", "cs5")
 * @example
 * noteNumberToName(60); // "c4" (middle C)
 * noteNumberToName(69); // "a4"
 */
export function noteNumberToName(midiNote) {
  const noteNames = ['c', 'cs', 'd', 'ds', 'e', 'f', 'fs', 'g', 'gs', 'a', 'as', 'b'];
  const octave = Math.floor(midiNote / 12) - 1;
  const noteName = noteNames[midiNote % 12];
  return noteName + octave;
}

/**
 * Analyze track to determine conversion strategy
 * @param {Object} track - MIDI track data from extractTracks()
 * @returns {Object} Analysis result with recommended strategy
 * @example
 * const analysis = analyzeTrack(track);
 * if (analysis.recommendedStrategy === 'mini') {
 *   // Use mini notation
 * }
 */
export function analyzeTrack(track) {
  if (track.noteCount === 0) {
    return {
      isMonophonic: true,
      hasRegularTiming: true,
      recommendedStrategy: 'mini',
    };
  }

  // Check if monophonic (max 1 simultaneous note)
  let maxSimultaneous = 0;
  let currentNotes = 0;

  track.events.forEach((event) => {
    if (event.type === 'noteOn' && event.velocity > 0) {
      currentNotes++;
      maxSimultaneous = Math.max(maxSimultaneous, currentNotes);
    } else if (event.type === 'noteOff' || (event.type === 'noteOn' && event.velocity === 0)) {
      currentNotes = Math.max(0, currentNotes - 1);
    }
  });

  const isMonophonic = maxSimultaneous <= 1;

  // Check timing regularity (simple heuristic)
  const hasRegularTiming = track.events.length < 50; // Simplified check

  // Recommend strategy
  let recommendedStrategy = 'mini';
  if (!isMonophonic) {
    recommendedStrategy = 'stack';
  } else if (!hasRegularTiming) {
    recommendedStrategy = 'explicit';
  }

  return {
    isMonophonic,
    hasRegularTiming,
    maxSimultaneous,
    recommendedStrategy,
  };
}

/**
 * Quantize time value to subdivision grid
 * @private
 * @param {number} ticks - Absolute time in ticks
 * @param {number} ticksPerBeat - Ticks per quarter note
 * @param {number} subdivision - Subdivision (16 = sixteenth notes)
 * @returns {number} Quantized position in subdivision units
 */
function quantizeTime(ticks, ticksPerBeat, subdivision) {
  const ticksPerSubdivision = (ticksPerBeat * 4) / subdivision;
  return Math.round(ticks / ticksPerSubdivision);
}

/**
 * Calculate note durations by matching noteOn with noteOff events
 * @private
 * @param {Array} events - MIDI events
 * @returns {Map} Map of noteOn events to their duration in ticks
 */
function calculateNoteDurations(events) {
  const durations = new Map();
  const activeNotes = new Map(); // Track active notes by noteNumber

  events.forEach((event) => {
    if (event.type === 'noteOn' && event.velocity > 0) {
      // Store noteOn event
      const key = `${event.noteNumber}-${event.absoluteTime}`;
      activeNotes.set(event.noteNumber, { event, key });
    } else if (event.type === 'noteOff' || (event.type === 'noteOn' && event.velocity === 0)) {
      // Find matching noteOn
      const activeNote = activeNotes.get(event.noteNumber);
      if (activeNote) {
        const duration = event.absoluteTime - activeNote.event.absoluteTime;
        durations.set(activeNote.key, duration);
        activeNotes.delete(event.noteNumber);
      }
    }
  });

  return durations;
}

/**
 * Group note events by quantized time slots
 * @private
 * @param {Array} events - MIDI events
 * @param {number} ticksPerBeat - Ticks per quarter note
 * @param {number} subdivision - Subdivision for quantization
 * @param {Map} durations - Map of note durations from calculateNoteDurations
 * @returns {Map} Map of time slot to array of note events with duration info
 */
function groupEventsByTime(events, ticksPerBeat, subdivision, durations) {
  const slots = new Map();

  events.forEach((event) => {
    if (event.type === 'noteOn' && event.velocity > 0) {
      const slot = quantizeTime(event.absoluteTime, ticksPerBeat, subdivision);
      if (!slots.has(slot)) {
        slots.set(slot, []);
      }

      // Add duration info to event
      const key = `${event.noteNumber}-${event.absoluteTime}`;
      const duration = durations.get(key) || 0;

      slots.get(slot).push({
        ...event,
        durationTicks: duration,
      });
    }
  });

  return slots;
}

/**
 * Detect repetitive patterns in an array
 * @private
 */
function findRepetitions(arr) {
  const results = [];
  
  for (let patternLen = 1; patternLen <= Math.floor(arr.length / 2); patternLen++) {
    for (let startIdx = 0; startIdx < arr.length; startIdx += patternLen) {
      const pattern = arr.slice(startIdx, startIdx + patternLen);
      let repeatCount = 1;
      
      // Check how many times this pattern repeats
      while (
        startIdx + (repeatCount + 1) * patternLen <= arr.length &&
        arraysEqual(pattern, arr.slice(startIdx + repeatCount * patternLen, startIdx + (repeatCount + 1) * patternLen))
      ) {
        repeatCount++;
      }
      
      if (repeatCount >= 2) {
        results.push({
          start: startIdx,
          length: patternLen,
          count: repeatCount,
          pattern: pattern
        });
      }
    }
  }
  
  // Return the longest repetition found
  return results.sort((a, b) => (b.length * b.count) - (a.length * a.count))[0];
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((val, idx) => val === b[idx]);
}

/**
 * Compress patterns using mini notation
 * @private
 */
function compressPattern(events) {
  if (events.length === 0) return '';
  
  // Try to find repetitions
  const rep = findRepetitions(events);
  
  if (rep && rep.count >= 3) {
    // Found significant repetition, use multiplication
    const before = events.slice(0, rep.start);
    const repeated = rep.pattern;
    const after = events.slice(rep.start + rep.length * rep.count);
    
    let result = '';
    if (before.length > 0) {
      result += compressPattern(before) + ' ';
    }
    
    // If the repeated chunk contains more than one slot, prefer replication
    // operator '!' which repeats a chunk without altering perceived density/timing.
    // Use '*' (speed up) only for single-element repetitions where increasing density is intended.
    if (repeated.length > 1) {
      // wrap the chunk in brackets and replicate it
      result += `[${repeated.join(' ')}]!${rep.count}`;
    } else {
      // single element repeated -> safe to use replication operator as well
      result += `${repeated[0]}!${rep.count}`;
    }
    
    if (after.length > 0) {
      result += ' ' + compressPattern(after);
    }
    
    return result;
  }
  
  // Check for elongation patterns (same note repeated)
  let i = 0;
  const parts = [];
  
  while (i < events.length) {
    const current = events[i];
    let count = 1;
    
    while (i + count < events.length && events[i + count] === current && current !== '~') {
      count++;
    }
    
    if (count >= 3 && current !== '~') {
      // Use elongation operator
      parts.push(`${current}@${count}`);
      i += count;
    } else {
      parts.push(current);
      i++;
    }
  }
  
  return parts.join(' ');
}

/**
 * Convert MIDI track to Strudel pattern code
 * @param {Object} track - MIDI track data from extractTracks()
 * @param {Object} options - Conversion options
 * @param {boolean} options.quantize - Whether to quantize timing (default: true)
 * @param {number} options.quantizeSubdivision - Subdivision for quantization (default: 16)
 * @param {boolean} options.preserveVelocity - Include velocity/gain (default: false)
 * @param {boolean} options.compress - Apply pattern compression (default: true)
 * @param {number} options.ticksPerBeat - Ticks per quarter note (from MIDI file division)
 * @param {number} options.tempo - BPM from MIDI file (default: 120)
 * @param {Object} options.timeSignature - Time signature from MIDI file (default: 4/4)
 * @returns {string} Generated Strudel pattern code
 * @example
 * const code = convertTrackToPattern(track, { quantize: true, compress: true, ticksPerBeat: 384, tempo: 120 });
 * console.log(code); // 'note("c4 d4 e4 f4").cps(2)'
 */
export function convertTrackToPattern(track, options = {}) {
  const opts = {
    quantize: true,
    quantizeSubdivision: 16,
    preserveVelocity: false,
    compress: true, // Enable compression by default
    ticksPerBeat: 384, // Default MIDI resolution
    tempo: 120, // Default BPM
    ...options,
  };

  if (track.noteCount === 0) {
    return '// Empty track';
  }

  const analysis = analyzeTrack(track);
  const noteEvents = track.events.filter((e) => e.type === 'noteOn' && e.velocity > 0);

  if (noteEvents.length === 0) {
    return '// No notes';
  }

  // Calculate note durations by matching noteOn with noteOff
  const noteDurations = calculateNoteDurations(track.events);

  // Group events by quantized time slots
  const eventsByTime = groupEventsByTime(noteEvents, opts.ticksPerBeat, opts.quantizeSubdivision, noteDurations);

  // Sort time slots
  const sortedSlots = Array.from(eventsByTime.keys()).sort((a, b) => a - b);

  if (sortedSlots.length === 0) {
    return '// No notes after quantization';
  }

  // Build pattern structure
  // Use global time range if provided (for split tracks synchronization)
  // Otherwise use the track's own time range
  const minSlot = opts._globalTimeRange ? opts._globalTimeRange.min : sortedSlots[0];
  const maxSlot = opts._globalTimeRange ? opts._globalTimeRange.max : sortedSlots[sortedSlots.length - 1];

  // Create array of slots with rests
  const allEvents = [];

  for (let slot = minSlot; slot <= maxSlot; slot++) {
    if (eventsByTime.has(slot)) {
      const events = eventsByTime.get(slot);

      if (events.length === 1) {
        // Single note
        allEvents.push(noteNumberToName(events[0].noteNumber));
      } else {
        // Multiple simultaneous notes (chord)
        const chordNotes = events.map((e) => noteNumberToName(e.noteNumber));
        allEvents.push(`[${chordNotes.join(',')}]`);
      }
    } else {
      // Rest
      allEvents.push('~');
    }
  }

  // Simplify pattern: remove trailing rests
  while (allEvents.length > 0 && allEvents[allEvents.length - 1] === '~') {
    allEvents.pop();
  }

  if (allEvents.length === 0) {
    return '// Pattern only contains rests';
  }

  // Detect appropriate instrument from track name or use override
  const instrument = opts._instrumentOverride || detectInstrument(track.trackName);
  
  // Group events into measures
  const measures = [];
  for (let i = 0; i < allEvents.length; i += opts.quantizeSubdivision) {
    const measureEvents = allEvents.slice(i, i + opts.quantizeSubdivision);
    // Apply compression only if enabled
    const measurePattern = opts.compress ? compressPattern(measureEvents) : measureEvents.join(' ');
    measures.push(measurePattern);
  }

  // If all measures are identical, use repetition
  const allSame = measures.every(m => m === measures[0]);
  let miniNotation;
  
  if (allSame && measures.length > 1) {
    // All measures are the same - use angle brackets for alternation or just one measure
    miniNotation = measures[0];
    if (measures.length > 2) {
      miniNotation = `<${measures[0]}>`;
    }
  } else if (measures.length > 4) {
    // Many different measures - use angle brackets to cycle through them
    miniNotation = `<${measures.map(m => `[${m}]`).join(' ')}>`;
  } else {
    // Few measures - just concatenate with division if needed
    // Each measure is 1 beat worth of subdivisions
    // If we have multiple measures, each one is played sequentially
    // Default: [measure1] [measure2] where each bracket is 1 cycle
    // We need each measure to last the correct duration
    
    const beatsPerMeasure = opts.timeSignature?.numerator || 4;
    
    if (measures.length === 1) {
      // Single measure - might need to slow it down if it's a full bar
      miniNotation = `[${measures[0]}]`;
      if (beatsPerMeasure > 1) {
        // Slow down so the full measure lasts beatsPerMeasure beats
        miniNotation += `/${beatsPerMeasure}`;
      }
    } else {
      // Multiple measures - wrap each and concatenate
      miniNotation = measures.map(m => `[${m}]`).join(' ');
      if (beatsPerMeasure > 1) {
        // Slow the entire pattern
        miniNotation = `[${miniNotation}]/${beatsPerMeasure}`;
      }
    }
  }

  // Build the final pattern with proper formatting
  const lines = [];
  
  // Header comment with essential info
  lines.push(`// ${track.trackName} | ${opts.tempo} BPM | ${allEvents.length} events`);
  
  // Main pattern - tempo is set globally via setcpm()
  lines.push(`note("${miniNotation}")`);
  lines.push(`  .s("${instrument}")`);
  
  return lines.join('\n');
}

/**
 * Detect appropriate instrument/sound based on track name
 * @private
 * @param {string} trackName - MIDI track name
 * @returns {string} Strudel sound name
 */
function detectInstrument(trackName) {
  const name = trackName.toLowerCase();

  // Piano sounds
  if (name.includes('piano') || name.includes('keys')) {
    if (name.includes('elec') || name.includes('electric') || name.includes('ep')) {
      return 'sawtooth'; // Electric piano substitute
    }
    return 'piano';
  }

  // Bass sounds
  if (name.includes('bass')) {
    if (name.includes('synth')) {
      return 'sawtooth';
    }
    return 'bass';
  }

  // Drum/percussion
  if (name.includes('drum') || name.includes('perc') || name.includes('kick') || name.includes('snare')) {
    return 'drum'; // or could map to specific drum samples
  }

  // String sounds
  if (name.includes('string') || name.includes('violin') || name.includes('cello')) {
    return 'sawtooth';
  }

  // Brass
  if (name.includes('brass') || name.includes('trumpet') || name.includes('trombone') || name.includes('horn')) {
    return 'square';
  }

  // Organ
  if (name.includes('organ')) {
    return 'square';
  }

  // Guitar
  if (name.includes('guitar')) {
    return 'sawtooth';
  }

  // Pad/synth sounds
  if (name.includes('pad') || name.includes('synth')) {
    return 'sawtooth';
  }

  // Lead sounds
  if (name.includes('lead')) {
    return 'square';
  }

  // Default to sawtooth for melodic content
  return 'sawtooth';
}

/**
 * Format pattern code with proper indentation
 * @param {string} patternCode - Raw pattern code
 * @param {Object} options - Formatting options
 * @returns {string} Formatted pattern code
 */
export function formatPatternCode(patternCode, options = {}) {
  // Add track comment if provided
  if (options.trackName) {
    return `// ${options.trackName}\n${patternCode}`;
  }
  return patternCode;
}

/**
 * Split a MIDI track into multiple tracks based on pitch ranges
 * IMPORTANT: Maintains temporal alignment by preserving all time slots
 * @param {Object} track - MIDI track data from extractTracks()
 * @param {Object} options - Split options
 * @param {Array} options.ranges - Pitch ranges array with {name, min, max, instrument} objects
 * @returns {Array<Object>} Array of track objects with filtered events
 * @example
 * const ranges = [
 *   { name: 'Bass', min: 0, max: 55, instrument: 'bass' },
 *   { name: 'Melody', min: 56, max: 127, instrument: 'sawtooth' }
 * ];
 * const tracks = splitTrackByPitch(track, { ranges });
 */
export function splitTrackByPitch(track, options = {}) {
  const defaultRanges = [
    { name: 'Bass', min: 0, max: 55, instrument: 'bass' },      // E1 and below
    { name: 'Mid', min: 56, max: 72, instrument: 'sawtooth' },  // Ab3 to C5
    { name: 'High', min: 73, max: 127, instrument: 'square' },  // Db5 and above
  ];

  const ranges = options.ranges || defaultRanges;
  const splitTracks = [];

  // Get the full duration of the track to maintain temporal structure
  const trackDuration = track.duration;

  for (const range of ranges) {
    // Create a new event list that includes ALL time positions
    // but only has notes from this pitch range
    const filteredEvents = [];
    
    // Keep all events, but filter note events by pitch
    track.events.forEach((event) => {
      if (event.type === 'noteOn') {
        // Only include noteOn if it's in this pitch range
        if (event.noteNumber >= range.min && event.noteNumber <= range.max) {
          filteredEvents.push(event);
        }
      } else if (event.type === 'noteOff') {
        // Only include noteOff if it's in this pitch range
        if (event.noteNumber >= range.min && event.noteNumber <= range.max) {
          filteredEvents.push(event);
        }
      } else {
        // Keep all non-note events (tempo, time signature, etc.)
        filteredEvents.push(event);
      }
    });

    // Count actual notes in this range
    const noteCount = filteredEvents.filter(
      (e) => e.type === 'noteOn' && e.velocity > 0
    ).length;

    // Only create track if it has notes
    if (noteCount > 0) {
      // Recalculate pitch range for this subset
      const noteNumbers = filteredEvents
        .filter((e) => e.type === 'noteOn')
        .map((e) => e.noteNumber);

      const pitchRange = {
        min: Math.min(...noteNumbers),
        max: Math.max(...noteNumbers),
      };

      splitTracks.push({
        ...track,
        trackName: `${track.trackName} - ${range.name}`,
        events: filteredEvents,
        noteCount,
        pitchRange,
        duration: trackDuration, // Maintain same duration
        _rangeInfo: range, // Store range info for instrument detection
      });
    }
  }

  return splitTracks;
}

/**
 * Convert track with automatic pitch-based splitting
 * @param {Object} track - MIDI track data from extractTracks()
 * @param {Object} options - Conversion options (same as convertTrackToPattern)
 * @returns {Array} Array of pattern codes with {name, code, noteCount, pitchRange} properties
 */
export function convertTrackWithSplit(track, options = {}) {
  const splitTracks = splitTrackByPitch(track, options);
  
  // Calculate the global time range across ALL events in the original track
  // This ensures all split tracks have the same temporal structure
  const allNoteEvents = track.events.filter((e) => e.type === 'noteOn' && e.velocity > 0);
  if (allNoteEvents.length === 0) {
    return [];
  }

  const opts = {
    quantize: true,
    quantizeSubdivision: 16,
    ticksPerBeat: 384,
    ...options,
  };

  // Get global time range for synchronization
  const globalSlots = allNoteEvents.map(e => 
    quantizeTime(e.absoluteTime, opts.ticksPerBeat, opts.quantizeSubdivision)
  );
  const globalMinSlot = Math.min(...globalSlots);
  const globalMaxSlot = Math.max(...globalSlots);
  
  return splitTracks.map((splitTrack) => {
    // Override instrument if specified in range
    const trackOptions = { 
      ...options,
      _globalTimeRange: { min: globalMinSlot, max: globalMaxSlot } // Pass global range
    };
    if (splitTrack._rangeInfo && splitTrack._rangeInfo.instrument) {
      trackOptions._instrumentOverride = splitTrack._rangeInfo.instrument;
    }
    
    const code = convertTrackToPattern(splitTrack, trackOptions);
    
    return {
      name: splitTrack.trackName,
      code,
      noteCount: splitTrack.noteCount,
      pitchRange: splitTrack.pitchRange,
    };
  });
}
