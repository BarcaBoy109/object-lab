# ObjectLab API

ObjectLab can be embedded in another JavaScript project without using the UI. The public API accepts a Java source string and returns the same inspectable data used by the visualizer.

## Browser

Load the interpreter first, followed by the API facade:

```html
<script src="https://your-host.example/objectlab/interpreter.js"></script>
<script src="https://your-host.example/objectlab/api.js"></script>
<script>
  const result = ObjectLab.visualize(`
    class Main {
      public static void main(String[] args) {
        System.out.println("Hello from ObjectLab");
      }
    }
  `);

  console.log(result.events.at(-1).console); // ["Hello from ObjectLab"]
</script>
```

## Node.js

Copy or import `api.js` and `interpreter.js` from this project:

```js
const ObjectLab = require('./api.js');

const events = ObjectLab.simulate(source);
const finalState = events.at(-1);
console.log(finalState.console);
```

## Methods

### `ObjectLab.compile(source)`

Parses and validates `source`, returning the compiled class model:

```js
const program = ObjectLab.compile(source);
console.log(Object.keys(program.classes));
```

### `ObjectLab.simulate(source)`

Parses and executes `source`, returning an array of historical visualization events. Every event includes the current `line`, `kind`, human-readable `title` and `text`, `stack`, `objects`, and `console` state. The final event represents the completed program.

```js
const events = ObjectLab.simulate(source);
for (const event of events) {
  console.log(event.line, event.kind, event.text);
}
```

Array-aware events additionally include an `arrays` map. Each record contains an array `id`, component `type`, `length`, and snapshot `values`; identities are stable across the timeline and earlier snapshots are immutable. `changed` identifies the affected heap entity, and `changedIndex` identifies an affected or visited array element when applicable.

### `ObjectLab.visualize(source)`

Convenience method returning `{ classes, main, events }`, combining `compile` and `simulate` in one result.

## Errors and limits

Invalid or unsupported programs throw an `Error` with a source-line diagnostic. A non-string `source` throws a `TypeError`. Execution is bounded by the interpreter's safety limits (2,000 visualization steps, 10,000 operations, and 64 call frames).

The supported Java subset and known limitations are listed in [README.md](README.md).
