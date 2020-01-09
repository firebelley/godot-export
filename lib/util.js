"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function getRepositoryInfo() {
    var _a;
    const repoInfo = (_a = process.env.GITHUB_REPOSITORY) === null || _a === void 0 ? void 0 : _a.split('/');
    let owner = '';
    let repository = '';
    if (repoInfo && repoInfo.length === 2) {
        [owner, repository] = repoInfo;
    }
    return {
        owner,
        repository,
    };
}
exports.getRepositoryInfo = getRepositoryInfo;
