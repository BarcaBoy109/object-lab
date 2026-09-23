const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {simulate, compile} = require('../interpreter.js');

const program = (body, classes = '') => `${classes}\nclass Main { public static void main(String[] args) { ${body} } }`;
const output = source => simulate(source).at(-1).console;
const examples = vm.runInNewContext(fs.readFileSync(require.resolve('../app.js'), 'utf8').split('const $ =')[0] + '\nexamples;');
for (const [name, expected] of Object.entries({bank:['150'], reference:['Pixel'], counter:['2'], graph:['Leo'], inheritance:['Meet Mochi', 'Mochi says woof!'], overloading:['Total: 14', 'Other: 10'], loops:['3'], arrays:['3', '7'], arrayFor:['10'], arrayAlias:['9'], polymorphicArrays:['dog']})) {
  test(`example: ${name}`, () => assert.deepEqual(output(examples[name]), expected));
}

test('inherited state, constructor chaining, super, and runtime overriding', () => {
  const source = program('Parent p = new Child(7); p.speak(); System.out.println(p.number);', `
    class Parent { int number; Parent(int n) { number = n; } void speak() { System.out.println("parent"); } }
    class Child extends Parent { Child(int n) { super(n); } @Override void speak() { super.speak(); System.out.println("child"); } }`);
  assert.deepEqual(output(source), ['parent', 'child', '7']);
  assert.ok(simulate(source).some(e => e.stack.some(f => f.name === 'Child.speak()')));
});

test('overload selection uses declared argument and receiver types before override dispatch', () => {
  const source = program('Animal pet = new Dog(); Base b = new Derived(); b.accept(pet); b.accept(new Dog());', `
    class Animal {} class Dog extends Animal {}
    class Base { void accept(Animal a) { System.out.println("base animal"); } }
    class Derived extends Base {
      @Override void accept(Animal a) { System.out.println("derived animal"); }
      void accept(Dog d) { System.out.println("derived dog"); }
    }`);
  assert.deepEqual(output(source), ['derived animal', 'derived animal']);
});

test('reference upcasts retain declared parameter types for nested overload calls', () => {
  assert.deepEqual(output(program('Test t = new Test(); t.run(new Dog());', `
    class Animal {} class Dog extends Animal {}
    class Test {
      void pick(Animal a) { System.out.println("animal"); }
      void pick(Dog d) { System.out.println("dog"); }
      void run(Animal a) { pick(a); }
    }`)), ['animal']);
});

test('overloads resolve by arity, primitive widening, inherited signatures and null specificity', () => {
  assert.deepEqual(output(program('Child c = new Child(); c.pick(1); c.pick(1.5); c.pick(2, 3); c.name(null);', `
    class Animal {} class Dog extends Animal {}
    class Parent { void pick(long x) { System.out.println("long"); } void name(Animal a) { System.out.println("animal"); } }
    class Child extends Parent {
      void pick(double x) { System.out.println("double"); }
      void pick(int x, int y) { System.out.println(x + y); }
      void name(Dog d) { System.out.println("dog"); }
    }`)), ['long', 'double', '5', 'dog']);
});

test('constructor field initializers run once after parent initialization', () => {
  assert.deepEqual(output(program('Child c = new Child(); System.out.println(c.n); System.out.println(c.m);', `
    class Parent { int n = 2; Parent() { n++; } }
    class Child extends Parent { int m = n + 1; Child() { this(5); } Child(int x) { m += x; } }`)), ['3', '9']);
});

test('for, while, do-while, nested loops, break, continue, and loop-local scope', () => {
  const source = program(`
    int total = 0;
    for (int i = 0; i < 4; i++) {
      if (i == 1) continue;
      for (int j = 0; j < 3; ++j) { if (j == 2) break; total += i; }
    }
    int i = 0;
    while (i < 2) { i++; total++; }
    do { total--; } while (false);
    System.out.println(total); System.out.println(i);`);
  assert.deepEqual(output(source), ['11', '2']);
  const trace = simulate(source);
  assert.ok(trace.some(e => e.kind === 'loop' && e.text.includes('false')));
  assert.ok(trace.some(e => e.stack.at(-1).vars.j === 1));
  assert.equal(trace.findLast(e => e.kind === 'output').stack.at(-1).vars.j, undefined);
});

test('continue in do-while checks the condition and for applies its update', () => {
  assert.deepEqual(output(program('int n = 0; do { n++; continue; } while(n < 2); for(int i = 0; i < 3; i++) { continue; } System.out.println(n);')), ['2']);
});

test('return-valued methods work inside loop conditions and expressions', () => {
  assert.deepEqual(output(program('Counter c = new Counter(); while(c.next() < 3) {} System.out.println(c.n); System.out.println(c.twice(4) + 1);', `
    class Counter { int n; int next() { return ++n; } int twice(int x) { return x * 2; } }`)), ['3', '9']);
});

test('local assignments do not mutate a same-named field; this resolves the field', () => {
  assert.deepEqual(output(program('Box b = new Box(4); b.update(); System.out.println(b.n);', `
    class Box { int n; Box(int n) { this.n = n; } void update() { int n = 10; n++; this.n += n; } }`)), ['15']);
});

test('comments, braces in strings, multiline calls and same-line statements parse correctly', () => {
  assert.deepEqual(output(program(`/* { ignored } */ int n = 2; // comment
    System.out.println(
      "{hello;} " + (n * 3 - 1)
    );`)), ['{hello;} 5']);
});

test('arithmetic precedence, integer division, left-associative concatenation, and short circuit', () => {
  assert.deepEqual(output(program('int n = 0; if (false && ++n > 0) n = 20; if (true || ++n > 0) n += 2; System.out.println(5 / 2); System.out.println(1 + 2 + "x"); System.out.println(n);')), ['2', '3x', '2']);
});

test('snapshot source lines and historical heap state remain stable', () => {
  const trace = simulate(program('Box b = new Box();\nb.n = 1;\nb.n = 2;', 'class Box { int n; }'));
  const writes = trace.filter(e => e.kind === 'mutate');
  assert.equal(writes[0].objects[1].fields.n, 1);
  assert.equal(writes[1].objects[1].fields.n, 2);
  assert.equal(writes[1].line, writes[0].line + 1);
});

for (const [name, source, message] of [
  ['inheritance cycle', program('', 'class A extends B {} class B extends A {}'), /Inheritance cycle/],
  ['unknown parent', program('', 'class A extends Missing {}'), /Parent class Missing/],
  ['invalid override', program('', 'class A { @Override void missing() {} }'), /no matching parent method/],
  ['duplicate signature', program('', 'class A { void f(int a) {} void f(int b) {} }'), /Duplicate signature/],
  ['wrong arity', program('A a = new A(); a.f();', 'class A { void f(int n) {} }'), /No matching overload/],
  ['wrong argument type', program('A a = new A(); a.f("bad");', 'class A { void f(int n) {} }'), /No matching overload/],
  ['ambiguous null', program('A a = new A(); a.f(null);', 'class B {} class C {} class A { void f(B b) {} void f(C c) {} }'), /Ambiguous overload/],
  ['missing parent constructor', program('B b = new B();', 'class A { A(int n) {} } class B extends A {}'), /No matching overload/],
  ['constructor cycle', program('A a = new A();', 'class A { A() { this(1); } A(int n) { this(); } }'), /Recursive constructor/],
  ['unsupported statement', program('mystery();'), /Cannot call mystery/],
  ['unknown expression', program('System.out.println(missing);'), /Unknown variable/],
  ['expired loop variable', program('for(int i = 0; i < 1; i++) {} System.out.println(i);'), /Unknown variable/],
  ['break outside loop', program('break;'), /inside a loop/],
  ['infinite loop', program('while(true) {}'), /Execution limit/],
  ['infinite recursion', program('A a = new A(); a.f();', 'class A { void f() { f(); } }'), /Call stack limit/],
  ['bad assignment', program('int n = "text";'), /Cannot assign/],
  ['bad condition', program('while(1) {}'), /condition must be boolean/],
  ['null receiver', program('A a = null; a.f();', 'class A { void f() {} }'), /null or non-object/],
]) test(`diagnostic: ${name}`, () => assert.throws(() => simulate(source), message));

test('compile retains all method and constructor signatures', () => {
  const {classes} = compile(examples.overloading);
  assert.equal(classes.Counter.methods.length, 5);
});

test('static overloads work through a class name and inside main', () => {
  assert.deepEqual(output(`class Main {
    static int add(int a, int b) { return a + b; }
    static String add(String a, String b) { return a + b; }
    public static void main(String[] args) {
      System.out.println(add(2, 3));
      System.out.println(Main.add("hello", " world"));
    }
  }`), ['5', 'hello world']);
});

test('covariant overrides preserve the caller-declared return type for overload resolution', () => {
  assert.deepEqual(output(program('Parent p = new Child(); Test t = new Test(); t.pick(p.make());', `
    class Animal {} class Dog extends Animal {}
    class Parent { Animal make() { return new Animal(); } }
    class Child extends Parent { @Override Dog make() { return new Dog(); } }
    class Test { void pick(Animal a) { System.out.println("animal"); } void pick(Dog d) { System.out.println("dog"); } }
  `)), ['animal']);
});

test('one-dimensional arrays support literals, aliases, indexed mutation, defaults, and stable snapshots', () => {
  const source = program('int[] values = {1, 2, 3}; int[] alias = values; alias[1] += 4; values[2]++; int[] empty = new int[0]; int[] defaults = new int[2]; System.out.println(values.length); System.out.println(values[1]); System.out.println(values[2]); System.out.println(empty.length); System.out.println(defaults[0]);');
  const trace = simulate(source);
  assert.deepEqual(trace.at(-1).console, ['3', '6', '4', '0', '0']);
  const arrays = trace.filter(e => e.arrays?.['1']);
  assert.ok(arrays.length > 1);
  assert.notDeepEqual(arrays[0].arrays['1'].values, arrays.at(-1).arrays['1'].values);
});

for (const [name, source, message] of [
  ['negative array size', program('int[] a = new int[-1];'), /non-negative integer/],
  ['out of bounds index', program('int[] a = new int[1]; System.out.println(a[1]);'), /out of bounds/],
  ['length write', program('int[] a = new int[1]; a.length = 2;'), /read-only/],
  ['multidimensional array', program('int[][] a = new int[2];'), /Multidimensional arrays/],
]) test(`array diagnostic: ${name}`, () => assert.throws(() => simulate(source), message));

test('enhanced for-each binds elements in order, scopes the variable, and supports control flow', () => {
  const source = program('int[] values = {1, 2, 3, 4}; int total = 0; for (int item : values) { if (item == 2) continue; if (item == 4) break; total += item; } System.out.println(total);');
  const trace = simulate(source);
  assert.deepEqual(trace.at(-1).console, ['4']);
  const iterations = trace.filter(e => e.kind === 'iteration');
  assert.equal(iterations.length, 4);
  assert.deepEqual(iterations.map(e => e.changedIndex), [0, 1, 2, 3]);
  assert.throws(() => simulate(program('int[] values = {1}; for (int item : values) {} System.out.println(item);')), /Unknown variable/);
});

test('for-each evaluates its array expression once and object values keep identity', () => {
  const source = program('Box[] boxes = {new Box(1), new Box(2)}; for (Box box : boxes) { box.n++; } System.out.println(boxes[0].n); System.out.println(boxes[1].n);', 'class Box { int n; Box(int n) { this.n = n; } }');
  assert.deepEqual(output(source), ['2', '3']);
});

test('explicit array component types survive empty literals and method boundaries', () => {
  const source = program('String[] empty = new String[]{}; int[] values = Test.make(); Test.take(values); System.out.println(empty.length); System.out.println(values[0]);', `
    class Test { static int[] make() { return new int[]{7}; } static void take(int[] values) { System.out.println(values.length); } }
  `);
  assert.deepEqual(output(source), ['1', '0', '7']);
});
