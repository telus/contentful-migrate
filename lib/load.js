const fs = require('fs')
const path = require('path')
const { promisify } = require('util')
const log = require('migrate/lib/log')
const migrate = require('migrate')
const { createStoreFactory } = require('../lib/store')
const run = require('../lib/run')
const { getManagementToken } = require('@contentful/node-apps-toolkit')

const loadAsync = promisify(migrate.load)

const runWrapper = (args) => {
  return (next) => {
    const argsWithNext = Object.assign({}, args, { next })
    run(argsWithNext)
  }
}

const configureSet = (set, spaceId, environmentId, accessToken, dryRun) => {
  set.migrations.forEach((migration) => {
    /* eslint-disable no-param-reassign */
    if (migration.up) {
      const migrationFunction = migration.up
      migration.up = runWrapper({
        migrationFunction,
        spaceId,
        environmentId,
        accessToken,
        dryRun
      })
    }
    if (migration.down) {
      const migrationFunction = migration.down
      migration.down = runWrapper({
        migrationFunction,
        spaceId,
        environmentId,
        accessToken,
        dryRun
      })
    }
    /* eslint-enable no-param-reassign */
  })

  set.on('warning', (msg) => {
    log('warning', msg)
  })

  set.on('migration', (migration, direction) => {
    log(direction, migration.title)
  })

  return set
}

const readContentTypes = (migrationsDirectory) => {
  const contentTypeList = []
  if (contentTypeList.length === 0) {
    const isDirectory = (source) =>
      fs.lstatSync(path.join(migrationsDirectory, source)).isDirectory()
    fs.readdirSync(migrationsDirectory)
      .filter(isDirectory)
      .forEach((dir) => contentTypeList.push(dir))
  }
  return contentTypeList
}

// Load in migrations. Return an array of MigrationSet promises
const load = async ({
  appId,
  token,
  migrationsDirectory,
  spaceId,
  environmentId,
  dryRun,
  contentTypes
}) => {
  let contentTypeList = contentTypes
  if (typeof contentTypes === 'undefined' || contentTypes.length === 0) {
    contentTypeList = readContentTypes(migrationsDirectory)
  }
  let accessToken
  if (token) {
    accessToken = token
  } else {
    const privateKey = Buffer.from(
      process.env.APP_PRIVATE_KEY,
      'base64'
    ).toString('ascii')
    if (!privateKey) {
      throw new Error('Missing APP_PRIVATE_KEY')
    }
    accessToken = await getManagementToken(privateKey, {
      appInstallationId: appId,
      spaceId,
      environmentId
    })
  }
  const factory = await createStoreFactory({
    accessToken,
    dryRun,
    environmentId,
    spaceId
  })

  return contentTypeList.map((contentType) => {
    const store = factory.newStore(contentType)
    const contentTypeDirectory = path.join(migrationsDirectory, contentType)
    return loadAsync({
      stateStore: store,
      migrationsDirectory: contentTypeDirectory
    }).then((set) =>
      configureSet(set, spaceId, environmentId, accessToken, dryRun)
    )
  })
}

module.exports = load
