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
 * Convert MIDI track to Strudel pattern code
 * @param {Object} track - MIDI track data from extractTracks()
 * @param {Object} options - Conversion options
 * @param {boolean} options.quantize - Whether to quantize timing (default: true)
 * @param {number} options.quantizeSubdivision - Subdivision for quantization (default: 16)
 * @param {boolean} options.preserveVelocity - Include velocity/gain (default: false)
 * @param {number} options.ticksPerBeat - Ticks per quarter note (from MIDI file division)
 * @param {number} options.tempo - BPM from MIDI file (default: 120)
 * @param {Object} options.timeSignature - Time signature from MIDI file (default: 4/4)
 * @returns {string} Generated Strudel pattern code
 * @example
 * const code = convertTrackToPattern(track, { quantize: true, ticksPerBeat: 384, tempo: 120 });
 * console.log(code); // 'note("c4 d4 e4 f4").cps(2)'
 */
export function convertTrackToPattern(track, options = {}) {
  const opts = {
    quantize: true,
    quantizeSubdivision: 16,
    preserveVelocity: false,
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

  // Group events into measures
  // Each measure has quantizeSubdivision events (16 for sixteenth notes in 4/4)
  const measures = [];
  for (let i = 0; i < allEvents.length; i += opts.quantizeSubdivision) {
    const measureEvents = allEvents.slice(i, i + opts.quantizeSubdivision);
    measures.push(`[${measureEvents.join(' ')}]`);
  }

  // Generate code based on pattern length and complexity
  const miniNotation = measures.join(' ');

  // Detect appropriate instrument from track name or use override
  const instrument = opts._instrumentOverride || detectInstrument(track.trackName);

  // In Strudel mini notation like "[a b c] [d e f]":
  // - Each top-level element is 1 cycle
  // - So measures.length measures = measures.length cycles
  // - Each measure should last (60 / BPM) * beatsPerMeasure seconds
  // - By default each cycle = 1 second, so we need to slow by secondsPerMeasure
  
  const beatsPerMeasure = opts.timeSignature?.numerator || 4;
  const secondsPerMeasure = (60 / opts.tempo) * beatsPerMeasure;
  const measuresCount = measures.length;
  
  // Each measure needs to be stretched from 1 second to secondsPerMeasure seconds
  const slowFactor = secondsPerMeasure;
  
  // Add comment for longer patterns
  const comment = allEvents.length > 32
    ? `// ${allEvents.length} events over ${measuresCount} measures at ${opts.tempo} BPM\n`
    : '';

  // Use .slow() to stretch each measure to proper duration
  return `${comment}note("${miniNotation}").s("${instrument}").slow(${slowFactor.toFixed(2)})`;
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
