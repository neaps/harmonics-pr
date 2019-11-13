require('dotenv').config()
const Octokit = require('@octokit/rest')
const http = require('http')
const port = process.env.PORT ? process.env.PORT : 80
const cors = require('cors')({
  origin: true
})
const octokit = new Octokit({
  auth: `token ${process.env.NEAPS_GITHUB_TOKEN}`
})

const server = http.createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  )

  if (request.method !== 'POST') {
    response.end()
    return
  }
  let body = ''
  request.on('data', chunk => {
    body += chunk.toString()
  })
  request.on('end', async () => {
    body = JSON.parse(body)
    const { station, contact } = body
    const branchName = `request-${station.country}-${station.id}`
    try {
      const hash = await octokit.git.getRef({
        owner: 'neaps',
        repo: 'tide-database',
        ref: `heads/master`
      })
      await octokit.git.createRef({
        owner: 'neaps',
        repo: 'tide-database',
        ref: `refs/heads/${branchName}`,
        sha: hash.data.object.sha
      })
      let content = new Buffer(JSON.stringify(station, null, 2) + '\n')
      await octokit.repos.createOrUpdateFile({
        owner: 'neaps',
        repo: 'tide-database',
        path: `data/${station.country}/${station.id}.json`,
        message: 'Created new database file',
        content: content.toString('base64'),
        branch: branchName
      })

      const pr = await octokit.pulls.create({
        owner: 'neaps',
        repo: 'tide-database',
        title: `New station: ${station.name}`,
        head: branchName,
        base: 'master',
        body: `Requested by ${contact.email}`,
        maintainer_can_modify: true
      })
      response.send({ error: false, url: pr.data.html_url })
      response.end()
    } catch {
      response.send({ error: true })
      response.end()
    }
  })
})

server.on('clientError', (err, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
})

server.listen(port)

console.log(`Neaps PR server listening on ${process.env.PORT}`)

module.exports = server
