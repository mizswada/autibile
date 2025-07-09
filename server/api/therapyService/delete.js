import { promises as fs } from 'fs'
//import path from 'path'
//import prisma from "@@/server/config/prisma-client"

export default defineEventHandler(async (event) => {
  if (event.method !== 'DELETE') {
    return { status: 405, message: 'Method Not Allowed' }
  }
  const id = event.context.params?.id
  if (!id) {
    return { status: 400, message: 'ID is required' }
  }
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
  const deleted = services.splice(idx, 1)
  await fs.writeFile(DB_PATH, JSON.stringify(services, null, 2))
  return { status: 200, data: deleted[0] }
})
