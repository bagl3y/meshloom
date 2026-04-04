/**
 * Favorites utilities.
 *
 * Favorites are stored server-side in the database.
 */

import type { Favorite } from '../types';

/**
 * Check if a conversation is favorited (from provided favorites array)
 */
export function isFavorite(
  favorites: Favorite[],
  type: 'channel' | 'contact',
  id: string
): boolean {
  return favorites.some((f) => f.type === type && f.id === id);
}
