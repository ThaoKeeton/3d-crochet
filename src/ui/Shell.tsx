import { useEffect } from 'react';
import { buildChain, buildGranny } from '@/domain/motifs';
import { useApp, type Route } from '@/state/store';
import { StageCanvas } from '@/three/Stage';
import { ComposeScreen, LearnHome, LessonScreen, MakeHome, MineScreen, ProjectScreen } from './screens';

export function Shell() {
  const { route, go, settings, patchSettings, setWorld, piece, cameraMode, setCameraMode } = useApp();
  useEffect(() => {
    if (route.name === 'lesson') setCameraMode('follow');
    else if (route.name === 'compose' || route.name === 'make' || route.name === 'project') setCameraMode('overview');
  }, [route.name, setCameraMode]);
  useEffect(() => {
    if (route.name === 'learn') {
      setWorld({ kind: 'still', graph: buildChain(8), color: '#c4624a', spin: 0, hook: true });
    } else if (route.name === 'make') {
      setWorld({ kind: 'make', graph: buildGranny(2), color: '#c4624a', draw: 1, spin: -Math.PI / 2 });
    } else if (route.name === 'mine') {
      setWorld({ kind: 'compose', piece, selected: null });
    }
  }, [route, setWorld, piece]);

  const title =
    route.name === 'lesson' ? '学' : route.name === 'project' ? '做' : route.name === 'make' ? '做' : route.name === 'compose' ? '组' : route.name === 'mine' ? '我的' : '学';

  return (
    <div className={route.name === 'compose' || route.name === 'learn' || route.name === 'lesson' ? 'app hero' : 'app'}>
      <nav className="nav" aria-label="主导航">
        <p className="mark">
          三维
          <br />
          钩织
        </p>
        <NavButton id="learn" label="学" active={route.name === 'learn' || route.name === 'lesson'} onClick={() => go({ name: 'learn' })} />
        <NavButton id="make" label="做" active={route.name === 'make' || route.name === 'project'} onClick={() => go({ name: 'make' })} />
        <NavButton id="compose" label="组" active={route.name === 'compose'} onClick={() => go({ name: 'compose' })} />
        <NavButton id="mine" label="我的" active={route.name === 'mine'} onClick={() => go({ name: 'mine' })} />
      </nav>
      <div className="stage">
        <StageCanvas />
        <div className="stage-top">
          <strong>三维钩织</strong>
          <span>{title}</span>
        </div>
        {(route.name === 'lesson' || route.name === 'project' || route.name === 'compose') && (
          <div className="stage-views">
            <button className={cameraMode === 'follow' ? 'on' : ''} onClick={() => setCameraMode('follow')}>
              跟着
            </button>
            <button className={cameraMode === 'hook' ? 'on' : ''} onClick={() => setCameraMode('hook')}>
              钩尖
            </button>
            <button className={cameraMode === 'overview' ? 'on' : ''} onClick={() => setCameraMode('overview')}>
              整片
            </button>
          </div>
        )}
        {!settings.hintSeen && (
          <button className="hint" onClick={() => patchSettings({ hintSeen: true })}>
            单指转动，双指缩放
          </button>
        )}
      </div>
      <main className="sheet">{screenFor(route)}</main>
    </div>
  );
}

function screenFor(route: Route) {
  if (route.name === 'lesson') return <LessonScreen id={route.id} />;
  if (route.name === 'make') return <MakeHome />;
  if (route.name === 'project') return <ProjectScreen id={route.id} />;
  if (route.name === 'compose') return <ComposeScreen />;
  if (route.name === 'mine') return <MineScreen />;
  return <LearnHome />;
}

function NavButton({ id, label, active, onClick }: { id: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={active ? 'nav-btn on' : 'nav-btn'} onClick={onClick} aria-current={active ? 'page' : undefined}>
      <Icon name={id} />
      {label}
    </button>
  );
}

function Icon({ name }: { name: string }) {
  if (name === 'make') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect x="7" y="8" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 16h12M10 12h8" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (name === 'compose') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect x="6" y="6" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <rect x="17" y="6" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <rect x="6" y="17" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <rect x="17" y="17" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (name === 'mine') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M16 9c2 3 2 11 0 14M9 16c3-2 11-2 14 0" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M10 22c2-8 4-12 8-14 1 3 1 6-1 8 3 0 6-1 8-3-1 6-5 10-15 9z" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
