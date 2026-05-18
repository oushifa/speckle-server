import gql from 'graphql-tag'

export const createProjectVersionMutation = gql`
  mutation CreateProjectVersion($input: CreateVersionInput!) {
    versionMutations {
      create(input: $input) {
        id
        message
        sourceApplication
        seedId
        assetId
        model {
          id
        }
        referencedObject
      }
    }
  }
`

export const markProjectVersionReceivedMutation = gql`
  mutation MarkProjectVersionReceived($input: MarkReceivedVersionInput!) {
    versionMutations {
      markReceived(input: $input)
    }
  }
`

export const updateProjectVersionMutation = gql`
  mutation UpdateProjectVersion($input: UpdateVersionInput!) {
    versionMutations {
      update(input: $input) {
        id
        message
        seedId
        assetId
        treeJson
      }
    }
  }
`
