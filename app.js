const examples = {
  blank: '',
  inheritance: `class Animal {
    String name;

    Animal(String name) {
        this.name = name;
    }

    void speak() {
        System.out.println(name + " makes a sound");
    }

    void introduce() {
        System.out.println("Meet " + name);
    }
}

class Dog extends Animal {
    Dog(String name) {
        super(name);
    }

    @Override
    void speak() {
        System.out.println(name + " says woof!");
    }
}

class Main {
    public static void main(String[] args) {
        Animal pet = new Dog("Mochi");
        pet.introduce();
        pet.speak();
    }
}`,
  overloading: `class Counter {
    int count;

    Counter() {
        this(0);
    }

    Counter(int start) {
        count = start;
    }

    void add(int amount) {
        count += amount;
    }

    void add(String label) {
        System.out.println(label + count);
    }

    void add(int amount, int times) {
        count += amount * times;
    }
}

class Main {
    public static void main(String[] args) {
        Counter counter = new Counter();
        Counter other = new Counter(10);
        counter.add(2);
        counter.add(3, 4);
        counter.add("Total: ");
        other.add("Other: ");
    }
}`,
  loops: `class Counter {
    int count;

    void increment() {
        count++;
    }
}

class Main {
    public static void main(String[] args) {
        Counter counter = new Counter();
        for (int i = 0; i < 3; i++) {
            counter.increment();
        }
        while (counter.count < 5) {
            counter.increment();
        }
        do {
            counter.count--;
        } while (counter.count > 3);
        System.out.println(counter.count);
    }
}`,
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
  const tokenRe = /(\/\/.*$)|("(?:\\.|[^"\\])*")|\b(class|public|static|void|new|return|this|super|private|protected|extends|int|boolean|double|long|char|String|for|while|do|if|else|break|continue|true|false|null)\b|\b([A-Z][A-Za-z0-9_]*)\b|\b(\d+(?:\.\d+)?)\b|\.([a-zA-Z_]\w*)(?=\()/g;
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
  syncScroll();
}
function syncScroll() {
  // Match the textarea's content viewport, excluding its native scrollbars.
  highlight.style.width = `${editor.clientWidth}px`;
  highlight.style.height = `${editor.clientHeight}px`;
  numbers.style.setProperty('--editor-scrollbar-height', `${editor.offsetHeight-editor.clientHeight}px`);
  highlight.scrollTop = editor.scrollTop;
  highlight.scrollLeft = editor.scrollLeft;
  numbers.scrollTop = editor.scrollTop;
}

const { simulate } = ObjectLabInterpreter;

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
  $('storyList').innerHTML=events.map((x,i)=>`<div class="story-item ${i<=step?'reached':''} ${i===step?'active':''}"><button class="story-index" type="button" data-step="${i}" aria-label="Go to step ${i+1}">${i+1}</button><div class="story-copy"><strong>${escapeHtml(x.title)}</strong>${escapeHtml(x.text)}</div></div>`).join('');
  if(!$('storyView').hidden){$('storyList').querySelector('.story-item.active')?.scrollIntoView({behavior:'smooth',block:'center'});}
  scrollEditorToLine(e.line);
  $('prevBtn').disabled=step===0;$('nextBtn').disabled=step===events.length-1;requestAnimationFrame(drawReferenceArrows);
}
function scrollEditorToLine(line){
  if(!line)return;
  const style=getComputedStyle(editor),lineHeight=parseFloat(style.lineHeight),padding=parseFloat(style.paddingTop),target=(line-1)*lineHeight+padding;
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
function clearExecution(label='READY',message='Choose an example or write code, then press Visualize.'){
  stop();events=[];step=0;$('stepCount').textContent=label==='ERROR'?'Could not visualize':'Ready to visualize';$('timelineTitle').textContent=label==='ERROR'?'Fix the highlighted code':'No execution yet';$('timelinePosition').textContent='0 / 0';$('timeline').min=0;$('timeline').max=0;$('timeline').value=0;$('timeline').style.setProperty('--progress','0%');$('eventDots').innerHTML='';$('memoryArrows').innerHTML='';
  $('stackArea').innerHTML='<div class="empty-state compact"><div class="empty-symbol">{ }</div><p>'+(label==='ERROR'?'Execution did not start.':'Run the code to see method frames appear here.')+'</p></div>';
  $('heapArea').innerHTML='<div class="empty-state compact"><div class="empty-symbol">○</div><p>'+(label==='ERROR'?'No stale objects are shown.':'Created objects will appear here.')+'</p></div>';
  $('consoleOutput').innerHTML='<span class="console-muted">'+(label==='ERROR'?'Nothing was executed.':'Output will appear here…')+'</span>';$('storyList').innerHTML='';$('explanationNumber').textContent=label==='ERROR'?'!':'i';$('explanationLabel').textContent=label;$('explanationText').textContent=message;$('prevBtn').disabled=true;$('nextBtn').disabled=true;
}
function run() { stop();editor.blur();try{const nextEvents=simulate(editor.value);events=nextEvents;step=0;savedCode=editor.value;$('dirtyDot').classList.remove('visible');$('timeline').max=Math.max(0,events.length-1);$('eventDots').innerHTML=events.map(()=>'<i class="event-dot"></i>').join('');renderState();showToast(`${events.length} learning steps created.`);return true;}catch(err){clearExecution('ERROR',err.message);renderEditor();showToast(err.message,true);return false;} }
function visualize(){if(run())play()}
function next(){if(!events.length)return run();if(step<events.length-1){step++;renderState()}else stop()}
function prev(){stop();if(step>0){step--;renderState()}}
function play(){if(!events.length)run();if(!events.length)return;if(timer){stop();return}if(step===events.length-1)step=0;$('playBtn').textContent='Ⅱ';timer=setInterval(next,Number($('speedSelect').value))}
function stop(){clearInterval(timer);timer=null;$('playBtn').textContent='▶'}
function showToast(msg,error=false){const t=$('toast');t.textContent=msg;t.style.background=error?'#b94837':'#24314a';t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),2800)}
function setExample(key){clearExecution();editor.value=examples[key];editor.scrollTop=0;editor.scrollLeft=0;savedCode=editor.value;renderEditor();$('dirtyDot').classList.remove('visible');}

editor.addEventListener('focus',()=>document.querySelector('.editor-wrap').classList.add('editing'));
editor.addEventListener('blur',()=>document.querySelector('.editor-wrap').classList.remove('editing'));
editor.addEventListener('input',()=>{clearExecution('READY','Code changed. Press Visualize to create a new execution.');renderEditor();$('dirtyDot').classList.toggle('visible',editor.value!==savedCode)});editor.addEventListener('scroll',syncScroll);editor.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();const a=editor.selectionStart,b=editor.selectionEnd;editor.setRangeText('    ',a,b,'end');editor.dispatchEvent(new Event('input'))}});
document.querySelector('.editor-wrap').addEventListener('wheel',e=>{
  if(e.ctrlKey)return;
  if(e.target!==editor){
    e.preventDefault();
    const unit=e.deltaMode===1?parseFloat(getComputedStyle(editor).lineHeight):e.deltaMode===2?editor.clientHeight:1;
    if(e.shiftKey)editor.scrollLeft+=(e.deltaX||e.deltaY)*unit;
    else{editor.scrollTop+=e.deltaY*unit;editor.scrollLeft+=e.deltaX*unit;}
    syncScroll();
  }
},{passive:false});
$('runBtn').onclick=visualize;$('resetBtn').onclick=()=>setExample($('exampleSelect').value);$('exampleSelect').onchange=e=>setExample(e.target.value);$('prevBtn').onclick=prev;$('nextBtn').onclick=next;$('playBtn').onclick=play;$('timeline').oninput=e=>{stop();step=Number(e.target.value);renderState()};$('speedSelect').onchange=()=>{if(timer){stop();play()}};$('clearConsoleBtn').onclick=()=>$('consoleOutput').innerHTML='<span class="console-muted">Console cleared.</span>';
$('themeBtn').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
$('storyList').addEventListener('click',e=>{const button=e.target.closest('.story-index');if(!button)return;stop();step=Number(button.dataset.step);renderState()});
document.querySelectorAll('.view-tab').forEach(btn=>btn.onclick=()=>{
  const showMemory=btn.dataset.view==='memory';
  document.querySelectorAll('.view-tab').forEach(b=>b.classList.toggle('active',b===btn));
  $('memoryView').hidden=!showMemory;
  $('storyView').hidden=showMemory;
  if(showMemory)requestAnimationFrame(drawReferenceArrows);
  else $('memoryArrows').innerHTML='';
});
$('shortcutsBtn').onclick=()=>$('shortcutsDialog').showModal();$('closeDialog').onclick=()=>$('shortcutsDialog').close();
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();run()}else if(document.activeElement!==editor&&e.key==='ArrowRight')next();else if(document.activeElement!==editor&&e.key==='ArrowLeft')prev();else if(document.activeElement!==editor&&e.code==='Space'){e.preventDefault();play()}});
window.addEventListener('resize',()=>requestAnimationFrame(drawReferenceArrows));$('stackArea').addEventListener('scroll',drawReferenceArrows);$('heapArea').addEventListener('scroll',drawReferenceArrows);
new ResizeObserver(syncScroll).observe(editor);
document.fonts.ready.then(syncScroll);
setExample('bank');
setTheme(localStorage.getItem('objectlab-theme') || (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));
