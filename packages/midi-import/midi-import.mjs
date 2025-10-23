/*
 * MIDI File Parser
 * Parses binary MIDI files into structured JavaScript objects
 * Uses midi-file library for parsing (compatible with Node.js and browser)
 */

import { parseMidi } from 'midi-file';

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
    // Convert ArrayBuffer to Uint8Array for midi-file
    const uint8Array = new Uint8Array(arrayBuffer);
    const parsed = parseMidi(uint8Array);
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
 * @param {Object} midiData - Parsed MIDI data from midi-file
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
      // midi-file uses 'type' property for event types
      if (event.type === 'setTempo') {
        const bpm = Math.round(60000000 / event.microsecondsPerBeat);
        tempoEvents.push({ time: event.deltaTime || 0, bpm });
      }
      if (event.type === 'timeSignature') {
        metadata.timeSignature = {
          numerator: event.numerator,
          denominator: event.denominator,
        };
      }
      if (event.type === 'keySignature') {
        metadata.keySignature = {
          key: event.key,
          scale: event.scale === 0 ? 'major' : 'minor',
        };
      }
      if (event.type === 'trackName') {
        metadata.trackNames.push(event.text);
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
      absoluteTime += event.deltaTime || 0;

      // Extract track name
      if (event.type === 'trackName') {
        trackName = event.text;
      }

      // Process note events
      // midi-file uses 'noteOn' type with velocity > 0, or velocity === 0 for noteOff
      if (event.type === 'noteOn' && event.velocity > 0) {
        track.noteCount++;
        const noteNumber = event.noteNumber;
        track.pitchRange.min = Math.min(track.pitchRange.min, noteNumber);
        track.pitchRange.max = Math.max(track.pitchRange.max, noteNumber);

        track.events.push({
          type: 'noteOn',
          noteNumber,
          velocity: event.velocity,
          deltaTime: event.deltaTime || 0,
          absoluteTime,
        });
      }

      // Note off can be either noteOff type or noteOn with velocity 0
      if (event.type === 'noteOff' || (event.type === 'noteOn' && event.velocity === 0)) {
        track.events.push({
          type: 'noteOff',
          noteNumber: event.noteNumber,
          velocity: event.velocity || 0,
          deltaTime: event.deltaTime || 0,
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
 * @param {Object} parsed - Raw parsed data from midi-file
 * @returns {Object} Normalized MIDI data
 */
function normalizeMidiData(parsed) {
  // midi-file returns { header: { format, numTracks, ticksPerBeat }, tracks: [...] }
  // We need to normalize to our expected structure

  const midiData = {
    format: parsed.header.format,
    division: parsed.header.ticksPerBeat,
    tracks: parsed.tracks,
  };

  const metadata = extractMetadata(midiData);
  const tracks = extractTracks(midiData);

  return {
    format: midiData.format,
    division: midiData.division,
    tracks,
    tempo: metadata.tempo,
    timeSignature: metadata.timeSignature,
    keySignature: metadata.keySignature,
    tempoChanges: metadata.tempoChanges || [],
  };
}
