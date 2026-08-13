import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.mpxj.CustomField;
import org.mpxj.ProjectFile;
import org.mpxj.Task;
import org.mpxj.TaskField;
import org.mpxj.reader.UniversalProjectReader;
import org.mpxj.writer.ProjectWriter;
import org.mpxj.writer.ProjectWriterUtility;

import java.io.File;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ProgressPlanMppWriter {
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  public static void main(String[] args) throws Exception {
    if (args.length < 2) {
      throw new IllegalArgumentException("Usage: ProgressPlanMppWriter <input-file> <output-file> [mappings-json-or-file]");
    }

    String inputFilePath = args[0];
    String outputFilePath = args[1];

    ProjectFile project = new UniversalProjectReader().read(inputFilePath);

    CustomField customField = project.getCustomFields().getOrCreate(TaskField.TEXT1);
    if (customField != null) {
      customField.setAlias("数智南北ID");
    }

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
        task.setText(1, matchedSysTaskId);
      }
    }

    ProjectWriter writer = ProjectWriterUtility.getProjectWriter(outputFilePath);
    writer.write(project, outputFilePath);
  }
}
