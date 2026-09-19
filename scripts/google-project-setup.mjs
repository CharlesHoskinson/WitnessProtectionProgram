import { runGoogleProjectSetupCli } from '../dist/google/index.js';

const code = await runGoogleProjectSetupCli(process.argv.slice(2));
process.exit(code);
