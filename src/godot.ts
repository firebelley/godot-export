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
  GODOT_CONFIG_PATH,
  GODOT_DOWNLOAD_URL,
  GODOT_TEMPLATES_DOWNLOAD_URL,
  GODOT_WORKING_PATH,
  RELATIVE_PROJECT_PATH,
  WINE_PATH,
  EXPORT_DEBUG,
  GODOT_VERBOSE,
  GODOT_BUILD_PATH,
  GODOT_PROJECT_FILE_PATH,
  USE_GODOT_4,
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

  core.startGroup('🕹️ Download Godot');
  await downloadGodot();
  core.endGroup();

  core.startGroup('🔍 Adding Editor Settings');
  await addEditorSettings();
  core.endGroup();

  if (WINE_PATH) {
    configureWindowsExport();
  }

  core.startGroup('✨ Export binaries');
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
  await Promise.all([downloadTemplates(), downloadExecutable()]);
  await prepareExecutable();
  if (USE_GODOT_4) await prepareTemplates4();
  else await prepareTemplates();
}

async function setupWorkingPath(): Promise<void> {
  await io.mkdirP(GODOT_WORKING_PATH);
  core.info(`Working path created ${GODOT_WORKING_PATH}`);
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

async function prepareTemplates4(): Promise<void> {
  const templateFile = path.join(GODOT_WORKING_PATH, GODOT_TEMPLATES_FILENAME);
  const templatesPath = path.join(GODOT_WORKING_PATH, 'templates');
  const godotVersion = await getGodotVersion();
  const godotVersionPath = path.join(GODOT_WORKING_PATH, godotVersion);
  const exportTemplatesPath = path.join(GODOT_WORKING_PATH, 'export_templates');

  await exec('unzip', [templateFile, '-d', GODOT_WORKING_PATH]);
  await io.mkdirP(exportTemplatesPath);
  await exec('mv', [templatesPath, godotVersionPath]);
  await exec('mv', [godotVersionPath, exportTemplatesPath]);
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
  version = version.replace('.official', '').replace(/\.[a-z0-9]{9}$/g, '');

  if (!version) {
    throw new Error('Godot version could not be determined.');
  }

  return version;
}

async function doExport(): Promise<BuildResult[]> {
  const buildResults: BuildResult[] = [];
  core.info(`🎯 Using project file at ${GODOT_PROJECT_FILE_PATH}`);

  for (const preset of getExportPresets()) {
    const sanitizedName = sanitize(preset.name);
    const buildDir = path.join(GODOT_BUILD_PATH, sanitizedName);

    let executablePath;
    if (preset.export_path) {
      executablePath = path.join(buildDir, path.basename(preset.export_path));
    }

    if (!executablePath) {
      core.warning(`No file path set for preset "${preset.name}". Skipping export!`);
      continue;
    }

    await io.mkdirP(buildDir);
    const exportFlag = EXPORT_DEBUG ? '--export-debug' : '--export';
    const args = [GODOT_PROJECT_FILE_PATH, exportFlag, preset.name, executablePath];
    if (USE_GODOT_4) args.splice(1, 0, '--headless');
    if (GODOT_VERBOSE) {
      args.push('--verbose');
    }
    const result = await exec('godot', args);
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

function configureWindowsExport(): void {
  core.startGroup('📝 Appending Wine editor settings');
  const rceditPath = path.join(__dirname, 'rcedit-x64.exe');
  core.info(`Writing rcedit path to editor settings ${rceditPath}`);
  core.info(`Writing wine path to editor settings ${WINE_PATH}`);

  const editorSettings = 'editor_settings-3.tres';
  const editorSettingsPath = path.join(GODOT_CONFIG_PATH, editorSettings);
  fs.writeFileSync(editorSettingsPath, `export/windows/rcedit = "${rceditPath}"\n`, { flag: 'a' });
  fs.writeFileSync(editorSettingsPath, `export/windows/wine = "${WINE_PATH}"\n`, { flag: 'a' });

  // TODO: remove this
  core.info(fs.readFileSync(editorSettingsPath, { encoding: 'utf-8' }).toString());
  core.info(`Wrote settings to ${editorSettingsPath}`);
  core.endGroup();
}

function findGodotExecutablePath(basePath: string): string | undefined {
  const paths = fs.readdirSync(basePath);
  const dirs: string[] = [];
  for (const subPath of paths) {
    const fullPath = path.join(basePath, subPath);
    const stats = fs.statSync(fullPath);
    if (stats.isFile() && (path.extname(fullPath) === '.64' || path.extname(fullPath) === '.x86_64')) {
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

async function addEditorSettings(): Promise<void> {
  const editorSettings = 'editor_settings-3.tres';
  const editorSettingsDist = path.join(__dirname, editorSettings);
  await io.mkdirP(GODOT_CONFIG_PATH);

  const editorSettingsPath = path.join(GODOT_CONFIG_PATH, editorSettings);
  await io.cp(editorSettingsDist, editorSettingsPath, { force: false });
  core.info(`Wrote editor settings to ${editorSettingsPath}`);
}

export { exportBuilds };
