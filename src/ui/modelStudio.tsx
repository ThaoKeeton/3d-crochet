import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { sculptWithOptionalAi } from '@/domain/blueprint';
import { crochetize } from '@/domain/crochetize';
import { exportStl, parseMeshFile, type TriangleMesh } from '@/domain/mesh';
import { publishModelLesson } from '@/domain/modelLesson';
import { colorsOf, type Palette, type SculptModel } from '@/domain/sculpt';
import { stepsForGraph } from '@/domain/teach';
import { estimateYarn } from '@/domain/content';
import { useApp } from '@/state/store';

const EXAMPLES = ['华晨宇火星红黑小熊挂件', '奶油兔耳圆包', '橘猫圆滚滚摆件', '一只小熊挂件'];
const QUICK = ['#f4e3c8', '#e8c4a4', '#e08a4f', '#e07a68', '#c44536', '#8f3d55', '#6e8f62', '#6f8fbf', '#1c1a19', '#f7f3ea'];

export function ModelStudio() {
  const { settings, setWorld, selected, setSelected, go, route } = useApp();
  const [prompt, setPrompt] = useState(EXAMPLES[0]);
  const [model, setModel] = useState<SculptModel | null>(null);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [sizeCm, setSizeCm] = useState(12);
  const [yarnMm, setYarnMm] = useState(4);
  const [view, setView] = useState<'mesh' | 'yarn'>('mesh');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [stageEl, setStageEl] = useState<Element | null>(null);

  const plan = useMemo(() => (model && view === 'yarn' ? crochetize(model.parts, colors, sizeCm, yarnMm) : null), [model, colors, sizeCm, yarnMm, view]);

  useEffect(() => {
    if (!model) return;
    setWorld({
      kind: 'sculpt',
      parts: model.parts,
      colors,
      view,
      yarns: plan?.graphs ?? [],
      selected,
      sizeCm,
      yarnMm,
    });
  }, [model, colors, view, plan, selected, sizeCm, yarnMm, setWorld]);

  const booted = useState(false);
  const applyModel = (next: SculptModel, land: 1 | 2 | 3 = 1) => {
    const palette = next.palettes[0];
    setModel(next);
    setPaletteIndex(0);
    setColors(palette ? colorsOf(palette) : {});
    setView(land === 3 ? 'yarn' : 'mesh');
    setStep(land);
    setSelected(next.parts[0]?.id ?? null);
  };

  useEffect(() => {
    setStageEl(document.querySelector('.stage'));
  }, []);

  const openStep = (next: 1 | 2 | 3) => {
    if (next > 1 && !model) return;
    if (next === 3) setView('yarn');
    else if (view === 'yarn') setView('mesh');
    setStep(next);
  };

  useEffect(() => {
    if (route.name !== 'sculpt' || !route.prompt || booted[0]) return;
    booted[1](true);
    setPrompt(route.prompt);
    void (async () => {
      setBusy(true);
      try {
        const result = await sculptWithOptionalAi(route.prompt || '', settings);
        const land = route.yarn ? 3 : window.location.hash.endsWith('/color') ? 2 : 1;
        applyModel(result.model, land);
      } finally {
        setBusy(false);
      }
    })();
    // The deep link only seeds the first model.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generate = async (text: string) => {
    setBusy(true);
    setNotice('');
    try {
      const result = await sculptWithOptionalAi(text, settings);
      applyModel(result.model);
      setNotice(result.notice || (result.model.spoken ? '已按提示词里的颜色配好，还可以换同主题的几套。' : '提示词没写颜色，先用最贴题的一套，下面还有几套可换。'));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '没有生成出来');
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File) => {
    setBusy(true);
    setNotice('');
    try {
      const buffer = await file.arrayBuffer();
      const parts = parseMeshFile(file.name, buffer);
      const palettes = importPalettes(parts);
      applyModel({ name: file.name.replace(/\.[^.]+$/, ''), prompt: file.name, parts, palettes, spoken: false });
      setNotice('模型已摆上工作台。点部件可以改色，确认后再转成钩织。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '这个文件读不了');
    } finally {
      setBusy(false);
    }
  };

  const choosePalette = (index: number) => {
    if (!model) return;
    setPaletteIndex(index);
    setColors(colorsOf(model.palettes[index]));
  };

  const current = model?.parts.find((part) => part.id === selected) ?? null;

  const copyPattern = () => {
    if (!plan) return;
    void navigator.clipboard.writeText(plan.pattern);
    setNotice('图解已复制。');
  };

  const groups = useMemo(() => {
    if (!plan) return [];
    const rows: { name: string; color: string; lines: string[] }[] = [];
    for (const round of plan.rounds) {
      const last = rows[rows.length - 1];
      if (!last || last.name !== round.partName) rows.push({ name: round.partName, color: round.color, lines: [] });
      rows[rows.length - 1].lines.push(`圈 ${round.round}  ${round.line}`);
    }
    return rows;
  }, [plan]);
  const stitchTotal = plan ? plan.rounds.reduce((sum, round) => sum + round.count, 0) : 0;

  return (
    <div className="work">
      {step === 3 &&
        stageEl &&
        createPortal(
          <div className="compare-pill">
            <button className={view === 'yarn' ? 'on' : ''} onClick={() => setView('yarn')}>
              钩织成品
            </button>
            <button className={view === 'mesh' ? 'on' : ''} onClick={() => setView('mesh')}>
              原模型
            </button>
          </div>,
          stageEl,
        )}
      <header className="work-head">
        <div className="steps" role="tablist">
          <button className={step === 1 ? 'on' : ''} onClick={() => openStep(1)}>1 选造型</button>
          <button className={step === 2 ? 'on' : ''} disabled={!model} onClick={() => openStep(2)}>2 配颜色</button>
          <button className={step === 3 ? 'on' : ''} disabled={!model} onClick={() => openStep(3)}>3 去钩织</button>
        </div>
      </header>
      <div className="work-body">
        {step === 1 && (
          <>
            <section className="block">
              <h2>AI 说出想法</h2>
              <form className="prompt-row" onSubmit={(event) => { event.preventDefault(); void generate(prompt); }}>
                <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="比如一只奶油小熊" />
                <button className="primary" type="submit" disabled={busy}>{busy ? '生成中' : '生成'}</button>
              </form>
              <div className="chips">
                {EXAMPLES.map((example) => (
                  <button key={example} onClick={() => { setPrompt(example); void generate(example); }}>{example}</button>
                ))}
              </div>
            </section>
            <section className="block">
              <h2>或上传自己的 3D 模型</h2>
              <label className="drop">
                点这里选择 STL、OBJ 或 GLB
                <input type="file" accept=".stl,.obj,.glb,.gltf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onFile(file); event.target.value = ''; }} />
              </label>
            </section>
          </>
        )}
        {step === 2 && model && (
          <>
            <section className="block">
              <h2>推荐配色</h2>
              <div className="palette-grid">
                {model.palettes.map((palette, index) => {
                  const dots = [...new Set(Object.values(palette.colors))].slice(0, 3);
                  return (
                    <button key={palette.id} className={`palette-card${index === paletteIndex ? ' on' : ''}`} onClick={() => choosePalette(index)}>
                      <span className="dots">{dots.map((hex) => <i key={hex} style={{ background: hex }} />)}</span>
                      {palette.name}
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="block">
              <h2>微调细节</h2>
              <div className="part-flow">
                {model.parts.map((part) => (
                  <button key={part.id} className={`part-chip${part.id === selected ? ' on' : ''}`} onClick={() => setSelected(selected === part.id ? null : part.id)}>
                    <i style={{ background: colors[part.id] }} />
                    {part.name}
                  </button>
                ))}
              </div>
              {current && (
                <div className="swatches" aria-label="这一块的颜色">
                  {QUICK.map((hex) => (
                    <button type="button" key={hex} className={colors[current.id]?.toLowerCase() === hex ? 'on' : ''} style={{ background: hex }} onClick={() => setColors((prev) => ({ ...prev, [current.id]: hex }))} />
                  ))}
                </div>
              )}
              <label className="metric">高度 {sizeCm} cm<input type="range" min={6} max={24} value={sizeCm} onChange={(event) => setSizeCm(Number(event.target.value))} /></label>
              <div className="chips">
                {[[3, '细'], [4, '中'], [5, '粗']].map(([mm, label]) => (
                  <button key={label} className={yarnMm === mm ? 'on' : ''} onClick={() => setYarnMm(Number(mm))}>{label} {mm}mm</button>
                ))}
              </div>
            </section>
          </>
        )}
        {step === 3 && plan && (
          <>
            <section className="block">
              <h2>作品概览</h2>
              <div className="stats">
                <div><b>{sizeCm}</b><span>高度 cm</span></div>
                <div><b>{stitchTotal}</b><span>总针数</span></div>
                <div><b>{estimateYarn(plan.lengthCm, yarnMm >= 5 ? 'worsted' : 'sport').meters.toFixed(0)}</b><span>用线 米</span></div>
              </div>
            </section>
            <section className="block">
              <h2>中文图解</h2>
              {groups.map((group) => (
                <div key={group.name} className="pattern-part">
                  <strong><i style={{ background: group.color }} />{group.name}</strong>
                  {group.lines.map((line) => <p key={line}>{line}</p>)}
                </div>
              ))}
            </section>
          </>
        )}
        {notice && <p className="nudge">{notice}</p>}
      </div>
      <footer className="work-foot">
        {step === 1 && (
          <>
            <button className="primary" disabled={!model} onClick={() => openStep(2)}>下一步 · 配颜色</button>
            {model && <button className="texty" onClick={() => downloadStl(model, sizeCm)}>导出 STL</button>}
          </>
        )}
        {step === 2 && (
          <>
            <button className="primary" onClick={() => openStep(3)}>一键转为钩织</button>
            <button className="texty" onClick={() => openStep(1)}>上一步</button>
          </>
        )}
        {step === 3 && model && (
          <>
            <button className="primary" onClick={() => follow(model, plan, go)}>开始跟着钩</button>
            <button className="texty" onClick={copyPattern}>复制图解</button>
          </>
        )}
      </footer>
    </div>
  );
}

function follow(model: SculptModel, plan: ReturnType<typeof crochetize> | null, go: (route: { name: 'lesson'; id: string }) => void) {
  if (!plan) return;
  const steps = stepsForGraph(plan.teachGraph, {
    rich: true,
    maxStitches: 16,
    reveal: '这一部件的圈数走完了。其他部件和图解都在构织台。',
  });
  if (steps[0]) {
    steps[0].title = '魔法环';
    steps[0].body = '从魔法环起针。钩上的这一圈就是起头，后面按图解加针或减针。';
  }
  publishModelLesson({
    id: 'model',
    title: model.name,
    kicker: '照着模型钩',
    summary: '先钩最大的一块。每一圈的加减针都写在图解里。',
    done: '这一块的演示结束。回到构织台看其余部件和缝合。',
    path: 3,
    minutes: 30,
    graph: plan.teachGraph,
    steps,
    spin: 0,
    color: plan.teachColor,
  });
  go({ name: 'lesson', id: 'model' });
}

function downloadStl(model: SculptModel, sizeCm: number) {
  const sized = model.parts.map((part) => {
    const positions = new Float32Array(part.positions.length);
    for (let i = 0; i < positions.length; i++) positions[i] = part.positions[i] * sizeCm;
    return { ...part, positions };
  });
  const blob = new Blob([exportStl(sized)], { type: 'model/stl' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${model.name || '模型'}.stl`;
  link.click();
  URL.revokeObjectURL(url);
}

function importPalettes(parts: TriangleMesh[]): Palette[] {
  const themes: { id: string; name: string; note: string; byRole: Record<string, string> }[] = [
    { id: 'linen', name: '暖杏亚麻', note: '导入模型的默认一套，按部位区分。', byRole: { body: '#e8c4a4', head: '#f4e3c8', ear: '#c4624a', base: '#d7b184', top: '#c4624a', accent: '#8a5a3c', snout: '#f7f3ea' } },
    { id: 'mars', name: '火星红黑', note: '主体红，边缘黑。', byRole: { body: '#c44536', head: '#c44536', ear: '#1c1a19', base: '#1c1a19', top: '#c44536', accent: '#1c1a19', snout: '#f4e3c8' } },
    { id: 'salt', name: '雾蓝亚麻', note: '冷色和亚麻交替。', byRole: { body: '#8eabbe', head: '#d7e6ee', ear: '#e6d3bc', base: '#e6d3bc', top: '#8eabbe', accent: '#6f8fbf', snout: '#f7f3ea' } },
  ];
  return themes.map((theme) => ({
    id: theme.id,
    name: theme.name,
    note: theme.note,
    colors: Object.fromEntries(parts.map((part) => [part.id, theme.byRole[part.role] || '#c4624a'])),
  }));
}
