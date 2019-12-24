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
const actionWorkingPath = path.resolve(path.join(os.homedir(), '/.local/share/godot'));
exports.actionWorkingPath = actionWorkingPath;
const godotTemplateVersion = core.getInput('godot_template_version');
exports.godotTemplateVersion = godotTemplateVersion;
const relativeProjectPath = core.getInput('relative_project_path');
exports.relativeProjectPath = relativeProjectPath;
const githubClient = new github.GitHub((_a = process.env['GITHUB_TOKEN'], (_a !== null && _a !== void 0 ? _a : '')));
exports.githubClient = githubClient;
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!process.env['GITHUB_TOKEN']) {
            core.error('You must supply the GITHUB_TOKEN environment variable.');
            return 1;
        }
        const newVersion = yield getNewVersion();
        if (!newVersion) {
            core.error('Could not establish a version for the release. Please check that "base_version" is a https://semver.org/ style string.');
            return 1;
        }
        core.info(`Using release version ${newVersion.format()}`);
        yield setupWorkingPath();
        yield core.group('Godot setup', setupDependencies).catch(logAndExit);
        const exportResults = yield core.group('Exporting', godot_1.runExport).catch(logAndExit);
        if (exportResults) {
            yield core
                .group(`Create release ${newVersion.format()}`, () => __awaiter(this, void 0, void 0, function* () {
                yield godot_1.createRelease(newVersion, exportResults);
            }))
                .catch(logAndExit);
        }
        return 0;
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
    var _a, _b, _c, _d, _e, _f, _g, _h;
    return __awaiter(this, void 0, void 0, function* () {
        const base = semver.parse(core.getInput('base_version'));
        const release = yield githubClient.repos.getLatestRelease({
            owner: (_b = (_a = process.env['GITHUB_REPOSITORY']) === null || _a === void 0 ? void 0 : _a.split('/')[0], (_b !== null && _b !== void 0 ? _b : '')),
            repo: (_d = (_c = process.env['GITHUB_REPOSITORY']) === null || _c === void 0 ? void 0 : _c.split('/')[1], (_d !== null && _d !== void 0 ? _d : '')),
        });
        if ((_f = (_e = release) === null || _e === void 0 ? void 0 : _e.data) === null || _f === void 0 ? void 0 : _f.tag_name) {
            let latest = semver.parse(release.data.tag_name);
            if (latest && base) {
                if (semver.gt(base, latest)) {
                    latest = base;
                }
                else {
                    latest = (_h = (_g = latest) === null || _g === void 0 ? void 0 : _g.inc('patch'), (_h !== null && _h !== void 0 ? _h : null));
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
main();
