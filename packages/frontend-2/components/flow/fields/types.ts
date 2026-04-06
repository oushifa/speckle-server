export type DynamicFormOption = { label: string; value: string }

export type DynamicFormSchemaField = {
  key: string
  name: string
  type: string
  required?: boolean
  multiple?: boolean
  placeholder?: string | null
  options?: DynamicFormOption[]
}
