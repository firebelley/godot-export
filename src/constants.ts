import * as core from '@actions/core';
import path from 'path';
import * as os from 'os';

const RELATIVE_PROJECT_PATH = core.getInput('relative_project_path');
const GODOT_TEMPLATES_DOWNLOAD_URL = core.getInput('godot_export_templates_download_url');
const GODOT_DOWNLOAD_URL = core.getInput('godot_executable_download_url');
const SHOULD_CREATE_RELEASE = core.getInput('create_release') === 'true';
const ARCHIVE_EXPORT_OUTPUT = core.getInput('archive_export_output') === 'true';
const BASE_VERSION = core.getInput('base_version');
const RELATIVE_EXPORT_PATH = core.getInput('relative_project_path');
const GENERATE_RELEASE_NOTES = core.getInput('generate_release_notes') === 'true';

const GODOT_WORKING_PATH = path.resolve(path.join(os.homedir(), '/.local/share/godot'));

export {
  RELATIVE_PROJECT_PATH,
  GODOT_TEMPLATES_DOWNLOAD_URL,
  GODOT_DOWNLOAD_URL,
  SHOULD_CREATE_RELEASE,
  ARCHIVE_EXPORT_OUTPUT,
  BASE_VERSION,
  GODOT_WORKING_PATH,
  RELATIVE_EXPORT_PATH,
  GENERATE_RELEASE_NOTES,
};
