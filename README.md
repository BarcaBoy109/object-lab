# ObjectLab

ObjectLab is a step-by-step Java OOP visualizer for students. It connects each executed source line to the call stack, heap objects, reference identity, field mutation, and console output.

## Run it

No build step or dependencies are required. Open `index.html` directly, or serve the folder with any static server:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Supported learning subset

- Classes with primitive or `String` fields
- Constructors and `void` instance methods
- Object creation with `new`
- Local object-reference variables and copied references
- Object-typed fields, including object-to-object reference graphs
- Visible pointers from stack environments and object fields to heap objects
- Constructor/method parameters
- Field assignment and simple `+` expressions
- `System.out.println(...)`

The interpreter is intentionally small and educational. It is not a full Java compiler; inheritance, loops, conditionals, arrays, overloading, access control, static fields, and packages are planned future iterations.

## Keyboard shortcuts

- `Ctrl + Enter`: visualize
- `←` / `→`: move between steps
- `Space`: play or pause
