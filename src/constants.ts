import * as core from '@actions/core';
import path from 'path';
import * as os from 'os';

const ARCHIVE_OUTPUT = core.getBooleanInput('archive_output');
const CACHE_ACTIVE = core.getBooleanInput('cache');
// const GENERATE_RELEASE_NOTES = core.getBooleanInput('generate_release_notes');
const GODOT_DOWNLOAD_URL = core.getInput('godot_executable_download_url');
const GODOT_TEMPLATES_DOWNLOAD_URL = core.getInput('godot_export_templates_download_url');
const RELATIVE_EXPORT_PATH = core.getInput('relative_export_path');
const RELATIVE_PROJECT_PATH = core.getInput('relative_project_path');
const WINE_PATH = core.getInput('wine_path');
const USE_PRESET_EXPORT_PATH = core.getBooleanInput('use_preset_export_path');
const EXPORT_DEBUG = core.getBooleanInput('export_debug');
const GODOT_VERBOSE = core.getBooleanInput('verbose');
const ARCHIVE_ROOT_FOLDER = core.getBooleanInput('archive_root_folder');
const USE_GODOT_3 = core.getBooleanInput('use_godot_3');
const EXPORT_PACK_ONLY = core.getBooleanInput('export_as_pack');

// Parse export targets
const exportPresetsStr = core.getInput('presets_to_export').trim();
let exportPresets: string[] | null = null;

if (exportPresetsStr !== '') {
  try {
    // splitting by comma and trimming each target. Presets should not begin or end with a space.
    exportPresets = exportPresetsStr.split(',').map(s => s.trim());
    if (exportPresetsStr.length === 0) {
      exportPresets = null;
    }
  } catch (error) {
    core.warning('Malformed presets_to_export input. Exporting all presets by default.');
  }
}

const PRESETS_TO_EXPORT = exportPresets;

const ANDROID_SDK_PATH = core.getInput('android_sdk_path');

const ANDROID_DEBUG_KEYSTORE_PATH = path.resolve(core.getInput('android_keystore_debug_path'));
const ANDROID_DEBUG_KEYSTORE_USERNAME = core.getInput('android_keystore_debug_username');
const ANDROID_DEBUG_KEYSTORE_PASSWORD = core.getInput('android_keystore_debug_password');

const ANDROID_RELEASE_KEYSTORE_PATH = path.resolve(core.getInput('android_keystore_release_path'));
const ANDROID_RELEASE_KEYSTORE_USERNAME = core.getInput('android_keystore_release_username');
const ANDROID_RELEASE_KEYSTORE_PASSWORD = core.getInput('android_keystore_release_password');

const GODOT_WORKING_PATH = path.resolve(path.join(os.homedir(), '/.local/share/godot'));
const GODOT_EXPORT_TEMPLATES_PATH = path.resolve(
  path.join(
    os.homedir(),
    process.platform === 'darwin'
      ? 'Library/Application Support/Godot/export_templates'
      : '/.local/share/godot/export_templates',
  ),
);
const GODOT_CONFIG_PATH = path.resolve(path.join(os.homedir(), '/.config/godot'));
const GODOT_BUILD_PATH = path.join(GODOT_WORKING_PATH, 'builds');
const GODOT_ARCHIVE_PATH = path.join(GODOT_WORKING_PATH, 'archives');
const GODOT_PROJECT_PATH = path.resolve(path.join(RELATIVE_PROJECT_PATH));
const GODOT_PROJECT_FILE_PATH = path.join(GODOT_PROJECT_PATH, 'project.godot');

// the project level settings can be overridden by environment variables
if (ANDROID_DEBUG_KEYSTORE_PATH)
  core.exportVariable('GODOT_ANDROID_KEYSTORE_DEBUG_PATH', ANDROID_DEBUG_KEYSTORE_PATH);
if (ANDROID_DEBUG_KEYSTORE_USERNAME)
  core.exportVariable('GODOT_ANDROID_KEYSTORE_DEBUG_USER', ANDROID_DEBUG_KEYSTORE_USERNAME);
if (ANDROID_DEBUG_KEYSTORE_PASSWORD)
  core.exportVariable('GODOT_ANDROID_KEYSTORE_DEBUG_PASSWORD', ANDROID_DEBUG_KEYSTORE_PASSWORD);
if (ANDROID_RELEASE_KEYSTORE_PATH)
  core.exportVariable('GODOT_ANDROID_KEYSTORE_RELEASE_PATH', ANDROID_RELEASE_KEYSTORE_PATH);
if (ANDROID_RELEASE_KEYSTORE_USERNAME)
  core.exportVariable('GODOT_ANDROID_KEYSTORE_RELEASE_USER', ANDROID_RELEASE_KEYSTORE_USERNAME);
if (ANDROID_RELEASE_KEYSTORE_PASSWORD)
  core.exportVariable('GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD', ANDROID_RELEASE_KEYSTORE_PASSWORD);

export {
  ARCHIVE_OUTPUT,
  ARCHIVE_ROOT_FOLDER,
  CACHE_ACTIVE,
  EXPORT_DEBUG,
  EXPORT_PACK_ONLY,
  PRESETS_TO_EXPORT,
  // GENERATE_RELEASE_NOTES,
  GODOT_ARCHIVE_PATH,
  GODOT_BUILD_PATH,
  GODOT_CONFIG_PATH,
  GODOT_DOWNLOAD_URL,
  GODOT_EXPORT_TEMPLATES_PATH,
  GODOT_PROJECT_FILE_PATH,
  GODOT_PROJECT_PATH,
  GODOT_TEMPLATES_DOWNLOAD_URL,
  GODOT_VERBOSE,
  GODOT_WORKING_PATH,
  RELATIVE_EXPORT_PATH,
  RELATIVE_PROJECT_PATH,
  USE_GODOT_3,
  USE_PRESET_EXPORT_PATH,
  WINE_PATH,
  ANDROID_SDK_PATH,
  ANDROID_DEBUG_KEYSTORE_PATH,
  ANDROID_DEBUG_KEYSTORE_USERNAME,
  ANDROID_DEBUG_KEYSTORE_PASSWORD,
  ANDROID_RELEASE_KEYSTORE_PATH,
  ANDROID_RELEASE_KEYSTORE_USERNAME,
  ANDROID_RELEASE_KEYSTORE_PASSWORD,
};
