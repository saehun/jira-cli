# JIRA Cli for **
This is a jira cli program for personal use.

## Before start
  `JIRA_TOKEN` `JIRA_EMAIL` `JIRA_PROJECT_KEY` `JIRA_ENDPOINT` should be exported from (`.bashrc` or `.zshrc` or `.bash_profile` or ...)

  - `JIRA_TOKEN` is a basic auth token, which can be gathered from jira user setting page
  - `JIRA_EMAIL` is user's jira email
  - `JIRA_PROJECT_KEY` is `https://YOUR_SERVICE.atlassian.net/project/YOUR_PROJECT_KEY_IS_HERE`
  - `JIRA_ENDPOINT` is `https://YOUR_SERVICE.atlassian.net/rest`

## Usage
```
git clone https://github.com/minidonut/jira-cli.git
cd jira-cli
yarn install && yarn build
npm link
jira --help
```
