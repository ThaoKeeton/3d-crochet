import { useEffect, useMemo, useState } from 'react';
import { sculptWithOptionalAi } from '@/domain/blueprint';
import { crochetize } from '@/domain/crochetize';
import { exportStl, parseMeshFile, type TriangleMesh } from '@/domain/mesh';
import { publishModelLesson } from '@/domain/modelLesson';
import { colorsOf, type Palette, type SculptModel } from '@/domain/sculpt';
import { stepsForGraph } from '@/domain/teach';
import { estimateYarn } from '@/domain/content';
import { YARNS } from '@/domain/yarns';
import { useApp } from '@/state/store';

const EXAMPLES = ['华晨宇火星红黑小熊挂件', '奶油兔耳圆包', '橘猫圆滚滚摆件', '一只小熊挂件'];

export function ModelStudio() {
  const { settings, setWorld, selected, setSelected, go, route } = useApp();
  const [prompt, setPrompt] = useState(EXAMPLES[0]);
  const [model, setModel] = useState<SculptModel | null>(null);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [sizeCm, setSizeCm] = useState(12);
  const [yarnMm, setYarnMm] = useState(4);
  const [view, setView] = useState<'mesh' | 'yarn'>('mesh');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

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
  const applyModel = (next: SculptModel, asYarn = false) => {
    const palette = next.palettes[0];
    setModel(next);
    setPaletteIndex(0);
    setColors(palette ? colorsOf(palette) : {});
    setView(asYarn ? 'yarn' : 'mesh');
    setSelected(next.parts[0]?.id ?? null);
  };

  useEffect(() => {
    if (route.name !== 'sculpt' || !route.prompt || booted[0]) return;
    booted[1](true);
    setPrompt(route.prompt);
    void (async () => {
      setBusy(true);
      try {
        const result = await sculptWithOptionalAi(route.prompt || '', settings);
        applyModel(result.model, route.yarn);
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
    setView('mesh');
  };

  const current = model?.parts.find((part) => part.id === selected) ?? null;

  return (
    <div className="stack">
      <p className="kicker">从三维模型</p>
      <h1>{model ? model.name : '先有一个模型。'}</h1>
      {!model && (
        <>
          <p className="lead">写下想钩的东西，或导入 STL、OBJ、GLB。确认颜色和尺寸之后，再转成能钩的成品。</p>
          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              void generate(prompt);
            }}
          >
            <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="例如：薄荷绿和奶白兔耳包" />
            <button className="primary" type="submit" disabled={busy}>
              {busy ? '正在成形…' : '生成三维模型'}
            </button>
          </form>
          <div className="chips">
            {EXAMPLES.map((example) => (
              <button key={example} onClick={() => { setPrompt(example); void generate(example); }}>
                {example}
              </button>
            ))}
          </div>
          <label className="file">
            导入 STL / OBJ / GLB
            <input
              type="file"
              accept=".stl,.obj,.glb,.gltf,model/stl,model/obj"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onFile(file);
                event.target.value = '';
              }}
            />
          </label>
        </>
      )}
      {model && (
        <>
          <p className="lead">{view === 'mesh' ? '这还是三维模型。改好颜色和尺寸，再决定要不要钩。' : '这是按圈织短针转出来的纱线。图解可以照着钩。'}</p>
          {view === 'yarn' && (
            <div className="chips">
              <button className={view === 'yarn' ? 'on' : ''} onClick={() => setView('yarn')}>
                钩织成品
              </button>
              <button onClick={() => setView('mesh')}>原三维模型</button>
            </div>
          )}
          <div className="chips">
            {model.palettes.map((palette, index) => (
              <button key={palette.id} className={index === paletteIndex ? 'on' : ''} onClick={() => choosePalette(index)}>
                {palette.name}
              </button>
            ))}
          </div>
          {model.palettes[paletteIndex] && <p className="nudge">{model.palettes[paletteIndex].note}</p>}
          <div className="list">
            {model.parts.map((part) => (
              <button key={part.id} className={`row ${part.id === selected ? 'on' : ''}`} onClick={() => setSelected(part.id)}>
                <span>
                  <b>{part.name}</b>
                  <small>点模型或这里改这一块的颜色</small>
                </span>
                <i style={{ background: colors[part.id] }} />
              </button>
            ))}
          </div>
          {current && view === 'mesh' && (
            <div className="swatches" aria-label="部件颜色">
              {YARNS.map((yarn) => (
                <button
                  type="button"
                  key={yarn.id}
                  className={colors[current.id]?.toLowerCase() === yarn.hex.toLowerCase() ? 'on' : ''}
                  style={{ background: yarn.hex }}
                  aria-label={yarn.name}
                  onClick={() => setColors((prev) => ({ ...prev, [current.id]: yarn.hex }))}
                />
              ))}
            </div>
          )}
          <label className="nudge">
            成品高度 {sizeCm} cm
            <input type="range" min={6} max={24} value={sizeCm} onChange={(event) => { setSizeCm(Number(event.target.value)); setView('mesh'); }} />
          </label>
          <div className="chips">
            {[3, 4, 5].map((mm) => (
              <button key={mm} className={yarnMm === mm ? 'on' : ''} onClick={() => { setYarnMm(mm); setView('mesh'); }}>
                {mm} mm 线
              </button>
            ))}
          </div>
          <div className="row-actions">
            {view === 'mesh' ? (
              <button className="primary" onClick={() => setView('yarn')}>
                转为钩织
              </button>
            ) : (
              <button className="primary" onClick={() => follow(model, plan, go)}>
                跟着钩
              </button>
            )}
            <button onClick={() => downloadStl(model, sizeCm)}>导出 STL</button>
            <button onClick={() => { setModel(null); setNotice(''); }}>换一个模型</button>
          </div>
          {plan && (
            <>
              <p className="ok">线长约 {Math.round(plan.lengthCm)} cm · {estimateYarn(plan.lengthCm, yarnMm >= 5 ? 'worsted' : 'sport').meters.toFixed(0)} 米</p>
              <div className="note">
                <strong>图解</strong>
                <pre>{plan.pattern}</pre>
                <button
                  className="texty"
                  onClick={() => {
                    void navigator.clipboard.writeText(plan.pattern);
                    setNotice('图解已复制。');
                  }}
                >
                  复制图解
                </button>
              </div>
            </>
          )}
        </>
      )}
      {notice && <p className="nudge">{notice}</p>}
      <button className="texty" onClick={() => go({ name: 'compose' })}>
        回到构织台
      </button>
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
