import { Component, Prop, State, Event, EventEmitter, h, Watch } from '@stencil/core';
import { GraphQLType, GraphQLField } from './types';
import { parseGraphQLSchema, generateGraphQLSchema, validateTypeName, validateFieldName } from '../../utils/graphql-utils';

@Component({
  tag: 'graphql-schema-builder',
  styleUrl: 'graphql-schema-builder.css',
  shadow: true,
})
export class GraphQLSchemaBuilder {
  @Prop() schema: string;
  @Prop() externalEntities: { [key: string]: any[] } = {};

  @State() types: GraphQLType[] = [];
  @State() selectedType: GraphQLType = null;
  @State() selectedField: GraphQLField = null;
  @State() isDragging: boolean = false;
  @State() error: string = null;
  @State() activeTab: 'type' | 'field' = 'type';
  @State() dragOverType: string = null;
  @State() dragOverField: string = null;

  @Event() schemaChange: EventEmitter<{
    types: GraphQLType[];
    schema: string;
  }>;

  private graphQLPrimitives = [
    'ID',
    'String',
    'Int',
    'Float',
    'Boolean',
    'DateTime',
    'Upload'
  ];

  private getAvailableTypes(): string[] {
    return [
      ...this.graphQLPrimitives,
      ...this.types
        .filter(t => t.kind === 'type')
        .map(t => t.name),
      ...this.types
        .filter(t => t.kind === 'enum')
        .map(t => t.name)
    ];
  }

  componentWillLoad() {
    if (this.schema) {
      this.handleSchemaChange(this.schema);
    }
  }

  @Watch('schema')
  handleSchemaChange(newValue: string) {
    if (newValue) {
      try {
        this.types = parseGraphQLSchema(newValue);
      } catch (err) {
        this.error = err.message;
        setTimeout(() => {
          this.error = null;
        }, 3000);
      }
    }
  }

  private handleTypeClick = (type: GraphQLType) => {
    if (this.selectedType === type) {
      this.selectedType = null;
      this.selectedField = null;
      this.activeTab = 'type';
    } else {
      this.selectedType = type;
      this.selectedField = null;
      this.activeTab = 'type';
    }
  };

  private handleFieldClick = (field: GraphQLField) => {
    if (this.selectedField === field) {
      this.selectedField = null;
      this.activeTab = 'type';
    } else {
      const parentType = this.types.find(t => t.fields.includes(field));
      if (parentType) {
        this.selectedType = parentType;
        this.selectedField = field;
        this.activeTab = 'field';
      }
    }
  };

  private handleDragStart = (event: DragEvent, type: GraphQLType, field?: GraphQLField) => {
    if (!field) return; // Only allow dragging fields, not types
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', JSON.stringify({
      typeId: type.name,
      fieldId: field.name,
    }));
    
    this.isDragging = true;
    const target = event.target as HTMLElement;
    target.classList.add('dragging');
  };

  private handleDragEnd = (event: DragEvent) => {
    this.isDragging = false;
    const target = event.target as HTMLElement;
    target.classList.remove('dragging');
    this.dragOverType = null;
    this.dragOverField = null;
  };

  private handleDragOver = (event: DragEvent, type: GraphQLType, field?: GraphQLField) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    
    if (field) {
      this.dragOverField = field.name;
    } else {
      this.dragOverType = type.name;
    }
  };

  private handleDragLeave = () => {
    this.dragOverType = null;
    this.dragOverField = null;
  };

  private handleDrop = (event: DragEvent, targetType: GraphQLType, targetField?: GraphQLField) => {
    event.preventDefault();
    const data = JSON.parse(event.dataTransfer.getData('text/plain'));
    const sourceType = this.types.find(t => t.name === data.typeId);
    
    if (!sourceType) return;

    const sourceField = sourceType.fields.find(f => f.name === data.fieldId);
    if (!sourceField) return;

    // Create a new field with only the intended properties
    const newField: GraphQLField = {
      name: sourceField.name,
      type: sourceField.type,
      description: sourceField.description,
      isRequired: sourceField.isRequired,
      isList: sourceField.isList
    };

    let fieldName = newField.name;
    let counter = 1;
    
    // Ensure unique field name in target type
    while (targetType.fields.some(f => f.name === fieldName)) {
      fieldName = `${newField.name}${counter}`;
      counter++;
    }
    newField.name = fieldName;

    // Remove from source
    sourceType.fields = sourceType.fields.filter(f => f !== sourceField);

    // Add to target at the correct position
    if (targetField) {
      const targetIndex = targetType.fields.findIndex(f => f === targetField);
      if (targetIndex !== -1) {
        targetType.fields.splice(targetIndex, 0, newField);
      } else {
        targetType.fields.push(newField);
      }
    } else {
      // If dropping on the type card itself, add to the end
      targetType.fields.push(newField);
    }

    this.isDragging = false;
    this.dragOverType = null;
    this.dragOverField = null;
    this.emitChange();
  };

  private handleTypeNameChange = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (this.selectedType) {
      const newName = input.value;
      if (this.types.some(t => t.name === newName && t !== this.selectedType)) {
        this.error = 'Type name must be unique';
        setTimeout(() => {
          this.error = null;
        }, 3000);
        return;
      }
      this.selectedType = { ...this.selectedType, name: newName };
      this.types = this.types.map(t => 
        t.name === this.selectedType.name ? this.selectedType : t
      );
      this.emitChange();
    }
  };

  private handleFieldNameChange = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (this.selectedField && this.selectedType) {
      const newName = input.value;
      if (this.selectedType.fields.some(f => f.name === newName && f !== this.selectedField)) {
        this.error = 'Field name must be unique within type';
        setTimeout(() => {
          this.error = null;
        }, 3000);
        return;
      }
      this.selectedField = { ...this.selectedField, name: newName };
      this.selectedType.fields = this.selectedType.fields.map(f =>
        f.name === this.selectedField.name ? this.selectedField : f
      );
      this.emitChange();
    }
  };

  private handleFieldTypeChange = (event: Event) => {
    const select = event.target as HTMLSelectElement;
    if (this.selectedField && this.selectedType) {
      this.selectedField = { ...this.selectedField, type: select.value };
      this.selectedType.fields = this.selectedType.fields.map(f =>
        f.name === this.selectedField.name ? this.selectedField : f
      );
      this.emitChange();
    }
  };

  private handleAddType = () => {
    const name = this.generateUniqueName('NewType');
    const newType: GraphQLType = {
      name,
      fields: [],
      kind: 'type'
    };
    this.types = [...this.types, newType];
    this.selectedType = newType;
    this.selectedField = null;
    this.activeTab = 'type';
    this.emitChange();
  };

  private handleAddEnum = () => {
    const name = this.generateUniqueName('NewEnum');
    const newEnum: GraphQLType = {
      name,
      fields: [],
      kind: 'enum',
      values: ['VALUE1', 'VALUE2']
    };
    this.types = [...this.types, newEnum];
    this.selectedType = newEnum;
    this.selectedField = null;
    this.activeTab = 'type';
    this.emitChange();
  };

  private handleAddField = (type: GraphQLType) => {
    const name = this.generateUniqueName('newField', type.fields.map(f => f.name));
    const newField: GraphQLField = {
      name,
      type: 'String',
    };
    type.fields = [...type.fields, newField];
    this.selectedField = newField;
    this.activeTab = 'field';
    this.emitChange();
  };

  private handleAddEnumValue = (enumType: GraphQLType) => {
    if (enumType.kind !== 'enum') return;
    const value = this.generateUniqueName('VALUE', enumType.values || []);
    enumType.values = [...(enumType.values || []), value];
    this.emitChange();
  };

  private handleDeleteType = (type: GraphQLType) => {
    this.types = this.types.filter(t => t !== type);
    if (this.selectedType === type) {
      this.selectedType = null;
      this.selectedField = null;
    }
    this.emitChange();
  };

  private handleDeleteField = (type: GraphQLType, field: GraphQLField) => {
    type.fields = type.fields.filter(f => f !== field);
    if (this.selectedField === field) {
      this.selectedField = null;
    }
    this.emitChange();
  };

  private handleDeleteEnumValue = (enumType: GraphQLType, value: string) => {
    if (enumType.kind !== 'enum') return;
    enumType.values = enumType.values?.filter(v => v !== value);
    this.emitChange();
  };

  private generateUniqueName = (base: string, existing: string[] = this.types.map(t => t.name)) => {
    let name = base;
    let counter = 1;
    while (existing.includes(name)) {
      name = `${base}${counter}`;
      counter++;
    }
    return name;
  };

  private emitChange() {
    try {
      const schema = generateGraphQLSchema(this.types);
      this.schemaChange.emit({ types: this.types, schema });
    } catch (err) {
      this.error = err.message;
      setTimeout(() => {
        this.error = null;
      }, 3000);
    }
  }

  private handleCloseSidebar = () => {
    this.selectedType = null;
    this.selectedField = null;
    this.activeTab = 'type';
  };

  private renderTypeCard(type: GraphQLType) {
    return (
      <div 
        class={{
          'type-card': true,
          'dragging': this.isDragging,
          'selected': this.selectedType?.name === type.name,
          'drag-over': this.dragOverType === type.name
        }}
        onClick={() => this.handleTypeClick(type)}
        onDrop={(e) => this.handleDrop(e, type)}
        onDragOver={(e) => this.handleDragOver(e, type)}
        onDragLeave={() => this.handleDragLeave()}
      >
        <div class="type-header">
          <h3>{type.name}</h3>
          <button 
            class="delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              this.handleDeleteType(type);
            }}
          >
            ×
          </button>
        </div>
        {type.kind === 'type' ? (
          <div class="fields">
            {type.fields.map(field => (
              <div 
                class={{
                  'field': true,
                  'selected': this.selectedField?.name === field.name,
                  'drag-over': this.dragOverField === field.name
                }}
                draggable={true}
                onDragStart={(e) => this.handleDragStart(e, type, field)}
                onDragEnd={this.handleDragEnd}
                onDrop={(e) => this.handleDrop(e, type, field)}
                onDragOver={(e) => this.handleDragOver(e, type, field)}
                onDragLeave={() => this.handleDragLeave()}
                onClick={(e) => {
                  e.stopPropagation();
                  this.handleFieldClick(field);
                }}
              >
                <span class="field-name">{field.name}</span>
                <span class="field-type">
                  {field.isList ? '[' : ''}
                  {field.type}
                  {field.isList ? ']' : ''}
                  {field.isRequired ? '!' : ''}
                </span>
                <button 
                  class="delete-btn small"
                  onClick={(e) => {
                    e.stopPropagation();
                    this.handleDeleteField(type, field);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            <button 
              class="add-field-btn"
              onClick={(e) => {
                e.stopPropagation();
                this.handleAddField(type);
              }}
            >
              + Add Field
            </button>
          </div>
        ) : (
          <div class="fields">
            {type.values?.map(value => (
              <div class="enum-value">
                <span class="field-name">{value}</span>
                <button 
                  class="delete-btn small"
                  onClick={(e) => {
                    e.stopPropagation();
                    this.handleDeleteEnumValue(type, value);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            <button 
              class="add-field-btn"
              onClick={(e) => {
                e.stopPropagation();
                this.handleAddEnumValue(type);
              }}
            >
              + Add Value
            </button>
          </div>
        )}
      </div>
    );
  }

  private renderDirectives() {
    const directives = this.activeTab === 'type' 
      ? this.selectedType?.directives || []
      : this.selectedField?.directives || [];

    return (
      <div class="directives">
        <h3>Directives</h3>
        <div class="directive-list">
          {directives.map(directive => (
            <div class="directive-item">
              <span>{directive}</span>
              <button 
                class="delete-btn small"
                onClick={() => this.handleRemoveDirective(directive)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div class="directive-options">
          <button 
            class="add-directive-btn"
            onClick={() => this.handleAddDirective('@deprecated')}
          >
            Add @deprecated
          </button>
        </div>
      </div>
    );
  }

  private handleAddDirective = (directive: string) => {
    if (this.activeTab === 'type' && this.selectedType) {
      if (!this.selectedType.directives) {
        this.selectedType.directives = [];
      }
      this.selectedType.directives = [...this.selectedType.directives, directive];
      this.emitChange();
    } else if (this.activeTab === 'field' && this.selectedField) {
      if (!this.selectedField.directives) {
        this.selectedField.directives = [];
      }
      this.selectedField.directives = [...this.selectedField.directives, directive];
      this.selectedType.fields = this.selectedType.fields.map(f =>
        f.name === this.selectedField.name ? this.selectedField : f
      );
      this.emitChange();
    }
  };

  private handleRemoveDirective = (directive: string) => {
    if (this.activeTab === 'type' && this.selectedType) {
      this.selectedType.directives = this.selectedType.directives?.filter(d => d !== directive);
      this.emitChange();
    } else if (this.activeTab === 'field' && this.selectedField) {
      this.selectedField.directives = this.selectedField.directives?.filter(d => d !== directive);
      this.selectedType.fields = this.selectedType.fields.map(f =>
        f.name === this.selectedField.name ? this.selectedField : f
      );
      this.emitChange();
    }
  };

  private renderSidebar() {
    if (!this.selectedType) return null;

    return (
      <div class="sidebar">
        <div class="sidebar-header">
          <h2>Details</h2>
          <button 
            class="close-btn"
            onClick={this.handleCloseSidebar}
          >
            ×
          </button>
        </div>
        <div class="tabs">
          <button 
            class={{
              'tab': true,
              'active': this.activeTab === 'type'
            }}
            onClick={() => this.activeTab = 'type'}
          >
            Type Details
          </button>
          <button 
            class={{
              'tab': true,
              'active': this.activeTab === 'field',
              'disabled': !this.selectedField
            }}
            onClick={() => {
              if (this.selectedField) {
                this.activeTab = 'field';
              }
            }}
          >
            Field Details
          </button>
        </div>

        {this.activeTab === 'type' && (
          <div class="type-details">
            <h2>Type Details</h2>
            <input
              type="text"
              value={this.selectedType.name}
              onInput={this.handleTypeNameChange}
              placeholder="Type name"
            />
            <textarea
              value={this.selectedType.description || ''}
              placeholder="Type description..."
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                this.selectedType = { ...this.selectedType, description: target.value };
                this.emitChange();
              }}
            />
            {this.renderDirectives()}
          </div>
        )}

        {this.activeTab === 'field' && this.selectedField && (
          <div class="field-details">
            <h2>Field Details</h2>
            <input
              type="text"
              value={this.selectedField.name}
              onInput={this.handleFieldNameChange}
              placeholder="Field name"
            />
            <select
              onInput={this.handleFieldTypeChange}
              class="field-type-select"
              aria-label="Field type"
            >
              {this.getAvailableTypes().map(type => (
                <option 
                  value={type}
                  selected={type === this.selectedField.type}
                >
                  {type}
                </option>
              ))}
            </select>
            <textarea
              value={this.selectedField.description || ''}
              placeholder="Field description..."
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                this.selectedField = { ...this.selectedField, description: target.value };
                this.emitChange();
              }}
            />
            <div class="field-options">
              <label>
                <input
                  type="checkbox"
                  checked={this.selectedField.isRequired}
                  onChange={(e) => {
                    const target = e.target as HTMLInputElement;
                    this.selectedField = { ...this.selectedField, isRequired: target.checked };
                    this.selectedType.fields = this.selectedType.fields.map(f =>
                      f.name === this.selectedField.name ? this.selectedField : f
                    );
                    this.emitChange();
                  }}
                />
                Required
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={this.selectedField.isList}
                  onChange={(e) => {
                    const target = e.target as HTMLInputElement;
                    this.selectedField = { ...this.selectedField, isList: target.checked };
                    this.selectedType.fields = this.selectedType.fields.map(f =>
                      f.name === this.selectedField.name ? this.selectedField : f
                    );
                    this.emitChange();
                  }}
                />
                List
              </label>
            </div>
            {this.renderDirectives()}
          </div>
        )}
      </div>
    );
  }

  render() {
    return (
      <div 
        class="graphql-schema-builder"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            this.selectedType = null;
            this.selectedField = null;
            this.activeTab = 'type';
          }
        }}
      >
        <div class="types-grid">
          {this.types.map(type => this.renderTypeCard(type))}
          <div class="add-buttons">
            <button 
              class="add-type-btn"
              onClick={(e) => {
                e.stopPropagation();
                this.handleAddType();
              }}
            >
              + Add New Type
            </button>
            <button 
              class="add-type-btn"
              onClick={(e) => {
                e.stopPropagation();
                this.handleAddEnum();
              }}
            >
              + Add New Enum
            </button>
          </div>
        </div>
        {this.renderSidebar()}
        {this.error && (
          <div class="error-message">
            {this.error}
          </div>
        )}
      </div>
    );
  }
} 