const git = require('git-last-commit')
const fs = require('fs')

git.getLastCommit((err, commit) => {
  if (err) throw err
  const data = JSON.stringify(commit)
  fs.writeFile('version.json', data, e => console.error(e))
})
