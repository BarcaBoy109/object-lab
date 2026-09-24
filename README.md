# ObjectLab

ObjectLab is a step-by-step Java OOP visualizer for students. It connects each executed source line to the call stack, heap objects, reference identity, field mutation, and console output.

## Run it

No build step or dependencies are required. Open `index.html` directly, or serve the folder with any static server:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Supported learning subset

One-dimensional arrays of supported primitive types, `String`, and user-defined classes are supported, including declarations, `new Type[size]`, array literals, indexed reads/writes, aliases, and read-only `.length`. Newly allocated elements use Java defaults. Multidimensional arrays and collection APIs are not supported.

- Classes with primitive or `String` fields
- Constructors, instance methods, and static methods, including returned values
- Object creation with `new`
- Local object-reference variables and copied references
- Object-typed fields, including object-to-object reference graphs
- Visible pointers from stack environments and object fields to heap objects
- `public` and other common class/member modifiers
- Single inheritance with `extends`, inherited fields/methods, `@Override`, and runtime overriding through parent-typed references
- Explicit/implicit parent constructors, `super.method(...)`, and overloaded constructor delegation with `this(...)`
- Method and constructor overloading by argument count and declared types (including numeric widening and reference specificity)
- `for`, `while`, and `do-while` loops, nested loops, `break`, and `continue`
- Primitive locals, block scopes, `if`/`else`, comparisons, boolean short circuit, and arithmetic
- Direct object-field mutation and string concatenation in `println`
- Constructor/method parameters
- Local/field assignment, compound assignment, `++`/`--`, and string concatenation
- `System.out.println(...)`
- One-dimensional arrays of primitive types, `String`, and user-defined classes, including literals, indexed mutation, aliases, and read-only `.length`
- Enhanced for-each loops over arrays

The example picker includes inheritance/overriding, method/constructor overloads, loops, array mutation, array aliasing, for-each summation, and polymorphic object arrays. The timeline shows loop conditions and iterations, selected signatures, runtime dispatch, constructor frames, array elements, and state changes.

The interpreter is intentionally small and educational. It is not a full Java compiler. Multidimensional arrays, collections, `Iterable`, generics, casts, interfaces, abstract classes, packages, exceptions, varargs, static fields, and field hiding are unsupported. No command-line input is supplied; `main` receives an empty `String[] args`. Access control and `final` variable semantics are not enforced. Numbers use JavaScript's numeric storage rather than Java integer overflow/64-bit precision rules. Declare one variable per statement and use braces for loop-local declarations. Unsupported executed expressions report a source-line error rather than being silently skipped.

Execution is capped at 2,000 visualization steps, 10,000 interpreter operations, and 64 call frames to keep infinite loops and recursion from locking the page.

## Verify

With Node.js installed, run the regression suite:

```powershell
node --test tests/interpreter.test.js tests/api.test.js
```

## Use from another project

The visualizer engine is also available as a small JavaScript API. See [API.md](API.md) for browser and Node.js examples:

```js
const ObjectLab = require('objectlab');
const events = ObjectLab.simulate(javaSource);
console.log(events.at(-1).console);
```

Install it from npm with `npm install objectlab`. CommonJS and ES module imports
are supported:

```js
import { visualize } from 'objectlab';
const result = visualize(javaSource);
```

## Keyboard shortcuts

- `Ctrl + Enter`: visualize
- `←` / `→`: move between steps
- `Space`: play or pause
