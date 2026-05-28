import { exec, ExecOptions } from '@actions/exec';
import * as core from '@actions/core';
import { isFeatureAvailable, restoreCache, saveCache } from '@actions/cache';
import * as io from '@actions/io';
import * as path from 'path';
import * as fs from 'fs';
import * as ini from 'ini';
import { ExportPresets, ExportPreset, BuildResult } from './types/GodotExport';
import sanitize from 'sanitize-filename';
import {
  GODOT_CONFIG_PATH,
  GODOT_DOWNLOAD_URL,
  GODOT_TEMPLATES_DOWNLOAD_URL,
  GODOT_WORKING_PATH,
  RELATIVE_PROJECT_PATH,
  WINE_PATH,
  EXPORT_DEBUG,
  PRESETS_TO_EXPORT,
  GODOT_VERBOSE,
  GODOT_BUILD_PATH,
  GODOT_PROJECT_FILE_PATH,
  EXPORT_PACK_ONLY,
  USE_GODOT_3,
  GODOT_EXPORT_TEMPLATES_PATH,
  CACHE_ACTIVE,
  GODOT_PROJECT_PATH,
  PROJECT_VERSION,
} from './constants';

const GODOT_EXECUTABLE = 'godot_executable';
const GODOT_ZIP = 'godot.zip';
const GODOT_TEMPLATES_FILENAME = 'godot_templates.tpz';
const EDITOR_SETTINGS_FILENAME = USE_GODOT_3 ? 'editor_settings-3.tres' : 'editor_settings-4.tres';

const GODOT_TEMPLATES_PATH = path.join(GODOT_WORKING_PATH, 'templates');

let godotExecutablePath: string;

async function exportBuilds(): Promise<BuildResult[]> {
  if (!hasExportPresets()) {
    core.setFailed(
      'No export_presets.cfg found. Please ensure you have defined at least one export via the Godot editor.',
    );
    return [];
  }

  core.startGroup('🕹️ Downloading Godot');
  await downloadGodot();
  core.endGroup();

  core.startGroup('🔍 Adding Editor Settings');
  await addEditorSettings();
  core.endGroup();

  if (PROJECT_VERSION) {
    core.startGroup('🔧 Adding Project Settings');
    setProjectVersion();
    core.endGroup();
  }

  if (WINE_PATH) {
    configureWindowsExport();
  }

  configureAndroidExport();

  if (!USE_GODOT_3) {
    await importProject();
  }

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

  await prepareExecutable();

  core.info('Preparing templates');
  if (USE_GODOT_3) {
    await prepareTemplates3();
  } else {
    await prepareTemplates4();
  }
}

async function setupWorkingPath(): Promise<void> {
  await io.mkdirP(GODOT_WORKING_PATH);
  core.info(`Working path created ${GODOT_WORKING_PATH}`);
}

async function downloadFile(
  filePath: string,
  downloadUrl: string,
  cacheKey: string,
  restoreKey: string,
): Promise<void> {
  if (CACHE_ACTIVE && isCacheFeatureAvailable()) {
    const cacheHit = await restoreCache([filePath], cacheKey, [restoreKey]);
    if (cacheHit) {
      core.info(`Restored cached file from ${cacheHit}`);
      return;
    }
  }
  core.info(`Downloading file from ${downloadUrl}`);
  await exec('wget', ['-nv', downloadUrl, '-O', filePath]);
  if (CACHE_ACTIVE && isCacheFeatureAvailable()) {
    await saveCache([filePath], cacheKey);
  }
}

async function downloadTemplates(): Promise<void> {
  const templatesPath = path.join(GODOT_WORKING_PATH, GODOT_TEMPLATES_FILENAME);
  const cacheKey = `godot-templates-${GODOT_TEMPLATES_DOWNLOAD_URL}`;
  const restoreKey = `godot-templates-${GODOT_TEMPLATES_DOWNLOAD_URL}`;
  await downloadFile(templatesPath, GODOT_TEMPLATES_DOWNLOAD_URL, cacheKey, restoreKey);
}

async function downloadExecutable(): Promise<void> {
  const executablePath = path.join(GODOT_WORKING_PATH, GODOT_ZIP);
  const cacheKey = `godot-executable-${GODOT_DOWNLOAD_URL}`;
  const restoreKey = `godot-executable-${GODOT_DOWNLOAD_URL}`;
  await downloadFile(executablePath, GODOT_DOWNLOAD_URL, cacheKey, restoreKey);
}

function isGhes(): boolean {
  const ghUrl = new URL(process.env['GITHUB_SERVER_URL'] || 'https://github.com');
  return ghUrl.hostname.toUpperCase() !== 'GITHUB.COM';
}

/**
 * Checks if the cache service is available for this runner.
 * Taken from https://github.com/actions/setup-node/blob/main/src/cache-utils.ts
 */
function isCacheFeatureAvailable(): boolean {
  if (isFeatureAvailable()) return true;

  if (isGhes()) {
    core.warning(
      'Cache action is only supported on GHES version >= 3.5. If you are on version >=3.5 Please check with GHES admin if Actions cache service is enabled or not.',
    );
    return false;
  }

  core.warning('The runner was not able to contact the cache service. Caching will be skipped');

  return false;
}

async function prepareExecutable(): Promise<void> {
  await downloadExecutable();

  const zipFile = path.join(GODOT_WORKING_PATH, GODOT_ZIP);
  let zipTo = path.join(GODOT_WORKING_PATH, GODOT_EXECUTABLE);

  core.info(`Extracting ${zipFile} to ${zipTo}`);

  if (process.platform === 'darwin') {
    // 7zip doesn't recognize the zipped .app file correctly, and tries to extract the whole thing
    // which results in it picking a single file from the .app and extracting it to the destination.
    // Also note that we have to extract to the directory. Extracting to a file name will result in a corrupted executable.
    await exec('ditto', ['-x', '-k', zipFile, GODOT_WORKING_PATH]);
    zipTo = GODOT_WORKING_PATH;
    core.info(`Extracted ${zipFile} to ${zipTo}`);
  } else {
    await exec('7z', ['x', zipFile, `-o${zipTo}`, '-y']);
  }

  const executablePath = findGodotExecutablePath(zipTo);
  if (!executablePath) {
    throw new Error('Could not find Godot executable');
  }
  core.info(`Found executable at ${executablePath}`);

  // chmod not needed for both Windows and macOS
  if (process.platform !== 'darwin' && process.platform !== 'win32') {
    fs.chmodSync(executablePath, '755');
  }

  godotExecutablePath = executablePath;
}

async function prepareTemplates3(): Promise<void> {
  const templateFile = path.join(GODOT_WORKING_PATH, GODOT_TEMPLATES_FILENAME);
  const tmpPath = path.join(GODOT_WORKING_PATH, 'tmp');
  const godotVersion = await getGodotVersion();
  const godotVersionTemplatesPath = path.join(GODOT_TEMPLATES_PATH, godotVersion);

  if (!fs.existsSync(godotVersionTemplatesPath)) {
    core.info(`⬇️ Missing templates for Godot ${godotVersion}. Downloading...`);
    await downloadTemplates();
  } else {
    core.info(`✅ Found templates for Godot ${godotVersion} at ${godotVersionTemplatesPath}`);
    return;
  }

  await exec('unzip', ['-q', templateFile, '-d', GODOT_WORKING_PATH]);
  await exec('mv', [GODOT_TEMPLATES_PATH, tmpPath]);
  await io.mkdirP(GODOT_TEMPLATES_PATH);
  await exec('mv', [tmpPath, godotVersionTemplatesPath]);
}

async function prepareTemplates4(): Promise<void> {
  const templateFile = path.join(GODOT_WORKING_PATH, GODOT_TEMPLATES_FILENAME);
  const godotVersion = await getGodotVersion();
  const godotVersionTemplatesPath = path.join(GODOT_EXPORT_TEMPLATES_PATH, godotVersion);

  if (!fs.existsSync(godotVersionTemplatesPath)) {
    core.info(`⬇️ Missing templates for Godot ${godotVersion}. Downloading...`);
    await downloadTemplates();
  } else {
    core.info(`✅ Found templates for Godot ${godotVersion} at ${godotVersionTemplatesPath}.`);
    return;
  }

  // just unzipping straight to the target directoryu
  await io.mkdirP(godotVersionTemplatesPath);
  // -j to ignore the directory structure in the zip file
  // 4.1 templates are in a subdirectory, so we need to ignore that
  await exec('unzip', ['-o', '-j', templateFile, '-d', godotVersionTemplatesPath]);
}

/**
 * Extracts the Godot version from the executable. The version is a bit inconsistent, so pulling it from the executable is the most reliable way.
 * @returns The Godot version as a string.
 */
async function getGodotVersion(): Promise<string> {
  let version = '';
  const options: ExecOptions = {
    ignoreReturnCode: true,
    listeners: {
      stdout: (data: Buffer) => {
        version += data.toString('utf-8');
      },
    },
  };

  await exec(godotExecutablePath, ['--version'], options);
  let versionLines = version.split(/\r?\n|\r|\n/g);
  versionLines = versionLines.filter(x => !!x.trim());
  version = versionLines.pop() || 'unknown';
  version = version.trim();
  const regex = /(\d+(\.\d+)+\.\w+(\.mono)?)/;
  const match = version.match(regex);
  if (match) {
    version = match[1];
  } else {
    throw new Error('Godot version could not be determined.');
  }

  return version;
}

/**
 * Converts a number to an emoji number. For example, 123 becomes 1️⃣2️⃣3️⃣
 */
function getEmojiNumber(number: number): string {
  const allEmojiNumbers = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
  let emojiNumber = '';

  for (const digit of number.toString()) {
    emojiNumber += allEmojiNumbers[parseInt(digit)];
  }

  return emojiNumber;
}

async function doExport(): Promise<BuildResult[]> {
  const buildResults: BuildResult[] = [];
  core.info(`🎯 Using project file at ${GODOT_PROJECT_FILE_PATH}`);

  let exportPresetIndex = 0;

  for (const preset of getExportPresets()) {
    core.startGroup(`${getEmojiNumber(++exportPresetIndex)} Export binary for preset "${preset.name}"`);

    const sanitizedName = sanitize(preset.name);
    const buildDir = path.join(GODOT_BUILD_PATH, sanitizedName);

    let executablePath;
    if (preset.export_path) {
      executablePath = path.join(buildDir, path.basename(preset.export_path));
    }

    if (!executablePath) {
      core.warning(`No file path set for preset "${preset.name}". Skipping export!`);
      core.endGroup();
      continue;
    }

    if (EXPORT_PACK_ONLY) {
      executablePath += '.pck';
    }

    await io.mkdirP(buildDir);
    let exportFlag = EXPORT_DEBUG ? '--export-debug' : '--export-release';
    if (EXPORT_PACK_ONLY) {
      exportFlag = '--export-pack';
    }
    if (USE_GODOT_3 && !EXPORT_PACK_ONLY) {
      exportFlag = EXPORT_DEBUG ? '--export-debug' : '--export';
    }

    let args = [GODOT_PROJECT_FILE_PATH, '--headless', exportFlag, preset.name, executablePath];
    if (USE_GODOT_3) {
      args = args.filter(x => x !== '--headless');
    }
    if (GODOT_VERBOSE) {
      args.push('--verbose');
    }

    const result = await exec(godotExecutablePath, args);
    if (result !== 0) {
      core.endGroup();
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

    core.endGroup();
  }

  return buildResults;
}

/**
 * Breadth first recursive search for the Godot executable.
 * @param basePath
 * @returns
 */
function findGodotExecutablePath(basePath: string): string | undefined {
  core.info(`🔍 Looking for Godot executable in ${basePath}`);
  const paths = fs.readdirSync(basePath);
  const dirs: string[] = [];

  for (const subPath of paths) {
    const fullPath = path.join(basePath, subPath);
    const stats = fs.statSync(fullPath);
    const isLinux = stats.isFile() && (path.extname(fullPath) === '.64' || path.extname(fullPath) === '.x86_64');
    const isMac = process.platform === 'darwin' && stats.isDirectory() && path.extname(fullPath) === '.app';
    if (isLinux) {
      return fullPath;
    } else if (isMac) {
      // on a Mac, we need to target the executable inside the .app directory. MacOS abstractions are weird
      return path.join(fullPath, 'Contents', 'MacOS', 'Godot');
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
  const exportPresets: ExportPreset[] = [];
  const projectPath = path.resolve(RELATIVE_PROJECT_PATH);

  if (!hasExportPresets()) {
    throw new Error(`Could not find export_presets.cfg in ${projectPath}`);
  }

  const exportFilePath = path.join(projectPath, 'export_presets.cfg');
  const iniStr = fs.readFileSync(exportFilePath, { encoding: 'utf8' });
  const presets = ini.decode(iniStr) as ExportPresets;

  if (presets?.preset) {
    for (const key in presets.preset) {
      const currentPreset = presets.preset[key];

      // If no presets are specified, export all of them. Otherwise only specified presets are exported.
      if (PRESETS_TO_EXPORT == null || PRESETS_TO_EXPORT.includes(currentPreset.name)) {
        exportPresets.push(currentPreset);
      } else {
        core.info(`🚫 Skipping export preset "${currentPreset.name}"`);
      }
    }
  } else {
    core.warning(`No presets found in export_presets.cfg at ${projectPath}`);
  }

  return exportPresets;
}

async function addEditorSettings(): Promise<void> {
  const editorSettingsDist = path.join(__dirname, EDITOR_SETTINGS_FILENAME);
  await io.mkdirP(GODOT_CONFIG_PATH);

  const editorSettingsPath = path.join(GODOT_CONFIG_PATH, EDITOR_SETTINGS_FILENAME);
  await io.cp(editorSettingsDist, editorSettingsPath, { force: false });
  core.info(`Wrote editor settings to ${editorSettingsPath}`);
}

function setProjectVersion(): void {
  // Always update or insert config/version under [application] section
  const projectFilePath = GODOT_PROJECT_FILE_PATH;
  const content = fs.readFileSync(projectFilePath, { encoding: 'utf8' });
  const lines = content.split(/\r?\n/);
  let inApplication = false;
  let versionSet = false;
  const output: string[] = [];

  for (const line of lines) {
    if (line.startsWith('[application]')) {
      inApplication = true;
      output.push(line);
      continue;
    }
    if (inApplication && line.startsWith('[')) {
      // Leaving [application] section, insert version if not set
      if (!versionSet && PROJECT_VERSION) {
        output.push(`config/version = "${PROJECT_VERSION}"`);
        versionSet = true;
      }
      inApplication = false;
    }
    if (inApplication && line.trim().startsWith('config/version')) {
      if (PROJECT_VERSION) {
        output.push(`config/version = "${PROJECT_VERSION}"`);
      }
      versionSet = true;
      continue;
    }
    output.push(line);
  }
  // If [application] is at the end and version not set
  if (inApplication && !versionSet && PROJECT_VERSION) {
    output.push(`config/version = "${PROJECT_VERSION}"`);
  }
  fs.writeFileSync(projectFilePath, output.join('\n'), { encoding: 'utf8' });
  if (PROJECT_VERSION) {
    core.info(`Set project version to ${PROJECT_VERSION}`);
  } else {
    core.warning(`No project version set.`);
  }
}

function configureWindowsExport(): void {
  core.startGroup('📝 Appending Wine editor settings');
  const rceditPath = path.join(__dirname, 'rcedit-x64.exe');
  const linesToWrite: string[] = [];

  core.info(`Writing rcedit path to editor settings ${rceditPath}`);
  core.info(`Writing wine path to editor settings ${WINE_PATH}`);

  const editorSettingsPath = path.join(GODOT_CONFIG_PATH, EDITOR_SETTINGS_FILENAME);
  linesToWrite.push(`export/windows/rcedit = "${rceditPath}"\n`);
  linesToWrite.push(`export/windows/wine = "${WINE_PATH}"\n`);

  fs.writeFileSync(editorSettingsPath, linesToWrite.join(''), { flag: 'a' });

  core.info(linesToWrite.join(''));
  core.info(`Wrote settings to ${editorSettingsPath}`);
  core.endGroup();
}

function configureAndroidExport(): void {
  core.startGroup('📝 Configuring android export');

  // nothing to write here at the moment
  // const editorSettingsPath = path.join(GODOT_CONFIG_PATH, EDITOR_SETTINGS_FILENAME);
  // const linesToWrite: string[] = [];

  // fs.writeFileSync(editorSettingsPath, linesToWrite.join(''), { flag: 'a' });

  // making the gradlew executable only on unix systems
  // if the file is not executable, the build will typically fail in incredibly cryptic ways
  if (process.platform !== 'win32') {
    try {
      if (fs.existsSync(path.join(GODOT_PROJECT_PATH, 'android/build/gradlew'))) {
        fs.chmodSync(path.join(GODOT_PROJECT_PATH, 'android/build/gradlew'), '755');
      }
      core.info('Made gradlew executable.');
    } catch (error) {
      core.warning(
        `Could not make gradlew executable. If you are getting cryptic build errors with your Android export, this may be the cause. ${error}`,
      );
    }
  }

  // core.info(linesToWrite.join(''));
  // core.info(`Wrote Android settings to ${editorSettingsPath}`);
  core.endGroup();
}

/** Open the editor in headless mode once, to import all assets, creating the `.godot` directory if it doesn't exist. */
async function importProject(): Promise<void> {
  core.startGroup('🎲 Import project');
  // this import tends to fail on MacOS for some reason (exit code 1), but a fail here doesn't necessarily mean the export will fail
  try {
    await exec(godotExecutablePath, [GODOT_PROJECT_FILE_PATH, '--headless', '--import']);
  } catch (error) {
    core.warning(`Import appears to have failed. Continuing anyway, but exports may fail. ${error}`);
  }
  core.endGroup();
}

export { exportBuilds };
