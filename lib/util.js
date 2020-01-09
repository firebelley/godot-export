"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function getRepositoryInfo() {
    var _a, _b;
    const repoInfo = (_a = process.env.GITHUB_REPOSITORY) === null || _a === void 0 ? void 0 : _a.split('/');
    let owner = '';
    let repository = '';
    if (((_b = repoInfo) === null || _b === void 0 ? void 0 : _b.length) === 2) {
        [owner, repository] = repoInfo;
    }
    return {
        owner,
        repository,
    };
}
exports.getRepositoryInfo = getRepositoryInfo;
