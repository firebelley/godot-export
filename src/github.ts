import { getOctokit } from '@actions/github';
import { GitHub } from '@actions/github/lib/utils';

function getGitHubClient(): InstanceType<typeof GitHub> {
  return getOctokit(process.env.GITHUB_TOKEN ?? '');
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
