import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import LayoutDrawer from '~~/src/components/layout/Drawer.vue'
import FormButton from '~~/src/components/form/Button.vue'

export default {
  component: LayoutDrawer,
  parameters: {
    docs: {
      description: {
        component: 'Slide-out drawer panel inspired by Ant Design Drawer.'
      }
    }
  },
  argTypes: {
    placement: {
      options: ['right', 'left', 'top', 'bottom'],
      control: { type: 'select' }
    }
  }
} as Meta

export const Default: StoryObj = {
  render: (args) => ({
    components: { LayoutDrawer, FormButton },
    setup() {
      const open = ref(false)
      return { args, open }
    },
    template: `<div>
      <FormButton @click="() => (open = true)">Open drawer</FormButton>
      <LayoutDrawer v-model:open="open" v-bind="args">
        <div class="space-y-3">
          <p class="text-body-sm">这里是抽屉内容区域。</p>
          <p class="text-body-sm">支持通过 placement 控制方向，支持 header / footer 插槽。</p>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <FormButton color="outline" @click="() => (open = false)">取消</FormButton>
            <FormButton @click="() => (open = false)">确认</FormButton>
          </div>
        </template>
      </LayoutDrawer>
    </div>`
  }),
  args: {
    title: 'Drawer 标题',
    placement: 'right',
    maskClosable: true,
    closable: true,
    width: 420,
    height: 320
  }
}

export const Left = {
  ...Default,
  args: {
    ...Default.args,
    placement: 'left'
  }
}

export const Top = {
  ...Default,
  args: {
    ...Default.args,
    placement: 'top',
    height: 280
  }
}

export const Bottom = {
  ...Default,
  args: {
    ...Default.args,
    placement: 'bottom',
    height: 280
  }
}
