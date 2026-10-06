import type { ApiRequestItem, HttpMethod, KeyValuePair, MockApiResponse } from '../types'

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

interface APIRequestPanelProps {
  request: ApiRequestItem
  onChange: (request: ApiRequestItem) => void
  onSend: () => void
  response: MockApiResponse | null
  loading: boolean
}

function PairEditor({
  pairs,
  onChange,
}: {
  pairs: KeyValuePair[]
  onChange: (pairs: KeyValuePair[]) => void
}) {
  const update = (index: number, patch: Partial<KeyValuePair>) => {
    onChange(pairs.map((pair, pairIndex) => (pairIndex === index ? { ...pair, ...patch } : pair)))
  }

  return (
    <div>
      {pairs.map((pair, index) => (
        <div className="kv-row" key={`${pair.key}-${index}`}>
          <input
            className="form-control"
            placeholder="Key"
            value={pair.key}
            onChange={(event) => update(index, { key: event.target.value })}
          />
          <input
            className="form-control"
            placeholder="Value"
            value={pair.value}
            onChange={(event) => update(index, { value: event.target.value })}
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onChange(pairs.filter((_, pairIndex) => pairIndex !== index))}
          >
            <i className="bi bi-x" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => onChange([...pairs, { key: '', value: '', enabled: true }])}
      >
        Add row
      </button>
    </div>
  )
}

export function APIRequestPanel({
  request,
  onChange,
  onSend,
  response,
  loading,
}: APIRequestPanelProps) {
  return (
    <div className="panel p-3">
      <div className="d-flex flex-wrap gap-2 mb-3">
        <select
          className="form-select"
          style={{ maxWidth: 130 }}
          value={request.method}
          onChange={(event) => onChange({ ...request, method: event.target.value as HttpMethod })}
        >
          {METHODS.map((method) => (
            <option key={method}>{method}</option>
          ))}
        </select>
        <input
          className="form-control"
          value={request.url}
          onChange={(event) => onChange({ ...request, url: event.target.value })}
        />
        <button type="button" className="btn btn-accent" onClick={onSend} disabled={loading}>
          {loading ? 'Sending…' : 'Send'}
        </button>
      </div>

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button className="nav-link active" type="button">
            Headers
          </button>
        </li>
      </ul>
      <PairEditor
        pairs={request.headers}
        onChange={(headers) => onChange({ ...request, headers })}
      />

      <h6 className="mt-4">Query Parameters</h6>
      <PairEditor
        pairs={request.queryParams}
        onChange={(queryParams) => onChange({ ...request, queryParams })}
      />

      <h6 className="mt-4">Request Body</h6>
      <textarea
        className="form-control font-monospace"
        rows={7}
        value={request.body}
        onChange={(event) => onChange({ ...request, body: event.target.value })}
      />

      <div className="d-flex justify-content-between align-items-center mt-4 mb-2">
        <h6 className="mb-0">Response preview</h6>
        {response ? (
          <div className="d-flex gap-2">
            <span className={`status-badge ${response.status < 400 ? 'status-success' : 'status-error'}`}>
              {response.status}
            </span>
            <span className="text-secondary small">{response.timeMs} ms</span>
          </div>
        ) : null}
      </div>
      <div className="response-preview">
        {loading ? 'Waiting for mock response…' : response?.body ?? 'Send a request to preview a mock response.'}
      </div>
    </div>
  )
}
