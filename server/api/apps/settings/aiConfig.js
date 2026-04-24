import CryptoJS from 'crypto-js'

export default defineEventHandler(async (event) => {
  const { user } = event.context
  if (!user) {
    return {
      statusCode: 401,
      message: 'Unauthorized'
    }
  }

  if (event.node.req.method === 'GET') {
    return handleGet()
  } else if (event.node.req.method === 'POST') {
    const body = await readBody(event)
    return handlePost(body)
  }

  return {
    statusCode: 405,
    message: 'Method not allowed'
  }
})

async function handleGet() {
  try {
    const settings = await prisma.app_settings.findMany({
      where: {
        setting_key: {
          startsWith: 'AI_'
        }
      }
    })

    const config = {}
    settings.forEach(s => {
      if (s.setting_key === 'AI_API_KEY') {
        config[s.setting_key] = s.setting_value ? '***SET***' : null
      } else {
        config[s.setting_key] = s.setting_value
      }
    })

    return {
      statusCode: 200,
      data: {
        enabled: config.AI_ENABLED === 'true',
        provider: config.AI_PROVIDER || 'openai',
        apiUrl: config.AI_API_URL || '',
        apiKey: config.AI_API_KEY || null,
        model: config.AI_MODEL || 'gpt-4o-mini',
        promptTemplate: config.AI_PROMPT_TEMPLATE || '',
        timeoutMs: parseInt(config.AI_TIMEOUT_MS || '15000')
      }
    }
  } catch (error) {
    console.error('Error fetching AI settings:', error)
    return {
      statusCode: 500,
      message: 'Internal server error'
    }
  }
}

async function handlePost(body) {
  try {
    const { enabled, provider, apiUrl, apiKey, model, promptTemplate, timeoutMs } = body
    const config = useRuntimeConfig()
    const encryptionKey = config.settingsEncryptionKey

    if (!encryptionKey) {
      return {
        statusCode: 500,
        message: 'Encryption key not configured'
      }
    }

    const updates = []

    if (enabled !== undefined) {
      updates.push(
        prisma.app_settings.upsert({
          where: { setting_key: 'AI_ENABLED' },
          create: { setting_key: 'AI_ENABLED', setting_value: String(enabled), created_at: new Date() },
          update: { setting_value: String(enabled), updated_at: new Date() }
        })
      )
    }

    if (provider !== undefined) {
      updates.push(
        prisma.app_settings.upsert({
          where: { setting_key: 'AI_PROVIDER' },
          create: { setting_key: 'AI_PROVIDER', setting_value: provider, created_at: new Date() },
          update: { setting_value: provider, updated_at: new Date() }
        })
      )
    }

    if (apiUrl !== undefined) {
      updates.push(
        prisma.app_settings.upsert({
          where: { setting_key: 'AI_API_URL' },
          create: { setting_key: 'AI_API_URL', setting_value: apiUrl, created_at: new Date() },
          update: { setting_value: apiUrl, updated_at: new Date() }
        })
      )
    }

    if (apiKey !== undefined && apiKey !== '***SET***') {
      const encrypted = CryptoJS.AES.encrypt(apiKey, encryptionKey).toString()
      updates.push(
        prisma.app_settings.upsert({
          where: { setting_key: 'AI_API_KEY' },
          create: { setting_key: 'AI_API_KEY', setting_value: encrypted, created_at: new Date() },
          update: { setting_value: encrypted, updated_at: new Date() }
        })
      )
    }

    if (model !== undefined) {
      const modelValue = typeof model === 'string' ? model.trim() : String(model)
      updates.push(
        prisma.app_settings.upsert({
          where: { setting_key: 'AI_MODEL' },
          create: { setting_key: 'AI_MODEL', setting_value: modelValue, created_at: new Date() },
          update: { setting_value: modelValue, updated_at: new Date() }
        })
      )
    }

    if (promptTemplate !== undefined) {
      updates.push(
        prisma.app_settings.upsert({
          where: { setting_key: 'AI_PROMPT_TEMPLATE' },
          create: { setting_key: 'AI_PROMPT_TEMPLATE', setting_value: promptTemplate, created_at: new Date() },
          update: { setting_value: promptTemplate, updated_at: new Date() }
        })
      )
    }

    if (timeoutMs !== undefined) {
      updates.push(
        prisma.app_settings.upsert({
          where: { setting_key: 'AI_TIMEOUT_MS' },
          create: { setting_key: 'AI_TIMEOUT_MS', setting_value: String(timeoutMs), created_at: new Date() },
          update: { setting_value: String(timeoutMs), updated_at: new Date() }
        })
      )
    }

    await Promise.all(updates)

    return {
      statusCode: 200,
      message: 'AI settings updated successfully'
    }
  } catch (error) {
    console.error('Error updating AI settings:', error)
    return {
      statusCode: 500,
      message: 'Internal server error'
    }
  }
}
