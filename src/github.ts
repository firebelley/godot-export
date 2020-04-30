import * as github from '@actions/github';

function getGitHubClient(): github.GitHub {
  return new github.GitHub(process.env.GITHUB_TOKEN ?? '');
}

function getRepositoryInfo(): { owner: string; repository: string } {
  const repoInfo = process.env.GITHUB_REPOSITORY?.split('/');

  let owner = '';
  let repository = '';
  if (repoInfo?.length === 2) {
    [owner, repository] = repoInfo;
  }

  return {
    owner,
    repository,
  };
}

export { getGitHubClient, getRepositoryInfo };
