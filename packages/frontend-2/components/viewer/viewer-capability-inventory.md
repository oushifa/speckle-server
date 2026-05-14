# Viewer 组件能力摸排

## 1. 目标与范围

本文档用于梳理 `packages/frontend-2/components/viewer` 目录下组件的职责边界、用户可见能力、关键交互和与外部状态的关系，便于后续做：

- 功能改造前的模块定位
- 新能力接入时的挂载点判断
- 问题排查时的入口缩小
- 文档化沉淀与新人上手

本文聚焦 `viewer` 组件目录本身，同时补充少量强相关的外部 composables 和服务约束，用于解释组件是如何被驱动起来的。

## 2. 总体结论

当前 Viewer 不是单纯的模型展示容器，而是一个围绕以下四类核心状态组织起来的复合工作台：

- `resourceIdString`：决定加载哪些模型、版本、对象、文件夹或保存视图
- `viewerState`：决定当前相机、可见性、过滤、测量、选择等运行态
- `commentThreads`：决定评论列表、锚点气泡和线程回放
- `selectedObjects`：决定右键菜单、选择侧栏、快捷卡片和数据查看

从 UI 结构上看，它由 4 层能力共同组成：

1. 左侧主面板：承载模型、筛选、评论、保存视图等信息型能力
2. 底部工具菜单：承载测量、截面、爆炸、视图模式、灯光等操作型能力
3. 右侧相机菜单：承载视角与导航能力
4. 锚点/选择浮层：承载评论锚点、右键菜单、选择详情和快捷动作

## 3. 页面与初始化骨架

### 3.1 组件装配顺序

页面主装配由 `PageSetup.vue` 负责，主要职责包括：

- 挂载导航、Viewer 渲染宿主、锚点层、左/底/右控制区、选择侧栏
- 处理 embed 模式差异，如高度、底部 branding、是否显示 controls
- 监听资源加载异常或套餐限制，弹出限制提示
- 协调左侧面板、底部面板、线程弹层、选择侧栏之间的互斥关闭

核心链路如下：

1. `PageSetup.vue`
2. `CoreSetup.vue`
3. `Base.vue`
4. `StateSetup.vue`
5. `StatePostSetup.vue`

### 3.2 各层职责

#### `PageSetup.vue`

- 页面级编排中心
- 将 Viewer 放入完整应用布局
- 统一挂载 `AnchoredPoints`、`ControlsLeft`、`ControlsBottom`、`ControlsRight`、`SelectionSidebar`
- 定义 `closeAllPanels()`，负责多区域面板互斥

#### `CoreSetup.vue`

- Viewer 核心渲染宿主
- 提供渲染容器和全局 loading bar
- 为 `after-viewer-base` 插槽预留叠加层挂载点

#### `Base.vue`

- 真正将底层 viewer renderer DOM 容器挂到页面
- 在挂载与卸载时管理 viewer container 的插入和回收
- 监听尺寸变化并触发 `viewer.resize()`

#### `StateSetup.vue`

- 负责调用 `useSetupViewer()` 创建可注入的 Viewer 状态
- 将 setup 后的 state 通过事件向外暴露
- 是“组件层”和“viewer composable 层”的连接点

## 4. 能力分层地图

### 4.1 左侧主面板

左侧区域偏“信息、状态、资源管理”，主要组件如下。

#### 4.1.1 `models/`

核心能力：

- 展示当前已加载模型和 Detached Object
- 展示模型树和对象层级
- 支持单选和 `Shift` 多选
- 选中对象后自动展开并滚动定位
- 查看模型版本列表
- 切换到指定版本或最新版本
- 进入 diff 对比流程
- 增量添加模型或对象资源

典型组件：

- `models/Panel.vue`：模型面板主容器
- `models/Card.vue`：模型卡片
- `models/versions/Versions.vue`：版本列表
- `models/add/Dialog.vue`：添加模型/对象入口
- `models/VirtualTreeItem.vue`：树项渲染

适用场景：

- 模型浏览
- 模型切换
- 对象定位
- 资源扩展加载

#### 4.1.2 `filters/`

核心能力：

- 按对象属性构建筛选条件
- 支持布尔、数值、字符串等多种筛选类型
- 支持 `AND/OR` 逻辑切换
- 支持替换筛选字段
- 支持显示命中数量
- 支持全局重置筛选

典型组件：

- `filters/Panel.vue`：筛选面板主容器
- `filters/filter/*`：各类条件编辑器
- `filters/property-selection/*`：属性选择面板
- `filters/LargePropertyWarningDialog.vue`：大字段风险确认

适用场景：

- 大模型快速缩小范围
- 属性驱动查找构件
- 与隔离/选择联动排查问题

#### 4.1.3 `comments/`

核心能力：

- 展示评论线程列表
- 支持显示/隐藏评论气泡
- 支持包含已解决线程
- 支持只看当前已加载版本的线程
- 空态提示与过滤控制

典型组件：

- `comments/Panel.vue`：评论面板
- `comments/ListItem.vue`：线程列表项
- `comments/Editor.vue`：评论编辑器

适用场景：

- 设计审阅
- 协作反馈
- 问题定位与处理追踪

#### 4.1.4 `saved-views/`

核心能力：

- 搜索保存视图
- 创建视图分组
- 创建保存视图
- 浏览个人/团队视图
- 操作视图和分组

典型组件：

- `saved-views/Panel.vue`：保存视图主入口
- `saved-views/panel/groups/*`：分组管理
- `saved-views/panel/view/*`：单个视图操作

适用场景：

- 视角沉淀
- 协作复用
- 常用场景快速回到指定状态

#### 4.1.5 `dataviewer/`

核心能力：

- 查看对象原始数据
- 递归展开对象和数组结构
- 引用对象懒加载查看
- 为开发调试提供数据侧入口

典型组件：

- `dataviewer/Panel.vue`
- `dataviewer/Object.vue`
- `dataviewer/Row.vue`

说明：

- 更偏开发或排障能力
- 左侧按钮入口当前更接近调试用途，不属于主要业务入口

### 4.2 底部工具菜单

底部区域偏“即时操作工具”，强调状态切换、操作完成和快速重置。

#### 4.2.1 `measurements/`

核心能力：

- 点对点测量
- 垂直距离测量
- 面积测量
- 点坐标测量
- 单位切换
- 精度调整
- 连续测量
- 顶点捕捉
- 清空全部测量

典型组件：

- `measurements/Menu.vue`
- `measurements/UnitSelect.vue`

#### 4.2.2 `explode/`

核心能力：

- 调整爆炸视图强度
- 重置爆炸状态

典型组件：

- `explode/Menu.vue`

#### 4.2.3 `view-modes/`

核心能力：

- 切换 `Default`、`Solid`、`Pen`、`Arctic`、`Shaded`
- 开关边线显示
- 调整边线粗细和颜色

典型组件：

- `view-modes/Menu.vue`

#### 4.2.4 `lightControls/`

核心能力：

- 控制太阳阴影开关
- 调整光照强度
- 调整太阳仰角和方位角
- 控制间接光

典型组件：

- `lightControls/Menu.vue`

#### 4.2.5 截面能力

截面能力的 UI 控制主要体现在底部控制区，核心能力包括：

- 启用或关闭 section box
- 重置截面
- 完成后回收面板

说明：

- 这部分更偏“底部控制编排”能力，而不是独立子目录模块

### 4.3 右侧相机菜单

右侧区域偏“视角与导航”。

#### `camera/`

核心能力：

- 缩放到整体
- 缩放到当前选择
- 切换标准视角
- 切换正交/透视相关模式
- 自由轨道浏览
- 使用自定义命名视图

典型组件：

- `controls/Right.vue`
- `camera/Menu.vue`

适用场景：

- 快速切视角
- 审图定位
- 演示和讲解

### 4.4 锚点、评论与上下文动作

这部分是 Viewer 中交互最复杂、也最具有“协作工作台”特征的一层。

#### `anchored-point/`

核心能力：

- 在 3D 空间中投影评论线程锚点
- 新建线程时记录点击位置和选中对象
- 线程展开后回放当时的 viewer 状态
- 查看完整上下文
- 复制线程链接
- 评论回复、附件、已读与状态联动

典型组件：

- `AnchoredPoints.vue`
- `anchored-point/NewThread.vue`
- `anchored-point/Thread.vue`
- `anchored-point/thread/Comment.vue`
- `anchored-point/thread/NewReply.vue`

关键特征：

- 评论不是脱离模型的普通列表，而是绑定 `viewerState` 和资源上下文的空间化线程系统

#### `contextMenu/`

核心能力：

- 右键命中对象时弹出上下文菜单
- 隐藏当前选择
- 隔离/取消隔离
- 缩放到当前选择
- 复制对象 ID
- 清空当前选择

典型组件：

- `contextMenu/ContextMenu.vue`

### 4.5 选择与详情侧栏

#### `selection/`

核心能力：

- 展示当前选中对象详情
- 递归展示属性树
- 提供快捷字段卡片
- 隐藏/显示/隔离当前对象
- 在新标签页打开对象
- diff 模式下对比新旧对象

典型组件：

- `selection/Sidebar.vue`
- `selection/Object.vue`
- `selection/KeyValuePair.vue`

关键特征：

- 这是“对象操作”和“对象理解”的主入口
- 与右键菜单、评论、测量、diff 展示都有明显联动

## 5. 目录职责速查

以下为 `viewer` 目录中较重要子目录的职责速查表。

| 目录               | 主要职责                       |
| ------------------ | ------------------------------ |
| `anchored-point/`  | 评论锚点、线程展示、回复与附件 |
| `button-group/`    | 按钮组基础拼装                 |
| `camera/`          | 相机视角菜单                   |
| `comments/`        | 评论列表与评论面板             |
| `compare-changes/` | 版本差异展示                   |
| `contextMenu/`     | 右键菜单                       |
| `controls/`        | 左、右、底部控制区总编排       |
| `dataviewer/`      | 原始数据查看                   |
| `embed/`           | Embed 页脚与手动加载相关       |
| `explode/`         | 爆炸视图控制                   |
| `filters/`         | 属性筛选与属性选择             |
| `layout/`          | 面板基础布局组件               |
| `lightControls/`   | 灯光参数控制                   |
| `limits/`          | 套餐/资源限制提示              |
| `measurements/`    | 测量工具与单位设置             |
| `menu/`            | 通用菜单型 UI 组件             |
| `models/`          | 模型、版本、树和增量加载       |
| `resources/`       | 资源卡片与资源限制提示         |
| `saved-views/`     | 保存视图及视图分组管理         |
| `selection/`       | 选择详情与快捷信息卡           |
| `settings/`        | Viewer 设置菜单                |
| `view-modes/`      | 渲染模式切换                   |

## 6. 关键交互关系

### 6.1 面板互斥关系

`PageSetup.vue` 中的 `closeAllPanels()` 是一个关键协调点，负责：

- 打开左侧主面板时关闭其他浮层
- 打开底部工具时关闭其他面板
- 展开评论线程时关闭其他面板
- 统一回收选择侧栏

这意味着 Viewer 的很多功能虽然分散在不同组件中，但交互体验是按“同屏聚焦单任务”来组织的。

### 6.2 评论与 Viewer 状态联动

评论能力深度依赖 Viewer 状态：

- 新建线程时会保存当前 Viewer 上下文
- 线程可回放到当时视角/选择状态
- 评论气泡位置会随相机变化重投影
- 线程过滤与当前加载资源相关

因此评论系统本质上属于 Viewer 的“场景注释层”，不是单独业务面板。

### 6.3 选择是多个能力的中枢

选择状态会同时影响：

- 右键菜单动作
- 选择侧栏内容
- 快捷卡片显示
- 缩放到选择
- 评论新建锚点
- diff 对象对照

因此如果后续要扩展对象级能力，优先考虑挂到选择链路而不是单独新开面板。

### 6.4 资源解析决定 Viewer 上下文

虽然 UI 在 `components/viewer`，但它的运行上下文本质由资源请求驱动：

- 模型
- 版本
- 对象
- 文件夹
- all models
- 保存视图

这些都会收敛到 `resourceIdString` 及后续解析结果上，再决定最终 Viewer 看到什么、评论过滤什么、保存视图恢复什么。

## 7. 从能力角度看当前 Viewer 的模块划分

可以将当前目录理解为 5 个能力域：

1. 渲染与宿主层
2. 面板与工具层
3. 选择与对象操作层
4. 评论与空间锚点层
5. 资源与视图管理层

如果后续要继续整理或重构，建议不要只按目录平铺理解，而是优先按下列主线拆分：

- 资源主线：加载什么
- 状态主线：当前怎么看
- 选择主线：当前操作谁
- 评论主线：如何在场景中协作
- 工具主线：如何对场景做临时操作

## 8. 改造与扩展建议

### 8.1 适合继续沉淀成统一协议的点

- 左侧面板注册机制：当前已经有主面板枚举和控制按钮，适合进一步抽象成声明式配置
- 底部工具协议：测量、截面、爆炸、视图模式本质都是“激活一个工具并显示一个菜单”
- 选择动作协议：隐藏、隔离、缩放、打开对象等动作可进一步统一

### 8.2 适合重点关注的耦合点

- 评论锚点和 Viewer 状态回放
- 选择侧栏与右键菜单的重复动作
- 资源加载与评论过滤的一致性
- embed 模式与标准页面模式的差异行为

### 8.3 文档化建议

后续可继续补充两类文档：

- 组件树图：从 `PageSetup.vue` 出发给出组件挂载关系
- 数据流图：从 `resourceIdString`、`selectedObjects`、`commentThreads`、`viewerState` 四条主线展示依赖关系

## 9. 一句话总结

`components/viewer` 已经形成了一个“模型浏览 + 对象操作 + 场景协作 + 视图沉淀 + 工具操作”一体化的 Viewer 工作台，其复杂度核心不在渲染本身，而在围绕资源、状态、选择和评论构建起来的协同交互体系。
