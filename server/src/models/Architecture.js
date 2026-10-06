import mongoose from 'mongoose'

const architectureSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'workspace' },
    title: { type: String, default: 'System architecture' },
    nodes: { type: Array, default: [] },
    edges: { type: Array, default: [] },
    strokes: { type: Array, default: [] },
    notes: { type: Array, default: [] },
  },
  { timestamps: true },
)

export const Architecture = mongoose.models.Architecture || mongoose.model('Architecture', architectureSchema)
