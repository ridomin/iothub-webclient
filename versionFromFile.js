async function versionFromFile (cb) {
  window.fetch('./version.json')
    .then(j => {
      j.json()
        .then(d => {
          console.log(d)
          cb(d.shortHash)
        })
    })
}

export { versionFromFile }
