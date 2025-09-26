'use client'

import AliasStoryClient from '@/app/[alias]/AliasStoryClient'

export default function PreviewClient({ snapshot }: { snapshot: any }) {
  return <AliasStoryClient snapshot={snapshot} pageType="version" />
}


