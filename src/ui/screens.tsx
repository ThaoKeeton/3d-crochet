import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BAG_STEPS,
  PROJECTS,
  bagPattern,
  bagStepPiece,
  estimateYarn,
  getLesson,
  grannyPattern,
  lessonIndex,
  projectGraph,
  projectPattern,
  projectRounds,
  revealDraw,
  chainPattern,
} from '@/domain/content';
import { quatMul, yawQuat } from '@/domain/math';
import {
  amigurumiPreset,
  bagPreset,
  coasterPreset,
  moduleGraph,
  newModule,
  seamIssues,
  snapModule,
  withPreview,
} from '@/domain/piece';
import { beatLight } from '@/domain/teach';
import type { EdgeId, ModuleInstance, ModuleKind, WeightId, YarnNote } from '@/domain/types';
import { YARNS } from '@/domain/yarns';
import { encodePiece, useApp } from '@/state/store';
import { usePlayback } from './playback';

const EDGE_NAME: Record<string, string> = {
  n: '上边',
  e: '右边',
  s: '下边',
  w: '左边',
  start: '起点',
  end: '终点',
  rim: '外圈',
  base: '底边',
  left: '左侧',
  right: '右侧',
};

export function LearnHome() {
  const { go, progress } = useApp();
  const lessons = lessonIndex();
  const paths = [
    { step: 1, title: '锁针带', text: '先认识钩针，再钩出一条能看清的链。' },
    { step: 2, title: '祖母方格杯垫', text: '学会长针和空隙，钩完一块方杯垫。' },
    { step: 3, title: '四方小袋', text: '四块同样的方格，加一条带子。' },
  ];
  return (
    <div className="stack">
      <p className="kicker">从这里开始</p>
      <h1>一针一针，看见线怎么走。</h1>
      <p className="lead">先钩锁针，再完成祖母方格杯垫，最后把四块方格接成一只小袋。</p>
      {paths.map((path) => (
        <section key={path.step} className="path">
          <header>
            <span>0{path.step}</span>
            <div>
              <strong>{path.title}</strong>
              <p>{path.text}</p>
            </div>
          </header>
          <div className="list">
            {lessons
              .filter((lesson) => lesson.path === path.step)
              .map((lesson) => (
                <button key={lesson.id} className="row" onClick={() => go({ name: 'lesson', id: lesson.id })}>
                  <span>
                    <b>{lesson.title}</b>
                    <small>{lesson.summary}</small>
                  </span>
                  <em>{progress.lessons[lesson.id] ? '看过' : `${lesson.minutes} 分钟`}</em>
                </button>
              ))}
            {path.step === 1 && (
              <button className="row" onClick={() => go({ name: 'project', id: 'chain' })}>
                <span>
                  <b>动手钩一条</b>
                  <small>20 针锁针，边钩边记数。</small>
                </span>
                <em>做</em>
              </button>
            )}
            {path.step === 2 && (
              <button className="row" onClick={() => go({ name: 'project', id: 'coaster' })}>
                <span>
                  <b>钩完杯垫</b>
                  <small>四圈方格，按圈记针。</small>
                </span>
                <em>做</em>
              </button>
            )}
            {path.step === 3 && (
              <button className="row" onClick={() => go({ name: 'compose' })}>
                <span>
                  <b>接成小袋</b>
                  <small>四块方格已经摆好，可以改颜色、拆开再缝。</small>
                </span>
                <em>组</em>
              </button>
            )}
          </div>
        </section>
      ))}
      <section className="path">
        <header>
          <span>以后</span>
          <div>
            <strong>圆球与耳朵</strong>
            <p>主路走完再看。短针加减可以做成一个小头，不是第一件成品。</p>
          </div>
        </header>
        <div className="list">
          {lessons
            .filter((lesson) => lesson.path === 0)
            .map((lesson) => (
              <button key={lesson.id} className="row" onClick={() => go({ name: 'lesson', id: lesson.id })}>
                <span>
                  <b>{lesson.title}</b>
                  <small>{lesson.summary}</small>
                </span>
                <em>分支</em>
              </button>
            ))}
        </div>
      </section>
    </div>
  );
}

export function LessonScreen({ id }: { id: string }) {
  const lesson = getLesson(id);
  const { settings, setWorld, makeColors, setMakeColor, markLesson, cameraMode, setCameraMode } = useApp();
  const play = usePlayback(lesson.steps, settings.speed, settings.reduceMotion);
  const color = makeColors[id] ?? lesson.color;
  const step = lesson.steps[play.index];
  const markRef = useRef(markLesson);
  markRef.current = markLesson;
  useEffect(() => {
    setWorld({ kind: 'teach', graph: lesson.graph, color, steps: lesson.steps, play: play.playRef, spin: lesson.spin });
  }, [lesson, color, play.playRef, setWorld]);
  useEffect(() => {
    markRef.current(id, play.index);
  }, [id, play.index]);
  if (!step) return null;
  const light = beatLight(step.beat);
  return (
    <div className="stack">
      <p className="kicker">{lesson.kicker}</p>
      <h1>{lesson.title}</h1>
      <p className="lead">{lesson.summary}</p>
      <Player
        label={`第 ${step.stitchIndex + 1} / ${step.stitchTotal} 针`}
        title={step.title}
        body={step.body}
        loops={step.loops}
        light={light}
        playing={play.playing}
        slow={play.slow}
        runAll={play.runAll}
        onToggle={() => play.setPlaying(!play.playing)}
        onPrev={() => play.setIndex(play.index - 1)}
        onNext={() => play.setIndex(play.index + 1)}
        onStitch={play.nextStitch}
        onSlow={() => play.setSlow(!play.slow)}
        onRunAll={() => play.setRunAll(!play.runAll)}
      />
      <ViewSwitch mode={cameraMode} onChange={setCameraMode} />
      <Swatches value={color} onChange={(hex) => setMakeColor(id, hex)} />
      <div className="note">
        <strong>完成后</strong>
        <p>{lesson.done}</p>
        <button className="texty" onClick={() => play.setIndex(lesson.steps.length - 1)}>
          看完成的样子
        </button>
      </div>
    </div>
  );
}

export function MakeHome() {
  const { go, progress } = useApp();
  return (
    <div className="stack">
      <p className="kicker">跟着做</p>
      <h1>边钩边对。</h1>
      <p className="lead">每一针可以记下来。三维画面跟着你的进度长出来。</p>
      <div className="list">
        {PROJECTS.map((project) => {
          const state = progress.projects[project.id];
          const bag = project.id === 'bag' ? progress.bagStep : 0;
          const status = project.id === 'bag' ? (bag > 0 ? `缝到第 ${bag} 步` : '还没开始') : state ? `第 ${state.round} 段 · ${state.count} 针` : '还没开始';
          return (
            <button key={project.id} className="row tall" onClick={() => go({ name: 'project', id: project.id })}>
              <span>
                <b>{project.title}</b>
                <small>{project.blurb}</small>
              </span>
              <em>{status}</em>
            </button>
          );
        })}
      </div>
      <Estimator seedCm={projectGraph('coaster').lengthCm} />
    </div>
  );
}

export function ProjectScreen({ id }: { id: string }) {
  if (id === 'bag') return <BagProject />;
  return <StitchProject id={id} />;
}

function StitchProject({ id }: { id: string }) {
  const app = useApp();
  const project = PROJECTS.find((item) => item.id === id) ?? PROJECTS[1];
  const color = app.makeColors[id] ?? '#c4624a';
  const { setWorld, markProject } = app;
  const graph = useMemo(() => projectGraph(id), [id]);
  const rounds = useMemo(() => projectRounds(id), [id]);
  const saved = app.progress.projects[id] ?? { round: rounds[0]?.round ?? 0, count: 0 };
  const round = rounds.find((item) => item.round === saved.round) ?? rounds[0];
  const draw = revealDraw(graph, round.round, saved.count);
  useEffect(() => {
    setWorld({ kind: 'make', graph, color, draw, spin: id === 'coaster' ? -Math.PI / 2 : 0 });
  }, [setWorld, graph, color, draw, id]);
  const setCount = (count: number) => {
    const next = Math.max(0, Math.min(round.total, count));
    if (next === round.total) {
      const index = rounds.findIndex((item) => item.round === round.round);
      const following = rounds[index + 1];
      if (following) markProject(id, following.round, 0);
      else markProject(id, round.round, next);
    } else markProject(id, round.round, next);
  };
  return (
    <div className="stack">
      <p className="kicker">第 {['一', '二', '三'][project.path - 1]} 步</p>
      <h1>{project.title}</h1>
      <div className="round-tabs">
        {rounds.map((item) => (
          <button key={item.round} className={item.round === round.round ? 'on' : ''} onClick={() => app.markProject(id, item.round, 0)}>
            {item.title}
          </button>
        ))}
      </div>
      <p className="lead">{round.body}</p>
      <div className="counter">
        <button onClick={() => setCount(saved.count - 1)} aria-label="减一针">
          −
        </button>
        <div>
          <strong>
            {saved.count}
            <small> / {round.total}</small>
          </strong>
          <span>这一段已经钩完</span>
        </div>
        <button onClick={() => setCount(saved.count + 1)} aria-label="加一针">
          ＋
        </button>
      </div>
      <Swatches value={color} onChange={(hex) => app.setMakeColor(id, hex)} />
      <Pattern text={projectPattern(id)} />
      <Estimator seedCm={graph.lengthCm * Math.max(draw, 0.05)} fullCm={graph.lengthCm} />
    </div>
  );
}

function BagProject() {
  const { progress, setBagStep, setWorld, go, setPiece, setMakeColor, makeColors } = useApp();
  const color = makeColors.bag ?? '#f0d3b0';
  const step = Math.max(0, Math.min(BAG_STEPS.length - 1, progress.bagStep));
  const piece = useMemo(() => {
    const base = bagStepPiece(step);
    return { ...base, modules: base.modules.map((mod) => ({ ...mod, color })) };
  }, [step, color]);
  useEffect(() => {
    setWorld({ kind: 'compose', piece, selected: null });
  }, [piece, setWorld]);
  const info = BAG_STEPS[step];
  return (
    <div className="stack">
      <p className="kicker">第三步 · 四方小袋</p>
      <h1>{info.title}</h1>
      <p className="lead">{info.body}</p>
      <div className="counter">
        <button onClick={() => setBagStep(step - 1)} aria-label="上一步">
          −
        </button>
        <div>
          <strong>
            {step + 1}
            <small> / {BAG_STEPS.length}</small>
          </strong>
          <span>缝合进度</span>
        </div>
        <button onClick={() => setBagStep(step + 1)} aria-label="下一步">
          ＋
        </button>
      </div>
      <ol className="checks">
        {BAG_STEPS.map((item, index) => (
          <li key={item.title} className={index === step ? 'on' : index < step ? 'done' : ''}>
            <button onClick={() => setBagStep(index)}>{item.title}</button>
          </li>
        ))}
      </ol>
      <Swatches value={color} onChange={(hex) => setMakeColor('bag', hex)} />
      <div className="row-actions">
        <button className="primary" onClick={() => { setPiece(bagPreset()); go({ name: 'compose' }); }}>
          拿到构织台里改
        </button>
        <button onClick={() => go({ name: 'project', id: 'coaster' })}>按杯垫图解钩一块</button>
      </div>
      <Pattern text={bagPattern()} />
    </div>
  );
}

export function ComposeScreen() {
  const { piece, setPiece, selected, setSelected, setWorld, go } = useApp();
  const [edge, setEdge] = useState<EdgeId | null>(null);
  const [preview, setPreview] = useState(false);
  const [notice, setNotice] = useState('');
  const issues = useMemo(() => seamIssues(piece), [piece]);
  const shown = useMemo(() => (preview && issues[0] ? withPreview(piece, issues[0]) : piece), [preview, piece, issues]);
  useEffect(() => {
    setWorld({ kind: 'compose', piece: shown, selected });
  }, [shown, selected, setWorld]);
  const current = piece.modules.find((mod) => mod.id === selected) ?? null;
  const patch = (id: string, partial: Partial<ModuleInstance>) => {
    setPreview(false);
    setPiece((prev) => ({ ...prev, modules: prev.modules.map((mod) => (mod.id === id ? { ...mod, ...partial, params: { ...mod.params, ...partial.params } } : mod)) }));
  };
  const add = (kind: ModuleKind) => {
    const mod = newModule(kind, piece.modules.length);
    setPiece((prev) => ({ ...prev, modules: [...prev.modules, mod] }));
    setSelected(mod.id);
  };
  const join = (target: ModuleInstance, targetEdge: EdgeId) => {
    if (!current || !edge) return;
    const moved = snapModule(current, edge, target, targetEdge);
    const next = {
      ...piece,
      modules: piece.modules.map((mod) => (mod.id === current.id ? moved : mod)),
      seams: [
        ...piece.seams.filter((seam) => seam.a.moduleId !== current.id && seam.b.moduleId !== current.id),
        { id: `${current.id}-${edge}-${target.id}-${targetEdge}`, a: { moduleId: current.id, edge }, b: { moduleId: target.id, edge: targetEdge } },
      ],
    };
    setPiece(next);
    const problem = seamIssues(next)[0];
    setNotice(problem ? problem.message : '两边针数一致，可以缝。');
    setPreview(false);
  };
  return (
    <div className="stack">
      <p className="kicker">构织</p>
      <h1>{piece.name}</h1>
      <p className="lead">模块会卡在一起。针数对不上时，可以先预览调整，再决定缝不缝。</p>
      {issues[0] && (
        <div className="warn">
          <p>{issues[0].message}</p>
          {issues[0].proposal && (
            <div className="row-actions">
              <button className="primary" onClick={() => setPreview((value) => !value)}>
                {preview ? '取消预览' : '预览调整'}
              </button>
              {preview && (
                <button
                  onClick={() => {
                    setPiece(withPreview(piece, issues[0]));
                    setPreview(false);
                    setNotice('已经按预览改好，四边可以再对一次。');
                  }}
                >
                  采用调整
                </button>
              )}
            </div>
          )}
          {preview && issues[0].proposal?.rounds && <p>预览里这一片改成 {issues[0].proposal.rounds} 圈。</p>}
        </div>
      )}
      {!issues.length && piece.seams.length > 0 && <p className="ok">接缝的针数一致。</p>}
      {notice && <p className="ok">{notice}</p>}
      <div className="chips">
        {(
          [
            ['granny', '方格'],
            ['strap', '带子'],
            ['chain', '锁针带'],
            ['round', '圆片'],
            ['sphere', '圆球'],
            ['ear', '耳朵'],
          ] as [ModuleKind, string][]
        ).map(([kind, label]) => (
          <button key={kind} onClick={() => add(kind)}>
            {label}
          </button>
        ))}
      </div>
      <div className="chips">
        <button onClick={() => { setPiece(bagPreset()); setSelected('front'); setNotice(''); }}>四方小袋</button>
        <button onClick={() => { setPiece(coasterPreset()); setSelected('coaster'); }}>杯垫</button>
        <button onClick={() => { setPiece(amigurumiPreset()); setSelected('head'); }}>圆头与耳朵</button>
      </div>
      <div className="list">
        {piece.modules.map((mod) => (
          <button key={mod.id} className={`row ${mod.id === selected ? 'on' : ''}`} onClick={() => setSelected(mod.id)}>
            <span>
              <b>{mod.name}</b>
              <small>{moduleSummary(mod)}</small>
            </span>
            <i style={{ background: mod.color }} />
          </button>
        ))}
      </div>
      {current && (
        <Inspector
          mod={current}
          edge={edge}
          onEdge={setEdge}
          onPatch={(partial) => patch(current.id, partial)}
          onRemove={() => {
            setPiece((prev) => ({
              ...prev,
              modules: prev.modules.filter((mod) => mod.id !== current.id),
              seams: prev.seams.filter((seam) => seam.a.moduleId !== current.id && seam.b.moduleId !== current.id),
            }));
            setSelected(null);
          }}
          others={piece.modules.filter((mod) => mod.id !== current.id)}
          onJoin={join}
        />
      )}
      <div className="row-actions">
        <button
          onClick={() => {
            const url = `${location.origin}${location.pathname}#/p/${encodePiece(piece)}`;
            void navigator.clipboard.writeText(url);
            setNotice('链接已复制。打开的人会直接看到这件作品。');
          }}
        >
          复制分享链接
        </button>
        <button onClick={() => go({ name: 'mine' })}>记到我的</button>
      </div>
      <Pattern text={piece.name.includes('杯垫') ? grannyPattern(current?.params.rounds ?? 4) : piece.name.includes('锁') ? chainPattern(current?.params.stitches ?? 16) : bagPattern()} />
      <Estimator seedCm={piece.modules.reduce((sum, mod) => sum + moduleGraph(mod).lengthCm, 0)} />
    </div>
  );
}

function Inspector({
  mod,
  edge,
  onEdge,
  onPatch,
  onRemove,
  others,
  onJoin,
}: {
  mod: ModuleInstance;
  edge: EdgeId | null;
  onEdge: (edge: EdgeId) => void;
  onPatch: (partial: Partial<ModuleInstance>) => void;
  onRemove: () => void;
  others: ModuleInstance[];
  onJoin: (target: ModuleInstance, edge: EdgeId) => void;
}) {
  const graph = moduleGraph(mod);
  return (
    <div className="inspector">
      <Swatches value={mod.color} onChange={(hex) => onPatch({ color: hex })} />
      {mod.params.rounds != null && (
        <Stepper label="圈数" value={mod.params.rounds} min={1} max={mod.kind === 'granny' ? 6 : 8} onChange={(rounds) => onPatch({ params: { rounds } })} />
      )}
      {mod.params.stitches != null && (
        <Stepper label="针数" value={mod.params.stitches} min={6} max={40} onChange={(stitches) => onPatch({ params: { stitches } })} />
      )}
      {mod.params.width != null && (
        <Stepper label="带宽" value={mod.params.width} min={2} max={6} onChange={(width) => onPatch({ params: { width } })} />
      )}
      {mod.params.rows != null && (
        <Stepper label="带长" value={mod.params.rows} min={12} max={48} onChange={(rows) => onPatch({ params: { rows } })} />
      )}
      <div className="row-actions">
        <button onClick={() => onPatch({ rotation: quatMul(yawQuat(-15), mod.rotation) })}>左转</button>
        <button onClick={() => onPatch({ rotation: quatMul(yawQuat(15), mod.rotation) })}>右转</button>
        <button onClick={() => onPatch({ scale: Math.max(0.7, Math.round((mod.scale - 0.05) * 100) / 100) })}>缩小</button>
        <button onClick={() => onPatch({ scale: Math.min(1.4, Math.round((mod.scale + 0.05) * 100) / 100) })}>放大</button>
      </div>
      <p className="nudge">拖动作品可以挪位置。左右前后是一小步。</p>
      <div className="row-actions">
        <button onClick={() => onPatch({ position: [mod.position[0] - 0.4, mod.position[1], mod.position[2]] })}>左</button>
        <button onClick={() => onPatch({ position: [mod.position[0] + 0.4, mod.position[1], mod.position[2]] })}>右</button>
        <button onClick={() => onPatch({ position: [mod.position[0], mod.position[1], mod.position[2] - 0.4] })}>远</button>
        <button onClick={() => onPatch({ position: [mod.position[0], mod.position[1], mod.position[2] + 0.4] })}>近</button>
      </div>
      <p className="kicker">接哪一条边</p>
      <div className="chips">
        {graph.edges.map((item) => (
          <button key={item.id} className={edge === item.id ? 'on' : ''} onClick={() => onEdge(item.id)}>
            {EDGE_NAME[item.id] ?? item.id} · {item.count} 针
          </button>
        ))}
      </div>
      {edge && (
        <div className="list">
          {others.flatMap((other) =>
            moduleGraph(other).edges.map((item) => (
              <button key={`${other.id}-${item.id}`} className="row" onClick={() => onJoin(other, item.id)}>
                <span>
                  <b>
                    接到{other.name}的{EDGE_NAME[item.id] ?? item.id}
                  </b>
                  <small>{item.count} 针</small>
                </span>
              </button>
            )),
          )}
        </div>
      )}
      <button className="texty danger" onClick={onRemove}>
        卸下这块
      </button>
    </div>
  );
}

export function MineScreen() {
  const { notes, addNote, removeNote, colorways, piece, settings, patchSettings, resetAll, go, progress } = useApp();
  const [draft, setDraft] = useState<YarnNote>({ id: '', name: '', color: YARNS[0].hex, weight: 'sport', meters: '', note: '' });
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="stack">
      <p className="kicker">我的</p>
      <h1>手边的线和进度。</h1>
      <section>
        <h2>正在做</h2>
        <button className="row" onClick={() => go({ name: 'compose' })}>
          <span>
            <b>{piece.name}</b>
            <small>{piece.modules.length} 个模块 · {piece.seams.length} 条缝</small>
          </span>
          <em>打开</em>
        </button>
        {PROJECTS.map((project) => (
          <button key={project.id} className="row" onClick={() => go({ name: 'project', id: project.id })}>
            <span>
              <b>{project.title}</b>
              <small>{project.id === 'bag' ? `第 ${progress.bagStep + 1} 步` : progress.projects[project.id] ? '有进度' : '还没开始'}</small>
            </span>
          </button>
        ))}
      </section>
      <section>
        <h2>线材笔记</h2>
        {notes.length === 0 && <p className="lead">记下线团的颜色和剩余米数，下次配色不用猜。</p>}
        {notes.map((note) => (
          <div key={note.id} className="note">
            <strong>
              <i style={{ background: note.color }} /> {note.name || '未命名线团'}
            </strong>
            <p>
              {labelWeight(note.weight)} · 剩余 {note.meters || '—'} 米
            </p>
            {note.note && <p>{note.note}</p>}
            <button className="texty" onClick={() => removeNote(note.id)}>
              删除
            </button>
          </div>
        ))}
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.name.trim()) return;
            addNote({ ...draft, id: `yarn-${Date.now()}` });
            setDraft({ id: '', name: '', color: draft.color, weight: draft.weight, meters: '', note: '' });
          }}
        >
          <input placeholder="线的名字，比如牛乳棉" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          <div className="split">
            <input placeholder="还剩多少米" value={draft.meters} onChange={(event) => setDraft({ ...draft, meters: event.target.value })} />
            <select value={draft.weight} onChange={(event) => setDraft({ ...draft, weight: event.target.value as WeightId })}>
              <option value="fine">细线</option>
              <option value="sport">中细</option>
              <option value="worsted">中粗</option>
              <option value="bulky">粗线</option>
            </select>
          </div>
          <textarea placeholder="买的店、色号，或者钩起来的手感" value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
          <Swatches value={draft.color} onChange={(hex) => setDraft({ ...draft, color: hex })} />
          <button className="primary" type="submit">
            记下这团线
          </button>
        </form>
      </section>
      <section>
        <h2>配色</h2>
        {colorways.length === 0 && <p className="lead">在构织台里选好颜色后，可以记成一组配色。</p>}
        {colorways.map((way) => (
          <div key={way.id} className="note">
            <strong>{way.name}</strong>
            <div className="swatches">
              {way.colors.map((hex) => (
                <i key={hex} style={{ background: hex }} />
              ))}
            </div>
          </div>
        ))}
      </section>
      <Estimator seedCm={piece.modules.reduce((sum, mod) => sum + moduleGraph(mod).lengthCm, 0)} />
      <section>
        <h2>设置</h2>
        <fieldset>
          <legend>惯用手</legend>
          <div className="chips">
            <button className={settings.hand === 'right' ? 'on' : ''} onClick={() => patchSettings({ hand: 'right' })}>
              右手
            </button>
            <button className={settings.hand === 'left' ? 'on' : ''} onClick={() => patchSettings({ hand: 'left' })}>
              左手
            </button>
          </div>
          <p className="nudge">左手会把演示左右对调，步骤还是同样的话。</p>
        </fieldset>
        <fieldset>
          <legend>演示速度</legend>
          <div className="chips">
            <button className={settings.speed === 0.7 ? 'on' : ''} onClick={() => patchSettings({ speed: 0.7 })}>
              慢
            </button>
            <button className={settings.speed === 1 ? 'on' : ''} onClick={() => patchSettings({ speed: 1 })}>
              标准
            </button>
            <button className={settings.speed === 1.35 ? 'on' : ''} onClick={() => patchSettings({ speed: 1.35 })}>
              快
            </button>
          </div>
        </fieldset>
        <label className="check">
          <input type="checkbox" checked={settings.reduceMotion} onChange={(event) => patchSettings({ reduceMotion: event.target.checked })} />
          减少动效
        </label>
        {!confirm ? (
          <button className="texty danger" onClick={() => setConfirm(true)}>
            清空这台设备上的进度
          </button>
        ) : (
          <button className="primary" onClick={resetAll}>
            确认清空
          </button>
        )}
      </section>
    </div>
  );
}

function Player({
  label,
  title,
  body,
  loops,
  light,
  playing,
  slow,
  runAll,
  onToggle,
  onPrev,
  onNext,
  onStitch,
  onSlow,
  onRunAll,
}: {
  label: string;
  title: string;
  body: string;
  loops: number;
  light: 'insert' | 'wrap' | 'loop';
  playing: boolean;
  slow: boolean;
  runAll: boolean;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  onStitch: () => void;
  onSlow: () => void;
  onRunAll: () => void;
}) {
  return (
    <div className="player" aria-live="polite">
      <div className="beats">
        <span className={light === 'insert' ? 'on' : ''}>入针</span>
        <span className={light === 'wrap' ? 'on' : ''}>绕线</span>
        <span className={light === 'loop' ? 'on' : ''}>钩上的圈</span>
      </div>
      <div className="loops" aria-label={`钩上 ${loops} 圈`}>
        {Array.from({ length: Math.max(1, loops) }, (_, index) => (
          <i key={index} />
        ))}
        <em>{loops > 0 ? `钩上 ${loops} 圈` : '钩上还没有圈'}</em>
      </div>
      <p className="kicker">{label}</p>
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="transport">
        <button onClick={onPrev} aria-label="上一步">
          上一步
        </button>
        <button className="primary" onClick={onToggle}>
          {playing ? '暂停' : '播放'}
        </button>
        <button onClick={onNext} aria-label="下一步">
          下一步
        </button>
      </div>
      <div className="row-actions">
        <button onClick={onStitch}>下一针</button>
        <button className={slow ? 'on' : ''} onClick={onSlow}>
          慢放
        </button>
        <button className={runAll ? 'on' : ''} onClick={onRunAll}>
          {runAll ? '连续播放中' : '连续播放'}
        </button>
      </div>
    </div>
  );
}

function ViewSwitch({ mode, onChange }: { mode: string; onChange: (mode: 'follow' | 'hook' | 'overview') => void }) {
  return (
    <div className="chips" aria-label="视角">
      <button className={mode === 'follow' ? 'on' : ''} onClick={() => onChange('follow')}>
        跟着这一针
      </button>
      <button className={mode === 'hook' ? 'on' : ''} onClick={() => onChange('hook')}>
        钩尖
      </button>
      <button className={mode === 'overview' ? 'on' : ''} onClick={() => onChange('overview')}>
        整片
      </button>
    </div>
  );
}

function Swatches({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <div className="swatches" aria-label="线的颜色">
      {YARNS.map((yarn) => (
        <button type="button" key={yarn.id} className={value.toLowerCase() === yarn.hex.toLowerCase() ? 'on' : ''} style={{ background: yarn.hex }} onClick={() => onChange(yarn.hex)} aria-label={yarn.name} />
      ))}
    </div>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <div className="counter slim">
      <button onClick={() => onChange(Math.max(min, value - 1))} aria-label={`减少${label}`}>
        −
      </button>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
      <button onClick={() => onChange(Math.min(max, value + 1))} aria-label={`增加${label}`}>
        ＋
      </button>
    </div>
  );
}

function Pattern({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="note">
      <strong>图解</strong>
      <pre>{text}</pre>
      <button
        className="texty"
        onClick={() => {
          void navigator.clipboard.writeText(text);
          setCopied(true);
        }}
      >
        {copied ? '已复制' : '复制图解'}
      </button>
    </div>
  );
}

function Estimator({ seedCm, fullCm }: { seedCm: number; fullCm?: number }) {
  const [weight, setWeight] = useState<WeightId>('sport');
  const [gauge, setGauge] = useState('');
  const result = estimateYarn(fullCm ?? seedCm, weight, gauge ? Number(gauge) : undefined);
  return (
    <section className="estimate">
      <h2>用线估算</h2>
      <div className="chips">
        {(
          [
            ['fine', '细线'],
            ['sport', '中细'],
            ['worsted', '中粗'],
            ['bulky', '粗线'],
          ] as [WeightId, string][]
        ).map(([id, label]) => (
          <button key={id} className={weight === id ? 'on' : ''} onClick={() => setWeight(id)}>
            {label}
          </button>
        ))}
      </div>
      <label className="field">
        你的密度（10 厘米的针数，可留空）
        <input inputMode="decimal" value={gauge} placeholder="例如 20" onChange={(event) => setGauge(event.target.value)} />
      </label>
      <p className="figure">
        大约 <b>{result.meters.toFixed(1)}</b> 米 · <b>{result.grams.toFixed(0)}</b> 克
      </p>
      <p>建议钩针 {result.pick}（{result.hook}）。</p>
      <p className="nudge">{result.note}</p>
      {fullCm != null && <p className="nudge">做到现在大约 {estimateYarn(seedCm, weight).meters.toFixed(1)} 米。</p>}
    </section>
  );
}

function moduleSummary(mod: ModuleInstance): string {
  if (mod.params.rounds) return `${mod.params.rounds} 圈`;
  if (mod.params.stitches) return `${mod.params.stitches} 针`;
  if (mod.params.rows) return `${mod.params.width ?? 3} 针宽 · ${mod.params.rows} 行`;
  return '一整件';
}

function labelWeight(weight: WeightId): string {
  if (weight === 'fine') return '细线';
  if (weight === 'worsted') return '中粗';
  if (weight === 'bulky') return '粗线';
  return '中细';
}
