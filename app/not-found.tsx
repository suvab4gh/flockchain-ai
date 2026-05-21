import Link from 'next/link'
import { Bird, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="min-h-screen animated-bg flex items-center justify-center px-6 text-slate-800">
      <section className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-cyan-600 flex items-center justify-center shadow-sm">
          <Bird className="w-6 h-6 text-white" />
        </div>
        <div className="space-y-2">
          <p className="caption-uppercase text-slate-400 font-extrabold">404</p>
          <h1 className="title-lg text-slate-950">Route not found</h1>
          <p className="body-sm text-slate-550">
            This farm record or dashboard path is not available in the current FlockChain workspace.
          </p>
        </div>
        <Link href="/" className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-3">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to gateway</span>
        </Link>
      </section>
    </main>
  )
}
