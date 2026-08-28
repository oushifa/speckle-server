export enum RoamingMode {
  Point = 'point', // 选点漫游：在模型表面点击选点，按先后顺序移动镜头，镜头始终指向下一个点位的方向
  View = 'view' // 视角漫游：在当前视角保存点位，平滑过渡
}

export enum EasingType {
  Linear = 'linear', // 线性移动
  EaseInOut = 'easeInOut', // 平滑过渡 (慢-快-慢)
  EaseIn = 'easeIn', // 先慢后快
  EaseOut = 'easeOut' // 先快后慢
}

export const EasingTypeLabels: Record<EasingType, string> = {
  [EasingType.Linear]: '线性移动 (匀速)',
  [EasingType.EaseInOut]: '平滑过渡 (慢-快-慢)',
  [EasingType.EaseIn]: '加速移动 (先慢后快)',
  [EasingType.EaseOut]: '减速移动 (先快后慢)'
}

export interface RoamingPoint {
  id: string
  name: string
  // 3D 坐标 [x, y, z]
  position: [number, number, number]
  // 观察目标点 [x, y, z]（视角漫游模式下记录相机 target；点位模式下可自动计算朝向下一个点）
  target: [number, number, number]
  // 到达当前点位用时（秒，默认 3）
  duration: number
  // 动画曲线
  easing: EasingType
  // 选点模式下的人眼高度偏置（可选，默认 1.6m）
  eyeHeight?: number
}

export interface RoamingRoute {
  id: string
  name: string
  mode: RoamingMode
  points: RoamingPoint[]
  loop: boolean
  speed: number
  eyeHeight?: number
  createdAt: number
  updatedAt: number
}

export interface RoamingPlayState {
  isPlaying: boolean
  isPaused: boolean
  currentRouteId: string | null
  currentPointIndex: number
  currentTime: number
  totalTime: number
  progress: number // 0 ~ 1
  speed: number
  loop: boolean
}
