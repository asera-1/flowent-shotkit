export * from './types'
export { DeterministicDirector } from './deterministic'

import type { Director, DirectorInput, DirectorOutput } from './types'

// Bring-your-own vision model. The key lives in the caller; nothing is hosted here.
export interface VisionClient { complete(prompt: string, images: string[]): Promise<string> }

export class LlmDirector implements Director {
  constructor(private client: VisionClient) {}
  async generate(_input: DirectorInput): Promise<DirectorOutput> {
    // Reference flow: build a brand-voice prompt + banned-phrase list, send the
    // screenshots to this.client, parse the JSON DirectorOutput. Wire your provider here.
    throw new Error('LlmDirector: provide a VisionClient (BYOK) + brand-voice prompt. See docs/REUSABILITY.md section 12.')
  }
}
