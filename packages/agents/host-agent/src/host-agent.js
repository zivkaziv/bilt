const childProcess = require('child_process')
const fs = require('fs')
const path = require('path')
const {promisify} = require('util')
const debug = require('debug')('bildit:host-agent')
const {createSymlink: createSymlinkInHost} = require('@bildit/symlink')
const makeDir = require('make-dir')

module.exports = async ({kind, appConfig: {directory}}) => {
  const info = agent => agent

  return {
    async acquireInstanceForJob() {
      return {id: 1, kind}
    },
    releaseInstanceForJob() {
      return
    },

    async executeCommand(agentInstance, commandArgs, {cwd, returnOutput, env} = {}) {
      debug('dispatching command %o in directory %s', commandArgs, cwd)
      const orgEnv = process.env
      const output = await new Promise((resolve, reject) => {
        const process = childProcess.spawn(commandArgs[0], commandArgs.slice(1), {
          cwd,
          stdio: returnOutput ? undefined : 'inherit',
          shell: false,
          env: {...orgEnv, ...env},
        })

        let output = ''
        if (returnOutput) {
          process.stdout.on('data', data => (output += data.toString()))
        }

        process.on('close', code => {
          if (code !== 0) reject(new Error(`Command failed with errorcode ${code}`))
          else resolve(output)
        })
        process.on('error', err => {
          reject(err)
        })
      })

      return output
    },

    async readFileAsBuffer(agentInstance, fileName) {
      const {directory} = info(agentInstance)

      return await promisify(fs.readFile)(path.resolve(directory, fileName))
    },

    async writeBufferToFile(agentInstance, fileName, buffer) {
      const {directory} = info(agentInstance)

      const fullFilename = path.resolve(directory, fileName)
      const dir = path.dirname(fullFilename)
      await makeDir(dir)

      return await promisify(fs.writeFile)(fullFilename, buffer)
    },

    async homeDir() {
      if (!process.env.HOME) {
        throw new Error(
          'There is no HOME directory environment variable so cannot determine home directory',
        )
      }
      return process.env.HOME
    },

    buildDir() {
      return '.'
    },
    translateHostPathToAgentPath(path) {
      return path
    },
    async createSymlink(agentInstance, link, target) {
      return await createSymlinkInHost(path.join(directory, link), path.join(directory, target))
    },

    async finalize() {
      //
    },
  }
}
