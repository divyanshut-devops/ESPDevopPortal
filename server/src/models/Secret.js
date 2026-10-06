import mongoose from 'mongoose'

const secretSchema = new mongoose.Schema(
  {
    ownerEmail: { type: String, required: true, index: true, lowercase: true },
    name: { type: String, required: true },
    valueEncrypted: { type: String, required: true },
  },
  { timestamps: true },
)

export const Secret = mongoose.models.Secret || mongoose.model('Secret', secretSchema)
