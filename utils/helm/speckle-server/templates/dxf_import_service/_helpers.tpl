{{- define "dxf_import_service.name" -}}
{{- default "speckle-dxf-import-service" .Values.dxf_import_service.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "dxf_import_service.fullname" -}}
{{- if .Values.dxf_import_service.fullnameOverride }}
{{- .Values.dxf_import_service.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default "speckle-dxf-import-service" .Values.dxf_import_service.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "dxf_import_service.labels" -}}
{{ include "speckle.commonLabels" . }}
app.kubernetes.io/component: {{ include "dxf_import_service.name" . }}
{{ include "dxf_import_service.selectorLabels" . }}
{{- end }}

{{- define "dxf_import_service.selectorLabels" -}}
app: {{ include "dxf_import_service.name" . }}
app.kubernetes.io/name: {{ include "dxf_import_service.name" . }}
{{ include "speckle.commonSelectorLabels" . }}
{{- end }}

{{- define "dxf_import_service.serviceAccountName" -}}
{{- if .Values.dxf_import_service.serviceAccount.create }}
{{- default (include "dxf_import_service.fullname" .) .Values.dxf_import_service.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.dxf_import_service.serviceAccount.name }}
{{- end }}
{{- end }}
