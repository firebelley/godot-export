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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const io = __importStar(require("@actions/io"));
const github = __importStar(require("@actions/github"));
const core = __importStar(require("@actions/core"));
const semver = __importStar(require("semver"));
const godot_1 = require("./godot");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const util_1 = require("./util");
const actionWorkingPath = path.resolve(path.join(os.homedir(), '/.local/share/godot'));
exports.actionWorkingPath = actionWorkingPath;
const godotTemplateVersion = core.getInput('godot_template_version');
exports.godotTemplateVersion = godotTemplateVersion;
const relativeProjectPath = core.getInput('relative_project_path');
exports.relativeProjectPath = relativeProjectPath;
const relativeProjectExportsPath = path.join(relativeProjectPath, 'exports');
exports.relativeProjectExportsPath = relativeProjectExportsPath;
const githubClient = new github.GitHub((_a = process.env.GITHUB_TOKEN, (_a !== null && _a !== void 0 ? _a : '')));
exports.githubClient = githubClient;
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        yield configCheck();
        const newVersion = yield getAndCheckNewVersion();
        core.info(`Using release version v${newVersion.format()}`);
        yield setupWorkingPath();
        yield core.group('Godot setup', setupDependencies);
        const exportResults = yield core.group('Exporting', godot_1.runExport);
        if (exportResults) {
            if (core.getInput('create_release') === 'true') {
                yield core.group(`Create release v${newVersion.format()}`, () => __awaiter(this, void 0, void 0, function* () {
                    yield godot_1.createRelease(newVersion, exportResults);
                }));
            }
            else {
                yield core.group(`Move exported files`, () => __awaiter(this, void 0, void 0, function* () {
                    yield godot_1.moveExports(exportResults);
                }));
            }
        }
        return 0;
    });
}
function configCheck() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!process.env.GITHUB_TOKEN) {
            throw new Error('You must supply the GITHUB_TOKEN environment variable.');
        }
        if (!godot_1.hasExportPresets()) {
            throw new Error('No "export_presets.cfg" found. Please be sure you have defined at least 1 export from the Godot editor.');
        }
    });
}
function getAndCheckNewVersion() {
    return __awaiter(this, void 0, void 0, function* () {
        const newVersion = yield getNewVersion();
        if (!newVersion) {
            throw new Error('Could not establish a version for the release. Please check that "base_version" is a https://semver.org/ style string.');
        }
        return newVersion;
    });
}
function setupWorkingPath() {
    return __awaiter(this, void 0, void 0, function* () {
        yield io.mkdirP(actionWorkingPath);
        core.info(`Working path created ${actionWorkingPath}`);
    });
}
function setupDependencies() {
    return __awaiter(this, void 0, void 0, function* () {
        const setups = [];
        setups.push(godot_1.setupExecutable());
        setups.push(godot_1.setupTemplates());
        yield Promise.all(setups);
        return 0;
    });
}
function getNewVersion() {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
        const base = semver.parse(core.getInput('base_version'));
        let release;
        try {
            const repoInfo = util_1.getRepositoryInfo();
            release = yield githubClient.repos.getLatestRelease({
                owner: repoInfo.owner,
                repo: repoInfo.repository,
            });
        }
        catch (e) {
            // throws error if no release exists
            // rather than using 2x api calls to see if releases exist and get latest
            // just catch the error and log a simple message
            core.info('No latest release found');
        }
        if ((_b = (_a = release) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.tag_name) {
            let latest = semver.parse(release.data.tag_name);
            if (latest && base) {
                if (semver.gt(base, latest)) {
                    latest = base;
                }
                else {
                    latest = (_d = (_c = latest) === null || _c === void 0 ? void 0 : _c.inc('patch'), (_d !== null && _d !== void 0 ? _d : null));
                }
                return latest;
            }
        }
        return base;
    });
}
function logAndExit(error) {
    core.error(error.message);
    core.setFailed(error.message);
    process.exit(1);
}
main().catch(logAndExit);
