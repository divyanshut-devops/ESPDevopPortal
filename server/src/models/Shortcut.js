import mongoose from 'mongoose'

const shortcutSchema = new mongoose.Schema(
  {
    ownerEmail: { type: String, required: true, index: true, lowercase: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    category: { type: String, default: 'Work' },
    url: { type: String, required: true },
    icon: { type: String, default: 'bi-link-45deg' },
  },
  { timestamps: true },
)

export const Shortcut = mongoose.models.Shortcut || mongoose.model('Shortcut', shortcutSchema)
