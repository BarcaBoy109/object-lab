/* A deliberately bounded Java teaching interpreter. No source is evaluated as JavaScript. */
(function (root) {
  'use strict';
  const fail = (line, message) => { throw new Error(`Line ${line}: ${message}`); };
  const modifiers = new Set(['public', 'private', 'protected', 'static', 'final', 'synchronized']);
  const numeric = ['char', 'int', 'long', 'double'];
  const signature = method => `${method.name}(${method.params.map(p => p.type).join(', ')})`;

  function tokenize(source) {
    const tokens = []; let offset = 0, line = 1;
    const pattern = /\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])'|\d+(?:\.\d+)?[LlDd]?|[A-Za-z_$][\w$]*|==|!=|<=|>=|&&|\|\||\+\+|--|\+=|-=|\*=|\/=|%=|[{}()[\];,.@+*/%<>=!:-]/y;
    while (offset < source.length) {
      pattern.lastIndex = offset;
      const match = pattern.exec(source);
      if (!match) fail(line, `Unsupported token near “${source.slice(offset, offset + 16)}”.`);
      const text = match[0];
      if (!/^\s|^\/\//.test(text) && !text.startsWith('/*')) tokens.push({text, line});
      line += (text.match(/\n/g) || []).length; offset = pattern.lastIndex;
    }
    tokens.push({text: '<eof>', line}); return tokens;
  }

  function compile(source) {
    const tokens = tokenize(source); let pos = 0;
    const peek = (n = 0) => tokens[Math.min(pos + n, tokens.length - 1)];
    const at = text => peek().text === text;
    const take = () => tokens[pos++];
    const accept = text => at(text) ? take() : null;
    const expect = text => accept(text) || fail(peek().line, `Expected “${text}”, found “${peek().text}”.`);
    const identifier = () => {
      if (!/^[A-Za-z_$][\w$]*$/.test(peek().text)) fail(peek().line, 'Expected an identifier.');
      return take().text;
    };
    function readType() { let type = identifier(); if (accept('[')) { expect(']'); type += '[]'; if (at('[')) fail(peek().line, 'Multidimensional arrays are not supported.'); } return type; }
    function readModifiers() {
      const flags = new Set();
      while (modifiers.has(peek().text) || at('@')) {
        if (accept('@')) { expect('Override'); flags.add('@Override'); }
        else flags.add(take().text);
      }
      return flags;
    }
    const precedence = {'=':1, '+=':1, '-=':1, '*=':1, '/=':1, '%=':1, '||':2, '&&':3, '==':4, '!=':4, '<':5, '>':5, '<=':5, '>=':5, '+':6, '-':6, '*':7, '/':7, '%':7};
    function argumentsList() {
      const args = []; expect('(');
      if (!at(')')) do { args.push(expression()); } while (accept(','));
      expect(')'); return args;
    }
    function expression(min = 1) {
      const token = take(); let node;
      if (['!', '-', '+', '++', '--'].includes(token.text)) node = {kind:'unary', op:token.text, expr:expression(8), line:token.line};
      else if (token.text === '(') { node = expression(); expect(')'); }
      else if (token.text === 'new') {
        const type = identifier();
        if (accept('[')) {
          if (accept(']')) {
            expect('{'); const values = []; if (!at('}')) do { values.push(expression()); } while (accept(',')); expect('}');
            node = {kind:'arrayLiteral', type, values, line:token.line};
          } else { const size = expression(); expect(']'); if (at('[')) fail(peek().line, 'Multidimensional arrays are not supported.'); node = {kind:'newArray', type, size, line:token.line}; }
        }
        else node = {kind:'new', type, args:argumentsList(), line:token.line};
      }
      else if (/^(?:\d|"|')/.test(token.text) || ['true', 'false', 'null'].includes(token.text)) node = {kind:'literal', raw:token.text, line:token.line};
      else if (/^[A-Za-z_$][\w$]*$/.test(token.text)) node = {kind:'name', name:token.text, line:token.line};
      else fail(token.line, `Expected an expression, found “${token.text}”.`);
      while (true) {
        if (accept('.')) node = {kind:'member', object:node, name:identifier(), line:token.line};
        else if (accept('[')) { const index = expression(); expect(']'); node = {kind:'index', object:node, index, line:token.line}; }
        else if (at('(')) node = {kind:'call', target:node, args:argumentsList(), line:token.line};
        else if (at('++') || at('--')) node = {kind:'postfix', op:take().text, expr:node, line:token.line};
        else break;
      }
      while (precedence[peek().text] >= min) {
        const op = take().text, level = precedence[op];
        node = {kind:level === 1 ? 'assign' : 'binary', op, left:node, right:expression(level === 1 ? level : level + 1), line:token.line};
      }
      return node;
    }
    function declaration() {
      const line = peek().line, type = readType(), name = identifier();
      let init = null;
      if (accept('=')) {
        if (accept('{')) { const values = []; if (!at('}')) do { values.push(expression()); } while (accept(',')); expect('}'); init = {kind:'arrayLiteral', values, line}; }
        else init = expression();
      }
      return {kind:'declare', type, name, init, line};
    }
    const isDeclaration = () => /^[A-Za-z_$][\w$]*$/.test(peek().text) && (/^[A-Za-z_$][\w$]*$/.test(peek(1).text) || (peek(1).text === '[' && (peek(2).text === ']' || peek(2).text === '[')));
    function statement() {
      const line = peek().line;
      if (accept('{')) {
        const body = []; while (!at('}') && !at('<eof>')) body.push(statement()); expect('}');
        return {kind:'block', body, line};
      }
      if (accept(';')) return {kind:'empty', line};
      if (accept('for')) {
        expect('('); let init = null;
        if (!at(';')) init = isDeclaration() ? declaration() : {kind:'expr', expr:expression(), line:peek().line};
        if (accept(':')) { const source = expression(); expect(')'); return {kind:'foreach', init, source, body:statement(), line}; }
        expect(';'); const condition = at(';') ? null : expression(); expect(';');
        const update = at(')') ? null : expression(); expect(')');
        return {kind:'for', init, condition, update, body:statement(), line};
      }
      if (accept('while')) { expect('('); const condition = expression(); expect(')'); return {kind:'while', condition, body:statement(), line}; }
      if (accept('do')) { const body = statement(); expect('while'); expect('('); const condition = expression(); expect(')'); expect(';'); return {kind:'do', condition, body, line}; }
      if (accept('if')) {
        expect('('); const condition = expression(); expect(')'); const body = statement();
        return {kind:'if', condition, body, otherwise:accept('else') ? statement() : null, line};
      }
      if (accept('return')) { const expr = at(';') ? null : expression(); expect(';'); return {kind:'return', expr, line}; }
      if (at('break') || at('continue')) { const kind = take().text; expect(';'); return {kind, line}; }
      const node = isDeclaration() ? declaration() : {kind:'expr', expr:expression(), line}; expect(';'); return node;
    }
    const classes = Object.create(null);
    while (!at('<eof>')) {
      readModifiers(); const line = expect('class').line, name = identifier();
      if (classes[name]) fail(line, `Duplicate class ${name}.`);
      const def = {name, line, parent:accept('extends') ? identifier() : null, fields:[], methods:[]}; classes[name] = def;
      expect('{');
      while (!at('}') && !at('<eof>')) {
        const flags = readModifiers(), memberLine = peek().line;
        const ctor = at(name) && peek(1).text === '(';
        const type = ctor ? 'void' : readType(), memberName = identifier();
        if (at('(')) {
          take(); const params = [];
          if (!at(')')) do { const type = readType(); params.push({type, name:identifier()}); } while (accept(','));
          expect(')');
          if (new Set(params.map(p => p.name)).size !== params.length) fail(memberLine, 'Duplicate parameter name.');
          const body = statement(); if (body.kind !== 'block') fail(memberLine, 'Methods need a body in braces.');
          const method = {name:memberName, owner:name, type, params, body, ctor, flags, line:memberLine};
          if (def.methods.some(m => m.ctor === ctor && signature(m) === signature(method))) fail(memberLine, `Duplicate signature ${signature(method)}.`);
          def.methods.push(method);
        } else {
          if (flags.has('static')) fail(memberLine, 'Static fields are not supported in this learning subset.');
          if (def.fields.some(f => f.name === memberName)) fail(memberLine, `Duplicate field ${memberName}.`);
          const init = accept('=') ? expression() : null; expect(';');
          def.fields.push({type, name:memberName, init, line:memberLine});
        }
      }
      expect('}');
    }
    for (const def of Object.values(classes)) {
      const seen = new Set([def.name]); let parent = def.parent;
      while (parent) {
        if (!classes[parent]) fail(def.line, `Parent class ${parent} was not found.`);
        if (seen.has(parent)) fail(def.line, 'Inheritance cycle detected.');
        seen.add(parent); parent = classes[parent].parent;
      }
      const validBase = type => ['void', 'String', 'boolean', ...numeric].includes(type) || !!classes[type];
      const validType = type => validBase(type) || (type.endsWith('[]') && validBase(type.slice(0, -2)));
      for (const member of [...def.fields, ...def.methods]) {
        if (!validType(member.type)) fail(member.line, `Unknown type ${member.type}.`);
        for (const param of member.params || []) if (!validType(param.type)) fail(member.line, `Unknown parameter type ${param.type}.`);
      }
      for (const field of def.fields) for (let p = classes[def.parent]; p; p = classes[p.parent]) {
        if (p.fields.some(f => f.name === field.name)) fail(field.line, 'Field hiding is not supported; use a different field name.');
      }
      for (const method of def.methods.filter(m => !m.ctor)) {
        let inherited;
        for (let p = classes[def.parent]; p && !inherited; p = classes[p.parent]) inherited = p.methods.find(m => !m.ctor && signature(m) === signature(method));
        if (method.flags.has('@Override') && !inherited) fail(method.line, `@Override ${signature(method)} has no matching parent method.`);
        if (inherited && (inherited.flags.has('final') || inherited.flags.has('static') !== method.flags.has('static'))) fail(method.line, `Invalid override of ${signature(inherited)}.`);
        if (inherited && inherited.type !== method.type) {
          let p = classes[method.type]; while (p && p.name !== inherited.type) p = classes[p.parent];
          if (!p) fail(method.line, `Incompatible return type for ${signature(method)}.`);
        }
      }
    }
    const main = classes.Main?.methods.find(m => m.name === 'main' && m.flags.has('static') && m.type === 'void' && m.params.length === 1 && m.params[0].type === 'String[]');
    if (!main) fail(1, 'Add class Main with public static void main(String[] args).');
    return {classes, main};
  }

  function simulate(source) {
    const {classes, main} = compile(source), events = [], objects = {}, arrays = {}, stack = [], consoleLines = [];
    let nextId = 1, ticks = 0;
    const value = (type, data) => ({type, data});
    const primitive = type => numeric.includes(type) || type === 'boolean';
    const isArray = type => type.endsWith('[]');
    const component = type => type.slice(0, -2);
    const defaultValue = type => value(type, numeric.includes(type) ? 0 : type === 'boolean' ? false : null);
    const expose = v => v.data?.ref ? {ref:v.data.ref, type:v.type} : v.type === 'char' ? String.fromCharCode(v.data) : v.data;
    const current = () => stack[stack.length - 1];
    const guard = line => { if (++ticks > 10000 || events.length >= 2000) fail(line, 'Execution limit reached (2,000 steps / 10,000 operations). Check for an infinite loop or use fewer iterations.'); };
    function snapshot(kind, line, title, text, changed = null, changedIndex = null) {
      guard(line);
      events.push({kind, line, title, text, changed, changedIndex, stack:stack.map(f => ({name:f.name, vars:Object.fromEntries(f.scopes.flatMap(scope => [...scope].map(([name, v]) => [name, expose(v)])))})), objects:structuredClone(Object.fromEntries(Object.entries(objects).map(([id, obj]) => [id, {id:obj.id, className:obj.className, fields:Object.fromEntries(Object.entries(obj.fields).map(([name, v]) => [name, expose(v)]))}]))), arrays:structuredClone(Object.fromEntries(Object.entries(arrays).map(([id, a]) => [id, {id:a.id, type:a.type, length:a.values.length, values:a.values.map(expose)}]))), console:[...consoleLines]});
    }
    function assignable(from, to) {
      if (from === to) return true;
      if (from === 'null') return !primitive(to) && to !== 'void';
      if (isArray(from) || isArray(to)) {
        if (!isArray(from) || !isArray(to)) return false;
        const fromComponent = component(from), toComponent = component(to);
        if (primitive(fromComponent) || primitive(toComponent)) return from === to;
        return fromComponent === toComponent || assignable(fromComponent, toComponent);
      }
      if (numeric.includes(from) && numeric.includes(to)) return to !== 'char' && numeric.indexOf(from) <= numeric.indexOf(to);
      for (let def = classes[from]; def; def = classes[def.parent]) if (def.name === to) return true;
      return false;
    }
    function convert(v, type, line) {
      if (!assignable(v.type, type)) fail(line, `Cannot assign ${v.type} to ${type}.`);
      return value(type, v.data);
    }
    const chain = type => { const result = []; for (let def = classes[type]; def; def = classes[def.parent]) result.unshift(def); return result; };
    function methods(type, name) {
      const found = new Map();
      for (const def of chain(type)) for (const m of def.methods) if (!m.ctor && m.name === name) found.set(signature(m), m);
      return [...found.values()];
    }
    function select(candidates, args, line, label) {
      const matches = candidates.filter(m => m.params.length === args.length && args.every((a, i) => assignable(a.type, m.params[i].type)));
      const best = matches.filter(m => !matches.some(other => other !== m && other.params.every((p, i) => assignable(p.type, m.params[i].type)) && other.params.some((p, i) => p.type !== m.params[i].type)));
      if (best.length !== 1) fail(line, best.length ? `Ambiguous overload: ${label}.` : `No matching overload for ${label}(${args.map(a => a.type).join(', ')}).`);
      return best[0];
    }
    function slot(node) {
      const f = current();
      if (node.kind === 'name') {
        for (let i = f.scopes.length - 1; i >= 0; i--) if (f.scopes[i].has(node.name)) return {get:() => f.scopes[i].get(node.name), set:v => f.scopes[i].set(node.name, v), name:node.name};
        if (f.self && chain(f.owner).some(def => def.fields.some(field => field.name === node.name))) return {get:() => objects[f.self].fields[node.name], set:v => { objects[f.self].fields[node.name] = v; }, name:node.name, id:f.self};
      }
      if (node.kind === 'member') {
        const ref = evaluate(node.object);
        if (isArray(ref.type) && node.name === 'length') fail(node.line, 'Array length is read-only.');
        if (!ref.data?.ref) fail(node.line, `Cannot access ${node.name} on a null or non-object value.`);
        const obj = objects[ref.data.ref];
        if (!chain(ref.type).some(def => def.fields.some(field => field.name === node.name))) fail(node.line, `Field ${node.name} was not found on ${ref.type}.`);
        return {get:() => obj.fields[node.name], set:v => { obj.fields[node.name] = v; }, name:node.name, id:obj.id};
      }
      if (node.kind === 'index') {
        const ref = evaluate(node.object), index = evaluate(node.index);
        if (!isArray(ref.type) || !ref.data?.ref) fail(node.line, 'Cannot index a null or non-array value.');
        if (index.type !== 'int' || !Number.isInteger(index.data)) fail(node.line, 'Array index must be an integer.');
        const array = arrays[ref.data.ref]; if (index.data < 0 || index.data >= array.values.length) fail(node.line, `Array index ${index.data} is out of bounds.`);
        return {get:() => array.values[index.data], set:v => { array.values[index.data] = v; }, name:`${ref.data.ref}[${index.data}]`, id:ref.data.ref, index:index.data};
      }
      fail(node.line, `Unknown variable or assignment target ${node.name || node.kind}.`);
    }
    function write(target, v, line) {
      const converted = convert(v, target.get().type, line); target.set(converted);
      snapshot(target.id ? 'mutate' : 'assign', line, target.id ? 'Heap state changed' : 'Local variable updated', `${target.name} is now ${display(converted)}.`, target.id || null, target.index ?? null);
      return converted;
    }
    const display = v => v.data?.ref ? `${isArray(v.type) ? v.type : objects[v.data.ref].className} #${v.data.ref}` : String(expose(v));
    const bool = (v, line) => { if (v.type !== 'boolean') fail(line, 'A condition must be boolean.'); return v.data; };
    function binary(op, a, b, line) {
      if (op === '+' && (a.type === 'String' || b.type === 'String')) return value('String', display(a) + display(b));
      if (['==', '!='].includes(op)) {
        const same = a.data?.ref || b.data?.ref ? a.data?.ref === b.data?.ref : a.data === b.data;
        return value('boolean', op === '==' ? same : !same);
      }
      if (!numeric.includes(a.type) || !numeric.includes(b.type)) fail(line, `${op} needs numeric operands.`);
      const type = a.type === 'double' || b.type === 'double' ? 'double' : a.type === 'long' || b.type === 'long' ? 'long' : 'int';
      if (['<', '>', '<=', '>='].includes(op)) return value('boolean', op === '<' ? a.data < b.data : op === '>' ? a.data > b.data : op === '<=' ? a.data <= b.data : a.data >= b.data);
      if (['/', '%'].includes(op) && b.data === 0 && type !== 'double') fail(line, 'Integer division by zero.');
      const result = op === '+' ? a.data + b.data : op === '-' ? a.data - b.data : op === '*' ? a.data * b.data : op === '%' ? a.data % b.data : type === 'double' ? a.data / b.data : Math.trunc(a.data / b.data);
      return value(type, result);
    }
    function evaluate(node) {
      guard(node.line);
      switch (node.kind) {
        case 'literal': {
          const raw = node.raw;
          if (raw === 'null') return value('null', null);
          if (['true', 'false'].includes(raw)) return value('boolean', raw === 'true');
          if (raw[0] === '"' || raw[0] === "'") {
            const text = raw.slice(1, -1).replace(/\\([nrtb'"\\])/g, (_, c) => ({n:'\n', r:'\r', t:'\t', b:'\b'}[c] || c));
            return value(raw[0] === '"' ? 'String' : 'char', raw[0] === '"' ? text : text.charCodeAt(0));
          }
          return value(/[dD.]|\d\.\d/.test(raw) ? 'double' : /[lL]/.test(raw) ? 'long' : 'int', Number(raw.replace(/[LlDd]$/, '')));
        }
        case 'name':
          if (node.name === 'super') {
            const f = current(); if (!f.self || !classes[f.owner].parent) fail(node.line, 'super requires a parent class and an instance.');
            return value(classes[f.owner].parent, {ref:f.self});
          }
          return slot(node).get();
        case 'member': {
          const ref = evaluate(node.object);
          if (isArray(ref.type) && node.name === 'length') return value('int', arrays[ref.data.ref]?.values.length ?? fail(node.line, 'Cannot access length on null.'));
          return slot(node).get();
        }
        case 'index': return slot(node).get();
        case 'new': {
          if (!classes[node.type]) fail(node.line, `Class ${node.type} was not found.`);
          const args = node.args.map(evaluate), id = nextId++, fields = {};
          for (const def of chain(node.type)) for (const field of def.fields) fields[field.name] = defaultValue(field.type);
          objects[id] = {id, className:node.type, fields};
          snapshot('create', node.line, 'Object created', `A new ${node.type} object gets identity #${id}, including inherited fields.`, id);
          construct(node.type, id, args, node.line); return value(node.type, {ref:id});
        }
        case 'newArray': {
          const size = evaluate(node.size);
          if (size.type !== 'int' || !Number.isInteger(size.data) || size.data < 0) fail(node.line, 'Array size must be a non-negative integer.');
          if (size.data > 1000 || Object.values(arrays).reduce((n, a) => n + a.values.length, 0) + size.data > 10000) fail(node.line, 'Array allocation limit reached.');
          const type = `${node.type}[]`, id = nextId++, values = Array.from({length:size.data}, () => defaultValue(node.type));
          arrays[id] = {id, type, values}; snapshot('create', node.line, 'Array created', `A new ${type} array gets identity #${id} and length ${size.data}.`, id); return value(type, {ref:id});
        }
        case 'arrayLiteral': {
          const declared = node.type ? `${node.type}[]` : null;
          const values = node.values.map(evaluate);
          const type = declared || (values.length ? `${values[0].type}[]` : 'int[]');
          const checked = values.map(v => convert(v, component(type), node.line));
          const id = nextId++; arrays[id] = {id, type, values:checked}; snapshot('create', node.line, 'Array created', `An array literal gets identity #${id} and length ${values.length}.`, id); return value(type, {ref:id});
        }
        case 'assign': {
          const target = slot(node.left), before = target.get(), right = evaluate(node.right);
          return write(target, node.op === '=' ? right : binary(node.op[0], before, right, node.line), node.line);
        }
        case 'unary': case 'postfix': {
          if (['++', '--'].includes(node.op)) {
            const target = slot(node.expr), before = target.get();
            const after = write(target, binary(node.op[0], before, value('int', 1), node.line), node.line);
            return node.kind === 'postfix' ? before : after;
          }
          const v = evaluate(node.expr);
          if (node.op === '!') return value('boolean', !bool(v, node.line));
          if (!numeric.includes(v.type)) fail(node.line, 'Unary arithmetic needs a number.');
          return value(v.type === 'char' ? 'int' : v.type, node.op === '-' ? -v.data : v.data);
        }
        case 'binary': {
          const a = evaluate(node.left);
          if (node.op === '&&') return value('boolean', bool(a, node.line) && bool(evaluate(node.right), node.line));
          if (node.op === '||') return value('boolean', bool(a, node.line) || bool(evaluate(node.right), node.line));
          return binary(node.op, a, evaluate(node.right), node.line);
        }
        case 'call': return call(node);
        default: fail(node.line, `Unsupported expression ${node.kind}.`);
      }
    }
    function call(node) {
      const t = node.target;
      if (t.kind === 'member' && t.name === 'println' && t.object.kind === 'member' && t.object.name === 'out' && t.object.object.kind === 'name' && t.object.object.name === 'System') {
        if (node.args.length > 1) fail(node.line, 'println accepts zero or one argument.');
        const text = node.args.length ? display(evaluate(node.args[0])) : '';
        consoleLines.push(text); snapshot('output', node.line, 'Value printed', `println sends “${text}” to the console.`); return value('void', undefined);
      }
      const f = current(); let ref, name, direct = false, staticOnly = false;
      if (t.kind === 'member') {
        const className = t.object.kind === 'name' ? t.object.name : null;
        const localName = f.scopes.some(scope => scope.has(className)) || (f.self && className in objects[f.self].fields);
        staticOnly = !!classes[className] && !localName;
        ref = staticOnly ? value(className, null) : evaluate(t.object);
        name = t.name; direct = t.object.kind === 'name' && t.object.name === 'super';
      }
      else if (t.kind === 'name' && !['super', 'this'].includes(t.name)) { ref = value(f.owner, f.self ? {ref:f.self} : null); name = t.name; }
      else fail(node.line, 'Constructor delegation must be the first constructor statement.');
      const candidates = methods(ref.type, name).filter(m => !staticOnly || m.flags.has('static'));
      if (!candidates.length && !ref.data?.ref) fail(node.line, `Cannot call ${name}: no matching method or object reference.`);
      const args = node.args.map(evaluate), selected = select(candidates, args, node.line, `${ref.type}.${name}`);
      if (selected.flags.has('static')) {
        snapshot('focus', node.line, 'Static method selected', `${ref.type} selects ${selected.owner}.${signature(selected)} using the declared argument types.`);
        return invoke(selected, null, args, node.line);
      }
      if (!ref.data?.ref) fail(node.line, `Cannot call ${name} on a null or non-object value.`);
      const runtimeType = objects[ref.data.ref].className;
      const dispatched = direct ? selected : methods(runtimeType, name).find(m => signature(m) === signature(selected));
      snapshot('focus', node.line, 'Method selected', `The declared type ${ref.type} selects ${signature(selected)}. ${direct ? 'super calls' : `Object #${ref.data.ref} dispatches to`} ${dispatched.owner}.${signature(dispatched)}.`, ref.data.ref);
      // A covariant override changes the object returned, not the caller's declared expression type.
      return convert(invoke(dispatched, ref.data.ref, args, node.line), selected.type, node.line);
    }
    function pushFrame(method, id, args) {
      if (stack.length >= 64) fail(method.line, 'Call stack limit reached. Check recursive calls.');
      const locals = new Map(); if (id) locals.set('this', value(method.owner, {ref:id}));
      method.params.forEach((p, i) => locals.set(p.name, convert(args[i], p.type, method.line)));
      stack.push({name:`${method.owner}.${signature(method)}`, owner:method.owner, self:id, scopes:[locals]});
    }
    function invoke(method, id, args, callLine) {
      pushFrame(method, id, args);
      snapshot('call', method.line, 'Method frame pushed', `${method.owner}.${signature(method)} receives its own parameters and local variables.`, id);
      const result = execute(method.body);
      if (result && result.kind !== 'return') fail(result.line, `${result.kind} must be inside a loop.`);
      if (method.type !== 'void' && !result) fail(method.line, `${signature(method)} must return a value.`);
      const returned = convert(result?.value || value('void', undefined), method.type, result?.line || method.line);
      stack.pop(); snapshot('return', callLine, 'Method returned', `${method.owner}.${signature(method)} returns${method.type === 'void' ? '' : ` ${display(returned)}`}.`, id); return returned;
    }
    function construct(type, id, args, line, active = new Set()) {
      const def = classes[type], ctors = def.methods.filter(m => m.ctor);
      const ctor = ctors.length ? select(ctors, args, line, type) : {name:type, owner:type, type:'void', params:[], line:def.line, body:{kind:'block', body:[], line:def.line}};
      if (!ctors.length && args.length) fail(line, `${type} only has a default no-argument constructor.`);
      const key = `${type}.${signature(ctor)}`;
      if (active.has(key)) fail(line, 'Recursive constructor delegation.'); active.add(key);
      pushFrame(ctor, id, args); snapshot('call', ctor.line, 'Constructor called', `${signature(ctor)} initializes object #${id}.`, id);
      const first = ctor.body.body[0];
      const delegation = first?.kind === 'expr' && first.expr.kind === 'call' && first.expr.target.kind === 'name' && ['super', 'this'].includes(first.expr.target.name) ? first.expr : null;
      if (delegation?.target.name === 'this') construct(type, id, delegation.args.map(evaluate), delegation.line, active);
      else {
        if (def.parent) construct(def.parent, id, delegation ? delegation.args.map(evaluate) : [], delegation?.line || ctor.line, active);
        else if (delegation && delegation.args.length) fail(delegation.line, 'No parent constructor accepts these arguments.');
        for (const field of def.fields) if (field.init) {
          objects[id].fields[field.name] = convert(evaluate(field.init), field.type, field.line);
          snapshot('mutate', field.line, 'Field initialized', `${type}.${field.name} receives its initial value.`, id);
        }
      }
      const result = execute({...ctor.body, body:ctor.body.body.slice(delegation ? 1 : 0)});
      if (result && (result.kind !== 'return' || result.value.type !== 'void')) fail(result.line, 'Invalid constructor return or loop control.');
      stack.pop(); active.delete(key); snapshot('return', line, 'Constructor finished', `${signature(ctor)} finished initializing object #${id}.`, id);
    }
    function execute(node, loopDepth = 0) {
      guard(node.line); const f = current();
      switch (node.kind) {
        case 'empty': return;
        case 'block': {
          f.scopes.push(new Map());
          try { for (const child of node.body) { const result = execute(child, loopDepth); if (result) return result; } }
          finally { f.scopes.pop(); }
          return;
        }
        case 'declare': {
          if (f.scopes.some(scope => scope.has(node.name))) fail(node.line, `Local ${node.name} is already declared.`);
          if (!primitive(node.type) && node.type !== 'String' && !classes[node.type] && !isArray(node.type)) fail(node.line, `Unsupported local type ${node.type}.`);
          if (node.init?.kind === 'arrayLiteral' && !node.init.type) node.init.type = component(node.type);
          const v = node.init ? convert(evaluate(node.init), node.type, node.line) : defaultValue(node.type);
          f.scopes[f.scopes.length - 1].set(node.name, v);
          snapshot(v.data?.ref ? 'reference' : 'assign', node.line, 'Local variable declared', `${node.name} (${node.type}) stores ${display(v)}.`, v.data?.ref || null); return;
        }
        case 'expr': evaluate(node.expr); return;
        case 'return': return {kind:'return', value:node.expr ? evaluate(node.expr) : value('void', undefined), line:node.line};
        case 'break': case 'continue':
          if (!loopDepth) fail(node.line, `${node.kind} must be inside a loop.`);
          snapshot('loop', node.line, node.kind === 'break' ? 'Loop exited' : 'Next iteration', `${node.kind} changes the flow of the nearest loop.`);
          return {kind:node.kind, line:node.line};
        case 'if': {
          const condition = bool(evaluate(node.condition), node.line);
          snapshot('condition', node.line, 'Condition checked', `The condition is ${condition}.`);
          return condition ? execute(node.body, loopDepth) : node.otherwise ? execute(node.otherwise, loopDepth) : undefined;
        }
        case 'foreach': {
          const source = evaluate(node.source);
          if (!isArray(source.type)) fail(node.line, 'Enhanced for-each requires an array source.');
          if (!source.data?.ref) fail(node.line, 'Cannot iterate over a null array.');
          if (node.init.kind !== 'declare') fail(node.line, 'Enhanced for-each needs a declared loop variable.');
          const frameScope = new Map(); f.scopes.push(frameScope);
          try {
            const declaration = node.init;
            if (!assignable(component(source.type), declaration.type)) fail(node.line, `Cannot bind ${source.type} elements to ${declaration.type}.`);
            frameScope.set(declaration.name, defaultValue(declaration.type));
            const array = arrays[source.data.ref];
            for (let index = 0; index < array.values.length; index++) {
              frameScope.set(declaration.name, convert(array.values[index], declaration.type, node.line));
              snapshot('iteration', node.line, 'For-each element bound', `Element ${index} of ${source.type} #${source.data.ref} is copied into ${declaration.name}.`, source.data.ref, index);
              const result = execute(node.body, loopDepth + 1);
              if (result?.kind === 'return') return result;
              if (result?.kind === 'break') break;
              if (result?.kind === 'continue') continue;
            }
            snapshot('loop', node.line, 'For-each loop completed', `Finished visiting ${array.values.length} element${array.values.length === 1 ? '' : 's'}.`, source.data.ref);
          } finally { f.scopes.pop(); }
          return;
        }
        case 'for': case 'while': case 'do': {
          f.scopes.push(new Map());
          try {
            if (node.init) execute(node.init, loopDepth);
            let iteration = 0;
            while (true) {
              guard(node.line);
              if (node.kind !== 'do' || iteration > 0) {
                const condition = node.condition ? bool(evaluate(node.condition), node.line) : true;
                snapshot('loop', node.condition?.line || node.line, 'Loop condition checked', `${node.kind} condition is ${condition}; ${condition ? 'enter the next iteration' : 'exit the loop'}.`);
                if (!condition) break;
              }
              snapshot('loop', node.line, 'Loop iteration', `Starting ${node.kind} iteration ${++iteration}.`);
              const result = execute(node.body, loopDepth + 1);
              if (result?.kind === 'return') return result;
              if (result?.kind === 'break') break;
              if (node.update) evaluate(node.update);
            }
          } finally { f.scopes.pop(); }
          return;
        }
        default: fail(node.line, `Unsupported statement ${node.kind}.`);
      }
    }
    const argsId = 'args'; arrays[argsId] = {id:argsId, type:'String[]', values:[]};
    pushFrame(main, null, [value('String[]', {ref:argsId})]);
    snapshot('start', main.line, 'Program started', 'Java creates the main stack frame.');
    const result = execute(main.body);
    if (result && (result.kind !== 'return' || result.value.type !== 'void')) fail(result.line, 'main must return without a value.');
    snapshot('done', main.line, 'Program finished', 'The main method has reached its end. All steps are complete.');
    return events;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {compile, simulate};
  else root.ObjectLabInterpreter = {compile, simulate};
})(typeof globalThis !== 'undefined' ? globalThis : this);
