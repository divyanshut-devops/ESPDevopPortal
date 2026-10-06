import mongoose from 'mongoose'

const documentSchema = new mongoose.Schema(
  {
    ownerEmail: { type: String, required: true, index: true, lowercase: true },
    title: { type: String, default: 'Untitled' },
    html: { type: String, default: '' },
    preview: { type: String, default: '' },
    font: { type: String, default: 'IBM Plex Sans' },
    size: { type: String, default: '14' },
    kind: { type: String, default: 'file', enum: ['file', 'folder'] },
    parentId: { type: String, default: null, index: true },
  },
  { timestamps: true },
)

export const DocNote = mongoose.models.DocNote || mongoose.model('DocNote', documentSchema)
