import { modelFromBlueprint, sculptFromPrompt, type Blueprint, type SculptModel } from './sculpt';

export interface AiSettings {
  aiBase?: string;
  aiModel?: string;
  aiKey?: string;
}

export async function sculptWithOptionalAi(prompt: string, settings: AiSettings): Promise<{ model: SculptModel; remote: boolean; notice: string }> {
  const local = () => sculptFromPrompt(prompt);
  if (!settings.aiBase?.trim() || !settings.aiKey?.trim()) {
    return { model: local(), remote: false, notice: '' };
  }
  try {
    const blueprint = await requestBlueprint(prompt, settings.aiBase.trim(), settings.aiModel?.trim() || 'gpt-4o-mini', settings.aiKey.trim());
    return { model: modelFromBlueprint(prompt, blueprint), remote: true, notice: '这一套结构来自你配置的接口。' };
  } catch (error) {
    const message = error instanceof Error ? error.message : '接口没有返回可用的蓝图';
    return { model: local(), remote: false, notice: `接口暂时不可用，已用内置造型。${message}` };
  }
}

async function requestBlueprint(prompt: string, base: string, model: string, key: string): Promise<Blueprint> {
  const root = base.replace(/\/$/, '').replace(/\/chat\/completions$/, '');
  const response = await fetch(`${root}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content:
            '你只输出 JSON。根据中文钩织想法给出结构化三维蓝图。subject 只能是 bear、rabbit、cat、bag、planet。accessories 从 耳朵、帽子、围巾、星球、火焰、挂环 里选。palettes 必须是 3 到 4 套，每套 colors 用部件角色当键：body、head、ear、snout、tail、hat、scarf、flame、planet、strap、loop。如果用户写了颜色，第一套必须采用那些颜色，其余是同主题的深浅或撞色。如果用户没写颜色，按主题给协调的多套配色，而不是通用彩虹。',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!response.ok) throw new Error(`接口返回 ${response.status}`);
  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const text = payload.choices?.[0]?.message?.content ?? '';
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const parsed = JSON.parse(json) as Blueprint;
  if (!parsed.palettes?.length) throw new Error('没有 palettes');
  return parsed;
}
