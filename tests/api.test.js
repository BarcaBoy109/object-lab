const {test} = require('node:test');
const assert = require('node:assert/strict');
const ObjectLab = require('../api.js');

const source = `class Main { public static void main(String[] args) { System.out.println("hello"); } }`;

test('public API simulates a program', () => {
  const events = ObjectLab.simulate(source);
  assert.equal(events.at(-1).console[0], 'hello');
  assert.ok(events.length > 1);
});

test('public API combines compiled model and events', () => {
  const result = ObjectLab.visualize(source);
  assert.ok(result.classes.Main);
  assert.equal(result.events.at(-1).console[0], 'hello');
});

test('public API validates source input', () => {
  assert.throws(() => ObjectLab.simulate(null), TypeError);
});

test('public API exposes independent array heap snapshots and for-each events', () => {
  const events = ObjectLab.simulate(`class Main {
    public static void main(String[] args) {
      int[] values = {1, 2};
      for (int value : values) { values[0] += value; }
      System.out.println(values[0]);
    }
  }`);
  assert.equal(events.at(-1).console[0], '4');
  assert.ok(events.some(event => event.kind === 'iteration' && event.changedIndex === 0));
  const snapshots = events.filter(event => event.arrays?.['1']);
  assert.ok(snapshots.length > 1);
  assert.notEqual(snapshots[0].arrays['1'].values[0], snapshots.at(-1).arrays['1'].values[0]);
});

test('public API preserves array diagnostics and rejects multidimensional syntax', () => {
  assert.throws(() => ObjectLab.simulate(`class Main { public static void main(String[] args) { int[] values = new int[1]; values[2] = 4; } }`), /out of bounds/);
  assert.throws(() => ObjectLab.compile(`class Main { public static void main(String[] args) { int[][] values = new int[1]; } }`), /Multidimensional arrays/);
});
