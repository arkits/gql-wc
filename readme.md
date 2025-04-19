[![Built With Stencil](https://img.shields.io/badge/-Built%20With%20Stencil-16161d.svg?logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDE5LjIuMSwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IgoJIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCA1MTIgNTEyOyIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI%2BCjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI%2BCgkuc3Qwe2ZpbGw6I0ZGRkZGRjt9Cjwvc3R5bGU%2BCjxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik00MjQuNywzNzMuOWMwLDM3LjYtNTUuMSw2OC42LTkyLjcsNjguNkgxODAuNGMtMzcuOSwwLTkyLjctMzAuNy05Mi43LTY4LjZ2LTMuNmgzMzYuOVYzNzMuOXoiLz4KPHBhdGggY2xhc3M9InN0MCIgZD0iTTQyNC43LDI5Mi4xSDE4MC40Yy0zNy42LDAtOTIuNy0zMS05Mi43LTY4LjZ2LTMuNkgzMzJjMzcuNiwwLDkyLjcsMzEsOTIuNyw2OC42VjI5Mi4xeiIvPgo8cGF0aCBjbGFzcz0ic3QwIiBkPSJNNDI0LjcsMTQxLjdIODcuN3YtMy42YzAtMzcuNiw1NC44LTY4LjYsOTIuNy02OC42SDMzMmMzNy45LDAsOTIuNywzMC43LDkyLjcsNjguNlYxNDEuN3oiLz4KPC9zdmc%2BCg%3D%3D&colorA=16161d&style=flat-square)](https://stenciljs.com)

# GraphQL Schema Builder Web Component

A web component built with Stencil.js that provides an interactive visual interface for building and modifying GraphQL schemas. This component allows users to create, edit, and visualize GraphQL types and their relationships through a drag-and-drop interface.

## Features

- 🎨 Visual schema builder with drag-and-drop interface
- 📝 Interactive type and field editing
- 🔄 Real-time schema generation
- 🎯 Input validation for GraphQL naming conventions
- 📚 Support for type and field descriptions
- 🔌 Easy integration with any web framework

## Installation

```bash
npm install gql-wc
```

## Usage

### Basic Usage

```html
<graphql-schema-builder></graphql-schema-builder>
```

### With Initial Schema

```html
<graphql-schema-builder schema="type User { id: ID! name: String! }"></graphql-schema-builder>
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `schema` | `string` | Initial GraphQL schema to load |
| `externalEntities` | `object` | External entities and attributes that can be used in the schema |

### Events

| Event | Description |
|-------|-------------|
| `schemaChange` | Emitted when the schema is modified, contains the updated types and GraphQL schema |

### Event Details

The `schemaChange` event emits an object with the following structure:

```typescript
{
  types: GraphQLType[];  // Internal representation of the types
  graphqlSchema: string; // Generated GraphQL schema string
}
```

## Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```

## Building

To build the component for production:

```bash
npm run build
```

## Examples

### Basic Schema Creation

```html
<graphql-schema-builder></graphql-schema-builder>

<script>
  const builder = document.querySelector('graphql-schema-builder');
  
  builder.addEventListener('schemaChange', (event) => {
    console.log('Generated Schema:', event.detail.graphqlSchema);
  });
</script>
```

### Loading External Schema

```html
<graphql-schema-builder id="schema-builder"></graphql-schema-builder>

<script>
  const schema = `
    type User {
      id: ID!
      name: String!
      email: String
      posts: [Post!]
    }

    type Post {
      id: ID!
      title: String!
      content: String
      author: User!
    }
  `;

  const builder = document.getElementById('schema-builder');
  builder.schema = schema;
</script>
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.