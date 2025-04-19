export interface GraphQLType {
  name: string;
  description?: string;
  fields: GraphQLField[];
  isCustom?: boolean;
  directives?: string[];
  kind: 'type' | 'enum';
  values?: string[]; // For enum types
}

export interface GraphQLField {
  name: string;
  type: string;
  description?: string;
  isRequired?: boolean;
  isList?: boolean;
  directives?: string[];
} 