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
