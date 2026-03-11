import type { FilterCondition } from '~/lib/viewer/helpers/filters/types'
import {
  NumericFilterCondition,
  StringFilterCondition,
  ExistenceFilterCondition,
  BooleanFilterCondition,
  FilterType
} from '~/lib/viewer/helpers/filters/types'

// Filter Configuration
export const FILTER_CONDITION_CONFIG: Record<FilterCondition, { label: string }> = {
  [StringFilterCondition.Is]: { label: '是' },
  [StringFilterCondition.IsNot]: { label: '不是' },
  [NumericFilterCondition.IsEqualTo]: { label: '等于' },
  [NumericFilterCondition.IsNotEqualTo]: { label: '不等于' },
  [NumericFilterCondition.IsGreaterThan]: { label: '大于' },
  [NumericFilterCondition.IsLessThan]: { label: '小于' },
  [NumericFilterCondition.IsBetween]: { label: '在之间' },
  [ExistenceFilterCondition.IsSet]: { label: '已设置' },
  [ExistenceFilterCondition.IsNotSet]: { label: '未设置' },
  [BooleanFilterCondition.IsTrue]: { label: '是' },
  [BooleanFilterCondition.IsFalse]: { label: '否' }
} as const

// Popular Filter Properties
export const FILTERS_POPULAR_PROPERTIES = [
  'name',
  'category',
  'family',
  'type',
  'level',
  'material',
  'phaseCreated',
  'phaseDemolished',
  'area',
  'length',
  'phaseCreated',
  'ifcType',
  'layer'
]
// Popular Filter Properties
export const REVIT_PROPERTY_NAME_ZH_MAP: Record<string, string> = {
  name: '名称',
  category: '类别',
  family: '族',
  type: '类型',
  level: '标高',
  material: '材质',
  phaseCreated: '创建阶段',
  phaseDemolished: '拆除阶段',
  area: '面积',
  length: '长度',
  ifcType: 'IFC类型',
  layer: '图层',
  width: '宽度',
  height: '高度',
  volume: '体积',
  mark: '标记',
  comments: '注释',
  fireRating: '耐火等级',
  units: '单位',
  applicationId: '应用程序ID',
  objects: '对象',
  speckleType: '数智南北类型',
  buildInCategory: '内建类别',
  elementId: '元素ID',
  ['Material Quantities']: '材料数量',
  worksetId: '工作集ID',
  LEVEL_PARAM: '标高参数',
  SCHDULE_LEVEL_PARAM: '计划标高参数'
}

// UI Constants
export const PROPERTY_SELECTION_ITEM_HEIGHT = 36
export const PROPERTY_SELECTION_MAX_HEIGHT = 600
export const PROPERTY_SELECTION_OVERSCAN = 5

// Utility Functions
export const getConditionsForType = (filterType: FilterType): FilterCondition[] => {
  if (filterType === FilterType.Numeric) {
    return [
      ...Object.values(NumericFilterCondition),
      ...Object.values(ExistenceFilterCondition)
    ]
  } else if (filterType === FilterType.Boolean) {
    return [
      ...Object.values(BooleanFilterCondition),
      ...Object.values(ExistenceFilterCondition)
    ]
  } else {
    return [
      ...Object.values(StringFilterCondition),
      ...Object.values(ExistenceFilterCondition)
    ]
  }
}

export const getConditionLabel = (condition: FilterCondition): string => {
  return FILTER_CONDITION_CONFIG[condition]?.label || 'is'
}

export const DEEP_EXTRACTION_CONFIG = {
  MAX_DEPTH: 10, // Maximum nesting depth
  BATCH_SIZE: 100 // Batch size for property map updates
} as const

// Non-filterable object keys (for performance - skip deep traversal)
export const NON_FILTERABLE_OBJECT_KEYS = [
  'displayMesh',
  'renderMaterial',
  'geometry',
  'mesh',
  'vertices',
  'faces',
  'colors',
  'bbox'
] as const
