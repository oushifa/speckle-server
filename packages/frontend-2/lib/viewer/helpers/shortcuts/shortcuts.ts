import { ModifierKeys } from '@speckle/ui-components'
import { ViewMode } from '@speckle/viewer'

export const PanelShortcuts = {
  ToggleModels: {
    name: '模型',
    description: '切换模型面板',
    modifiers: [ModifierKeys.Shift],
    key: 'M',
    action: 'ToggleModels'
  },
  ToggleFilters: {
    name: '筛选器',
    description: '切换筛选器面板',
    modifiers: [ModifierKeys.Shift],
    key: 'F',
    action: 'ToggleFilters'
  },
  ToggleDiscussions: {
    name: '讨论',
    description: '切换讨论面板',
    modifiers: [ModifierKeys.Shift],
    key: 'D',
    action: 'ToggleDiscussions'
  },
  ToggleDevMode: {
    name: '开发模式',
    description: '切换开发模式',
    modifiers: [ModifierKeys.Shift],
    key: 'X',
    action: 'ToggleDevMode'
  },
  ToggleSavedViews: {
    name: '保存视图',
    description: '切换保存视图面板',
    modifiers: [ModifierKeys.Shift],
    key: 'S',
    action: 'ToggleSavedViews'
  },
  ToggleViewModes: {
    name: '视图模式',
    description: '切换视图模式面板',
    modifiers: [ModifierKeys.Shift],
    key: 'V',
    action: 'ToggleViewModes'
  }
} as const

export const ToolShortcuts = {
  ToggleMeasurements: {
    name: '测量',
    description: '切换测量模式',
    modifiers: [ModifierKeys.Shift],
    key: 'R',
    action: 'ToggleMeasurements'
  },
  ToggleProjection: {
    name: '投影',
    description: '切换正交投影和透视投影',
    modifiers: [ModifierKeys.Shift],
    key: 'P',
    action: 'ToggleProjection'
  },
  ToggleSectionBox: {
    name: '截面',
    description: '切换截面框',
    modifiers: [ModifierKeys.Shift],
    key: 'B',
    action: 'ToggleSectionBox'
  },
  ToggleExplode: {
    name: '爆炸',
    description: '切换爆炸模式',
    modifiers: [ModifierKeys.Shift],
    key: 'E',
    action: 'ToggleExplode'
  },
  ZoomExtentsOrSelection: {
    name: '缩放',
    description: '缩放以适合选择或整个模型',
    modifiers: [ModifierKeys.Shift],
    key: 'space',
    action: 'ZoomExtentsOrSelection'
  },
  ToggleLightControls: {
    name: '灯光控制',
    description: '切换灯光控制面板',
    modifiers: [ModifierKeys.Shift],
    key: 'L',
    action: 'ToggleLightControls'
  }
} as const

export const ViewModeShortcuts = {
  SetViewModeDefault: {
    name: '渲染',
    description: '一个逼真的模型渲染视图，使用可用的材料为表面。',
    modifiers: [ModifierKeys.Shift],
    key: 'Digit1',
    action: 'SetViewModeDefault',
    viewMode: ViewMode.DEFAULT
  },
  SetViewModeShaded: {
    name: '阴影',
    description: '使用可用颜色为表面和曲线的模型阴影视图。',
    modifiers: [ModifierKeys.Shift],
    key: 'Digit2',
    action: 'SetViewModeShaded',
    viewMode: ViewMode.SHADED
  },
  SetViewModeArctic: {
    name: '北极',
    description: '一个白色概念视图，没有任何材料或颜色。',
    modifiers: [ModifierKeys.Shift],
    key: 'Digit3',
    action: 'SetViewModeArctic',
    viewMode: ViewMode.ARCTIC
  },
  SetViewModeSolid: {
    name: '实心',
    description: '使用我们默认材料的基本阴影视图，带有边缘。',
    modifiers: [ModifierKeys.Shift],
    key: 'Digit4',
    action: 'SetViewModeSolid',
    viewMode: ViewMode.SOLID
  },
  SetViewModePen: {
    name: '钢笔',
    description: '没有任何照明或阴影的模型的黑白绘制视图。',
    modifiers: [ModifierKeys.Shift],
    key: 'Digit5',
    action: 'SetViewModePen',
    viewMode: ViewMode.PEN
  }
} as const

export const ViewShortcuts = {
  SetViewTop: {
    name: '顶部',
    description: '设置视图为顶部',
    modifiers: [ModifierKeys.AltOrOpt],
    key: 'Digit1',
    action: 'SetViewTop'
  },
  SetViewFront: {
    name: '正面',
    description: '设置视图为正面',
    modifiers: [ModifierKeys.AltOrOpt],
    key: 'Digit2',
    action: 'SetViewFront'
  },
  SetViewLeft: {
    name: '左侧',
    description: '设置视图为左侧',
    modifiers: [ModifierKeys.AltOrOpt],
    key: 'Digit3',
    action: 'SetViewLeft'
  },
  SetViewBack: {
    name: '背面',
    description: '设置视图为背面',
    modifiers: [ModifierKeys.AltOrOpt],
    key: 'Digit4',
    action: 'SetViewBack'
  },
  SetViewRight: {
    name: '右侧',
    description: '设置视图为右侧',
    modifiers: [ModifierKeys.AltOrOpt],
    key: 'Digit5',
    action: 'SetViewRight'
  }
} as const

export const ViewerShortcuts = {
  ...ViewModeShortcuts,
  ...PanelShortcuts,
  ...ToolShortcuts,
  ...ViewShortcuts
} as const
