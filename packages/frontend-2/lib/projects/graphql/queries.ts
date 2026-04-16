import { graphql } from '~~/lib/common/generated/gql'

export const projectAccessCheckQuery = graphql(`
  query ProjectAccessCheck($id: String!) {
    project(id: $id) {
      id
      permissions {
        canRead {
          ...FullPermissionCheckResult
        }
      }
      workspaceId
    }
    activeUser {
      id
      activeWorkspace {
        id
      }
    }
  }
`)

export const projectsDashboardQuery = graphql(`
  query ProjectsDashboardQuery($filter: UserProjectsFilter, $cursor: String) {
    activeUser {
      id
      projects(filter: $filter, limit: 6, cursor: $cursor) {
        ...ProjectsDashboard_UserProjectCollection
        cursor
        totalCount
        items {
          address
          progress
          startDate
          endDate
          status
          responsible
          timeZone
          ...ProjectDashboardItem
          ...WorkspaceMoveProject_Project
        }
      }
      ...ProjectsHiddenProjectWarning_User
      ...ProjectsDashboard_User
    }
  }
`)

export const projectPageQuery = graphql(`
  query ProjectPageQuery($id: String!, $token: String) {
    project(id: $id) {
      ...ProjectPageProject
    }
    projectInvite(projectId: $id, token: $token) {
      ...ProjectsInviteBanner
    }
  }
`)

export const latestModelsQuery = graphql(`
  query ProjectLatestModels($projectId: String!, $filter: ProjectModelsFilter) {
    project(id: $projectId) {
      id
      models(cursor: null, limit: 16, filter: $filter) {
        totalCount
        cursor
        items {
          ...ProjectPageLatestItemsModelItem
        }
      }
      pendingImportedModels {
        ...PendingFileUpload
      }
    }
  }
`)

export const latestModelsPaginationQuery = graphql(`
  query ProjectLatestModelsPagination(
    $projectId: String!
    $filter: ProjectModelsFilter
    $cursor: String = null
    $limit: Int = 16
  ) {
    project(id: $projectId) {
      id
      models(cursor: $cursor, limit: $limit, filter: $filter) {
        totalCount
        cursor
        items {
          ...ProjectPageLatestItemsModelItem
        }
      }
    }
  }
`)

export const projectModelsTreeTopLevelQuery = graphql(`
  query ProjectModelsTreeTopLevel(
    $projectId: String!
    $filter: ProjectModelsTreeFilter
  ) {
    project(id: $projectId) {
      id
      modelsTree(cursor: null, limit: 8, filter: $filter) {
        totalCount
        cursor
        items {
          ...SingleLevelModelTreeItem
        }
      }
      pendingImportedModels {
        ...PendingFileUpload
      }
    }
  }
`)

export const projectModelsTreeTopLevelPaginationQuery = graphql(`
  query ProjectModelsTreeTopLevelPagination(
    $projectId: String!
    $filter: ProjectModelsTreeFilter
    $cursor: String = null
  ) {
    project(id: $projectId) {
      id
      modelsTree(cursor: $cursor, limit: 8, filter: $filter) {
        totalCount
        cursor
        items {
          ...SingleLevelModelTreeItem
        }
      }
    }
  }
`)

export const projectModelChildrenTreeQuery = graphql(`
  query ProjectModelChildrenTree($projectId: String!, $parentName: String!) {
    project(id: $projectId) {
      id
      modelChildrenTree(fullName: $parentName) {
        ...SingleLevelModelTreeItem
      }
    }
  }
`)

export const latestCommentThreadsQuery = graphql(`
  query ProjectLatestCommentThreads(
    $projectId: String!
    $cursor: String = null
    $filter: ProjectCommentsFilter = null
  ) {
    project(id: $projectId) {
      id
      commentThreads(cursor: $cursor, limit: 8, filter: $filter) {
        totalCount
        cursor
        items {
          ...ProjectPageLatestItemsCommentItem
        }
      }
      ...ViewerResourcesLimitAlert_Project
    }
  }
`)

export const projectInviteQuery = graphql(`
  query ProjectInvite($projectId: String!, $token: String) {
    projectInvite(projectId: $projectId, token: $token) {
      ...ProjectsInviteBanner
    }
  }
`)

export const projectModelCheckQuery = graphql(`
  query ProjectModelCheck($projectId: String!, $modelId: String!) {
    project(id: $projectId) {
      visibility
      model(id: $modelId) {
        id
      }
    }
  }
`)

export const projectModelPageQuery = graphql(`
  query ProjectModelPage(
    $projectId: String!
    $modelId: String!
    $versionsCursor: String
  ) {
    project(id: $projectId) {
      id
      ...ProjectModelPageHeaderProject
      ...ProjectModelPageVersionsProject
    }
  }
`)

export const projectModelVersionsQuery = graphql(`
  query ProjectModelVersions(
    $projectId: String!
    $modelId: String!
    $versionsCursor: String
  ) {
    project(id: $projectId) {
      id
      ...ProjectModelPageVersionsPagination
    }
  }
`)

export const projectBoqItemsQuery = graphql(`
  query ProjectBoqItems($projectId: String!, $search: String) {
    project(id: $projectId) {
      id
      name
      boqItems(input: { search: $search }) {
        id
        projectId
        parentId
        type
        code
        name
        unit
        quantity
        price
        sortOrder
        depth
        hasChildren
        createdAt
        updatedAt
        children {
          id
          projectId
          parentId
          type
          code
          name
          unit
          quantity
          price
          sortOrder
          depth
          hasChildren
          createdAt
          updatedAt
          children {
            id
            projectId
            parentId
            type
            code
            name
            unit
            quantity
            price
            sortOrder
            depth
            hasChildren
            createdAt
            updatedAt
            children {
              id
              projectId
              parentId
              type
              code
              name
              unit
              quantity
              price
              sortOrder
              depth
              hasChildren
              createdAt
              updatedAt
              children {
                id
                projectId
                parentId
                type
                code
                name
                unit
                quantity
                price
                sortOrder
                depth
                hasChildren
                createdAt
                updatedAt
                children {
                  id
                  projectId
                  parentId
                  type
                  code
                  name
                  unit
                  quantity
                  price
                  sortOrder
                  depth
                  hasChildren
                  createdAt
                  updatedAt
                }
              }
            }
          }
        }
      }
    }
  }
`)

export const projectBoqSelectorOptionsQuery = graphql(`
  query ProjectBoqSelectorOptions(
    $projectId: String!
    $parentId: ID
    $search: String
    $limit: Int! = 50
  ) {
    project(id: $projectId) {
      id
      boqSelectorOptions(
        input: { parentId: $parentId, search: $search, limit: $limit }
      ) {
        totalCount
        cursor
        items {
          id
          projectId
          parentId
          type
          code
          name
          unit
          quantity
          price
          sortOrder
          depth
          hasChildren
          createdAt
          updatedAt
        }
      }
    }
  }
`)

export const projectQualityAcceptanceFormsQuery = graphql(`
  query ProjectQualityAcceptanceForms(
    $projectId: String!
    $search: String
    $cursor: String
    $limit: Int!
  ) {
    project(id: $projectId) {
      id
      qualityAcceptanceForms(
        input: { search: $search, cursor: $cursor, limit: $limit }
      ) {
        totalCount
        cursor
        items {
          id
          name
          boqItemId
          code
          inspectionLotNumber
          acceptancePart
          acceptanceContent
          actualStartDate
          actualFinishDate
          inspector {
            id
            name
          }
          inspectorId
          attachments {
            id
            fileName
            fileType
            fileSize
          }
          creator {
            id
            name
          }
          creatorId
          projectId
          workVolume
          unit
          bimElements {
            modelId
            bimIds
          }
          BIMelement
          timeZone
          approveStatus
          createdAt
          updatedAt
        }
      }
    }
  }
`)

export const projectMonthlyMeasurementsQuery = graphql(`
  query ProjectMonthlyMeasurements(
    $projectId: String!
    $search: String
    $cursor: String
    $limit: Int!
  ) {
    project(id: $projectId) {
      id
      monthlyMeasurements(input: { search: $search, cursor: $cursor, limit: $limit }) {
        totalCount
        cursor
        items {
          id
          unit
          code
          baseDate
          approveStatus
          flowInstanceId
          items {
            id
            boqItemId
            boqCode
            boqName
            boqParentId
            boqDepth
            isSummaryRow
            sortIndex
            uom
            pendingTotalQty
            approvedCumulativeQty
            measuredQty
            price
            remark
            sourceAcceptanceIds
          }
          creator {
            id
            name
          }
          creatorId
          createdAt
          updatedAt
        }
      }
    }
  }
`)

export const projectMonthlyMeasurementByIdQuery = graphql(`
  query ProjectMonthlyMeasurementById($projectId: String!, $id: ID!) {
    project(id: $projectId) {
      id
      monthlyMeasurement(id: $id) {
        id
        unit
        code
        baseDate
        approveStatus
        flowInstanceId
        items {
          id
          boqItemId
          boqCode
          boqName
          boqParentId
          boqDepth
          isSummaryRow
          sortIndex
          uom
          pendingTotalQty
          approvedCumulativeQty
          measuredQty
          price
          remark
          sourceAcceptanceIds
        }
        creator {
          id
          name
        }
        creatorId
        createdAt
        updatedAt
      }
    }
  }
`)

export const approvalFlowInstanceDetailsForMonthlyMeasurementQuery = graphql(`
  query ApprovalFlowInstanceDetailsForMonthlyMeasurement($id: ID!) {
    approvalFlowInstance(id: $id) {
      id
      resourceType
      resourceId
      status
      currentStep
      createdBy
      createdAt
      updatedAt
      definition {
        id
        name
        resourceType
        isActive
      }
      actions {
        id
        stepId
        action
        fromStatus
        toStatus
        comment
        metadata
        actorId
        createdAt
        actor {
          id
          name
        }
      }
      steps {
        id
        name
        stepIndex
        status
        requiredApprovals
        approverIds
        approvedByIds
        startedAt
        dueAt
        completedAt
      }
    }
  }
`)

export const projectModelsPageQuery = graphql(`
  query ProjectModelsPage($projectId: String!) {
    project(id: $projectId) {
      id
      ...ProjectModelsPageHeader_Project
      ...ProjectModelsPageResults_Project
    }
  }
`)

export const projectDiscussionsPageQuery = graphql(`
  query ProjectDiscussionsPage($projectId: String!) {
    project(id: $projectId) {
      id
      ...ProjectDiscussionsPageHeader_Project
      ...ProjectDiscussionsPageResults_Project
    }
  }
`)

export const projectAutomationsTabQuery = graphql(`
  query ProjectAutomationsTab($projectId: String!) {
    project(id: $projectId) {
      id
      role
      models(limit: 1) {
        items {
          id
        }
      }
      automations(filter: null, cursor: null, limit: 5) {
        totalCount
        items {
          id
          ...ProjectPageAutomationsRow_Automation
        }
        cursor
      }
      workspace {
        id
        automateFunctions(limit: 0) {
          totalCount
        }
        ...AutomateFunctionCreateDialog_Workspace
      }
      permissions {
        canCreateAutomation {
          ...FullPermissionCheckResult
        }
      }
      ...FormSelectProjects_Project
    }
    ...AutomateFunctionsPageHeader_Query
  }
`)

export const projectAutomationsTabAutomationsPaginationQuery = graphql(`
  query ProjectAutomationsTabAutomationsPagination(
    $projectId: String!
    $search: String = null
    $cursor: String = null
  ) {
    project(id: $projectId) {
      id
      automations(filter: $search, cursor: $cursor, limit: 5) {
        totalCount
        cursor
        items {
          id
          ...ProjectPageAutomationsRow_Automation
        }
      }
    }
  }
`)

export const projectAutomationPageQuery = graphql(`
  query ProjectAutomationPage($projectId: String!, $automationId: String!) {
    project(id: $projectId) {
      id
      ...ProjectPageAutomationPage_Project
      automation(id: $automationId) {
        id
        ...ProjectPageAutomationPage_Automation
      }
    }
  }
`)

export const projectAutomationPagePaginatedRunsQuery = graphql(`
  query ProjectAutomationPagePaginatedRuns(
    $projectId: String!
    $automationId: String!
    $cursor: String = null
  ) {
    project(id: $projectId) {
      id
      automation(id: $automationId) {
        id
        runs(cursor: $cursor, limit: 10) {
          totalCount
          cursor
          items {
            id
            ...AutomationRunDetails
          }
        }
      }
    }
  }
`)

export const projectAutomationAccessCheckQuery = graphql(`
  query ProjectAutomationAccessCheck($projectId: String!) {
    project(id: $projectId) {
      id
      automations(limit: 0) {
        totalCount
      }
    }
  }
`)

export const projectWebhooksQuery = graphql(`
  query ProjectWebhooks($projectId: String!) {
    project(id: $projectId) {
      id
      name
      ...ProjectPageSettingsWebhooks_Project
      webhooks {
        items {
          streamId
          triggers
          enabled
          url
          id
          description
          history(limit: 5) {
            items {
              status
              statusInfo
            }
          }
        }
        totalCount
      }
    }
  }
`)

export const projectIntegrationsQuery = graphql(`
  query ProjectIntegrations($projectId: String!) {
    project(id: $projectId) {
      id
      name
      ...ProjectPageSettingsIntegrations_Project
      accSyncItems {
        items {
          id
        }
        totalCount
      }
    }
  }
`)

export const projectEmbedTokensQuery = graphql(`
  query ProjectEmbedTokens($projectId: String!, $cursor: String = null) {
    project(id: $projectId) {
      id
      ...ProjectPageSettingsTokens_Project
    }
  }
`)

export const projectBlobInfoQuery = graphql(`
  query ProjectBlobInfo($blobId: String!, $projectId: String!) {
    project(id: $projectId) {
      id
      blob(id: $blobId) {
        id
        fileName
        fileType
        fileSize
        createdAt
      }
    }
  }
`)

export const moveToWorkspaceDryRunQuery = graphql(`
  query MoveToWorkspaceDryRun($workspaceId: String!, $projectId: String!, $limit: Int) {
    project(id: $projectId) {
      id
      moveToWorkspaceDryRun(workspaceId: $workspaceId) {
        addedToWorkspaceTotalCount
        addedToWorkspace(limit: $limit) {
          avatar
          id
          name
        }
      }
    }
  }
`)
