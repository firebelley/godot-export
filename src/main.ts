import * as core from '@actions/core';
import { exportBuilds } from './godot';
import {
  ARCHIVE_OUTPUT,
  GODOT_ARCHIVE_PATH,
  GODOT_BUILD_PATH,
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

  if (ARCHIVE_OUTPUT) {
    await zipBuildResults(buildResults);
  }

  if (RELATIVE_EXPORT_PATH || USE_PRESET_EXPORT_PATH) {
    await moveBuildsToExportDirectory(buildResults, ARCHIVE_OUTPUT);
  }

  core.setOutput('build_directory', GODOT_BUILD_PATH);
  core.setOutput('archive_directory', GODOT_ARCHIVE_PATH);
  return 0;
}

// eslint-disable-next-line github/no-then
main().catch(err => {
  core.setFailed(err.message);
  process.exit(1);
});
