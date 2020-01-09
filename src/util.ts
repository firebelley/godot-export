export function getRepositoryInfo(): { owner: string; repository: string } {
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
