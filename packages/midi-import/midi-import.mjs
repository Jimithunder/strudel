/*
 * MIDI File Parser
 * Parses binary MIDI files into structured JavaScript objects
 * Uses midi-json-parser library for low-level parsing
 */

import { parseArrayBuffer } from 'midi-json-parser';

/**
 * Parse a MIDI file from ArrayBuffer
 * @param {ArrayBuffer} arrayBuffer - Binary MIDI file data
 * @returns {Promise<Object>} Parsed MIDI data structure
 * @throws {Error} If file is invalid or parsing fails
 * @example
 * const midiData = await parseMidiFile(arrayBuffer);
 * console.log(midiData.tracks.length); // Number of tracks
 */
export async function parseMidiFile(arrayBuffer) {
  if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer)) {
    throw new Error('Input must be an ArrayBuffer');
  }

  if (!isValidMidiFile(arrayBuffer)) {
    throw new Error('Invalid MIDI file: missing MThd header');
  }

  try {
    const parsed = await parseArrayBuffer(arrayBuffer);
    const normalized = normalizeMidiData(parsed);
    return normalized;
  } catch (error) {
    throw new Error(`Failed to parse MIDI file: ${error.message}`);
  }
}

/**
 * Validate MIDI file format by checking magic number
 * @param {ArrayBuffer} arrayBuffer - File buffer to validate
 * @returns {boolean} True if valid MIDI file
 * @example
 * if (isValidMidiFile(buffer)) {
 *   const data = await parseMidiFile(buffer);
 * }
 */
export function isValidMidiFile(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength < 4) {
    return false;
  }

  const view = new Uint8Array(arrayBuffer);
  // Check for 'MThd' magic number (0x4D546864)
  return view[0] === 0x4d && view[1] === 0x54 && view[2] === 0x68 && view[3] === 0x64;
}

/**
 * Extract metadata from parsed MIDI data
 * @param {Object} midiData - Parsed MIDI data from midi-json-parser
 * @returns {Object} Metadata including tempo, time signature, key signature
 * @example
 * const metadata = extractMetadata(parsed);
 * console.log(metadata.tempo); // BPM
 */
export function extractMetadata(midiData) {
  const metadata = {
    tempo: 120, // Default 120 BPM
    timeSignature: { numerator: 4, denominator: 4 },
    keySignature: null,
    trackNames: [],
  };

  // Extract tempo from meta events
  // Tempo in MIDI is microseconds per quarter note
  // BPM = 60,000,000 / microsecondsPerQuarterNote
  const tempoEvents = [];
  midiData.tracks.forEach((track) => {
    track.forEach((event) => {
      if (event.setTempo) {
        const bpm = Math.round(60000000 / event.setTempo.microsecondsPerQuarter);
        tempoEvents.push({ time: event.delta || 0, bpm });
      }
      if (event.timeSignature) {
        metadata.timeSignature = {
          numerator: event.timeSignature.numerator,
          denominator: event.timeSignature.denominator,
        };
      }
      if (event.keySignature) {
        metadata.keySignature = {
          key: event.keySignature.key,
          scale: event.keySignature.scale,
        };
      }
      if (event.trackName) {
        metadata.trackNames.push(event.trackName);
      }
    });
  });

  // Use first tempo event if available
  if (tempoEvents.length > 0) {
    metadata.tempo = tempoEvents[0].bpm;
    metadata.tempoChanges = tempoEvents;
  }

  return metadata;
}

/**
 * Extract and analyze tracks from parsed MIDI data
 * @param {Object} midiData - Parsed MIDI data
 * @returns {Array<Object>} Array of track objects with metadata
 * @example
 * const tracks = extractTracks(parsed);
 * tracks.forEach(track => {
 *   console.log(`${track.trackName}: ${track.noteCount} notes`);
 * });
 */
export function extractTracks(midiData) {
  const tracks = [];

  midiData.tracks.forEach((trackEvents, index) => {
    const track = {
      trackNumber: index,
      trackName: `Track ${index + 1}`,
      events: [],
      noteCount: 0,
      duration: 0,
      pitchRange: { min: 127, max: 0 },
    };

    let absoluteTime = 0;
    let trackName = null;

    trackEvents.forEach((event) => {
      absoluteTime += event.delta || 0;

      // Extract track name
      if (event.trackName) {
        trackName = event.trackName;
      }

      // Process note events
      if (event.noteOn) {
        track.noteCount++;
        const noteNumber = event.noteOn.noteNumber;
        track.pitchRange.min = Math.min(track.pitchRange.min, noteNumber);
        track.pitchRange.max = Math.max(track.pitchRange.max, noteNumber);

        track.events.push({
          type: 'noteOn',
          noteNumber,
          velocity: event.noteOn.velocity,
          deltaTime: event.delta || 0,
          absoluteTime,
        });
      }

      if (event.noteOff) {
        track.events.push({
          type: 'noteOff',
          noteNumber: event.noteOff.noteNumber,
          velocity: event.noteOff.velocity || 0,
          deltaTime: event.delta || 0,
          absoluteTime,
        });
      }
    });

    // Set track name if found
    if (trackName) {
      track.trackName = trackName;
    }

    // Calculate duration
    if (track.events.length > 0) {
      track.duration = track.events[track.events.length - 1].absoluteTime;
    }

    // Reset pitch range if no notes
    if (track.noteCount === 0) {
      track.pitchRange = { min: 0, max: 0 };
    }

    tracks.push(track);
  });

  return tracks;
}

/**
 * Normalize parsed MIDI data into consistent structure
 * @private
 * @param {Object} parsed - Raw parsed data from midi-json-parser
 * @returns {Object} Normalized MIDI data
 */
function normalizeMidiData(parsed) {
  const metadata = extractMetadata(parsed);
  const tracks = extractTracks(parsed);

  return {
    format: parsed.format,
    division: parsed.division,
    tracks,
    tempo: metadata.tempo,
    timeSignature: metadata.timeSignature,
    keySignature: metadata.keySignature,
    tempoChanges: metadata.tempoChanges || [],
  };
}
