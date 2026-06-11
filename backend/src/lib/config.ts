/**
 * Shared configuration for data directory paths.
 *
 * In Docker, DATA_DIR is set to /app/data via docker-compose.yml.
 * Locally, it defaults to ./data (relative to the backend directory).
 */

import path from 'path'

/** Base directory for all persistent data (DB, uploads, keys, etc.) */
export const DATA_DIR = process.env.DATA_DIR ?? path.resolve('./data')

/** Path to the SQLite database file */
export const DB_PATH = process.env.FILE_DB_PATH ?? path.join(DATA_DIR, 'files.db')

/** Path to the uploads directory (used in demo mode for local file storage) */
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')

/** Path to the Sia app key file */
export const KEY_PATH = path.join(DATA_DIR, 'appkey.hex')

/** Path to the Sia recovery phrase file */
export const PHRASE_PATH = path.join(DATA_DIR, 'phrase.enc')