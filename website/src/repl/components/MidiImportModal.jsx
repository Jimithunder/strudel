import { useState, useCallback, useEffect } from 'react';
import { parseMidiFile, isValidMidiFile, convertTrackToPattern, convertTrackWithSplit } from '@strudel/midi-import';
import { MidiTrackSelector } from './MidiTrackSelector.jsx';

export function MidiImportModal({ isOpen, onClose, onInsert, onReplace }) {
  const [uploadState, setUploadState] = useState('idle');
  const [parsedData, setParsedData] = useState(null);
  const [selectedTracks, setSelectedTracks] = useState([]);
  const [generatedCode, setGeneratedCode] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [conversionOptions, setConversionOptions] = useState({
    quantize: true,
    quantizeSubdivision: 16,
    preserveVelocity: true,
    splitByPitch: false,
  });

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setUploadState('idle');
      setParsedData(null);
      setSelectedTracks([]);
      setGeneratedCode('');
      setErrorMessage(null);
    }
  }, [isOpen]);

  const handleFileSelect = useCallback(async (file) => {
    if (!file) return;

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('File too large. Maximum size is 5MB.');
      setUploadState('error');
      return;
    }

    setUploadState('uploading');
    setErrorMessage(null);

    try {
      const arrayBuffer = await file.arrayBuffer();

      if (!isValidMidiFile(arrayBuffer)) {
        throw new Error('Invalid MIDI file format');
      }

      setUploadState('parsing');

      const data = await parseMidiFile(arrayBuffer);
      setParsedData(data);
      setSelectedTracks(data.tracks.map((_, i) => i)); // Select all by default
      setUploadState('parsed');
    } catch (error) {
      setErrorMessage(error.message);
      setUploadState('error');
    }
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.mid') || file.name.endsWith('.midi'))) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect],
  );

  const handleConvert = useCallback(() => {
    if (!parsedData) return;

    setUploadState('converting');

    try {
      const allCodes = [];

      selectedTracks.forEach((trackIndex) => {
        const track = parsedData.tracks[trackIndex];
        
        if (conversionOptions.splitByPitch) {
          // Split by pitch ranges
          const splitPatterns = convertTrackWithSplit(track, {
            ...conversionOptions,
            ticksPerBeat: parsedData.division,
            tempo: parsedData.tempo,
            timeSignature: parsedData.timeSignature,
          });

          // Generate code for each split pattern
          splitPatterns.forEach((sp, idx) => {
            const varName = `track${trackIndex}_${sp.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
            allCodes.push({
              varName,
              code: `// ${sp.name}\nconst ${varName} = ${sp.code};`,
            });
          });
        } else {
          // Normal conversion
          const code = convertTrackToPattern(track, {
            ...conversionOptions,
            ticksPerBeat: parsedData.division,
            tempo: parsedData.tempo,
            timeSignature: parsedData.timeSignature,
          });
          const varName = `track${trackIndex}`;
          allCodes.push({
            varName,
            code: `// ${track.trackName}\nconst ${varName} = ${code};`,
          });
        }
      });

      // Join all codes
      let finalCode = allCodes.map(c => c.code).join('\n\n');
      
      // If multiple patterns, add stack at the end
      if (allCodes.length > 1) {
        finalCode += '\n\n// Play all tracks together\nstack(\n';
        finalCode += allCodes.map(c => `  ${c.varName}`).join(',\n');
        finalCode += '\n)';
      } else if (allCodes.length === 1) {
        // Single track - just use the pattern directly without const
        const track = parsedData.tracks[selectedTracks[0]];
        if (conversionOptions.splitByPitch) {
          // Already has stack logic in the code
          finalCode = allCodes[0].code.replace(/^const \w+ = /, '');
        } else {
          const code = convertTrackToPattern(track, {
            ...conversionOptions,
            ticksPerBeat: parsedData.division,
            tempo: parsedData.tempo,
            timeSignature: parsedData.timeSignature,
          });
          finalCode = `// ${track.trackName}\n${code}`;
        }
      }

      setGeneratedCode(finalCode);
      setUploadState('done');
    } catch (error) {
      setErrorMessage(error.message);
      setUploadState('error');
    }
  }, [parsedData, selectedTracks, conversionOptions]);

  const handleCopyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(generatedCode);
  }, [generatedCode]);

  const handleReset = useCallback(() => {
    setUploadState('idle');
    setParsedData(null);
    setSelectedTracks([]);
    setGeneratedCode('');
    setErrorMessage(null);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Import MIDI File</h2>

        {uploadState === 'idle' && (
          <div
            className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <p className="mb-4">Drag and drop a MIDI file here, or click to browse</p>
            <input
              type="file"
              accept=".mid,.midi"
              onChange={(e) => handleFileSelect(e.target.files[0])}
              className="hidden"
              id="midi-file-input"
            />
            <label
              htmlFor="midi-file-input"
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded cursor-pointer inline-block"
            >
              Choose File
            </label>
          </div>
        )}

        {uploadState === 'parsing' && (
          <div className="text-center py-8">
            <p>Parsing MIDI file...</p>
          </div>
        )}

        {uploadState === 'parsed' && parsedData && (
          <>
            <MidiTrackSelector
              tracks={parsedData.tracks}
              selectedTracks={selectedTracks}
              onSelectionChange={setSelectedTracks}
            />

            <div className="mt-4 space-y-2">
              <h3 className="font-bold">Conversion Options</h3>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={conversionOptions.quantize}
                  onChange={(e) => setConversionOptions({ ...conversionOptions, quantize: e.target.checked })}
                  className="mr-2"
                />
                Quantize timing
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={conversionOptions.preserveVelocity}
                  onChange={(e) => setConversionOptions({ ...conversionOptions, preserveVelocity: e.target.checked })}
                  className="mr-2"
                />
                Preserve velocity
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={conversionOptions.splitByPitch}
                  onChange={(e) => setConversionOptions({ ...conversionOptions, splitByPitch: e.target.checked })}
                  className="mr-2"
                />
                Split by pitch (separate bass/mid/high)
              </label>
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={handleConvert} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded">
                Convert
              </button>
              <button onClick={onClose} className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded">
                Cancel
              </button>
            </div>
          </>
        )}

        {uploadState === 'done' && (
          <>
            <textarea
              value={generatedCode}
              readOnly
              className="w-full h-64 bg-gray-900 text-white p-2 rounded font-mono text-sm"
            />
            <div className="mt-4 flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  onInsert(generatedCode);
                  onClose();
                }}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
              >
                Insert into Editor
              </button>
              <button
                onClick={() => {
                  onReplace(generatedCode);
                  onClose();
                }}
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded"
              >
                Replace Editor
              </button>
              <button onClick={handleCopyToClipboard} className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded">
                Copy to Clipboard
              </button>
              <button onClick={handleReset} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded">
                Load Another File
              </button>
              <button onClick={onClose} className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded">
                Close
              </button>
            </div>
          </>
        )}

        {uploadState === 'error' && errorMessage && (
          <div className="bg-red-900 border border-red-700 rounded p-4 mt-4">
            <p className="text-red-200">{errorMessage}</p>
            <button onClick={() => setUploadState('idle')} className="mt-2 bg-red-700 hover:bg-red-800 px-4 py-2 rounded">
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
