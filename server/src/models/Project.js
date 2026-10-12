import mongoose from 'mongoose'

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    githubUrl: { type: String, default: '' },
    githubBranch: { type: String, default: '' },
    env: { type: String, enum: ['dev', 'staging', 'prod'], default: 'dev' },
    techStack: { type: String, default: '' },
    deploymentMethod: { type: String, default: '' },
    domainIp: { type: String, default: '' },
    cicdEnabled: { type: Boolean, default: false },
    cicdTool: { type: String, default: '' },
    cicdUrl: { type: String, default: '' },
    cicdConfig: { type: String, default: '' },
    dockerEnabled: { type: Boolean, default: false },
    dockerImage: { type: String, default: '' },
    dockerfilePath: { type: String, default: '' },
    dockerRegistry: { type: String, default: '' },
    k8sEnabled: { type: Boolean, default: false },
    k8sCluster: { type: String, default: '' },
    k8sNamespace: { type: String, default: '' },
    k8sManifest: { type: String, default: '' },
    remark: { type: String, default: '' },
  },
  { timestamps: true },
)

export const Project = mongoose.models.Project || mongoose.model('Project', projectSchema)
