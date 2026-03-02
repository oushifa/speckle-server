<template>
  <div class="grid gap-y-2 mt-">
    <p class="caption text-foreground-2">待处理邀请</p>
    <div
      class="flex items-center justify-between rounded-xl text-white pl-4 pr-2 py-2 shadow hover:shadow-lg transition bg-primary"
    >
      <div class="text-sm">查看设计系统。</div>
      <div>
        <FormButton class="ml-2" to="/designsystem">带我去</FormButton>
      </div>
    </div>
    <template v-for="(notification, i) in notifications" :key="i">
      <div
        class="flex items-center justify-between rounded-xl bg-foundation text-foreground pl-4 pr-2 py-2 shadow hover:shadow-lg transition"
      >
        <div class="text-sm">
          {{ notification.message }}
        </div>
        <div>
          <FormButton
            v-for="(action, index) in notification.actions"
            :key="index"
            class="ml-2"
            to="/designsystem"
            :type="index == 0 ? 'standard' : 'outline'"
          >
            {{ action }}
          </FormButton>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
const notifications = [
  {
    message: 'Dimitrie 邀请你加入 Super Something Pants 项目。',
    actions: ['接受', '拒绝']
  },
  {
    message: 'Fabians 想与你分享。',
    actions: ['接受', '拒绝']
  } /* ,
  {
    message: 'Fabians requests access to Pasta Project',
    actions: ['Grant Access', 'View Project', 'Ignore']
  } */
]
</script>
