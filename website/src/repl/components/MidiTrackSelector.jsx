import { noteNumberToName } from '@strudel/midi-import';

export function MidiTrackSelector({ tracks, selectedTracks, onSelectionChange }) {
  const handleToggle = (trackIndex) => {
    if (selectedTracks.includes(trackIndex)) {
      onSelectionChange(selectedTracks.filter((i) => i !== trackIndex));
    } else {
      onSelectionChange([...selectedTracks, trackIndex]);
    }
  };

  const handleSelectAll = () => {
    onSelectionChange(tracks.map((_, i) => i));
  };

  const handleDeselectAll = () => {
    onSelectionChange([]);
  };

  if (!tracks || tracks.length === 0) {
    return <p className="text-gray-400">No tracks found</p>;
  }

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <button onClick={handleSelectAll} className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded">
          Select All
        </button>
        <button onClick={handleDeselectAll} className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded">
          Deselect All
        </button>
      </div>

      <div className="space-y-2">
        {tracks.map((track, index) => {
          const isSelected = selectedTracks.includes(index);
          const minNote = track.pitchRange.min > 0 ? noteNumberToName(track.pitchRange.min) : '-';
          const maxNote = track.pitchRange.max > 0 ? noteNumberToName(track.pitchRange.max) : '-';

          return (
            <div
              key={index}
              className={`border rounded p-3 cursor-pointer transition-colors ${
                isSelected ? 'border-blue-500 bg-blue-900 bg-opacity-20' : 'border-gray-600 hover:border-gray-500'
              }`}
              onClick={() => handleToggle(index)}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggle(index)}
                  className="cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1">
                  <div className="font-bold">{track.trackName}</div>
                  <div className="text-sm text-gray-400 flex gap-4">
                    <span className="bg-gray-700 px-2 py-0.5 rounded">{track.noteCount} notes</span>
                    {track.noteCount > 0 && (
                      <span>
                        Range: {minNote} - {maxNote}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
