"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const exec_1 = require("@actions/exec");
const core = __importStar(require("@actions/core"));
const io = __importStar(require("@actions/io"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const main_1 = require("./main");
const ini = __importStar(require("ini"));
const Constants_1 = require("./types/Constants");
const sanitize_filename_1 = __importDefault(require("sanitize-filename"));
function setupTemplates() {
    return __awaiter(this, void 0, void 0, function* () {
        yield downloadTemplates();
        yield prepareTemplates();
    });
}
exports.setupTemplates = setupTemplates;
function setupExecutable() {
    return __awaiter(this, void 0, void 0, function* () {
        yield downloadExecutable();
        yield prepareExecutable();
    });
}
exports.setupExecutable = setupExecutable;
function downloadTemplates() {
    return __awaiter(this, void 0, void 0, function* () {
        const downloadUrl = core.getInput('godot_export_templates_download_url');
        core.info(`Downloading Godot export templates from ${downloadUrl}`);
        const file = path.join(main_1.actionWorkingPath, Constants_1.Constants.GODOT_TEMPLATES);
        yield exec_1.exec('wget', ['-nv', downloadUrl, '-O', file]);
    });
}
function downloadExecutable() {
    return __awaiter(this, void 0, void 0, function* () {
        const downloadUrl = core.getInput('godot_executable_download_url');
        core.info(`Downloading Godot executable from ${downloadUrl}`);
        const file = path.join(main_1.actionWorkingPath, Constants_1.Constants.GODOT_ZIP);
        yield exec_1.exec('wget', ['-nv', downloadUrl, '-O', file]);
    });
}
function prepareExecutable() {
    return __awaiter(this, void 0, void 0, function* () {
        const zipFile = path.join(main_1.actionWorkingPath, Constants_1.Constants.GODOT_ZIP);
        const zipTo = path.join(main_1.actionWorkingPath, Constants_1.Constants.GODOT_EXECUTABLE);
        yield exec_1.exec('unzip', ['-q', zipFile, '-d', zipTo]);
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
        yield exec_1.exec('mv', [executableFilePath, finalGodotPath]);
        core.addPath(executablePath);
    });
}
function prepareTemplates() {
    return __awaiter(this, void 0, void 0, function* () {
        const templateFile = path.join(main_1.actionWorkingPath, Constants_1.Constants.GODOT_TEMPLATES);
        const templatesPath = path.join(main_1.actionWorkingPath, 'templates');
        const tmpPath = path.join(main_1.actionWorkingPath, 'tmp');
        yield exec_1.exec('unzip', ['-q', templateFile, '-d', main_1.actionWorkingPath]);
        yield exec_1.exec('mv', [templatesPath, tmpPath]);
        yield io.mkdirP(templatesPath);
        yield exec_1.exec('mv', [tmpPath, path.join(templatesPath, main_1.godotTemplateVersion)]);
    });
}
function runExport() {
    return __awaiter(this, void 0, void 0, function* () {
        const exportResults = [];
        const exportPromises = [];
        const projectPath = path.resolve(main_1.relativeProjectPath);
        core.info(`Using project file at ${projectPath}`);
        for (const preset of getExportPresets()) {
            const sanitized = sanitize_filename_1.default(preset.name);
            const buildDir = path.join(main_1.actionWorkingPath, 'builds', sanitized);
            exportResults.push({
                preset,
                buildDirectory: buildDir,
                sanitizedName: sanitized,
            });
            let exportPath = path.join(buildDir, sanitized);
            if (preset.export_path) {
                exportPath = path.join(buildDir, path.basename(preset.export_path));
            }
            yield io.mkdirP(buildDir);
            const promise = exec_1.exec('godot', ['--export', `'${preset.name}'`, '--path', projectPath, exportPath]);
            exportPromises.push(promise);
        }
        yield Promise.all(exportPromises);
        return exportResults;
    });
}
exports.runExport = runExport;
function createRelease(version, exportResults) {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
        const distPath = path.join(main_1.actionWorkingPath, 'dist');
        yield io.mkdirP(distPath);
        const response = yield main_1.githubClient.repos.createRelease({
            owner: (_b = (_a = process.env['GITHUB_REPOSITORY']) === null || _a === void 0 ? void 0 : _a.split('/')[0], (_b !== null && _b !== void 0 ? _b : '')),
            /* eslint "@typescript-eslint/camelcase": "off" */
            tag_name: version.format(),
            repo: (_d = (_c = process.env['GITHUB_REPOSITORY']) === null || _c === void 0 ? void 0 : _c.split('/')[1], (_d !== null && _d !== void 0 ? _d : '')),
            name: version.format(),
        });
        const promises = [];
        for (const exportResult of exportResults) {
            promises.push(zipAndUpload(distPath, response.data.upload_url, exportResult));
        }
        yield Promise.all(promises);
        return 0;
    });
}
exports.createRelease = createRelease;
function zipAndUpload(distPath, uploadUrl, exportResult) {
    return __awaiter(this, void 0, void 0, function* () {
        const zipPath = path.join(distPath, `${exportResult.sanitizedName}.zip`);
        if (!fs.existsSync(zipPath)) {
            yield exec_1.exec('7z', ['a', zipPath, `${exportResult.buildDirectory}/*`]);
        }
        const content = fs.readFileSync(zipPath);
        yield main_1.githubClient.repos.uploadReleaseAsset({
            file: content,
            headers: { 'content-type': 'application/zip', 'content-length': content.byteLength },
            name: path.basename(zipPath),
            url: uploadUrl,
        });
    });
}
function findExecutablePath(basePath) {
    const paths = fs.readdirSync(basePath);
    if (paths.length) {
        return path.join(basePath, paths[0]);
    }
    return undefined;
}
function findExecutableFilePath(basePath) {
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
function getExportPresets() {
    const exportPrests = [];
    const projectPath = path.resolve(main_1.relativeProjectPath);
    if (!hasExportPresets()) {
        throw new Error(`Could not find export_presets.cfg in ${projectPath}`);
    }
    const exportFilePath = path.join(projectPath, 'export_presets.cfg');
    const iniStr = fs.readFileSync(exportFilePath, { encoding: 'utf8' });
    const presets = ini.decode(iniStr);
    if (presets && presets.preset) {
        for (const key in presets.preset) {
            exportPrests.push(presets.preset[key]);
        }
    }
    else {
        core.warning(`No presets found in export_presets.cfg at ${projectPath}`);
    }
    return exportPrests;
}
function hasExportPresets() {
    try {
        const projectPath = path.resolve(main_1.relativeProjectPath);
        return fs.statSync(path.join(projectPath, 'export_presets.cfg')).isFile();
    }
    catch (e) {
        return false;
    }
}
exports.hasExportPresets = hasExportPresets;
