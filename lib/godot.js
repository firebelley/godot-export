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
const sanitize_filename_1 = __importDefault(require("sanitize-filename"));
const util_1 = require("./util");
const GODOT_EXECUTABLE = 'godot_executable';
const GODOT_ZIP = 'godot.zip';
const GODOT_TEMPLATES = 'godot_templates.tpz';
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
        const file = path.join(main_1.actionWorkingPath, GODOT_TEMPLATES);
        yield exec_1.exec('wget', ['-nv', downloadUrl, '-O', file]);
    });
}
function downloadExecutable() {
    return __awaiter(this, void 0, void 0, function* () {
        const downloadUrl = core.getInput('godot_executable_download_url');
        core.info(`Downloading Godot executable from ${downloadUrl}`);
        const file = path.join(main_1.actionWorkingPath, GODOT_ZIP);
        yield exec_1.exec('wget', ['-nv', downloadUrl, '-O', file]);
    });
}
function prepareExecutable() {
    return __awaiter(this, void 0, void 0, function* () {
        const zipFile = path.join(main_1.actionWorkingPath, GODOT_ZIP);
        const zipTo = path.join(main_1.actionWorkingPath, GODOT_EXECUTABLE);
        yield exec_1.exec('7z', ['x', zipFile, `-o${zipTo}`, '-y']);
        const executablePath = findExecutablePath(zipTo);
        if (!executablePath) {
            throw new Error('Could not find Godot executable');
        }
        core.info(`Found executable at ${executablePath}`);
        const finalGodotPath = path.join(path.dirname(executablePath), 'godot');
        yield exec_1.exec('mv', [executablePath, finalGodotPath]);
        core.addPath(path.dirname(finalGodotPath));
    });
}
function prepareTemplates() {
    return __awaiter(this, void 0, void 0, function* () {
        const templateFile = path.join(main_1.actionWorkingPath, GODOT_TEMPLATES);
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
        const projectPath = path.resolve(path.join(main_1.relativeProjectPath, 'project.godot'));
        let dirNo = 0;
        core.info(`Using project file at ${projectPath}`);
        for (const preset of getExportPresets()) {
            const sanitized = sanitize_filename_1.default(preset.name);
            const buildDir = path.join(main_1.actionWorkingPath, 'builds', dirNo.toString());
            dirNo++;
            exportResults.push({
                preset,
                buildDirectory: buildDir,
                sanitizedName: sanitized,
            });
            let exportPath;
            if (preset.export_path) {
                exportPath = path.join(buildDir, path.basename(preset.export_path));
            }
            if (!exportPath) {
                core.warning(`No file path set for preset "${preset.name}". Skipping export!`);
                continue;
            }
            yield io.mkdirP(buildDir);
            const result = yield exec_1.exec('godot', [projectPath, '--export', preset.name, exportPath]);
            if (result !== 0) {
                throw new Error('1 or more exports failed');
            }
        }
        return exportResults;
    });
}
exports.runExport = runExport;
function createRelease(version, exportResults) {
    return __awaiter(this, void 0, void 0, function* () {
        const versionStr = `v${version.format()}`;
        const repoInfo = util_1.getRepositoryInfo();
        const response = yield main_1.githubClient.repos.createRelease({
            owner: repoInfo.owner,
            tag_name: versionStr,
            repo: repoInfo.repository,
            name: versionStr,
            target_commitish: process.env.GITHUB_SHA,
        });
        const promises = [];
        for (const exportResult of exportResults) {
            promises.push(upload(response.data.upload_url, yield zip(exportResult)));
        }
        yield Promise.all(promises);
        return 0;
    });
}
exports.createRelease = createRelease;
function moveExports(exportResults) {
    return __awaiter(this, void 0, void 0, function* () {
        yield io.mkdirP(main_1.relativeProjectExportsPath);
        const promises = [];
        for (const exportResult of exportResults) {
            promises.push(move(yield zip(exportResult)));
        }
        yield Promise.all(promises);
        return 0;
    });
}
exports.moveExports = moveExports;
function zip(exportResult) {
    return __awaiter(this, void 0, void 0, function* () {
        const distPath = path.join(main_1.actionWorkingPath, 'dist');
        yield io.mkdirP(distPath);
        const zipPath = path.join(distPath, `${exportResult.sanitizedName}.zip`);
        if (exportResult.preset.platform.toLowerCase() === 'mac osx') {
            const baseName = path.basename(exportResult.preset.export_path);
            const macPath = path.join(exportResult.buildDirectory, baseName);
            yield exec_1.exec('mv', [macPath, zipPath]);
        }
        else if (!fs.existsSync(zipPath)) {
            yield exec_1.exec('7z', ['a', zipPath, `${exportResult.buildDirectory}/*`]);
        }
        return zipPath;
    });
}
function upload(uploadUrl, zipPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const content = fs.readFileSync(zipPath);
        yield main_1.githubClient.repos.uploadReleaseAsset({
            file: content,
            headers: { 'content-type': 'application/zip', 'content-length': content.byteLength },
            name: path.basename(zipPath),
            url: uploadUrl,
        });
    });
}
function move(zipPath) {
    return __awaiter(this, void 0, void 0, function* () {
        yield io.mv(zipPath, path.join(main_1.relativeProjectExportsPath, path.basename(zipPath)));
    });
}
function findExecutablePath(basePath) {
    const paths = fs.readdirSync(basePath);
    const dirs = [];
    for (const subPath of paths) {
        const fullPath = path.join(basePath, subPath);
        const stats = fs.statSync(fullPath);
        if (stats.isFile() && path.extname(fullPath) === '.64') {
            return fullPath;
        }
        else {
            dirs.push(fullPath);
        }
    }
    for (const dir of dirs) {
        return findExecutablePath(dir);
    }
    return undefined;
}
function getExportPresets() {
    var _a;
    const exportPrests = [];
    const projectPath = path.resolve(main_1.relativeProjectPath);
    if (!hasExportPresets()) {
        throw new Error(`Could not find export_presets.cfg in ${projectPath}`);
    }
    const exportFilePath = path.join(projectPath, 'export_presets.cfg');
    const iniStr = fs.readFileSync(exportFilePath, { encoding: 'utf8' });
    const presets = ini.decode(iniStr);
    if ((_a = presets) === null || _a === void 0 ? void 0 : _a.preset) {
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
