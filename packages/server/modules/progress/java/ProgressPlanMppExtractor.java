import com.fasterxml.jackson.databind.ObjectMapper;
import org.mpxj.Duration;
import org.mpxj.ProjectFile;
import org.mpxj.Relation;
import org.mpxj.RelationType;
import org.mpxj.Task;
import org.mpxj.reader.UniversalProjectReader;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class ProgressPlanMppExtractor {
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  public static void main(String[] args) throws Exception {
    if (args.length != 1) {
      throw new IllegalArgumentException("Usage: ProgressPlanMppExtractor <input-file>");
    }

    ProjectFile project = new UniversalProjectReader().read(args[0]);
    List<Map<String, Object>> tasks = new ArrayList<>();
    int[] sortOrder = {0};

    for (Task task : project.getChildTasks()) {
      visitTask(task, null, tasks, sortOrder);
    }

    OBJECT_MAPPER.writeValue(System.out, tasks);
  }

  private static void visitTask(
    Task task,
    Task parentTask,
    List<Map<String, Object>> output,
    int[] sortOrder
  ) {
    if (task == null) {
      return;
    }

    String name = sanitize(task.getName());
    Task effectiveParent = parentTask != null ? parentTask : task.getParentTask();

    if (name != null) {
      Map<String, Object> record = new LinkedHashMap<>();
      record.put("externalId", toStringValue(task.getUniqueID()));
      record.put("parentExternalId", effectiveParent != null ? toStringValue(effectiveParent.getUniqueID()) : null);
      record.put("wbs", firstNonBlank(task.getWBS(), task.getOutlineNumber()));
      record.put("name", name);
      record.put("level", normalizeLevel(task.getOutlineLevel()));
      record.put("sortOrder", sortOrder[0]++);
      record.put("duration", formatDuration(task));
      record.put("planStart", formatDate(task.getStart()));
      record.put("planEnd", formatDate(task.getFinish()));
      record.put("predecessor", formatPredecessors(task.getPredecessors()));
      record.put("inspectionBatch", sanitize(task.getText(1)));
      output.add(record);
      effectiveParent = task;
    }

    for (Task child : task.getChildTasks()) {
      visitTask(child, effectiveParent, output, sortOrder);
    }
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
