import type { Meta, StoryObj } from '@storybook/vue3'
import LayoutTabsVertical from '~~/src/components/layout/tabs/Vertical.vue'
import type { LayoutPageTabItem } from '~~/src/helpers/layout/components'
import { useStorybookVmodel } from '~~/src/composables/testing'

const items: LayoutPageTabItem[] = [
  { title: '模型', id: 'models', count: 300 },
  { title: '问题讨论', id: 'discussions' },
  { title: '自动操作', id: 'automations', tag: 'New' },
  { title: '设置', id: 'settings' },
  {
    title: '已禁用项',
    id: 'disabled',
    disabled: true,
    disabledMessage: '示例禁用消息'
  }
]

export default {
  component: LayoutTabsVertical,
  parameters: {
    docs: {
      description: {
        component: '此组件显示一组垂直选项卡，允许用户交互和选择。'
      }
    }
  },
  argTypes: {
    items: {
      description: '要显示在选项卡中的项目数组'
    },
    title: {
      description: '选项卡上方显示的标题'
    },
    activeItem: {
      description: '当前活动项模型。不需要。'
    },
    'update:activeItem': {
      description: '当活动项更改时触发的事件',
      type: 'function',
      action: 'v-model:activeItem'
    }
  }
} as Meta

export const Default: StoryObj = {
  render: (args, ctx) => ({
    components: { LayoutTabsVertical },
    setup() {
      const { model } = useStorybookVmodel({ args, prop: 'activeItem', ctx })
      return { args, model }
    },
    template: `
    <div>
      <LayoutTabsVertical v-slot="{ activeItem }" v-bind="args" v-model:activeItem="model">
        <div>Title: {{ activeItem?.title }}</div>
        <div>ID: {{ activeItem?.id }}</div>
      </LayoutTabsVertical>
    </div>`
  }),
  args: {
    items,
    title: '选项卡示例',
    activeItem: items[2]
  }
}
