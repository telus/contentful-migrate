#!/usr/bin/env node
// vim: set ft=javascript:

const path = require('path')
const runMigrations = require('migrate/lib/migrate')
const log = require('migrate/lib/log')
const load = require('../../lib/load')

exports.command = 'down [file]'

exports.desc =
  'Migrate down to a given migration or just the last one if not specified'

exports.builder = (yargs) => {
  yargs
    .option('space-id', {
      alias: 's',
      describe: 'space id to use',
      type: 'string',
      requiresArg: true,
      demandOption: true,
      default: process.env.CONTENTFUL_SPACE_ID,
      defaultDescription: 'environment var CONTENTFUL_SPACE_ID'
    })
    .option('environment-id', {
      alias: 'e',
      describe: 'id of the environment within the space',
      type: 'string',
      requiresArg: true,
      default: process.env.CONTENTFUL_ENV_ID || 'master',
      defaultDescription:
        'environment var CONTENTFUL_ENV_ID if exists, otherwise master'
    })
    .option('content-type', {
      alias: 'c',
      describe: 'single content type name to process',
      demandOption: true
    })
    .option('app-id', {
      type: 'string',
      alias: 'a',
      describe: 'App ID to use for getting management token',
      default: process.env.CONTENTFUL_APP_ID,
      demandOption: true
    })
    .option('access-token', {
      alias: 't',
      describe: 'CMA access token if provided overrides token fetched by APP',
      defaultDescription: 'environment var CONTENTFUL_MANAGEMENT_ACCESS_TOKEN'
    })
    .option('dry-run', {
      alias: 'd',
      describe:
        "only shows the planned actions, don't write anything to Contentful",
      boolean: true,
      default: false
    })
    .positional('file', {
      describe:
        'If specified, rollback all migrations scripts down to this one.',
      type: 'string'
    })
}

exports.handler = async (args) => {
  const {
    accessToken,
    contentType,
    appId,
    dryRun,
    environmentId,
    file,
    spaceId
  } = args

  const migrationsDirectory =
    process.env.CONTENTFUL_MIGRATIONS_DIR || path.join('.', 'migrations')

  const processSet = (set) => {
    const name = file || set.lastRun

    runMigrations(set, 'down', name, (error) => {
      if (error) {
        log('error', error)
        process.exit(1)
      }

      log('migration', 'complete')
      process.exit(0)
    })
  }

  // Load in migrations
  const sets = await load({
    appId,
    accessToken,
    migrationsDirectory,
    spaceId,
    environmentId,
    dryRun,
    contentTypes: [contentType]
  })

  sets.forEach((set) =>
    set.then(processSet).catch((err) => {
      log.error('error', err)
      process.exit(1)
    })
  )
}
