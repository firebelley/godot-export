import * as core from '@actions/core';
import path from 'path';
import * as os from 'os';

const ARCHIVE_OUTPUT = core.getInput('archive_output') === 'true';
const GENERATE_RELEASE_NOTES = core.getInput('generate_release_notes') === 'true';
const GODOT_DOWNLOAD_URL = core.getInput('godot_executable_download_url');
const GODOT_TEMPLATES_DOWNLOAD_URL = core.getInput('godot_export_templates_download_url');
const RELATIVE_EXPORT_PATH = core.getInput('relative_export_path');
const RELATIVE_PROJECT_PATH = core.getInput('relative_project_path');
const WINE_PATH = core.getInput('wine_path');
const USE_PRESET_EXPORT_PATH = core.getInput('use_preset_export_path') === 'true';
const EXPORT_DEBUG = core.getInput('export_debug') === 'true';
const GODOT_VERBOSE = core.getInput('verbose') === 'true';
const ARCHIVE_ROOT_FOLDER = core.getInput('archive_root_folder') === 'true';
const USE_GODOT_3 = core.getInput('use_godot_3') === 'true';
const EXPORT_PACK_ONLY = core.getInput('export_as_pack') === 'true';

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

export {
  ARCHIVE_OUTPUT,
  ARCHIVE_ROOT_FOLDER,
  EXPORT_DEBUG,
  EXPORT_PACK_ONLY,
  GENERATE_RELEASE_NOTES,
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
};
