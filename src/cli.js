#!/usr/bin/env node

const args = require('args')

args
  .option(['j', 'coverage-json'], 'Relative path to istanbul coverage JSON', 'coverage/coverage-final.json')
  .option(['h', 'coverage-html'], 'Relative path to coverage html root (for artifact links)', 'coverage/lcov-report')
  .option(['b', 'branch'], 'Base branch to use if not PR', 'master')
  .option(['c', 'collapse-changes'], 'Collapses changes in the PR comment', false)
  .option(['', 'status-minimum-coverage'], 'Minimum coverage required for the GitHub status check', null)
  .option(['', 'status-minimum-change'], 'Minimum change required for the GitHub status check', null)

const {
  coverageJson,
  coverageHtml,
  branch,
  collapseChanges,
  statusMinimumCoverage,
  statusMinimumChange
} = args.parse(process.argv)

const { postComment, postStatus } = require('./github-comment')

try {
  const params = {
    root: process.cwd(),
    coverageJsonFilename: coverageJson,
    coverageHtmlRoot: coverageHtml,
    defaultBaseBranch: branch,
    collapseChanges
  }
  const url = postComment(params)
  console.log('Posted to ', url)
  (statusMinimumCoverage || statusMinimumChange) && postStatus({
      coverageJsonFilename: coverageJson,
      coverageHtmlRoot: coverageHtml,
      statusMinimumCoverage,
      statusMinimumChange
  })
} catch (err) {
  console.error(err)
}
