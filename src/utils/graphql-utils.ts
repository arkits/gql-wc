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

export function parseGraphQLSchema(schema: string): GraphQLType[] {
  const types: GraphQLType[] = [];
  const lines = schema.split('\n');
  let currentType: GraphQLType = null;
  let currentField: GraphQLField = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse type definition
    if (line.startsWith('type ') || line.startsWith('enum ')) {
      const kind = line.startsWith('type ') ? 'type' : 'enum';
      const typeDef = line.split('{')[0].trim();
      const name = typeDef.split(' ')[1].trim();
      
      currentType = {
        name,
        fields: [],
        kind,
        directives: [],
        directiveArgs: {}
      };

      // Parse directives on type
      const directiveMatches = typeDef.match(/@\w+(?:\([^)]+\))?/g);
      if (directiveMatches) {
        currentType.directives = directiveMatches;
        for (const directive of directiveMatches) {
          const [_, directiveName, args] = directive.match(/@(\w+)(?:\(([^)]+)\))?/);
          if (args) {
            const argMatch = args.match(/(\w+):\s*['"]([^'"]+)['"]/);
            if (argMatch) {
              const [_, argName, argValue] = argMatch;
              if (directive.startsWith('@dpi_requiredScope')) {
                currentType.directiveArgs.scope = argValue;
              } else if (directive.startsWith('@standardizedAttribute')) {
                currentType.directiveArgs.standardizedAttributeVersionId = argValue;
              } else if (directive.startsWith('@dataEntity')) {
                currentType.directiveArgs.dataEntityVersionId = argValue;
              }
            }
          }
        }
      }

      types.push(currentType);
    }
    // Parse field definition
    else if (line.includes(':')) {
      // Split by colon and get the field name and the rest
      const [fieldName, rest] = line.split(':').map(s => s.trim());
      
      // Extract the type part before any directives
      const typeMatch = rest.match(/^([^@]+)/);
      if (!typeMatch) continue;
      
      const typePart = typeMatch[1].trim();
      const isRequired = typePart.endsWith('!');
      const isList = typePart.startsWith('[');
      const type = typePart.replace(/[\[\]!]/g, '').trim();
      
      currentField = {
        name: fieldName,
        type,
        isRequired,
        isList,
        directives: [],
        directiveArgs: {}
      };

      // Parse any directives that might be after the type
      const directiveMatches = rest.match(/@\w+(?:\([^)]+\))?/g);
      if (directiveMatches) {
        currentField.directives = directiveMatches;
        for (const directive of directiveMatches) {
          const [_, directiveName, args] = directive.match(/@(\w+)(?:\(([^)]+)\))?/);
          if (args) {
            const argMatch = args.match(/(\w+):\s*['"]([^'"]+)['"]/);
            if (argMatch) {
              const [_, argName, argValue] = argMatch;
              if (directive.startsWith('@dpi_requiredScope')) {
                currentField.directiveArgs.scope = argValue;
              } else if (directive.startsWith('@standardizedAttribute')) {
                currentField.directiveArgs.standardizedAttributeVersionId = argValue;
              } else if (directive.startsWith('@dataEntity')) {
                currentField.directiveArgs.dataEntityVersionId = argValue;
              }
            }
          }
        }
      }

      currentType.fields.push(currentField);
    }
    // Parse enum values
    else if (currentType?.kind === 'enum' && line.match(/^\w+$/)) {
      if (!currentType.values) currentType.values = [];
      currentType.values.push(line);
    }
  }

  return types;
}

export function generateGraphQLSchema(types: GraphQLType[]): string {
  let schema = '';

  for (const type of types) {
    if (type.kind === 'type') {
      schema += `type ${type.name}`;
      if (type.directives?.length) {
        schema += ' ' + type.directives.map(directive => {
          if (directive === '@dpi_requiredScope' && type.directiveArgs?.scope) {
            return `${directive}(scope:"${type.directiveArgs.scope}")`;
          } else if (directive === '@standardizedAttribute' && type.directiveArgs?.standardizedAttributeVersionId) {
            return `${directive}(standardizedAttributeVersionId:"${type.directiveArgs.standardizedAttributeVersionId}")`;
          } else if (directive === '@dataEntity' && type.directiveArgs?.dataEntityVersionId) {
            return `${directive}(dataEntityVersionId:"${type.directiveArgs.dataEntityVersionId}")`;
          }
          return directive;
        }).join(' ');
      }
      schema += ' {\n';
      
      for (const field of type.fields) {
        schema += `  ${field.name}: ${field.isList ? '[' : ''}${field.type}${field.isList ? ']' : ''}${field.isRequired ? '!' : ''}`;
        if (field.directives?.length) {
          schema += ' ' + field.directives.map(directive => {
            if (directive === '@dpi_requiredScope' && field.directiveArgs?.scope) {
              return `${directive}(scope:"${field.directiveArgs.scope}")`;
            } else if (directive === '@standardizedAttribute' && field.directiveArgs?.standardizedAttributeVersionId) {
              return `${directive}(standardizedAttributeVersionId:"${field.directiveArgs.standardizedAttributeVersionId}")`;
            } else if (directive === '@dataEntity' && field.directiveArgs?.dataEntityVersionId) {
              return `${directive}(dataEntityVersionId:"${field.directiveArgs.dataEntityVersionId}")`;
            }
            return directive;
          }).join(' ');
        }
        schema += '\n';
      }
      schema += '}\n\n';
    } else if (type.kind === 'enum') {
      schema += `enum ${type.name} {\n`;
      for (const value of type.values || []) {
        schema += `  ${value}\n`;
      }
      schema += '}\n\n';
    }
  }

  return schema.trim();
}

export function validateTypeName(name: string): boolean {
  return /^[_A-Za-z][_0-9A-Za-z]*$/.test(name);
}

export function validateFieldName(name: string): boolean {
  return /^[_a-zA-Z][_0-9A-Za-z]*$/.test(name);
} 