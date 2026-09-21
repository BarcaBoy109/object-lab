/*
 * Public ObjectLab API.
 *
 * Node:
 *   const ObjectLab = require('./api');
 * Browser:
 *   <script src="interpreter.js"></script>
 *   <script src="api.js"></script>
 *   ObjectLab.simulate(source);
 */
(function (root, loadInterpreter) {
  const interpreter = loadInterpreter();

  /**
   * Compile Java source into ObjectLab's inspectable class model.
   * @param {string} source
   * @returns {{classes: Object, main: Object}}
   */
  function compile(source) {
    assertSource(source);
    return interpreter.compile(source);
  }

  /**
   * Execute source and return the complete visualization timeline.
   * Each event is a historical snapshot, so callers can safely inspect or
   * serialize the returned array without affecting later steps.
   * @param {string} source
   * @returns {Array<Object>}
   */
  function simulate(source) {
    assertSource(source);
    return interpreter.simulate(source);
  }

  /**
   * Convenience wrapper for integrations that need both the class model and
   * the timeline in one call.
   * @param {string} source
   * @returns {{classes: Object, main: Object, events: Array<Object>}}
   */
  function visualize(source) {
    assertSource(source);
    return { ...compile(source), events: simulate(source) };
  }

  function assertSource(source) {
    if (typeof source !== 'string') {
      throw new TypeError('ObjectLab source must be a string.');
    }
  }

  const api = Object.freeze({ compile, simulate, visualize });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ObjectLab = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  if (typeof module !== 'undefined' && module.exports) return require('./interpreter.js');
  if (typeof ObjectLabInterpreter !== 'undefined') return ObjectLabInterpreter;
  throw new Error('Load interpreter.js before api.js in a browser.');
});
