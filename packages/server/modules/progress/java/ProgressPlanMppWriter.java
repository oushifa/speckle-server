import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.mpxj.CustomField;
import org.mpxj.FieldType;
import org.mpxj.ProjectFile;
import org.mpxj.Task;
import org.mpxj.TaskField;
import org.mpxj.reader.UniversalProjectReader;
import org.mpxj.writer.FileFormat;
import org.mpxj.writer.ProjectWriter;
import org.mpxj.writer.UniversalProjectWriter;

import java.io.File;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 导出 MPP 计划文件，并把系统任务 ID（sysTaskId）回写到文件，用于下次导入时
 * 判断「哪些任务是修改、哪些是新增」。
 *
 * sysTaskId 的写入槽位（不改变原文件已占用的物理槽位）：
 *   1. 若文件里已存在别名为「数智南北ID」的列，直接复用该列；
 *   2. 否则从 Text5 开始，动态寻找一个「既没有自定义字段别名、也没有任何任务数据」
 *      的空闲 Text 槽位，写入 sysTaskId 并设置别名「数智南北ID」。
 *   不硬编码 Text5，避免被其他数据类型占用。
 *
 * 注意：当前运行环境所用的 mpxj 版本不支持写 .mpp 二进制（FileFormat 无 MPP），
 * 只能导出 MSPDI(.xml) / MPX / JSON 等格式；如需直接导出 .mpp，需替换为
 * 支持 MPP 写入的 mpxj 版本。
 */
public class ProgressPlanMppWriter {
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  private static final String SYS_TASK_ID_ALIAS = "数智南北ID";
  /**
   * sysTaskId 写入值的前缀：即使别名在跨工具（如 MS Project 打开 MSPDI）后丢失，
   * 重新导入时也能按前缀扫描识别出 sysTaskId 所在列。
   */
  private static final String SYS_TASK_ID_VALUE_PREFIX = "SYSID:";
  /** 业务列起始槽位：Text1-4 已约定为工程量/工效/投入/单位，从 Text5 开始找空闲列 */
  private static final int SYS_TASK_ID_START_INDEX = 5;
  private static final int MAX_TEXT_INDEX = 30;
  private static final Pattern TEXT_INDEX_PATTERN = Pattern.compile("^Text(\\d+)$");

  public static void main(String[] args) throws Exception {
    if (args.length < 2) {
      throw new IllegalArgumentException("Usage: ProgressPlanMppWriter <input-file> <output-file> [mappings-json-or-file]");
    }

    String inputFilePath = args[0];
    String outputFilePath = args[1];

    ProjectFile project = new UniversalProjectReader().read(inputFilePath);

    FieldType sysTaskIdField = resolveSysTaskIdField(project);

    Map<String, String> sysTaskIdMapByExternalId = new HashMap<>();
    Map<String, String> sysTaskIdMapByWbs = new HashMap<>();

    if (args.length >= 3) {
      String jsonContent = args[2];
      File jsonFile = new File(jsonContent);
      List<Map<String, String>> mappings;
      if (jsonFile.exists() && jsonFile.isFile()) {
        mappings = OBJECT_MAPPER.readValue(jsonFile, new TypeReference<List<Map<String, String>>>() {});
      } else {
        mappings = OBJECT_MAPPER.readValue(jsonContent, new TypeReference<List<Map<String, String>>>() {});
      }

      for (Map<String, String> entry : mappings) {
        String sysTaskId = entry.get("sysTaskId");
        if (sysTaskId == null || sysTaskId.trim().isEmpty()) {
          sysTaskId = entry.get("id");
        }
        if (sysTaskId == null || sysTaskId.trim().isEmpty()) {
          continue;
        }

        String externalId = entry.get("externalId");
        String wbs = entry.get("wbs");

        if (externalId != null && !externalId.trim().isEmpty()) {
          sysTaskIdMapByExternalId.put(externalId.trim(), sysTaskId.trim());
        }
        if (wbs != null && !wbs.trim().isEmpty()) {
          sysTaskIdMapByWbs.put(wbs.trim(), sysTaskId.trim());
        }
      }
    }

    for (Task task : project.getTasks()) {
      if (task == null) {
        continue;
      }

      String externalId = task.getUniqueID() != null ? String.valueOf(task.getUniqueID()) : null;
      String wbs = task.getWBS() != null ? task.getWBS().trim() : (task.getOutlineNumber() != null ? task.getOutlineNumber().trim() : null);

      String matchedSysTaskId = null;
      if (externalId != null && sysTaskIdMapByExternalId.containsKey(externalId)) {
        matchedSysTaskId = sysTaskIdMapByExternalId.get(externalId);
      } else if (wbs != null && sysTaskIdMapByWbs.containsKey(wbs)) {
        matchedSysTaskId = sysTaskIdMapByWbs.get(wbs);
      }

      if (matchedSysTaskId != null) {
        // 只写入 sysTaskId 列，不触碰 Text1(工程量)/Text4(单位) 等业务列；
        // 值带 SYSID: 前缀，作为别名丢失时的兜底识别依据
        task.set(sysTaskIdField, SYS_TASK_ID_VALUE_PREFIX + matchedSysTaskId);
      }
    }

    FileFormat format = resolveFileFormat(outputFilePath);
    ProjectWriter writer = new UniversalProjectWriter(format);
    writer.write(project, outputFilePath);
  }

  /**
   * 解析 sysTaskId 应写入的 Text 槽位：
   * 优先复用已存在「数智南北ID」别名的列；否则动态寻找无别名、无数据的空闲 Text 槽位。
   */
  private static FieldType resolveSysTaskIdField(ProjectFile project) {
    FieldType existing = findAliasField(project, SYS_TASK_ID_ALIAS);
    if (existing != null) {
      return existing;
    }

    Set<Integer> occupiedIndexes = new HashSet<>();

    // 有自定义字段别名定义的槽位（例如 Text2=工效、Text3=投入）不可用
    for (CustomField customField : project.getCustomFields()) {
      Integer index = textIndex(customField.getFieldType());
      if (index != null) {
        occupiedIndexes.add(index);
      }
    }

    // 任何任务有数据的槽位不可用（避免覆盖已有内容）
    for (Task task : project.getTasks()) {
      if (task == null) {
        continue;
      }
      for (int index = 1; index <= MAX_TEXT_INDEX; index++) {
        if (!occupiedIndexes.contains(index) && hasValue(task.getText(index))) {
          occupiedIndexes.add(index);
        }
      }
    }

    for (int index = SYS_TASK_ID_START_INDEX; index <= MAX_TEXT_INDEX; index++) {
      if (!occupiedIndexes.contains(index)) {
        CustomField customField = project
          .getCustomFields()
          .getOrCreate(TaskField.valueOf("TEXT" + index));
        if (customField == null) {
          throw new IllegalStateException("Failed to create custom field Text" + index);
        }
        customField.setAlias(SYS_TASK_ID_ALIAS);
        return TaskField.valueOf("TEXT" + index);
      }
    }

    throw new IllegalStateException(
      "没有可用的 Text 槽位写入 sysTaskId（Text" + SYS_TASK_ID_START_INDEX +
      "~Text" + MAX_TEXT_INDEX + " 均已被占用）"
    );
  }

  /** 按别名查找已存在的自定义字段列 */
  private static FieldType findAliasField(ProjectFile project, String alias) {
    for (CustomField customField : project.getCustomFields()) {
      if (customField != null && alias.equals(customField.getAlias())) {
        return customField.getFieldType();
      }
    }
    return null;
  }

  /** 提取 Text 类字段的索引（如 Text5 -> 5），非 Text 字段返回 null */
  private static Integer textIndex(FieldType fieldType) {
    if (fieldType == null) {
      return null;
    }
    Matcher matcher = TEXT_INDEX_PATTERN.matcher(fieldType.toString());
    return matcher.matches() ? Integer.valueOf(matcher.group(1)) : null;
  }

  private static boolean hasValue(String value) {
    return value != null && !value.trim().isEmpty();
  }

  private static FileFormat resolveFileFormat(String outputFilePath) throws IllegalArgumentException {
    String lower = outputFilePath.toLowerCase(Locale.ROOT);
    if (lower.endsWith(".mspdi") || lower.endsWith(".xml")) {
      return FileFormat.MSPDI;
    }
    if (lower.endsWith(".mpx")) {
      return FileFormat.MPX;
    }
    if (lower.endsWith(".json")) {
      return FileFormat.JSON;
    }
    if (lower.endsWith(".mpp")) {
      throw new IllegalArgumentException(
        "当前 mpxj 版本不支持写 .mpp 二进制文件（FileFormat 无 MPP）。" +
        "请改用 .xml/.mspdi（MS Project 可打开）或升级支持 MPP 写入的 mpxj 版本。"
      );
    }
    return FileFormat.MSPDI;
  }
}
