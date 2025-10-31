'use client'

import { useMemo } from 'react'

interface ChatBotDemoProps {
  selectedPatientId?: string | null
}

export default function ChatBotDemo({ selectedPatientId }: ChatBotDemoProps) {
  const patientContextText = useMemo(() => {
    if (selectedPatientId) return `Patient context: ${selectedPatientId.slice(0, 8)}…`
    return 'No patient selected — demo shows sample responses'
  }, [selectedPatientId])

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">🤖 Chat Bot Demo</h1>
            <p className="text-gray-600">
              Admin-only demo of the Grok‑4 powered assistant. This is a visual mockup — inputs are disabled.
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">{patientContextText}</div>
            <div className="text-xs text-blue-700">Aggregates/cross-patient insights coming soon</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left rail */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Preset Prompts</h3>
            <div className="flex flex-wrap gap-2">
              {[
                'Summarize last 4 weeks',
                'Draft Monday message',
                'Explain Morning Fat Burn %',
                'Flag risks',
                'Suggest actions',
              ].map((p) => (
                <button
                  key={p}
                  className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 text-xs cursor-not-allowed"
                  title="Demo only"
                  disabled
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Capabilities (Demo)</h3>
            <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
              <li>Patient-data Q&A (single patient only)</li>
              <li>Draft Monday message and explanations</li>
              <li>Identify plateaus and drivers</li>
              <li>Actionable next-step suggestions</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Coming Soon</h3>
            <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
              <li>Uploads analysis (PDF/screenshots)</li>
              <li>Cross-patient aggregates and cohort insights</li>
            </ul>
          </div>
        </div>

        {/* Center chat mock */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md flex flex-col h-[640px]">
            {/* Chat header */}
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-900">Dr. Nick's AI Assistant (Demo)</div>
                <div className="text-xs text-gray-500">Not medical advice • Single-patient scope</div>
              </div>
              <div>
                <button className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded cursor-not-allowed" disabled>
                  Send this to Nick
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50">
              {/* Turn 1 */}
              <div className="flex flex-col gap-1">
                <div className="self-end max-w-[80%] rounded-2xl rounded-br-sm bg-blue-600 text-white px-4 py-2">
                  Summarize my last 4 weeks.
                </div>
                <div className="text-[10px] text-right text-gray-500">You • just now</div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="self-start max-w-[85%] rounded-2xl rounded-bl-sm bg-white border px-4 py-3 text-gray-900 shadow-sm">
                  <div className="font-semibold mb-1">4‑Week Summary</div>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    <li>Weight: trending ↓ 1.4 lb; most loss Week 11</li>
                    <li>Waist: trending ↓ with minor rebound last week</li>
                    <li>Nutrition days: avg 5.2/7; strongest week 12</li>
                    <li>Sleep consistency: avg 78</li>
                  </ul>
                  <div className="text-xs text-gray-500 mt-2">Data window: Weeks 9–12</div>
                </div>
                <div className="text-[10px] text-gray-500">Grok‑4 • just now</div>
              </div>

              {/* Turn 2 */}
              <div className="flex flex-col gap-1">
                <div className="self-end max-w-[80%] rounded-2xl rounded-br-sm bg-blue-600 text-white px-4 py-2">
                  Explain Morning Fat Burn % and what mine implies.
                </div>
                <div className="text-[10px] text-right text-gray-500">You • 10s ago</div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="self-start max-w-[85%] rounded-2xl rounded-bl-sm bg-white border px-4 py-3 text-gray-900 shadow-sm">
                  <div className="font-semibold mb-1">Morning Fat Burn %</div>
                  <p className="text-sm">
                    This reflects morning metabolic flexibility. Your recent values (62–66%) suggest improving fat utilization, consistent with
                    better nutrition days and sleep. Sustaining 65%+ typically correlates with steady waist reduction.
                  </p>
                </div>
                <div className="text-[10px] text-gray-500">Grok‑4 • 9s ago</div>
              </div>

              {/* Turn 3 */}
              <div className="flex flex-col gap-1">
                <div className="self-end max-w-[80%] rounded-2xl rounded-br-sm bg-blue-600 text-white px-4 py-2">
                  Draft my Monday message.
                </div>
                <div className="text-[10px] text-right text-gray-500">You • 20s ago</div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="self-start max-w-[85%] rounded-2xl rounded-bl-sm bg-white border px-4 py-3 text-gray-900 shadow-sm">
                  <div className="font-semibold mb-1">Draft (Preview)</div>
                  <p className="text-sm">
                    Great work last week — weight trended down and nutrition days hit your goal. Let’s keep sleep consistency at ≥80 and aim
                    for 6/7 nutrition days. This week’s focus: maintain morning fat burn momentum and keep walks after meals.
                  </p>
                </div>
                <div className="text-[10px] text-gray-500">Grok‑4 • 19s ago</div>
              </div>
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t bg-white">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  disabled
                  placeholder="Type a message (demo only)"
                  className="flex-1 px-3 py-2 border rounded-md text-gray-900 bg-gray-50 cursor-not-allowed"
                />
                <button disabled className="px-4 py-2 rounded-md bg-blue-600 text-white cursor-not-allowed">Send</button>
              </div>
            </div>
          </div>
        </div>

        {/* Right rail */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Actions (Demo)</h3>
            <div className="flex flex-col gap-2">
              <button disabled className="px-3 py-2 bg-gray-100 text-gray-700 rounded cursor-not-allowed" title="Demo only">
                Create patient note
              </button>
              <button disabled className="px-3 py-2 bg-gray-100 text-gray-700 rounded cursor-not-allowed" title="Demo only">
                Set weight change goal
              </button>
              <button disabled className="px-3 py-2 bg-gray-100 text-gray-700 rounded cursor-not-allowed" title="Demo only">
                Set protein goal
              </button>
              <button disabled className="px-3 py-2 bg-gray-100 text-gray-700 rounded cursor-not-allowed" title="Demo only">
                Set resistance training goal
              </button>
              <button disabled className="px-3 py-2 bg-gray-100 text-gray-700 rounded cursor-not-allowed" title="Demo only">
                Mark submission reviewed
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Public Demo Mode</h3>
            <p className="text-sm text-gray-700">
              Admin-controlled. Uses a curated mock patient or anonymized data, with rate limits, watermark, and a prominent
              <span className="font-medium"> Not medical advice</span> banner.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}


