export const GENERATOR_KINDS = {
  bash: { label: 'Bash script', filename: 'script.sh', language: 'bash' },
  powershell: { label: 'PowerShell', filename: 'script.ps1', language: 'powershell' },
  command: { label: 'Shell command', filename: 'commands.sh', language: 'bash' },
  dockerfile: { label: 'Dockerfile', filename: 'Dockerfile', language: 'dockerfile' },
  compose: { label: 'Docker Compose', filename: 'docker-compose.yml', language: 'yaml' },
  kubernetes: { label: 'Kubernetes', filename: 'deployment.yaml', language: 'yaml' },
  helm: { label: 'Helm values', filename: 'values.yaml', language: 'yaml' },
  github: { label: 'GitHub Actions', filename: 'workflow.yml', language: 'yaml' },
  terraform: { label: 'Terraform', filename: 'main.tf', language: 'hcl' },
  nginx: { label: 'Nginx', filename: 'nginx.conf', language: 'nginx' },
  makefile: { label: 'Makefile', filename: 'Makefile', language: 'makefile' },
  python: { label: 'Python script', filename: 'script.py', language: 'python' },
  node: { label: 'Node script', filename: 'script.js', language: 'javascript' },
}

function parseArtifact(text, fallback) {
  const trimmed = String(text || '').trim()
  const jsonFence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = jsonFence ? jsonFence[1].trim() : trimmed
  try {
    const parsed = JSON.parse(candidate)
    if (parsed && typeof parsed.content === 'string') {
      return {
        filename: String(parsed.filename || fallback.filename),
        language: String(parsed.language || fallback.language),
        content: parsed.content,
        notes: String(parsed.notes || ''),
      }
    }
  } catch {
    /* fall through */
  }
  const codeFence = trimmed.match(/```[\w-]*\n([\s\S]*?)```/)
  return {
    filename: fallback.filename,
    language: fallback.language,
    content: codeFence ? codeFence[1].trimEnd() : trimmed,
    notes: '',
  }
}

export function isOpenRouterConfigured() {
  const key = process.env.OPENROUTER_API_KEY?.trim()
  return Boolean(key && !key.includes('your-openrouter'))
}

export function resolveOpenRouterModel() {
  const configured = process.env.OPENROUTER_MODEL?.trim() || 'openrouter/free'
  if (configured === 'openrouter/free' || configured.endsWith(':free')) return configured
  return 'openrouter/free'
}

export async function generateDevArtifact(kind, prompt) {
  if (!isOpenRouterConfigured()) {
    const error = new Error('OpenRouter is not configured. Add OPENROUTER_API_KEY in .env')
    error.status = 503
    throw error
  }
  const spec = GENERATOR_KINDS[kind] || GENERATOR_KINDS.bash
  const model = resolveOpenRouterModel()
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY.trim()}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
      'X-Title': 'ESP DevOps Portal',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are a senior DevOps engineer generating production-ready files. Return ONLY valid JSON with keys filename, language, content, notes. content must be the full file. Do not wrap JSON in markdown.',
        },
        {
          role: 'user',
          content: `Generate a ${spec.label} (${spec.filename}). Request:\n${prompt}\n\nReturn JSON: {"filename":"${spec.filename}","language":"${spec.language}","content":"...","notes":"one short usage note"}`,
        },
      ],
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data?.error?.message || data?.message || 'OpenRouter request failed'
    const error = new Error(message)
    error.status = response.status === 401 ? 503 : 400
    throw error
  }
  const text = data?.choices?.[0]?.message?.content || ''
  return {
    kind: GENERATOR_KINDS[kind] ? kind : 'bash',
    ...parseArtifact(text, spec),
  }
}
