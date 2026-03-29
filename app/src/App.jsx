import React, { useMemo, useState } from 'react';
import { renderMarkdown } from './lib/renderMarkdown';

const SAMPLE_THREAD = `Sam: We said Friday launch, but legal still hasn't approved the data-sharing language.
Rita: I can push the landing page today if we remove the customer logos.
Jules: Wait, growth already scheduled the email for tomorrow morning.
Sam: I thought Priya owned legal review?
Priya: I own product copy, not legal. I flagged this on Tuesday.
Rita: Also the pricing screenshot is stale.
Jules: If we miss tomorrow, the partner webinar deck is wrong too.
Sam: We need one person to decide whether we ship a reduced scope or delay everything.`;

function App() {
  const [thread, setThread] = useState(SAMPLE_THREAD);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState(null);

  const suggestedReplyHtml = useMemo(() => {
    if (!analysis?.suggestedReplyMarkdown) return '';
    return renderMarkdown(analysis.suggestedReplyMarkdown);
  }, [analysis]);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Analysis failed.');
      }

      setAnalysis(payload.result);
    } catch (submitError) {
      setError(submitError.message || 'Unexpected error.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell">
      <header className="hero">
        <div>
          <span className="eyebrow">AI decision triage for messy chats</span>
          <h1>Thread Surgeon</h1>
          <p>
            Paste a chaotic team thread. Get the real decisions, contradictions, missing owners,
            urgency, and a ready-to-send reply that can actually unblock the room.
          </p>
        </div>
        <div className="hero-card">
          <div className="hero-stat">
            <strong>Find the knot</strong>
            <span>Decisions, gaps, contradictions, owners.</span>
          </div>
          <div className="hero-stat">
            <strong>Cut the noise</strong>
            <span>One concise reply you can paste back into Slack, Telegram, or email.</span>
          </div>
        </div>
      </header>

      <main className="layout">
        <section className="panel input-panel">
          <div className="panel-header">
            <h2>Paste thread</h2>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setThread(SAMPLE_THREAD)}
            >
              Load sample
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <textarea
              value={thread}
              onChange={(event) => setThread(event.target.value)}
              placeholder="Paste a noisy thread here…"
              rows={18}
            />
            <div className="actions">
              <button type="submit" disabled={loading}>
                {loading ? 'Operating…' : 'Operate'}
              </button>
              <span className="helper-text">Uses a real OpenRouter model from env.</span>
            </div>
          </form>

          {error ? <div className="error-banner">{error}</div> : null}
        </section>

        <section className="panel results-panel">
          <div className="panel-header">
            <h2>Decision brief</h2>
            {analysis ? (
              <div className={`heat-pill heat-${analysis.urgencyLabel.toLowerCase()}`}>
                {analysis.urgencyLabel} · Heat {analysis.heatScore}
              </div>
            ) : null}
          </div>

          {!analysis ? (
            <div className="empty-state">
              Run the surgeon to turn a messy thread into an action-ready brief.
            </div>
          ) : (
            <div className="results-stack">
              <article className="summary-card accent-card">
                <h3>Summary</h3>
                <p>{analysis.summary}</p>
              </article>

              <div className="grid two-up">
                <InfoList
                  title="Decisions"
                  items={analysis.decisions}
                  renderItem={(item) => (
                    <>
                      <strong>{item.title}</strong>
                      {item.detail ? <p>{item.detail}</p> : null}
                      <span className="meta">Confidence: {item.confidence}</span>
                    </>
                  )}
                />
                <InfoList
                  title="Unresolved questions"
                  items={analysis.unresolvedQuestions}
                  renderItem={(item) => (
                    <>
                      <strong>{item.question}</strong>
                      {item.whyItMatters ? <p>{item.whyItMatters}</p> : null}
                    </>
                  )}
                />
                <InfoList
                  title="Contradictions"
                  items={analysis.contradictions}
                  renderItem={(item) => (
                    <>
                      <strong>{item.topic}</strong>
                      <p>
                        <span className="meta-label">A:</span> {item.sideA}
                      </p>
                      <p>
                        <span className="meta-label">B:</span> {item.sideB}
                      </p>
                      {item.risk ? <p>{item.risk}</p> : null}
                    </>
                  )}
                />
                <InfoList
                  title="Owners and gaps"
                  items={[
                    ...analysis.owners.map((owner) => ({
                      type: 'owner',
                      owner,
                    })),
                    ...analysis.missingOwners.map((missing) => ({
                      type: 'missing',
                      missing,
                    })),
                  ]}
                  renderItem={(item) =>
                    item.type === 'owner' ? (
                      <>
                        <strong>{item.owner.owner}</strong>
                        <p>{item.owner.responsibility}</p>
                        <span className="meta">Status: {item.owner.status}</span>
                      </>
                    ) : (
                      <>
                        <strong>Missing owner</strong>
                        <p>{item.missing.responsibility}</p>
                        <span className="meta">{item.missing.impact}</span>
                      </>
                    )
                  }
                />
              </div>

              <article className="info-card risks-card">
                <h3>Risks</h3>
                {analysis.risks?.length ? (
                  <ul className="bullet-list">
                    {analysis.risks.map((risk) => (
                      <li key={risk}>{risk}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No major risks surfaced from the thread.</p>
                )}
              </article>

              <article className="info-card reply-card">
                <div className="reply-header">
                  <h3>Suggested reply</h3>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => navigator.clipboard.writeText(analysis.suggestedReplyMarkdown)}
                  >
                    Copy reply
                  </button>
                </div>
                <div
                  className="markdown-body"
                  dangerouslySetInnerHTML={{ __html: suggestedReplyHtml }}
                />
              </article>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function InfoList({ title, items, renderItem }) {
  return (
    <article className="info-card">
      <h3>{title}</h3>
      {items?.length ? (
        <ul className="card-list">
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{renderItem(item)}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-copy">Nothing obvious surfaced here.</p>
      )}
    </article>
  );
}

export default App;
