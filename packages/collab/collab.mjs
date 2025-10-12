/*
collab.mjs - Client-side collaboration utilities for Strudel
Copyright (C) 2022 Strudel contributors - see <https://codeberg.org/uzu/strudel>
This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details. You should have received a copy of the GNU Affero General Public License along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

/**
 * Create a collaboration provider for a given room
 * @param {string} roomId - Unique room identifier
 * @param {string} serverUrl - WebSocket server URL (e.g., 'ws://localhost:1234')
 * @param {object} options - Additional options
 * @returns {object} - Provider and Yjs document
 */
export function createCollaborationProvider(roomId, serverUrl = 'ws://localhost:1234', options = {}) {
  const ydoc = new Y.Doc();
  const ytext = ydoc.getText('codemirror');
  
  const provider = new WebsocketProvider(serverUrl, roomId, ydoc, {
    connect: true,
    ...options,
  });

  return {
    ydoc,
    ytext,
    provider,
    awareness: provider.awareness,
  };
}

/**
 * Generate a random room ID
 * @returns {string} - Random room ID
 */
export function generateRoomId() {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Get room ID from URL parameters
 * @returns {string|null} - Room ID or null if not present
 */
export function getRoomIdFromUrl() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('room');
}

/**
 * Update URL with room ID without page reload
 * @param {string} roomId - Room ID to add to URL
 */
export function updateUrlWithRoomId(roomId) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location);
  url.searchParams.set('room', roomId);
  window.history.pushState({}, '', url);
}

/**
 * Remove room ID from URL
 */
export function removeRoomIdFromUrl() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location);
  url.searchParams.delete('room');
  window.history.pushState({}, '', url);
}

/**
 * Generate shareable URL for a room
 * @param {string} roomId - Room ID
 * @returns {string} - Full URL with room parameter
 */
export function getShareableUrl(roomId) {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location);
  url.searchParams.set('room', roomId);
  return url.toString();
}

/**
 * Set user info in awareness
 * @param {object} awareness - Yjs awareness instance
 * @param {object} userInfo - User information
 */
export function setUserInfo(awareness, userInfo) {
  const defaultInfo = {
    name: `User ${Math.floor(Math.random() * 1000)}`,
    color: getRandomColor(),
    ...userInfo,
  };
  awareness.setLocalStateField('user', defaultInfo);
}

/**
 * Get random color for user cursor
 * @returns {string} - Hex color code
 */
function getRandomColor() {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    '#F8B739', '#52B788', '#FF8B94', '#A8DADC'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

