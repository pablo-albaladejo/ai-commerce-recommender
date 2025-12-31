// ============================================================================
// Agent Domain - Multimodal Content
// ============================================================================

/**
 * A single piece of multimodal content.
 *
 * Today we only use `text`, but we model this as parts to support future:
 * - images (product photos)
 * - audio (voice notes)
 * - files (PDF specs)
 * - structured JSON payloads (UI selections, forms)
 */
export type ContentPart =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'image_url';
      url: string;
      mimeType?: string;
      altText?: string;
    }
  | {
      type: 'audio_url';
      url: string;
      mimeType?: string;
    }
  | {
      type: 'file_url';
      url: string;
      mimeType?: string;
      fileName?: string;
    }
  | {
      type: 'json';
      data: unknown;
    };

export type Content = ContentPart[];

export const textPart = (text: string): ContentPart => ({ type: 'text', text });
export const textContent = (text: string): Content => [textPart(text)];

/**
 * Best-effort conversion to plain text (for text-only models / channels).
 * Non-text parts are ignored.
 */
export const contentToPlainText = (content: Content): string => {
  return content
    .filter(
      (p): p is Extract<ContentPart, { type: 'text' }> => p.type === 'text'
    )
    .map(p => p.text)
    .join('\n');
};
