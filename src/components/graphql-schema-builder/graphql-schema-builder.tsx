import { Component, Prop, State, Event, EventEmitter, h, Watch } from '@stencil/core';
import { GraphQLType, GraphQLField } from './types';
import { parseGraphQLSchema, generateGraphQLSchema } from '../../utils/graphql-utils';

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
  @State() searchQuery: string = '';
  @State() showAddDropdown: boolean = false;
  @State() showSchemaModal: boolean = false;
  @State() showImportModal: boolean = false;
  @State() importSchemaText: string = '';
  @State() showFilterDropdown: boolean = false;
  @State() typeFilter: ('type' | 'enum')[] = ['type'];
  @State() viewMode: 'card' | 'tree' = 'card';
  @State() showViewDropdown: boolean = false;
  @State() collapsedTypes: Set<string> = new Set();
  @State() pendingScope: string = '';
  @State() showAddDirectivesModal: boolean = false;
  @State() sortOrder: 'alphabetical' | 'scope' = 'alphabetical';
  @State() showSortDropdown: boolean = false;
  @State() hoveredType: string = null;
  @State() hoveredField: string = null;

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
        console.log('Selected field:', this.selectedField);
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

    // Retain directives when moving fields between types
    const newField: GraphQLField = { ...sourceField };

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
      console.log('Selected type:', this.selectedType);
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
      console.log('Selected field:', this.selectedField);
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

  private handleAddDropdownClick = (e: MouseEvent) => {
    e.stopPropagation();
    this.showAddDropdown = !this.showAddDropdown;
  };

  private handleAddType = () => {
    this.showAddDropdown = false;
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
    this.showAddDropdown = false;
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
    const typeIndex = this.types.findIndex(t => t.name === type.name);
    if (typeIndex === -1) return;

    const updatedType = { ...this.types[typeIndex] };
    updatedType.fields = updatedType.fields.filter(f => f.name !== field.name);

    const updatedTypes = [...this.types];
    updatedTypes[typeIndex] = updatedType;

    this.types = updatedTypes;
    this.selectedField = null;
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

  private handleFilterClick = () => {
    this.showFilterDropdown = !this.showFilterDropdown;
  };

  private handleFilterChange = (kind: 'type' | 'enum') => {
    if (this.typeFilter.includes(kind)) {
      this.typeFilter = this.typeFilter.filter(k => k !== kind);
    } else {
      this.typeFilter = [...this.typeFilter, kind];
    }
  };

  private getFilteredTypes(): GraphQLType[] {
    let filtered = this.types;
    
    // Apply type filter
    filtered = filtered.filter(type => this.typeFilter.includes(type.kind));
    
    // Apply search filter
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(type => 
        type.name.toLowerCase().includes(query) ||
        type.description?.toLowerCase().includes(query) ||
        type.fields.some(field => 
          field.name.toLowerCase().includes(query) ||
          field.description?.toLowerCase().includes(query)
        )
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (this.sortOrder === 'alphabetical') {
        return a.name.localeCompare(b.name);
      } else {
        // Sort by scope presence
        const aHasScope = a.directives?.some(d => d.startsWith('@dpi_requiredScope')) || false;
        const bHasScope = b.directives?.some(d => d.startsWith('@dpi_requiredScope')) || false;
        
        if (aHasScope === bHasScope) {
          // If both have or don't have scope, sort alphabetically
          return a.name.localeCompare(b.name);
        }
        // Types with scope come first
        return aHasScope ? -1 : 1;
      }
    });
    
    return filtered;
  }

  private handleSearchChange = (event: Event) => {
    const input = event.target as HTMLInputElement;
    this.searchQuery = input.value;
  };

  private handleViewSchema = () => {
    this.showSchemaModal = true;
  };

  private handleImportSchema = () => {
    this.showImportModal = true;
  };

  private handleCloseModal = () => {
    this.showSchemaModal = false;
    this.showImportModal = false;
    this.importSchemaText = '';
  };

  private handleImportSubmit = () => {
    try {
      this.types = parseGraphQLSchema(this.importSchemaText);
      this.handleCloseModal();
      this.emitChange();
    } catch (err) {
      this.error = err.message;
      setTimeout(() => {
        this.error = null;
      }, 3000);
    }
  };

  private getDirectiveBadges(directives: string[] = []) {
    const badges = [];
    
    if (directives.includes('@deprecated')) {
      badges.push({
        type: 'deprecated',
        label: 'Deprecated',
        color: '#6b7280'
      });
    }
    
    if (directives.some(d => d.startsWith('@standardizedAttribute'))) {
      badges.push({
        type: 'standardized',
        label: 'Attribute',
        color: '#3b82f6'
      });
    }
    
    if (directives.some(d => d.startsWith('@dataEntity'))) {
      badges.push({
        type: 'dataEntity',
        label: 'Entity',
        color: '#10b981'
      });
    }
    
    if (directives.some(d => d.startsWith('@dpi_requiredScope'))) {
      badges.push({
        type: 'scope',
        label: 'Scoped',
        color: '#f59e0b'
      });
    }
    
    return badges;
  }

  private handleAddDirectivesModal = () => {
    this.showAddDirectivesModal = true;
  };

  private handleCloseAddDirectivesModal = () => {
    this.showAddDirectivesModal = false;
  };

  private handleAddCustomDirective = (directive: string) => {
    if (this.activeTab === 'type' && this.selectedType) {
      if (!this.selectedType.directives) {
        this.selectedType.directives = [];
      }
      if (!this.selectedType.directives.includes(directive)) {
        this.selectedType.directives = [...this.selectedType.directives, directive];
        this.emitChange();
      }
    } else if (this.activeTab === 'field' && this.selectedField) {
      if (!this.selectedField.directives) {
        this.selectedField.directives = [];
      }
      if (!this.selectedField.directives.includes(directive)) {
        this.selectedField.directives = [...this.selectedField.directives, directive];
        this.selectedType.fields = this.selectedType.fields.map(f =>
          f.name === this.selectedField.name ? this.selectedField : f
        );
        this.emitChange();
      }
    }
    this.handleCloseAddDirectivesModal();
  };

  private renderAddDirectivesModal() {
    if (!this.showAddDirectivesModal) return null;

    return (
      <div class="modal show" onClick={this.handleCloseAddDirectivesModal}>
        <div class="modal-content" onClick={e => e.stopPropagation()}>
          <div class="modal-header">
            <h2>Add Directive</h2>
            <button class="modal-close" onClick={this.handleCloseAddDirectivesModal}>×</button>
          </div>
          <div class="modal-body">
            <button class="modal-btn" onClick={() => this.handleAddCustomDirective('@goTag')}>
              Add @goTag
            </button>
            <button class="modal-btn" onClick={() => this.handleAddCustomDirective('@goModel')}>
              Add @goModel
            </button>
          </div>
          <div class="modal-actions">
            <button class="modal-btn secondary" onClick={this.handleCloseAddDirectivesModal}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  private renderTypeCard(type: GraphQLType) {
    const directiveBadges = this.getDirectiveBadges(type.directives);
    
    return (
      <div 
        class={{
          'type-card': true,
          'dragging': this.isDragging,
          'selected': this.selectedType?.name === type.name,
          'drag-over': this.dragOverType === type.name
        }}
        onMouseEnter={() => this.hoveredType = type.name}
        onMouseLeave={() => this.hoveredType = null}
        onClick={() => this.handleTypeClick(type)}
        onDrop={(e) => this.handleDrop(e, type)}
        onDragOver={(e) => this.handleDragOver(e, type)}
        onDragLeave={() => this.handleDragLeave()}
      >
        <div class="type-header">
          <h3>
            {type.name}
            {directiveBadges.map(badge => (
              <span 
                class="directive-badge"
                style={{ backgroundColor: badge.color }}
                title={badge.label}
              >
                {badge.label}
              </span>
            ))}
          </h3>
          {this.hoveredType === type.name && (
            <button 
              class="delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                this.handleDeleteType(type);
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-trash">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6l-2 14H7L5 6"></path>
                <path d="M10 11v6"></path>
                <path d="M14 11v6"></path>
              </svg>
            </button>
          )}
        </div>
        {type.kind === 'type' ? (
          <div class="fields">
            {type.fields.map(field => {
              const fieldDirectiveBadges = this.getDirectiveBadges(field.directives);
              return (
                <div 
                  class={{
                    'field': true,
                    'selected': this.selectedField?.name === field.name,
                    'drag-over': this.dragOverField === field.name
                  }}
                  draggable={true}
                  onMouseEnter={() => this.hoveredField = field.name}
                  onMouseLeave={() => this.hoveredField = null}
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
                  {fieldDirectiveBadges.map(badge => (
                    <span 
                      class="directive-badge small"
                      style={{ backgroundColor: badge.color }}
                      title={badge.label}
                    >
                      {badge.label}
                    </span>
                  ))}
                  {this.hoveredField === field.name && (
                    <button 
                      class="delete-btn small"
                      onClick={(e) => {
                        e.stopPropagation();
                        this.handleDeleteField(type, field);
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-trash">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6l-2 14H7L5 6"></path>
                        <path d="M10 11v6"></path>
                        <path d="M14 11v6"></path>
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
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

  private parseVersionId(directive: string): string | null {
    // Extract version ID from standardizedAttribute or dataEntity directive
    const match = directive.match(/(?:standardizedAttributeVersionId|dataEntityVersionId):\s*['"]([^'"]+)['"]/);
    return match ? match[1] : null;
  }

  private renderDirectives(directives: string[]) {
    const isDeprecated = directives.includes('@deprecated');

    // Parse directive name and arguments into a structured format
    const parsedDirectives = directives
      .filter(d => d !== '@deprecated')
      .map(directive => {
        const [name, args] = directive.split('(');
        const directiveName = name.trim();
        const argumentsStr = args ? args.replace(/\)$/, '') : '';
        
        // Parse arguments into key-value pairs
        const argsObj: { [key: string]: string } = {};
        if (argumentsStr) {
          argumentsStr.split(',').forEach(arg => {
            const [key, value] = arg.split(':').map(s => s.trim());
            if (key && value) {
              // Remove quotes from value
              argsObj[key] = value.replace(/^['"]|['"]$/g, '');
            }
          });
        }

        return {
          name: directiveName,
          arguments: argsObj
        };
      });

    return (
      <div class="directives">
        <div class="directives-header">
          <h3>Directives</h3>
          <button class="schema-btn" onClick={this.handleAddDirectivesModal}>
            + Add Directive
          </button>
        </div>
        <table class="directives-table">
          <tbody>
            {parsedDirectives.map((directive, index) => (
              <tr key={index}>
                <td>
                  <div class="directive-name">{directive.name}</div>
                  {Object.entries(directive.arguments).length > 0 && (
                    <div class="directive-args">
                      {Object.entries(directive.arguments).map(([key, value]) => (
                        <div class="directive-arg">
                          {key}: "{value}"
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  <button 
                    class="delete-btn small"
                    onClick={() => this.handleRemoveDirective(directives[index])}
                  >
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-trash">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6l-2 14H7L5 6"></path>
                      <path d="M10 11v6"></path>
                      <path d="M14 11v6"></path>
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div class="directive-options">
          <label class="directive-checkbox">
            <input
              type="checkbox"
              checked={isDeprecated}
              onChange={(e) => {
                const target = e.target as HTMLInputElement;
                if (target.checked) {
                  this.handleAddDirective('@deprecated');
                } else {
                  this.handleRemoveDirective('@deprecated');
                }
              }}
            />
            <span>Deprecated</span>
          </label>
        </div>
        {this.renderAddDirectivesModal()}
      </div>
    );
  }

  private handleAddDirective = (directive: string) => {
    if (this.activeTab === 'type' && this.selectedType) {
      if (!this.selectedType.directives) {
        this.selectedType.directives = [];
      }
      if (!this.selectedType.directives.includes(directive)) {
        this.selectedType.directives = [...this.selectedType.directives, directive];
        this.emitChange();
      }
    } else if (this.activeTab === 'field' && this.selectedField) {
      if (!this.selectedField.directives) {
        this.selectedField.directives = [];
      }
      if (!this.selectedField.directives.includes(directive)) {
        this.selectedField.directives = [...this.selectedField.directives, directive];
        this.selectedType.fields = this.selectedType.fields.map(f =>
          f.name === this.selectedField.name ? this.selectedField : f
        );
        this.emitChange();
      }
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

  private parseScopeDirective(directive: string): string | null {
    const match = directive.match(/@dpi_requiredScope\(scope:\s*['"]([^'"]+)['"]\)/);
    return match ? match[1] : null;
  }

  private renderAuthSection(directives: string[]) {
    const scopeDirective = directives.find(d => d.startsWith('@dpi_requiredScope'));
    const currentScope = scopeDirective ? this.parseScopeDirective(scopeDirective) : '';

    return (
      <div class="auth-section">
        <h3>Authorization</h3>
        <div class="auth-scopes">
          <div class="auth-scope">
            <input
              type="text"
              value={this.pendingScope || currentScope}
              placeholder="Enter required scope..."
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                this.pendingScope = target.value;
              }}
            />
            <div class="button-group">
              {(this.pendingScope !== currentScope) && (
                <button 
                  class="apply-btn"
                  onClick={() => {
                    if (this.activeTab === 'type' && this.selectedType) {
                      this.handleUpdateScope(this.selectedType, this.pendingScope);
                    } else if (this.activeTab === 'field' && this.selectedField) {
                      this.handleUpdateScope(this.selectedField, this.pendingScope);
                    }
                    this.pendingScope = '';
                  }}
                >
                  Apply
                </button>
              )}
              {currentScope && (
                <button 
                  class="delete-btn small"
                  onClick={() => {
                    if (this.activeTab === 'type' && this.selectedType) {
                      this.handleRemoveScope(this.selectedType);
                    } else if (this.activeTab === 'field' && this.selectedField) {
                      this.handleRemoveScope(this.selectedField);
                    }
                    this.pendingScope = '';
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  private handleUpdateScope = (target: GraphQLType | GraphQLField, newScope: string) => {
    const directives = target.directives || [];
    const scopeDirective = directives.find(d => d.startsWith('@dpi_requiredScope'));
    
    if (newScope.trim()) {
      const newDirective = `@dpi_requiredScope(scope:"${newScope}")`;
      if (scopeDirective) {
        // Update existing directive
        const updatedDirectives = directives.map(d => 
          d === scopeDirective ? newDirective : d
        );
        if (target === this.selectedType) {
          this.selectedType.directives = updatedDirectives;
        } else if (target === this.selectedField) {
          this.selectedField.directives = updatedDirectives;
          this.selectedType.fields = this.selectedType.fields.map(f =>
            f.name === this.selectedField.name ? this.selectedField : f
          );
        }
      } else {
        // Add new directive
        if (target === this.selectedType) {
          this.selectedType.directives = [...directives, newDirective];
        } else if (target === this.selectedField) {
          this.selectedField.directives = [...directives, newDirective];
          this.selectedType.fields = this.selectedType.fields.map(f =>
            f.name === this.selectedField.name ? this.selectedField : f
          );
        }
      }
    } else if (scopeDirective) {
      // Remove directive if scope is empty
      this.handleRemoveScope(target);
    }
    
    this.emitChange();
  };

  private handleRemoveScope = (target: GraphQLType | GraphQLField) => {
    const directives = target.directives || [];
    const scopeDirective = directives.find(d => d.startsWith('@dpi_requiredScope'));
    
    if (scopeDirective) {
      this.handleRemoveDirective(scopeDirective);
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
            title="Close details"
            aria-label="Close details"
          />
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
            <input
              type="text"
              value={this.selectedType.name}
              onInput={this.handleTypeNameChange}
              placeholder="Type name"
              class="type-name-input"
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
            <div class="fields-section">
              <h3>Fields ({this.selectedType.fields.length})</h3>
              <table class="fields-table">
                <thead>
                  <tr>
                    <th class="field-name-header">Name</th>
                    <th class="field-type-header">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {this.selectedType.fields.map(field => {
                    const fieldTypeWithoutModifiers = field.type.replace(/[\[\]!]/g, ''); // Remove array and non-null markers
                    const isCustomType = this.types.some(t => t.name === fieldTypeWithoutModifiers);
                    return (
                      <tr key={field.name} class="field-item">
                        <td class="field-name-cell">{field.name}</td>
                        <td class="field-type-cell">
                          {isCustomType ? (
                            <a
                              href="#"
                              class="custom-type-link"
                              onClick={(e) => {
                                e.preventDefault();
                                const targetType = this.types.find(t => t.name === fieldTypeWithoutModifiers);
                                if (targetType) {
                                  this.selectedType = targetType;
                                  this.selectedField = null;
                                  this.activeTab = 'type';
                                }
                              }}
                            >
                              {field.type}
                            </a>
                          ) : (
                            field.type
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {this.renderDirectives(this.selectedType.directives || [])}
            {this.renderAuthSection(this.selectedType.directives || [])}
          </div>
        )}

        {this.activeTab === 'field' && this.selectedField && (
          <div class="field-details">
            <input
              type="text"
              value={this.selectedField.name}
              onInput={this.handleFieldNameChange}
              placeholder="Field name"
            />
            <select
              onInput={(e) => {
                const select = e.target as HTMLSelectElement;
                const newParentType = this.types.find(t => t.name === select.value);
                if (newParentType && this.selectedType) {
                  // Remove field from current type
                  this.selectedType.fields = this.selectedType.fields.filter(f => f !== this.selectedField);
                  // Add field to new parent type
                  newParentType.fields = [...newParentType.fields, this.selectedField];
                  this.selectedType = newParentType;
                  this.emitChange();
                }
              }}
              class="parent-type-select"
              aria-label="Parent type"
            >
              {this.types.map(type => (
                <option value={type.name} selected={type.name === this.selectedType.name}>
                  {type.name}
                </option>
              ))}
            </select>
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
            {this.renderDirectives(this.selectedField.directives || [])}
            {this.renderAuthSection(this.selectedField.directives || [])}
          </div>
        )}
      </div>
    );
  }

  private renderSchemaModal() {
    if (!this.showSchemaModal) return null;

    const schema = generateGraphQLSchema(this.types);

    return (
      <div class="modal show" onClick={this.handleCloseModal}>
        <div class="modal-content" onClick={e => e.stopPropagation()}>
          <div class="modal-header">
            <h2>GraphQL Schema</h2>
            <button class="modal-close" onClick={this.handleCloseModal}>×</button>
          </div>
          <textarea 
            class="schema-textarea"
            value={schema}
            readOnly
          />
          <div class="modal-actions">
            <button class="modal-btn secondary" onClick={this.handleCloseModal}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  private renderImportModal() {
    if (!this.showImportModal) return null;

    return (
      <div class="modal show" onClick={this.handleCloseModal}>
        <div class="modal-content" onClick={e => e.stopPropagation()}>
          <div class="modal-header">
            <h2>Import GraphQL Schema</h2>
            <button class="modal-close" onClick={this.handleCloseModal}>×</button>
          </div>
          <textarea 
            class="schema-textarea"
            value={this.importSchemaText}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              this.importSchemaText = target.value;
            }}
            placeholder="Paste your GraphQL schema here..."
          />
          <div class="modal-actions">
            <button class="modal-btn secondary" onClick={this.handleCloseModal}>
              Cancel
            </button>
            <button class="modal-btn primary" onClick={this.handleImportSubmit}>
              Import
            </button>
          </div>
        </div>
      </div>
    );
  }

  private renderFilterDropdown() {
    return (
      <div class={`filter-dropdown ${this.showFilterDropdown ? 'show' : ''}`}>
        <div 
          class={`filter-dropdown-item ${this.typeFilter.includes('type') ? 'active' : ''}`}
          onClick={() => this.handleFilterChange('type')}
        >
          Types
        </div>
        <div 
          class={`filter-dropdown-item ${this.typeFilter.includes('enum') ? 'active' : ''}`}
          onClick={() => this.handleFilterChange('enum')}
        >
          Enums
        </div>
      </div>
    );
  }

  private renderFieldDetails() {
    if (!this.selectedField) return null;

    const selectedFieldName = this.selectedField.name;
    const type = this.types.find(t => t.fields.some(f => f.name === selectedFieldName));
    if (!type) return null;

    const field = type.fields.find(f => f.name === selectedFieldName);
    if (!field) return null;

    // Check if the field type is a custom type
    const fieldTypeWithoutModifiers = field.type.replace(/[\[\]!]/g, ''); // Remove array and non-null markers
    const isCustomType = this.types.some(t => t.name === fieldTypeWithoutModifiers);
    const targetType = isCustomType ? this.types.find(t => t.name === fieldTypeWithoutModifiers) : null;

    return (
      <div class="field-details">
        <div class="field-header">
          <h3>{field.name}</h3>
          <button class="delete-btn" onClick={() => this.handleDeleteField(type, field)}>
            Delete
          </button>
        </div>
        <div class="field-info">
          <div class="info-row">
            <span class="info-label">Type:</span>
            <span class="info-value">{field.type}</span>
          </div>
          {field.description && (
            <div class="info-row">
              <span class="info-label">Description:</span>
              <span class="info-value">{field.description}</span>
            </div>
          )}
          {isCustomType && targetType && (
            <div class="info-row">
              <span class="info-label">Data Entity:</span>
              <div class="data-entity-info">
                <span class="entity-name">{targetType.name}</span>
                {targetType.directives?.includes('@dataEntity') && (
                  <span class="entity-version">
                    Version: 1
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        {this.renderDirectives(field.directives || [])}
      </div>
    );
  }

  private handleTreeNodeToggle = (typeName: string, e: MouseEvent) => {
    e.stopPropagation();
    const newCollapsedTypes = new Set(this.collapsedTypes);
    if (newCollapsedTypes.has(typeName)) {
      newCollapsedTypes.delete(typeName);
    } else {
      newCollapsedTypes.add(typeName);
    }
    this.collapsedTypes = newCollapsedTypes;
  };

  private renderTreeView() {
    return (
      <div class="tree-view">
        {this.getFilteredTypes().map(type => {
          const directiveBadges = this.getDirectiveBadges(type.directives);
          return (
            <div class={{
              'tree-node': true,
              'collapsed': this.collapsedTypes.has(type.name)
            }}>
              <div 
                class={{
                  'tree-node-header': true,
                  'selected': this.selectedType?.name === type.name,
                  'drag-over': this.dragOverType === type.name
                }}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('.tree-node-icon')) {
                    this.handleTreeNodeToggle(type.name, e);
                  } else {
                    this.handleTypeClick(type);
                  }
                }}
                onDrop={(e) => this.handleDrop(e, type)}
                onDragOver={(e) => this.handleDragOver(e, type)}
                onDragLeave={() => this.handleDragLeave()}
              >
                <span 
                  class="tree-node-icon"
                  onClick={(e) => this.handleTreeNodeToggle(type.name, e)}
                >
                  {type.kind === 'type' ? 'T' : 'E'}
                </span>
                <span class="tree-node-name">{type.name}</span>
                <span class="tree-node-type">{type.kind}</span>
                <div class="directive-badges">
                  {directiveBadges.map(badge => (
                    <span 
                      class="directive-badge"
                      style={{ backgroundColor: badge.color }}
                      title={badge.label}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
              </div>
              {type.kind === 'type' && (
                <div class="tree-node-children">
                  {type.fields.map(field => {
                    const fieldDirectiveBadges = this.getDirectiveBadges(field.directives);
                    return (
                      <div 
                        class={{
                          'tree-field': true,
                          'selected': this.selectedField?.name === field.name,
                          'drag-over': this.dragOverField === field.name
                        }}
                        onClick={() => this.handleFieldClick(field)}
                        draggable={true}
                        onDragStart={(e) => this.handleDragStart(e, type, field)}
                        onDragEnd={this.handleDragEnd}
                        onDrop={(e) => this.handleDrop(e, type, field)}
                        onDragOver={(e) => this.handleDragOver(e, type, field)}
                        onDragLeave={() => this.handleDragLeave()}
                      >
                        <span class="tree-field-name">{field.name}</span>
                        <span class="tree-field-type">
                          {field.isList ? '[' : ''}
                          {field.type}
                          {field.isList ? ']' : ''}
                          {field.isRequired ? '!' : ''}
                        </span>
                        <div class="directive-badges">
                          {fieldDirectiveBadges.map(badge => (
                            <span 
                              class="directive-badge small"
                              style={{ backgroundColor: badge.color }}
                              title={badge.label}
                            >
                              {badge.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {type.kind === 'enum' && (
                <div class="tree-node-children">
                  {type.values?.map(value => (
                    <div class="tree-field">
                      <span class="tree-field-name">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  private handleViewDropdownClick = (e: MouseEvent) => {
    e.stopPropagation();
    this.showViewDropdown = !this.showViewDropdown;
  };

  private handleSortDropdownClick = (e: MouseEvent) => {
    e.stopPropagation();
    this.showSortDropdown = !this.showSortDropdown;
  };

  private renderSortDropdown() {
    return (
      <div class={`sort-dropdown ${this.showSortDropdown ? 'show' : ''}`}>
        <div 
          class={`sort-dropdown-item ${this.sortOrder === 'alphabetical' ? 'active' : ''}`}
          onClick={() => {
            this.sortOrder = 'alphabetical';
            this.showSortDropdown = false;
          }}
        >
          Alphabetical
        </div>
        <div 
          class={`sort-dropdown-item ${this.sortOrder === 'scope' ? 'active' : ''}`}
          onClick={() => {
            this.sortOrder = 'scope';
            this.showSortDropdown = false;
          }}
        >
          By Scope
        </div>
      </div>
    );
  }

  private renderViewDropdown() {
    return (
      <div class={`view-dropdown ${this.showViewDropdown ? 'show' : ''}`}>
        <div 
          class={`view-dropdown-item ${this.viewMode === 'card' ? 'active' : ''}`}
          onClick={() => {
            this.viewMode = 'card';
            this.showViewDropdown = false;
          }}
        >
          Card View
        </div>
        <div 
          class={`view-dropdown-item ${this.viewMode === 'tree' ? 'active' : ''}`}
          onClick={() => {
            this.viewMode = 'tree';
            this.showViewDropdown = false;
          }}
        >
          Tree View
        </div>
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
            this.showAddDropdown = false;
            this.showFilterDropdown = false;
            this.showViewDropdown = false;
            this.showSortDropdown = false;
          }
        }}
      >
        <div class="header">
          <div class="search-box">
            <input
              type="text"
              placeholder="Search types and fields..."
              value={this.searchQuery}
              onInput={this.handleSearchChange}
            />
          </div>
          <div class="view-switcher">
            <button 
              class={{
                'view-btn': true,
                'active': this.showViewDropdown
              }}
              onClick={this.handleViewDropdownClick}
            >
              {this.viewMode === 'card' ? 'Card View' : 'Tree View'}
            </button>
            {this.renderViewDropdown()}
          </div>
          <div class="sort-switcher">
            <button 
              class={{
                'view-btn': true,
                'active': this.showSortDropdown
              }}
              onClick={this.handleSortDropdownClick}
            >
              {this.sortOrder === 'alphabetical' ? 'Sort: A-Z' : 'Sort: By Scope'}
            </button>
            {this.renderSortDropdown()}
          </div>
          <div class="filter-buttons">
            <div class="add-buttons">
              <button 
                class="filter-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  this.handleFilterClick();
                }}
              >
                Filter
              </button>
              {this.renderFilterDropdown()}
            </div>
          </div>
          <div class="schema-buttons">
            <button 
              class="schema-btn"
              onClick={this.handleViewSchema}
            >
              View Schema
            </button>
            <button 
              class="schema-btn"
              onClick={this.handleImportSchema}
            >
              Import Schema
            </button>
            <div class="add-buttons">
              <button 
                class="add-type-btn"
                onClick={this.handleAddDropdownClick}
              >
                Add New
              </button>
              <div class={`add-dropdown ${this.showAddDropdown ? 'show' : ''}`}>
                <div 
                  class="add-dropdown-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    this.handleAddType();
                  }}
                >
                  Type
                </div>
                <div 
                  class="add-dropdown-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    this.handleAddEnum();
                  }}
                >
                  Enum
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="main-content">
          <div class="types-grid" data-view={this.viewMode}>
            {this.viewMode === 'card' ? (
              this.getFilteredTypes().map(type => this.renderTypeCard(type))
            ) : (
              this.renderTreeView()
            )}
          </div>
          {this.renderSidebar()}
        </div>
        {this.error && (
          <div class="error-message">
            {this.error}
          </div>
        )}
        {this.renderSchemaModal()}
        {this.renderImportModal()}
      </div>
    );
  }
}