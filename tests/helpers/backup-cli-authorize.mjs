import { appendFileSync } from 'node:fs';

import { GoogleError } from '../../dist/google/errors.js';

export async function authorizeInstalledApp() {
  const log = process.env.WPP_BACKUP_TEST_AUTHORIZE_LOG;
  if (typeof log === 'string' && log.length > 0) {
    appendFileSync(
      log,
      `${JSON.stringify({
        pid: process.pid,
        coldChild: process.env.WPP_BACKUP_COLD_CHILD === '1',
      })}\n`,
    );
  }
  throw new GoogleError('GOOGLE_OAUTH_BROWSER');
}
