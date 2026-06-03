# Debug Session: progress-ghost-flicker
- **Status**: [FIXED]
- **Issue**: 勾选第一个模型时未开始/未关联构件可正常半透明显示；勾选第二个模型时先短暂半透明，随后约一秒内半透明状态消失。
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: .dbg/trae-debug-log-progress-ghost-flicker.ndjson

## Reproduction Steps
1. 打开项目形象进度页面。
2. 勾选第一个模型，确认未开始以及未关联构件为半透明。
3. 再勾选第二个模型。
4. 观察 Viewer：先出现半透明，约一秒后半透明状态消失。

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | 勾选第二个模型后，`applySnapshotColorsToViewer()` 被后续 watcher 或 `LoadComplete` 再次调用，并在第二次调用时使用了不同输入覆盖过滤结果 | High | Low | Pending |
| B | 多模型加载完成后，`buildViewerObjectIdsBySelectionKey()` 返回结果发生变化，导致后续一次调用把本该 ghost 的对象也算进了正常显示集合 | High | Medium | Pending |
| C | `extension.resetFilters()` 与 `extension.isolateObjects()` 在多模型异步加载阶段被其他 viewer 过滤逻辑重置，导致 ghost 状态被清空 | Medium | Medium | Pending |
| D | 第二个模型的快照数据返回后，`playbackSnapshots` 或 `playbackRange` 重算把大部分对象从 `not_started` 错误切换为非半透明状态 | Medium | Low | Pending |
| E | `setUserObjectColors()` 在多模型下触发了 viewer 内部重新着色/刷新路径，间接移除了 ghost 可视状态 | Low | Medium | Pending |

## Log Evidence
- 预修复日志显示，勾选第二个模型后先发生一次无映射应用：`objectKeyCount = 0`、`activeLinkedObjectIds = 0`，随后 Viewer `LoadComplete` 后再次应用。
- 预修复日志显示，第二个模型完成加载后，`buildViewerObjectIdsBySelectionKey` 从 `958` 增长到 `1916`，说明多模型映射是在后续加载完成后才补齐。
- 预修复日志显示，后续多次 `applySnapshotColorsToViewer` 都带着 `activeLinkedObjectIds = 4` 继续执行，问题发生点落在“使用这批 id 应用过滤”之后，而不是快照状态重算本身。

## Verification Conclusion
- 根因是多模型场景下使用 `isolateObjects()` 做反向 ghost 不稳定，第二个模型加载完成后的重应用会让半透明集合丢失。
- 最终修复改为显式计算每个已选模型的全部原子对象 id，并直接对“应半透明的对象集合”调用 `hideObjects(..., ghost=true)`。
- post-fix 日志显示稳定应用阶段已形成 `modelObjectCount = 1938`、`activeLinkedObjectIds = 4`、`ghostObjectIds = 1934` 的明确分层；用户确认现象已修复。

## Hypothesis Status
| ID | Hypothesis | Status | Evidence Summary |
|----|------------|--------|------------------|
| A | 二次调用覆盖过滤结果 | ✅ Confirmed | 预修复日志中第二个模型勾选后出现多次 `apply-watch` / `LoadComplete` / `applySnapshotColorsToViewer` 连续调用 |
| B | 多模型映射在后续加载后发生变化 | ✅ Confirmed | 映射数量从 `958` 变为 `1916`，说明第二个模型资源在延迟加载后才进入映射 |
| C | 其他 viewer 过滤逻辑清空 ghost | ❌ Rejected | 目前日志里只看到当前页面自己的重新应用链路，没有看到外部过滤链路证据 |
| D | 快照/播放区间重算导致错误状态切换 | ❌ Rejected | `statusCounts` 稳定为 `finished_on_time:2 / in_progress:2 / not_started:2`，未见异常抖动 |
| E | 着色链路自身清空 ghost | ⏳ Inconclusive | 需要结合 post-fix 结果判断，但目前更像是过滤 id 口径错误 |

## Instrumentation Points
1. `physicalPage.vue:selectedModelIds:watch` 记录勾选模型变化。
2. `physicalPage.vue:loadSelectedModelSnapshots:start/finish` 记录快照加载前后状态。
3. `physicalPage.vue:buildViewerObjectIdsBySelectionKey` 记录多模型构件映射数量。
4. `physicalPage.vue:apply-watch` 与 `physicalPage.vue:handleViewerLoadComplete*` 记录是谁触发了后续重绘。
5. `physicalPage.vue:applySnapshotColorsToViewer` 记录每次应用半透明/颜色时的输入状态。
6. `physicalPage.vue:applySnapshotColorsToViewer:color-groups` 记录颜色分组规模。
