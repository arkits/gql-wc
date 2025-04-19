import { GraphQLType, GraphQLField } from '../components/graphql-schema-builder/types';
import {
  parse, visit,
  Kind,
  DirectiveNode, StringValueNode,
  NamedTypeNode,
  NonNullTypeNode,
  ListTypeNode
} from 'graphql';

export function parseGraphQLSchema(schema: string): GraphQLType[] {
  const types: GraphQLType[] = [];
  
  try {
    // Parse the schema into an AST
    const ast = parse(schema);
    
    // Visit each type definition in the AST
    visit(ast, {
      ObjectTypeDefinition(node) {
        const type: GraphQLType = {
          name: node.name.value,
          fields: [],
          kind: 'type',
          directives: [],
          directiveArgs: {}
        };

        // Parse directives on the type
        if (node.directives) {
          for (const directive of node.directives) {
            const directiveStr = buildDirectiveString(directive);
            type.directives.push(directiveStr);

            // Parse directive arguments
            if (directive.arguments) {
              for (const arg of directive.arguments) {
                if (arg.value.kind === Kind.STRING) {
                  if (directive.name.value === 'dpi_requiredScope' && arg.name.value === 'scope') {
                    type.directiveArgs.scope = arg.value.value;
                  } else if (directive.name.value === 'standardizedAttribute' && arg.name.value === 'standardizedAttributeVersionId') {
                    type.directiveArgs.standardizedAttributeVersionId = arg.value.value;
                  } else if (directive.name.value === 'dataEntity' && arg.name.value === 'dataEntityVersionId') {
                    type.directiveArgs.dataEntityVersionId = arg.value.value;
                  }
                }
              }
            }
          }
        }

        // Parse fields
        if (node.fields) {
          for (const fieldNode of node.fields) {
            const field: GraphQLField = {
              name: fieldNode.name.value,
              type: '',
              directives: [],
              directiveArgs: {},
              isRequired: false,
              isList: false
            };

            // Parse field type
            let typeNode = fieldNode.type;
            field.isRequired = typeNode.kind === Kind.NON_NULL_TYPE;
            if (field.isRequired) {
              typeNode = (typeNode as NonNullTypeNode).type;
            }
            field.isList = typeNode.kind === Kind.LIST_TYPE;
            if (field.isList) {
              typeNode = (typeNode as ListTypeNode).type;
              if (typeNode.kind === Kind.NON_NULL_TYPE) {
                typeNode = (typeNode as NonNullTypeNode).type;
              }
            }
            field.type = (typeNode as NamedTypeNode).name.value;

            // Parse field directives
            if (fieldNode.directives) {
              for (const directive of fieldNode.directives) {
                const directiveStr = buildDirectiveString(directive);
                field.directives.push(directiveStr);

                // Parse directive arguments
                if (directive.arguments) {
                  for (const arg of directive.arguments) {
                    if (arg.value.kind === Kind.STRING) {
                      if (directive.name.value === 'dpi_requiredScope' && arg.name.value === 'scope') {
                        field.directiveArgs.scope = arg.value.value;
                      } else if (directive.name.value === 'standardizedAttribute' && arg.name.value === 'standardizedAttributeVersionId') {
                        field.directiveArgs.standardizedAttributeVersionId = arg.value.value;
                      } else if (directive.name.value === 'dataEntity' && arg.name.value === 'dataEntityVersionId') {
                        field.directiveArgs.dataEntityVersionId = arg.value.value;
                      }
                    }
                  }
                }
              }
            }

            type.fields.push(field);
          }
        }

        types.push(type);
      },
      EnumTypeDefinition(node) {
        const enumType: GraphQLType = {
          name: node.name.value,
          fields: [],
          kind: 'enum',
          values: [],
          directives: [],
          directiveArgs: {}
        };

        // Parse enum values
        if (node.values) {
          enumType.values = node.values.map(value => value.name.value);
        }

        // Parse directives on the enum
        if (node.directives) {
          for (const directive of node.directives) {
            const directiveStr = buildDirectiveString(directive);
            enumType.directives.push(directiveStr);

            // Parse directive arguments
            if (directive.arguments) {
              for (const arg of directive.arguments) {
                if (arg.value.kind === Kind.STRING) {
                  if (directive.name.value === 'dpi_requiredScope' && arg.name.value === 'scope') {
                    enumType.directiveArgs.scope = arg.value.value;
                  }
                }
              }
            }
          }
        }

        types.push(enumType);
      }
    });

    return types;
  } catch (error) {
    console.error('Error parsing GraphQL schema:', error);
    throw error;
  }
}

function buildDirectiveString(directive: DirectiveNode): string {
  let str = `@${directive.name.value}`;
  if (directive.arguments && directive.arguments.length > 0) {
    const args = directive.arguments.map(arg => {
      const value = arg.value.kind === Kind.STRING 
        ? `"${(arg.value as StringValueNode).value}"`
        : (arg.value as any).value;
      return `${arg.name.value}:${value}`;
    });
    str += `(${args.join(',')})`;
  }
  return str;
}

export function generateGraphQLSchema(types: GraphQLType[]): string {
  let schema = '';

  for (const type of types) {
    if (type.kind === 'type') {
      schema += `type ${type.name}`;
      if (type.directives?.length) {
        schema += ' ' + type.directives.join(' ');
      }
      schema += ' {\n';
      
      for (const field of type.fields) {
        schema += `  ${field.name}: ${field.isList ? '[' : ''}${field.type}${field.isList ? ']' : ''}${field.isRequired ? '!' : ''}`;
        if (field.directives?.length) {
          schema += ' ' + field.directives.join(' ');
        }
        schema += '\n';
      }
      schema += '}\n\n';
    } else if (type.kind === 'enum') {
      schema += `enum ${type.name}`;
      if (type.directives?.length) {
        schema += ' ' + type.directives.join(' ');
      }
      schema += ' {\n';
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