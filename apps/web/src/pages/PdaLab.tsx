import { MachinePicker } from '../components/MachinePicker';
import { EmptyState, ErrorBanner, PageHeader, Spinner, Term } from '../components/ui';
import { PdaWorkspace } from '../features/pda/PdaWorkspace';
import { useLabMachine } from '../hooks/useLabMachine';

export default function PdaLab() {
  const lab = useLabMachine('PDA');
  const def = lab.definition;
  return (
    <div>
      <PageHeader
        title="PDA Laboratory"
        subtitle={
          <>
            A <Term k="pda">pushdown automaton</Term> reads the input once while pushing and popping a stack. The machine below runs on the API's
            nondeterministic engine; every <Term k="configuration">configuration</Term> shown is a real engine configuration.
          </>
        }
      />
      {lab.loading && <Spinner label="Loading machines from the API…" />}
      {lab.error && <ErrorBanner message={lab.error} onRetry={lab.reload} />}
      {!lab.loading && !lab.error && !def && <EmptyState title="No machine selected">Pick a machine above, or build one in the Machine Builder.</EmptyState>}
      {def && (
        <div className="space-y-4">
          <MachinePicker
            lab={lab}
            facts={
              <>
                {def.states.length} states · {def.transitions.length} transitions · accepts by{' '}
                <Term k={def.acceptanceMode === 'FINAL_STATE' ? 'finalState' : 'emptyStack'}>{def.acceptanceMode === 'FINAL_STATE' ? 'final state' : 'empty stack'}</Term> · stack pushes are written top first, initial stack symbol{' '}
                <code>{def.initialStackSymbol}</code>
              </>
            }
          />
          <PdaWorkspace key={lab.selected} definition={def} input={lab.input} onInputChange={lab.setInput} autoRunKey={lab.autoRunKey} />
        </div>
      )}
    </div>
  );
}
