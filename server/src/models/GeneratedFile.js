import mongoose from 'mongoose'

const generatedFileSchema = new mongoose.Schema(
  {
    ownerEmail: { type: String, required: true, index: true, lowercase: true },
    kind: { type: String, required: true },
    filename: { type: String, required: true },
    language: { type: String, default: 'text' },
    content: { type: String, required: true },
    notes: { type: String, default: '' },
    prompt: { type: String, default: '' },
  },
  { timestamps: true },
)

export const GeneratedFile = mongoose.models.GeneratedFile || mongoose.model('GeneratedFile', generatedFileSchema)
