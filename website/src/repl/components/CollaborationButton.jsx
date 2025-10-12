/*
CollaborationButton.jsx - Collaboration UI component for Strudel
Copyright (C) 2022 Strudel contributors - see <https://codeberg.org/uzu/strudel>
This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details. You should have received a copy of the GNU Affero General Public License along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { useState, useEffect } from 'react';
import { UserGroupIcon, CheckIcon, ClipboardIcon, XMarkIcon } from '@heroicons/react/24/outline';

export function CollaborationButton({ 
  isCollaborating, 
  onStartCollab, 
  onStopCollab, 
  roomId, 
  connectedUsers = 0,
  shareableUrl = '' 
}) {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleStartCollab = () => {
    onStartCollab();
    setShowModal(true);
  };

  const handleStopCollab = () => {
    onStopCollab();
    setShowModal(false);
  };

  return (
    <>
      <button
        onClick={() => {
          if (isCollaborating) {
            setShowModal(true);
          } else {
            handleStartCollab();
          }
        }}
        className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
          isCollaborating
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
        }`}
        title={isCollaborating ? 'Collaboration active' : 'Start collaboration'}
      >
        <UserGroupIcon className="w-4 h-4" />
        <span className="hidden sm:inline">
          {isCollaborating ? 'Collaborating' : 'Collaborate'}
        </span>
        {isCollaborating && connectedUsers > 0 && (
          <span className="bg-green-800 px-1.5 py-0.5 rounded text-xs">
            {connectedUsers}
          </span>
        )}
      </button>

      {showModal && isCollaborating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-semibold text-white">Collaboration Active</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-300 mb-2">
                  Share this URL with others to collaborate in real-time:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={shareableUrl}
                    readOnly
                    className="flex-1 bg-gray-700 text-white px-3 py-2 rounded text-sm border border-gray-600 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors flex items-center gap-1"
                    title="Copy URL"
                  >
                    {copied ? (
                      <>
                        <CheckIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Copied!</span>
                      </>
                    ) : (
                      <>
                        <ClipboardIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-gray-700 rounded p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">Room ID:</span>
                  <span className="text-sm font-mono text-white">{roomId}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm text-gray-300">Connected users:</span>
                  <span className="text-sm font-semibold text-green-400">
                    {connectedUsers}
                  </span>
                </div>
              </div>

              <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded p-3">
                <p className="text-xs text-blue-200">
                  💡 All connected users can edit the code simultaneously. Changes are synced in real-time.
                </p>
              </div>

              <button
                onClick={handleStopCollab}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                Stop Collaboration
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

