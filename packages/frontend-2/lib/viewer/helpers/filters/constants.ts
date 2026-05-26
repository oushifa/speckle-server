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
  buildInCategory: '内建类别',
  elementId: '元素ID',
  ['Material Quantities']: '材料数量',
  worksetId: '工作集ID',
  LEVEL_PARAM: '标高参数',
  SCHDULE_LEVEL_PARAM: '计划标高参数',
  buildCategory: '建筑分类',
  buildType: '内建类型',
  materialCategory: '材料类别',
  worksetName: '工作集名称',
  materialName: '材料名称',
  materialClass: '材料类型',
  HOST_VOLUME_COMPUTED: '主体体积',
  children: '子元素',
  collectionType: '集合类型',
  elements: '元素',
  levelProxies: '标高代理',
  renderMaterialProxies: '渲染材质代理',
  instanceDefinitionProxies: '实例定义代理',
  builtInCategory: '内建类别',
  materialType: '材料类型',
  density: '密度',
  structuralAsset: '结构资产',
  RevitObject: 'Revit对象',
  location: '位置',
  properties: '属性',
  Parameters: '参数',
  ['Instance Parameters']: '实例参数',
  ['Type Parameters']: '类型参数',
  ObjectType: '对象类型',
  GlobalId: '全局ID',
  Tag: '标签',
  Name: '名称',
  PredefinedType: '预定义类型',
  Description: '描述',
  Attributes: '属性',
  ['Element Type Attributes']: '元素类型属性',
  ApplicableOcurrence: '适用发生',
  ElementType: '元素类型',
  RepresentationMaps: '表示映射',
  ['Element Type Property Sets']: '元素类型属性集',
  RepresentationType: '表示类型',
  ['Pset_SlabCommon']: '板属性集',
  IsExternal: '是否外部',
  ['Property Sets']: '属性集',
  ['Pset_EnvironmentalImpactIndicators']: '环境影响指标',
  Reference: '参考',
  ['Pset_ReinforcementBarPitchOfSlab']: '板钢筋间距',
  PitchAngle: '倾斜角度',
  LoadBrearing: '载荷承载',
  Quantities: '数量',
  ['Qto_SlabBaseQuantities']: '板基础数量',
  Width: '宽度',
  Height: '高度',
  NetArea: '净面积',
  GrossArea: '毛面积',
  NetVolume: '净体积',
  GrossVolume: '毛体积',
  Perimeter: '周长',
  ['Building Storey']: '建筑楼层',
  ['speckle_type']: '数据类型'
  // LoadBearing: ''
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
