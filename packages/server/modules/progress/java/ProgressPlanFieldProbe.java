import com.fasterxml.jackson.databind.ObjectMapper;
import org.mpxj.ProjectFile;
import org.mpxj.Task;
import org.mpxj.reader.UniversalProjectReader;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 只读探针：把 MPP 计划文件中每个任务可读取到的字段（含自定义字段）全部导出，
 * 用于确认工程量（数量/单位）等业务数据存放在哪个字段。
 *
 * 用法: java ProgressPlanFieldProbe <input-file>
 * 输出: JSON { projectTitle, customFieldDefinitions, taskCount, tasks: [...] }
 */
public class ProgressPlanFieldProbe {
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  // 自定义字段范围（MPXJ 按 1 起始的索引访问）
  private static final int TEXT_COUNT = 30;
  private static final int NUMBER_COUNT = 20;
  private static final int COST_COUNT = 10;
  private static final int FLAG_COUNT = 20;
  private static final int DATE_COUNT = 10;
  private static final int DURATION_COUNT = 10;
  private static final int START_COUNT = 10;
  private static final int FINISH_COUNT = 10;

  public static void main(String[] args) throws Exception {
    if (args.length != 1) {
      throw new IllegalArgumentException("Usage: ProgressPlanFieldProbe <input-file>");
    }

    ProjectFile project = new UniversalProjectReader().read(args[0]);
    Map<String, Object> out = new LinkedHashMap<>();

    String title = project.getProjectProperties().getProjectTitle();
    out.put("projectTitle", title != null && !title.trim().isEmpty() ? title.trim() : null);

    // 文件里实际有数据的字段类型（含自定义字段）
    List<String> populatedFields = project
      .getProjectProperties()
      .getPopulatedFields()
      .stream()
      .map(fieldType -> fieldType.toString())
      .sorted()
      .toList();
    out.put("populatedFields", populatedFields);

    // 自定义字段定义（MS Project 中列显示名/别名，例如把 TEXT3 改名为「工程量」）
    List<Map<String, Object>> customFieldDefs = new ArrayList<>();
    for (org.mpxj.CustomField cf : project.getCustomFields()) {
      Map<String, Object> def = new LinkedHashMap<>();
      def.put("field", cf.getFieldType().toString());
      def.put("alias", cf.getAlias());
      customFieldDefs.add(def);
    }
    out.put("customFieldDefinitions", customFieldDefs);

    // 按别名反查字段类型（工程量的常见显示名）
    Map<String, Object> aliasLookup = new LinkedHashMap<>();
    List<String> probeAliases = List.of(
      "工程量", "工程量数量", "数量", "单位", "计划工程量", "数智南北ID", "系统任务ID"
    );
    for (String alias : probeAliases) {
      try {
        org.mpxj.FieldType fieldType =
          project.getCustomFields().getFieldTypeByAlias(org.mpxj.FieldTypeClass.TASK, alias);
        if (fieldType != null) {
          aliasLookup.put(alias, fieldType.toString());
        }
      } catch (Exception ignored) {
        // 某些字段类型查不到别名，忽略
      }
    }
    out.put("aliasLookup", aliasLookup);

    List<Map<String, Object>> tasks = new ArrayList<>();
    for (Task task : project.getChildTasks()) {
      visitTask(task, tasks);
    }
    out.put("taskCount", tasks.size());
    out.put("tasks", tasks);

    OBJECT_MAPPER.writeValue(System.out, out);
  }

  private static void visitTask(Task task, List<Map<String, Object>> output) {
    if (task == null) {
      return;
    }

    Map<String, Object> record = new LinkedHashMap<>();
    record.put("id", task.getID());
    record.put("uniqueId", task.getUniqueID());
    record.put("wbs", task.getWBS());
    record.put("outlineNumber", task.getOutlineNumber());
    record.put("outlineLevel", task.getOutlineLevel());
    record.put("name", task.getName());
    record.put("summary", task.getSummary());
    record.put("milestone", task.getMilestone());
    record.put("duration", firstNonNull(task.getDurationText(), formatDuration(task)));
    record.put("start", formatDate(task.getStart()));
    record.put("finish", formatDate(task.getFinish()));
    record.put("work", task.getWork() != null ? task.getWork().toString() : null);
    record.put("percentComplete", task.getPercentageComplete());
    record.put("physicalPercentComplete", task.getPhysicalPercentComplete());
    record.put("cost", task.getCost());
    record.put("notes", sanitize(task.getNotes()));

    // 自定义字段：Text / Number / Cost / Flag / Date / Duration / Start / Finish
    record.put("textFields", collectTextFields(task));
    record.put("numberFields", collectIndexed(task, NUMBER_COUNT, 'N'));
    record.put("costFields", collectIndexed(task, COST_COUNT, 'C'));
    record.put("flagFields", collectIndexed(task, FLAG_COUNT, 'F'));
    record.put("dateFields", collectIndexed(task, DATE_COUNT, 'D'));
    record.put("durationFields", collectIndexed(task, DURATION_COUNT, 'R'));
    record.put("startFields", collectIndexed(task, START_COUNT, 'S'));
    record.put("finishFields", collectIndexed(task, FINISH_COUNT, 'E'));

    output.add(record);

    for (Task child : task.getChildTasks()) {
      visitTask(child, output);
    }
  }

  private static Map<String, Object> collectTextFields(Task task) {
    Map<String, Object> values = new LinkedHashMap<>();
    for (int i = 1; i <= TEXT_COUNT; i++) {
      String value = sanitize(task.getText(i));
      if (value != null) {
        values.put("TEXT" + i, value);
      }
    }
    return values;
  }

  /** kind: N=Number, C=Cost, F=Flag, D=Date, R=Duration, S=Start, E=Finish */
  private static Map<String, Object> collectIndexed(Task task, int count, char kind) {
    Map<String, Object> values = new LinkedHashMap<>();
    String prefix = switch (kind) {
      case 'N' -> "NUMBER";
      case 'C' -> "COST";
      case 'F' -> "FLAG";
      case 'D' -> "DATE";
      case 'R' -> "DURATION";
      case 'S' -> "START";
      case 'E' -> "FINISH";
      default -> "FIELD";
    };
    for (int i = 1; i <= count; i++) {
      Object value = readIndexed(task, kind, i);
      if (value != null) {
        values.put(prefix + i, value);
      }
    }
    return values;
  }

  private static Object readIndexed(Task task, char kind, int index) {
    return switch (kind) {
      case 'N' -> task.getNumber(index);
      case 'C' -> task.getCost(index);
      case 'F' -> task.getFlag(index) ? Boolean.TRUE : null;
      case 'D' -> formatDate(task.getDate(index));
      case 'R' -> task.getDuration(index) != null ? task.getDuration(index).toString() : null;
      case 'S' -> formatDate(task.getStart(index));
      case 'E' -> formatDate(task.getFinish(index));
      default -> null;
    };
  }

  private static String formatDuration(Task task) {
    org.mpxj.Duration duration = task.getDuration();
    return duration != null ? duration.toString() : null;
  }

  private static String formatDate(java.time.LocalDateTime value) {
    return value != null ? value.toString() : null;
  }

  private static String firstNonNull(String... values) {
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
}
