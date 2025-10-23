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
 * Convert MIDI track to Strudel pattern code
 * @param {Object} track - MIDI track data from extractTracks()
 * @param {Object} options - Conversion options
 * @param {boolean} options.quantize - Whether to quantize timing (default: true)
 * @param {number} options.quantizeSubdivision - Subdivision for quantization (default: 16)
 * @param {boolean} options.preserveVelocity - Include velocity/gain (default: true)
 * @returns {string} Generated Strudel pattern code
 * @example
 * const code = convertTrackToPattern(track, { quantize: true });
 * console.log(code); // 'note("c4 d4 e4 f4")'
 */
export function convertTrackToPattern(track, options = {}) {
  const opts = {
    quantize: true,
    quantizeSubdivision: 16,
    preserveVelocity: true,
    ...options,
  };

  if (track.noteCount === 0) {
    return '// Empty track';
  }

  const analysis = analyzeTrack(track);

  // Simple conversion to mini notation
  const noteEvents = track.events.filter((e) => e.type === 'noteOn' && e.velocity > 0);

  if (noteEvents.length === 0) {
    return '// No notes';
  }

  // Convert to simple sequence
  const notes = noteEvents.map((e) => noteNumberToName(e.noteNumber));

  if (analysis.isMonophonic) {
    return `note("${notes.join(' ')}")`;
  } else {
    // Use stack for polyphony
    return `stack(${notes.map((n) => `note("${n}")`).join(', ')})`;
  }
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
