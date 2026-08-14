import { automateLogger, moduleLogger } from '@/observability/logging'
import type { Optional, SpeckleModule } from '@/modules/shared/helpers/typeHelper'
import {
  onModelVersionCreateFactory,
  triggerAutomationRevisionRunFactory
} from '@/modules/automate/services/trigger'
import {
  getActiveTriggerDefinitionsFactory,
  getAutomationFactory,
  getAutomationRevisionFactory,
  getAutomationRunFullTriggersFactory,
  getAutomationTokenFactory,
  getFullAutomationRevisionMetadataFactory,
  upsertAutomationRunFactory
} from '@/modules/automate/repositories/automations'
import { isNonNullable, Scopes } from '@speckle/shared'
import { registerOrUpdateScopeFactory } from '@/modules/shared/repositories/scopes'
import {
  triggerAutomationRun
} from '@/modules/automate/clients/executionEngine'
import logStreamRest from '@/modules/automate/rest/logStream'
import {
  getEncryptionKeyPairFor,
  getFunctionInputDecryptorFactory
} from '@/modules/automate/services/encryption'
import { buildDecryptor } from '@/modules/shared/utils/libsodium'
import authGithubAppRest from '@/modules/automate/rest/authGithubApp'
import { getFeatureFlags } from '@/modules/shared/helpers/envHelper'
import type { TokenScopeData } from '@/modules/shared/domain/rolesAndScopes/types'
import { db } from '@/db/knex'
import { ProjectSubscriptions, publish } from '@/modules/shared/utils/subscriptions'
import { getBranchLatestCommitsFactory } from '@/modules/core/repositories/branches'
import { getCommitFactory } from '@/modules/core/repositories/commits'
import { createAppTokenFactory } from '@/modules/core/services/tokens'
import {
  storeApiTokenFactory,
  storeTokenResourceAccessDefinitionsFactory,
  storeTokenScopesFactory,
  storeUserServerAppTokenFactory
} from '@/modules/core/repositories/tokens'
import { getProjectDbClient } from '@/modules/multiregion/utils/dbSelector'
import {
  ProjectAutomationsUpdatedMessageType,
  ProjectTriggeredAutomationsStatusUpdatedMessageType
} from '@/modules/core/graph/generated/graphql'
import {
  isVersionCreatedTriggerManifest,
  VersionCreationTriggerType
} from '@/modules/automate/helpers/types'
import { getEventBus } from '@/modules/shared/services/eventBus'
import { VersionEvents } from '@/modules/core/domain/commits/events'
import { AutomationEvents, AutomationRunEvents } from '@/modules/automate/domain/events'
import { loggerWithMaybeContext } from '@/observability/utils/requestContext'

const { FF_AUTOMATE_MODULE_ENABLED } = getFeatureFlags()
let quitListeners: Optional<() => void> = undefined

async function initScopes() {
  const scopes: TokenScopeData[] = [
    {
      name: Scopes.Automate.ReportResults,
      description: 'Report automation results to the server.',
      public: true
    },
    {
      name: Scopes.AutomateFunctions.Read,
      description: 'See available Speckle Automate functions.',
      public: true
    },
    {
      name: Scopes.AutomateFunctions.Write,
      description: 'Create and manage Speckle Automate functions.',
      public: true
    }
  ]

  const registerFunc = registerOrUpdateScopeFactory({ db })
  for (const scope of scopes) {
    await registerFunc({ scope })
  }
}

const initializeEventListeners = () => {
  const createAppToken = createAppTokenFactory({
    storeApiToken: storeApiTokenFactory({ db }),
    storeTokenScopes: storeTokenScopesFactory({ db }),
    storeTokenResourceAccessDefinitions: storeTokenResourceAccessDefinitionsFactory({
      db
    }),
    storeUserServerAppToken: storeUserServerAppTokenFactory({ db })
  })

  const quitters = [
    // Automation trigger events
    getEventBus().listen(
      VersionEvents.Created,
      async ({ payload: { modelId, version, projectId } }) => {
        const projectDb = await getProjectDbClient({ projectId })
        await onModelVersionCreateFactory({
          getAutomation: getAutomationFactory({ db: projectDb }),
          getAutomationRevision: getAutomationRevisionFactory({ db: projectDb }),
          getTriggers: getActiveTriggerDefinitionsFactory({ db: projectDb }),
          triggerFunction: triggerAutomationRevisionRunFactory({
            automateRunTrigger: triggerAutomationRun,
            getEncryptionKeyPairFor,
            getFunctionInputDecryptor: getFunctionInputDecryptorFactory({
              buildDecryptor
            }),
            createAppToken,
            emitEvent: getEventBus().emit,
            getAutomationToken: getAutomationTokenFactory({ db: projectDb }),
            upsertAutomationRun: upsertAutomationRunFactory({ db: projectDb }),
            getFullAutomationRevisionMetadata: getFullAutomationRevisionMetadataFactory(
              { db: projectDb }
            ),
            getBranchLatestCommits: getBranchLatestCommitsFactory({ db: projectDb }),
            getCommit: getCommitFactory({ db: projectDb })
          })
        })({ modelId, versionId: version.id, projectId })
      }
    ),
    // Automation management events
    getEventBus().listen(
      AutomationEvents.Created,
      async ({ payload: { automation } }) => {
        await publish(ProjectSubscriptions.ProjectAutomationsUpdated, {
          projectId: automation.projectId,
          projectAutomationsUpdated: {
            type: ProjectAutomationsUpdatedMessageType.Created,
            automationId: automation.id,
            automation,
            revision: null
          }
        })
      }
    ),
    getEventBus().listen(
      AutomationEvents.Updated,
      async ({ payload: { automation } }) => {
        await publish(ProjectSubscriptions.ProjectAutomationsUpdated, {
          projectId: automation.projectId,
          projectAutomationsUpdated: {
            type: ProjectAutomationsUpdatedMessageType.Updated,
            automationId: automation.id,
            automation,
            revision: null
          }
        })
      }
    ),
    getEventBus().listen(
      AutomationEvents.CreatedRevision,
      async ({ payload: { automation, revision } }) => {
        await publish(ProjectSubscriptions.ProjectAutomationsUpdated, {
          projectId: automation.projectId,
          projectAutomationsUpdated: {
            type: ProjectAutomationsUpdatedMessageType.CreatedRevision,
            automationId: automation.id,
            automation,
            revision: {
              ...revision,
              projectId: automation.projectId
            }
          }
        })
      }
    ),
    // Automation run lifecycle events
    getEventBus().listen(
      AutomationRunEvents.Created,
      async ({ payload: { manifests, run, automation } }) => {
        const logger = loggerWithMaybeContext({ logger: automateLogger })
        const validatedManifests = manifests
          .map((manifest) => {
            if (isVersionCreatedTriggerManifest(manifest)) {
              return manifest
            } else {
              logger.error(
                {
                  manifest
                },
                'Unexpected run trigger manifest type'
              )
            }

            return null
          })
          .filter(isNonNullable)

        await Promise.all(
          validatedManifests.map(async (manifest) => {
            await publish(
              ProjectSubscriptions.ProjectTriggeredAutomationsStatusUpdated,
              {
                projectId: manifest.projectId,
                projectTriggeredAutomationsStatusUpdated: {
                  ...manifest,
                  run: {
                    ...run,
                    automationId: automation.id,
                    functionRuns: run.functionRuns.map((functionRun) => ({
                      ...functionRun,
                      runId: run.id
                    })),
                    triggers: run.triggers.map((trigger) => ({
                      ...trigger,
                      automationRunId: run.id
                    })),
                    projectId: manifest.projectId
                  },
                  type: ProjectTriggeredAutomationsStatusUpdatedMessageType.RunCreated
                }
              }
            )
          })
        )
      }
    ),
    getEventBus().listen(
      AutomationRunEvents.StatusUpdated,
      async ({ payload: { run, functionRun, automationId, projectId } }) => {
        const projectDb = await getProjectDbClient({ projectId })

        const triggers = await getAutomationRunFullTriggersFactory({ db: projectDb })({
          automationRunId: run.id
        })

        if (triggers[VersionCreationTriggerType].length) {
          const versionCreation = triggers[VersionCreationTriggerType]

          await Promise.all(
            versionCreation.map(async (trigger) => {
              await publish(
                ProjectSubscriptions.ProjectTriggeredAutomationsStatusUpdated,
                {
                  projectId: trigger.model.streamId,
                  projectTriggeredAutomationsStatusUpdated: {
                    projectId: trigger.model.streamId,
                    modelId: trigger.model.id,
                    versionId: trigger.version.id,
                    run: {
                      ...run,
                      functionRuns: [functionRun],
                      automationId,
                      triggers: undefined,
                      projectId: trigger.model.streamId
                    },
                    type: ProjectTriggeredAutomationsStatusUpdatedMessageType.RunUpdated
                  }
                }
              )
            })
          )
        }
      }
    ),
  ]

  return () => {
    quitters.forEach((quit) => quit())
  }
}

const automateModule: SpeckleModule = {
  async init({ app, isInitial }) {
    if (!FF_AUTOMATE_MODULE_ENABLED) return
    moduleLogger.info('⚙️  Init automate module')

    await initScopes()
    logStreamRest(app)
    authGithubAppRest(app)

    if (isInitial) {
      quitListeners = initializeEventListeners()
    }
  },
  shutdown() {
    if (!FF_AUTOMATE_MODULE_ENABLED) return
    quitListeners?.()
  }
}

export default automateModule
