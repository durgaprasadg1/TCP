import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ExamplesProvider } from '../hooks/useExamples';
import ComparisonLab from '../pages/ComparisonLab';
import MachineBuilder from '../pages/MachineBuilder';
import Overview from '../pages/Overview';
import PdaLab from '../pages/PdaLab';
import TestRunner from '../pages/TestRunner';
import TmLab from '../pages/TmLab';
import Layout from './Layout';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }
  override render() {
    if (this.state.error) {
      return (
        <div role="alert" className="m-6 rounded-lg border border-bad/40 bg-bad/10 p-4 text-bad">
          <p className="font-semibold">Something went wrong while rendering this page.</p>
          <p className="mt-1 text-sm">{this.state.error.message}</p>
          <button className="btn mt-3" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <ExamplesProvider>
        <ErrorBoundary>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Overview />} />
              <Route path="pda" element={<PdaLab />} />
              <Route path="tm" element={<TmLab />} />
              <Route path="builder" element={<MachineBuilder />} />
              <Route path="compare" element={<ComparisonLab />} />
              <Route path="tests" element={<TestRunner />} />
              <Route
                path="*"
                element={
                  <div className="py-10 text-center">
                    <h1 className="text-lg font-semibold text-white">Page not found</h1>
                    <p className="mt-1 text-sm text-slate-400">Use the navigation to pick a laboratory.</p>
                  </div>
                }
              />
            </Route>
          </Routes>
        </ErrorBoundary>
      </ExamplesProvider>
    </BrowserRouter>
  );
}
