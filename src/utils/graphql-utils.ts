import { GraphQLType, GraphQLField } from '../components/graphql-schema-builder/types';
import {
  parse,
  print,
  buildSchema,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  isObjectType,
  isInputObjectType,
  isEnumType,
  GraphQLEnumType,
} from 'graphql';

export function parseGraphQLSchema(schemaString: string): GraphQLType[] {
  try {
    const schema = buildSchema(schemaString);
    const types: GraphQLType[] = [];
    const typeMap = schema.getTypeMap();

    for (const [typeName, type] of Object.entries(typeMap)) {
      // Skip built-in types
      if (typeName.startsWith('__')) {
        continue;
      }

      // Handle enum types
      if (isEnumType(type)) {
        const enumType = type as GraphQLEnumType;
        types.push({
          name: typeName,
          fields: [],
          description: enumType.description || '',
          kind: 'enum',
          values: enumType.getValues().map(v => v.name)
        });
        continue;
      }

      // Handle object types
      if (isObjectType(type) || isInputObjectType(type)) {
        const fields = type.getFields();
        const parsedType: GraphQLType = {
          name: typeName,
          fields: [],
          description: type.description || '',
          isCustom: false,
          kind: 'type'
        };

        for (const [fieldName, field] of Object.entries(fields)) {
          let fieldType = field.type;
          let isList = false;
          let isRequired = false;

          // Handle non-null and list types
          if (fieldType instanceof GraphQLNonNull) {
            isRequired = true;
            fieldType = fieldType.ofType;
          }

          if (fieldType instanceof GraphQLList) {
            isList = true;
            fieldType = fieldType.ofType;
            // Check if the list items are non-null
            if (fieldType instanceof GraphQLNonNull) {
              isRequired = true;
              fieldType = fieldType.ofType;
            }
          }

          parsedType.fields.push({
            name: fieldName,
            type: fieldType.toString(),
            description: field.description || '',
            isRequired,
            isList,
            directives: field.astNode?.directives?.map(d => print(d)) || [],
          });
        }

        types.push(parsedType);
      }
    }

    return types;
  } catch (error) {
    console.error('Error parsing GraphQL schema:', error);
    throw error;
  }
}

export function generateGraphQLSchema(types: GraphQLType[]): string {
  let schema = '';

  for (const type of types) {
    if (type.description) {
      schema += `"""
${type.description}
"""\n`;
    }

    if (type.kind === 'enum') {
      schema += `enum ${type.name} {\n`;
      type.values?.forEach(value => {
        schema += `  ${value}\n`;
      });
      schema += '}\n\n';
      continue;
    }

    schema += `type ${type.name} {\n`;

    for (const field of type.fields) {
      if (field.description) {
        schema += `  """
  ${field.description}
  """\n`;
      }

      let fieldType = field.type;
      if (field.isList) {
        fieldType = `[${fieldType}]`;
      }
      if (field.isRequired) {
        fieldType = `${fieldType}!`;
      }

      const directives = field.directives?.length 
        ? ' ' + field.directives.join(' ') 
        : '';
      schema += `  ${field.name}: ${fieldType}${directives}\n`;
    }

    schema += '}\n\n';
  }

  // Validate the generated schema
  try {
    buildSchema(schema);
  } catch (error) {
    console.error('Generated invalid GraphQL schema:', error);
    throw error;
  }

  return schema.trim();
}

export function validateTypeName(name: string): boolean {
  return /^[_A-Za-z][_0-9A-Za-z]*$/.test(name);
}

export function validateFieldName(name: string): boolean {
  return /^[_a-zA-Z][_0-9A-Za-z]*$/.test(name);
} 