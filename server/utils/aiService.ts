import CryptoJS from 'crypto-js'

interface AIRequest {
  questionnaireName: string
  totalScore: number
  scoreMin: number
  scoreMax: number
  thresholdInterpretation: string | null
  answers: Array<{ question: string; answer: string }>
  isMchatr?: boolean
}

interface AIResponse {
  result: string
  explanation: string
}

interface AIConfig {
  enabled: boolean
  provider: string
  apiUrl: string
  apiKey: string
  model: string
  promptTemplate: string
  timeoutMs: number
}

const DEFAULT_PROMPT_TEMPLATE = `You are a clinical screening assistant for developmental and behavioral assessments. Analyze the following questionnaire results and provide an AI-generated prediction and recommendation.

Questionnaire: {{questionnaireName}}
Total Score: {{totalScore}} (Range: {{scoreMin}}-{{scoreMax}})
Rule-Based Clinical Threshold: {{threshold}}

Patient Answers Summary:
{{answers}}

Based on the answers and scoring pattern, generate:
1. A clinical PREDICTION (result): A brief assessment label indicating the clinical significance (e.g., 'Good', 'Needs More Attention', 'Requires Evaluation', 'High Priority')
2. A clinical RECOMMENDATION (explanation): A 2-3 sentence explanation of key contributing factors, patterns in responses, and the clinical implications

Respond ONLY with valid JSON in this exact format:
{"result": "<clinical prediction/assessment label>", "explanation": "<clinical recommendation explaining contributing factors and next steps>"}
`

type LoadConfigOutcome =
  | { ok: true, config: AIConfig }
  | { ok: false, message: string }

async function loadAIConfig(): Promise<LoadConfigOutcome> {
  try {
    const settings = await prisma.app_settings.findMany({
      where: {
        setting_key: {
          startsWith: 'AI_'
        }
      }
    })

    const config: Record<string, string> = {}
    settings.forEach(s => {
      config[s.setting_key] = s.setting_value
    })

    const enabled = config.AI_ENABLED === 'true'
    if (!enabled) {
      return { ok: false, message: 'AI analysis is disabled. Enable it on this page, save, then test again.' }
    }

    const provider = config.AI_PROVIDER || 'openai'
    const apiUrl = config.AI_API_URL?.trim() || ''
    const encryptedKey = config.AI_API_KEY
    const model = config.AI_MODEL || 'gpt-4o-mini'
    const promptTemplate = config.AI_PROMPT_TEMPLATE || DEFAULT_PROMPT_TEMPLATE
    const timeoutMs = parseInt(config.AI_TIMEOUT_MS || '15000')

    if (!apiUrl) {
      return { ok: false, message: 'API URL is not set. Choose a provider or enter a URL, then save.' }
    }
    if (encryptedKey == null || String(encryptedKey).trim() === '') {
      return { ok: false, message: 'API key is not set. Enter your key and save.' }
    }

    // Decrypt the API key
    let apiKey: string
    try {
      const runtimeConfig = useRuntimeConfig()
      const encryptionKey = runtimeConfig.settingsEncryptionKey
      if (!encryptionKey) {
        return { ok: false, message: 'Server env SETTINGS_ENCRYPTION_KEY (Nuxt runtime `settingsEncryptionKey`) is not set, so the API key cannot be used.' }
      }
      const decrypted = CryptoJS.AES.decrypt(encryptedKey, encryptionKey).toString(CryptoJS.enc.Utf8)
      apiKey = decrypted
    } catch (decryptError) {
      console.error('Failed to decrypt API key:', decryptError)
      return { ok: false, message: 'Could not decrypt the stored API key. Re-enter the key and save, or fix SETTINGS_ENCRYPTION_KEY to match the key used when encrypting.' }
    }

    if (!apiKey.trim()) {
      return { ok: false, message: 'API key appears empty after decrypt. Re-enter a valid key and save.' }
    }

    return {
      ok: true,
      config: {
        enabled,
        provider,
        apiUrl,
        apiKey,
        model,
        promptTemplate,
        timeoutMs
      }
    }
  } catch (error) {
    console.error('Error loading AI config:', error)
    return { ok: false, message: error instanceof Error ? error.message : 'Failed to load AI settings from the database.' }
  }
}

/** ofetch/undici often set Error.message to a generic "Provider returned error" while the real text is on .data or .response._data */
const GENERIC_FETCH_MARKERS = /^(Provider returned error|Request failed|FetchError)$/i

function tryProviderBodyMessage (body: unknown): string | null {
  if (body == null) return null
  if (typeof body === 'string') {
    const t = body.trim()
    if (!t) return null
    if (t.startsWith('{') || t.startsWith('[')) {
      try {
        return tryProviderBodyMessage(JSON.parse(t))
      } catch {
        return t.length > 500 ? t.slice(0, 500) + '…' : t
      }
    }
    return t.length > 500 ? t.slice(0, 500) + '…' : t
  }
  if (typeof body !== 'object' || body === null) return null
  const o = body as Record<string, unknown>

  if (typeof o.error === 'string' && o.error) return o.error
  if (o.error && typeof o.error === 'object' && o.error !== null) {
    const inner = o.error as Record<string, unknown>
    if (typeof inner.message === 'string' && inner.message) return inner.message
  }
  if (o.type === 'error' && o.error) {
    return tryProviderBodyMessage(o.error)
  }
  if (typeof o.message === 'string' && o.message) return o.message
  if (typeof o.detail === 'string' && o.detail) return o.detail
  if (Array.isArray(o.errors) && o.errors.length) {
    const first = o.errors[0] as unknown
    const nested = tryProviderBodyMessage(first)
    if (nested) return nested
  }
  return null
}

function getHttpBits (e: Record<string, unknown>): { code?: number, text?: string } {
  const code = typeof e.statusCode === 'number' ? e.statusCode : (typeof e.status === 'number' ? e.status : undefined)
  const st = e.statusText
  const text = typeof st === 'string' ? st : undefined
  return { code, text }
}

function messageFromUnknownError (error: unknown, fallback: string): string {
  if (error == null) return fallback

  const tryObject = (obj: object): string | null => {
    const e = obj as Record<string, unknown>
    for (const data of [e.data, (e.response as { _data?: unknown } | undefined)?._data]) {
      if (data === undefined) continue
      const m = tryProviderBodyMessage(data)
      if (m) {
        const { code, text } = getHttpBits(e)
        if (code != null && code >= 400) {
          return `${m} (HTTP ${code}${text && text !== 'Error' ? ` ${text}` : ''})`
        }
        return m
      }
    }
    if (typeof e.statusMessage === 'string' && e.statusMessage && !GENERIC_FETCH_MARKERS.test(e.statusMessage)) {
      return e.statusMessage
    }
    if (e.cause != null) {
      if (typeof e.cause === 'object' && e.cause !== null) {
        const inner = tryObject(e.cause)
        if (inner) return inner
      }
    }
    if (e instanceof Error && e.message && !GENERIC_FETCH_MARKERS.test(e.message) && !/^fetch failed/i.test(e.message)) {
      return e.message
    }
    return null
  }

  if (typeof error === 'object' && error !== null) {
    const m = tryObject(error)
    if (m != null && m !== '') return m
  }

  if (error instanceof Error) {
    if (GENERIC_FETCH_MARKERS.test(error.message) || /^fetch failed/i.test(error.message)) return fallback
    return error.message
  }
  return String(error)
}

function buildPrompt(template: string, request: AIRequest): string {
  const answersText = request.answers
    .map(a => `Q: ${a.question}\nA: ${a.answer}`)
    .join('\n\n')

  const filledPrompt = template
    .replace(/{{questionnaireName}}/g, request.questionnaireName)
    .replace(/{{totalScore}}/g, String(request.totalScore))
    .replace(/{{scoreMin}}/g, String(request.scoreMin))
    .replace(/{{scoreMax}}/g, String(request.scoreMax))
    .replace(/{{threshold}}/g, request.thresholdInterpretation || 'N/A')
    .replace(/{{answers}}/g, answersText)

  console.log('📋 Full prompt with replacements:\n', filledPrompt)
  return filledPrompt
}

function isOpenRouterApi (url: string): boolean {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase().endsWith('openrouter.ai')
  } catch {
    return /openrouter\.ai/i.test(url)
  }
}

/** OpenAI json_object mode is not supported for many OpenRouter (and other proxy) models and returns 400. */
function useOpenAIJsonObjectMode (config: AIConfig): boolean {
  if (isOpenRouterApi(config.apiUrl)) return false
  return true
}

function parseModelJsonResponse (raw: string): AIResponse {
  const content = raw.trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    const block = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (block) {
      try {
        parsed = JSON.parse(block[1].trim())
      } catch { /* */ }
    }
    if (parsed == null) {
      const start = content.indexOf('{')
      const end = content.lastIndexOf('}')
      if (start >= 0 && end > start) {
        try {
          parsed = JSON.parse(content.slice(start, end + 1))
        } catch { /* */ }
      }
    }
  }
  if (parsed == null || typeof parsed !== 'object' || parsed === null) {
    throw new Error('Model did not return valid JSON (expected result and explanation fields).')
  }
  const o = parsed as Record<string, unknown>
  return {
    result: typeof o.result === 'string' ? o.result : 'Unable to determine',
    explanation: typeof o.explanation === 'string' ? o.explanation : ''
  }
}

async function callOpenAI (config: AIConfig, prompt: string): Promise<AIResponse> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  }
  if (useOpenAIJsonObjectMode(config)) {
    body.response_format = { type: 'json_object' }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json'
  }
  if (isOpenRouterApi(config.apiUrl)) {
    // https://openrouter.ai/docs#headers
    headers.Referer = 'http://localhost:3000'
    headers['X-Title'] = 'Autibile'
  }

  const response = await $fetch(config.apiUrl, {
    method: 'POST',
    headers,
    body,
    timeout: config.timeoutMs
  })

  const content = response.choices?.[0]?.message?.content
  if (!content) throw new Error('No content in OpenAI response')

  return parseModelJsonResponse(typeof content === 'string' ? content : String(content))
}

async function callAnthropic(config: AIConfig, prompt: string): Promise<AIResponse> {
  const response = await $fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: {
      model: config.model,
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    },
    timeout: config.timeoutMs
  })

  const content = response.content?.[0]?.text
  if (!content) throw new Error('No content in Anthropic response')

  const parsed = JSON.parse(content)
  return {
    result: parsed.result || 'Unable to determine',
    explanation: parsed.explanation || ''
  }
}

async function callLocal(config: AIConfig, prompt: string): Promise<AIResponse> {
  const response = await $fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: {
      model: config.model,
      prompt: prompt,
      format: 'json',
      stream: false
    },
    timeout: config.timeoutMs
  })

  const responseText = typeof response === 'string' ? response : response.response
  if (!responseText) throw new Error('No response from local AI')

  const parsed = JSON.parse(responseText)
  return {
    result: parsed.result || 'Unable to determine',
    explanation: parsed.explanation || ''
  }
}

export type AIAnalysisResult =
  | { ok: true, data: AIResponse }
  | { ok: false, message: string }

export async function getAIAnalysisResult (request: AIRequest): Promise<AIAnalysisResult> {
  const loaded = await loadAIConfig()
  if (!loaded.ok) {
    console.warn('🔴 AI config error:', loaded.message)
    return { ok: false, message: loaded.message }
  }

  const { config } = loaded

  try {
    console.log(`✅ AI config loaded. Provider: ${config.provider}, Model: ${config.model}`)
    const prompt = buildPrompt(config.promptTemplate, request)
    console.log(`📝 Prompt built. Length: ${prompt.length} chars`)
    console.log(`📋 Prompt preview:\n${prompt.substring(0, 200)}...`)

    let response: AIResponse
    switch (config.provider.toLowerCase()) {
      case 'openai':
      case 'custom':
        console.log(`🚀 Calling ${config.provider} at ${config.apiUrl} with model ${config.model}`)
        response = await callOpenAI(config, prompt)
        break
      case 'anthropic':
        console.log(`🚀 Calling Anthropic at ${config.apiUrl} with model ${config.model}`)
        response = await callAnthropic(config, prompt)
        break
      case 'local':
        console.log(`🚀 Calling local AI at ${config.apiUrl} with model ${config.model}`)
        response = await callLocal(config, prompt)
        break
      default:
        return { ok: false, message: `Unknown AI provider "${config.provider}". Use openai, anthropic, local, or custom.` }
    }

    console.log('✅ AI response received:', {
      result: response.result,
      explanationLength: response.explanation.length
    })
    return { ok: true, data: response }
  } catch (error) {
    const msg = messageFromUnknownError(error, 'The AI provider request failed.')
    console.error('❌ AI analysis failed:', msg)
    if (error instanceof Error) {
      console.error('Error details:', error.message)
      console.error('Stack:', error.stack)
    }
    return { ok: false, message: msg }
  }
}

export async function getAIAnalysis (request: AIRequest): Promise<AIResponse | null> {
  const r = await getAIAnalysisResult(request)
  if (r.ok) {
    return r.data
  } else {
    // For debugging: log the error so we know why AI analysis failed
    console.error('[AI] Analysis failed:', r.message)
    return null
  }
}

export async function initializeDefaultAISettings(): Promise<void> {
  try {
    const existing = await prisma.app_settings.findFirst({
      where: { setting_key: 'AI_ENABLED' }
    })

    if (!existing) {
      await prisma.app_settings.create({
        data: {
          setting_key: 'AI_ENABLED',
          setting_value: 'false',
          created_at: new Date()
        }
      })
      await prisma.app_settings.create({
        data: {
          setting_key: 'AI_PROVIDER',
          setting_value: 'openai',
          created_at: new Date()
        }
      })
      await prisma.app_settings.create({
        data: {
          setting_key: 'AI_MODEL',
          setting_value: 'gpt-4o-mini',
          created_at: new Date()
        }
      })
      await prisma.app_settings.create({
        data: {
          setting_key: 'AI_PROMPT_TEMPLATE',
          setting_value: DEFAULT_PROMPT_TEMPLATE,
          created_at: new Date()
        }
      })
      await prisma.app_settings.create({
        data: {
          setting_key: 'AI_TIMEOUT_MS',
          setting_value: '15000',
          created_at: new Date()
        }
      })
    }
  } catch (error) {
    console.error('Error initializing default AI settings:', error)
  }
}
