# @strudel/midi-import

MIDI file import and conversion to Strudel patterns.

## Installation

```bash
pnpm add @strudel/midi-import
```

## Usage

```javascript
import { parseMidiFile, convertTrackToPattern } from '@strudel/midi-import';

// Parse a MIDI file
const midiData = await parseMidiFile(arrayBuffer);

// Convert a track to Strudel pattern code
const patternCode = convertTrackToPattern(midiData.tracks[0]);
```

## Features

- Parse standard MIDI files (format 0, 1, and 2)
- Extract track metadata (tempo, time signature, note count)
- Convert MIDI tracks to Strudel pattern code
- Support for mini notation, stack() for polyphony, and explicit timing
- Configurable quantization and velocity preservation

## Documentation

Full documentation coming soon.
