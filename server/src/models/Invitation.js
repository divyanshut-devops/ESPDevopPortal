import mongoose from 'mongoose'

const invitationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    role: { type: String, required: true, enum: ['Viewer', 'Developer', 'DevOps', 'Admin'] },
    status: { type: String, default: 'pending', enum: ['pending', 'accepted'] },
    invitedBy: { type: String, required: true, lowercase: true },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

export const Invitation = mongoose.models.Invitation || mongoose.model('Invitation', invitationSchema)
