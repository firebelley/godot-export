import { exec } from '@actions/exec';
import * as core from '@actions/core';
import * as io from '@actions/io';
import * as path from 'path';
import * as fs from 'fs';
import * as ini from 'ini';
import { ExportPresets, ExportPreset, BuildResult } from './types/GodotExport';
import sanitize from 'sanitize-filename';
import { ExecOptions } from '@actions/exec/lib/interfaces';
import {
  GODOT_DOWNLOAD_URL,
  GODOT_TEMPLATES_DOWNLOAD_URL,
  GODOT_WORKING_PATH,
  RELATIVE_PROJECT_PATH,
  UPDATE_WINDOWS_ICONS,
} from './constants';

const GODOT_EXECUTABLE = 'godot_executable';
const GODOT_ZIP = 'godot.zip';
const GODOT_TEMPLATES_FILENAME = 'godot_templates.tpz';

async function exportBuilds(): Promise<BuildResult[]> {
  if (!hasExportPresets()) {
    core.setFailed(
      'No export_presets.cfg found. Please ensure you have defined at least one export via the Godot editor.',
    );
    return [];
  }

  core.startGroup('Download Godot');
  await downloadGodot();
  core.endGroup();

  if (UPDATE_WINDOWS_ICONS) {
    await configureWindowsExport();
  }

  core.startGroup('Export binaries');
  const results = await doExport();
  core.endGroup();

  return results;
}

function hasExportPresets(): boolean {
  try {
    const projectPath = path.resolve(RELATIVE_PROJECT_PATH);
    return fs.statSync(path.join(projectPath, 'export_presets.cfg')).isFile();
  } catch (e) {
    return false;
  }
}

async function downloadGodot(): Promise<void> {
  await setupWorkingPath();
  await Promise.all([setupTemplates(), setupExecutable()]);
}

async function setupWorkingPath(): Promise<void> {
  await io.mkdirP(GODOT_WORKING_PATH);
  core.info(`Working path created ${GODOT_WORKING_PATH}`);
}

async function setupTemplates(): Promise<void> {
  await downloadTemplates();
  await prepareTemplates();
}

async function setupExecutable(): Promise<void> {
  await downloadExecutable();
  await prepareExecutable();
}

async function downloadTemplates(): Promise<void> {
  core.info(`Downloading Godot export templates from ${GODOT_TEMPLATES_DOWNLOAD_URL}`);

  const file = path.join(GODOT_WORKING_PATH, GODOT_TEMPLATES_FILENAME);
  await exec('wget', ['-nv', GODOT_TEMPLATES_DOWNLOAD_URL, '-O', file]);
}

async function downloadExecutable(): Promise<void> {
  core.info(`Downloading Godot executable from ${GODOT_DOWNLOAD_URL}`);

  const file = path.join(GODOT_WORKING_PATH, GODOT_ZIP);
  await exec('wget', ['-nv', GODOT_DOWNLOAD_URL, '-O', file]);
}

async function prepareExecutable(): Promise<void> {
  const zipFile = path.join(GODOT_WORKING_PATH, GODOT_ZIP);
  const zipTo = path.join(GODOT_WORKING_PATH, GODOT_EXECUTABLE);
  await exec('7z', ['x', zipFile, `-o${zipTo}`, '-y']);
  const executablePath = findGodotExecutablePath(zipTo);
  if (!executablePath) {
    throw new Error('Could not find Godot executable');
  }
  core.info(`Found executable at ${executablePath}`);

  const finalGodotPath = path.join(path.dirname(executablePath), 'godot');
  await exec('mv', [executablePath, finalGodotPath]);
  core.addPath(path.dirname(finalGodotPath));
  await exec('chmod', ['+x', finalGodotPath]);
}

async function prepareTemplates(): Promise<void> {
  const templateFile = path.join(GODOT_WORKING_PATH, GODOT_TEMPLATES_FILENAME);
  const templatesPath = path.join(GODOT_WORKING_PATH, 'templates');
  const tmpPath = path.join(GODOT_WORKING_PATH, 'tmp');
  const godotVersion = await getGodotVersion();

  await exec('unzip', ['-q', templateFile, '-d', GODOT_WORKING_PATH]);
  await exec('mv', [templatesPath, tmpPath]);
  await io.mkdirP(templatesPath);
  await exec('mv', [tmpPath, path.join(templatesPath, godotVersion)]);
}

async function getGodotVersion(): Promise<string> {
  let version = '';
  const options: ExecOptions = {
    ignoreReturnCode: true,
    listeners: {
      stdout: (data: Buffer) => {
        version += data.toString();
      },
    },
  };

  await exec('godot', ['--version'], options);
  version = version.trim();
  version = version.replace('.official', '');

  if (!version) {
    throw new Error('Godot version could not be determined.');
  }

  return version;
}

async function doExport(): Promise<BuildResult[]> {
  const buildResults: BuildResult[] = [];
  const projectPath = path.resolve(path.join(RELATIVE_PROJECT_PATH, 'project.godot'));
  core.info(`Using project file at ${projectPath}`);

  for (const preset of getExportPresets()) {
    const sanitizedName = sanitize(preset.name);
    const buildDir = path.join(GODOT_WORKING_PATH, 'builds', sanitizedName);

    let executablePath;
    if (preset.export_path) {
      executablePath = path.join(buildDir, path.basename(preset.export_path));
    }

    if (!executablePath) {
      core.warning(`No file path set for preset "${preset.name}". Skipping export!`);
      continue;
    }

    await io.mkdirP(buildDir);
    const result = await exec('godot', [projectPath, '--export', preset.name, executablePath]);
    if (result !== 0) {
      throw new Error('1 or more exports failed');
    }

    const directoryEntries = fs.readdirSync(buildDir);
    buildResults.push({
      preset,
      sanitizedName,
      executablePath,
      directoryEntryCount: directoryEntries.length,
      directory: buildDir,
    });
  }

  return buildResults;
}

async function configureWindowsExport(): Promise<void> {
  core.startGroup('Installing Wine');
  await installWine();
  core.endGroup();

  core.startGroup('Adding editor settings');
  await addEditorSettings();
  core.endGroup();
}

async function installWine(): Promise<void> {
  await exec('sudo', ['apt-get', 'update']);
  await exec('sudo', ['apt-get', 'install', 'wine1.6-amd64']);
  await exec('wine64', ['--version']);
}

async function addEditorSettings(): Promise<void> {
  let winePath = '';
  const opts: ExecOptions = {
    ignoreReturnCode: true,
    listeners: {
      stdout: data => {
        winePath += data.toString();
      },
    },
  };
  await exec('which', ['wine64'], opts);
  winePath = winePath.trim();
  const rceditPath = path.join(__dirname, 'rcedit-x64.exe');
  writeEditorSettings(rceditPath, winePath);
}

function findGodotExecutablePath(basePath: string): string | undefined {
  const paths = fs.readdirSync(basePath);
  const dirs: string[] = [];
  for (const subPath of paths) {
    const fullPath = path.join(basePath, subPath);
    const stats = fs.statSync(fullPath);
    if (stats.isFile() && path.extname(fullPath) === '.64') {
      return fullPath;
    } else {
      dirs.push(fullPath);
    }
  }
  for (const dir of dirs) {
    return findGodotExecutablePath(dir);
  }
  return undefined;
}

function getExportPresets(): ExportPreset[] {
  const exportPrests: ExportPreset[] = [];
  const projectPath = path.resolve(RELATIVE_PROJECT_PATH);

  if (!hasExportPresets()) {
    throw new Error(`Could not find export_presets.cfg in ${projectPath}`);
  }

  const exportFilePath = path.join(projectPath, 'export_presets.cfg');
  const iniStr = fs.readFileSync(exportFilePath, { encoding: 'utf8' });
  const presets = ini.decode(iniStr) as ExportPresets;

  if (presets?.preset) {
    for (const key in presets.preset) {
      exportPrests.push(presets.preset[key]);
    }
  } else {
    core.warning(`No presets found in export_presets.cfg at ${projectPath}`);
  }

  return exportPrests;
}

function writeEditorSettings(rceditPath: string, winePath: string): void {
  core.info(`Writing rcedit path to editor settings ${rceditPath}`);
  core.info(`Writing wine path to editor settings ${winePath}`);

  const editorSettings = 'editor_settings-3.tres';
  const editorSettingsDist = path.join(__dirname, editorSettings);
  let file = fs.readFileSync(editorSettingsDist).toString('utf8');
  file = file.replace('{{ rcedit }}', rceditPath);
  file = file.replace('{{ wine }}', winePath);

  const editorSettingsPath = path.join(GODOT_WORKING_PATH, editorSettings);
  fs.writeFileSync(editorSettingsPath, file, { encoding: 'utf8' });
  core.info(`Wrote settings to ${editorSettingsPath}`);
}

export { exportBuilds };
