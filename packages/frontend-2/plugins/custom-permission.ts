import { useCustomPermissions } from '~~/lib/auth/composables/customPermissions'

export default defineNuxtPlugin((nuxtApp) => {
  const { hasFunctionalPerm, initializePermissions } = useCustomPermissions()

  // 1. 注册全局自定义 Vue 指令: v-has-perm
  // 例如：<FormButton v-has-perm="'file-management:delete'">删除</FormButton>
  nuxtApp.vueApp.directive('has-perm', {
    async mounted(el, binding) {
      if (process.server) return

      // 确保权限字典加载完成
      await initializePermissions()

      const permissionCode = binding.value
      if (!permissionCode) return

      // 行级动作权限判定
      if (!hasFunctionalPerm(permissionCode)) {
        // 进行 DOM 样式及属性的双重阻断屏蔽
        el.style.display = 'none'
        el.style.visibility = 'hidden'
        el.setAttribute('disabled', 'true')
        el.classList.add('opacity-30', 'pointer-events-none', 'select-none')
      }
    },
    async updated(el, binding) {
      if (process.server) return
      
      const permissionCode = binding.value
      if (!permissionCode) return

      if (!hasFunctionalPerm(permissionCode)) {
        el.style.display = 'none'
        el.style.visibility = 'hidden'
        el.setAttribute('disabled', 'true')
        el.classList.add('opacity-30', 'pointer-events-none', 'select-none')
      } else {
        el.style.display = ''
        el.style.visibility = ''
        el.removeAttribute('disabled')
        el.classList.remove('opacity-30', 'pointer-events-none', 'select-none')
      }
    }
  })

  // 2. 注入全局辅助函数 $hasPerm，可在任意 Vue 模板插值表达式或计算属性中使用
  // 例如：<div v-if="$hasPerm('file-management:upload')">...</div>
  return {
    provide: {
      hasPerm: (permissionCode: string) => {
        return hasFunctionalPerm(permissionCode)
      }
    }
  }
})
