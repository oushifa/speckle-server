<template>
  <div class="space-y-8 mb-8">
    <h1 class="text-heading-xl text-center">加入工作区</h1>
    <div class="p-4 border border-outline-2 rounded text-body-xs">
      您正在接受邀请加入
      <span class="font-medium">{{ invite.workspace.name }}</span>
      <!-- prettier-ignore -->
      <template v-if="invite.user">
        以
        <div class="inline-flex items-center">
          <UserAvatar :user="invite.user" size="sm" class="mr-1" />
          <span class="font-medium">{{ invite.user.name }}</span>
        </div>.
      </template>
      <template v-else>
        使用
        <span class="font-medium">{{ invite.email }}</span>
        邮箱地址。
      </template>
    </div>
  </div>
</template>
<script setup lang="ts">
import { graphql } from '~/lib/common/generated/gql'
import type { AuthWorkspaceInviteHeader_PendingWorkspaceCollaboratorFragment } from '~/lib/common/generated/gql/graphql'

graphql(`
  fragment AuthWorkspaceInviteHeader_PendingWorkspaceCollaborator on PendingWorkspaceCollaborator {
    id
    workspace {
      id
      name
    }
    email
    user {
      id
      ...LimitedUserAvatar
    }
  }
`)

defineProps<{
  invite: AuthWorkspaceInviteHeader_PendingWorkspaceCollaboratorFragment
}>()
</script>
