import * as io from '@actions/io';
import * as github from '@actions/github';
import * as core from '@actions/core';
import * as semver from 'semver';
import { setupExecutable, setupTemplates, runExport, createRelease, hasExportPresets } from './godot';
import * as path from 'path';
import * as os from 'os';

const actionWorkingPath = path.resolve(path.join(os.homedir(), '/.local/share/godot'));
const godotTemplateVersion = core.getInput('godot_template_version');
const relativeProjectPath = core.getInput('relative_project_path');
const githubClient = new github.GitHub(process.env['GITHUB_TOKEN'] ?? '');

async function main(): Promise<number> {
  if (!process.env['GITHUB_TOKEN']) {
    core.error('You must supply the GITHUB_TOKEN environment variable.');
    return 1;
  }

  if (!hasExportPresets()) {
    core.error(
      'No "export_presets.cfg" found. Please be sure you have defined at least 1 export from the Godot editor.',
    );
    return 1;
  }

  const newVersion = await getNewVersion();
  if (!newVersion) {
    core.error(
      'Could not establish a version for the release. Please check that "base_version" is a https://semver.org/ style string.',
    );
    return 1;
  }

  core.info(`Using release version ${newVersion.format()}`);

  await setupWorkingPath();
  await core.group('Godot setup', setupDependencies).catch(logAndExit);

  const exportResults = await core.group('Exporting', runExport).catch(logAndExit);
  if (exportResults) {
    await core
      .group(`Create release ${newVersion.format()}`, async () => {
        await createRelease(newVersion, exportResults);
      })
      .catch(logAndExit);
  }
  return 0;
}

async function setupWorkingPath(): Promise<void> {
  await io.mkdirP(actionWorkingPath);
  core.info(`Working path created ${actionWorkingPath}`);
}

async function setupDependencies(): Promise<number | Error> {
  const setups: Promise<void>[] = [];

  setups.push(setupExecutable());
  setups.push(setupTemplates());
  await Promise.all(setups);
  return 0;
}

async function getNewVersion(): Promise<semver.SemVer | null | undefined> {
  const base = semver.parse(core.getInput('base_version'));

  const release = await githubClient.repos.getLatestRelease({
    owner: process.env['GITHUB_REPOSITORY']?.split('/')[0] ?? '',
    repo: process.env['GITHUB_REPOSITORY']?.split('/')[1] ?? '',
  });

  if (release?.data?.tag_name) {
    let latest = semver.parse(release.data.tag_name);
    if (latest && base) {
      if (semver.gt(base, latest)) {
        latest = base;
      } else {
        latest = latest?.inc('patch') ?? null;
      }
      return latest;
    }
  }
  return base;
}

function logAndExit(error: Error): void {
  core.error(error.message);
  core.setFailed(error.message);
  process.exit(1);
}

main();

export { actionWorkingPath, godotTemplateVersion, relativeProjectPath, githubClient };
