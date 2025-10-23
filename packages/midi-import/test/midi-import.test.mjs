import { describe, it, expect } from 'vitest';
import { parseMidiFile, isValidMidiFile, extractMetadata, extractTracks } from '../midi-import.mjs';

describe('isValidMidiFile', () => {
  it('should return false for empty buffer', () => {
    const buffer = new ArrayBuffer(0);
    expect(isValidMidiFile(buffer)).toBe(false);
  });

  it('should return false for buffer without MThd header', () => {
    const buffer = new ArrayBuffer(4);
    const view = new Uint8Array(buffer);
    view[0] = 0x00;
    view[1] = 0x00;
    view[2] = 0x00;
    view[3] = 0x00;
    expect(isValidMidiFile(buffer)).toBe(false);
  });

  it('should return true for buffer with MThd header', () => {
    const buffer = new ArrayBuffer(14);
    const view = new Uint8Array(buffer);
    // MThd header
    view[0] = 0x4d; // M
    view[1] = 0x54; // T
    view[2] = 0x68; // h
    view[3] = 0x64; // d
    expect(isValidMidiFile(buffer)).toBe(true);
  });
});

describe('parseMidiFile', () => {
  it('should throw error for non-ArrayBuffer input', async () => {
    await expect(parseMidiFile(null)).rejects.toThrow('Input must be an ArrayBuffer');
  });

  it('should throw error for invalid MIDI file', async () => {
    const buffer = new ArrayBuffer(4);
    await expect(parseMidiFile(buffer)).rejects.toThrow('Invalid MIDI file');
  });
});

describe('extractMetadata', () => {
  it('should return default metadata for empty data', () => {
    const midiData = { tracks: [] };
    const metadata = extractMetadata(midiData);

    expect(metadata.tempo).toBe(120);
    expect(metadata.timeSignature).toEqual({ numerator: 4, denominator: 4 });
  });

  it('should extract tempo from setTempo event', () => {
    const midiData = {
      tracks: [
        [
          { setTempo: { microsecondsPerQuarter: 500000 }, delta: 0 },
        ],
      ],
    };
    const metadata = extractMetadata(midiData);

    expect(metadata.tempo).toBe(120); // 60000000 / 500000 = 120
  });

  it('should extract time signature', () => {
    const midiData = {
      tracks: [
        [
          { timeSignature: { numerator: 3, denominator: 4 }, delta: 0 },
        ],
      ],
    };
    const metadata = extractMetadata(midiData);

    expect(metadata.timeSignature).toEqual({ numerator: 3, denominator: 4 });
  });
});

describe('extractTracks', () => {
  it('should return empty array for no tracks', () => {
    const midiData = { tracks: [] };
    const tracks = extractTracks(midiData);

    expect(tracks).toEqual([]);
  });

  it('should extract track with note events', () => {
    const midiData = {
      tracks: [
        [
          { trackName: 'Piano', delta: 0 },
          { noteOn: { noteNumber: 60, velocity: 100 }, delta: 0 },
          { noteOff: { noteNumber: 60, velocity: 0 }, delta: 480 },
        ],
      ],
    };
    const tracks = extractTracks(midiData);

    expect(tracks).toHaveLength(1);
    expect(tracks[0].trackName).toBe('Piano');
    expect(tracks[0].noteCount).toBe(1);
    expect(tracks[0].pitchRange).toEqual({ min: 60, max: 60 });
  });

  it('should handle tracks with no notes', () => {
    const midiData = {
      tracks: [
        [
          { trackName: 'Empty', delta: 0 },
        ],
      ],
    };
    const tracks = extractTracks(midiData);

    expect(tracks).toHaveLength(1);
    expect(tracks[0].noteCount).toBe(0);
    expect(tracks[0].pitchRange).toEqual({ min: 0, max: 0 });
  });

  it('should calculate pitch range correctly', () => {
    const midiData = {
      tracks: [
        [
          { noteOn: { noteNumber: 48, velocity: 100 }, delta: 0 },
          { noteOn: { noteNumber: 72, velocity: 100 }, delta: 0 },
          { noteOn: { noteNumber: 60, velocity: 100 }, delta: 0 },
        ],
      ],
    };
    const tracks = extractTracks(midiData);

    expect(tracks[0].pitchRange).toEqual({ min: 48, max: 72 });
    expect(tracks[0].noteCount).toBe(3);
  });
});
