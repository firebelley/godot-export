import { exec } from '@actions/exec';
import * as core from '@actions/core';
import * as io from '@actions/io';
import * as path from 'path';
import * as fs from 'fs';
import { actionWorkingPath, relativeProjectPath, godotTemplateVersion, githubClient } from './main';
import * as ini from 'ini';
import { ExportPresets, ExportPreset } from './types/ExportPresets';
import { Constants } from './types/Constants';
import sanitize from 'sanitize-filename';
import ExportResult from './types/ExportResult';
import { SemVer } from 'semver';

async function setupTemplates(): Promise<void> {
  await downloadTemplates();
  await prepareTemplates();
}

async function setupExecutable(): Promise<void> {
  await downloadExecutable();
  await prepareExecutable();
}

async function downloadTemplates(): Promise<void> {
  const downloadUrl = core.getInput('godot_export_templates_download_url');
  core.info(`Downloading Godot export templates from ${downloadUrl}`);

  const file = path.join(actionWorkingPath, Constants.GODOT_TEMPLATES);
  await exec('wget', ['-nv', downloadUrl, '-O', file]);
}

async function downloadExecutable(): Promise<void> {
  const downloadUrl = core.getInput('godot_executable_download_url');
  core.info(`Downloading Godot executable from ${downloadUrl}`);

  const file = path.join(actionWorkingPath, Constants.GODOT_ZIP);
  await exec('wget', ['-nv', downloadUrl, '-O', file]);
}

async function prepareExecutable(): Promise<void> {
  const zipFile = path.join(actionWorkingPath, Constants.GODOT_ZIP);
  const zipTo = path.join(actionWorkingPath, Constants.GODOT_EXECUTABLE);
  await exec('unzip', ['-q', zipFile, '-d', zipTo]);
  const executablePath = findExecutablePath(zipTo);
  if (!executablePath) {
    throw new Error('Could not find executable path');
  }
  core.info(`Found executable in ${executablePath}`);

  const executableFilePath = findExecutableFilePath(executablePath);
  if (!executableFilePath) {
    throw new Error('Could not find Godot executable');
  }
  const finalGodotPath = path.join(executablePath, 'godot');
  await exec('mv', [executableFilePath, finalGodotPath]);
  core.addPath(executablePath);
}

async function prepareTemplates(): Promise<void> {
  const templateFile = path.join(actionWorkingPath, Constants.GODOT_TEMPLATES);
  const templatesPath = path.join(actionWorkingPath, 'templates');
  const tmpPath = path.join(actionWorkingPath, 'tmp');

  await exec('unzip', ['-q', templateFile, '-d', actionWorkingPath]);
  await exec('mv', [templatesPath, tmpPath]);
  await io.mkdirP(templatesPath);
  await exec('mv', [tmpPath, path.join(templatesPath, godotTemplateVersion)]);
}

async function runExport(): Promise<ExportResult[]> {
  const exportResults: ExportResult[] = [];
  const exportPromises: Promise<number>[] = [];
  const projectPath = path.resolve(relativeProjectPath);
  core.info(`Using project file at ${projectPath}`);

  for (const preset of getExportPresets()) {
    const sanitized = sanitize(preset.name);
    const buildDir = path.join(actionWorkingPath, 'builds', sanitized);
    exportResults.push({
      preset,
      buildDirectory: buildDir,
      sanitizedName: sanitized,
    });

    let exportPath = path.join(buildDir, sanitized);
    if (preset.export_path) {
      exportPath = path.join(buildDir, path.basename(preset.export_path));
    }

    await io.mkdirP(buildDir);
    const promise = exec('godot', ['--export', preset.name, '--path', projectPath, exportPath]);
    exportPromises.push(promise);
  }

  await Promise.all(exportPromises);

  return exportResults;
}

async function createRelease(version: SemVer, exportResults: ExportResult[]): Promise<number> {
  const distPath = path.join(actionWorkingPath, 'dist');
  await io.mkdirP(distPath);

  const response = await githubClient.repos.createRelease({
    owner: process.env['GITHUB_REPOSITORY']?.split('/')[0] ?? '',
    /* eslint "@typescript-eslint/camelcase": "off" */
    tag_name: version.format(),
    repo: process.env['GITHUB_REPOSITORY']?.split('/')[1] ?? '',
    name: version.format(),
  });

  const promises: Promise<void>[] = [];
  for (const exportResult of exportResults) {
    promises.push(zipAndUpload(distPath, response.data.upload_url, exportResult));
  }

  await Promise.all(promises);
  return 0;
}

async function zipAndUpload(distPath: string, uploadUrl: string, exportResult: ExportResult): Promise<void> {
  const zipPath = path.join(distPath, `${exportResult.sanitizedName}.zip`);
  await exec('7z', ['a', zipPath, `${exportResult.buildDirectory}/`]);

  const content = fs.readFileSync(zipPath);
  await githubClient.repos.uploadReleaseAsset({
    file: content,
    headers: { 'content-type': 'application/zip', 'content-length': content.byteLength },
    name: path.basename(zipPath),
    url: uploadUrl,
  });
}

function findExecutablePath(basePath: string): string | undefined {
  const paths = fs.readdirSync(basePath);
  if (paths.length) {
    return path.join(basePath, paths[0]);
  }
  return undefined;
}

function findExecutableFilePath(basePath: string): string | undefined {
  let paths = fs.readdirSync(basePath);
  paths = paths.filter(p => {
    const fullPath = path.join(basePath, p);
    const isFile = fs.statSync(fullPath).isFile();
    return isFile;
  });
  if (paths.length) {
    return path.join(basePath, paths[0]);
  }
  return undefined;
}

function getExportPresets(): ExportPreset[] {
  const exportPrests: ExportPreset[] = [];
  const projectPath = path.resolve(relativeProjectPath);

  if (!hasExportPresets()) {
    throw new Error(`Could not find export_presets.cfg in ${projectPath}`);
  }

  const exportFilePath = path.join(projectPath, 'export_presets.cfg');
  const iniStr = fs.readFileSync(exportFilePath, { encoding: 'utf8' });
  const presets = ini.decode(iniStr) as ExportPresets;

  if (presets && presets.preset) {
    for (const key in presets.preset) {
      exportPrests.push(presets.preset[key]);
    }
  } else {
    core.warning(`No presets found in export_presets.cfg at ${projectPath}`);
  }

  return exportPrests;
}

function hasExportPresets(): boolean {
  try {
    const projectPath = path.resolve(relativeProjectPath);
    return fs.statSync(path.join(projectPath, 'export_presets.cfg')).isFile();
  } catch (e) {
    return false;
  }
}

export { setupExecutable, setupTemplates, runExport, createRelease, hasExportPresets };
