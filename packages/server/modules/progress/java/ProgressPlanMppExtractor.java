import com.fasterxml.jackson.databind.ObjectMapper;
import org.mpxj.CustomField;
import org.mpxj.Duration;
import org.mpxj.FieldType;
import org.mpxj.ProjectFile;
import org.mpxj.Relation;
import org.mpxj.RelationType;
import org.mpxj.Task;
import org.mpxj.reader.UniversalProjectReader;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class ProgressPlanMppExtractor {
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  /**
   * sysTaskId 值前缀（由 ProgressPlanMppWriter 写入）：即使「数智南北ID」列别名在
   * 跨工具（MS Project 打开/另存）后丢失，也能按该前缀扫描兜底识别 sysTaskId。
   */
  private static final String SYS_TASK_ID_VALUE_PREFIX = "SYSID:";

  /**
   * 业务字段 -> MS Project 列显示名（自定义字段别名）候选，按优先级匹配。
   * 不再按物理槽位（Text1/Text2...）硬编码语义，而是读取文件里自定义字段的别名来解析，
   * 例如 Text1 的列名是「工程量」时，其值解析为 quantity。
   */
  private static final Map<String, List<String>> FIELD_ALIAS_RULES = new LinkedHashMap<>();

  static {
    // 本项目导出（ProgressPlanMppWriter）回写的列名
    FIELD_ALIAS_RULES.put("sysTaskId", List.of("数智南北ID", "系统任务ID", "系统任务编号"));
    // 业务计划的工程量/单位列
    FIELD_ALIAS_RULES.put("quantity", List.of("工程量"));
    FIELD_ALIAS_RULES.put("unit", List.of("单位"));
  }

  public static void main(String[] args) throws Exception {
    if (args.length != 1) {
      throw new IllegalArgumentException("Usage: ProgressPlanMppExtractor <input-file>");
    }

    ProjectFile project = new UniversalProjectReader().read(args[0]);

    // 1. 读取文件里自定义字段的别名 -> 字段类型 映射
    Map<String, FieldType> aliasToFieldType = new HashMap<>();
    for (CustomField customField : project.getCustomFields()) {
      String alias = customField.getAlias();
      if (alias != null && !alias.trim().isEmpty()) {
        aliasToFieldType.putIfAbsent(alias.trim(), customField.getFieldType());
      }
    }

    // 2. 按别名规则解析每个业务字段对应的字段类型（找不到则缺省）
    Map<String, FieldType> resolvedFields = new LinkedHashMap<>();
    for (Map.Entry<String, List<String>> rule : FIELD_ALIAS_RULES.entrySet()) {
      for (String alias : rule.getValue()) {
        FieldType fieldType = aliasToFieldType.get(alias);
        if (fieldType != null) {
          resolvedFields.put(rule.getKey(), fieldType);
          break;
        }
      }
    }

    List<Map<String, Object>> tasks = new ArrayList<>();
    int[] sortOrder = {0};

    for (Task task : project.getChildTasks()) {
      visitTask(task, null, tasks, sortOrder, resolvedFields);
    }

    OBJECT_MAPPER.writeValue(System.out, tasks);
  }

  private static void visitTask(
    Task task,
    Task parentTask,
    List<Map<String, Object>> output,
    int[] sortOrder,
    Map<String, FieldType> resolvedFields
  ) {
    if (task == null) {
      return;
    }

    String name = sanitize(task.getName());
    Task effectiveParent = parentTask != null ? parentTask : task.getParentTask();

    if (name != null) {
      Map<String, Object> record = new LinkedHashMap<>();
      record.put("externalId", toStringValue(task.getUniqueID()));
      record.put("sysTaskId", readSysTaskId(task, resolvedFields));
      record.put("quantity", readFieldByAlias(task, resolvedFields, "quantity"));
      record.put("unit", readFieldByAlias(task, resolvedFields, "unit"));
      record.put("parentExternalId", effectiveParent != null ? toStringValue(effectiveParent.getUniqueID()) : null);
      record.put("wbs", firstNonBlank(task.getWBS(), task.getOutlineNumber()));
      record.put("name", name);
      record.put("level", normalizeLevel(task.getOutlineLevel()));
      record.put("sortOrder", sortOrder[0]++);
      record.put("duration", formatDuration(task));
      record.put("planStart", formatDate(task.getStart()));
      record.put("planEnd", formatDate(task.getFinish()));
      record.put("predecessor", formatPredecessors(task.getPredecessors()));
      record.put("inspectionBatch", sanitize(task.getText(2)));
      output.add(record);
      effectiveParent = task;
    }

    for (Task child : task.getChildTasks()) {
      visitTask(child, effectiveParent, output, sortOrder, resolvedFields);
    }
  }

  /** 按业务字段名（FIELD_ALIAS_RULES 的 key）读取对应别名列的值 */
  private static String readFieldByAlias(
    Task task,
    Map<String, FieldType> resolvedFields,
    String fieldName
  ) {
    FieldType fieldType = resolvedFields.get(fieldName);
    if (fieldType == null) {
      return null;
    }
    Object value = task.getCachedValue(fieldType);
    return sanitize(value != null ? String.valueOf(value) : null);
  }

  /**
   * 读取 sysTaskId：优先按「数智南北ID」列别名解析；
   * 别名丢失（跨工具后）时，扫描所有 Text 列按 SYSID: 前缀兜底。
   */
  private static String readSysTaskId(Task task, Map<String, FieldType> resolvedFields) {
    String byAlias = readFieldByAlias(task, resolvedFields, "sysTaskId");
    if (byAlias != null) {
      return stripSysTaskIdPrefix(byAlias);
    }

    for (int index = 1; index <= 30; index++) {
      String value = sanitize(task.getText(index));
      if (value != null && value.startsWith(SYS_TASK_ID_VALUE_PREFIX)) {
        return stripSysTaskIdPrefix(value);
      }
    }
    return null;
  }

  private static String stripSysTaskIdPrefix(String value) {
    if (value == null) {
      return null;
    }
    return value.startsWith(SYS_TASK_ID_VALUE_PREFIX)
      ? value.substring(SYS_TASK_ID_VALUE_PREFIX.length())
      : value;
  }

  private static Integer normalizeLevel(Integer outlineLevel) {
    if (outlineLevel == null) {
      return 0;
    }
    return Math.max(outlineLevel - 1, 0);
  }

  private static String formatDuration(Task task) {
    String durationText = sanitize(task.getDurationText());
    if (durationText != null) {
      return durationText;
    }

    Duration duration = task.getDuration();
    return duration != null ? duration.toString() : null;
  }

  private static String formatDate(LocalDateTime value) {
    return value != null ? value.toString() : null;
  }

  private static String formatPredecessors(List<Relation> relations) {
    if (relations == null || relations.isEmpty()) {
      return null;
    }

    List<String> parts = new ArrayList<>();
    for (Relation relation : relations) {
      if (relation == null || relation.getPredecessorTask() == null) {
        continue;
      }

      Task predecessor = relation.getPredecessorTask();
      String base = firstNonBlank(predecessor.getWBS(), toStringValue(predecessor.getUniqueID()));
      if (base == null) {
        continue;
      }

      RelationType relationType = relation.getType();
      String type = relationType != null ? relationType.toString() : null;
      Duration lag = relation.getLag();
      String lagText = lag != null ? lag.toString() : null;

      String value = type != null ? base + " " + type : base;
      if (lagText != null && !lagText.isBlank()) {
        value = value + " " + lagText;
      }
      parts.add(value);
    }

    if (parts.isEmpty()) {
      return null;
    }

    return String.join(", ", parts);
  }

  private static String firstNonBlank(String... values) {
    for (String value : values) {
      String sanitized = sanitize(value);
      if (sanitized != null) {
        return sanitized;
      }
    }
    return null;
  }

  private static String sanitize(String value) {
    if (value == null) {
      return null;
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  private static String toStringValue(Object value) {
    return value != null ? String.valueOf(value) : null;
  }
}
