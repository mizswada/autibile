import { promises as fs } from 'fs'
import path from 'path'
import prisma from "@@/server/config/prisma-client"


export default defineEventHandler(async (event) => {
  if (event.method !== 'GET') {
    return { status: 405, message: 'Method Not Allowed' }
  }
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8')
    const services = JSON.parse(data)
    return services
  } catch {
    return []
  }
})
