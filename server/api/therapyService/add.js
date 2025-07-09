import { promises as fs } from 'fs'
//import path from 'path'
//import prisma from "@@/server/config/prisma-client"

export default defineEventHandler(async (event) => {
  if (event.method !== 'POST') {
    return { status: 405, message: 'Method Not Allowed' }
  }
  const body = await readBody(event)
  if (!body.name) {
    return { status: 400, message: 'Name is required' }
  }
  let services = []
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8')
    services = JSON.parse(data)
  } catch {
    services = []
  }
  const newService = {
    id: Date.now().toString(),
    name: body.name,
    description: body.description || ''
  }
  services.push(newService)
  await fs.writeFile(DB_PATH, JSON.stringify(services, null, 2))
  return { status: 201, data: newService }
})
