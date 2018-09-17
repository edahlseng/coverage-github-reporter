#!/usr/bin/env node

const args = require('args')

args
  .option(['j', 'coverage-json'], 'Relative path to istanbul coverage JSON', 'coverage/coverage-final.json')
  .option(['h', 'coverage-html'], 'Relative path to coverage html root (for artifact links)', 'coverage/lcov-report')
  .option(['b', 'branch'], 'Base branch to use if not PR', 'master')
  .option(['c', 'collapse-changes'], 'Collapses changes in the PR comment', false)

const {
  coverageJson,
  coverageHtml,
  branch,
  collapseChanges
} = args.parse(process.argv)

const { postComment } = require('./github-comment')

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
} catch (err) {
  console.error(err)
}
