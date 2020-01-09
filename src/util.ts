export function getRepositoryInfo(): { owner: string; repository: string } {
  const repoInfo = process.env.GITHUB_REPOSITORY?.split('/');

  let owner = '';
  let repository = '';
  if (repoInfo && repoInfo.length === 2) {
    owner = repoInfo[0];
    repository = repoInfo[1];
  }

  return {
    owner,
    repository,
  };
}
