import { MachinePicker } from '../components/MachinePicker';
import { EmptyState, ErrorBanner, PageHeader, Spinner, Term } from '../components/ui';
import { TmWorkspace } from '../features/turing-machine/TmWorkspace';
import { useLabMachine } from '../hooks/useLabMachine';

export default function TmLab() {
  const lab = useLabMachine('TM');
  const def = lab.definition;
  return (
    <div>
      <PageHeader
        title="Turing Machine Laboratory"
        subtitle={
          <>
            A deterministic <Term k="tm">Turing machine</Term> rewrites a tape one cell at a time. Missing transitions are an{' '}
            <Term k="implicitReject">implicit reject</Term>; a step limit gives <Term k="inconclusive">INCONCLUSIVE</Term>, never a guess.
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
                {def.states.length} states · {def.transitions.length} transitions · tape alphabet {'{'}
                {def.tapeAlphabet.join(', ')}
                {'}'} · blank <code>{def.blank}</code> · {def.tapeModel === 'LEFT_BOUNDED' ? 'left-bounded tape' : 'two-way infinite tape'}
              </>
            }
          />
          <TmWorkspace key={lab.selected} definition={def} input={lab.input} onInputChange={lab.setInput} autoRunKey={lab.autoRunKey} />
        </div>
      )}
    </div>
  );
}
