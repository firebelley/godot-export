import * as core from '@actions/core';
import { exportBuilds } from './godot';
import { createRelease } from './release';
import {
  SHOULD_CREATE_RELEASE,
  ARCHIVE_EXPORT_OUTPUT,
  RELATIVE_EXPORT_PATH,
  USE_PRESET_EXPORT_PATH,
} from './constants';
import { zipBuildResults, moveBuildsToExportDirectory } from './file';

async function main(): Promise<number> {
  const buildResults = await exportBuilds();
  if (!buildResults.length) {
    core.setFailed('No valid export presets found, exiting.');
    return 1;
  }

  if (ARCHIVE_EXPORT_OUTPUT) {
    await zipBuildResults(buildResults);
  }

  if (RELATIVE_EXPORT_PATH || USE_PRESET_EXPORT_PATH) {
    await moveBuildsToExportDirectory(buildResults, ARCHIVE_EXPORT_OUTPUT);
  }

  if (SHOULD_CREATE_RELEASE) {
    await createRelease(buildResults);
  }

  return 0;
}

// eslint-disable-next-line github/no-then
main().catch(err => {
  core.setFailed(err.message);
  process.exit(1);
});
