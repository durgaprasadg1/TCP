import { Boxes, GitCompare, Home, Layers, ListChecks, Wrench } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '../lib/cn';

const NAV = [
  { to: '/', label: 'Overview', icon: Home, end: true },
  { to: '/pda', label: 'PDA Laboratory', icon: Layers },
  { to: '/tm', label: 'Turing Machine Laboratory', icon: Boxes },
  { to: '/builder', label: 'Machine Builder', icon: Wrench },
  { to: '/compare', label: 'Comparison Laboratory', icon: GitCompare },
  { to: '/tests', label: 'Test Runner', icon: ListChecks },
] as const;

export default function Layout() {
  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-ink-700 focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className="border-b border-ink-600 bg-[#DED6C1] md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#CFC6B1] font-mono text-sm font-bold text-[#302d26]" aria-hidden>
            δ
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-[#302d26]">Computation</div>
            <div className="text-xs text-[#514b40]">Workbench</div>
          </div>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible md:pb-0">
          {NAV.map(({ to, label, icon: Icon, ...rest }) => (
            <NavLink
              key={to}
              to={to}
              end={'end' in rest ? rest.end : false}
              className={({ isActive }) =>
                cn('flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors', isActive ? 'bg-[#B7B09E] text-[#302d26]' : 'text-[#514b40] hover:bg-[#CFC6B1]')
              }
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main id="main" className="min-w-0 flex-1 px-4 py-5 md:px-8" tabIndex={-1}>
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
