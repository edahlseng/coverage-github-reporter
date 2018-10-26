const { resolve } = require('path')
const { isEmpty, isNil } = require('ramda')
const { Bot } = require('./bot')
const { parseFile } = require('./coverage/parse')
const { format } = require('./coverage/format')
const fetch = require('node-fetch');

const identity = x => x

const collapsed = title => content => isNil(content) || isEmpty(content) ? '' : `<details>
<summary><strong>${title}</strong></summary>
${content}
</details>
`

exports.formatComment = function ({
  formatted: {
    status,
    changed,
    folders
  },
  baseArtifactUrl,
  buildNum,
  buildUrl,
  priorBuildNum,
  priorBuildUrl,
  branch,
  changesFormatter = identity
}) {
  return `
**[Code Coverage](${baseArtifactUrl}/index.html): ${status}**
${changesFormatter(changed)}
<details>
<summary><strong>🗂 Folder Coverage</strong></summary>
${folders}
</details>
<p>

From **Circle CI [build ${buildNum}](${buildUrl})** ${priorBuildNum
    ? `compared to [build ${priorBuildNum}](${priorBuildUrl}) (from \`${branch}\` branch)`
    : ''} – 🤖[coverage-github-reporter](https://github.com/vivlabs/coverage-github-reporter)`
}

const bot = Bot.create()

exports.postComment = function postComment ({
  coverageJsonFilename = 'coverage/coverage-final.json',
  coverageHtmlRoot = 'coverage/lcov-report',
  defaultBaseBranch = 'master',
  root = process.cwd(),
  collapseChanges
}) {

  const coverage = parseFile(root, resolve(root, coverageJsonFilename))

  const branch = bot.getBaseBranch(defaultBaseBranch)
  const { priorCoverage, priorBuild } = bot.getPriorBuild(branch, coverageJsonFilename)

  if (!priorCoverage) {
    console.log(`No prior coverage found`)
  }

  const baseArtifactUrl = bot.artifactUrl(`/${coverageHtmlRoot}`)
  const text = exports.formatComment({
    formatted: format(coverage, priorCoverage, baseArtifactUrl),
    baseArtifactUrl,
    buildNum: process.env.CIRCLE_BUILD_NUM,
    buildUrl: process.env.CIRCLE_BUILD_URL,
    priorBuildNum: priorBuild,
    priorBuildUrl: process.env.CIRCLE_BUILD_URL.replace(/\/\d+$/, `/${priorBuild}`),
    branch,
    changesFormatter: collapseChanges ? collapsed('File Changes') : identity
  })

  const result = JSON.parse(bot.comment(text))
  return result && result.html_url
}

function fetchResponseToJson(response) {
	return response.json()
	.then(json => response.ok ? Promise.resolve(json) : Promise.reject(json));
}

function fetchResponseWithBodyText(response) {
	return response.text()
	.then(text => response.ok ? Promise.resolve({...response, body: text}) : Promise.reject({...response, body: text}));
}

exports.postStatus = function postStatus ({
    coverageJsonFilename = 'coverage/coverage-final.json',
    coverageHtmlRoot = 'coverage/lcov-report',
    defaultBaseBranch = 'master',
    root = process.cwd(),
    statusMinimumChange,
    statusMinimumCoverage
}) {
    const baseArtifactUrl = bot.artifactUrl(`/${coverageHtmlRoot}`)

    const branch = bot.getBaseBranch(defaultBaseBranch)
    const { priorCoverage, priorBuild } = bot.getPriorBuild(branch, coverageJsonFilename)
    const coverage = parseFile(root, resolve(root, coverageJsonFilename))
    const passedMinimumChange = statusMinimumChange && priorCoverage ? (coverage['*'].percent - priorCoverage['*'].percent) > statusMinimumChange : true
    const passedMinimumCoverage = statusMinimumCoverage ? coverage['*'].percent > statusMinimumCoverage : true

    const state = passedMinimumChange && passedMinimumCoverage ? 'success' : 'failure'
    const description = passedMinimumChange && passedMinimumCoverage ? 'Your code coverage passed!'
        : !passedMinimumChange && !passedMinimumCoverage ? 'Your code coverage was less than the minimum required, and the coverage change was also less than the minimum required.'
        : !passedMinimumChange ? 'Your code coverage change was less than the minimum required.'
        : 'Your code coverage was less than the minimum required.'

    return fetch(`https://api.github.com/repos/${process.env.CIRCLE_PROJECT_USERNAME}/${process.env.CIRCLE_PROJECT_REPONAME}/statuses/${process.env.CIRCLE_SHA1}`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            Accept: 'application/vnd.github.v3+json',
            authorization: `token ${process.env.GH_AUTH_TOKEN}`
        },
        body: JSON.stringify({
            state: state,
            target_url: `${baseArtifactUrl}/index.html`,
            description: description,
            context: "ci/circleci: tests/code-coverage"
        })
    })
    .then(response => {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.indexOf('application/json') !== -1) {
            return fetchResponseToJson(response);
        } else {
            return fetchResponseWithBodyText(response);
        }
    });
}
