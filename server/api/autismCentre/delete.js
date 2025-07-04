export default defineEventHandler(async (event) => {
  if (event.method !== 'DELETE') {
    return { status: 405, message: 'Method Not Allowed' }
  }
  const id = getQuery(event).id
  if (!id) {
    return { status: 400, message: 'ID is required' }
  }
  try {
    const deleted = await prisma.therapyst_center.delete({
      where: { center_id: parseInt(id) }
    })
    return { status: 200, data: deleted }
  } catch (e) {
    return { status: 404, message: 'Centre not found' }
  }
})
  
  const idx = centres.findIndex(c => c.id === id)
  if (idx === -1) {
    return { status: 404, message: 'Centre not found' }
  }
  const deleted = centres.splice(idx, 1)
  await fs.writeFile(DB_PATH, JSON.stringify(centres, null, 2))
  return { status: 200, data: deleted[0] }

