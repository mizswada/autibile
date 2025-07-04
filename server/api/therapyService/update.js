import { promises as fs } from 'fs'
import path from 'path'

const DB_PATH = path.resolve(process.cwd(), 'data', 'service.json')

export default defineEventHandler(async (event) => {
  if (event.method !== 'PUT') {
    return { status: 405, message: 'Method Not Allowed' }
  }
  const id = getQuery(event).id // <-- FIXED
  if (!id) {
    return { status: 400, message: 'ID is required' }
  }
  const body = await readBody(event)
  let services = []
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8')
    services = JSON.parse(data)
  } catch {
    return { status: 404, message: 'Service not found' }
  }
  const idx = services.findIndex(s => s.id === id)
  if (idx === -1) {
    return { status: 404, message: 'Service not found' }
  }
  services[idx] = { ...services[idx], ...body }
  await fs.writeFile(DB_PATH, JSON.stringify(services, null, 2))
  return { status: 200, data: services[idx] }
})
