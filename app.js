const examples = {
  bank: `class BankAccount {
    String owner;
    int balance;

    BankAccount(String name, int amount) {
        owner = name;
        balance = amount;
    }

    void deposit(int amount) {
        balance = balance + amount;
    }
}

class Main {
    public static void main(String[] args) {
        BankAccount account = new BankAccount("Maya", 100);
        account.deposit(50);
        System.out.println(account.balance);
    }
}`,
  reference: `class Pet {
    String name;

    Pet(String petName) {
        name = petName;
    }

    void rename(String newName) {
        name = newName;
    }
}

class Main {
    public static void main(String[] args) {
        Pet first = new Pet("Mochi");
        Pet second = first;
        second.rename("Pixel");
        System.out.println(first.name);
    }
}`,
  counter: `class Counter {
    int count;

    Counter(int start) {
        count = start;
    }

    void increment() {
        count = count + 1;
    }
}

class Main {
    public static void main(String[] args) {
        Counter left = new Counter(0);
        Counter right = new Counter(10);
        left.increment();
        left.increment();
        right.increment();
        System.out.println(left.count);
    }
}`,
  graph: `class Person {
    String name;
    Person bestFriend;

    Person(String personName) {
        name = personName;
        bestFriend = null;
    }

    void befriend(Person other) {
        bestFriend = other;
    }
}

class Main {
    public static void main(String[] args) {
        Person maya = new Person("Maya");
        Person leo = new Person("Leo");
        maya.befriend(leo);
        System.out.println(maya.bestFriend.name);
    }
}`
};

const $ = id => document.getElementById(id);
const editor = $('codeEditor'), highlight = $('codeHighlight'), numbers = $('lineNumbers');
let events = [], step = 0, timer = null, savedCode = examples.bank;
function setTheme(theme){document.documentElement.dataset.theme=theme;const dark=theme==='dark';$('themeBtn').textContent=dark?'☀':'☾';$('themeBtn').setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');$('themeBtn').title=dark?'Switch to light mode':'Switch to dark mode';localStorage.setItem('objectlab-theme',theme)}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
function colorize(line) {
  const tokenRe = /(\/\/.*$)|("(?:\\.|[^"\\])*")|\b(class|public|static|void|new|return|this|private|protected|extends|int|boolean|double|long|char|String)\b|\b([A-Z][A-Za-z0-9_]*)\b|\b(\d+(?:\.\d+)?)\b|\.([a-zA-Z_]\w*)(?=\()/g;
  let html = '', cursor = 0, match;
  while ((match = tokenRe.exec(line))) {
    html += escapeHtml(line.slice(cursor, match.index));
    const css = match[1] ? 'tok-comment' : match[2] ? 'tok-string' : match[3] ? 'tok-key' : match[4] ? 'tok-type' : match[5] ? 'tok-num' : 'tok-call';
    html += `<span class="${css}">${escapeHtml(match[0])}</span>`;
    cursor = match.index + match[0].length;
    if (match[1]) break;
  }
  return html + escapeHtml(line.slice(cursor)) || ' ';
}
function renderEditor(activeLine = -1) {
  const lines = editor.value.split('\n');
  numbers.innerHTML = lines.map((_, i) => `<div class="${i + 1 === activeLine ? 'active' : ''}">${i + 1}</div>`).join('');
  highlight.innerHTML = lines.map((l, i) => `<span class="line ${i + 1 === activeLine ? 'active' : ''}">${colorize(l)}</span>`).join('');
}
function syncScroll() { highlight.scrollTop = editor.scrollTop; highlight.scrollLeft = editor.scrollLeft; numbers.scrollTop = editor.scrollTop; }

function val(raw, env = {}, fields = {}) {
  raw = raw.trim();
  if (raw === 'null') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^".*"$/.test(raw)) return raw.slice(1, -1);
  if (/^-?\d+$/.test(raw)) return Number(raw);
  const add = raw.match(/^(.+?)\s*\+\s*(.+)$/);
  if (add) return val(add[1], env, fields) + val(add[2], env, fields);
  return raw in env ? env[raw] : raw in fields ? fields[raw] : raw;
}
function splitArgs(s) { return s ? (s.match(/(?:[^,"']|"[^"]*")+/g) || []).map(x => x.trim()) : []; }

function compile(source) {
  const lines = source.split('\n');
  const classes = {}, classRe = /^\s*class\s+(\w+)/, fieldRe = /^\s*([A-Z]\w*|int|boolean|double|long|char)\s+(\w+)\s*;/;
  let cls = null, method = null, depth = 0;
  lines.forEach((text, idx) => {
    const c = text.match(classRe);
    if (c) { cls = { name:c[1], fields:[], methods:{} }; classes[c[1]] = cls; depth = 0; }
    if (!cls) return;
    const before = depth; depth += (text.match(/{/g)||[]).length - (text.match(/}/g)||[]).length;
    const f = text.match(fieldRe); if (f && !method && depth === 1) cls.fields.push({type:f[1], name:f[2]});
    const m = text.match(/^\s*(?:public\s+static\s+)?(?:void|int|String|boolean|\w+)\s+(\w+)\s*\(([^)]*)\)\s*\{/);
    const ctor = text.match(new RegExp('^\\s*' + cls.name + '\\s*\\(([^)]*)\\)\\s*\\{'));
    if ((m || ctor) && before === 1) {
      const name = ctor ? cls.name : m[1], rawParams = ctor ? ctor[1] : m[2];
      method = {name, params: splitArgs(rawParams).map(p => p.split(/\s+/).pop()), body:[], line:idx+1, startDepth:depth}; cls.methods[name] = method; return;
    }
    if (method) {
      if (depth < method.startDepth) method = null;
      else if (text.trim() && text.trim() !== '}') method.body.push({text:text.trim(), line:idx+1});
    }
  });
  if (!classes.Main?.methods.main) throw new Error('Add a class Main with a main method so execution has a starting point.');
  return {classes, lines};
}

function simulate(source) {
  const {classes} = compile(source), out = [], objects = {}, stack = [], consoleLines = []; let nextId = 1;
  const snapshot = (kind, line, title, text, changed = null) => out.push({kind,line,title,text,changed,stack:structuredClone(stack),objects:structuredClone(objects),console:[...consoleLines]});
  const frame = (name, vars={}) => ({name, vars});
  function runBody(body, currentClass, selfId, env, frameName) {
    for (const ins of body) {
      const t = ins.text.replace(/;$/, '');
      let m;
      if ((m=t.match(/^(\w+)\s+(\w+)\s*=\s*new\s+(\w+)\((.*)\)$/))) {
        const [,type,name,className,argsRaw]=m, def=classes[className]; if(!def) throw new Error(`Line ${ins.line}: class ${className} was not found.`);
        snapshot('focus',ins.line,'Evaluating object creation',`Java evaluates “new ${className}(…)” and asks the heap for space.`);
        const id=nextId++, fields={}; def.fields.forEach(f=>fields[f.name]=['int','double','long'].includes(f.type)?0:f.type==='boolean'?false:f.type==='char'?'\\0':null); objects[id]={id,className,fields};
        env[name]={ref:id,type}; stack[stack.length-1].vars[name]=env[name]; snapshot('create',ins.line,'Object created',`A new ${className} object gets its own identity: #${id}.`,id);
        const ctor=def.methods[className], args=splitArgs(argsRaw).map(a=>val(a,env,{})); if(ctor){const locals={this:{ref:id,type:className}};ctor.params.forEach((p,i)=>locals[p]=args[i]);stack.push(frame(`${className}(…)`,locals));snapshot('call',ctor.line,'Constructor called',`A constructor frame is pushed onto the call stack.`);runBody(ctor.body,className,id,locals,`${className}(…)`);stack.pop();snapshot('return',ins.line,'Constructor finished',`Control returns to main. ${name} now stores a reference to object #${id}.`);}
      } else if ((m=t.match(/^(\w+)\s+(\w+)\s*=\s*(\w+)$/)) && env[m[3]]?.ref) {
        env[m[2]]={...env[m[3]],type:m[1]};stack[stack.length-1].vars[m[2]]=env[m[2]];snapshot('reference',ins.line,'Reference copied',`${m[2]} and ${m[3]} now point to the same object #${env[m[3]].ref}.`,env[m[3]].ref);
      } else if ((m=t.match(/^(\w+)\.(\w+)\((.*)\)$/))) {
        const [,varName,methodName,argsRaw]=m, ref=env[varName];if(!ref?.ref)throw new Error(`Line ${ins.line}: ${varName} is not an object reference.`);const obj=objects[ref.ref],methodDef=classes[obj.className]?.methods[methodName];if(!methodDef)throw new Error(`Line ${ins.line}: ${obj.className}.${methodName} was not found.`);
        const args=splitArgs(argsRaw).map(a=>val(a,env,obj.fields)),locals={this:{ref:obj.id,type:obj.className}};methodDef.params.forEach((p,i)=>locals[p]=args[i]);snapshot('focus',ins.line,'Calling a method',`${varName}.${methodName}(…) sends a message to object #${obj.id}.`,obj.id);stack.push(frame(`${obj.className}.${methodName}(…)`,locals));snapshot('call',methodDef.line,'Method frame pushed',`Parameters and this live in a fresh stack frame.`);runBody(methodDef.body,obj.className,obj.id,locals,`${obj.className}.${methodName}(…)`);stack.pop();snapshot('return',ins.line,'Method returned',`The method frame is removed. The object remains on the heap.`,obj.id);
      } else if ((m=t.match(/^System\.out\.println\((.+)\)$/))) {
        let expr=m[1],value;const chain=expr.split('.');if(chain.length>1&&env[chain[0]]?.ref){value=env[chain.shift()];for(const field of chain){if(value?.ref)value=objects[value.ref]?.fields[field];else{value=undefined;break}}}else value=val(expr,env,selfId?objects[selfId].fields:{});consoleLines.push(String(value));snapshot('output',ins.line,'Value printed',`println follows the references and sends “${value}” to the console.`);
      } else if ((m=t.match(/^(?:this\.)?(\w+)\s*=\s*(.+)$/))) {
        if(!selfId) throw new Error(`Line ${ins.line}: field assignment needs an object.`);const obj=objects[selfId],name=m[1],value=val(m[2],env,obj.fields);if(!(name in obj.fields))throw new Error(`Line ${ins.line}: field ${name} was not declared.`);obj.fields[name]=value;snapshot('mutate',ins.line,'Object state changed',`The ${name} field of object #${selfId} is now ${JSON.stringify(value)}.`,selfId);
      }
    }
  }
  const main=classes.Main.methods.main;stack.push(frame('Main.main(…)',{}));snapshot('start',main.line,'Program started','Java creates the main stack frame. Local variables will appear inside it.');runBody(main.body,'Main',null,stack[0].vars,'Main.main(…)');snapshot('done',main.line,'Program finished','The main method has reached its end. All steps are complete.');return out;
}

function formatValue(v, sourceId='') { if(v && typeof v==='object' && v.ref) return `<span class="ref-value" id="${sourceId}" data-ref="${v.ref}" title="Reference to object #${v.ref}"><span class="ref-dot"></span>${escapeHtml(v.type)} #${v.ref}</span>`; return escapeHtml(v===null?'null':typeof v==='string'?`"${v}"`:v); }
const palette=['#68c7ab','#5c77d8','#e7994a','#9a72ce','#e06d84'];
function renderState() {
  if (!events.length) return;
  const e=events[step]; renderEditor(e.line); $('stepCount').textContent=`Step ${step+1} of ${events.length}`;$('timelineTitle').textContent=e.title;$('timelinePosition').textContent=`${step+1} / ${events.length}`;
  $('timeline').value=step;$('timeline').style.setProperty('--progress',events.length>1?`${step/(events.length-1)*100}%`:'0%');
  $('explanationNumber').textContent=step+1;$('explanationLabel').textContent=e.kind.toUpperCase();$('explanationText').textContent=e.text;
  $('stackArea').innerHTML=e.stack.slice().reverse().map((f,i)=>`<div class="stack-frame ${i===0?'active':''}"><div class="frame-title">${escapeHtml(f.name)}<span class="frame-badge">${i===0?'ACTIVE':'CALLER'}<small>ENV ${e.stack.length-i}</small></span></div>${Object.entries(f.vars).length?Object.entries(f.vars).map(([k,v],j)=>`<div class="var-row"><span class="var-name">${escapeHtml(k)}</span><span class="var-value">${formatValue(v,`ref-stack-${i}-${j}`)}</span></div>`).join(''):'<div class="var-row"><span class="var-name">No local variables yet</span></div>'}</div>`).join('');
  const objs=Object.values(e.objects);$('heapArea').innerHTML=(objs.length?objs.map((o,i)=>`<div class="object-card ${e.changed===o.id?'changed':''}" id="object-${o.id}" style="--object-color:${palette[(o.id-1)%palette.length]}"><div class="object-header"><span>${escapeHtml(o.className)}</span><span class="object-id">OBJECT #${o.id}</span></div><div class="object-body">${Object.entries(o.fields).map(([k,v],j)=>`<div class="field-row"><span class="field-name">${escapeHtml(k)}</span><span class="field-value">${formatValue(v,`ref-field-${o.id}-${j}`)}</span></div>`).join('')}</div></div>`).join(''):'<div class="empty-state compact"><div class="empty-symbol">○</div><p>No objects exist yet.</p></div>');
  $('consoleOutput').innerHTML=e.console.length?e.console.map(x=>`<div class="console-line">${escapeHtml(x)}</div>`).join(''):'<span class="console-muted">Output will appear here…</span>';
  $('storyList').innerHTML=events.map((x,i)=>`<div class="story-item ${i<=step?'reached':''} ${i===step?'active':''}"><span class="story-index">${i+1}</span><div class="story-copy"><strong>${escapeHtml(x.title)}</strong>${escapeHtml(x.text)}</div></div>`).join('');
  scrollEditorToLine(e.line);
  $('prevBtn').disabled=step===0;$('nextBtn').disabled=step===events.length-1;requestAnimationFrame(drawReferenceArrows);
}
function scrollEditorToLine(line){
  if(!line)return;
  const lineHeight=22,padding=16,target=(line-1)*lineHeight+padding;
  const visibleTop=editor.scrollTop,visibleBottom=visibleTop+editor.clientHeight;
  if(target<visibleTop+lineHeight||target>visibleBottom-lineHeight*2){
    editor.scrollTop=Math.max(0,target-editor.clientHeight/2+lineHeight/2);
    syncScroll();
  }
}
function drawReferenceArrows(){
  const svg=$('memoryArrows'),root=$('memoryView');if(!svg||root.hidden)return;const base=root.getBoundingClientRect();
  const refs=[...root.querySelectorAll('.ref-value[data-ref]')];
  let defs=`<defs>${palette.map((c,i)=>`<marker id="arrow-${i}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${c}"/></marker>`).join('')}</defs>`;
  const paths=refs.map(ref=>{const target=$(`object-${ref.dataset.ref}`);if(!target)return'';const a=ref.getBoundingClientRect(),b=target.getBoundingClientRect();const x1=a.right-base.left,y1=a.top+a.height/2-base.top,x2=b.left-base.left,y2=b.top+Math.min(27,b.height/2)-base.top;const bend=Math.max(28,Math.abs(x2-x1)*.45),d=`M ${x1} ${y1} C ${x1+bend} ${y1}, ${x2-bend} ${y2}, ${x2-5} ${y2}`;const color=palette[(Number(ref.dataset.ref)-1)%palette.length];return `<path class="memory-arrow-halo" d="${d}"/><path class="memory-arrow" d="${d}" stroke="${color}" marker-end="url(#arrow-${(Number(ref.dataset.ref)-1)%palette.length})"/>`}).join('');
  svg.setAttribute('viewBox',`0 0 ${base.width} ${base.height}`);svg.innerHTML=defs+paths;
}
function run() { stop();try{events=simulate(editor.value);step=0;savedCode=editor.value;$('dirtyDot').classList.remove('visible');$('timeline').max=Math.max(0,events.length-1);$('eventDots').innerHTML=events.map(()=>'<i class="event-dot"></i>').join('');renderState();showToast(`${events.length} learning steps created.`);}catch(err){showToast(err.message,true);} }
function next(){if(!events.length)return run();if(step<events.length-1){step++;renderState()}else stop()}
function prev(){stop();if(step>0){step--;renderState()}}
function play(){if(!events.length)run();if(!events.length)return;if(timer){stop();return}if(step===events.length-1)step=0;$('playBtn').textContent='Ⅱ';timer=setInterval(next,Number($('speedSelect').value))}
function stop(){clearInterval(timer);timer=null;$('playBtn').textContent='▶'}
function showToast(msg,error=false){const t=$('toast');t.textContent=msg;t.style.background=error?'#b94837':'#24314a';t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),2800)}
function setExample(key){stop();events=[];step=0;editor.value=examples[key];savedCode=editor.value;renderEditor();$('dirtyDot').classList.remove('visible');$('stackArea').innerHTML='<div class="empty-state compact"><div class="empty-symbol">{ }</div><p>Run the code to see method frames appear here.</p></div>';$('heapArea').innerHTML='<div class="empty-state compact"><div class="empty-symbol">○</div><p>Created objects will appear here.</p></div>';}

editor.addEventListener('input',()=>{renderEditor();$('dirtyDot').classList.toggle('visible',editor.value!==savedCode)});editor.addEventListener('scroll',syncScroll);editor.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();const a=editor.selectionStart,b=editor.selectionEnd;editor.setRangeText('    ',a,b,'end');renderEditor()}});
document.querySelector('.editor-wrap').addEventListener('wheel',e=>{
  if(e.ctrlKey)return;
  if(e.target!==editor){e.preventDefault();editor.scrollTop+=e.deltaY;editor.scrollLeft+=e.deltaX;syncScroll()}
},{passive:false});
$('runBtn').onclick=run;$('resetBtn').onclick=()=>setExample($('exampleSelect').value);$('exampleSelect').onchange=e=>setExample(e.target.value);$('prevBtn').onclick=prev;$('nextBtn').onclick=next;$('playBtn').onclick=play;$('timeline').oninput=e=>{stop();step=Number(e.target.value);renderState()};$('speedSelect').onchange=()=>{if(timer){stop();play()}};$('clearConsoleBtn').onclick=()=>$('consoleOutput').innerHTML='<span class="console-muted">Console cleared.</span>';
$('themeBtn').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
document.querySelectorAll('.view-tab').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.view-tab').forEach(b=>b.classList.toggle('active',b===btn));$('memoryView').hidden=btn.dataset.view!=='memory';$('storyView').hidden=btn.dataset.view!=='story'});
$('shortcutsBtn').onclick=()=>$('shortcutsDialog').showModal();$('closeDialog').onclick=()=>$('shortcutsDialog').close();
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();run()}else if(document.activeElement!==editor&&e.key==='ArrowRight')next();else if(document.activeElement!==editor&&e.key==='ArrowLeft')prev();else if(document.activeElement!==editor&&e.code==='Space'){e.preventDefault();play()}});
window.addEventListener('resize',()=>requestAnimationFrame(drawReferenceArrows));$('stackArea').addEventListener('scroll',drawReferenceArrows);$('heapArea').addEventListener('scroll',drawReferenceArrows);
setExample('bank');
setTheme(localStorage.getItem('objectlab-theme') || (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));
