import mongoose from 'mongoose'

const workbookSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'workspace' },
    activeId: { type: String, default: 'inventory' },
    sheets: { type: Array, default: [] },
  },
  { timestamps: true },
)

export const Workbook = mongoose.models.Workbook || mongoose.model('Workbook', workbookSchema)
