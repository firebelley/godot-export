import { BuildResult } from './types/GodotExport';
import * as semver from 'semver';
import * as core from '@actions/core';
import { BASE_VERSION, GENERATE_RELEASE_NOTES, ARCHIVE_SINGLE_RELEASE_OUTPUT } from './constants';
import { getRepositoryInfo, getGitHubClient } from './github';
import { exec } from '@actions/exec';
import { ExecOptions } from '@actions/exec/lib/interfaces';
import path from 'path';
import * as fs from 'fs';
import { zipBuildResults } from './file';
import { OctokitResponse } from '@octokit/types';

async function createRelease(buildResults: BuildResult[]): Promise<void> {
  if (buildResults.some(x => !x.archivePath)) {
    await zipBuildResults(buildResults);
  }

  core.startGroup('Creating release');
  await createGitHubRelease(buildResults);
  core.endGroup();
}

async function createGitHubRelease(buildResults: BuildResult[]): Promise<void> {
  const version = await getAndCheckNewVersion();

  const versionStr = `v${version.format()}`;
  core.info(`Using release version ${versionStr}`);

  const repoInfo = getRepositoryInfo();

  const body = GENERATE_RELEASE_NOTES ? await getReleaseBody() : undefined;
  const response = await getGitHubClient().rest.repos.createRelease({
    owner: repoInfo.owner,
    // eslint-disable-next-line camelcase, @typescript-eslint/naming-convention
    tag_name: versionStr,
    repo: repoInfo.repository,
    name: versionStr,
    // eslint-disable-next-line camelcase, @typescript-eslint/naming-convention
    target_commitish: process.env.GITHUB_SHA,
    body,
  });

  const promises: Promise<void>[] = [];
  for (const buildResult of buildResults) {
    promises.push(upload(response, buildResult));
  }

  await Promise.all(promises);
}

async function getAndCheckNewVersion(): Promise<semver.SemVer> {
  const newVersion = await getNewVersion();
  if (!newVersion) {
    const message =
      'Could not establish a version for the release. Please check that "base_version" is a https://semver.org/ style string.';
    core.setFailed(message);
    throw new Error(message);
  }
  return newVersion;
}

async function getNewVersion(): Promise<semver.SemVer | null | undefined> {
  const latestTag = await getLatestReleaseTagName();
  const parsedBaseVersion = semver.parse(BASE_VERSION);
  if (latestTag) {
    let latest = semver.parse(latestTag);
    if (latest && parsedBaseVersion) {
      if (semver.gt(parsedBaseVersion, latest)) {
        latest = semver.parse(parsedBaseVersion);
      } else {
        latest = latest?.inc('patch') ?? null;
      }
      return latest;
    }
  }
  return parsedBaseVersion;
}

async function getLatestReleaseTagName(): Promise<string | undefined> {
  try {
    const repoInfo = getRepositoryInfo();
    const release = await getGitHubClient().rest.repos.getLatestRelease({
      owner: repoInfo.owner,
      repo: repoInfo.repository,
    });
    return release.data.tag_name;
  } catch (e) {
    // throws error if no release exists
    // rather than using 2x api calls to see if releases exist and get latest
    // just catch the error and log a simple message
    core.info('No latest release found');
  }

  return undefined;
}

async function getReleaseBody(): Promise<string> {
  core.info('Generating release notes');

  const delimiter = '---delimiter---';
  const latestTag = await getLatestReleaseTagName();
  const args: string[] = ['log'];
  if (latestTag) {
    args.push(`${latestTag}..HEAD`);
  }
  args.push(`--format=%B%H${delimiter}`);

  let body = '';
  const options: ExecOptions = {
    ignoreReturnCode: true,
    listeners: {
      stdout: (data: Buffer) => {
        body += data.toString();
      },
    },
  };

  await exec('git', args, options);

  const changes = body.trim().split(delimiter);
  changes.reverse();
  const formattedChanges = changes
    .map(change => change.trim())
    .filter(change => change.length)
    .map(change => `- ${change}`);
  return formattedChanges.join('\n');
}

async function upload(
  // eslint-disable-next-line camelcase, @typescript-eslint/naming-convention
  response: OctokitResponse<{ upload_url: string; id: number }>,
  buildResult: BuildResult,
): Promise<void> {
  if (!buildResult.archivePath) {
    const message = 'Attempted to upload a non-existent archive.';
    core.setFailed(message);
    throw new Error(message);
  }

  let fileToUpload = buildResult.archivePath;
  if (!ARCHIVE_SINGLE_RELEASE_OUTPUT && buildResult.directoryEntryCount === 1) {
    fileToUpload = buildResult.executablePath;
  }

  core.info(`Uploading ${fileToUpload}`);

  const content = fs.readFileSync(fileToUpload);
  const repoInfo = getRepositoryInfo();
  await getGitHubClient().rest.repos.uploadReleaseAsset({
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    data: content,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    headers: { 'Content-Type': 'application/zip', 'Content-Length': content.byteLength },
    name: path.basename(fileToUpload),
    url: response.data.upload_url,
    owner: repoInfo.owner,
    repo: repoInfo.repository,
    // eslint-disable-next-line camelcase, @typescript-eslint/naming-convention
    release_id: response.data.id,
  });
}

export { createRelease };
