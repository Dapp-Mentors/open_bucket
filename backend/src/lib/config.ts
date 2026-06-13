/**
 * Shared data directory path configuration.
 * In Docker: /app/data. Locally: ./data.
 */

import path from 'path'

/** Base directory for all persistent data */
export const DATA_DIR = process.env.DATA_DIR ?? path.resolve('./data')

/** SQLite database path */
export const DB_PATH = process.env.FILE_DB_PATH ?? path.join(DATA_DIR, 'files.db')

/** Uploads directory (demo mode) */
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')

/** Sia app key file */
export const KEY_PATH = path.join(DATA_DIR, 'appkey.hex')

/** Sia recovery phrase file */
export const PHRASE_PATH = path.join(DATA_DIR, 'phrase.enc')
